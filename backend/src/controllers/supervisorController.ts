import { Response } from 'express'
import {
  AuditLog, DefenseSchedule, Department, Feedback, Milestone, Notification,
  Project, ProjectMember, Proposal, StudentProfile, Submission, SupervisorAssignment,
  SupervisorProfile, User,
} from '../models'
import { AuthRequest } from '../middleware/auth'
import {
  asyncHandler, displayName, fullName, getSupervisorContext, projectProgress,
  stageFor, statusLabel, writeAudit,
} from '../utils/helpers'
import { calculateProjectHealth, recommendationsFor } from '../services/health'
import { broadcastActivity, emitToUser } from '../services/realtime'

interface ProjectSummary {
  id: string
  title: string
  student: string
  studentProfileId: string
  stage: string
  progress: number
  health: string
  riskScore: number
  nextDeadline: Date | null
  status: string
  department: string
}

async function summarizeProjects(projectIds: string[]): Promise<ProjectSummary[]> {
  const projects: any[] = await Project.find({ _id: { $in: projectIds } }).sort({ updatedAt: -1 }).lean()
  const results: ProjectSummary[] = []

  for (const p of projects) {
    const [members, milestones, department] = await Promise.all([
      ProjectMember.find({ projectId: p._id }).lean(),
      Milestone.find({ projectId: p._id }).sort({ dueDate: 1 }).lean(),
      p.departmentId ? Department.findById(p.departmentId).lean() : null,
    ])

    const lead = members.find((m: any) => m.role === 'LEAD') || members[0]
    let studentName = 'Unassigned'
    let studentProfileId = ''
    if (lead) {
      studentProfileId = String(lead.studentId)
      const profile: any = await StudentProfile.findById(lead.studentId).lean()
      if (profile) {
        const u: any = await User.findById(profile.userId).lean()
        if (u) studentName = fullName(u)
      }
    }

    const progress = await projectProgress(String(p._id))
    const upcoming = milestones.filter((m: any) => m.dueDate && m.status !== 'COMPLETED')
    const nextDeadline = upcoming.length ? new Date(upcoming[0].dueDate as any) : null

    results.push({
      id: String(p._id),
      title: p.title,
      student: studentName,
      studentProfileId,
      stage: stageFor(milestones),
      progress,
      health: p.riskLevel || 'LOW',
      riskScore: p.riskScore || 0,
      nextDeadline,
      status: p.status,
      department: department?.name || '—',
    })
  }

  return results
}

async function buildReviewQueue(projectIds: string[]) {
  const queue: any[] = []

  const proposals: any[] = await Proposal.find({
    projectId: { $in: projectIds },
    status: { $in: ['PROPOSAL_SUBMITTED', 'PROPOSAL_UNDER_REVIEW', 'PROPOSAL_REVISION_REQUIRED'] },
  }).sort({ submittedAt: -1 }).lean()

  for (const p of proposals) {
    const project: any = await Project.findById(p.projectId).lean()
    const members: any[] = await ProjectMember.find({ projectId: p.projectId }).lean()
    const lead = members.find((m: any) => m.role === 'LEAD') || members[0]
    const profile: any = lead ? await StudentProfile.findById(lead.studentId).lean() : null
    const u: any = profile ? await User.findById(profile.userId).lean() : null
    queue.push({
      id: String(p._id),
      projectId: String(p.projectId),
      title: p.title || project?.title,
      student: u ? fullName(u) : 'Student',
      project: project?.title || 'Project',
      type: 'Proposal',
      submitted: p.submittedAt,
      status: p.status,
    })
  }

  const submissions: any[] = await Submission.find({
    projectId: { $in: projectIds },
    status: { $in: ['UNDER_REVIEW', 'NEEDS_REVISION', 'PENDING'] },
  }).sort({ submittedAt: -1 }).lean()

  for (const s of submissions) {
    const project: any = await Project.findById(s.projectId).lean()
    const profile: any = s.studentId ? await StudentProfile.findById(s.studentId).lean() : null
    const u: any = profile ? await User.findById(profile.userId).lean() : null
    queue.push({
      id: String(s._id),
      projectId: String(s.projectId),
      title: s.title,
      student: u ? fullName(u) : 'Student',
      project: project?.title || 'Project',
      type: 'Submission',
      submitted: s.submittedAt,
      status: s.status,
    })
  }

  return queue.sort((a, b) => new Date(b.submitted).getTime() - new Date(a.submitted).getTime())
}

