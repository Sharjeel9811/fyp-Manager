import { Response } from 'express'
import {
  AcademicSession, AuditLog, Comment, DefenseSchedule, Department, Evaluation,
  Feedback, Milestone, Notification, Project, ProjectMember, Proposal, ProposalVersion,
  StudentProfile, Submission, SupervisorAssignment, SupervisorProfile, User,
} from '../models'
import { AuthRequest } from '../middleware/auth'
import {
  asyncHandler, displayName, fullName, getStudentContext, projectProgress, stageFor,
  statusLabel, supervisorNameForProject, writeAudit,
} from '../utils/helpers'
import { calculateProjectHealth } from '../services/health'
import { broadcastActivity, emitToUser } from '../services/realtime'

async function buildStudentBundle(userId: string) {
  const ctx = await getStudentContext(userId)
  if (!ctx || !ctx.project) return null
  const { student, project } = ctx

  const [department, session, members, milestones, submissions, feedback, proposal, defense, assignment, studentUser] =
    await Promise.all([
      project.departmentId ? Department.findById(project.departmentId).lean() : null,
      project.academicSessionId ? AcademicSession.findById(project.academicSessionId).lean() : null,
      ProjectMember.find({ projectId: project._id }).lean(),
      Milestone.find({ projectId: project._id }).sort({ order: 1, dueDate: 1 }).lean(),
      Submission.find({ projectId: project._id }).sort({ submittedAt: -1 }).lean(),
      Feedback.find({ projectId: project._id }).sort({ createdAt: -1 }).lean(),
      Proposal.findOne({ projectId: project._id }).lean(),
      DefenseSchedule.findOne({ projectId: project._id }).lean(),
      SupervisorAssignment.findOne({ projectId: project._id }).lean(),
      User.findById(userId).lean(),
    ])

  const memberStudentIds = members.map((m: any) => m.studentId)
  const memberProfiles: any[] = await StudentProfile.find({ _id: { $in: memberStudentIds } }).lean()
  const memberUsers: any[] = await User.find({ _id: { $in: memberProfiles.map((p) => p.userId) } }).lean()
  const userById = new Map(memberUsers.map((u: any) => [String(u._id), u]))
  const profileById = new Map(memberProfiles.map((p: any) => [String(p._id), p]))

  const team = members.map((m: any) => {
    const profile: any = profileById.get(String(m.studentId))
    const u: any = profile ? userById.get(String(profile.userId)) : null
    return {
      id: profile?.studentId || String(m._id),
      memberId: String(m._id),
      profileId: String(m.studentId),
      name: u ? fullName(u) : 'Student',
      role: m.role === 'LEAD' ? 'Team Lead' : m.role === 'MEMBER' ? 'Member' : m.role,
      email: u?.email || '',
      isLead: m.role === 'LEAD',
    }
  })

  let supervisor = 'Unassigned'
  if (assignment) {
    const info = await supervisorNameForProject(String(project._id))
    supervisor = info?.name || 'Unassigned'
  }

  const progress = await projectProgress(String(project._id))
  const stage = stageFor(milestones)

  const milestoneItems = milestones.map((m: any) => ({
    id: String(m._id),
    title: m.title,
    status: m.status,
    due: m.dueDate,
    startDate: m.startDate,
    progress: m.completionPercentage || 0,
    description: m.description || '',
    owner: studentUser ? fullName(studentUser) : 'Student',
  }))

  const submissionItems = submissions.map((s: any) => ({
    id: String(s._id),
    title: s.title,
    type: s.type || 'Report',
    status: s.status,
    submitted: s.submittedAt,
    version: s.version || 1,
    reviewer: supervisor,
    description: s.description || '',
  }))

  const submissionById = new Map(submissions.map((s: any) => [String(s._id), s]))
  const authorIds = [...new Set(feedback.map((f: any) => String(f.authorId)))]
  const authors: any[] = await User.find({ _id: { $in: authorIds } }).lean()
  const authorById = new Map(authors.map((a: any) => [String(a._id), a]))

  const feedbackItems = feedback.map((f: any) => {
    const author: any = authorById.get(String(f.authorId))
    const sub: any = f.submissionId ? submissionById.get(String(f.submissionId)) : null
    return {
      id: String(f._id),
      author: author ? displayName(author.role, author) : 'Supervisor',
      authorRole: author?.role === 'SUPERVISOR' ? 'Supervisor' : 'Coordinator',
      content: f.content,
      date: f.createdAt,
      isRevision: !!f.isRevisionRequest,
      submission: sub?.title || 'General feedback',
    }
  })

  const healthResult = await calculateProjectHealth(String(project._id))

  const evaluation: any = await Evaluation.findOne({ projectId: project._id, isReleased: true }).lean()
  const evaluations = evaluation
    ? evaluation.scores.map((s: any) => ({
        id: String(s._id || s.criterionId),
        criterion: s.name,
        score: s.score,
        max: s.max,
        weight: s.weight,
      }))
    : []

  const pendingReviews = submissions.filter((s: any) => s.status === 'UNDER_REVIEW').length
  const now = new Date()
  const in14 = new Date(now.getTime() + 14 * 86400000)
  const upcoming = milestones.filter((m: any) => m.dueDate && new Date(m.dueDate) >= now && new Date(m.dueDate) <= in14 && m.status !== 'COMPLETED')

  const proposalApproved = proposal?.status === 'PROPOSAL_APPROVED' || project.status === 'PROPOSAL_APPROVED' || project.status === 'IN_PROGRESS' || project.status === 'COMPLETED'
  const approvedSubmissions = submissions.filter((s: any) => s.status === 'APPROVED').length
  const revisionFeedback = feedback.filter((f: any) => f.isRevisionRequest).length
  const overdueMilestones = milestones.filter((m: any) => m.dueDate && new Date(m.dueDate) < now && m.status !== 'COMPLETED')
  const readinessComponents = [
    {
      key: 'proposal',
      label: 'Scope & proposal',
      score: proposalApproved ? 25 : proposal ? 16 : 6,
      max: 25,
      detail: proposalApproved ? 'Proposal approved' : proposal ? 'Awaiting proposal approval' : 'Proposal not started',
    },
    {
      key: 'delivery',
      label: 'Deliverable progress',
      score: Math.round((Math.min(progress, 100) / 100) * 35),
      max: 35,
      detail: `${progress}% of planned work complete`,
    },
    {
      key: 'quality',
      label: 'Review outcomes',
      score: approvedSubmissions > 0 ? 20 : pendingReviews > 0 ? 12 : 6,
      max: 20,
      detail: approvedSubmissions > 0 ? `${approvedSubmissions} approved deliverable${approvedSubmissions === 1 ? '' : 's'}` : `${pendingReviews} review${pendingReviews === 1 ? '' : 's'} pending`,
    },
    {
      key: 'risk',
      label: 'Risk management',
      score: healthResult.score <= 20 ? 20 : healthResult.score <= 49 ? 12 : 4,
      max: 20,
      detail: healthResult.score <= 20 ? 'Project health is stable' : 'Risk factors need attention',
    },
  ]
  const readinessScore = readinessComponents.reduce((sum, item) => sum + item.score, 0)
  const readinessLevel = readinessScore >= 80 ? 'READY' : readinessScore >= 60 ? 'ON_TRACK' : 'NEEDS_FOCUS'
  const readinessActions: any[] = []
  if (!proposalApproved) {
    readinessActions.push({
      title: proposal ? 'Get your proposal approved' : 'Create and submit your proposal',
      detail: proposal ? 'Resolve supervisor feedback and submit the next version.' : 'Define your scope, objectives, and methodology.',
      link: '/student/proposal',
      priority: 'high',
    })
  }
  if (overdueMilestones.length) {
    readinessActions.push({
      title: `Recover ${overdueMilestones.length} overdue milestone${overdueMilestones.length === 1 ? '' : 's'}`,
      detail: overdueMilestones.slice(0, 2).map((m: any) => m.title).join(' · '),
      link: '/student/milestones',
      priority: 'high',
    })
  }
  if (pendingReviews) {
    readinessActions.push({
      title: `Follow up on ${pendingReviews} pending review${pendingReviews === 1 ? '' : 's'}`,
      detail: 'Check whether your supervisor needs anything else to complete the review.',
      link: '/student/submissions',
      priority: 'medium',
    })
  }
  if (revisionFeedback) {
    readinessActions.push({
      title: `Address ${revisionFeedback} revision request${revisionFeedback === 1 ? '' : 's'}`,
      detail: 'Respond to supervisor feedback before the next submission.',
      link: '/student/feedback',
      priority: 'high',
    })
  }
  if (!readinessActions.length) {
    readinessActions.push({
      title: evaluation ? 'Prepare for your defense' : 'Keep your momentum',
      detail: evaluation ? 'Review your released evaluation and rehearse your defense.' : 'Stay on schedule and keep evidence of progress up to date.',
      link: evaluation ? '/student/evaluations' : '/student/milestones',
      priority: 'medium',
    })
  }

  const started = project.startedAt || project.createdAt
  const progressTrend: { month: string; progress: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
    const eligible = milestones.filter((m: any) => m.dueDate && new Date(m.dueDate) <= d)
    const avg = eligible.length
      ? Math.round(eligible.reduce((sum: number, m: any) => sum + (m.completionPercentage || 0), 0) / milestones.length)
      : 0
    progressTrend.push({ month: d.toLocaleString('en', { month: 'short' }), progress: Math.min(avg, 100) })
  }
  progressTrend[progressTrend.length - 1].progress = progress

  const audit: any[] = await AuditLog.find({ projectId: project._id }).sort({ createdAt: -1 }).limit(8).populate('userId', 'firstName lastName role').lean()
  const timeline = audit.map((a: any) => ({
    id: String(a._id),
    title: a.action,
    detail: a.details?.title || a.entityType,
    date: a.createdAt,
    actor: a.userId ? displayName(a.userId.role, a.userId) : 'System',
  }))

  return {
    student,
    project,
    department,
    session,
    members,
    team,
    supervisor,
    progress,
    stage,
    milestones: milestoneItems,
    submissions: submissionItems,
    feedback: feedbackItems,
    proposal,
    defense,
    evaluations,
    evaluationReleased: !!evaluation,
    health: {
      score: healthResult.score,
      level: healthResult.level,
      lastChecked: healthResult.checkedAt,
      reasons: healthResult.reasons,
      affected: healthResult.affected,
      recommendations: healthResult.recommendations,
      factors: healthResult.factors,
    },
    progressTrend,
    readiness: {
      score: readinessScore,
      level: readinessLevel,
      components: readinessComponents,
      actions: readinessActions.slice(0, 4),
      checkedAt: new Date(),
    },
    stats: {
      stage,
      progress,
      completedMilestones: milestones.filter((m: any) => m.status === 'COMPLETED').length,
      totalMilestones: milestones.length,
      pendingReviews,
      upcomingDeadlines: upcoming.length,
    },
    projectView: {
      id: String(project._id),
      title: project.title,
      status: project.status,
      supervisor,
      department: department?.name || '—',
      session: session?.name || '—',
      progress,
      abstract: proposal?.abstract || project.abstract || '',
      started,
      defenseDate: defense?.scheduledDate || null,
      teamSize: team.length,
      stage,
    },
    timeline,
  }
}

