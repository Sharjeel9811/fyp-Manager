import { Response } from 'express'
import * as argon2 from 'argon2'
import {
  AcademicSession, AuditLog, Deadline, Department, DefenseSchedule, Evaluation,
  EvaluationRubric, Feedback, MailOutbox, Milestone, Notification, Project, ProjectMember,
  Proposal, ProposalVersion, RubricCriterion, Setting, StudentProfile, Submission, SupervisorAssignment,
  SupervisorProfile, User,
} from '../models'
import { AuthRequest } from '../middleware/auth'
import {
  asyncHandler, displayName, fullName, projectProgress, stageFor, statusLabel, writeAudit,
} from '../utils/helpers'
import { broadcastActivity, emitToUser } from '../services/realtime'
import { compareProposals, projectTeamNames } from '../services/similarity'

const STATUS_META: Record<string, { label: string; color: string }> = {
  IN_PROGRESS: { label: 'In Progress', color: '#4f46e5' },
  PROPOSAL_APPROVED: { label: 'Approved', color: '#0ea5e9' },
  PROPOSAL_SUBMITTED: { label: 'Under Review', color: '#f59e0b' },
  PROPOSAL_UNDER_REVIEW: { label: 'Under Review', color: '#f59e0b' },
  PROPOSAL_REVISION_REQUIRED: { label: 'Revision', color: '#f97316' },
  PROPOSAL_REJECTED: { label: 'Rejected', color: '#ef4444' },
  PROPOSAL_DRAFT: { label: 'Draft', color: '#94a3b8' },
  COMPLETED: { label: 'Completed', color: '#10b981' },
  SUSPENDED: { label: 'Suspended', color: '#64748b' },
}

async function buildAdminProjects() {
  const projects: any[] = await Project.find().sort({ updatedAt: -1 }).lean()
  const departments: any[] = await Department.find().lean()
  const deptById = new Map(departments.map((d: any) => [String(d._id), d]))
  const assignments: any[] = await SupervisorAssignment.find().lean()
  const assignmentByProject = new Map(assignments.map((a: any) => [String(a.projectId), a]))
  const supervisors: any[] = await SupervisorProfile.find().lean()
  const supervisorById = new Map(supervisors.map((s: any) => [String(s._id), s]))
  const supervisorUsers: any[] = await User.find({ _id: { $in: supervisors.map((s: any) => s.userId) } }).lean()
  const supervisorUserById = new Map(supervisorUsers.map((u: any) => [String(u._id), u]))

  const rows = []
  for (const p of projects) {
    const assignment: any = assignmentByProject.get(String(p._id))
    const sup: any = assignment ? supervisorById.get(String(assignment.supervisorId)) : null
    const supUser: any = sup ? supervisorUserById.get(String(sup.userId)) : null
    const team = await ProjectMember.countDocuments({ projectId: p._id })
    const progress = await projectProgress(String(p._id))
    rows.push({
      id: String(p._id),
      title: p.title,
      dept: deptById.get(String(p.departmentId))?.name || '—',
      departmentId: String(p.departmentId || ''),
      supervisor: supUser ? displayName('SUPERVISOR', supUser) : 'Unassigned',
      supervisorId: sup ? String(sup._id) : null,
      status: p.status,
      health: p.riskLevel || 'LOW',
      riskScore: p.riskScore || 0,
      team,
      progress,
      createdAt: p.createdAt,
    })
  }
  return rows
}

