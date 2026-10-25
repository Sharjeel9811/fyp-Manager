import { useEffect, useState } from 'react'
import { Activity, Wifi, WifiOff, Zap, Loader2, Users } from 'lucide-react'
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
  const { connected, status, onlineCount, activityFeed, lastActivityAt } = useRealtime()
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    if (activityFeed.length === 0) return
    setPulse(true)
    const t = setTimeout(() => setPulse(false), 800)
    return () => clearTimeout(t)
  }, [activityFeed.length])

  // Three independent facts, shown separately so a dropped socket never looks
  // like "nobody is using the app" and vice versa.
  const link = (() => {
    switch (status) {
      case 'online':
        return { label: `${onlineCount} online`, tone: 'bg-emerald-50 text-emerald-700', icon: Wifi }
      case 'connecting':
        return { label: 'Connecting…', tone: 'bg-amber-50 text-amber-700', icon: Loader2 }
      case 'reconnecting':
        return { label: 'Reconnecting…', tone: 'bg-amber-50 text-amber-700', icon: Loader2 }
      case 'unauthorized':
        return { label: 'Sign in again', tone: 'bg-red-50 text-red-600', icon: WifiOff }
      case 'idle':
        return { label: 'Signed out', tone: 'bg-navy-100 text-navy-500', icon: WifiOff }
      default:
        return { label: 'Offline', tone: 'bg-navy-100 text-navy-500', icon: WifiOff }
    }
  })()

  const LinkIcon = link.icon
  const spinning = status === 'connecting' || status === 'reconnecting'

  return (
    <div className={cn('rounded-2xl border border-navy-200 bg-white shadow-soft', compact ? 'p-4' : 'p-5')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn('relative flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-600')}>
            <Activity className="h-4 w-4" />
            {pulse && connected && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400" />}
          </span>
          <div>
            <p className="text-sm font-semibold text-navy-900">Live Activity</p>
            <p className="text-[11px] text-navy-400">
              {lastActivityAt ? `Last update ${relativeTime(new Date(lastActivityAt))}` : 'Real-time updates across FYP workflow'}
            </p>
          </div>
        </div>
        <div className={cn('flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium', link.tone)}>
          <LinkIcon className={cn('h-3 w-3', spinning && 'animate-spin')} />
          {link.label}
        </div>
      </div>

      {!connected && status !== 'idle' && (
        <p className="mt-3 rounded-xl bg-navy-50 px-3 py-2 text-[11px] text-navy-500">
          {status === 'unauthorized'
            ? 'Your session expired. Sign in again to resume live updates — the dashboard still refreshes every 15 seconds.'
            : 'Live connection unavailable. Dashboards keep refreshing every 15 seconds until it reconnects.'}
        </p>
      )}

      <div className={cn('mt-4 space-y-2', compact ? 'max-h-64 overflow-y-auto' : 'max-h-80 overflow-y-auto')}>
        <AnimatePresence initial={false}>
          {activityFeed.length === 0 ? (
            <p className="py-6 text-center text-xs text-navy-400">
              {connected ? 'Waiting for live events…' : 'No live events yet.'}
            </p>
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

      <div className="mt-3 flex items-center justify-between border-t border-navy-100 pt-2.5 text-[10px] text-navy-400">
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" /> {onlineCount} {onlineCount === 1 ? 'person' : 'people'} online
        </span>
        <span className={cn('flex items-center gap-1', connected ? 'text-emerald-600' : 'text-navy-400')}>
          <span className={cn('h-1.5 w-1.5 rounded-full', connected ? 'bg-emerald-500' : 'bg-navy-300')} />
          {connected ? 'Live' : 'Polling fallback'}
        </span>
      </div>
    </div>
  )
}
