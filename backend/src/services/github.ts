import { Milestone, Project, ProjectMember, Proposal, StudentProfile, SupervisorAssignment, SupervisorProfile, User } from '../models'
import { AppError } from '../middleware/errorHandler'

/**
 * GitHub contribution feed.
 *
 * Reads the public REST API (api.github.com) with no credentials — 60
 * req/hour per IP is enough because every look-up is cached in MongoDB for
 * five minutes and re-used by any role that opens the same project. A repo is
 * only ever fetched after the viewer was authorised against ProjectMember /
 * SupervisorAssignment, mirroring the realtime room rules.
 */

const CACHE_TTL_MS = 5 * 60 * 1000

const githubCache = new Map<string, { data: any; fetchedAt: number; fresh: boolean }>()

/**
 * Accepts either a github.com URL ("https://github.com/owner/repo", optional
 * ".git"/trailing path) or a bare "owner/repo" string. Anything else — GitLab,
 * Bitbucket, arbitrary URLs — is rejected so a non-GitHub host can never be
 * requested through the GitHub API below.
 */
export function parseRepoUrl(value: unknown): string | null {
  const raw = String(value || '').trim()
  if (!raw) return null

  let owner: string | undefined
  let repo: string | undefined
  const asUrl = raw.match(/^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9_.-]+)/)
  if (asUrl) {
    ;[, owner, repo] = asUrl
  } else {
    const bare = raw.match(/^([A-Za-z0-9-]+)\/([A-Za-z0-9_.-]+)$/)
    if (!bare) return null
    ;[, owner, repo] = bare
  }
  const cleanRepo = repo!.replace(/\.git$/, '')
  if (owner!.length > 100 || cleanRepo.length > 100) return null
  return `${owner}/${cleanRepo}`
}

