import {
  DefenseScore,
  DefenseSchedule,
  DefenseSession,
  Evaluation,
  EvaluationRubric,
  Notification,
  Project,
  ProjectMember,
  RubricCriterion,
  StudentProfile,
  SupervisorAssignment,
  SupervisorProfile,
  User,
} from '../models'
import { fullName, writeAudit } from '../utils/helpers'
import { broadcastToRole, emitToProject, emitToUser } from './realtime'
import { AppError } from '../middleware/errorHandler'

export interface DefenseActor {
  id: string
  role: 'STUDENT' | 'SUPERVISOR' | 'ADMIN'
  name: string
}

interface ProjectContext {
  project: any
  assignment: any
  schedule: any
}

interface Permissions {
  canView: boolean
  canControl: boolean
  canEvaluate: boolean
}

const OBJECT_ID = /^[a-f\d]{24}$/i
const MIN_DURATION = 5
const MAX_DURATION = 180
const MAX_COMMENT = 1_000

function assertId(value: unknown, label = 'identifier') {
  if (typeof value !== 'string' || !OBJECT_ID.test(value)) {
    throw new AppError(`Invalid ${label}`, 400)
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function round1(value: number) {
  return Math.round(value * 10) / 10
}

/** "Dr. Ayesha Khan" and "Ayesha Khan" must match the same supervisor. */
function normalizeName(value: unknown) {
  return String(value || '')
    .toLowerCase()
    .replace(/^dr\.?\s+/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function loadContext(projectId: string): Promise<ProjectContext> {
  const [project, assignment, schedule] = await Promise.all([
    Project.findById(projectId).select('title status').lean(),
    SupervisorAssignment.findOne({ projectId }).lean(),
    DefenseSchedule.findOne({ projectId }).lean(),
  ])
  return { project, assignment, schedule }
}

async function contextForSession(session: any): Promise<ProjectContext> {
  return loadContext(String(session.projectId))
}

async function supervisorUserIdFor(assignment: any): Promise<string | null> {
  if (!assignment) return null
  const profile: any = await SupervisorProfile.findById(assignment.supervisorId).select('userId').lean()
  return profile ? String(profile.userId) : null
}

/**
 * The panel is a snapshot taken when the session starts:
 *  - the project's assigned supervisor is always allowed (otherwise a seed
 *    project whose schedule names a different panel could not be scored), and
 *  - supervisors named in `DefenseSchedule.evaluators` are added by name.
 */
async function resolvePanel(ctx: ProjectContext) {
  const panel: Array<{ userId: any; name: string }> = []
  const seen = new Set<string>()
  const add = (userId: any, name: string) => {
    const id = String(userId)
    if (!id || seen.has(id)) return
    seen.add(id)
    panel.push({ userId, name })
  }

  const assignedUserId = await supervisorUserIdFor(ctx.assignment)
  if (assignedUserId) {
    const user: any = await User.findById(assignedUserId).select('firstName lastName').lean()
    if (user) add(user._id, fullName(user))
  }

  const wanted = new Set(
    ((ctx.schedule?.evaluators as string[]) || []).map(normalizeName).filter(Boolean)
  )
  if (wanted.size) {
    const supervisors: any[] = await User.find({ role: 'SUPERVISOR', isActive: true })
      .select('firstName lastName')
      .lean()
    for (const user of supervisors) {
      const name = fullName(user)
      if (wanted.has(normalizeName(name))) add(user._id, name)
    }
  }

  return panel
}

async function isStudentMember(projectId: any, userId: string) {
  const profile: any = await StudentProfile.findOne({ userId }).select('_id').lean()
  if (!profile) return false
  return !!(await ProjectMember.exists({ projectId, studentId: profile._id }))
}

async function permissionsFor(
  ctx: ProjectContext,
  session: any,
  actor: DefenseActor | null
): Promise<Permissions> {
  if (!actor) return { canView: true, canControl: false, canEvaluate: false }
  // Admins coordinate the session (advance, unlock, release) but never score:
  // their score would not belong to the snapshotted panel and would distort
  // the expected-evaluator count.
  if (actor.role === 'ADMIN') return { canView: true, canControl: true, canEvaluate: false }

  if (actor.role === 'SUPERVISOR') {
    const assignedUserId = await supervisorUserIdFor(ctx.assignment)
    const panel = session?.panel?.length ? session.panel : await resolvePanel(ctx)
    const onPanel = (panel || []).some((p: any) => String(p.userId) === actor.id)
    const allowed = onPanel || assignedUserId === actor.id
    return { canView: allowed, canControl: allowed, canEvaluate: allowed }
  }

  const member = await isStudentMember(ctx.project._id, actor.id)
  return { canView: member, canControl: false, canEvaluate: false }
}

function sessionView(session: any) {
  const now = Date.now()
  const criteria = (session.criteria || []).map((c: any) => ({
    criterionId: String(c.criterionId),
    name: c.name,
    maxScore: c.maxScore,
    weight: c.weight,
    order: c.order || 0,
  }))
  const index = criteria.findIndex((c: any) => c.criterionId === String(session.currentCriterionId))
  const endsAt = session.endsAt ? new Date(session.endsAt).getTime() : now

  return {
    id: String(session._id),
    status: session.status,
    criteria,
    currentCriterionId: session.currentCriterionId ? String(session.currentCriterionId) : null,
    currentCriterionIndex: index,
    durationMinutes: session.durationMinutes,
    startedAt: session.startedAt,
    endsAt: session.endsAt,
    endedAt: session.endedAt || null,
    resultsReleased: !!session.resultsReleased,
    releasedAt: session.releasedAt || null,
    timer: {
      running: session.status === 'LIVE' && endsAt > now,
      remainingSeconds: Math.max(0, Math.ceil((endsAt - now) / 1000)),
      serverNow: now,
    },
  }
}

function aggregateFrom(scores: any[], session: any, includeIds: boolean) {
  const submitted = scores.filter((s) => s.submitted)
  const evaluatorMap = new Map<string, { name: string; count: number }>()
  submitted.forEach((s) => {
    const id = String(s.evaluatorId)
    const entry = evaluatorMap.get(id) || { name: s.evaluatorName || 'Evaluator', count: 0 }
    entry.count += 1
    evaluatorMap.set(id, entry)
  })

  const rows = (session.criteria || []).map((c: any) => {
    const entries = submitted.filter((s) => String(s.criterionId) === String(c.criterionId))
    const average = entries.length
      ? round1(entries.reduce((sum, s) => sum + (Number(s.score) || 0), 0) / entries.length)
      : null
    return {
      criterionId: String(c.criterionId),
      name: c.name,
      maxScore: c.maxScore,
      weight: c.weight,
      average,
      submittedCount: entries.length,
      // Individual panel scores are only exposed on the detailed view. After
      // release students see the per-criterion average, not who gave what.
      scores: includeIds
        ? entries.map((s) => ({
            evaluatorId: String(s.evaluatorId),
            evaluatorName: s.evaluatorName || 'Evaluator',
            score: s.score,
            comment: s.comment || '',
            submittedAt: s.submittedAt || null,
          }))
        : [],
    }
  })

  return {
    rows,
    total: round1(rows.reduce((sum: number, r: any) => sum + (r.average || 0), 0)),
    maxTotal: rows.reduce((sum: number, r: any) => sum + (Number(r.maxScore) || 0), 0),
    submittedEvaluators: evaluatorMap.size,
    evaluators: includeIds
      ? Array.from(evaluatorMap.entries()).map(([id, entry]) => ({
          evaluatorId: id,
          name: entry.name,
          submittedCount: entry.count,
        }))
      : [],
  }
}

async function buildState(
  session: any,
  ctx: ProjectContext,
  actor: DefenseActor | null,
  mode: 'public' | 'detail',
  permissions: Permissions
) {
  const scores: any[] = session ? await DefenseScore.find({ sessionId: session._id }).lean() : []
  const submitted = scores.filter((s) => s.submitted)
  const submittedEvaluators = new Set(submitted.map((s) => String(s.evaluatorId))).size
  const expectedEvaluators = session?.panel?.length || 0

  const includeAggregate = mode === 'detail' || !!session?.resultsReleased
  const includeIds = mode === 'detail' || actor?.role === 'ADMIN'

  return {
    project: { id: String(ctx.project._id), title: ctx.project.title },
    schedule: ctx.schedule
      ? {
          date: ctx.schedule.scheduledDate || null,
          venue: ctx.schedule.venue || null,
          panel: ctx.schedule.evaluators || [],
          duration: ctx.schedule.duration || null,
          status: ctx.schedule.status || null,
        }
      : null,
    session: session ? sessionView(session) : null,
    permissions,
    progress: {
      expectedEvaluators,
      submittedEvaluators,
      submittedScores: submitted.length,
      totalScores: session ? (session.criteria?.length || 0) * Math.max(expectedEvaluators, submittedEvaluators) : 0,
    },
    aggregate: includeAggregate && session ? aggregateFrom(scores, session, includeIds) : null,
    myScores:
      actor && session
        ? scores
            .filter((s) => String(s.evaluatorId) === actor.id)
            .map((s) => ({
              criterionId: String(s.criterionId),
              score: s.score,
              comment: s.comment || '',
              submitted: !!s.submitted,
              submittedAt: s.submittedAt || null,
            }))
        : [],
  }
}

async function stateForSession(sessionId: string, actor: DefenseActor) {
  assertId(sessionId, 'session id')
  const session: any = await DefenseSession.findById(sessionId).lean()
  if (!session) throw new AppError('Defense session not found', 404)

  const ctx = await contextForSession(session)
  if (!ctx.project) throw new AppError('Project not found', 404)

  const permissions = await permissionsFor(ctx, session, actor)
  if (!permissions.canView) throw new AppError('You do not have access to this defense', 403)

  // Detail = live aggregate + evaluator identities. Panel members and admins
  // have control rights; students only ever get the sanitized public state.
  const mode = permissions.canControl ? 'detail' : 'public'
  return buildState(session, ctx, actor, mode, permissions)
}

/**
 * Fan out state after every mutation. Students only ever receive the
 * sanitized `defense:state`; live aggregates go to the panel and admins on
 * `defense:detail` so an evaluator can watch the other scores in real time.
 */
async function publish(sessionId: string) {
  const session: any = await DefenseSession.findById(sessionId).lean()
  if (!session) return null

  const ctx = await contextForSession(session)
  if (!ctx.project) return null

  const publicPermissions: Permissions = { canView: true, canControl: false, canEvaluate: false }
  const publicState = await buildState(session, ctx, null, 'public', publicPermissions)
  emitToProject(String(session.projectId), 'defense:state', publicState)

  const detailPermissions: Permissions = { canView: true, canControl: true, canEvaluate: true }
  const detailState = await buildState(session, ctx, null, 'detail', detailPermissions)
  const panelIds: string[] = Array.from(
    new Set((session.panel || []).map((p: any) => String(p.userId)))
  )
  panelIds.forEach((id) => emitToUser(id, 'defense:detail', detailState))
  broadcastToRole('ADMIN', 'defense:detail', detailState)

  return { session, ctx, publicState, detailState }
}

export async function getProjectState(projectId: string, actor: DefenseActor) {
  assertId(projectId, 'project id')
  const ctx = await loadContext(projectId)
  if (!ctx.project) throw new AppError('Project not found', 404)

  const session: any = await DefenseSession.findOne({ projectId }).sort({ createdAt: -1 }).lean()
  const permissions = await permissionsFor(ctx, session, actor)
  if (!permissions.canView) throw new AppError('You do not have access to this defense', 403)

  // Detail = live aggregate + evaluator identities. Panel members and admins
  // have control rights; students only ever get the sanitized public state.
  const mode = permissions.canControl ? 'detail' : 'public'
  return buildState(session, ctx, actor, mode, permissions)
}

export async function startDefense(
  projectId: string,
  actor: DefenseActor,
  body: { durationMinutes?: unknown }
) {
  assertId(projectId, 'project id')
  const ctx = await loadContext(projectId)
  if (!ctx.project) throw new AppError('Project not found', 404)

  const permissions = await permissionsFor(ctx, null, actor)
  if (!permissions.canControl) {
    throw new AppError('Only the assigned supervisor, a panel member, or an admin can start a defense', 403)
  }

  const live = await DefenseSession.findOne({ projectId, status: 'LIVE' }).lean()
  if (live) throw new AppError('A defense session is already live for this project', 409)

  const rubric: any = await EvaluationRubric.findOne({ isActive: true }).lean()
  if (!rubric) throw new AppError('No active evaluation rubric is configured', 400)
  const criteria: any[] = await RubricCriterion.find({ rubricId: rubric._id }).sort({ order: 1 }).lean()
  if (!criteria.length) throw new AppError('The active rubric has no criteria', 400)

  const panel = await resolvePanel(ctx)
  if (!panel.length) {
    throw new AppError('No evaluators are available. Assign a supervisor or add panel names to the defense schedule.', 400)
  }

  const fallbackDuration = Number(ctx.schedule?.duration) || 30
  const requested = Number(body?.durationMinutes)
  const duration = clamp(Number.isFinite(requested) && requested > 0 ? requested : fallbackDuration, MIN_DURATION, MAX_DURATION)
  const now = new Date()

  const session: any = await DefenseSession.create({
    projectId,
    scheduleId: ctx.schedule?._id || null,
    rubricId: rubric._id,
    criteria: criteria.map((c: any) => ({
      criterionId: c._id,
      name: c.name,
      maxScore: c.maxScore,
      weight: c.weight,
      order: c.order || 0,
    })),
    panel: panel.map((p) => ({ userId: p.userId, name: p.name })),
    status: 'LIVE',
    currentCriterionId: criteria[0]._id,
    durationMinutes: duration,
    startedAt: now,
    endsAt: new Date(now.getTime() + duration * 60_000),
    createdBy: actor.id,
  })

  await writeAudit({
    userId: actor.id,
    projectId,
    action: 'Started live defense',
    entityType: 'DefenseSession',
    entityId: String(session._id),
    details: { durationMinutes: duration, evaluators: panel.map((p) => p.name) },
  })

  await publish(String(session._id))
  return stateForSession(String(session._id), actor)
}

export async function submitScore(
  sessionId: string,
  actor: DefenseActor,
  body: { criterionId?: unknown; score?: unknown; comment?: unknown }
) {
  assertId(sessionId, 'session id')
  const session: any = await DefenseSession.findById(sessionId).lean()
  if (!session) throw new AppError('Defense session not found', 404)

  const ctx = await contextForSession(session)
  const permissions = await permissionsFor(ctx, session, actor)
  if (!permissions.canEvaluate) throw new AppError('Only panel evaluators can score this defense', 403)
  if (session.status !== 'LIVE') throw new AppError('This defense has already ended', 409)

  const criterionId = String(body?.criterionId || '')
  assertId(criterionId, 'criterion id')
  const criterion: any = (session.criteria || []).find(
    (c: any) => String(c.criterionId) === criterionId
  )
  if (!criterion) throw new AppError('That criterion is not part of this defense', 400)

  const raw = Number(body?.score)
  if (!Number.isFinite(raw)) throw new AppError('Enter a numeric score', 400)
  const score = round1(raw)
  const maxScore = Number(criterion.maxScore) || 0
  if (score < 0 || score > maxScore) {
    throw new AppError(`Score must be between 0 and ${maxScore}`, 400)
  }

  const existing: any = await DefenseScore.findOne({
    sessionId: session._id,
    evaluatorId: actor.id,
    criterionId: criterion.criterionId,
  }).lean()
  if (existing?.submitted) {
    throw new AppError('Your score for this criterion is locked. Ask an admin to unlock it.', 409)
  }

  const comment =
    typeof body?.comment === 'string' ? body.comment.trim().slice(0, MAX_COMMENT) : ''
  const submittedAt = new Date()

  await DefenseScore.findOneAndUpdate(
    { sessionId: session._id, evaluatorId: actor.id, criterionId: criterion.criterionId },
    {
      sessionId: session._id,
      projectId: session.projectId,
      evaluatorId: actor.id,
      evaluatorName: actor.name,
      criterionId: criterion.criterionId,
      criterionName: criterion.name,
      maxScore: criterion.maxScore,
      weight: criterion.weight,
      score,
      comment,
      submitted: true,
      submittedAt,
    },
    { upsert: true, new: true }
  )

  await writeAudit({
    userId: actor.id,
    projectId: String(session.projectId),
    action: 'Submitted defense score',
    entityType: 'DefenseScore',
    entityId: String(session._id),
    details: { criterion: criterion.name, score, max: maxScore },
  })

  await publish(String(session._id))

  // Lightweight live hint for the rest of the panel; deliberately not sent to
  // the project room because students must not learn scores before release.
  const hint = {
    sessionId: String(session._id),
    criterionId,
    criterionName: criterion.name,
    evaluatorName: actor.name,
    submittedAt,
  }
  const panelIds: string[] = Array.from(
    new Set((session.panel || []).map((p: any) => String(p.userId)))
  )
  panelIds
    .filter((id) => id !== actor.id)
    .forEach((id) => emitToUser(id, 'defense:scored', hint))
  broadcastToRole('ADMIN', 'defense:scored', hint)

  return stateForSession(String(session._id), actor)
}

export async function advanceCriterion(sessionId: string, actor: DefenseActor) {
  assertId(sessionId, 'session id')
  const session: any = await DefenseSession.findById(sessionId).lean()
  if (!session) throw new AppError('Defense session not found', 404)

  const ctx = await contextForSession(session)
  const permissions = await permissionsFor(ctx, session, actor)
  if (!permissions.canControl) throw new AppError('You cannot control this defense', 403)
  if (session.status !== 'LIVE') throw new AppError('This defense has already ended', 409)

  const criteria = session.criteria || []
  const index = criteria.findIndex((c: any) => String(c.criterionId) === String(session.currentCriterionId))
  if (index >= criteria.length - 1) {
    throw new AppError('This is the last criterion. End the defense when the panel is done.', 409)
  }

  const next = criteria[Math.max(index, 0) + 1]
  await DefenseSession.updateOne({ _id: session._id }, { currentCriterionId: next.criterionId })

  await writeAudit({
    userId: actor.id,
    projectId: String(session.projectId),
    action: 'Advanced live defense criterion',
    entityType: 'DefenseSession',
    entityId: String(session._id),
    details: { criterion: next.name },
  })

  await publish(String(session._id))
  return stateForSession(String(session._id), actor)
}

export async function endDefense(sessionId: string, actor: DefenseActor) {
  assertId(sessionId, 'session id')
  const session: any = await DefenseSession.findById(sessionId).lean()
  if (!session) throw new AppError('Defense session not found', 404)

  const ctx = await contextForSession(session)
  const permissions = await permissionsFor(ctx, session, actor)
  if (!permissions.canControl) throw new AppError('You cannot control this defense', 403)

  if (session.status !== 'COMPLETED') {
    const now = new Date()
    await DefenseSession.updateOne(
      { _id: session._id },
      { status: 'COMPLETED', endedAt: now }
    )

    // Materialise the panel's submitted scores as normal Evaluation rows, so
    // the existing admin release flow and student results page keep working.
    const scores: any[] = await DefenseScore.find({ sessionId: session._id, submitted: true }).lean()
    const byEvaluator = new Map<string, any[]>()
    scores.forEach((s) => {
      const id = String(s.evaluatorId)
      const list = byEvaluator.get(id) || []
      list.push(s)
      byEvaluator.set(id, list)
    })

    for (const [evaluatorId, entries] of byEvaluator.entries()) {
      // Only criteria this evaluator actually locked. Writing zeros for the
      // rest would surface as a real score on the student results page.
      const rows = (session.criteria || [])
        .map((c: any) => {
          const entry = entries.find((s) => String(s.criterionId) === String(c.criterionId))
          return entry
            ? {
                criterionId: c.criterionId,
                name: c.name,
                max: c.maxScore,
                weight: c.weight,
                score: entry.score,
              }
            : null
        })
        .filter(Boolean) as Array<Record<string, any>>
      const total = round1(rows.reduce((sum: number, r: any) => sum + (Number(r.score) || 0), 0))
      await Evaluation.findOneAndUpdate(
        { projectId: session.projectId, evaluatorId },
        {
          projectId: session.projectId,
          evaluatorId,
          rubricId: session.rubricId,
          scores: rows,
          totalScore: total,
          comments: 'Recorded during the live defense.',
          isReleased: false,
          evaluatedAt: now,
        },
        { upsert: true, new: true }
      )
    }

    await writeAudit({
      userId: actor.id,
      projectId: String(session.projectId),
      action: 'Ended live defense',
      entityType: 'DefenseSession',
      entityId: String(session._id),
      details: { evaluators: byEvaluator.size },
    })
  }

  const { session: current } = (await publish(String(session._id))) || { session }
  emitToProject(String(session.projectId), 'defense:ended', {
    sessionId: String(session._id),
    endedAt: current?.endedAt || new Date(),
  })

  return stateForSession(String(session._id), actor)
}

export async function releaseResults(sessionId: string, actor: DefenseActor) {
  assertId(sessionId, 'session id')
  if (actor.role !== 'ADMIN') {
    throw new AppError('Only an administrator can release defense results', 403)
  }

  const session: any = await DefenseSession.findById(sessionId).lean()
  if (!session) throw new AppError('Defense session not found', 404)
  if (session.status !== 'COMPLETED') {
    throw new AppError('End the defense before releasing results', 409)
  }

  const now = new Date()
  await DefenseSession.updateOne(
    { _id: session._id },
    { resultsReleased: true, releasedAt: now }
  )
  await Evaluation.updateMany({ projectId: session.projectId }, { isReleased: true })

  const members: any[] = await ProjectMember.find({ projectId: session.projectId }).lean()
  for (const member of members) {
    const profile: any = await StudentProfile.findById(member.studentId).select('userId').lean()
    if (!profile) continue
    await Notification.create({
      userId: profile.userId,
      title: 'Defense results released',
      message: 'Your live defense scores are now available.',
      type: 'defense',
      link: '/student/defense',
    })
  }

  await writeAudit({
    userId: actor.id,
    projectId: String(session.projectId),
    action: 'Released live defense results',
    entityType: 'DefenseSession',
    entityId: String(session._id),
    details: { students: members.length },
  })

  const refreshed: any = await DefenseSession.findById(session._id).lean()
  const ctx = await contextForSession(refreshed)
  const publicPermissions: Permissions = { canView: true, canControl: false, canEvaluate: false }
  const publicState = await buildState(refreshed, ctx, null, 'public', publicPermissions)
  emitToProject(String(session.projectId), 'defense:released', publicState)
  await publish(String(session._id))

  return stateForSession(String(session._id), actor)
}

export async function unlockScore(
  sessionId: string,
  actor: DefenseActor,
  body: { evaluatorId?: unknown; criterionId?: unknown }
) {
  assertId(sessionId, 'session id')
  if (actor.role !== 'ADMIN') {
    throw new AppError('Only an administrator can unlock a score', 403)
  }

  const session: any = await DefenseSession.findById(sessionId).lean()
  if (!session) throw new AppError('Defense session not found', 404)
  if (session.status !== 'LIVE') {
    throw new AppError('Scores can only be unlocked while the defense is live', 409)
  }

  const evaluatorId = String(body?.evaluatorId || '')
  const criterionId = String(body?.criterionId || '')
  assertId(evaluatorId, 'evaluator id')
  assertId(criterionId, 'criterion id')

  const updated = await DefenseScore.findOneAndUpdate(
    { sessionId: session._id, evaluatorId, criterionId },
    { submitted: false, submittedAt: null },
    { new: true }
  )
  if (!updated) throw new AppError('No submitted score found for that evaluator and criterion', 404)

  await writeAudit({
    userId: actor.id,
    projectId: String(session.projectId),
    action: 'Unlocked defense score',
    entityType: 'DefenseScore',
    entityId: String(session._id),
    details: { evaluatorId, criterionId },
  })

  await publish(String(session._id))
  return stateForSession(String(session._id), actor)
}