export const getOverview = asyncHandler(async (req: AuthRequest, res: Response) => {
  const [totalStudents, totalSupervisors, pendingProposals, overdueMilestones, atRisk, projects] = await Promise.all([
    StudentProfile.countDocuments(),
    SupervisorProfile.countDocuments(),
    Proposal.countDocuments({ status: { $in: ['PROPOSAL_SUBMITTED', 'PROPOSAL_UNDER_REVIEW'] } }),
    Milestone.countDocuments({ dueDate: { $lt: new Date() }, status: { $ne: 'COMPLETED' } }),
    Project.countDocuments({ riskLevel: { $in: ['MEDIUM', 'HIGH'] } }),
    buildAdminProjects(),
  ])

  const statusCounts: Record<string, number> = {}
  projects.forEach((p) => {
    const meta = STATUS_META[p.status] || { label: p.status, color: '#94a3b8' }
    statusCounts[meta.label] = (statusCounts[meta.label] || 0) + 1
  })
  const projectsByStatus = Object.entries(statusCounts).map(([label, count]) => {
    const meta = Object.values(STATUS_META).find((m) => m.label === label)
    return { status: label, count, color: meta?.color || '#94a3b8' }
  })

  const departments: any[] = await Department.find().lean()
  const departmentPerformance = departments.map((d: any) => {
    const deptProjects = projects.filter((p) => p.departmentId === String(d._id))
    return {
      dept: d.name,
      projects: deptProjects.length,
      onTrack: deptProjects.filter((p) => p.health === 'LOW').length,
      atRisk: deptProjects.filter((p) => p.health !== 'LOW').length,
    }
  })

  const supervisors: any[] = await SupervisorProfile.find().lean()
  const workload = []
  for (const s of supervisors) {
    const u: any = await User.findById(s.userId).lean()
    const count = await SupervisorAssignment.countDocuments({ supervisorId: s._id })
    workload.push({ name: u ? `Dr. ${u.lastName}` : 'Supervisor', projects: count, capacity: s.maxSupervisees || 5 })
  }

  const logs: any[] = await AuditLog.find().sort({ createdAt: -1 }).limit(6).populate('userId', 'firstName lastName role').lean()
  const auditLogs = logs.map(mapAudit)

  res.json({
    success: true,
    stats: {
      totalProjects: projects.length,
      totalStudents,
      totalSupervisors,
      pendingProposals,
      overdueMilestones,
      atRisk,
      onTrackRate: projects.length ? Math.round((projects.filter((p) => p.health === 'LOW').length / projects.length) * 100) : 0,
    },
    projectsByStatus,
    departmentPerformance,
    projects: projects.slice(0, 8),
    auditLogs,
    workload,
    departments: departments.map((d: any) => ({ id: String(d._id), name: d.name, code: d.code })),
  })
})

function mapAudit(a: any) {
  return {
    id: String(a._id),
    actor: a.userId ? displayName(a.userId.role, a.userId) : 'System',
    action: a.action,
    target: a.details?.title || a.entityType,
    time: a.createdAt,
    entityType: a.entityType,
    details: a.details || null,
  }
}

export const getUsers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const users: any[] = await User.find().sort({ createdAt: -1 }).lean()
  const students: any[] = await StudentProfile.find().lean()
  const supervisors: any[] = await SupervisorProfile.find().lean()
  const departments: any[] = await Department.find().lean()
  const deptById = new Map(departments.map((d: any) => [String(d._id), d]))
  const studentByUser = new Map(students.map((s: any) => [String(s.userId), s]))
  const supervisorByUser = new Map(supervisors.map((s: any) => [String(s.userId), s]))

  const rows = users.map((u: any) => {
    const sp: any = studentByUser.get(String(u._id))
    const vp: any = supervisorByUser.get(String(u._id))
    const profile = sp || vp
    return {
      id: String(u._id),
      name: fullName(u),
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      role: u.role,
      department: profile?.departmentId ? deptById.get(String(profile.departmentId))?.name || '—' : u.role === 'ADMIN' ? 'FYP Office' : '—',
      departmentId: profile?.departmentId ? String(profile.departmentId) : null,
      studentId: sp?.studentId || null,
      employeeId: vp?.employeeId || null,
      status: u.isActive ? 'ACTIVE' : 'INACTIVE',
      joined: u.createdAt,
    }
  })

  res.json({ success: true, users: rows })
})

export const createUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { email, password, firstName, lastName, role, departmentId, studentId, employeeId } = req.body
  if (!email || !firstName || !lastName || !role) {
    return res.status(400).json({ success: false, message: 'Missing required fields' })
  }
  const exists = await User.findOne({ email: String(email).toLowerCase() })
  if (exists) return res.status(400).json({ success: false, message: 'Email already registered' })
  if (password) {
    const { passwordProblem } = await import('../utils/helpers')
    const complexity = passwordProblem(password)
    if (complexity) return res.status(400).json({ success: false, message: complexity })
  }

  const user: any = await User.create({
    email: String(email).toLowerCase(),
    passwordHash: await argon2.hash(password || 'password123'),
    firstName,
    lastName,
    role,
    emailVerified: true,
  })

  if (role === 'STUDENT') {
    await StudentProfile.create({ userId: user._id, studentId: studentId || `STU-${Math.floor(10000 + Math.random() * 89999)}`, departmentId })
  } else if (role === 'SUPERVISOR') {
    await SupervisorProfile.create({ userId: user._id, employeeId: employeeId || `SUP-${Math.floor(1000 + Math.random() * 8999)}`, departmentId })
  }

  await writeAudit({ userId: req.user!.id, action: `Created ${role.toLowerCase()} account`, entityType: 'User', entityId: String(user._id), details: { title: fullName(user) } })
  res.status(201).json({ success: true, message: 'User created', user: { id: String(user._id) } })
})

