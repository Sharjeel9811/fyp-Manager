import { Link } from 'react-router-dom'
import {
  FolderKanban, TrendingUp, Clock, ListChecks, ArrowRight, UploadCloud,
  CalendarDays, Activity, CheckCircle2, AlertTriangle, FileText, Target, Sparkles,
  Users,
} from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { PageHeader, StatCard, StatusPill, SectionHeader, ErrorState, SkeletonPage, EmptyState } from '@/components/shared/Common'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Progress } from '@/components/ui/Feedback'
import { Badge } from '@/components/ui/Badge'
import { fmtDate, relativeTime } from '@/lib/format'
import { useApiQuery } from '@/hooks/useApi'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'
import { LiveActivityPanel } from '@/components/LiveActivityPanel'

const healthTheme = {
  LOW: { gradient: 'from-emerald-500 to-teal-600', chip: 'bg-white/20', sub: 'text-emerald-100', label: 'Low risk' },
  MEDIUM: { gradient: 'from-amber-500 to-orange-600', chip: 'bg-white/20', sub: 'text-amber-100', label: 'Medium risk' },
  HIGH: { gradient: 'from-red-500 to-rose-600', chip: 'bg-white/20', sub: 'text-red-100', label: 'High risk' },
} as const

const readinessTheme = {
  READY: { label: 'Defense ready', cls: 'text-emerald-600', bar: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700' },
  ON_TRACK: { label: 'On track', cls: 'text-brand-600', bar: 'bg-brand-500', chip: 'bg-brand-50 text-brand-700' },
  NEEDS_FOCUS: { label: 'Needs focus', cls: 'text-amber-600', bar: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700' },
} as const

export default function StudentDashboard() {
  const { user } = useAuth()
  const { data, isLoading, error, refetch } = useApiQuery<any>(['student', 'overview'], '/student/overview', { refetchInterval: 30_000 })

  if (isLoading) return <SkeletonPage />
  if (error) {
    const message = (error as Error).message || ''
    // A brand-new student has no team/project yet — onboarding, not an error.
    if (/no project found/i.test(message)) {
      return (
        <div>
          <PageHeader
            eyebrow="Student Workspace"
            title={`Welcome, ${user?.firstName ?? 'Student'}!`}
            description="Let's set up your final year project workspace in a few steps."
          />
          <Card className="p-8">
            <EmptyState
              icon={Users}
              title="Create or join your project team"
              description="Start by forming your team and registering a project. Your supervisor, proposals, milestones, and submissions all live inside it."
            />
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/student/team"><Button>Create / join team <ArrowRight className="h-4 w-4" /></Button></Link>
              <Link to="/student/profile"><Button variant="outline">Complete your profile</Button></Link>
            </div>
          </Card>
        </div>
      )
    }
    return <ErrorState message={message} onRetry={() => refetch()} />
  }
  if (!data) return null

  const { projectView, stats, milestones, submissions, feedback, health, progressTrend, readiness } = data
  const pending = (milestones as any[]).filter((m) => m.status !== 'COMPLETED').slice(0, 4)
  const theme = healthTheme[(health.level as keyof typeof healthTheme) || 'LOW']
  const ready = readinessTheme[(readiness?.level as keyof typeof readinessTheme) || 'ON_TRACK']
  const nextAction = readiness?.actions?.[0]

  return (
    <div>
      <PageHeader
        eyebrow="Student Workspace"
        title={`Welcome back, ${user?.firstName ?? 'Student'}`}
        description="Here's what's happening with your final year project today."
        actions={
          <>
            <Link to="/student/submissions"><Button variant="outline" size="sm"><UploadCloud className="h-4 w-4" /> Upload</Button></Link>
            <Link to="/student/milestones"><Button size="sm">View milestones <ArrowRight className="h-4 w-4" /></Button></Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Current stage" value={stats.stage} icon={FolderKanban} hint={projectView.title} tone="brand" />
        <StatCard label="Overall progress" value={`${stats.progress}%`} icon={TrendingUp} hint={`${stats.completedMilestones}/${stats.totalMilestones} milestones`} tone="success" />
        <StatCard label="Pending reviews" value={stats.pendingReviews} icon={Clock} hint="Awaiting supervisor" tone="warning" />
        <StatCard label="Upcoming deadlines" value={stats.upcomingDeadlines} icon={CalendarDays} hint="Next 14 days" tone="info" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex flex-col gap-4 p-6 pb-0 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="brand">{projectView.status?.replace(/_/g, ' ') ?? 'Active'}</Badge>
                <Badge variant="neutral">{projectView.session}</Badge>
              </div>
              <h2 className="mt-3 text-lg font-semibold text-navy-900">{projectView.title}</h2>
              <p className="mt-1 text-sm text-navy-500">Supervisor: {projectView.supervisor} · {projectView.department}</p>
            </div>
            <Link to="/student/project"><Button variant="ghost" size="sm">Open workspace <ArrowRight className="h-4 w-4" /></Button></Link>
          </div>

          <div className="px-6 pt-5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-navy-700">Project completion</span>
              <span className="font-semibold text-navy-900">{stats.progress}%</span>
            </div>
            <Progress value={stats.progress} className="mt-2 h-2.5" />
          </div>

          <div className="mt-5 h-52 px-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={progressTrend} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="progressFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 8px 24px -8px rgba(15,23,42,.2)' }}
                  formatter={(v) => [`${v}%`, 'Progress']}
                />
                <Area type="monotone" dataKey="progress" stroke="#4f46e5" strokeWidth={2.5} fill="url(#progressFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="border-t border-navy-100 p-4">
            <SectionHeader title="Milestones" description={`${stats.completedMilestones} of ${stats.totalMilestones} completed`} action={<Link to="/student/milestones">View all</Link>} />
            <ul className="mt-3 space-y-2">
              {(milestones as any[]).slice(0, 5).map((m) => (
                <li key={m.id} className="flex items-center gap-3 rounded-xl border border-navy-100 bg-navy-50/40 px-3 py-2.5">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${m.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-600' : m.status === 'IN_PROGRESS' ? 'bg-brand-100 text-brand-600' : 'bg-navy-100 text-navy-400'}`}>
                    {m.status === 'COMPLETED' ? <CheckCircle2 className="h-4 w-4" /> : <ListChecks className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-navy-800">{m.title}</p>
                    <p className="text-xs text-navy-400">Due {fmtDate(m.due)}</p>
                  </div>
                  <div className="hidden w-28 sm:block"><Progress value={m.progress} className="h-1.5" /></div>
                  <StatusPill status={m.status} />
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className={`relative bg-gradient-to-br ${theme.gradient} p-5 text-white`}>
              <div className="flex items-center justify-between">
                <div className={`flex items-center gap-2 ${theme.sub}`}><Activity className="h-4 w-4" /><span className="text-sm font-semibold">Project Health</span></div>
                <span className={`rounded-full ${theme.chip} px-2 py-0.5 text-[11px] font-semibold`}>{theme.label}</span>
              </div>
              <div className="mt-3 flex items-end gap-2">
                <span className="font-display text-4xl font-bold">{health.score}</span>
                <span className={`mb-1.5 text-sm ${theme.sub}`}>/ 100 risk score</span>
              </div>
              <p className={`mt-1 text-xs ${theme.sub}`}>Checked {relativeTime(health.lastChecked)}</p>
            </div>
            <div className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">Contributing factors</p>
              <ul className="mt-2.5 space-y-2">
                {(health.reasons as string[]).length === 0 && (
                  <li className="text-xs text-navy-500">No risk factors detected — keep it up.</li>
                )}
                {(health.reasons as string[]).map((r) => (
                  <li key={r} className="flex items-start gap-2 text-xs text-navy-600">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" /> {r}
                  </li>
                ))}
              </ul>
              <Link to="/student/milestones"><Button variant="subtle" size="sm" className="mt-4 w-full">See next actions <ArrowRight className="h-4 w-4" /></Button></Link>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Target className="h-4 w-4" /></span>
                <div>
                  <p className="text-sm font-semibold text-navy-900">Defense readiness</p>
                  <p className="text-[11px] text-navy-400">Weighted across your whole project</p>
                </div>
              </div>
              <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', ready.chip)}>{ready.label}</span>
            </div>
            <div className="mt-4 flex items-end gap-2">
              <span className={cn('font-display text-4xl font-bold', ready.cls)}>{readiness?.score ?? 0}</span>
              <span className="mb-1.5 text-xs font-medium text-navy-400">/ 100</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-navy-100">
              <div className={cn('h-full rounded-full transition-all duration-700', ready.bar)} style={{ width: `${readiness?.score ?? 0}%` }} />
            </div>
            <div className="mt-4 space-y-2.5">
              {(readiness?.components ?? []).map((c: any) => (
                <div key={c.key}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-navy-600">{c.label}</span>
                    <span className="text-navy-400">{c.score}/{c.max}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-navy-100">
                    <div className="h-full rounded-full bg-brand-400" style={{ width: `${Math.round((c.score / c.max) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
            {nextAction && (
              <Link to={nextAction.link} className="mt-4 block rounded-xl border border-brand-100 bg-brand-50/60 p-3 transition-colors hover:bg-brand-50">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-700"><Sparkles className="h-3.5 w-3.5" /> Next best action</p>
                <p className="mt-1 text-xs font-medium text-navy-800">{nextAction.title}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] text-navy-500">{nextAction.detail}</p>
              </Link>
            )}
          </Card>

          <Card className="p-5">
            <SectionHeader title="Recent feedback" action={<Link to="/student/feedback">All</Link>} />
            <ul className="mt-3 space-y-3">
              {(feedback as any[]).length === 0 && <li className="text-xs text-navy-400">No feedback yet.</li>}
              {(feedback as any[]).slice(0, 2).map((f) => (
                <li key={f.id} className="rounded-xl border border-navy-100 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-navy-900">{f.author}</p>
                    {f.isRevision && <Badge variant="warning">Revision</Badge>}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-navy-500">{f.content}</p>
                  <p className="mt-1.5 text-[11px] text-navy-400">{fmtDate(f.date)} · {f.submission}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <SectionHeader title="Recent submissions" description="Your latest deliverables" action={<Link to="/student/submissions">View all</Link>} />
          <ul className="mt-3 divide-y divide-navy-100">
            {(submissions as any[]).length === 0 && <li className="py-3 text-xs text-navy-400">No submissions yet.</li>}
            {(submissions as any[]).slice(0, 4).map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><FileText className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-navy-800">{s.title}</p>
                  <p className="text-xs text-navy-400">v{s.version} · {fmtDate(s.submitted)}</p>
                </div>
                <StatusPill status={s.status} />
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <SectionHeader title="Upcoming deadlines" description="Stay ahead of the schedule" action={<Link to="/student/milestones">Calendar</Link>} />
          <ul className="mt-3 space-y-2.5">
            {pending.length === 0 && <li className="text-xs text-navy-400">Nothing due — all milestones complete.</li>}
            {pending.map((m) => (
              <li key={m.id} className="flex items-center gap-3 rounded-xl border border-navy-100 bg-navy-50/40 p-3">
                <span className="flex h-10 w-10 flex-col items-center justify-center rounded-lg bg-white text-navy-900 ring-1 ring-navy-200">
                  <span className="text-[10px] font-semibold uppercase text-navy-400">{new Date(m.due).toLocaleString('en', { month: 'short' })}</span>
                  <span className="text-sm font-bold leading-none">{new Date(m.due).getDate()}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-navy-800">{m.title}</p>
                  <p className="text-xs text-navy-400">Due {fmtDate(m.due)}</p>
                </div>
                <StatusPill status={m.status} />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-5">
        <LiveActivityPanel />
      </div>
    </div>
  )
}
