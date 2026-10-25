import { useEffect, useRef, useState } from 'react'
import { MessageSquare, Send, Users } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRealtime } from '@/context/RealtimeContext'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface ChatMsg {
  id: string
  roomId: string
  text: string
  senderId: string
  sender?: any
  ts: number
}

export function ProjectChat({ roomId, title = 'Project Live Chat' }: { roomId: string; title?: string }) {
  const { socket, joinRoom, leaveRoom, sendChat, getChatHistory, startTyping, stopTyping, connected } = useRealtime()
  const { user } = useAuth()
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [text, setText] = useState('')
  const [typing, setTyping] = useState<string[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const typingTimeout = useRef<number | null>(null)

  useEffect(() => {
    if (!roomId || !socket) return
    joinRoom(roomId)
    getChatHistory(roomId)

    const onMsg = (msg: ChatMsg) => {
      if (msg.roomId === roomId) setMessages((prev) => [...prev, msg].slice(-150))
    }
    const onHistory = (payload: any) => {
      if (payload.roomId === roomId) setMessages(payload.messages || [])
    }
    const onTyping = (payload: any) => {
      if (payload.roomId === roomId) setTyping(payload.users || [])
    }

    socket.on('chat:message', onMsg)
    socket.on('chat:history', onHistory)
    socket.on('typing:update', onTyping)

    return () => {
      socket.off('chat:message', onMsg)
      socket.off('chat:history', onHistory)
      socket.off('typing:update', onTyping)
      stopTyping(roomId)
      leaveRoom(roomId)
    }
  }, [roomId, socket])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, typing])

  const handleChange = (value: string) => {
    setText(value)
    if (!roomId) return
    startTyping(roomId, user?.name || user?.firstName || 'User')
    if (typingTimeout.current) window.clearTimeout(typingTimeout.current)
    typingTimeout.current = window.setTimeout(() => stopTyping(roomId), 1200)
  }

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim() || !roomId) return
    sendChat(roomId, text)
    setText('')
    stopTyping(roomId)
    if (typingTimeout.current) window.clearTimeout(typingTimeout.current)
  }

  return (
    <div className="flex h-[420px] flex-col overflow-hidden rounded-2xl border border-navy-200 bg-white shadow-soft">
      <div className="flex items-center justify-between border-b border-navy-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><MessageSquare className="h-4 w-4" /></span>
          <div>
            <p className="text-sm font-semibold text-navy-900">{title}</p>
            <p className="text-[11px] text-navy-400">{connected ? 'Live • Encrypted channel' : 'Reconnecting...'}</p>
          </div>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-navy-50 px-2 py-1 text-[11px] text-navy-500"><Users className="h-3 w-3" /> Real-time</span>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const mine = msg.senderId === user?.id
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn('flex', mine ? 'justify-end' : 'justify-start')}
              >
                <div className={cn('max-w-[78%] rounded-2xl px-3 py-2 text-sm', mine ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md bg-navy-50 text-navy-800')}>
                  <p className="break-words">{msg.text}</p>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
        {typing.length > 0 && (
          <p className="text-[11px] text-navy-400">{typing.slice(0, 2).join(', ')}{typing.length > 2 ? ` +${typing.length - 2} more` : ''} typing...</p>
        )}
      </div>

      <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-navy-100 p-3">
        <input
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Type a message..."
          className="h-10 flex-1 rounded-xl border border-navy-200 px-3 text-sm text-navy-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10"
        />
        <Button type="submit" size="sm" disabled={!text.trim()}><Send className="h-4 w-4" /></Button>
      </form>
    </div>
  )
}
