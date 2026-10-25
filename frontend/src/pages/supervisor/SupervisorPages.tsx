import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Activity, AlertTriangle, CheckCircle2, Clock, Download, FileText, ListChecks,
  CalendarDays, ArrowRight, ShieldCheck, TrendingUp, GaugeCircle, Info, X,
} from 'lucide-react'
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line } from 'recharts'
import { PageHeader, StatCard, StatusPill, HealthPill, SectionHeader, ErrorState, SkeletonPage, EmptyState } from '@/components/shared/Common'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Feedback'
import { ResourceTable, type Column } from '@/components/shared/ResourceTable'
import { fmtDate, relativeTime, titleCase } from '@/lib/format'
import { useApiQuery, useApiMutation } from '@/hooks/useApi'
import api from '@/lib/api'

export function SupervisorProjects() {
  const { data, isLoading, error, refetch } = useApiQuery<any>(['supervisor', 'projects'], '/supervisor/projects', { refetchInterval: 30_000 })
  if (isLoading) return <SkeletonPage />
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  const rows: any[] = data?.projects ?? []
  const onTrack = rows.filter((r) => r.health === 'LOW').length
  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + (r.progress || 0), 0) / rows.length) : 0

  const columns: Column<any>[] = [
    { key: 'title', header: 'Project', render: (r) => <div><p className="max-w-[260px] truncate font-medium text-navy-900">{r.title}</p><p className="text-xs text-navy-400">{r.stage}</p></div> },
    { key: 'student', header: 'Student' },
    { key: 'progress', header: 'Progress', render: (r) => <div className="flex items-center gap-2"><Progress value={r.progress} className="h-1.5 w-16" /><span className="text-xs text-navy-500">{r.progress}%</span></div> },
    { key: 'health', header: 'Health', render: (r) => <HealthPill level={r.health} /> },
    { key: 'nextDeadline', header: 'Next deadline', render: (r) => <span className="text-xs text-navy-500">{fmtDate(r.nextDeadline)}</span> },
  ]

  return (
    <div>
      <PageHeader eyebrow="Supervision" title="Assigned projects" description="All projects currently under your supervision." />
      <div className="mb-5 grid gap-4 sm:grid-cols-4">
        <StatCard label="Total" value={rows.length} icon={FileText} tone="brand" />
        <StatCard label="On track" value={onTrack} icon={CheckCircle2} tone="success" />
        <StatCard label="At risk" value={rows.length - onTrack} icon={AlertTriangle} tone="danger" />
        <StatCard label="Average progress" value={`${avg}%`} icon={GaugeCircle} tone="warning" />
      </div>
      <ResourceTable rows={rows} columns={columns} searchKeys={['title', 'student', 'stage']} searchPlaceholder="Search projects or students…" filter={{ label: 'Health', key: 'health', options: ['LOW', 'MEDIUM', 'HIGH'] }} />
    </div>
  )
}

export function SupervisorReviews({ kind }: { kind: 'proposal' | 'submission' }) {
  const { data, isLoading, error, refetch } = useApiQuery<any>(['supervisor', 'reviews', kind], `/supervisor/reviews?type=${kind}`, { refetchInterval: 10_000 })
  const [active, setActive] = useState<any>(null)
  const [comments, setComments] = useState('')
  const [message, setMessage] = useState('')

  const review = useApiMutation(
    ({ item, status }: { item: any; status: string }) => {
      const url = item.type === 'Proposal'
        ? `/supervisor/proposals/${item.id}/review`
        : `/supervisor/submissions/${item.id}/review`
      return api.post(url, { status, comments })
    },
    [['supervisor', 'reviews', kind], ['supervisor', 'overview'], ['supervisor', 'health'], ['supervisor', 'milestones']]
  )

  const decide = async (status: string) => {
    if (!active) return
    setMessage('')
    try {
      const res: any = await review.mutateAsync({ item: active, status })
      setMessage(res.data?.message || 'Decision recorded')
      setActive(null)
      setComments('')
    } catch (err: any) {
      setMessage(err.message)
    }
  }

  const columns: Column<any>[] = [
    { key: 'title', header: 'Item', render: (r) => <div><p className="font-medium text-navy-900">{r.title}</p><p className="text-xs text-navy-400">{r.project}</p></div> },
    { key: 'student', header: 'Student' },
    { key: 'submitted', header: 'Submitted', render: (r) => <span className="text-xs text-navy-500">{fmtDate(r.submitted)}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusPill status={r.status} /> },
    { key: 'action', header: 'Action', render: (r) => <Button variant="outline" size="sm" onClick={() => { setActive(r); setComments(''); setMessage('') }}>Review</Button> },
  ]

  if (isLoading) return <SkeletonPage />
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  const rows: any[] = data?.reviews ?? []
  const decisions = active?.type === 'Proposal'
    ? [
        { status: 'PROPOSAL_APPROVED', label: 'Approve', variant: 'primary' as const },
        { status: 'PROPOSAL_REVISION_REQUIRED', label: 'Request revision', variant: 'outline' as const },
        { status: 'PROPOSAL_REJECTED', label: 'Reject', variant: 'danger' as const },
      ]
    : [
        { status: 'APPROVED', label: 'Approve', variant: 'primary' as const },
        { status: 'NEEDS_REVISION', label: 'Request revision', variant: 'outline' as const },
        { status: 'REJECTED', label: 'Reject', variant: 'danger' as const },
      ]

  return (
    <div>
      <PageHeader
        eyebrow="Reviews"
        title={kind === 'proposal' ? 'Proposal reviews' : 'Submission reviews'}
        description={kind === 'proposal' ? 'Evaluate project proposals and record decisions.' : 'Review deliverables and provide structured feedback.'}
      />
      {message && <p className="mb-4 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">{message}</p>}
      {rows.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Nothing awaiting review" description="New proposals and submissions from your students will appear here." />
      ) : (
        <ResourceTable rows={rows} columns={columns} searchKeys={['title', 'student', 'project']} searchPlaceholder="Search review queue…" filter={{ label: 'Status', key: 'status', options: Array.from(new Set(rows.map((r) => r.status))) }} />
      )}

      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActive(null)}
          />
          <motion.div
            className="relative w-full max-w-lg rounded-2xl border border-navy-200 bg-white p-6 shadow-lift"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <button onClick={() => setActive(null)} className="absolute right-3 top-3 rounded-lg p-1.5 text-navy-400 hover:bg-navy-100" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
            <Badge variant={active.type === 'Proposal' ? 'info' : 'brand'}>{active.type}</Badge>
            <h3 className="mt-3 text-lg font-semibold text-navy-900">{active.title}</h3>
            <p className="mt-1 text-sm text-navy-500">{active.student} · {active.project} · submitted {fmtDate(active.submitted)}</p>
            <div className="mt-4">
              <label className="mb-1.5 block text-sm font-medium text-navy-700">Comments (optional)</label>
              <textarea
                rows={4}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Share structured feedback for the student."
                className="w-full rounded-xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm text-navy-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10"
              />
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              {decisions.map((d) => (
                <Button key={d.status} variant={d.variant} loading={review.isPending} onClick={() => decide(d.status)}>{d.label}</Button>
              ))}
            </div>
          </motion.div>
        </div>
      )}

    </div>
  )
}