export const updateUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const updates: any = {}
  ;['firstName', 'lastName', 'email', 'role', 'isActive'].forEach((k) => {
    if (req.body[k] !== undefined) updates[k] = req.body[k]
  })
  const user: any = await User.findByIdAndUpdate(req.params.id, updates, { new: true })
  if (!user) return res.status(404).json({ success: false, message: 'User not found' })
  if (req.body.departmentId) {
    await StudentProfile.updateMany({ userId: user._id }, { departmentId: req.body.departmentId })
    await SupervisorProfile.updateMany({ userId: user._id }, { departmentId: req.body.departmentId })
  }
  await writeAudit({ userId: req.user!.id, action: 'Updated user account', entityType: 'User', entityId: String(user._id), details: { title: fullName(user) } })
  res.json({ success: true, message: 'User updated' })
})

export const getUserMail = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const rows: any[] = await MailOutbox.find().sort({ createdAt: -1 }).limit(100).lean()
  res.json({
    success: true,
    mail: rows.map((m) => ({
      id: String(m._id),
      to: m.to,
      subject: m.subject,
      body: m.body,
      links: m.links || [],
      queuedAt: m.createdAt,
      consumed: !!m.consumedAt,
    })),
  })
})

/** Mark mail as handed over (the office relayed it to the recipient). */
export const consumeUserMail = asyncHandler(async (req: AuthRequest, res: Response) => {
  const mail: any = await MailOutbox.findByIdAndUpdate(req.params.id, { consumedAt: new Date() }, { new: true })
  if (!mail) return res.status(404).json({ success: false, message: 'Mail not found' })
  res.json({ success: true, message: 'Marked as delivered' })
})

export const deleteUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user: any = await User.findById(req.params.id)
  if (!user) return res.status(404).json({ success: false, message: 'User not found' })

  // ?purge=true removes the account and its profile rows entirely — which
  // frees the email and ID for re-registration — but is refused when the
  // user has any project history; those accounts can only be deactivated.
  if (String(req.query.purge || '') === 'true') {
    // Membership/assignment references point at profile documents, not the
    // user, so resolve the profiles before counting history.
    const studentProfile = await StudentProfile.findOne({ userId: user._id })
    const supervisorProfile = await SupervisorProfile.findOne({ userId: user._id })
    const memberships = studentProfile ? await ProjectMember.countDocuments({ studentId: studentProfile._id }) : 0
    const assignments = supervisorProfile ? await SupervisorAssignment.countDocuments({ supervisorId: supervisorProfile._id }) : 0
    if (memberships + assignments > 0) {
      return res.status(409).json({
        success: false,
        message: 'This user has project history — deactivate instead of purging',
      })
    }
    await StudentProfile.deleteMany({ userId: user._id })
    await SupervisorProfile.deleteMany({ userId: user._id })
    await User.deleteOne({ _id: user._id })
    await writeAudit({ userId: req.user!.id, action: 'Purged user account', entityType: 'User', entityId: String(user._id), details: { title: fullName(user) } })
    return res.json({ success: true, message: 'User permanently removed' })
  }

  await User.findByIdAndUpdate(user._id, { isActive: false }, { new: true })
  await writeAudit({ userId: req.user!.id, action: 'Deactivated user account', entityType: 'User', entityId: String(user._id), details: { title: fullName(user) } })
  res.json({ success: true, message: 'User deactivated' })
})

export const getDepartments = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const departments: any[] = await Department.find().lean()
  const rows = []
  for (const d of departments) {
    rows.push({
      id: String(d._id),
      name: d.name,
      code: d.code,
      students: await StudentProfile.countDocuments({ departmentId: d._id }),
      supervisors: await SupervisorProfile.countDocuments({ departmentId: d._id }),
      projects: await Project.countDocuments({ departmentId: d._id }),
    })
  }
  res.json({ success: true, departments: rows })
})