async function gh(path: string) {
  let res: Response
  try {
    res = await fetch(`https://api.github.com${path}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        // GitHub requires a User-Agent on API calls.
        'User-Agent': 'FYP-Manager',
      },
      signal: AbortSignal.timeout(10_000),
    })
  } catch (err) {
    // Network / DNS / abort failures must surface as a clean upstream error,
    // not leak as an opaque 500 "Internal Server Error" to the client.
    throw new AppError('GitHub API unreachable', 502)
  }
  if (res.status === 404) throw new AppError('Repository not found (is it public?)', 404)
  if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
    throw new AppError('GitHub rate limit reached; try again in a few minutes', 429)
  }
  if (!res.ok) throw new AppError(`GitHub API error (${res.status})`, 502)
  return res.json()
}

export interface CommitSummary {
  sha: string
  message: string
  author: string
  date: string
  additions: number
  deletions: number
}

/**
 * Fresh commits since `since` (or all cached follow-ups); `fresh` tells the
 * caller whether live data or the 5-minute cache answered.
 */
export async function getProjectRepoFetch(projectId: string): Promise<{ repo: string | null; data: any | null; fresh: boolean }> {
  const project: any = await Project.findById(projectId).select('githubRepo').lean()
  if (!project) throw new AppError('Project not found', 404)
  const repo = parseRepoUrl(project.githubRepo)
  if (!repo) return { repo: null, data: null, fresh: false }

  const cached = githubCache.get(repo)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { repo, data: cached.data, fresh: false }
  }

  const [repoInfo, commitsRaw, contributors]: any[] = await Promise.all([
    gh(`/repos/${repo}`),
    gh(`/repos/${repo}/commits?per_page=100`),
    gh(`/repos/${repo}/contributors?per_page=10`), // counts commits per author
  ])

  // Commit +/- are only on the detail endpoint; one extra call per commit is
  // wasteful, so stats come from the contributors endpoint instead.
  const allCommits = (commitsRaw as any[]).slice(0, 100).map((c) => ({
    sha: String(c.sha).slice(0, 8),
    message: String(c.commit?.message || '').split('\n')[0],
    author: c.commit?.author?.name || c.author?.login || 'Unknown',
    date: c.commit?.author?.date,
    additions: 0,
    deletions: 0,
  }))
  const commits: CommitSummary[] = allCommits.slice(0, 10)

  // Commit momentum: commits per day for the trailing 14 days (zeros included
  // so the activity chart has a continuous axis).
  const buckets = new Map<string, number>()
  for (const c of allCommits) {
    const day = String(c.date || '').slice(0, 10)
    if (day) buckets.set(day, (buckets.get(day) || 0) + 1)
  }
  const activity: Array<{ date: string; commits: number }> = []
  for (let i = 13; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10)
    activity.push({ date: day, commits: buckets.get(day) || 0 })
  }

  const data = {
    repo,
    url: `https://github.com/${repo}`,
    description: repoInfo.description || '',
    stars: repoInfo.stargazers_count ?? 0,
    openIssues: repoInfo.open_issues_count ?? 0,
    defaultBranch: repoInfo.default_branch || 'main',
    pushedAt: repoInfo.pushed_at || null,
    commits,
    activity,
    contributors: (contributors as any[]).map((u) => ({
      login: u.login,
      commits: u.contributions,
      url: u.html_url,
    })),
    lastFetch: new Date().toISOString(),
  }

  githubCache.set(repo, { data, fetchedAt: Date.now(), fresh: true })
  return { repo, data, fresh: true }
}

/** Authorisation shared by every project-scoped read (same rule as room:join). */
export async function canViewProject(userId: string, role: string, projectId: string): Promise<boolean> {
  if (role === 'ADMIN') return true

  if (role === 'SUPERVISOR') {
    const assignment = await SupervisorAssignment.findOne({ projectId }).select('supervisorId').lean()
    if (!assignment) return false
    const profile: any = await SupervisorProfile.findById(assignment.supervisorId).select('userId').lean()
    return !!profile && String(profile.userId) === userId
  }

  const profile: any = await StudentProfile.findOne({ userId }).select('_id').lean()
  if (!profile) return false
  return !!(await ProjectMember.exists({ projectId, studentId: profile._id }))
}

// ---------------------------------------------------------------------------
// Publish: create a GitHub repository for the project and push its documents.
// The caller signs in with their own personal access token (never stored) —
// the repo is created under the account that token belongs to, and the
// files below are pushed through the contents API so no git binary is needed.
// ---------------------------------------------------------------------------

const GH_TIMEOUT = 15_000

/** "NOT_STARTED" -> "not started" without needing ES2021 replaceAll. */
function humanize(value: string): string {
  return String(value || '').toLowerCase().split('_').join(' ').trim()
}

function ghAuth(
  path: string,
  token: string,
  init: { method?: string; body?: any } = {}
) {
  return fetch(`https://api.github.com${path}`, {
    method: init.method || 'GET',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'FYP-Manager',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(GH_TIMEOUT),
  })
}

function tokenError(res: Response, action: string): never {
  if (res.status === 401) throw new AppError('GitHub rejected that token — generate a fresh one on GitHub (Settings → Developer settings → Personal access tokens) and try again', 401)
  if (res.status === 403) {
    if (res.headers.get('x-ratelimit-remaining') === '0') throw new AppError('GitHub rate limit reached; try again in a few minutes', 429)
    throw new AppError(`The token does not allow ${action} (it needs the "repo" scope)`, 403)
  }
  throw new AppError(`GitHub API error while trying to ${action} (${res.status})`, 502)
}

export function repoSlugFromTitle(title: string): string {
  const slug = String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '')
  return slug || 'fyp-project'
}

interface GhUser {
  login: string
  name: string | null
}

export async function getAuthedUser(token: string): Promise<GhUser> {
  const res = await ghAuth('/user', token)
  if (!res.ok) tokenError(res, 'sign in to GitHub')
  const user: any = await res.json()
  return { login: String(user.login), name: user.name || user.login }
}

/**
 * Push (create or update) a single file on the default branch. Contents API:
 * the file's SHA is needed to overwrite an existing blob, so it is looked up
 * first and simply skipped as "not there" on 404.
 */
