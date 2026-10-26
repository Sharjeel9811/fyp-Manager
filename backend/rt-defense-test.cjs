/**
 * Live defense integration test.
 *
 * Run from backend/ with the API already running:
 *   node rt-defense-test.cjs
 *
 * It exercises REST control, panel authorization, score locking, the socket
 * broadcasts, and result release, then restores the demo data it touched.
 */
require('dotenv').config()
const path = require('path')
const mongoose = require('mongoose')
const socketClient = (() => {
  try {
    return require('socket.io-client')
  } catch {
    return require(path.join(__dirname, '..', 'frontend', 'node_modules', 'socket.io-client'))
  }
})()
const { io } = socketClient
const {
  DefenseScore,
  DefenseSession,
  Evaluation,
  Notification,
} = require('./dist/models')

const BASE = process.env.RT_BASE || `http://localhost:${process.env.PORT || 5000}`
const API = BASE + '/api/v1'
const PROJECT = '6adcde8b59403c60903541fa' // AI-Powered Chatbot (student@fypmanager.com)

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ->  ' + detail : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitFor(fn, ms = 6000) {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    if (fn()) return true
    await sleep(50)
  }
  return false
}

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, json: await res.json().catch(() => null) }
}

function newSocket(token) {
  const s = io(BASE, {
    auth: token ? { token } : {},
    transports: ['websocket'],
    reconnection: false,
    timeout: 8000,
    forceNew: true,
  })
  const rec = { s, states: [], details: [], released: [], scored: [], rooms: [], errors: [] }
  s.on('defense:state', (e) => rec.states.push(e))
  s.on('defense:detail', (e) => rec.details.push(e))
  s.on('defense:released', (e) => rec.released.push(e))
  s.on('defense:scored', (e) => rec.scored.push(e))
  s.on('room:joined', (e) => rec.rooms.push({ ...e, ok: true }))
  s.on('room:denied', (e) => rec.rooms.push({ ...e, ok: false }))
  s.on('connect_error', (e) => rec.errors.push(e.message))
  return rec
}

const waitConnect = (rec, ms = 9000) =>
  new Promise((resolve) => {
    if (rec.s.connected) return resolve(true)
    const timer = setTimeout(() => resolve(false), ms)
    rec.s.once('connect', () => {
      clearTimeout(timer)
      resolve(true)
    })
    rec.s.once('connect_error', () => {
      clearTimeout(timer)
      resolve(false)
    })
  })

const state = { backups: null }