export const createDepartment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, code } = req.body
  if (!name || !code) return res.status(400).json({ success: false, message: 'Name and code are required' })
  const dept = await Department.create({ name, code: String(code).toUpperCase() })
  await writeAudit({ userId: req.user!.id, action: 'Created department', entityType: 'Department', entityId: String((dept as any)._id), details: { title: name } })
  res.status(201).json({ success: true, message: 'Department created', id: String((dept as any)._id) })
})

export const getSessions = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const sessions: any[] = await AcademicSession.find().sort({ startDate: -1 }).lean()
  const rows = []
  for (const s of sessions) {
    rows.push({
      id: String(s._id),
      name: s.name,
      start: s.startDate,
      end: s.endDate,
      active: !!s.isActive,
      projects: await Project.countDocuments({ academicSessionId: s._id }),
    })
  }
  res.json({ success: true, sessions: rows })
})

export const createSession = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, startDate, endDate, isActive } = req.body
  if (!name) return res.status(400).json({ success: false, message: 'Session name is required' })
  if (isActive) await AcademicSession.updateMany({}, { isActive: false })
  const session = await AcademicSession.create({ name, startDate, endDate, isActive: !!isActive })
  await writeAudit({ userId: req.user!.id, action: 'Created academic session', entityType: 'AcademicSession', entityId: String((session as any)._id), details: { title: name } })
  res.status(201).json({ success: true, message: 'Session created', id: String((session as any)._id) })
})

export const activateSession = asyncHandler(async (req: AuthRequest, res: Response) => {
  await AcademicSession.updateMany({}, { isActive: false })
  const session: any = await AcademicSession.findByIdAndUpdate(req.params.id, { isActive: true }, { new: true })
  if (!session) return res.status(404).json({ success: false, message: 'Session not found' })
  await writeAudit({ userId: req.user!.id, action: 'Activated academic session', entityType: 'AcademicSession', entityId: String(session._id), details: { title: session.name } })
  res.json({ success: true, message: 'Session activated' })
})

export const getProjects = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const projects = await buildAdminProjects()
  res.json({ success: true, projects })
})

export const getProposals = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const proposals: any[] = await Proposal.find().sort({ submittedAt: -1, createdAt: -1 }).lean()
  const projects: any[] = await Project.find().lean()
  const projectById = new Map(projects.map((p: any) => [String(p._id), p]))
  const rows = []

  for (const p of proposals) {
    const project: any = projectById.get(String(p.projectId))
    const members: any[] = await ProjectMember.find({ projectId: p.projectId }).lean()
    const lead = members.find((m: any) => m.role === 'LEAD') || members[0]
    let student = 'Student'
    if (lead) {
      const profile: any = await StudentProfile.findById(lead.studentId).lean()
      if (profile) {
        const u: any = await User.findById(profile.userId).lean()
        if (u) student = fullName(u)
      }
    }
    rows.push({
      id: String(p._id),
      projectId: String(p.projectId),
      title: p.title || project?.title || 'Proposal',
      project: project?.title || '',
      student,
      status: p.status,
      submitted: p.submittedAt || p.createdAt,
      comments: p.reviewComments || '',
    })
  }
  res.json({ success: true, proposals: rows })
})

export const decideProposal = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { status, comments } = req.body
  const allowed = ['PROPOSAL_APPROVED', 'PROPOSAL_REVISION_REQUIRED', 'PROPOSAL_REJECTED', 'PROPOSAL_UNDER_REVIEW']
  if (!allowed.includes(status)) return res.status(400).json({ success: false, message: 'Invalid decision' })

  const proposal: any = await Proposal.findById(req.params.id)
  if (!proposal) return res.status(404).json({ success: false, message: 'Proposal not found' })

  proposal.status = status
  proposal.reviewComments = comments || proposal.reviewComments
  proposal.reviewedAt = new Date()
  proposal.reviewedBy = req.user!.id
  await proposal.save()
  await Project.findByIdAndUpdate(proposal.projectId, { status })

  if (comments) {
    await Feedback.create({ projectId: proposal.projectId, authorId: req.user!.id, content: comments, isRevisionRequest: status === 'PROPOSAL_REVISION_REQUIRED' })
  }
  const members: any[] = await ProjectMember.find({ projectId: proposal.projectId }).lean()
  for (const m of members) {
    const profile: any = await StudentProfile.findById(m.studentId).lean()
    if (profile) await Notification.create({ userId: profile.userId, title: 'Proposal decision', message: `Your proposal was marked "${statusLabel(status)}".`, type: 'proposal', link: '/student/proposal' })
  }
  await writeAudit({ userId: req.user!.id, projectId: String(proposal.projectId), action: `Proposal ${statusLabel(status)}`, entityType: 'Proposal', entityId: String(proposal._id) })
  res.json({ success: true, message: `Proposal ${statusLabel(status).toLowerCase()}` })
})

