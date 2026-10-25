/**
 * Real-time integration test for the FYP Manager Socket.IO layer.
 * Run from backend/:  node rt-test.cjs
 * Requires the API to be running (default http://localhost:5010).
 */
require('dotenv').config()
const path = require('path')
const jwt = require('jsonwebtoken')
const mongoose = require('mongoose')
// socket.io-client lives in the frontend workspace (that is the code under test).
// Use it from there without adding a duplicate dependency to the backend.
const socketClient = (() => {
  try {
    return require('socket.io-client')
  } catch {
    return require(path.join(__dirname, '..', 'frontend', 'node_modules', 'socket.io-client'))
  }
})()
const { io } = socketClient
const { Proposal, Project } = require('./dist/models')

const BASE = process.env.RT_BASE || `http://localhost:${process.env.PORT || 5000}`
const API = BASE + '/api/v1'

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ->  ' + detail : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Poll until `fn` is truthy (network + DB round-trips are not always < 700ms). */
async function waitFor(fn, ms = 4000) {
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
  const rec = { s, activities: [], presence: [], chat: [], rooms: [], errors: [], state: null }
  s.on('activity:feed', (e) => rec.activities.push(e))
  s.on('presence:update', (e) => rec.presence.push(e))
  s.on('chat:message', (e) => rec.chat.push(e))
  s.on('room:joined', (e) => rec.rooms.push({ ...e, ok: true }))
  s.on('room:denied', (e) => rec.rooms.push({ ...e, ok: false }))
  s.on('presence:state', (e) => (rec.state = e))
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

;(async () => {
  // The harness talks to the API over HTTP, but it also snapshots/restores demo
  // data directly, so it needs its own (read/write) database connection.
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 })

  // ---------- 0. REST login ----------
  const login = async (email) => {
    const r = await api('/auth/login', { method: 'POST', body: { email, password: 'password123' } })
    return { token: r.json && r.json.token, user: r.json && r.json.user, status: r.status }
  }

  const student = await login('student@fypmanager.com')
  const student2 = await login('bilal.ahmed@uni.edu')
  const supervisor = await login('supervisor@fypmanager.com')
  const admin = await login('admin@fypmanager.com')

  check('REST login student', !!student.token, `status ${student.status}`)
  check('REST login second student', !!student2.token, `status ${student2.status}`)
  check('REST login supervisor', !!supervisor.token, `status ${supervisor.status}`)
  check('REST login admin', !!admin.token, `status ${admin.status}`)

  const studentProject = '6adcde8b59403c60903541fa' // AI-Powered Chatbot
  const otherProject = '6adcde8c59403c6090354214' // Smart Campus Energy

  // Backup the proposal + project status so the test leaves the demo data untouched.
  const proposalBackup = await Proposal.findOne({ projectId: studentProject }).lean()
  const projectBackup = await Project.findById(studentProject).select('status').lean()

  const sockets = []
  const open = async (token) => {
    const rec = newSocket(token)
    sockets.push(rec)
    const ok = await waitConnect(rec)
    return { rec, ok }
  }

  try {
    // ---------- 1. Supervisor connects ----------
    const sup = await open(supervisor.token)
    check('supervisor socket connects with JWT', sup.ok)
    await sleep(300)
    check(
      'supervisor receives presence:state snapshot',
      !!sup.rec.state && Array.isArray(sup.rec.state.users),
      JSON.stringify(sup.rec.state && { count: sup.rec.state.count, users: sup.rec.state.users.length })
    )

    // ---------- 2. Student connects -> supervisor sees presence ----------
    const stu = await open(student.token)
    check('student socket connects with JWT', stu.ok)
    const sawOnline = await waitFor(() =>
      sup.rec.presence.some((p) => p.userId === student.user.id && p.online === true)
    )
    const onlineEvent = sup.rec.presence.find((p) => p.userId === student.user.id && p.online === true)
    check('supervisor sees student come online (presence)', sawOnline, JSON.stringify(onlineEvent))

    const stu2 = await open(student2.token)
    check('second student socket connects', stu2.ok)

    // ---------- 3. Student action -> supervisor feed, no refresh ----------
    sup.rec.activities.length = 0
    stu.rec.activities.length = 0
    stu2.rec.activities.length = 0

    const save = await api('/student/proposal', {
      method: 'PUT',
      token: student.token,
      body: { title: 'AI-Powered Chatbot for University Help Desk', abstract: 'Live propagation test', submit: false },
    })
    check('student proposal draft saved (REST)', save.status === 200 && save.json?.success === true)

    await waitFor(() => sup.rec.activities.length > 0, 6000)
    // give a duplicate (if any) time to arrive before asserting
    await sleep(400)

    const supActivity = sup.rec.activities.filter((a) => /proposal/i.test(a.type))
    check(
      'supervisor receives activity:feed without refresh',
      supActivity.length === 1,
      supActivity[0] && supActivity[0].message
    )
    check('activity is not duplicated', sup.rec.activities.length === 1, `received ${sup.rec.activities.length}`)
    check('activity has an id + timestamp', !!supActivity[0]?.id && typeof supActivity[0]?.ts === 'number')

    const ownActivity = stu.rec.activities.filter((a) => /proposal/i.test(a.type))
    check('student receives their own project activity', ownActivity.length === 1)

    const leaked = stu2.rec.activities.filter((a) => /proposal/i.test(a.type))
    check('other student does NOT receive unrelated activity', leaked.length === 0, `leaked ${leaked.length}`)

    // ---------- 4. Room authorization ----------
    stu.rec.rooms.length = 0
    stu.rec.s.emit('room:join', studentProject)
    await waitFor(() => stu.rec.rooms.length > 0)
    check(
      'student can join own project room',
      stu.rec.rooms.some((r) => r.ok && r.roomId === studentProject),
      JSON.stringify(stu.rec.rooms)
    )

    stu.rec.rooms.length = 0
    stu.rec.s.emit('room:join', otherProject)
    await waitFor(() => stu.rec.rooms.length > 0)
    check(
      'student is denied another project room',
      stu.rec.rooms.some((r) => !r.ok && r.reason === 'forbidden'),
      JSON.stringify(stu.rec.rooms)
    )

    sup.rec.rooms.length = 0
    sup.rec.s.emit('room:join', studentProject)
    await waitFor(() => sup.rec.rooms.length > 0)
    check('assigned supervisor can join the project room', sup.rec.rooms.some((r) => r.ok), JSON.stringify(sup.rec.rooms))

    // ---------- 5. Chat isolation ----------
    stu2.rec.chat.length = 0
    sup.rec.chat.length = 0
    stu.rec.chat.length = 0
    stu.rec.s.emit('chat:send', { roomId: studentProject, text: 'integration test message' })
    await waitFor(() => sup.rec.chat.length > 0)
    check('supervisor in room receives chat message', sup.rec.chat.some((m) => m.text === 'integration test message'))
    check('outsider student does not receive room chat', stu2.rec.chat.length === 0)

    // ---------- 6. Unauthorized connections ----------
    const anon = newSocket(null)
    sockets.push(anon)
    const anonOk = await waitConnect(anon)
    check('anonymous socket is rejected', !anonOk && anon.errors.includes('unauthorized'), anon.errors.join(','))

    const staleToken = jwt.sign(
      { id: student.user.id, role: 'STUDENT', tokenVersion: 999 },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    )
    const stale = newSocket(staleToken)
    sockets.push(stale)
    const staleOk = await waitConnect(stale)
    check('stale tokenVersion is rejected', !staleOk && stale.errors.includes('session-expired'), stale.errors.join(','))

    // ---------- 7. Multiple tabs / duplicate users ----------
    const sup2 = await open(supervisor.token)
    check('second supervisor tab connects', sup2.ok)
    await waitFor(() => !!sup2.rec.state)
    const selfCount = sup2.rec.state?.count
    check('presence counts unique users, not sockets', selfCount === 3 || selfCount === 4, `count=${selfCount}`)

    sup.rec.activities.length = 0
    sup2.rec.activities.length = 0
    await api('/student/proposal', {
      method: 'PUT',
      token: student.token,
      body: { title: 'AI-Powered Chatbot for University Help Desk', abstract: 'second tab test', submit: false },
    })
    await waitFor(() => sup.rec.activities.length > 0 && sup2.rec.activities.length > 0, 6000)
    await sleep(400)
    check('each supervisor tab receives exactly one copy', sup.rec.activities.length === 1 && sup2.rec.activities.length === 1,
      `tab1=${sup.rec.activities.length} tab2=${sup2.rec.activities.length}`)

    // ---------- 8. Disconnect / reconnect presence ----------
    stu.rec.s.disconnect()
    const sawOffline = await waitFor(() =>
      sup.rec.presence.some((p) => p.userId === student.user.id && p.online === false)
    )
    const offlineEvent = sup.rec.presence.find((p) => p.userId === student.user.id && p.online === false)
    check('supervisor sees student go offline', sawOffline, JSON.stringify(offlineEvent))

    const stuAgain = await open(student.token)
    const backOnline = await waitFor(
      () => sup.rec.presence.filter((p) => p.userId === student.user.id && p.online === true).length >= 2
    )
    check('student reconnects and presence is restored', stuAgain.ok && backOnline)

    // ---------- 9. Heartbeat ----------
    const pong = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), 3000)
      stuAgain.rec.s.once('activity:pong', (p) => {
        clearTimeout(timer)
        resolve(p)
      })
      stuAgain.rec.s.emit('activity:ping')
    })
    check('heartbeat ping/pong works', !!pong && typeof pong.online === 'number', JSON.stringify(pong))

    // ---------- 10. REST dashboards still work ----------
    const ovStudent = await api('/student/overview', { token: student.token })
    const ovSupervisor = await api('/supervisor/overview', { token: supervisor.token })
    const ovAdmin = await api('/admin/overview', { token: admin.token })
    check('student overview intact', ovStudent.status === 200 && ovStudent.json?.success === true)
    check('supervisor overview intact', ovSupervisor.status === 200 && ovSupervisor.json?.success === true)
    check('admin overview intact', ovAdmin.status === 200 && ovAdmin.json?.success === true)

    // ---------- 11. Realtime status endpoint ----------
    const statusRes = await api('/realtime/status', { token: admin.token })
    check('realtime status endpoint reports sockets', statusRes.status === 200 && statusRes.json?.online >= 1,
      `online=${statusRes.json?.online}`)

    const forbiddenPush = await api('/realtime/activity', {
      method: 'POST',
      token: student.token,
      body: { message: 'spoofed activity' },
    })
    check('students cannot push arbitrary activity', forbiddenPush.status === 403, `status ${forbiddenPush.status}`)
  } finally {
    sockets.forEach((rec) => rec.s.disconnect())

    // Restore the demo data mutated by the proposal saves.
    if (proposalBackup) {
      const { _id, ...rest } = proposalBackup
      await Proposal.updateOne({ _id }, { $set: rest })
    }
    if (projectBackup) {
      await Project.updateOne({ _id: studentProject }, { $set: { status: projectBackup.status } })
    }
    await mongoose.disconnect()

    const passed = results.filter((r) => r.ok).length
    const failed = results.length - passed
    console.log(`\n===== ${passed}/${results.length} passed, ${failed} failed =====`)
    if (failed) {
      console.log('Failing checks:')
      results.filter((r) => !r.ok).forEach((r) => console.log(' - ' + r.name))
    }
    process.exitCode = failed ? 1 : 0
  }
})().catch(async (err) => {
  console.error('TEST CRASH:', err)
  try {
    await mongoose.disconnect()
  } catch {}
  process.exitCode = 1
})
