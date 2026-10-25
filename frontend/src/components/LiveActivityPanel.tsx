import { useEffect, useState } from 'react'
import { Activity, Wifi, WifiOff, Zap } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRealtime } from '@/context/RealtimeContext'
import { cn } from '@/lib/utils'
import { relativeTime } from '@/lib/format'

const typeIcons: Record<string, string> = {
  proposal: '📝',
  review: '✅',
  assignment: '👥',
  info: 'ℹ️',
}

export function LiveActivityPanel({ compact = false }: { compact?: boolean }) {
  const { connected, onlineCount, activityFeed } = useRealtime()
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    if (activityFeed.length === 0) return
    setPulse(true)
    const t = setTimeout(() => setPulse(false), 800)
    return () => clearTimeout(t)
  }, [activityFeed.length])

  return (
    <div className={cn('rounded-2xl border border-navy-200 bg-white shadow-soft', compact ? 'p-4' : 'p-5')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn('relative flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-600')}>
            <Activity className="h-4 w-4" />
            {pulse && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400" />}
          </span>
          <div>
            <p className="text-sm font-semibold text-navy-900">Live Activity</p>
            <p className="text-[11px] text-navy-400">Real-time updates across FYP workflow</p>
          </div>
        </div>
        <div className={cn('flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium', connected ? 'bg-emerald-50 text-emerald-700' : 'bg-navy-100 text-navy-500')}>
          {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {connected ? `${onlineCount} online` : 'Offline'}
        </div>
      </div>

      <div className={cn('mt-4 space-y-2', compact ? 'max-h-64 overflow-y-auto' : 'max-h-80 overflow-y-auto')}>
        <AnimatePresence initial={false}>
          {activityFeed.length === 0 ? (
            <p className="py-6 text-center text-xs text-navy-400">Waiting for live events…</p>
          ) : (
            activityFeed.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.25 }}
                className="flex items-start gap-2.5 rounded-xl border border-navy-100 p-2.5"
              >
                <span className="mt-0.5 text-base">{typeIcons[item.type] || '⚡'}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-navy-800">{item.message}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[10px] text-navy-400">
                    <Zap className="h-3 w-3" /> {relativeTime(new Date(item.ts))}
                  </p>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
