import { Proposal, Project, ProjectMember, StudentProfile, User } from '../models'
import { fullName } from '../utils/helpers'

/**
 * Rule-based duplicate detection between FYP proposals.
 *
 * Every proposal becomes one document (title weighted heaviest, then abstract,
 * then objectives/methodology). A hand-rolled TF-IDF vectoriser runs over all
 * of them, similarity is the cosine of the two term vectors, and pairs at or
 * above the threshold (0.28) are flagged for manual review. This is deliberately
 * explainable and dependency-free: n-gram fingerprinting (e.g. Turnitin-style)
 * is the upgrade path if a real plagiarism engine is ever required.
 */

const FLAG_THRESHOLD = 0.28
const MAX_PAIRS = 40

/** Words too common in FYP abstracts to be discriminative. */
const STOP_WORDS = new Set(
  `a about above after again against all also am an and any are as at be because been before being below between
  both but by can cannot could did do does doing down during each few for from further had has have having he her
  here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not now of
  off on once only or other our ours ourselves out over own same she should so some such than that the their theirs
  them themselves then there these they this those through to too under until up use used using very was we were
  what when where which while who whom why will with would you your yours yourself project projects study research
  system systems based application applications paper work will within order also may one two`
    .split(/\s+/)
    .filter(Boolean)
)

const TOKEN_RE = /[a-z][a-z0-9'-]+/g

export function tokenize(text: string): string[] {
  return (String(text || '')
    .toLowerCase()
    .match(TOKEN_RE) || []).filter((t) => t.length > 2 && !STOP_WORDS.has(t))
}

export function cosine(a: Map<string, number>, b: Map<string, number>): number {
  if (!a.size || !b.size) return 0
  let dot = 0
  const [small, large] = a.size <= b.size ? [a, b] : [b, a]
  for (const [term, va] of small) {
    const vb = large.get(term)
    if (vb) dot += va * vb
  }
  let na = 0
  let nb = 0
  a.forEach((v) => (na += v * v))
  b.forEach((v) => (nb += v * v))
  return Math.sqrt(na * nb) ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0
}

function docVector(texts: string[], weight: number): Map<string, number> {
  const counts = new Map<string, number>()
  const bump = (raw: string, w: number) => {
    for (const term of tokenize(raw)) {
      counts.set(term, (counts.get(term) || 0) + w)
    }
  }
  texts.forEach((t) => bump(t, weight))
  return counts
}

export interface SimilarityPair {
  aId: string
  bId: string
  aTitle: string
  bTitle: string
  aProject: string
  bProject: string
  similarity: number
  flagged: boolean
  sharedTerms: string[]
}

export interface SimilarityReport {
  checked: number
  flaggedThreshold: number
  pairs: SimilarityPair[]
  flaggedCount: number
  highest: number
}

export async function compareProposals(): Promise<SimilarityReport> {
  const proposals: any[] = await Proposal.find({})
    .select(
      'projectId title abstract problemStatement objectives methodology technologyStack'
    )
    .lean()
  if (proposals.length < 2) {
    return { checked: proposals.length, flaggedThreshold: FLAG_THRESHOLD, pairs: [], flaggedCount: 0, highest: 0 }
  }
  const projects: any[] = await Project.find({ _id: { $in: proposals.map((p) => p.projectId) } })
    .select('title')
    .lean()
  const titleById = new Map(projects.map((p: any) => [String(p._id), p.title]))

  const docs = proposals.map((p: any) => ({
    id: String(p._id),
    title: p.title || titleById.get(String(p.projectId)) || 'Untitled project',
    project: titleById.get(String(p.projectId)) || '',
    vector: docVector(
      [
        p.title,
        p.title,
        p.title, // titles carry the identity of the work
        p.abstract,
        p.problemStatement,
        p.objectives,
        p.methodology,
      ].filter(Boolean) as string[],
      (p.abstract || '').length > (p.methodology || '').length ? 1 : 1.6
    ),
  }))

  // Inverse document frequency over the whole corput of proposals.
  const df = new Map<string, number>()
  docs.forEach((d) => d.vector.forEach((_, term) => df.set(term, (df.get(term) || 0) + 1)))
  const total = docs.length
  const idf = new Map<string, number>()
  df.forEach((n, term) => idf.set(term, Math.log((total + 1) / (n + 0.5))))

  const weighted = docs.map((d) => {
    const tfidf = new Map<string, number>()
    d.vector.forEach((tf, term) => tfidf.set(term, tf * (idf.get(term) || 0)))
    return { ...d, tfidf }
  })

  const pairs: SimilarityPair[] = []
  for (let i = 0; i < weighted.length; i++) {
    for (let j = i + 1; j < weighted.length; j++) {
      const a = weighted[i]
      const b = weighted[j]
      const score = cosine(a.tfidf, b.tfidf)
      if (score <= FLAG_THRESHOLD * 0.6) continue
      const sharedTerms = [...a.tfidf.keys()]
        .filter((t) => b.tfidf.has(t))
        .sort((x, y) => b.tfidf.get(y)! - b.tfidf.get(y)!)
        .slice(0, 6)
      pairs.push({
        aId: a.id,
        bId: b.id,
        aTitle: a.title,
        bTitle: b.title,
        aProject: a.project,
        bProject: b.project,
        similarity: Math.round(score * 1000) / 1000,
        flagged: score >= FLAG_THRESHOLD,
        sharedTerms,
      })
    }
  }

  pairs.sort((a, b) => b.similarity - a.similarity)
  const trimmed = pairs.slice(0, MAX_PAIRS)
  return {
    checked: proposals.length,
    flaggedThreshold: FLAG_THRESHOLD,
    pairs: trimmed,
    flaggedCount: trimmed.filter((p) => p.flagged).length,
    highest: trimmed.length ? trimmed[0].similarity : 0,
  }
}

/** Names of the students behind a project, used to label suspect pairs. */
export async function projectTeamNames(projectIds: string[]): Promise<Map<string, string[]>> {
  const members: any[] = await ProjectMember.find({ projectId: { $in: projectIds } }).lean()
  const profiles: any[] = await StudentProfile.find({
    _id: { $in: members.map((m: any) => m.studentId) },
  })
    .select('userId')
    .lean()
  const users: any[] = await User.find({ _id: { $in: profiles.map((p: any) => p.userId) } })
    .select('firstName lastName')
    .lean()
  const userById = new Map(users.map((u: any) => [String(u._id), fullName(u)]))
  const profileById = new Map(profiles.map((p: any) => [String(p._id), p]))
  const result = new Map<string, string[]>()
  for (const m of members) {
    const list = result.get(String(m.projectId)) || []
    const profile: any = profileById.get(String(m.studentId))
    const name = profile ? userById.get(String(profile.userId)) : undefined
    if (name) list.push(name)
    result.set(String(m.projectId), list)
  }
  return result
}