const MATCH_STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'using', 'based', 'system', 'project', 'final', 'year',
  'university', 'a', 'an', 'of', 'to', 'in', 'on', 'by', 'from', 'smart', 'real', 'time',
  'research', 'interests', 'development', 'application', 'platform', 'student', 'students',
])

function keywordSet(...values: (string | null | undefined)[]) {
  return new Set(
    values
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .split(/[^a-z0-9+#]+/)
      .filter((word) => word.length >= 3 && !MATCH_STOP_WORDS.has(word))
  )
}

export const getAssignmentRecommendations = asyncHandler(async (req: AuthRequest, res: Response) => {
  const projectId = String(req.query.projectId || '')
  if (!projectId) return res.status(400).json({ success: false, message: 'Project is required' })

  const [project, proposal] = await Promise.all([
    Project.findById(projectId).lean(),
    Proposal.findOne({ projectId }).lean(),
  ])
  if (!project) return res.status(404).json({ success: false, message: 'Project not found' })

  const projectKeywords = keywordSet(
    (project as any).title,
    (project as any).abstract,
    proposal?.title,
    proposal?.abstract,
    proposal?.objectives,
    proposal?.methodology,
    proposal?.technologyStack
  )

  const [supervisors, assignments, departments] = await Promise.all([
    SupervisorProfile.find().lean(),
    SupervisorAssignment.find().lean(),
    Department.find().lean(),
  ])
  const users: any[] = await User.find({ _id: { $in: supervisors.map((s: any) => s.userId) } }).lean()
  const userById = new Map(users.map((u: any) => [String(u._id), u]))
  const deptById = new Map(departments.map((d: any) => [String(d._id), d]))
  const loadById = new Map<string, number>()
  assignments.forEach((a: any) => loadById.set(String(a.supervisorId), (loadById.get(String(a.supervisorId)) || 0) + 1))

  const recommendations = supervisors
    .map((s: any) => {
      const user: any = userById.get(String(s.userId))
      const load = loadById.get(String(s._id)) || 0
      const capacity = s.maxSupervisees || 5
      const available = s.availability !== false && load < capacity
      const interests = keywordSet(s.researchInterests)
      const matchedKeywords = [...projectKeywords].filter((word) => interests.has(word))
      const sameDepartment = String(s.departmentId || '') === String((project as any).departmentId || '')
      const workloadScore = Math.round(45 * (1 - Math.min(load / Math.max(capacity, 1), 1)))
      const availabilityScore = available ? 15 : 0
      const researchScore = matchedKeywords.length ? Math.min(25, 10 + matchedKeywords.length * 5) : 0
      const departmentScore = sameDepartment ? 15 : 0
      const score = Math.min(100, workloadScore + availabilityScore + researchScore + departmentScore)
      const reasons: string[] = []
      if (matchedKeywords.length) reasons.push(`Research match: ${matchedKeywords.slice(0, 4).join(', ')}`)
      if (sameDepartment) reasons.push('Same department')
      if (load < capacity) reasons.push(`${capacity - load} supervision slot${capacity - load === 1 ? '' : 's'} free`)
      else reasons.push('At full supervision capacity')
      if (s.availability === false) reasons.push('Currently marked unavailable')

      return {
        id: String(s._id),
        name: user ? displayName('SUPERVISOR', user) : 'Supervisor',
        email: user?.email || '',
        department: deptById.get(String(s.departmentId))?.name || '—',
        capacity,
        load,
        available,
        sameDepartment,
        matchedKeywords: matchedKeywords.slice(0, 6),
        score,
        reasons,
      }
    })
    .sort((a, b) => b.score - a.score)

  res.json({
    success: true,
    project: { id: String((project as any)._id), title: (project as any).title },
    keywords: [...projectKeywords].slice(0, 10),
    recommendations,
  })
})

export const getAssignments = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const projects = await buildAdminProjects()
  const supervisors: any[] = await SupervisorProfile.find().lean()
  const users: any[] = await User.find({ _id: { $in: supervisors.map((s: any) => s.userId) } }).lean()
  const userById = new Map(users.map((u: any) => [String(u._id), u]))
  const supervisorOptions = supervisors.map((s: any) => {
    const u: any = userById.get(String(s.userId))
    return { id: String(s._id), name: u ? displayName('SUPERVISOR', u) : 'Supervisor', capacity: s.maxSupervisees || 5 }
  })
  res.json({ success: true, assignments: projects, supervisors: supervisorOptions })
})

