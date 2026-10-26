import { Server as HttpServer } from 'http'
import { Server, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import {
  User,
  StudentProfile,
  SupervisorProfile,
  ProjectMember,
  SupervisorAssignment,
} from '../models'

type Role = 'STUDENT' | 'SUPERVISOR' | 'ADMIN'

interface AuthenticatedSocket extends Socket {
  userId?: string
  role?: Role
  displayName?: string
}

interface PresenceEntry {
  sockets: Set<string>
  role: Role
  name: string
}

interface ChatMessage {
  id: string
  roomId: string
  text: string
  senderId: string
  sender: any
  ts: number
}

let io: Server | null = null

/** userId -> live sockets + identity (one user may have several tabs) */
const presence = new Map<string, PresenceEntry>()
/** projectId -> userId -> display name */
const typingUsers = new Map<string, Map<string, string>>()
/** projectId -> last 200 messages (in-memory, per server instance) */
const chatRooms = new Map<string, Array<ChatMessage>>()

/** Short-lived caches so authorization checks stay cheap on hot paths. */
const roomAccessCache = new Map<string, { allowed: boolean; expires: number }>()
const projectAudienceCache = new Map<string, { ids: string[]; expires: number }>()
const CACHE_TTL = 60_000
const MAX_CACHE_ENTRIES = 5_000

const OBJECT_ID = /^[a-f\d]{24}$/i

export function isObjectId(value: unknown): boolean {
  return typeof value === 'string' && OBJECT_ID.test(value)
}

/**
 * Allowed browser origins. FRONTEND_URL may hold a comma separated list so the
 * same deployment can serve a custom domain plus the vercel.app alias.
 */
export function allowedOrigins(): string[] {
  const configured = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  const dev = ['http://localhost:5173', 'http://127.0.0.1:5173']
  return Array.from(new Set([...configured, ...dev]))
}

function cacheSet<T>(cache: Map<string, T>, key: string, value: T) {
  if (cache.size >= MAX_CACHE_ENTRIES) cache.clear()
  cache.set(key, value)
}

/** Can this user see/participate in this project's room? */
async function canAccessProject(userId: string, role: Role, projectId: string): Promise<boolean> {
  if (role === 'ADMIN') return true

  const key = `${userId}:${projectId}`
  const cached = roomAccessCache.get(key)
  if (cached && cached.expires > Date.now()) return cached.allowed

  let allowed = false
  try {
    if (role === 'STUDENT') {
      const profile: any = await StudentProfile.findOne({ userId }).select('_id').lean()
      if (profile) {
        allowed = !!(await ProjectMember.exists({ projectId, studentId: profile._id }))
      }
    } else if (role === 'SUPERVISOR') {
      const profile: any = await SupervisorProfile.findOne({ userId }).select('_id').lean()
      if (profile) {
        allowed = !!(await SupervisorAssignment.exists({ projectId, supervisorId: profile._id }))
      }
    }
  } catch (err) {
    console.error('[realtime] project access check failed:', (err as Error).message)
    return false
  }

  cacheSet(roomAccessCache, key, { allowed, expires: Date.now() + CACHE_TTL })
  return allowed
}

/** Everyone who is legitimately part of a project: students/team + assigned supervisor. */
async function getProjectAudience(projectId: string): Promise<string[]> {
  const cached = projectAudienceCache.get(projectId)
  if (cached && cached.expires > Date.now()) return cached.ids

  const [members, assignment] = await Promise.all([
    ProjectMember.find({ projectId }).select('studentId').lean(),
    SupervisorAssignment.findOne({ projectId }).select('supervisorId').lean(),
  ])

  const profileIds = (members as any[]).map((m) => m.studentId)
  const profiles: any[] = profileIds.length
    ? await StudentProfile.find({ _id: { $in: profileIds } }).select('userId').lean()
    : []

  const ids = profiles.map((p) => String(p.userId))

  if (assignment) {
    const supervisor: any = await SupervisorProfile.findById((assignment as any).supervisorId)
      .select('userId')
      .lean()
    if (supervisor) ids.push(String(supervisor.userId))
  }

  const unique = Array.from(new Set(ids))
  cacheSet(projectAudienceCache, projectId, { ids: unique, expires: Date.now() + CACHE_TTL })
  return unique
}

function presenceList() {
  return Array.from(presence.entries()).map(([userId, entry]) => ({
    userId,
    role: entry.role,
    name: entry.name,
    connections: entry.sockets.size,
  }))
}

function broadcastPresence(userId: string, online: boolean) {
  if (!io) return
  const entry = presence.get(userId)
  io.emit('presence:update', {
    userId,
    role: entry?.role,
    name: entry?.name,
    online,
    count: presence.size,
  })
}

/** Escape hatch used when credentials change: kill stale sockets for that user. */
export function disconnectUser(userId: string) {
  if (!io) return
  const entry = presence.get(String(userId))
  if (!entry) return
  entry.sockets.forEach((socketId) => {
    io?.sockets.sockets.get(socketId)?.disconnect(true)
  })
}

export function initRealtime(httpServer: HttpServer) {
  io = new Server(httpServer, {
    path: '/socket.io',
    cors: {
      origin: allowedOrigins(),
      credentials: true,
    },
    pingInterval: 20_000,
    pingTimeout: 25_000,
    maxHttpBufferSize: 1_000_000,
  })

  // ---- Handshake: same rules as the REST `authenticate` middleware ----
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string) ||
        socket.handshake.headers.authorization?.replace('Bearer ', '')

      if (!token) return next(new Error('unauthorized'))

      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
        id: string
        role?: string
        tokenVersion?: number
      }

      const user: any = await User.findById(decoded.id).select(
        '_id role firstName lastName isActive tokenVersion'
      )

      if (!user || !user.isActive) return next(new Error('unauthorized'))
      if ((decoded.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
        return next(new Error('session-expired'))
      }

      socket.userId = String(user._id)
      socket.role = user.role
      socket.displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User'
      next()
    } catch {
      next(new Error('unauthorized'))
    }
  })

  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.userId!
    const role = socket.role!

    socket.join(`user:${userId}`)
    socket.join(`role:${role}`)

    const entry = presence.get(userId) ?? { sockets: new Set<string>(), role, name: socket.displayName! }
    entry.sockets.add(socket.id)
    entry.role = role
    entry.name = socket.displayName!
    presence.set(userId, entry)

    // Snapshot first (so a fresh client knows who is already online), then announce.
    socket.emit('presence:state', { self: userId, users: presenceList(), count: presence.size })
    broadcastPresence(userId, true)

    socket.on('error', (err) => {
      console.error('[realtime] socket error:', (err as Error)?.message)
    })

    // ---- Project rooms (authorized) ----
    socket.on('room:join', async (roomId: unknown) => {
      try {
        if (!isObjectId(roomId)) {
          return socket.emit('room:denied', { roomId, reason: 'invalid-room' })
        }
        const projectId = String(roomId)
        const allowed = await canAccessProject(userId, role, projectId)
        if (!allowed) {
          return socket.emit('room:denied', { roomId: projectId, reason: 'forbidden' })
        }
        socket.join(`project:${projectId}`)
        socket.emit('room:joined', { roomId: projectId })
      } catch (err) {
        console.error('[realtime] room:join failed:', (err as Error).message)
        socket.emit('room:denied', { roomId, reason: 'error' })
      }
    })

    socket.on('room:leave', (roomId: unknown) => {
      if (!isObjectId(roomId)) return
      socket.leave(`project:${String(roomId)}`)
    })

    // ---- Chat (only for rooms the socket was authorized to join) ----
    const inRoom = (projectId: string) => socket.rooms.has(`project:${projectId}`)

    socket.on('chat:send', (payload: any) => {
      try {
        const projectId = String(payload?.roomId || '')
        const text = String(payload?.text || '').trim().slice(0, 2000)
        if (!isObjectId(projectId) || !text || !inRoom(projectId)) return

        const message: ChatMessage = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          roomId: projectId,
          text,
          senderId: userId,
          sender: {
            id: userId,
            name: socket.displayName,
            role,
          },
          ts: Date.now(),
        }

        if (!chatRooms.has(projectId)) chatRooms.set(projectId, [])
        const history = chatRooms.get(projectId)!
        history.push(message)
        if (history.length > 200) history.shift()

        io?.to(`project:${projectId}`).emit('chat:message', message)
      } catch (err) {
        console.error('[realtime] chat:send failed:', (err as Error).message)
      }
    })

    socket.on('chat:history', (roomId: unknown) => {
      const projectId = String(roomId || '')
      if (!isObjectId(projectId) || !inRoom(projectId)) return
      socket.emit('chat:history', { roomId: projectId, messages: chatRooms.get(projectId) || [] })
    })

    // ---- Typing indicators ----
    socket.on('typing:start', (payload: any) => {
      const projectId = String(payload?.roomId || '')
      if (!isObjectId(projectId) || !inRoom(projectId)) return
      if (!typingUsers.has(projectId)) typingUsers.set(projectId, new Map())
      typingUsers
        .get(projectId)!
        .set(userId, String(payload?.name || socket.displayName || 'Someone').slice(0, 40))
      io?.to(`project:${projectId}`).emit('typing:update', {
        roomId: projectId,
        users: Array.from(typingUsers.get(projectId)!.values()),
      })
    })

    socket.on('typing:stop', (payload: any) => {
      const projectId = String(payload?.roomId || '')
      if (!isObjectId(projectId)) return
      const room = typingUsers.get(projectId)
      if (room) room.delete(userId)
      io?.to(`project:${projectId}`).emit('typing:update', {
        roomId: projectId,
        users: room ? Array.from(room.values()) : [],
      })
    })

    // ---- Heartbeat used by the dashboard to prove the pipe is alive ----
    socket.on('activity:ping', () => {
      socket.emit('activity:pong', { ts: Date.now(), online: presence.size })
    })

    socket.on('disconnect', () => {
      const current = presence.get(userId)
      if (current) {
        current.sockets.delete(socket.id)
        if (current.sockets.size === 0) {
          presence.delete(userId)
          broadcastPresence(userId, false)
        }
      }

      typingUsers.forEach((room, projectId) => {
        if (room.delete(userId)) {
          io?.to(`project:${projectId}`).emit('typing:update', {
            roomId: projectId,
            users: Array.from(room.values()),
          })
        }
      })
    })
  })

  return io
}