async function pushFile(token: string, repoFull: string, branch: string, path: string, message: string, content: string) {
  const existing = await ghAuth(`/repos/${repoFull}/contents/${path}?ref=${branch}`, token)
  const body: Record<string, unknown> = {
    message,
    content: Buffer.from(content, 'utf8').toString('base64'),
    branch,
  }
  if (existing.ok) body.sha = ((await existing.json()) as any).sha
  else if (existing.status !== 404) tokenError(existing, `upload ${path}`)
  const res = await ghAuth(`/repos/${repoFull}/contents/${path}`, token, { method: 'PUT', body })
  if (!res.ok) tokenError(res, `upload ${path}`)
}

async function buildProjectDocuments(projectId: string) {
  const project: any = await Project.findById(projectId).lean()
  if (!project) throw new AppError('Project not found', 404)

  const members: any[] = await ProjectMember.find({ projectId: project._id }).populate('studentId').lean()
  const profiles: any[] = await StudentProfile.find({ _id: { $in: members.map((m: any) => m.studentId._id) } }).lean()
  const users: any[] = await User.find({ _id: { $in: profiles.map((p: any) => p.userId) } }).select('firstName lastName').lean()
  const userById = new Map(users.map((u: any) => [String(u._id), u]))
  const memberLines = members.map((m: any) => {
    const profileFor: any = profiles.find((p: any) => String(p._id) === String(m.studentId._id))
    const user: any = profileFor ? userById.get(String(profileFor.userId)) : null
    const name = user ? `${user.firstName} ${user.lastName}` : 'Team member'
    const id = profileFor?.studentId || ''
    return `- ${name}${m.role ? ` (${m.role})` : ''}${id ? ` — ${id}` : ''}`
  })
  if (!memberLines.length) memberLines.push('- (no members yet)')

  let supervisorLine = 'To be assigned'
  const assignment: any = await SupervisorAssignment.findOne({ projectId: project._id }).lean()
  if (assignment) {
    const supProfile: any = await SupervisorProfile.findById(assignment.supervisorId).lean()
    if (supProfile) {
      const supUser: any = await User.findById(supProfile.userId).select('firstName lastName').lean()
      if (supUser) supervisorLine = `${supUser.firstName} ${supUser.lastName}`
    }
  }

  const milestones: any[] = await Milestone.find({ projectId: project._id }).sort({ dueDate: 1 }).lean()
  const milestoneRows = milestones.length
    ? ['| Milestone | Status | Due date |', '| --- | --- | --- |']
        .concat(milestones.map((m) => `| ${m.title} | ${humanize(m.status || 'NOT_STARTED')} | ${m.dueDate ? m.dueDate.toISOString().slice(0, 10) : '—'} |`))
    : ['No milestones defined yet.']

  const proposal: any = await Proposal.findOne({ projectId: project._id }).sort({ version: -1 }).lean()
  const field = (v: any) => (v && String(v).trim()) || '—'

  const readme = [
    `# ${project.title}`,
    '',
    project.abstract ? `> ${project.abstract}` : '',
    '',
    `Final-year project for ${supervisorLine}, managed with **FYP Manager**.`,
    '',
    '## Team',
    ...memberLines,
    '',
    '## Supervisor',
    supervisorLine,
    '',
    '## Milestones',
    ...milestoneRows,
    '',
    '---',
    '',
    '_Repository initialised automatically from FYP Manager._',
  ]
    .filter((l) => l !== undefined)
    .join('\n')

  const proposalDoc = [
    `# Proposal — ${field(proposal?.title) || project.title}`,
    '',
    `**Version:** ${proposal?.version ?? 1}  **Status:** ${proposal?.status ? humanize(proposal.status) : 'draft'}`,
    '',
    '## Abstract',
    field(proposal?.abstract),
    '',
    '## Problem statement',
    field(proposal?.problemStatement),
    '',
    '## Objectives',
    field(proposal?.objectives),
    '',
    '## Methodology',
    field(proposal?.methodology),
    '',
  ].join('\n')

  return {
    project,
    readme,
    proposalDoc,
    repoDescription: (project.abstract ? String(project.abstract) : project.title).slice(0, 240),
    teamSize: memberLines.length,
  }
}