export const assignSupervisor = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { projectId, supervisorId } = req.body
  if (!projectId || !supervisorId) return res.status(400).json({ success: false, message: 'Project and supervisor are required' })

  const project: any = await Project.findById(projectId)
  if (!project) return res.status(404).json({ success: false, message: 'Project not found' })
  const supervisor: any = await SupervisorProfile.findById(supervisorId)
  if (!supervisor) return res.status(404).json({ success: false, message: 'Supervisor not found' })

  await SupervisorAssignment.findOneAndUpdate(
    { projectId },
    { projectId, supervisorId, assignedAt: new Date(), assignedBy: req.user!.id },
    { upsert: true, new: true }
  )
  if (project.status === 'PROPOSAL_APPROVED') {
    await Project.findByIdAndUpdate(projectId, { status: 'IN_PROGRESS' })
  }
  await Notification.create({ userId: supervisor.userId, title: 'Project assigned', message: `You were assigned to "${project.title}".`, type: 'assignment', link: '/supervisor/projects' })
  emitToUser(supervisor.userId, 'notification:new', { title: 'Project assigned', type: 'assignment' })
  await writeAudit({ userId: req.user!.id, projectId, action: 'Assigned supervisor', entityType: 'SupervisorAssignment', entityId: supervisorId, details: { title: project.title } })
  await broadcastActivity({
    type: 'assignment',
    message: `Admin assigned supervisor to "${project.title}"`,
    meta: { projectId: String(project._id) },
    byUserId: req.user!.id,
  })
  res.json({ success: true, message: 'Supervisor assigned' })
})

export const getDeadlines = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const deadlines: any[] = await Deadline.find().sort({ date: 1 }).lean()
  const rows = deadlines.map((d: any) => ({ id: String(d._id), title: d.title, date: d.date, scope: d.scope, status: d.status }))
  if (!rows.length) {
    const milestones: any[] = await Milestone.find().sort({ dueDate: 1 }).limit(8).lean()
    const projects: any[] = await Project.find({ _id: { $in: milestones.map((m) => m.projectId) } }).lean()
    const projectById = new Map(projects.map((p: any) => [String(p._id), p]))
    return res.json({
      success: true,
      deadlines: milestones.map((m: any) => ({ id: String(m._id), title: `${m.title} — ${projectById.get(String(m.projectId))?.title || 'Project'}`, date: m.dueDate, scope: 'Project milestone', status: m.status })),
    })
  }
  res.json({ success: true, deadlines: rows })
})

export const createDeadline = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { title, date, scope, status } = req.body
  if (!title || !date) return res.status(400).json({ success: false, message: 'Title and date are required' })
  const deadline = await Deadline.create({ title, date, scope: scope || 'All departments', status: status || 'NOT_STARTED' })
  await writeAudit({ userId: req.user!.id, action: 'Created deadline', entityType: 'Deadline', entityId: String((deadline as any)._id), details: { title } })
  res.status(201).json({ success: true, message: 'Deadline created', id: String((deadline as any)._id) })
})

