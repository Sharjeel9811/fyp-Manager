import { Link } from 'react-router-dom'
import {
  FolderKanban, Users, GraduationCap, FileText, AlertTriangle, Activity,
  ArrowRight, Building2, ScrollText, CheckCircle2,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Legend,
} from 'recharts'
import { PageHeader, StatCard, StatusPill, SectionHeader, HealthPill, ErrorState, SkeletonPage } from '@/components/shared/Common'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Progress } from '@/components/ui/Feedback'
import { Badge } from '@/components/ui/Badge'
import { relativeTime } from '@/lib/format'
import { useApiQuery } from '@/hooks/useApi'
import { LiveActivityPanel } from '@/components/LiveActivityPanel'

export default function AdminDashboard() {
  const { data, isLoading, error, refetch } = useApiQuery<any>(['admin', 'overview'], '/admin/overview', { refetchInterval: 15_000 })

  if (isLoading) return <SkeletonPage />
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
  if (!data) return null

  const { stats, projectsByStatus, departmentPerformance, projects, auditLogs, workload } = data
  const total = (projectsByStatus as any[]).reduce((a, b) => a + b.count, 0)

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="University overview"
        description="A university-wide snapshot of FYP activity, approvals, and risk."
        actions={
          <>
            <Link to="/admin/reports"><Button variant="outline" size="sm">Export report</Button></Link>
            <Link to="/admin/projects"><Button size="sm">Manage projects <ArrowRight className="h-4 w-4" /></Button></Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total projects" value={stats.totalProjects} icon={FolderKanban} tone="brand" />
        <StatCard label="Students" value={stats.totalStudents} icon={GraduationCap} hint="Registered students" tone="info" />
        <StatCard label="Supervisors" value={stats.totalSupervisors} icon={Users} hint="Active supervisors" tone="success" />
        <StatCard label="Pending proposals" value={stats.pendingProposals} icon={FileText} hint="Awaiting review" tone="warning" />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-4 p-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600"><AlertTriangle className="h-5 w-5" /></span>
          <div>
            <p className="text-sm text-navy-500">Overdue milestones</p>
            <p className="font-display text-2xl font-bold text-navy-900">{stats.overdueMilestones}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><Activity className="h-5 w-5" /></span>
          <div>
            <p className="text-sm text-navy-500">At-risk projects</p>
            <p className="font-display text-2xl font-bold text-navy-900">{stats.atRisk}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-5 w-5" /></span>
          <div>
            <p className="text-sm text-navy-500">On-track rate</p>
            <p className="font-display text-2xl font-bold text-navy-900">{stats.onTrackRate}%</p>
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card className="p-5">
          <SectionHeader title="Projects by status" description="Current distribution" />
          <div className="mt-2 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={projectsByStatus} dataKey="count" nameKey="status" innerRadius={52} outerRadius={78} paddingAngle={3} strokeWidth={0}>
                  {(projectsByStatus as any[]).map((entry) => <Cell key={entry.status} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-2">
            {(projectsByStatus as any[]).map((s) => (
              <div key={s.status} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                <span className="flex-1 text-navy-500">{s.status}</span>
                <span className="font-semibold text-navy-800">{s.count}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-xs text-navy-400">{total} projects this session</p>
        </Card>

        <Card className="p-5 xl:col-span-2">
          <SectionHeader title="Department performance" description="On-track vs at-risk projects" />
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departmentPerformance} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="dept" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="onTrack" name="On track" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={20} />
                <Bar dataKey="atRisk" name="At risk" fill="#f59e0b" radius={[6, 6, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="p-6 pb-2">
            <SectionHeader title="Recent projects" description="Latest activity across the university" action={<Link to="/admin/projects">View all</Link>} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-y border-navy-100 bg-navy-50/60 text-left text-xs font-semibold uppercase tracking-wide text-navy-400">
                  <th className="px-6 py-2.5">Project</th>
                  <th className="px-3 py-2.5">Department</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-6 py-2.5">Health</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {(projects as any[]).length === 0 && (
                  <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-navy-400">No projects yet.</td></tr>
                )}
                {(projects as any[]).slice(0, 5).map((p) => (
                  <tr key={p.id} className="hover:bg-navy-50/50">
                    <td className="px-6 py-3">
                      <p className="max-w-[240px] truncate font-medium text-navy-900">{p.title}</p>
                      <p className="text-xs text-navy-400">{p.supervisor}</p>
                    </td>
                    <td className="px-3 py-3 text-xs text-navy-500">{p.dept}</td>
                    <td className="px-3 py-3"><StatusPill status={p.status} /></td>
                    <td className="px-6 py-3"><HealthPill level={p.health} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5">
          <SectionHeader title="Recent activity" description="Administrative audit trail" action={<Link to="/admin/audit-logs">All</Link>} />
          <ul className="mt-3 space-y-3">
            {(auditLogs as any[]).length === 0 && <li className="text-xs text-navy-400">No activity recorded yet.</li>}
            {(auditLogs as any[]).slice(0, 4).map((a) => (
              <li key={a.id} className="flex gap-3">
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-navy-100 text-navy-500"><ScrollText className="h-3.5 w-3.5" /></span>
                <div className="min-w-0">
                  <p className="text-xs text-navy-700"><span className="font-semibold text-navy-900">{a.actor}</span> {String(a.action).toLowerCase()}</p>
                  <p className="truncate text-xs text-navy-500">{a.target}</p>
                  <p className="text-[11px] text-navy-400">{relativeTime(a.time)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <SectionHeader title="Supervisor workload" description="Assigned projects vs. capacity" action={<Link to="/admin/assignments">Manage</Link>} />
          <ul className="mt-4 space-y-3">
            {(workload as any[]).length === 0 && <li className="text-xs text-navy-400">No supervisors registered.</li>}
            {(workload as any[]).map((s) => (
              <li key={s.name}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-navy-700">{s.name}</span>
                  <span className="text-navy-400">{s.projects} / {s.capacity}</span>
                </div>
                <Progress value={(s.projects / s.capacity) * 100} className="mt-1.5 h-1.5" barClassName={s.projects >= s.capacity ? 'bg-red-500' : 'bg-brand-600'} />
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <SectionHeader title="Departments" description="Students and supervisors" action={<Link to="/admin/departments">Manage</Link>} />
          <ul className="mt-3 divide-y divide-navy-100">
            {(departmentPerformance as any[]).length === 0 && <li className="py-3 text-xs text-navy-400">No departments configured.</li>}
            {(departmentPerformance as any[]).map((d) => (
              <li key={d.dept} className="flex items-center gap-3 py-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><Building2 className="h-4 w-4" /></span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-navy-800">{d.dept}</p>
                  <p className="text-xs text-navy-400">{d.projects} projects</p>
                </div>
                <Badge variant={d.atRisk > 0 ? 'warning' : 'success'}>{d.atRisk} at risk</Badge>
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
