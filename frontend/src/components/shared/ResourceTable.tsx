import { useMemo, useState } from 'react'
import { Search, ChevronLeft, ChevronRight, Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

export type Column<T> = {
  key: string
  header: string
  render?: (row: T) => React.ReactNode
  className?: string
}

export function ResourceTable<T extends Record<string, any>>({
  rows,
  columns,
  searchKeys,
  searchPlaceholder = 'Search…',
  filter,
  pageSize = 6,
  emptyLabel = 'No records found',
}: {
  rows: T[]
  columns: Column<T>[]
  searchKeys: string[]
  searchPlaceholder?: string
  filter?: { label: string; key: keyof T; options: string[] }
  pageSize?: number
  emptyLabel?: string
}) {
  const [query, setQuery] = useState('')
  const [filterValue, setFilterValue] = useState('ALL')
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      const matchesQuery =
        !q || searchKeys.some((k) => String(r[k] ?? '').toLowerCase().includes(q))
      const matchesFilter =
        !filter || filterValue === 'ALL' || String(r[filter.key]) === filterValue
      return matchesQuery && matchesFilter
    })
  }, [rows, query, filterValue, searchKeys, filter])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, pageCount - 1)
  const visible = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize)

  return (
    <div className="rounded-2xl border border-navy-200/80 bg-white shadow-soft">
      <div className="flex flex-col gap-3 border-b border-navy-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(0) }}
            placeholder={searchPlaceholder}
            className="h-10 w-full rounded-xl border border-navy-200 bg-navy-50/50 pl-9 pr-3 text-sm text-navy-700 placeholder:text-navy-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10"
          />
        </div>
        {filter && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-navy-400">{filter.label}</span>
            <select
              value={filterValue}
              onChange={(e) => { setFilterValue(e.target.value); setPage(0) }}
              className="h-10 rounded-xl border border-navy-200 bg-white px-3 text-sm font-medium text-navy-700 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-500/10"
            >
              <option value="ALL">All</option>
              {filter.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy-100 text-navy-400"><Inbox className="h-6 w-6" /></span>
          <p className="mt-3 text-sm font-medium text-navy-700">{emptyLabel}</p>
          <p className="mt-1 text-xs text-navy-400">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-navy-100 bg-navy-50/60 text-left text-xs font-semibold uppercase tracking-wide text-navy-400">
                {columns.map((c) => (
                  <th key={c.key} className={cn('px-5 py-2.5 font-semibold', c.className)}>{c.header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {visible.map((row, i) => (
                <tr key={i} className="group transition-colors hover:bg-navy-50/60">
                  {columns.map((c) => (
                    <td key={c.key} className={cn('px-5 py-3.5 align-middle text-navy-700', c.className)}>
                      {c.render ? c.render(row) : String(row[c.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-navy-100 px-4 py-3">
        <p className="text-xs text-navy-400">
          Showing <span className="font-semibold text-navy-600">{visible.length}</span> of{' '}
          <span className="font-semibold text-navy-600">{filtered.length}</span> records
        </p>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-navy-200 text-navy-500 transition-colors enabled:hover:bg-navy-100 disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-1 text-xs font-medium text-navy-500">
            {safePage + 1} / {pageCount}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={safePage >= pageCount - 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-navy-200 text-navy-500 transition-colors enabled:hover:bg-navy-100 disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
