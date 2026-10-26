import { KanbanCard, Project, ProjectMember, StudentProfile, SupervisorAssignment, SupervisorProfile, User } from '../models'
import { AppError } from '../middleware/errorHandler'
import { emitToProject } from './realtime'

/**
 * Per-project kanban board.
 *
 * Cards are free-form work items (TODO / IN_PROGRESS / REVIEW / DONE) arranged
 * with a sparse float `order` so a drag-and-drop move only touches one row:
 * the moved card takes the midpoint of its new neighbours. Every mutation
 * re-checks the same visibility rule as the realtime project room and then
 * broadcasts `kanban:update` to that project's room, with query polling as the
 * client-side fallback.
 */

export const COLUMNS = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'] as const
export type Column = (typeof COLUMNS)[number]

export interface BoardActor {
  id: string
  role: 'STUDENT' | 'SUPERVISOR' | 'ADMIN'
}

interface ProjectContext {
  projectId: string
  project: { _id: any; title: string }
}

async function boardAccess(actor: BoardActor, projectId: string): Promise<ProjectContext> {
  if (actor.role !== 'ADMIN') {
    let allowed = false
    if (actor.role === 'STUDENT') {
      const profile: any = await StudentProfile.findOne({ userId: actor.id }).select('_id').lean()
      if (!profile) throw new AppError('You do not have a student profile', 403)
      allowed = !!(await ProjectMember.exists({ projectId, studentId: profile._id }))
    } else {
      const assignment = await SupervisorAssignment.findOne({ projectId }).select('supervisorId').lean()
      if (assignment) {
        const profile: any = await SupervisorProfile.findById(assignment.supervisorId).select('userId').lean()
        allowed = !!profile && String(profile.userId) === actor.id
      }
    }
    if (!allowed) throw new AppError('You do not have access to this board', 403)
  }
  const project: any = await Project.findById(projectId).select('title').lean()
  if (!project) throw new AppError('Project not found', 404)
  return { projectId: String(project._id), project }
}

function cardView(card: any) {
  return {
    id: String(card._id),
    title: card.title,
    description: card.description || '',
    column: card.column,
    order: card.order,
    assigneeStudentId: card.assigneeStudentId ? String(card.assigneeStudentId) : null,
    assigneeName: card.assigneeName || null,
    priority: card.priority,
    dueDate: card.dueDate || null,
    createdAt: card.createdAt,
  }
}

async function decorateMembers(projectId: string) {
  const members: any[] = await ProjectMember.find({ projectId }).lean()
  const profiles: any[] = await StudentProfile.find({ _id: { $in: members.map((m: any) => m.studentId) } })
    .select('userId')
    .lean()
  const users: any[] = await User.find({ _id: { $in: profiles.map((p: any) => p.userId) } }).select('firstName lastName').lean()
  const userById = new Map(users.map((u: any) => [String(u._id), `${u.firstName} ${u.lastName}`]))
  const profileById = new Map(profiles.map((p: any) => [String(p._id), p.userId]))
  return members
    .map((m: any) => {
      const userId = profileById.get(String(m.studentId))
      return { studentId: String(m.studentId), name: userId ? userById.get(String(userId)) || null : null }
    })
    .filter((m) => m.name)
}

export async function list(projectId: string, actor: BoardActor) {
  await boardAccess(actor, projectId)
  const cards: any[] = await KanbanCard.find({ projectId }).sort({ column: 1, order: 1 }).lean()
  const members = await decorateMembers(projectId)
  const nameById = new Map(members.map((m) => [m.studentId, m.name!]))
  return {
    columns: COLUMNS,
    members,
    cards: cards.map((c) => ({
      ...cardView(c),
      assigneeName: c.assigneeStudentId ? nameById.get(String(c.assigneeStudentId)) || null : null,
    })),
  }
}

export async function create(projectId: string, actor: BoardActor, body: any) {
  const ctx = await boardAccess(actor, projectId)
  const title = String(body?.title || '').trim()
  if (title.length < 2) throw new AppError('Give the card a title', 400)
  const column = COLUMNS.includes(body?.column) ? body.column : 'TODO'
  const priority = ['LOW', 'MEDIUM', 'HIGH'].includes(body?.priority) ? body.priority : 'MEDIUM'
  const assigneeStudentId = body?.assigneeStudentId ? String(body.assigneeStudentId) : null
  if (assigneeStudentId) {
    const member = await ProjectMember.exists({ projectId, studentId: assigneeStudentId })
    if (!member) throw new AppError('Assignee must be a team member', 400)
  }
  const dueDate = body?.dueDate ? new Date(body.dueDate) : null
  if (dueDate && isNaN(dueDate.getTime())) throw new AppError('Invalid due date', 400)

  const last: any = await KanbanCard.findOne({ projectId, column }).sort({ order: -1 }).lean()
  const card: any = await KanbanCard.create({
    projectId,
    title: title.slice(0, 120),
    description: String(body?.description || '').slice(0, 1000),
    column,
    order: last ? last.order + 100 : 0,
    assigneeStudentId,
    priority,
    dueDate,
    createdBy: actor.id,
  })
  await emitToProject(projectId, 'kanban:update', { projectId, reason: 'card-created' })
  return { card: cardView(card) }
}