export const getOverview = asyncHandler(async (req: AuthRequest, res: Response) => {
  const bundle = await buildStudentBundle(req.user!.id)
  if (!bundle) return res.status(404).json({ success: false, message: 'No project found for this student' })
  const { student, project, department, session, members, ...rest } = bundle as any
  res.json({ success: true, ...rest })
})

export const getProject = asyncHandler(async (req: AuthRequest, res: Response) => {
  const bundle = await buildStudentBundle(req.user!.id)
  if (!bundle) return res.status(404).json({ success: false, message: 'No project found' })
  res.json({
    success: true,
    project: bundle.projectView,
    team: bundle.team,
    milestones: bundle.milestones,
    health: bundle.health,
    timeline: bundle.timeline,
    stats: bundle.stats,
  })
})

export const getProposal = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ctx = await getStudentContext(req.user!.id)
  if (!ctx || !ctx.project) return res.status(404).json({ success: false, message: 'No project found' })

  const proposal: any = await Proposal.findOne({ projectId: ctx.project._id }).lean()
  const versions: any[] = proposal ? await ProposalVersion.find({ proposalId: proposal._id }).sort({ versionNumber: -1 }).lean() : []
  const info = await supervisorNameForProject(String(ctx.project._id))

  res.json({
    success: true,
    proposal: proposal
      ? {
          id: String(proposal._id),
          title: proposal.title,
          abstract: proposal.abstract,
          problemStatement: proposal.problemStatement,
          objectives: proposal.objectives,
          methodology: proposal.methodology,
          technologyStack: proposal.technologyStack,
          expectedOutcomes: proposal.expectedOutcomes,
          status: proposal.status,
          version: proposal.version,
          submittedAt: proposal.submittedAt,
          reviewedAt: proposal.reviewedAt,
          reviewComments: proposal.reviewComments,
          supervisor: info?.name || 'Unassigned',
        }
      : null,
    versions: versions.map((v: any) => ({
      id: String(v._id),
      version: `v${v.versionNumber}`,
      date: v.submittedAt,
      note: v.versionNumber === (proposal?.version || 1) ? statusLabel(proposal?.status || '') : 'Previous submission',
    })),
  })
})

