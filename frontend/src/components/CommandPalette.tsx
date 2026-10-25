import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Search, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CommandItem {
  label: string
  to: string
  icon: LucideIcon
  group: string
}

export function CommandPalette({
  open,
  onClose,
  items,
}: {
  open: boolean
  onClose: () => void
  items: CommandItem[]
}) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const results = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return items
    return items.filter((item) => `${item.label} ${item.group} ${item.to}`.toLowerCase().includes(term))
  }, [items, query])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActiveIndex(0)
    const timer = window.setTimeout(() => inputRef.current?.focus(), 60)
    return () => window.clearTimeout(timer)
  }, [open])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const choose = (item: CommandItem | undefined) => {
    if (!item) return
    navigate(item.to)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((index) => (results.length ? (index + 1) % results.length : 0))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((index) => (results.length ? (index - 1 + results.length) % results.length : 0))
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      choose(results[activeIndex])
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-navy-950/55 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-navy-200 bg-white shadow-lift"
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <div className="flex items-center gap-3 border-b border-navy-100 px-4">
              <Search className="h-4 w-4 shrink-0 text-navy-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Jump to a page or action…"
                className="h-14 flex-1 bg-transparent text-sm text-navy-900 outline-none placeholder:text-navy-400"
              />
              <button onClick={onClose} className="rounded-lg p-1.5 text-navy-400 hover:bg-navy-100" aria-label="Close command palette">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[52vh] overflow-y-auto p-2">
              {results.length === 0 && (
                <p className="px-3 py-8 text-center text-sm text-navy-400">No matching pages or actions.</p>
              )}
              {results.map((item, index) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.to}
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(item)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                      index === activeIndex ? 'bg-brand-50 text-brand-700' : 'text-navy-700 hover:bg-navy-50'
                    )}
                  >
                    <span className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                      index === activeIndex ? 'bg-white text-brand-600 shadow-sm' : 'bg-navy-100 text-navy-500'
                    )}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.label}</span>
                      <span className="block text-[11px] text-navy-400">{item.group}</span>
                    </span>
                    <ArrowRight className={cn('h-3.5 w-3.5', index === activeIndex ? 'opacity-100' : 'opacity-0')} />
                  </button>
                )
              })}
            </div>
            <div className="flex items-center justify-between border-t border-navy-100 bg-navy-50/60 px-4 py-2 text-[11px] text-navy-400">
              <span>↑ ↓ to navigate · Enter to open</span>
              <span className="rounded border border-navy-200 bg-white px-1.5 py-0.5 font-mono text-[10px]">Esc</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