export const getOverview = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ctx = await getSupervisorContext(req.user!.id)
  if (!ctx) return res.status(404).json({ success: false, message: 'Supervisor profile not found' })

  const projects = await summarizeProjects(ctx.projectIds.map(String))
  const reviews = await buildReviewQueue(ctx.projectIds.map(String))
  const atRisk = projects.filter((p) => p.health !== 'LOW').length

  const supervisors: any[] = await SupervisorProfile.find().lean()
  const workload = []
  for (const s of supervisors) {
    const count = await SupervisorAssignment.countDocuments({ supervisorId: s._id })
    const u: any = await User.findById(s.userId).lean()
    const nameParts = u ? fullName(u).split(' ') : ['Supervisor']
    workload.push({ name: `Dr. ${nameParts.slice(-1)[0]}`, projects: count, capacity: s.maxSupervisees || 5 })
  }

  const defenses: any[] = await DefenseSchedule.find({ projectId: { $in: ctx.projectIds } }).sort({ scheduledDate: 1 }).lean()
  const schedules = defenses.map((d: any) => {
    const p = projects.find((x) => x.id === String(d.projectId))
    return { id: String(d._id), title: `Defense — ${p?.title || 'Project'}`, date: d.scheduledDate, time: new Date(d.scheduledDate).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }), venue: d.venue }
  })

  const attention = projects.filter((p) => p.health === 'HIGH')

  res.json({
    success: true,
    stats: {
      assignedProjects: projects.length,
      pendingReviews: reviews.length,
      atRisk,
      onTrack: projects.length - atRisk,
      capacity: ctx.supervisor.maxSupervisees || 5,
    },
    projects,
    reviews: reviews.slice(0, 5),
    attention,
    workload,
    schedule: schedules,
  })
})

export const getProjects = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ctx = await getSupervisorContext(req.user!.id)
  if (!ctx) return res.status(404).json({ success: false, message: 'Supervisor profile not found' })
  const projects = await summarizeProjects(ctx.projectIds.map(String))
  res.json({ success: true, projects })
})

export const getReviews = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ctx = await getSupervisorContext(req.user!.id)
  if (!ctx) return res.status(404).json({ success: false, message: 'Supervisor profile not found' })
  const queue = await buildReviewQueue(ctx.projectIds.map(String))
  const type = String(req.query.type || '').toLowerCase()
  const filtered = type === 'proposal' ? queue.filter((r) => r.type === 'Proposal') : type === 'submission' ? queue.filter((r) => r.type === 'Submission') : queue
  res.json({ success: true, reviews: filtered })
})

async function notifyStudent(projectId: string, title: string, message: string, link: string) {
  const members: any[] = await ProjectMember.find({ projectId }).lean()
  for (const m of members) {
    const profile: any = await StudentProfile.findById(m.studentId).lean()
    if (profile) {
      await Notification.create({ userId: profile.userId, title, message, type: 'review', link })
      // Push the bell over Socket.IO too; the notification drawer otherwise
      // only refreshes on its 15s poll.
      emitToUser(String(profile.userId), 'notification:new', { title, type: 'review' })
    }
  }
}