export const saveProposal = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ctx = await getStudentContext(req.user!.id)
  if (!ctx || !ctx.project) return res.status(404).json({ success: false, message: 'No project found' })

  const fields = ['title', 'abstract', 'problemStatement', 'objectives', 'methodology', 'technologyStack', 'expectedOutcomes']
  const data: any = {}
  fields.forEach((f) => {
    if (req.body[f] !== undefined) data[f] = req.body[f]
  })
  const submit = !!req.body.submit
  const status = submit ? 'PROPOSAL_SUBMITTED' : 'PROPOSAL_DRAFT'
  Object.assign(data, {
    status,
    ...(submit && { submittedAt: new Date() }),
  })

  let proposal: any = await Proposal.findOne({ projectId: ctx.project._id })
  let newVersion = 1
  if (proposal) {
    if (submit) newVersion = (proposal.version || 1) + 1
    Object.assign(proposal, data)
    if (submit) proposal.version = newVersion
    await proposal.save()
  } else {
    proposal = await Proposal.create({ projectId: ctx.project._id, ...data, version: 1 })
  }

  if (submit) {
    await ProposalVersion.create({
      proposalId: proposal._id,
      versionNumber: proposal.version,
      title: proposal.title,
      abstract: proposal.abstract,
      problemStatement: proposal.problemStatement,
      objectives: proposal.objectives,
      methodology: proposal.methodology,
      technologyStack: proposal.technologyStack,
      expectedOutcomes: proposal.expectedOutcomes,
    })
    await Project.findByIdAndUpdate(ctx.project._id, { status: 'PROPOSAL_SUBMITTED' })
    await writeAudit({ userId: req.user!.id, projectId: String(ctx.project._id), action: 'Submitted project proposal', entityType: 'Proposal', entityId: String(proposal._id) })

    const assignment: any = await SupervisorAssignment.findOne({ projectId: ctx.project._id }).lean()
    if (assignment) {
      const sup: any = await SupervisorProfile.findById(assignment.supervisorId).lean()
      if (sup) {
        await Notification.create({
          userId: sup.userId,
          title: 'Proposal submitted',
          message: `${req.user!.firstName} ${req.user!.lastName} submitted a project proposal for review.`,
          type: 'proposal',
          link: '/supervisor/proposal-reviews',
        })
        emitToUser(sup.userId, 'notification:new', { title: 'Proposal submitted', type: 'proposal' })
      }
    }
    broadcastActivity({
      type: 'proposal',
      message: `${req.user!.firstName} ${req.user!.lastName} submitted a proposal for supervisor review`,
      meta: { projectId: String(ctx.project._id) },
    })
  } else {
    broadcastActivity({
      type: 'proposal',
      message: `${req.user!.firstName} ${req.user!.lastName} updated their proposal draft`,
      meta: { projectId: String(ctx.project._id) },
    })
  }

  res.json({ success: true, message: submit ? 'Proposal submitted for review' : 'Draft saved', status: proposal.status, version: proposal.version })
})