export function getIO() {
  return io
}

export function getOnlineCount() {
  return presence.size
}

export function getOnlineUsers() {
  return Array.from(presence.keys())
}

export function getOnlineSessions() {
  return presenceList()
}

export function isUserOnline(userId: string) {
  const entry = presence.get(String(userId))
  return !!(entry && entry.sockets.size > 0)
}

export function emitToUser(userId: string, event: string, payload: any) {
  if (!io) return
  io.to(`user:${String(userId)}`).emit(event, payload)
}

/** Broadcast to a project room (only members who joined via `room:join`). */
export function emitToProject(projectId: string, event: string, payload: any) {
  if (!io) return
  io.to(`project:${String(projectId)}`).emit(event, payload)
}

/**
 * Fan out one activity item to the people allowed to see it:
 *  - all supervisors + admins (oversight)
 *  - the project's students/team and its assigned supervisor (when projectId is known)
 *  - the actor themselves
 * Socket.IO de-duplicates sockets that belong to several of these rooms, so a
 * supervisor who is also the project's supervisor still receives exactly one copy.
 */
export async function broadcastActivity(payload: any, projectId?: string) {
  if (!io) return null

  const item = {
    ...payload,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
  }

  const targetProject = projectId || payload?.meta?.projectId
  const rooms = ['role:SUPERVISOR', 'role:ADMIN']

  if (isObjectId(targetProject)) {
    try {
      const audience = await getProjectAudience(String(targetProject))
      audience.forEach((id) => rooms.push(`user:${id}`))
    } catch (err) {
      // The activity was already persisted; a failed audience lookup must not
      // stop supervisors/admins from seeing it.
      console.error('[realtime] audience lookup failed:', (err as Error).message)
    }
  }

  if (payload?.byUserId) rooms.push(`user:${String(payload.byUserId)}`)

  const unique = Array.from(new Set(rooms))
  const [first, ...rest] = unique
  if (!first) return item

  let emitter = io.to(first)
  rest.forEach((room) => {
    emitter = emitter.to(room)
  })
  emitter.emit('activity:feed', item)

  return item
}

export function broadcastToRole(role: string, event: string, payload: any) {
  if (!io) return
  io.to(`role:${role}`).emit(event, payload)
}