export const reviewProposal = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ctx = await getSupervisorContext(req.user!.id)
  if (!ctx) return res.status(404).json({ success: false, message: 'Supervisor profile not found' })

  const { status, comments } = req.body
  const allowed = ['PROPOSAL_APPROVED', 'PROPOSAL_REVISION_REQUIRED', 'PROPOSAL_REJECTED', 'PROPOSAL_UNDER_REVIEW']
  if (!allowed.includes(status)) return res.status(400).json({ success: false, message: 'Invalid proposal decision' })

  const proposal: any = await Proposal.findOne({ _id: req.params.id, projectId: { $in: ctx.projectIds } })
  if (!proposal) return res.status(404).json({ success: false, message: 'Proposal not found' })

  proposal.status = status
  proposal.reviewComments = comments || proposal.reviewComments
  proposal.reviewedAt = new Date()
  proposal.reviewedBy = req.user!.id
  await proposal.save()

  await Project.findByIdAndUpdate(proposal.projectId, { status })

  if (comments) {
    await Feedback.create({
      projectId: proposal.projectId,
      authorId: req.user!.id,
      content: comments,
      isRevisionRequest: status === 'PROPOSAL_REVISION_REQUIRED',
    })
  }

  await notifyStudent(String(proposal.projectId), 'Proposal reviewed', `Your proposal was marked "${statusLabel(status)}".`, '/student/proposal')
  await writeAudit({ userId: req.user!.id, projectId: String(proposal.projectId), action: `Proposal ${statusLabel(status)}`, entityType: 'Proposal', entityId: String(proposal._id) })
  await broadcastActivity({
    type: 'review',
    message: `Supervisor ${req.user?.firstName} ${req.user?.lastName} reviewed a proposal - ${statusLabel(status)}`,
    meta: { projectId: String(proposal.projectId) },
    byUserId: req.user!.id,
  })

  res.json({ success: true, message: `Proposal ${statusLabel(status).replace(/^Proposal\s+/i, '').toLowerCase()}`, status })
})

export const reviewSubmission = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ctx = await getSupervisorContext(req.user!.id)
  if (!ctx) return res.status(404).json({ success: false, message: 'Supervisor profile not found' })

  const { status, comments } = req.body
  const allowed = ['APPROVED', 'NEEDS_REVISION', 'REJECTED', 'UNDER_REVIEW']
  if (!allowed.includes(status)) return res.status(400).json({ success: false, message: 'Invalid submission decision' })

  const submission: any = await Submission.findOne({ _id: req.params.id, projectId: { $in: ctx.projectIds } })
  if (!submission) return res.status(404).json({ success: false, message: 'Submission not found' })

  submission.status = status
  submission.reviewedAt = new Date()
  submission.reviewerId = req.user!.id
  await submission.save()

  if (comments) {
    await Feedback.create({
      projectId: submission.projectId,
      submissionId: submission._id,
      authorId: req.user!.id,
      content: comments,
      isRevisionRequest: status === 'NEEDS_REVISION',
    })
  }

  await notifyStudent(String(submission.projectId), 'Submission reviewed', `"${submission.title}" was marked "${statusLabel(status)}".`, '/student/submissions')
  await writeAudit({ userId: req.user!.id, projectId: String(submission.projectId), action: `Submission ${statusLabel(status)}`, entityType: 'Submission', entityId: String(submission._id) })
  await calculateProjectHealth(String(submission.projectId))
  await broadcastActivity({
    type: 'review',
    message: `Supervisor ${req.user?.firstName} ${req.user?.lastName} reviewed submission "${submission.title}" - ${statusLabel(status)}`,
    meta: { projectId: String(submission.projectId) },
    byUserId: req.user!.id,
  })

  res.json({ success: true, message: `Submission ${statusLabel(status).replace(/^Submission\s+/i, '').toLowerCase()}`, status })
})

export const getMilestones = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ctx = await getSupervisorContext(req.user!.id)
  if (!ctx) return res.status(404).json({ success: false, message: 'Supervisor profile not found' })

  const milestones: any[] = await Milestone.find({ projectId: { $in: ctx.projectIds } }).sort({ dueDate: 1 }).lean()
  const projects: any[] = await Project.find({ _id: { $in: ctx.projectIds } }).lean()
  const projectById = new Map(projects.map((p: any) => [String(p._id), p]))

  const items = milestones.map((m: any) => ({
    id: String(m._id),
    projectId: String(m.projectId),
    project: projectById.get(String(m.projectId))?.title || 'Project',
    title: m.title,
    due: m.dueDate,
    progress: m.completionPercentage || 0,
    status: m.status,
  }))

  res.json({ success: true, milestones: items })
})