export const getTeam = asyncHandler(async (req: AuthRequest, res: Response) => {
  const bundle = await buildStudentBundle(req.user!.id)
  if (!bundle) return res.status(404).json({ success: false, message: 'No project found' })
  res.json({ success: true, team: bundle.team, maxSize: 4 })
})

export const inviteMember = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { email } = req.body
  const ctx = await getStudentContext(req.user!.id)
  if (!ctx || !ctx.project) return res.status(404).json({ success: false, message: 'No project found' })

  const count = await ProjectMember.countDocuments({ projectId: ctx.project._id })
  if (count >= 4) return res.status(400).json({ success: false, message: 'Team is already at the maximum of 4 members' })

  const user: any = await User.findOne({ email: String(email || '').toLowerCase(), role: 'STUDENT' })
  if (!user) return res.status(404).json({ success: false, message: 'No eligible student found with that email' })

  const profile: any = await StudentProfile.findOne({ userId: user._id })
  if (!profile) return res.status(404).json({ success: false, message: 'Student profile not found' })

  const exists = await ProjectMember.findOne({ projectId: ctx.project._id, studentId: profile._id })
  if (exists) return res.status(400).json({ success: false, message: 'Student is already on this team' })

  await ProjectMember.create({ projectId: ctx.project._id, studentId: profile._id, role: 'MEMBER' })
  await Notification.create({ userId: user._id, title: 'Team invitation', message: `You were added to the project "${ctx.project.title}".`, type: 'team', link: '/student/project' })
  await writeAudit({ userId: req.user!.id, projectId: String(ctx.project._id), action: 'Added team member', entityType: 'ProjectMember', details: { email } })

  res.json({ success: true, message: 'Team member added' })
})

