import { Feedback, Milestone, Project, Submission } from '../models'

export interface HealthFactor {
  label: string
  pts: number
  active: boolean
}

export interface HealthResult {
  score: number
  level: 'LOW' | 'MEDIUM' | 'HIGH'
  checkedAt: Date
  reasons: string[]
  affected: string[]
  recommendations: string[]
  factors: HealthFactor[]
}

export function recommendationsFor(level: 'LOW' | 'MEDIUM' | 'HIGH'): string[] {
  if (level === 'HIGH') {
    return [
      'Schedule an immediate check-in with the supervisor',
      'Prioritise and clear every overdue milestone',
      'Resolve outstanding revision requests this week',
    ]
  }
  if (level === 'MEDIUM') {
    return [
      'Review upcoming deadlines and confirm the plan',
      'Respond to pending supervisor feedback',
      'Update milestone progress notes',
    ]
  }
  return ['Continue with the planned milestones', 'Keep progress notes and submissions current']
}

export async function calculateProjectHealth(projectId: string): Promise<HealthResult> {
  const project: any = await Project.findById(projectId).lean()
  const milestones: any[] = await Milestone.find({ projectId }).lean()
  const feedback: any[] = await Feedback.find({ projectId }).lean()
  const submissions: any[] = await Submission.find({ projectId }).lean()

  const now = new Date()
  const factors: HealthFactor[] = []
  const reasons: string[] = []
  const affected: string[] = []

  const overdue = milestones.filter((m) => m.dueDate && new Date(m.dueDate) < now && m.status !== 'COMPLETED')
  const overduePts = Math.min(overdue.length * 20, 40)
  factors.push({ label: `Overdue milestones (${overdue.length})`, pts: overduePts, active: overdue.length > 0 })
  if (overdue.length) {
    reasons.push(`${overdue.length} overdue milestone${overdue.length > 1 ? 's' : ''}`)
    overdue.forEach((m) => affected.push(m.title))
  }

  const lastUpdate = project?.updatedAt ? new Date(project.updatedAt) : now
  const daysInactive = Math.floor((now.getTime() - lastUpdate.getTime()) / 86400000)
  const inactivePts = daysInactive >= 30 ? 20 : daysInactive >= 14 ? 10 : 0
  factors.push({ label: `Inactivity (${daysInactive} days)`, pts: inactivePts, active: inactivePts > 0 })
  if (inactivePts > 0) reasons.push(`No project update recorded in ${daysInactive} days`)

  const revisions = feedback.filter((f) => f.isRevisionRequest)
  const revisionPts = revisions.length >= 3 ? 15 : revisions.length * 5
  factors.push({ label: `Revision requests (${revisions.length})`, pts: revisionPts, active: revisions.length > 0 })
  if (revisions.length) reasons.push(`${revisions.length} revision request${revisions.length > 1 ? 's' : ''} outstanding`)

  const pendingReviews = submissions.filter((s) => s.status === 'UNDER_REVIEW' || s.status === 'NEEDS_REVISION')
  const reviewPts = Math.min(pendingReviews.length * 3, 9)
  factors.push({ label: `Outstanding reviews (${pendingReviews.length})`, pts: reviewPts, active: pendingReviews.length > 0 })
  if (pendingReviews.length) reasons.push(`${pendingReviews.length} submission${pendingReviews.length > 1 ? 's' : ''} awaiting review`)

  const score = Math.min(
    100,
    factors.reduce((sum, f) => sum + f.pts, 0)
  )
  const level: HealthResult['level'] = score >= 50 ? 'HIGH' : score >= 25 ? 'MEDIUM' : 'LOW'

  if (!reasons.length) reasons.push('All milestones are on schedule and activity is current')

  await Project.findByIdAndUpdate(projectId, { riskScore: score, riskLevel: level, lastHealthCheck: now })

  return {
    score,
    level,
    checkedAt: now,
    reasons,
    affected,
    recommendations: recommendationsFor(level),
    factors,
  }
}
