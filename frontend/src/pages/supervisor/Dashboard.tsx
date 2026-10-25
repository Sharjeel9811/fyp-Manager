import { Link } from 'react-router-dom'
import {
  Users, Clock, Activity, CheckCircle2, ArrowRight, CalendarDays,
  AlertTriangle,
} from 'lucide-react'
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts'
import { PageHeader, StatCard, StatusPill, SectionHeader, HealthPill, ErrorState, SkeletonPage, EmptyState } from '@/components/shared/Common'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Progress } from '@/components/ui/Feedback'
import { Badge } from '@/components/ui/Badge'
import { fmtDate } from '@/lib/format'
import { LiveActivityPanel } from '@/components/LiveActivityPanel'
import { useApiQuery } from '@/hooks/useApi'
import { useAuth } from '@/context/AuthContext'

export default function SupervisorDashboard() {
  const { user } = useAuth()
  const { data, isLoading, error, refetch } = useApiQuery<any>(['supervisor', 'overview'], '/supervisor/overview', { refetchInterval: 15_000 })

  if (isLoading) return <SkeletonPage />
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
  if (!data) return null

  const { stats, projects, reviews, attention, workload, schedule } = data
  const topAttention = (attention as any[])[0]

  return (
    <div>
      <PageHeader
        eyebrow="Supervisor Console"
        title={`Good to see you, Dr. ${user?.lastName ?? ''}`}
        description="Monitor your assigned projects, review submissions, and spot risk early."
        actions={
          <>
            <Link to="/supervisor/health"><Button variant="outline" size="sm"><Activity className="h-4 w-4" /> Project health</Button></Link>
            <Link to="/supervisor/submission-reviews"><Button size="sm">Review queue <ArrowRight className="h-4 w-4" /></Button></Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Assigned projects" value={stats.assignedProjects} icon={Users} hint={`Capacity ${stats.capacity}`} tone="brand" />
        <StatCard label="Pending reviews" value={stats.pendingReviews} icon={Clock} hint="Awaiting your action" tone="warning" />
        <StatCard label="At-risk projects" value={stats.atRisk} icon={Activity} hint="Medium or high risk" tone="danger" />
        <StatCard label="On-track" value={stats.onTrack} icon={CheckCircle2} hint="Healthy progress" tone="success" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="p-6 pb-2">
            <SectionHeader title="Assigned projects" description="Progress and health across your supervision load" action={<Link to="/supervisor/projects">View all</Link>} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-y border-navy-100 bg-navy-50/60 text-left text-xs font-semibold uppercase tracking-wide text-navy-400">
                  <th className="px-6 py-2.5">Project</th>
                  <th className="px-3 py-2.5">Student</th>
                  <th className="px-3 py-2.5">Progress</th>
                  <th className="px-3 py-2.5">Health</th>
                  <th className="px-6 py-2.5">Deadline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {(projects as any[]).length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-navy-400">No projects assigned yet.</td></tr>
                )}
                {(projects as any[]).map((p) => (
                  <tr key={p.id} className="group hover:bg-navy-50/50">
                    <td className="px-6 py-3">
                      <p className="max-w-[220px] truncate font-medium text-navy-900">{p.title}</p>
                      <p className="text-xs text-navy-400">{p.stage}</p>
                    </td>
                    <td className="px-3 py-3 text-navy-600">{p.student}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <Progress value={p.progress} className="h-1.5 w-16" />
                        <span className="text-xs font-medium text-navy-500">{p.progress}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-3"><HealthPill level={p.health as 'LOW' | 'MEDIUM' | 'HIGH'} /></td>
                    <td className="px-6 py-3 text-xs text-navy-500">{fmtDate(p.nextDeadline)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <SectionHeader title="Review queue" description="Items requiring your action" action={<Link to="/supervisor/submission-reviews">All</Link>} />
            <ul className="mt-3 space-y-3">
              {(reviews as any[]).length === 0 && <li className="text-xs text-navy-400">Nothing awaiting review.</li>}
              {(reviews as any[]).map((r) => (
                <li key={r.id} className="rounded-xl border border-navy-100 p-3 hover:border-brand-200 hover:bg-brand-50/30">
                  <div className="flex items-center justify-between">
                    <Badge variant={r.type === 'Proposal' ? 'info' : 'brand'}>{r.type}</Badge>
                    <StatusPill status={r.status} />
                  </div>
                  <p className="mt-2 text-sm font-medium text-navy-900">{r.title}</p>
                  <p className="text-xs text-navy-400">{r.student} · {fmtDate(r.submitted)}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between bg-gradient-to-br from-rose-500 to-red-600 p-5 text-white">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="h-4 w-4" /> Needs attention</p>
                <p className="mt-1 text-xs text-rose-100">{(attention as any[]).length} project(s) flagged high risk</p>
              </div>
              <span className="font-display text-3xl font-bold">{(attention as any[]).length}</span>
            </div>
            <div className="p-4">
              {topAttention ? (
                <>
                  <p className="text-sm font-medium text-navy-800">{topAttention.title}</p>
                  <p className="text-xs text-navy-400">{topAttention.student} · {topAttention.stage} · {topAttention.progress}% progress</p>
                  <Link to="/supervisor/health"><Button variant="outline" size="sm" className="mt-3 w-full">Review health report <ArrowRight className="h-4 w-4" /></Button></Link>
                </>
              ) : (
                <p className="py-2 text-xs text-navy-400">All projects are within a healthy risk range.</p>
              )}
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <SectionHeader title="Supervision workload" description="Projects vs. configured capacity" />
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workload} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Bar dataKey="projects" radius={[6, 6, 0, 0]} barSize={28}>
                  {(workload as any[]).map((w, i) => (
                    <Cell key={i} fill={w.projects >= w.capacity ? '#f43f5e' : '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <SectionHeader title="Upcoming schedule" description="Scheduled defenses" action={<Link to="/supervisor/schedule">Calendar</Link>} />
          <ul className="mt-3 space-y-2.5">
            {(schedule as any[]).length === 0 && (
              <li><EmptyState icon={CalendarDays} title="Nothing scheduled" description="Defense dates will appear here once the FYP Office schedules them." /></li>
            )}
            {(schedule as any[]).map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-xl border border-navy-100 bg-navy-50/40 p-3">
                <span className="flex h-10 w-10 flex-col items-center justify-center rounded-lg bg-white text-navy-900 ring-1 ring-navy-200">
                  <span className="text-[10px] font-semibold uppercase text-navy-400">{new Date(s.date).toLocaleString('en', { month: 'short' })}</span>
                  <span className="text-sm font-bold leading-none">{new Date(s.date).getDate()}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-navy-800">{s.title}</p>
                  <p className="text-xs text-navy-400">{s.time} · {s.venue}</p>
                </div>
                <CalendarDays className="h-4 w-4 text-navy-300" />
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