export const removeMember = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ctx = await getStudentContext(req.user!.id)
  if (!ctx || !ctx.project) return res.status(404).json({ success: false, message: 'No project found' })

  const member: any = await ProjectMember.findOne({ _id: req.params.id, projectId: ctx.project._id })
  if (!member) return res.status(404).json({ success: false, message: 'Member not found' })
  if (member.studentId.toString() === ctx.student._id.toString()) {
    return res.status(400).json({ success: false, message: 'You cannot remove yourself from the team' })
  }
  await ProjectMember.deleteOne({ _id: member._id })
  await writeAudit({ userId: req.user!.id, projectId: String(ctx.project._id), action: 'Removed team member', entityType: 'ProjectMember', entityId: String(member._id) })
  res.json({ success: true, message: 'Member removed' })
})

export const getMilestones = asyncHandler(async (req: AuthRequest, res: Response) => {
  const bundle = await buildStudentBundle(req.user!.id)
  if (!bundle) return res.status(404).json({ success: false, message: 'No project found' })
  res.json({ success: true, milestones: bundle.milestones, stats: bundle.stats })
})

export const updateMilestone = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ctx = await getStudentContext(req.user!.id)
  if (!ctx || !ctx.project) return res.status(404).json({ success: false, message: 'No project found' })

  const milestone: any = await Milestone.findOne({ _id: req.params.id, projectId: ctx.project._id })
  if (!milestone) return res.status(404).json({ success: false, message: 'Milestone not found' })

  const { status, completionPercentage } = req.body
  if (status) milestone.status = status
  if (completionPercentage !== undefined) milestone.completionPercentage = Math.max(0, Math.min(100, Number(completionPercentage)))
  if (milestone.status === 'COMPLETED' && completionPercentage === undefined) milestone.completionPercentage = 100
  await milestone.save()

  const progress = await projectProgress(String(ctx.project._id))
  await Project.findByIdAndUpdate(ctx.project._id, { currentStage: stageFor(await Milestone.find({ projectId: ctx.project._id }).lean()) })
  await calculateProjectHealth(String(ctx.project._id))
  await writeAudit({ userId: req.user!.id, projectId: String(ctx.project._id), action: `Updated milestone "${milestone.title}"`, entityType: 'Milestone', entityId: String(milestone._id), details: { status: milestone.status } })

  res.json({ success: true, milestone: { id: String(milestone._id), status: milestone.status, progress: milestone.completionPercentage }, projectProgress: progress })
})