export const getEvaluations = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const rubric: any = await EvaluationRubric.findOne({ isActive: true }).lean()
  const criteria: any[] = rubric ? await RubricCriterion.find({ rubricId: rubric._id }).sort({ order: 1 }).lean() : []
  const evaluations: any[] = await Evaluation.find().lean()
  const projects: any[] = await Project.find().lean()
  const projectById = new Map(projects.map((p: any) => [String(p._id), p]))

  const rows = evaluations.map((e: any) => ({
    id: String(e._id),
    projectId: String(e.projectId),
    project: projectById.get(String(e.projectId))?.title || 'Project',
    totalScore: e.totalScore,
    isReleased: e.isReleased,
    evaluatedAt: e.evaluatedAt,
    comments: e.comments || '',
    scores: (e.scores || []).map((s: any) => ({ name: s.name, score: s.score, max: s.max, weight: s.weight })),
  }))

  const top = rows.slice().sort((a, b) => b.totalScore - a.totalScore)[0]
  const evaluatedProjects = new Set(rows.map((r) => r.projectId)).size
  const awaiting = new Set(rows.filter((r) => !r.isReleased).map((r) => r.projectId)).size

  res.json({
    success: true,
    rubric: rubric ? { id: String(rubric._id), name: rubric.name, description: rubric.description, totalWeight: rubric.totalWeight } : null,
    criteria: criteria.map((c: any) => ({ id: String(c._id), criterion: c.name, max: c.maxScore, weight: c.weight })),
    evaluations: rows,
    stats: {
      evaluated: evaluatedProjects,
      totalProjects: projects.length,
      awaitingRelease: awaiting,
      topScore: top ? { project: top.project, score: top.totalScore } : null,
    },
  })
})

export const releaseEvaluations = asyncHandler(async (req: AuthRequest, res: Response) => {
  const filter = req.body.projectId ? { projectId: req.body.projectId } : {}
  const result = await Evaluation.updateMany(filter, { isReleased: true })
  const evaluations: any[] = await Evaluation.find({ ...filter, isReleased: true }).lean()
  for (const e of evaluations) {
    const members: any[] = await ProjectMember.find({ projectId: e.projectId }).lean()
    for (const m of members) {
      const profile: any = await StudentProfile.findById(m.studentId).lean()
      if (profile) await Notification.create({ userId: profile.userId, title: 'Evaluation released', message: 'Your final evaluation results are now available.', type: 'evaluation', link: '/student/evaluations' })
    }
  }
  await writeAudit({ userId: req.user!.id, action: 'Released evaluation results', entityType: 'Evaluation', details: { count: result.modifiedCount } })
  res.json({ success: true, message: `Released ${result.modifiedCount} evaluation(s)` })
})

export const getSimilarity = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const report = await compareProposals()
  const ids = Array.from(new Set(report.pairs.flatMap((p) => [p.aId, p.bId])))
  // Map proposal id -> members through the proposal's project id.
  const proposals: any[] = await Proposal.find({ _id: { $in: ids } }).select('projectId').lean()
  const proposalById = new Map(proposals.map((p: any) => [String(p._id), p]))
  const teamByProject = await projectTeamNames(Array.from(new Set(proposals.map((p: any) => String(p.projectId)))))
  const pairs = report.pairs.map((p) => {
    const a: any = proposalById.get(p.aId)
    const b: any = proposalById.get(p.bId)
    return {
      ...p,
      aMembers: a ? teamByProject.get(String(a.projectId)) || [] : [],
      bMembers: b ? teamByProject.get(String(b.projectId)) || [] : [],
    }
  })
  res.json({ success: true, ...report, pairs })
})

export const getReports = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const [projects, departments, students, supervisors] = await Promise.all([
    buildAdminProjects(),
    Department.find().lean(),
    StudentProfile.countDocuments(),
    SupervisorProfile.countDocuments(),
  ])

  const departmentPerformance = (departments as any[]).map((d: any) => {
    const list = projects.filter((p) => p.departmentId === String(d._id))
    return { dept: d.name, projects: list.length, onTrack: list.filter((p) => p.health === 'LOW').length, atRisk: list.filter((p) => p.health !== 'LOW').length }
  })

  const statusCounts: Record<string, number> = {}
  projects.forEach((p) => {
    const meta = STATUS_META[p.status] || { label: p.status }
    statusCounts[meta.label] = (statusCounts[meta.label] || 0) + 1
  })

  const months: { month: string; projects: number }[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const count = await Project.countDocuments({ createdAt: { $gte: start, $lt: end } })
    months.push({ month: start.toLocaleString('en', { month: 'short' }), projects: count })
  }

  res.json({
    success: true,
    stats: { totalProjects: projects.length, totalStudents: students, totalSupervisors: supervisors, atRisk: projects.filter((p) => p.health !== 'LOW').length },
    projectsByStatus: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
    departmentPerformance,
    monthly: months,
  })
})