export async function update(cardId: string, actor: BoardActor, body: any) {
  const card: any = await KanbanCard.findById(cardId).lean()
  if (!card) throw new AppError('Card not found', 404)
  await boardAccess(actor, String(card.projectId))

  const updates: any = {}
  if (body?.title !== undefined) {
    const title = String(body.title).trim()
    if (title.length < 2) throw new AppError('Give the card a title', 400)
    updates.title = title.slice(0, 120)
  }
  if (body?.description !== undefined) updates.description = String(body.description).slice(0, 1000)
  if (body?.column !== undefined) {
    if (!COLUMNS.includes(body.column)) throw new AppError('Unknown column', 400)
    updates.column = body.column
  }
  if (body?.priority !== undefined) {
    if (!['LOW', 'MEDIUM', 'HIGH'].includes(body.priority)) throw new AppError('Unknown priority', 400)
    updates.priority = body.priority
  }
  if (body?.dueDate !== undefined) {
    updates.dueDate = body.dueDate ? new Date(body.dueDate) : null
    if (updates.dueDate && isNaN(updates.dueDate.getTime())) throw new AppError('Invalid due date', 400)
  }
  if (body?.assigneeStudentId !== undefined) {
    const assigneeStudentId = body.assigneeStudentId ? String(body.assigneeStudentId) : null
    if (assigneeStudentId) {
      const member = await ProjectMember.exists({ projectId: card.projectId, studentId: assigneeStudentId })
      if (!member) throw new AppError('Assignee must be a team member', 400)
    }
    updates.assigneeStudentId = assigneeStudentId
  }

  const updated: any = await KanbanCard.findByIdAndUpdate(cardId, updates, { new: true }).lean()
  await emitToProject(String(card.projectId), 'kanban:update', { projectId: card.projectId, reason: 'card-updated' })
  return { card: cardView(updated) }
}

/**
 * Drag-and-drop move. The client reports the destination column plus the card
 * the dropped card should be placed after (or nothing = head of the column),
 * and the server computes the midpoint order — one row written per move.
 */
export async function move(cardId: string, actor: BoardActor, body: any) {
  const card: any = await KanbanCard.findById(cardId).lean()
  if (!card) throw new AppError('Card not found', 404)
  await boardAccess(actor, String(card.projectId))

  const column = body?.column && COLUMNS.includes(body.column) ? body.column : card.column
  const afterId = body?.afterCardId ? String(body.afterCardId) : null
  let after: any = null
  if (afterId) {
    after = await KanbanCard.findOne({ _id: afterId, projectId: card.projectId, column }).lean()
    if (!after) throw new AppError('Reference card not on the destination column', 400)
  }
  const next: any = await KanbanCard.findOne({
    projectId: card.projectId,
    column,
    ...(after ? { order: { $gt: after.order } } : {}),
    _id: { $ne: card._id },
  }).sort({ order: 1 }).lean()

  const afterOrder = after ? after.order : 0
  const nextOrder = next ? next.order : (after ? after.order + 100 : 0 - 100)
  const order = next ? (afterOrder + nextOrder) / 2 : afterOrder + 50

  const updated: any = await KanbanCard.findByIdAndUpdate(cardId, { column, order }, { new: true }).lean()
  await emitToProject(String(card.projectId), 'kanban:update', { projectId: card.projectId, reason: 'card-moved' })
  return { card: cardView(updated) }
}

export async function remove(cardId: string, actor: BoardActor) {
  const card: any = await KanbanCard.findById(cardId).lean()
  if (!card) throw new AppError('Card not found', 404)
  await boardAccess(actor, String(card.projectId))
  await KanbanCard.deleteOne({ _id: card._id })
  await emitToProject(String(card.projectId), 'kanban:update', { projectId: card.projectId, reason: 'card-deleted' })
  return {}
}
