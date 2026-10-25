import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { ArrowUpRight, TrendingUp, TrendingDown, Loader2, AlertTriangle, RefreshCw } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-brand-600">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-bold text-navy-900 sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-navy-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  )
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  trend,
  tone = 'brand',
}: {
  label: string
  value: string | number
  icon: LucideIcon
  hint?: string
  trend?: { value: string; up?: boolean }
  tone?: 'brand' | 'success' | 'warning' | 'danger' | 'info'
}) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600',
    success: 'bg-emerald-50 text-emerald-600',
    warning: 'bg-amber-50 text-amber-600',
    danger: 'bg-red-50 text-red-600',
    info: 'bg-sky-50 text-sky-600',
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.32, ease: 'easeOut' }}
      className="group relative overflow-hidden rounded-2xl border border-navy-200/80 bg-white p-5 shadow-soft transition-shadow hover:shadow-lift"
    >
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-navy-500">{label}</p>
        <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', tones[tone])}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 font-display text-3xl font-bold tracking-tight text-navy-900">{value}</p>
      <div className="mt-2 flex items-center gap-2">
        {trend && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-semibold',
              trend.up ? 'text-emerald-600' : 'text-red-600',
            )}
          >
            {trend.up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {trend.value}
          </span>
        )}
        {hint && <span className="text-xs text-navy-400">{hint}</span>}
      </div>
    </motion.div>
  )
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; dot: string }> = {
    COMPLETED: { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
    APPROVED: { label: 'Approved', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
    ACTIVE: { label: 'Active', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
    IN_PROGRESS: { label: 'In Progress', cls: 'bg-brand-50 text-brand-700 ring-brand-200', dot: 'bg-brand-500' },
    UNDER_REVIEW: { label: 'Under Review', cls: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
    PROPOSAL_UNDER_REVIEW: { label: 'Under Review', cls: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
    NOT_STARTED: { label: 'Not Started', cls: 'bg-navy-100 text-navy-600 ring-navy-200', dot: 'bg-navy-400' },
    NEEDS_REVISION: { label: 'Needs Revision', cls: 'bg-orange-50 text-orange-700 ring-orange-200', dot: 'bg-orange-500' },
    PROPOSAL_DRAFT: { label: 'Draft', cls: 'bg-navy-100 text-navy-600 ring-navy-200', dot: 'bg-navy-400' },
    PROPOSAL_SUBMITTED: { label: 'Submitted', cls: 'bg-sky-50 text-sky-700 ring-sky-200', dot: 'bg-sky-500' },
    PROPOSAL_REVISION_REQUIRED: { label: 'Revision Required', cls: 'bg-orange-50 text-orange-700 ring-orange-200', dot: 'bg-orange-500' },
    PROPOSAL_APPROVED: { label: 'Approved', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
    PROPOSAL_REJECTED: { label: 'Rejected', cls: 'bg-red-50 text-red-700 ring-red-200', dot: 'bg-red-500' },
    INACTIVE: { label: 'Inactive', cls: 'bg-navy-100 text-navy-600 ring-navy-200', dot: 'bg-navy-400' },
    PENDING: { label: 'Pending', cls: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
  }
  const s = map[status] ?? { label: status, cls: 'bg-navy-100 text-navy-600 ring-navy-200', dot: 'bg-navy-400' }
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset', s.cls)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  )
}

export function HealthPill({ level }: { level: 'LOW' | 'MEDIUM' | 'HIGH' }) {
  const map = {
    LOW: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    MEDIUM: 'bg-amber-50 text-amber-700 ring-amber-200',
    HIGH: 'bg-red-50 text-red-700 ring-red-200',
  }
  const dot = { LOW: 'bg-emerald-500', MEDIUM: 'bg-amber-500', HIGH: 'bg-red-500' }
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset', map[level])}>
      <span className={cn('h-1.5 w-1.5 rounded-full', dot[level])} />
      {level.charAt(0) + level.slice(1).toLowerCase()} risk
    </span>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-navy-200 bg-white/60 px-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Icon className="h-7 w-7" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-navy-900">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-navy-500">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <h2 className="text-base font-semibold text-navy-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-navy-500">{description}</p>}
      </div>
      {action && (
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700">
          {action}
          <ArrowUpRight className="h-4 w-4" />
        </span>
      )}
    </div>
  )
}


export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-navy-400">
      <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50/60 px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-600">
        <AlertTriangle className="h-6 w-6" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-navy-900">Unable to load this data</h3>
      <p className="mt-1 max-w-md text-sm text-navy-500">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-navy-700 ring-1 ring-navy-200 transition-colors hover:bg-navy-50"
        >
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      )}
    </div>
  )
}

export function SkeletonPage() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-navy-200/70" />
        <div className="h-7 w-72 rounded bg-navy-200/70" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-2xl border border-navy-100 bg-white" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="h-80 rounded-2xl border border-navy-100 bg-white xl:col-span-2" />
        <div className="h-80 rounded-2xl border border-navy-100 bg-white" />
      </div>
    </div>
  )
}