;(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 })

  const sessionsBackup = await DefenseSession.find({ projectId: PROJECT }).lean()
  const scoresBackup = await DefenseScore.find({ projectId: PROJECT }).lean()
  const evaluationsBackup = await Evaluation.find({ projectId: PROJECT }).lean()
  const notificationsBackup = await Notification.find({ type: 'defense' }).lean()
  state.backups = { sessionsBackup, scoresBackup, evaluationsBackup, notificationsBackup }

  const sockets = []
  let restored = false
  const cleanup = async () => {
    if (restored) return
    restored = true
    sockets.forEach((rec) => rec.s.disconnect())
    await DefenseScore.deleteMany({ projectId: PROJECT })
    await DefenseSession.deleteMany({ projectId: PROJECT })
    await Evaluation.deleteMany({ projectId: PROJECT })
    if (sessionsBackup.length) await DefenseSession.insertMany(sessionsBackup)
    if (scoresBackup.length) await DefenseScore.insertMany(scoresBackup)
    if (evaluationsBackup.length) await Evaluation.insertMany(evaluationsBackup)
    await Notification.deleteMany({ type: 'defense' })
    if (notificationsBackup.length) await Notification.insertMany(notificationsBackup)
    await mongoose.disconnect()
  }

  await DefenseScore.deleteMany({ projectId: PROJECT })
  await DefenseSession.deleteMany({ projectId: PROJECT })
  await Evaluation.deleteMany({ projectId: PROJECT })
  await Notification.deleteMany({ type: 'defense' })

  const login = async (email) => {
    const r = await api('/auth/login', { method: 'POST', body: { email, password: 'password123' } })
    return { token: r.json && r.json.token, user: r.json && r.json.user, status: r.status }
  }

  const student = await login('student@fypmanager.com')
  const otherStudent = await login('bilal.ahmed@uni.edu')
  const supervisor = await login('supervisor@fypmanager.com') // John Smith, assigned to project
  const panelist = await login('ayesha.khan@uni.edu') // panel name only, not assigned
  const admin = await login('admin@fypmanager.com')

  check(
    'REST logins (student, unrelated student, supervisor, panelist, admin)',
    !!(student.token && otherStudent.token && supervisor.token && panelist.token && admin.token)
  )

  // ---------- Read access ----------
  const initial = await api(`/defense/projects/${PROJECT}`, { token: student.token })
  check(
    'student can read own project defense state (no session yet)',
    initial.status === 200 && initial.json.session === null && initial.json.permissions.canEvaluate === false,
    `status ${initial.status}`
  )

  const outsider = await api(`/defense/projects/${PROJECT}`, { token: otherStudent.token })
  check('unrelated student cannot read another project defense', outsider.status === 403, `status ${outsider.status}`)

  const studentStart = await api(`/defense/projects/${PROJECT}/start`, {
    method: 'POST',
    token: student.token,
    body: { durationMinutes: 10 },
  })
  check('student cannot start a defense', studentStart.status === 403, `status ${studentStart.status}`)

  // ---------- Sockets + start ----------
  const studentSock = newSocket(student.token)
  const outsiderSock = newSocket(otherStudent.token)
  const supervisorSock = newSocket(supervisor.token)
  const adminSock = newSocket(admin.token)
  sockets.push(studentSock, outsiderSock, supervisorSock, adminSock)

  const connected = await Promise.all(
    [studentSock, outsiderSock, supervisorSock, adminSock].map((rec) => waitConnect(rec))
  )
  check('four sockets connect with JWT handshake', connected.every(Boolean))

  studentSock.s.emit('room:join', PROJECT)
  outsiderSock.s.emit('room:join', PROJECT)
  await waitFor(() => studentSock.rooms.length > 0 && outsiderSock.rooms.length > 0)

  check(
    'project student joins the defense room, outsider is denied',
    studentSock.rooms.some((r) => r.ok) && outsiderSock.rooms.some((r) => !r.ok),
    JSON.stringify(outsiderSock.rooms[0] || {})
  )

  const started = await api(`/defense/projects/${PROJECT}/start`, {
    method: 'POST',
    token: supervisor.token,
    body: { durationMinutes: 10 },
  })
  const sessionId = started.json && started.json.session && started.json.session.id
  check(
    'assigned supervisor starts a live defense',
    started.status === 201 && !!sessionId && started.json.session.status === 'LIVE',
    `status ${started.status}`
  )
  check(
    'rubric snapshot has five weighted criteria',
    started.json.session.criteria.length === 5 && started.json.session.criteria[0].maxScore === 10,
    `${started.json.session && started.json.session.criteria.length} criteria`
  )
  check(
    'timer starts from a server timestamp',
    started.json.session.timer.running === true &&
      started.json.session.timer.remainingSeconds > 500 &&
      started.json.session.timer.serverNow > 0,
    `${started.json.session.timer.remainingSeconds}s`
  )

  const panelistView = await api(`/defense/projects/${PROJECT}`, { token: panelist.token })
  check(
    'a supervisor named on the schedule panel can evaluate without being assigned',
    panelistView.status === 200 && panelistView.json.permissions.canEvaluate === true,
    `status ${panelistView.status}`
  )
  check(
    'panel snapshot includes the assigned supervisor plus named panellists',
    started.json.progress.expectedEvaluators === 4,
    `expected ${started.json.progress.expectedEvaluators}`
  )

  await waitFor(() => studentSock.states.length > 0 && supervisorSock.details.length > 0)
  const publicAfterStart = studentSock.states[studentSock.states.length - 1]
  const detailAfterStart = supervisorSock.details[supervisorSock.details.length - 1]

  check(
    'student socket receives the live state',
    !!publicAfterStart && publicAfterStart.session.id === sessionId && publicAfterStart.session.status === 'LIVE'
  )
  check(
    'student receives no aggregate before release',
    !!publicAfterStart &&
      publicAfterStart.aggregate === null &&
      !JSON.stringify(publicAfterStart).includes('evaluatorName'),
    `aggregate=${JSON.stringify(publicAfterStart && publicAfterStart.aggregate)}`
  )
  check(
    'supervisor gets the detailed panel state',
    !!detailAfterStart && detailAfterStart.aggregate !== null && detailAfterStart.permissions.canEvaluate === true
  )

  // ---------- Scoring ----------
  const criterionId = started.json.session.criteria[0].criterionId
  const studentScore = await api(`/defense/sessions/${sessionId}/score`, {
    method: 'POST',
    token: student.token,
    body: { criterionId, score: 5 },
  })
  check('student cannot submit a score', studentScore.status === 403, `status ${studentScore.status}`)

  const adminScore = await api(`/defense/sessions/${sessionId}/score`, {
    method: 'POST',
    token: admin.token,
    body: { criterionId, score: 5 },
  })
  check(
    'admin coordinates the session but cannot act as an evaluator',
    adminScore.status === 403,
    `status ${adminScore.status}`
  )

  const tooHigh = await api(`/defense/sessions/${sessionId}/score`, {
    method: 'POST',
    token: supervisor.token,
    body: { criterionId, score: 11 },
  })
  check('score above the criterion maximum is rejected', tooHigh.status === 400, `status ${tooHigh.status}`)

  const firstScore = await api(`/defense/sessions/${sessionId}/score`, {
    method: 'POST',
    token: supervisor.token,
    body: { criterionId, score: 8, comment: 'Clear problem statement.' },
  })
  const firstRow = firstScore.json && firstScore.json.aggregate && firstScore.json.aggregate.rows[0]
  check(
    'supervisor score is accepted and locks',
    firstScore.status === 200 &&
      firstRow.average === 8 &&
      firstScore.json.myScores.some((s) => s.criterionId === criterionId && s.submitted),
    `status ${firstScore.status}`
  )

  const repeat = await api(`/defense/sessions/${sessionId}/score`, {
    method: 'POST',
    token: supervisor.token,
    body: { criterionId, score: 9 },
  })
  check('a submitted score is locked against edits', repeat.status === 409, `status ${repeat.status}`)

  const panelScore = await api(`/defense/sessions/${sessionId}/score`, {
    method: 'POST',
    token: panelist.token,
    body: { criterionId, score: 6, comment: 'Could sharpen the research question.' },
  })
  const panelRow = panelScore.json && panelScore.json.aggregate && panelScore.json.aggregate.rows[0]
  check(
    'second panellist score updates the live aggregate',
    panelScore.status === 200 && panelRow.average === 7 && panelRow.submittedCount === 2,
    `average ${panelRow && panelRow.average}`
  )

  await waitFor(() => {
    const latest = studentSock.states[studentSock.states.length - 1]
    return latest && latest.progress.submittedEvaluators === 2 && latest.aggregate === null
  })
  const publicAfterScores = studentSock.states[studentSock.states.length - 1]
  check(
    'student still sees only submission progress, never scores',
    !!publicAfterScores &&
      publicAfterScores.aggregate === null &&
      publicAfterScores.progress.submittedEvaluators === 2
  )
  check(
    'panelists receive a live scored hint',
    supervisorSock.scored.some((e) => e.evaluatorName === 'Ayesha Khan' && e.criterionId === criterionId)
  )

  // ---------- Coordination ----------
  const adminState = await api(`/defense/projects/${PROJECT}`, { token: admin.token })
  check(
    'admin sees panel detail and aggregate',
    adminState.status === 200 &&
      adminState.json.permissions.canControl === true &&
      adminState.json.aggregate.total === 7,
    `status ${adminState.status}`
  )

  const advanced = await api(`/defense/sessions/${sessionId}/next`, {
    method: 'POST',
    token: admin.token,
  })
  check(
    'admin advances the current criterion',
    advanced.status === 200 && advanced.json.session.currentCriterionIndex === 1,
    `index ${advanced.json.session && advanced.json.session.currentCriterionIndex}`
  )

  await waitFor(() => {
    const latest = studentSock.states[studentSock.states.length - 1]
    return latest && latest.session.currentCriterionIndex === 1
  })
  check(
    'student sees the criterion change live',
    studentSock.states[studentSock.states.length - 1].session.currentCriterionIndex === 1
  )

  const johnId =
    adminState.json.aggregate.evaluators.find((e) => e.name === 'John Smith')?.evaluatorId || ''
  const unlocked = await api(`/defense/sessions/${sessionId}/unlock`, {
    method: 'POST',
    token: admin.token,
    body: { evaluatorId: johnId, criterionId },
  })
  check(
    'admin can unlock a locked score while the defense is live',
    unlocked.status === 200 &&
      (unlocked.json.aggregate.rows[0].scores || []).filter((s) => s.evaluatorId === johnId).length === 0,
    `status ${unlocked.status}`
  )

  const rescored = await api(`/defense/sessions/${sessionId}/score`, {
    method: 'POST',
    token: supervisor.token,
    body: { criterionId, score: 9, comment: 'Corrected after panel discussion.' },
  })
  check(
    'evaluator can re-submit after an unlock',
    rescored.status === 200 && rescored.json.aggregate.rows[0].average === 7.5,
    `average ${rescored.json.aggregate && rescored.json.aggregate.rows[0].average}`
  )

  const ended = await api(`/defense/sessions/${sessionId}/end`, {
    method: 'POST',
    token: supervisor.token,
  })
  check(
    'panel lead ends the defense',
    ended.status === 200 && ended.json.session.status === 'COMPLETED',
    `status ${ended.status}`
  )

  const evaluationRows = await Evaluation.find({ projectId: PROJECT }).lean()
  check(
    'ending the defense writes one Evaluation row per submitting panellist',
    evaluationRows.length === 2 &&
      evaluationRows.some((e) => e.totalScore === 9) &&
      evaluationRows.some((e) => e.totalScore === 6),
    `${evaluationRows.length} rows`
  )

  const hiddenAfterEnd = await api(`/defense/projects/${PROJECT}`, { token: student.token })
  check(
    'student aggregate stays hidden after the defense ends',
    hiddenAfterEnd.status === 200 &&
      hiddenAfterEnd.json.session.status === 'COMPLETED' &&
      hiddenAfterEnd.json.session.resultsReleased === false &&
      hiddenAfterEnd.json.aggregate === null
  )

  const studentRelease = await api(`/defense/sessions/${sessionId}/release`, {
    method: 'POST',
    token: student.token,
  })
  check('student cannot release results', studentRelease.status === 403, `status ${studentRelease.status}`)

  const released = await api(`/defense/sessions/${sessionId}/release`, {
    method: 'POST',
    token: admin.token,
  })
  check(
    'admin releases the results',
    released.status === 200 &&
      released.json.session.resultsReleased === true &&
      released.json.aggregate.total === 7.5,
    `status ${released.status}`
  )

  await waitFor(() => studentSock.released.length > 0)
  const releasedPush = studentSock.released[studentSock.released.length - 1]
  check(
    'students receive the released aggregate over the socket',
    !!releasedPush && releasedPush.session.resultsReleased === true && releasedPush.aggregate.total === 7.5
  )
  check(
    'released aggregate shows averages without evaluator identities',
    !!releasedPush &&
      (releasedPush.aggregate.evaluators || []).length === 0 &&
      !JSON.stringify(releasedPush.aggregate.rows).includes('John Smith') &&
      !JSON.stringify(releasedPush.aggregate.rows).includes('evaluatorName'),
    `${(releasedPush && releasedPush.aggregate.evaluators || []).length} evaluator columns`
  )

  const studentResults = await api('/student/evaluations', { token: student.token })
  const averaged = (studentResults.json.evaluations || []).find((e) => e.criterion === 'Problem Definition')
  check(
    'student results page averages the panel per criterion',
    studentResults.status === 200 && studentResults.json.released === true && averaged && averaged.score === 7.5,
    `score ${averaged && averaged.score}`
  )

  const notification = await Notification.findOne({ type: 'defense' }).lean()
  check('release notifies the project students', !!notification)

  check(
    'unrelated student received no defense traffic',
    outsiderSock.states.length === 0 && outsiderSock.details.length === 0 && outsiderSock.released.length === 0
  )

  await cleanup()
  const passed = results.filter((r) => r.ok).length
  console.log(`\n===== ${passed}/${results.length} passed, ${results.length - passed} failed =====`)
  process.exit(passed === results.length ? 0 : 1)
})().catch(async (err) => {
  console.error('TEST CRASH:', err)
  try {
    const { DefenseScore, DefenseSession, Evaluation, Notification } = require('./dist/models')
    const backups = state.backups
    await DefenseScore.deleteMany({ projectId: '6adcde8b59403c60903541fa' })
    await DefenseSession.deleteMany({ projectId: '6adcde8b59403c60903541fa' })
    await Evaluation.deleteMany({ projectId: '6adcde8b59403c60903541fa' })
    await Notification.deleteMany({ type: 'defense' })
    if (backups) {
      if (backups.sessionsBackup.length) await DefenseSession.insertMany(backups.sessionsBackup)
      if (backups.scoresBackup.length) await DefenseScore.insertMany(backups.scoresBackup)
      if (backups.evaluationsBackup.length) await Evaluation.insertMany(backups.evaluationsBackup)
      if (backups.notificationsBackup.length) await Notification.insertMany(backups.notificationsBackup)
    }
    await mongoose.disconnect()
  } catch (cleanupError) {
    console.error('CLEANUP FAILED:', cleanupError.message)
  }
  process.exit(1)
})