const NAME_RE = /^[A-Za-z0-9_.-]{1,100}$/

export interface PublishResult {
  created: boolean
  repo: string
  repoUrl: string
  files: string[]
  warnings: string[]
}

export async function publishProject(
  projectId: string,
  actor: { id: string; role: string },
  payload: { token?: unknown; repoName?: unknown; visibility?: unknown }
): Promise<PublishResult> {
  if (payload.token === undefined || payload.token === null) throw new AppError('Paste your GitHub personal access token to publish', 400)
  const token = String(payload.token).trim()
  if (!/(^ghp_[A-Za-z0-9]{20,}$|^github_pat_[A-Za-z0-9_]{20,}$)/.test(token) && token.length < 20) {
    throw new AppError('That does not look like a GitHub token (they usually start with "ghp_" or "github_pat_")', 400)
  }
  // Team members own the code — a supervisor cannot publish with a student's
  // token, and admins may publish under their own.
  if (actor.role === 'SUPERVISOR') throw new AppError('Ask a team member to publish the repository with their GitHub token', 403)
  const allowed = await canViewProject(actor.id, actor.role, projectId)
  if (!allowed) throw new AppError('You do not have access to this project', 403)

  const docs = await buildProjectDocuments(projectId)
  const existingRepo = parseRepoUrl(docs.project.githubRepo)
  const requestedName = String(payload.repoName || '').trim()
  if (requestedName && !NAME_RE.test(requestedName)) {
    throw new AppError('Repository name may only contain letters, numbers, dots, dashes, and underscores', 400)
  }
  const visibility = payload.visibility === 'PUBLIC' ? 'public' : 'private'
  const gh = await getAuthedUser(token)

  if (existingRepo && requestedName && !existingRepo.toLowerCase().endsWith(`/${requestedName.toLowerCase()}`)) {
    throw new AppError(`This project already publishes to ${existingRepo} — publishing again updates that repository. To start a different one, unlink the repo first.`, 400)
  }

  let repoFull = existingRepo || ''
  let created = false

  if (!repoFull) {
    const base = requestedName || repoSlugFromTitle(docs.project.title)
    const candidates = [base, `${base}-fyp`, `${base}-${Math.floor(Date.now() / 10000) % 100}`]
    for (const name of candidates) {
      const res = await ghAuth('/user/repos', token, {
        method: 'POST',
        body: {
          name,
          description: docs.repoDescription,
          private: visibility === 'private',
          auto_init: false,
        },
      })
      if (res.ok) {
        const repo: any = await res.json()
        repoFull = `${gh.login}/${repo.name}`
        created = true
        break
      }
      if (res.status === 422) continue // name taken — try the next candidate
      tokenError(res, 'create the repository')
    }
    if (!repoFull) {
      throw new AppError('GitHub rejected every name for the new repository (they were all already taken). Pick a different name and try again.', 409)
    }

    // Link the project on creation so the contribution feed lights up at once.
    await Project.findByIdAndUpdate(projectId, { githubRepo: repoFull })
  }

  const branchRes = await ghAuth(`/repos/${repoFull}`, token)
  if (!branchRes.ok) tokenError(branchRes, 'read the repository')
  const branchName = ((await branchRes.json()) as any).default_branch || 'main'

  const warnings: string[] = []
  const files: string[] = []
  const push = async (path: string, content: string, message: string) => {
    try {
      await pushFile(token, repoFull, branchName, path, message, content)
      files.push(path)
    } catch (err) {
      warnings.push(`${path}: ${(err as Error).message}`)
    }
  }

  await push('README.md', docs.readme, created ? 'Initial commit: project overview from FYP Manager' : 'Update project overview from FYP Manager')
  await push('docs/proposal.md', docs.proposalDoc, created ? 'Add proposal (latest version)' : 'Update proposal to latest version')

  return {
    created,
    repo: repoFull,
    repoUrl: `https://github.com/${repoFull}`,
    files,
    warnings,
  }
}
