import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from './AuthContext'
import { tokenStore } from '@/lib/api'

interface ActivityItem {
  id: string
  type: string
  message: string
  meta?: any
  by?: string
  ts: number
}

interface RealtimeContextValue {
  socket: Socket | null
  connected: boolean
  onlineCount: number
  activityFeed: ActivityItem[]
  onlineUsers: Set<string>
  joinRoom: (roomId: string) => void
  leaveRoom: (roomId: string) => void
  sendChat: (roomId: string, text: string) => void
  getChatHistory: (roomId: string) => void
  startTyping: (roomId: string, name: string) => void
  stopTyping: (roomId: string) => void
  clearFeed: () => void
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null)

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'

// VITE_API_URL may include the API path (e.g. https://api.example.com/api/v1).
// Socket.IO needs the bare origin, otherwise the path is treated as a namespace.
const SOCKET_BASE = (() => {
  try {
    return new URL(API_BASE).origin
  } catch {
    return API_BASE
  }
})()

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [onlineCount, setOnlineCount] = useState(0)
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([])
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      setConnected(false)
      setOnlineCount(0)
      setOnlineUsers(new Set())
      return
    }

    const token = tokenStore.get()
    const socket = io(SOCKET_BASE, {
      auth: { token },
      transports: ['websocket', 'polling'],
    })
    socketRef.current = socket

    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))

    socket.on('presence:update', (payload: any) => {
      if (typeof payload?.count === 'number') setOnlineCount(payload.count)
      if (payload?.userId) {
        setOnlineUsers((prev) => {
          const next = new Set(prev)
          if (payload.online) next.add(payload.userId)
          else next.delete(payload.userId)
          return next
        })
      }
    })

    socket.on('activity:feed', (item: ActivityItem) => {
      setActivityFeed((prev) => [item, ...prev].slice(0, 50))
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [user?.id])

  const value = useMemo<RealtimeContextValue>(
    () => ({
      socket: socketRef.current,
      connected,
      onlineCount,
      activityFeed,
      onlineUsers,
      joinRoom: (roomId: string) => socketRef.current?.emit('room:join', roomId),
      leaveRoom: (roomId: string) => socketRef.current?.emit('room:leave', roomId),
      sendChat: (roomId: string, text: string) => socketRef.current?.emit('chat:send', { roomId, text, sender: user }),
      getChatHistory: (roomId: string) => socketRef.current?.emit('chat:history', roomId),
      startTyping: (roomId: string, name: string) => socketRef.current?.emit('typing:start', { roomId, name }),
      stopTyping: (roomId: string) => socketRef.current?.emit('typing:stop', { roomId }),
      clearFeed: () => setActivityFeed([]),
    }),
    [connected, onlineCount, activityFeed, onlineUsers, user]
  )

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext)
  if (!ctx) throw new Error('useRealtime must be used inside RealtimeProvider')
  return ctx
}