export const getSubmissions = asyncHandler(async (req: AuthRequest, res: Response) => {
  const bundle = await buildStudentBundle(req.user!.id)
  if (!bundle) return res.status(404).json({ success: false, message: 'No project found' })
  res.json({ success: true, submissions: bundle.submissions })
})

export const createSubmission = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ctx = await getStudentContext(req.user!.id)
  if (!ctx || !ctx.project) return res.status(404).json({ success: false, message: 'No project found' })

  const { title, type, description, milestoneId } = req.body
  if (!title) return res.status(400).json({ success: false, message: 'A submission title is required' })

  const previous = await Submission.countDocuments({ projectId: ctx.project._id, title })
  const submission: any = await Submission.create({
    projectId: ctx.project._id,
    studentId: ctx.student._id,
    milestoneId: milestoneId || null,
    title,
    type: type || 'Report',
    description: description || '',
    status: 'UNDER_REVIEW',
    version: previous + 1,
  })

  await writeAudit({ userId: req.user!.id, projectId: String(ctx.project._id), action: `Submitted "${title}"`, entityType: 'Submission', entityId: String(submission._id) })
  const assignment: any = await SupervisorAssignment.findOne({ projectId: ctx.project._id }).lean()
  if (assignment) {
    const sup: any = await SupervisorProfile.findById(assignment.supervisorId).lean()
    if (sup) {
      await Notification.create({ userId: sup.userId, title: 'New submission', message: `${req.user!.firstName} ${req.user!.lastName} submitted "${title}" for review.`, type: 'submission', link: '/supervisor/submission-reviews' })
    }
  }
  await calculateProjectHealth(String(ctx.project._id))
  res.status(201).json({ success: true, message: 'Submission sent for review', submission: { id: String(submission._id), title, status: submission.status, version: submission.version } })
})

export const deleteSubmission = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ctx = await getStudentContext(req.user!.id)
  if (!ctx || !ctx.project) return res.status(404).json({ success: false, message: 'No project found' })
  const sub: any = await Submission.findOne({ _id: req.params.id, projectId: ctx.project._id })
  if (!sub) return res.status(404).json({ success: false, message: 'Submission not found' })
  if (sub.status !== 'PENDING') return res.status(400).json({ success: false, message: 'Only pending submissions can be withdrawn' })
  await Submission.deleteOne({ _id: sub._id })
  res.json({ success: true, message: 'Submission withdrawn' })
})

export const getFeedback = asyncHandler(async (req: AuthRequest, res: Response) => {
  const bundle = await buildStudentBundle(req.user!.id)
  if (!bundle) return res.status(404).json({ success: false, message: 'No project found' })
  res.json({ success: true, feedback: bundle.feedback })
})

export const replyToFeedback = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ctx = await getStudentContext(req.user!.id)
  if (!ctx || !ctx.project) return res.status(404).json({ success: false, message: 'No project found' })
  const { content } = req.body
  if (!content) return res.status(400).json({ success: false, message: 'Reply cannot be empty' })

  await Comment.create({ projectId: ctx.project._id, authorId: req.user!.id, content })
  const assignment: any = await SupervisorAssignment.findOne({ projectId: ctx.project._id }).lean()
  if (assignment) {
    const sup: any = await SupervisorProfile.findById(assignment.supervisorId).lean()
    if (sup) {
      await Notification.create({ userId: sup.userId, title: 'Student reply', message: `${req.user!.firstName} replied to your feedback.`, type: 'comment', link: '/supervisor/projects' })
    }
  }
  res.status(201).json({ success: true, message: 'Reply sent' })
})

export const getEvaluations = asyncHandler(async (req: AuthRequest, res: Response) => {
  const bundle = await buildStudentBundle(req.user!.id)
  if (!bundle) return res.status(404).json({ success: false, message: 'No project found' })
  res.json({
    success: true,
    evaluations: bundle.evaluations,
    released: bundle.evaluationReleased,
    defense: bundle.defense
      ? {
          date: bundle.defense.scheduledDate,
          venue: bundle.defense.venue,
          duration: bundle.defense.duration,
          panel: bundle.defense.evaluators || [],
          status: bundle.defense.status,
        }
      : null,
  })
})
