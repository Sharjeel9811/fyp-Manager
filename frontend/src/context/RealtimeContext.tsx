import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from './AuthContext'
import { tokenStore } from '@/lib/api'

export interface ActivityItem {
  id: string
  type: string
  message: string
  meta?: any
  by?: string
  byUserId?: string
  ts: number
}

/** Connection state of the socket itself (not of the other users). */
export type RealtimeStatus = 'idle' | 'connecting' | 'online' | 'reconnecting' | 'offline' | 'unauthorized'

interface RealtimeContextValue {
  socket: Socket | null
  connected: boolean
  status: RealtimeStatus
  onlineCount: number
  activityFeed: ActivityItem[]
  onlineUsers: Set<string>
  lastActivityAt: number | null
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

// VITE_API_URL normally includes the API path (e.g. https://api.example.com/api/v1).
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
  const [socket, setSocket] = useState<Socket | null>(null)
  const [status, setStatus] = useState<RealtimeStatus>('idle')
  const [onlineCount, setOnlineCount] = useState(0)
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([])
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const [lastActivityAt, setLastActivityAt] = useState<number | null>(null)
  const socketRef = useRef<Socket | null>(null)

  const userId = user?.id

  useEffect(() => {
    if (!userId) {
      socketRef.current?.disconnect()
      socketRef.current = null
      setSocket(null)
      setStatus('idle')
      setOnlineCount(0)
      setOnlineUsers(new Set())
      return
    }

    const token = tokenStore.get()
    if (!token) {
      setStatus('unauthorized')
      return
    }

    const s = io(SOCKET_BASE, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
      randomizationFactor: 0.4,
      timeout: 12_000,
    })

    socketRef.current = s
    setSocket(s)
    setStatus('connecting')

    const onConnect = () => setStatus('online')

    const onDisconnect = (reason: string) => {
      // "io server disconnect" means the server (or a password change) closed it;
      // socket.io will not retry automatically in that case, so we do it ourselves
      // with the freshest token we can find.
      if (reason === 'io server disconnect') {
        const fresh = tokenStore.get()
        if (fresh) {
          ;(s.auth as any) = { token: fresh }
          s.connect()
          setStatus('reconnecting')
        } else {
          setStatus('offline')
        }
        return
      }
      setStatus(reason === 'io client disconnect' ? 'offline' : 'reconnecting')
      setOnlineUsers(new Set())
      setOnlineCount(0)
    }

    const onConnectError = (err: Error) => {
      const fresh = tokenStore.get()
      const used = (s.auth as any)?.token
      if (fresh && fresh !== used) {
        ;(s.auth as any) = { token: fresh }
        s.connect()
        setStatus('reconnecting')
        return
      }
      if (err?.message === 'unauthorized' || err?.message === 'session-expired') {
        setStatus('unauthorized')
        s.disconnect()
        return
      }
      setStatus('reconnecting')
    }

    const onPresenceState = (payload: any) => {
      const users: any[] = Array.isArray(payload?.users) ? payload.users : []
      setOnlineUsers(new Set(users.map((u) => String(u.userId))))
      setOnlineCount(typeof payload?.count === 'number' ? payload.count : users.length)
    }

    const onPresenceUpdate = (payload: any) => {
      if (typeof payload?.count === 'number') setOnlineCount(payload.count)
      if (payload?.userId) {
        setOnlineUsers((prev) => {
          const next = new Set(prev)
          if (payload.online) next.add(String(payload.userId))
          else next.delete(String(payload.userId))
          return next
        })
      }
    }

    const onActivity = (item: ActivityItem) => {
      if (!item?.id) return
      setLastActivityAt(Date.now())
      setActivityFeed((prev) => {
        // Socket.IO can redeliver on reconnect; polling must never duplicate rows either.
        if (prev.some((entry) => entry.id === item.id)) return prev
        return [item, ...prev].slice(0, 50)
      })
    }

    s.on('connect', onConnect)
    s.on('disconnect', onDisconnect)
    s.on('connect_error', onConnectError)
    s.on('presence:state', onPresenceState)
    s.on('presence:update', onPresenceUpdate)
    s.on('activity:feed', onActivity)

    // Pick up a rotated token (password change) without remounting the provider.
    const tokenWatch = window.setInterval(() => {
      const fresh = tokenStore.get()
      if (fresh && fresh !== (s.auth as any)?.token) {
        ;(s.auth as any) = { token: fresh }
        s.disconnect().connect()
      }
    }, 5_000)

    return () => {
      window.clearInterval(tokenWatch)
      s.off('connect', onConnect)
      s.off('disconnect', onDisconnect)
      s.off('connect_error', onConnectError)
      s.off('presence:state', onPresenceState)
      s.off('presence:update', onPresenceUpdate)
      s.off('activity:feed', onActivity)
      s.disconnect()
      socketRef.current = null
      setSocket(null)
    }
  }, [userId])

  const value = useMemo<RealtimeContextValue>(
    () => ({
      socket,
      connected: status === 'online',
      status,
      onlineCount,
      activityFeed,
      onlineUsers,
      lastActivityAt,
      joinRoom: (roomId: string) => socketRef.current?.emit('room:join', roomId),
      leaveRoom: (roomId: string) => socketRef.current?.emit('room:leave', roomId),
      sendChat: (roomId: string, text: string) =>
        socketRef.current?.emit('chat:send', { roomId, text, sender: user }),
      getChatHistory: (roomId: string) => socketRef.current?.emit('chat:history', roomId),
      startTyping: (roomId: string, name: string) =>
        socketRef.current?.emit('typing:start', { roomId, name }),
      stopTyping: (roomId: string) => socketRef.current?.emit('typing:stop', { roomId }),
      clearFeed: () => {
        setActivityFeed([])
        setLastActivityAt(null)
      },
    }),
    [socket, status, onlineCount, activityFeed, onlineUsers, lastActivityAt, user]
  )

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext)
  if (!ctx) throw new Error('useRealtime must be used inside RealtimeProvider')
  return ctx
}
