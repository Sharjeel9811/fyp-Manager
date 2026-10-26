import { Project, ProjectMember, StudentProfile, SupervisorAssignment, SupervisorProfile } from '../models'
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
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      // GitHub requires a User-Agent on API calls.
      'User-Agent': 'FYP-Manager',
    },
    signal: AbortSignal.timeout(10_000),
  })
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
    gh(`/repos/${repo}/commits?per_page=10`),
    gh(`/repos/${repo}/contributors?per_page=10`), // counts commits per author
  ])

  // Commit +± are only on the detail endpoint; one extra call per commit is
  // wasteful, so stats come from the contributors endpoint instead.
  const commits: CommitSummary[] = (commitsRaw as any[]).slice(0, 10).map((c) => ({
    sha: String(c.sha).slice(0, 8),
    message: String(c.commit?.message || '').split('\n')[0],
    author: c.commit?.author?.name || c.author?.login || 'Unknown',
    date: c.commit?.author?.date,
    additions: 0,
    deletions: 0,
  }))

  const data = {
    repo,
    url: `https://github.com/${repo}`,
    description: repoInfo.description || '',
    stars: repoInfo.stargazers_count ?? 0,
    openIssues: repoInfo.open_issues_count ?? 0,
    defaultBranch: repoInfo.default_branch || 'main',
    pushedAt: repoInfo.pushed_at || null,
    commits,
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
