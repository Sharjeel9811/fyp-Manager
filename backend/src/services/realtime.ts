import { Server as HttpServer } from 'http'
import { Server, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import { User } from '../models'

interface AuthenticatedSocket extends Socket {
  userId?: string
  role?: string
}

let io: Server | null = null
const onlineUsers = new Map<string, Set<string>>() // userId -> set of socket ids
const typingUsers = new Map<string, Map<string, string>>() // room/projectId -> userId -> display name
const chatRooms = new Map<string, Array<any>>() // roomId -> messages (in-memory for real-time)

export function initRealtime(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: [process.env.FRONTEND_URL || 'http://localhost:5173', 'http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
    },
  })

  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = (socket.handshake.auth?.token as string) || (socket.handshake.headers.authorization?.replace('Bearer ', ''))
      if (!token) return next(new Error('unauthorized'))
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string }
      const user: any = await User.findById(decoded.id).select('_id role isActive tokenVersion')
      if (!user || !user.isActive) return next(new Error('unauthorized'))
      socket.userId = String(user._id)
      socket.role = user.role
      next()
    } catch (e) {
      next(new Error('unauthorized'))
    }
  })

  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.userId!
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set())
    onlineUsers.get(userId)!.add(socket.id)

    io?.emit('presence:update', { userId, online: true, count: getOnlineCount() })

    // Join project rooms
    socket.on('room:join', (roomId: string) => {
      if (!roomId) return
      socket.join(roomId)
      socket.emit('room:joined', { roomId })
    })

    socket.on('room:leave', (roomId: string) => {
      if (!roomId) return
      socket.leave(roomId)
    })

    // Real-time chat
    socket.on('chat:send', (payload: { roomId: string; text: string; sender?: any }) => {
      if (!payload?.roomId || !payload?.text?.trim()) return
      const msg = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        roomId: payload.roomId,
        text: payload.text.trim().slice(0, 2000),
        senderId: userId,
        sender: payload.sender || { id: userId },
        ts: Date.now(),
      }
      if (!chatRooms.has(payload.roomId)) chatRooms.set(payload.roomId, [])
      const hist = chatRooms.get(payload.roomId)!
      hist.push(msg)
      if (hist.length > 200) hist.shift()
      io?.to(payload.roomId).emit('chat:message', msg)
    })

    socket.on('chat:history', (roomId: string) => {
      if (!roomId) return
      socket.emit('chat:history', { roomId, messages: chatRooms.get(roomId) || [] })
    })

    // Typing indicators
    socket.on('typing:start', (payload: { roomId: string; name: string }) => {
      if (!payload?.roomId) return
      if (!typingUsers.has(payload.roomId)) typingUsers.set(payload.roomId, new Map())
      typingUsers.get(payload.roomId)!.set(userId, payload.name || 'Someone')
      io?.to(payload.roomId).emit('typing:update', { roomId: payload.roomId, users: Array.from(typingUsers.get(payload.roomId)!.values()) })
    })

    socket.on('typing:stop', (payload: { roomId: string }) => {
      if (!payload?.roomId) return
      const room = typingUsers.get(payload.roomId)
      if (room) room.delete(userId)
      io?.to(payload.roomId).emit('typing:update', { roomId: payload.roomId, users: room ? Array.from(room.values()) : [] })
    })

    // Live activity ping
    socket.on('activity:ping', () => {
      socket.emit('activity:pong', { ts: Date.now(), online: getOnlineCount() })
    })

    socket.on('disconnect', () => {
      const set = onlineUsers.get(userId)
      set?.delete(socket.id)
      if (set && set.size === 0) {
        onlineUsers.delete(userId)
        io?.emit('presence:update', { userId, online: false, count: getOnlineCount() })
      }
      // Clear typing
      typingUsers.forEach((room, roomId) => {
        if (room.has(userId)) {
          room.delete(userId)
          io?.to(roomId).emit('typing:update', { roomId, users: Array.from(room.values()) })
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
  return onlineUsers.size
}

export function getOnlineUsers() {
  return Array.from(onlineUsers.keys())
}

export function isUserOnline(userId: string) {
  const set = onlineUsers.get(String(userId))
  return !!(set && set.size > 0)
}

export function emitToUser(userId: string, event: string, payload: any) {
  if (!io) return
  const set = onlineUsers.get(String(userId))
  if (!set) return
  set.forEach((socketId) => {
    io?.to(socketId).emit(event, payload)
  })
}

export function broadcastActivity(payload: any) {
  if (!io) return
  io.emit('activity:feed', { ...payload, ts: Date.now(), id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` })
}

export function broadcastToRole(role: string, event: string, payload: any) {
  if (!io) return
  io.emit(event, payload)
}