export function SupervisorMilestones() {
  const { data, isLoading, error, refetch } = useApiQuery<any>(['supervisor', 'milestones'], '/supervisor/milestones')
  if (isLoading) return <SkeletonPage />
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  const items: any[] = data?.milestones ?? []
  const overdue = items.filter((m) => m.due && new Date(m.due) < new Date() && m.status !== 'COMPLETED').length

  return (
    <div>
      <PageHeader eyebrow="Supervision" title="Milestone tracking" description="Milestones across your assigned projects." />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total milestones" value={items.length} icon={ListChecks} tone="brand" />
        <StatCard label="Overdue" value={overdue} icon={AlertTriangle} tone="danger" />
        <StatCard label="Completed" value={items.filter((m) => m.status === 'COMPLETED').length} icon={CheckCircle2} tone="success" />
      </div>
      <Card className="p-5">
        <div className="space-y-3">
          {items.length === 0 && <p className="py-4 text-center text-sm text-navy-400">No milestones found.</p>}
          {items.map((m) => (
            <div key={m.id} className="flex flex-col gap-3 rounded-xl border border-navy-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-navy-900">{m.title}</p>
                <p className="text-xs text-navy-400">{m.project} · Due {fmtDate(m.due)}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-32"><Progress value={m.progress} className="h-1.5" /></div>
                <span className="text-xs text-navy-500">{m.progress}%</span>
                <StatusPill status={m.status} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

export function SupervisorHealth() {
  const { data, isLoading, error, refetch } = useApiQuery<any>(['supervisor', 'health'], '/supervisor/health')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const recalc = useApiMutation(() => api.post('/supervisor/health/recalculate'), [['supervisor', 'health'], ['supervisor', 'overview'], ['supervisor', 'projects']])

  if (isLoading) return <SkeletonPage />
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  const rows: any[] = data?.projects ?? []
  const counts = data?.counts ?? { low: 0, medium: 0, high: 0, lastCalculated: null }
  const selected = rows.find((r) => r.id === selectedId) || rows[0]

  return (
    <div>
      <PageHeader
        eyebrow="Project Health Monitor"
        title="Project health"
        description="Explainable, rule-based risk scoring to help you support projects early."
        actions={<Button variant="outline" size="sm" loading={recalc.isPending} onClick={() => recalc.mutate()}><Activity className="h-4 w-4" /> Recalculate all</Button>}
      />
      <div className="mb-5 flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>This is a transparent rule-based monitor, not machine learning. Scores consider overdue milestones, inactivity, missed deadlines, and repeated revisions. It is meant to prompt support — not to label students.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Low risk" value={counts.low} icon={CheckCircle2} tone="success" />
        <StatCard label="Medium risk" value={counts.medium} icon={Activity} tone="warning" />
        <StatCard label="High risk" value={counts.high} icon={AlertTriangle} tone="danger" />
        <StatCard label="Last calculated" value={counts.lastCalculated ? relativeTime(counts.lastCalculated) : '—'} icon={Clock} hint="Just now" tone="info" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card className="overflow-hidden xl:col-span-2">
          <div className="border-b border-navy-100 p-5"><SectionHeader title="Health by project" description="Risk score and contributing factors" /></div>
          <div className="divide-y divide-navy-100">
            {rows.length === 0 && <p className="p-5 text-sm text-navy-400">No assigned projects.</p>}
            {rows.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`block w-full p-5 text-left transition-colors hover:bg-navy-50/50 ${selected?.id === p.id ? 'bg-brand-50/40' : ''}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-navy-900">{p.title}</p>
                    <p className="text-xs text-navy-400">{p.student} · {p.stage}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <HealthPill level={p.health} />
                    <span className="font-display text-lg font-bold text-navy-900">{p.score}</span>
                  </div>
                </div>
                <div className="mt-2.5"><Progress value={p.score} className="h-1.5" barClassName={p.health === 'HIGH' ? 'bg-red-500' : p.health === 'MEDIUM' ? 'bg-amber-500' : 'bg-emerald-500'} /></div>
              </button>
            ))}
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <SectionHeader title={selected ? `${selected.title} — factors` : 'Factor breakdown'} description={selected ? `Checked ${relativeTime(selected.lastChecked)}` : undefined} />
            <div className="mt-4 space-y-2.5">
              {(selected?.factors ?? []).map((f: any) => (
                <div key={f.label} className="flex items-center justify-between rounded-lg bg-navy-50/60 px-3 py-2">
                  <span className="text-xs text-navy-600">{f.label}</span>
                  <span className={`text-xs font-semibold ${f.active ? 'text-amber-600' : 'text-navy-400'}`}>+{f.pts}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-navy-100 pt-3">
              <span className="text-sm font-medium text-navy-700">Total</span>
              <span className="font-display text-xl font-bold text-amber-600">{selected?.score ?? 0}</span>
            </div>
          </Card>
          <Card className="p-5">
            <SectionHeader title="Recommended next actions" />
            <ul className="mt-3 space-y-2">
              {(selected?.recommendations ?? []).map((r: string) => (
                <li key={r} className="flex items-start gap-2 text-xs text-navy-600"><ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" /> {r}</li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}

export function SupervisorSchedule() {
  const { data, isLoading, error, refetch } = useApiQuery<any>(['supervisor', 'schedule'], '/supervisor/schedule')
  if (isLoading) return <SkeletonPage />
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  const items: any[] = data?.schedule ?? []

  return (
    <div>
      <PageHeader eyebrow="Evaluation" title="Evaluation schedule" description="Upcoming reviews, defenses, and panels." />
      {items.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Nothing scheduled" description="Defense schedules for your projects will appear here once created by the FYP Office." />
      ) : (
        <div className="grid gap-4">
          {items.map((s) => (
            <Card key={s.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
              <span className="flex h-14 w-14 flex-col items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <span className="text-[10px] font-semibold uppercase">{new Date(s.date).toLocaleString('en', { month: 'short' })}</span>
                <span className="text-lg font-bold leading-none">{new Date(s.date).getDate()}</span>
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-navy-900">{s.title}</p>
                <p className="text-xs text-navy-400">{s.time} · {s.venue}</p>
              </div>
              <Badge variant={s.status === 'COMPLETED' ? 'success' : 'info'}><CalendarDays className="h-3.5 w-3.5" /> {titleCase(s.status)}</Badge>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export function SupervisorReports() {
  const { data, isLoading, error, refetch } = useApiQuery<any>(['supervisor', 'reports'], '/supervisor/reports')
  if (isLoading) return <SkeletonPage />
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  const stats = data?.stats ?? {}
  const projects: any[] = data?.projects ?? []
  const progressTrend: any[] = data?.progressTrend ?? []

  const exportCsv = () => {
    const header = ['Project', 'Student', 'Stage', 'Progress', 'Health', 'Risk score', 'Next deadline']
    const rows = projects.map((p) => [p.title, p.student, p.stage, p.progress, p.health, p.riskScore, p.nextDeadline ? fmtDate(p.nextDeadline) : ''])
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'supervision-report.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <PageHeader
        eyebrow="Reports"
        title="Supervision reports"
        description="Progress and outcome summaries for your assigned projects."
        actions={<Button size="sm" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Avg. progress" value={`${stats.avgProgress ?? 0}%`} icon={TrendingUp} tone="brand" />
        <StatCard label="Completed projects" value={stats.completed ?? 0} icon={CheckCircle2} tone="success" />
        <StatCard label="Reviews completed" value={stats.reviewsCompleted ?? 0} icon={ShieldCheck} tone="info" />
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <SectionHeader title="Progress trend" description="Average across your projects" />
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={progressTrend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} domain={[0, 100]} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Line type="monotone" dataKey="progress" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 3, fill: '#4f46e5' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <SectionHeader title="Project completion" description="Current progress by project" />
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projects} layout="vertical" margin={{ top: 0, right: 16, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis type="category" dataKey="student" width={90} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Bar dataKey="progress" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  )
}