export const getHealth = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ctx = await getSupervisorContext(req.user!.id)
  if (!ctx) return res.status(404).json({ success: false, message: 'Supervisor profile not found' })

  const projects = await summarizeProjects(ctx.projectIds.map(String))
  const rows = []
  for (const p of projects) {
    const result = await calculateProjectHealth(p.id)
    rows.push({
      ...p,
      riskScore: result.score,
      health: result.level,
      score: result.score,
      lastChecked: result.checkedAt,
      reasons: result.reasons,
      factors: result.factors,
      affected: result.affected,
      recommendations: result.recommendations,
    })
  }

  const counts = {
    low: rows.filter((r) => r.health === 'LOW').length,
    medium: rows.filter((r) => r.health === 'MEDIUM').length,
    high: rows.filter((r) => r.health === 'HIGH').length,
    lastCalculated: new Date(),
  }

  res.json({ success: true, projects: rows, counts })
})

export const recalculateHealth = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ctx = await getSupervisorContext(req.user!.id)
  if (!ctx) return res.status(404).json({ success: false, message: 'Supervisor profile not found' })
  for (const id of ctx.projectIds) await calculateProjectHealth(String(id))
  await writeAudit({ userId: req.user!.id, action: 'Recalculated project health', entityType: 'Project', details: { scope: 'supervisor' } })
  res.json({ success: true, message: 'Health recalculated for all assigned projects' })
})

export const getSchedule = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ctx = await getSupervisorContext(req.user!.id)
  if (!ctx) return res.status(404).json({ success: false, message: 'Supervisor profile not found' })

  const defenses: any[] = await DefenseSchedule.find({ projectId: { $in: ctx.projectIds } }).sort({ scheduledDate: 1 }).lean()
  const projects: any[] = await Project.find({ _id: { $in: ctx.projectIds } }).lean()
  const projectById = new Map(projects.map((p: any) => [String(p._id), p]))

  const items = defenses.map((d: any) => ({
    id: String(d._id),
    title: `Defense — ${projectById.get(String(d.projectId))?.title || 'Project'}`,
    date: d.scheduledDate,
    time: new Date(d.scheduledDate).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }),
    venue: d.venue,
    status: d.status,
  }))

  res.json({ success: true, schedule: items })
})

export const getReports = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ctx = await getSupervisorContext(req.user!.id)
  if (!ctx) return res.status(404).json({ success: false, message: 'Supervisor profile not found' })

  const projects = await summarizeProjects(ctx.projectIds.map(String))
  const avg = projects.length ? Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length) : 0
  const completed = projects.filter((p) => p.status === 'COMPLETED').length
  const reviewsCompleted = await Feedback.countDocuments({ authorId: req.user!.id })

  const months: { month: string; progress: number }[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({ month: d.toLocaleString('en', { month: 'short' }), progress: Math.max(0, Math.round(avg - (5 - i) * 3)) })
  }
  months[months.length - 1].progress = avg

  res.json({
    success: true,
    stats: { avgProgress: avg, completed, reviewsCompleted, total: projects.length, atRisk: projects.filter((p) => p.health !== 'LOW').length },
    projects,
    progressTrend: months,
  })
})

export const getProjectDetail = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ctx = await getSupervisorContext(req.user!.id)
  if (!ctx) return res.status(404).json({ success: false, message: 'Supervisor profile not found' })
  if (!ctx.projectIds.map(String).includes(String(req.params.id))) {
    return res.status(403).json({ success: false, message: 'This project is not assigned to you' })
  }
  const result = await calculateProjectHealth(req.params.id)
  res.json({ success: true, health: result, recommendations: recommendationsFor(result.level) })
})
