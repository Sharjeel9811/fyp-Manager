import { Response } from 'express'
import { AuditLog, Project, ProjectMember, Milestone, StudentProfile, SupervisorAssignment, SupervisorProfile, User } from '../models'

export function asyncHandler(fn: (req: any, res: Response, next: any) => Promise<any>) {
  return (req: any, res: Response, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

export function fullName(u: any): string {
  return `${u.firstName || ''} ${u.lastName || ''}`.trim()
}

export function displayName(role: string, u: any): string {
  const name = fullName(u)
  return role === 'SUPERVISOR' ? `Dr. ${name}` : name
}

export function statusLabel(status: string): string {
  return (status || '')
    .toLowerCase()
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ')
}

export async function projectProgress(projectId: string): Promise<number> {
  const milestones: any[] = await Milestone.find({ projectId }).lean()
  if (!milestones.length) return 0
  const total = milestones.reduce((sum, m) => sum + (m.completionPercentage || 0), 0)
  return Math.round(total / milestones.length)
}

export function stageFor(milestones: any[]): string {
  if (!milestones.length) return 'Proposal'
  const active = milestones.find((m) => m.status === 'IN_PROGRESS') || milestones.find((m) => m.status !== 'COMPLETED' && m.status !== 'NOT_STARTED')
  return active?.title || (milestones.every((m) => m.status === 'COMPLETED') ? 'Completed' : milestones[0].title)
}

export async function getStudentContext(userId: string) {
  const student: any = await StudentProfile.findOne({ userId }).lean()
  if (!student) return null
  const memberships: any[] = await ProjectMember.find({ studentId: student._id }).lean()
  const projectIds = memberships.map((m) => m.projectId)
  const project: any = await Project.findOne({ _id: { $in: projectIds } }).sort({ createdAt: 1 }).lean()
  return { student, project, projectIds }
}

export async function getSupervisorContext(userId: string) {
  const supervisor: any = await SupervisorProfile.findOne({ userId }).lean()
  if (!supervisor) return null
  const assignments: any[] = await SupervisorAssignment.find({ supervisorId: supervisor._id }).lean()
  const projectIds = assignments.map((a) => a.projectId)
  return { supervisor, projectIds }
}

export async function supervisorNameForProject(projectId: string): Promise<{ name: string; profile: any } | null> {
  const assignment: any = await SupervisorAssignment.findOne({ projectId }).lean()
  if (!assignment) return null
  const profile: any = await SupervisorProfile.findById(assignment.supervisorId).lean()
  if (!profile) return null
  const user: any = await User.findById(profile.userId).lean()
  return { name: user ? displayName('SUPERVISOR', user) : 'Unassigned', profile }
}

export async function writeAudit(opts: {
  userId?: string | null
  projectId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  details?: any
  ipAddress?: string
}) {
  await AuditLog.create({
    userId: opts.userId || null,
    projectId: opts.projectId || null,
    action: opts.action,
    entityType: opts.entityType,
    entityId: opts.entityId || null,
    details: opts.details || null,
    ipAddress: opts.ipAddress || null,
  })
}

export function paginate<T>(items: T[], page = 1, limit = 50): T[] {
  const p = Math.max(1, page)
  return items.slice((p - 1) * limit, p * limit)
}

/**
 * Password policy shared by registration, admin user creation, password
 * change, and reset. Existing accounts keep working; only NEW passwords are
 * held to this bar (current demo passwords contain letters and digits).
 */
export function passwordProblem(pw: unknown): string | null {
  const s = String(pw || '')
  if (s.length < 8) return 'Password must be at least 8 characters'
  if (!/[A-Za-z]/.test(s) || !/[0-9]/.test(s)) return 'Password must contain both letters and numbers'
  return null
}

