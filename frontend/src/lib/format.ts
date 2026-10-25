const EMPTY = '—'

export function fmtDate(value?: string | Date | null): string {
  if (!value) return EMPTY
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return EMPTY
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtDateTime(value?: string | Date | null): string {
  if (!value) return EMPTY
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return EMPTY
  return d.toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function relativeTime(value?: string | Date | null): string {
  if (!value) return EMPTY
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return EMPTY
  const diff = Date.now() - d.getTime()
  const abs = Math.abs(diff)
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  const suffix = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'} ${diff >= 0 ? 'ago' : 'from now'}`
  if (abs < minute) return 'just now'
  if (abs < hour) return suffix(Math.round(abs / minute), 'minute')
  if (abs < day) return suffix(Math.round(abs / hour), 'hour')
  if (abs < 30 * day) return suffix(Math.round(abs / day), 'day')
  if (abs < 365 * day) return suffix(Math.round(abs / (30 * day)), 'month')
  return suffix(Math.round(abs / (365 * day)), 'year')
}

export function daysUntil(value?: string | Date | null): number | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000)
}

export function percentage(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '0%'
  return `${Math.round(value)}%`
}

export function initials(first?: string, last?: string): string {
  return `${(first || '?')[0] ?? ''}${(last || '')[0] ?? ''}`.toUpperCase()
}

export function titleCase(value?: string | null): string {
  if (!value) return EMPTY
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