export const getAuditLogs = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const logs: any[] = await AuditLog.find().sort({ createdAt: -1 }).limit(200).populate('userId', 'firstName lastName role').lean()
  res.json({ success: true, logs: logs.map(mapAudit) })
})

const DEFAULT_SETTINGS = {
  teamMin: 2,
  teamMax: 4,
  minCgpa: 2.0,
  allowPreferredSupervisor: true,
  requireChangeApproval: true,
  mediumThreshold: 25,
  highThreshold: 50,
  inactivityDays: 14,
  revisionFlag: 3,
  notifications: { proposal: true, submission: true, milestone: true, evaluation: true },
  security: { sessionDays: 7, rateLimit: true, auditLogging: true },
}

export const getSettings = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const doc: any = await Setting.findOne({ key: 'platform' }).lean()
  res.json({ success: true, settings: { ...DEFAULT_SETTINGS, ...(doc?.value || {}) } })
})

export const updateSettings = asyncHandler(async (req: AuthRequest, res: Response) => {
  const existing: any = await Setting.findOne({ key: 'platform' }).lean()
  const value = { ...DEFAULT_SETTINGS, ...(existing?.value || {}), ...req.body }
  await Setting.findOneAndUpdate({ key: 'platform' }, { key: 'platform', value }, { upsert: true })
  await writeAudit({ userId: req.user!.id, action: 'Updated platform settings', entityType: 'Setting' })
  res.json({ success: true, message: 'Settings saved', settings: value })
})

export const getSupervisors = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const supervisors: any[] = await SupervisorProfile.find().lean()
  const users: any[] = await User.find({ _id: { $in: supervisors.map((s: any) => s.userId) } }).lean()
  const userById = new Map(users.map((u: any) => [String(u._id), u]))
  const rows = []
  for (const s of supervisors) {
    const u: any = userById.get(String(s.userId))
    rows.push({
      id: String(s._id),
      name: u ? displayName('SUPERVISOR', u) : 'Supervisor',
      email: u?.email || '',
      capacity: s.maxSupervisees || 5,
      projects: await SupervisorAssignment.countDocuments({ supervisorId: s._id }),
    })
  }
  res.json({ success: true, supervisors: rows })
})

/**
 * Install the standard four-step FYP milestone plan on a project. Skips
 * titles that already exist so repeated calls never duplicate steps. New
 * projects get this automatically at registration; this endpoint exists for
 * projects created before that feature and for re-staging projects.
 */
export const installMilestonePlan = asyncHandler(async (req: AuthRequest, res: Response) => {
  const project = await Project.findById(req.params.id)
  if (!project) return res.status(404).json({ success: false, message: 'Project not found' })

  const dayMs = 24 * 60 * 60 * 1000
  const base = Date.now()
  const plan = [
    { title: 'Proposal approval', description: 'Proposal drafted, submitted, and signed off by the supervisor.', offset: 14 },
    { title: 'Mid-term evaluation', description: 'Interim report and progress presentation reviewed around mid-term week.', offset: 56 },
    { title: 'Final report submission', description: 'Complete project report with all deliverables handed in.', offset: 98 },
    { title: 'Final defense', description: 'Viva presentation and defense before the panel.', offset: 112 },
  ]
  const existing = await Milestone.find({ projectId: project._id }).lean()
  const haveTitles = new Set(existing.map((m: any) => String(m.title)))
  let created = 0
  let order = existing.length
  for (const step of plan) {
    if (haveTitles.has(step.title)) continue
    await Milestone.create({
      projectId: project._id,
      title: step.title,
      description: step.description,
      startDate: new Date(base + (step.offset - 28) * dayMs),
      dueDate: new Date(base + step.offset * dayMs),
      status: 'NOT_STARTED',
      completionPercentage: 0,
      deliverableRequirements: 'Submit a PDF report and supporting files.',
      order: order++,
    })
    created++
  }
  await writeAudit({ userId: req.user!.id, projectId: String(project._id), action: 'Installed standard milestone plan', entityType: 'Project', entityId: String(project._id) })
  res.json({ success: true, message: `Milestone plan installed (${created} created, ${plan.length - created} already present)`, created })
})
