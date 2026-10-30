import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Users, GraduationCap, FolderKanban, ShieldCheck, Mail,
  Award, Download, Plus, CheckCircle2, AlertTriangle, TrendingUp, UserPlus, Save, X, Sparkles,
  Copy,
} from 'lucide-react'
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { PageHeader, StatCard, StatusPill, HealthPill, SectionHeader, ErrorState, SkeletonPage, EmptyState } from '@/components/shared/Common'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { ResourceTable, type Column } from '@/components/shared/ResourceTable'
import { fmtDate, fmtDateTime, titleCase } from '@/lib/format'
import { downloadCsv } from '@/lib/csv'
import { cn } from '@/lib/utils'
import { useApiQuery, useApiMutation } from '@/hooks/useApi'
import api from '@/lib/api'

const palette = ['#4f46e5', '#0ea5e9', '#f59e0b', '#f97316', '#ef4444', '#10b981', '#64748b', '#8b5cf6']

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-navy-200 bg-white p-6 shadow-lift"
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <button onClick={onClose} className="absolute right-3 top-3 rounded-lg p-1.5 text-navy-400 hover:bg-navy-100" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
        <h3 className="text-lg font-semibold text-navy-900">{title}</h3>
        {subtitle && <p className="mt-1 text-sm text-navy-500">{subtitle}</p>}
        <div className="mt-5">{children}</div>
      </motion.div>
    </div>
  )
}

const textareaClass =
  'w-full rounded-xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm text-navy-900 shadow-sm transition-colors placeholder:text-navy-400 hover:border-navy-300 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10'

export function AdminUsers() {
  const [adding, setAdding] = useState(false)
  const [message, setMessage] = useState('')
  const { data, isLoading, error, refetch } = useApiQuery<any>(['admin', 'users'], '/admin/users')
  const departmentsQ = useApiQuery<any>(['admin', 'departments'], '/admin/departments')
  const create = useApiMutation((payload: any) => api.post('/admin/users', payload), [['admin', 'users'], ['admin', 'overview'], ['admin', 'departments']])
  const deactivate = useApiMutation((id: string) => api.delete(`/admin/users/${id}`), [['admin', 'users'], ['admin', 'overview']])

  if (isLoading) return <SkeletonPage />
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
  const rows: any[] = data?.users ?? []
  const departments: any[] = departmentsQ.data?.departments ?? []

  const columns: Column<any>[] = [
    { key: 'name', header: 'Name', render: (r) => <div><p className="font-medium text-navy-900">{r.name}</p><p className="text-xs text-navy-400">{r.email}</p><p className="text-[11px] text-navy-400">{r.studentId || r.employeeId || ''}</p></div> },
    { key: 'role', header: 'Role', render: (r) => <Badge variant={r.role === 'ADMIN' ? 'brand' : r.role === 'SUPERVISOR' ? 'info' : 'neutral'}>{titleCase(r.role)}</Badge> },
    { key: 'department', header: 'Department' },
    { key: 'status', header: 'Status', render: (r) => <StatusPill status={r.status} /> },
    { key: 'joined', header: 'Joined', render: (r) => <span className="text-xs text-navy-500">{fmtDate(r.joined)}</span> },
    {
      key: 'action', header: '', className: 'text-right',
      render: (r) => r.status === 'ACTIVE' ? (
        <Button variant="ghost" size="sm" onClick={() => { if (window.confirm(`Deactivate ${r.name}?`)) deactivate.mutate(r.id) }}>Deactivate</Button>
      ) : null,
    },
  ]

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setMessage('')
    const form = new FormData(e.currentTarget)
    try {
      const res: any = await create.mutateAsync({
        firstName: form.get('firstName'),
        lastName: form.get('lastName'),
        email: form.get('email'),
        password: form.get('password') || 'password123',
        role: form.get('role'),
        departmentId: form.get('departmentId') || undefined,
        studentId: form.get('studentId') || undefined,
        employeeId: form.get('employeeId') || undefined,
      })
      setMessage(res.data?.message || 'User created')
      setAdding(false)
    } catch (err: any) {
      setMessage(err.message)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Management"
        title="Users"
        description="Manage students, supervisors, and administrators."
        actions={<Button size="sm" onClick={() => { setMessage(''); setAdding(true) }}><UserPlus className="h-4 w-4" /> Add user</Button>}
      />
      {message && <p className="mb-4 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">{message}</p>}
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Students" value={rows.filter((r) => r.role === 'STUDENT').length} icon={GraduationCap} tone="brand" />
        <StatCard label="Supervisors" value={rows.filter((r) => r.role === 'SUPERVISOR').length} icon={Users} tone="success" />
        <StatCard label="Administrators" value={rows.filter((r) => r.role === 'ADMIN').length} icon={ShieldCheck} tone="info" />
      </div>
      <ResourceTable rows={rows} columns={columns} searchKeys={['name', 'email', 'department', 'studentId', 'employeeId']} searchPlaceholder="Search users…" filter={{ label: 'Role', key: 'role', options: ['STUDENT', 'SUPERVISOR', 'ADMIN'] }} />

      {adding && (
        <Modal title="Add user" subtitle="Create an account with an initial password." onClose={() => setAdding(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label="First name" name="firstName" required />
              <Input label="Last name" name="lastName" required />
            </div>
            <Input label="Email" type="email" name="email" required />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Role" name="role" defaultValue="STUDENT">
                <option value="STUDENT">Student</option>
                <option value="SUPERVISOR">Supervisor</option>
                <option value="ADMIN">Admin</option>
              </Select>
              <Select label="Department" name="departmentId" defaultValue="">
                <option value="">None</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Student ID" name="studentId" placeholder="Auto-generated" />
              <Input label="Employee ID" name="employeeId" placeholder="Auto-generated" />
            </div>
            <Input label="Initial password" name="password" placeholder="Defaults to password123" />
            <Button type="submit" className="w-full" loading={create.isPending}>Create user</Button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export function AdminDepartments() {
  const [adding, setAdding] = useState(false)
  const [message, setMessage] = useState('')
  const { data, isLoading, error, refetch } = useApiQuery<any>(['admin', 'departments'], '/admin/departments')
  const create = useApiMutation((payload: any) => api.post('/admin/departments', payload), [['admin', 'departments'], ['admin', 'overview'], ['admin', 'reports']])

  if (isLoading) return <SkeletonPage />
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  const rows: any[] = data?.departments ?? []
  const columns: Column<any>[] = [
    { key: 'name', header: 'Department', render: (r) => <div><p className="font-medium text-navy-900">{r.name}</p><p className="text-xs text-navy-400">Code {r.code}</p></div> },
    { key: 'students', header: 'Students' },
    { key: 'supervisors', header: 'Supervisors' },
    { key: 'projects', header: 'Projects' },
    { key: 'ratio', header: 'Student/Supervisor', render: (r) => <span>{r.supervisors ? (r.students / r.supervisors).toFixed(1) : '—'}</span> },
  ]

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setMessage('')
    const form = new FormData(e.currentTarget)
    try {
      const res: any = await create.mutateAsync({ name: form.get('name'), code: form.get('code') })
      setMessage(res.data?.message || 'Department created')
      setAdding(false)
    } catch (err: any) {
      setMessage(err.message)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Management"
        title="Departments"
        description="Academic departments and their staffing."
        actions={<Button size="sm" onClick={() => { setMessage(''); setAdding(true) }}><Plus className="h-4 w-4" /> Add department</Button>}
      />
      {message && <p className="mb-4 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">{message}</p>}
      <ResourceTable rows={rows} columns={columns} searchKeys={['name', 'code']} searchPlaceholder="Search departments…" />
      {adding && (
        <Modal title="Add department" onClose={() => setAdding(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <Input label="Department name" name="name" required />
            <Input label="Code" name="code" placeholder="e.g. CS" required />
            <Button type="submit" className="w-full" loading={create.isPending}>Create department</Button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export function AdminSessions() {
  const [adding, setAdding] = useState(false)
  const [message, setMessage] = useState('')
  const { data, isLoading, error, refetch } = useApiQuery<any>(['admin', 'sessions'], '/admin/sessions')
  const create = useApiMutation((payload: any) => api.post('/admin/sessions', payload), [['admin', 'sessions'], ['admin', 'overview']])
  const activate = useApiMutation((id: string) => api.patch(`/admin/sessions/${id}/activate`), [['admin', 'sessions'], ['admin', 'overview']])

  if (isLoading) return <SkeletonPage />
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  const rows: any[] = data?.sessions ?? []
  const columns: Column<any>[] = [
    { key: 'name', header: 'Session', render: (r) => <span className="font-medium text-navy-900">{r.name}</span> },
    { key: 'start', header: 'Start', render: (r) => fmtDate(r.start) },
    { key: 'end', header: 'End', render: (r) => fmtDate(r.end) },
    { key: 'projects', header: 'Projects' },
    { key: 'active', header: 'Status', render: (r) => <Badge variant={r.active ? 'success' : 'neutral'}>{r.active ? 'Active' : 'Archived'}</Badge> },
    { key: 'action', header: '', className: 'text-right', render: (r) => !r.active ? <Button variant="ghost" size="sm" onClick={() => activate.mutate(r.id)}>Set active</Button> : null },
  ]

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setMessage('')
    const form = new FormData(e.currentTarget)
    try {
      const res: any = await create.mutateAsync({
        name: form.get('name'),
        startDate: form.get('startDate'),
        endDate: form.get('endDate'),
        isActive: form.get('isActive') === 'on',
      })
      setMessage(res.data?.message || 'Session created')
      setAdding(false)
    } catch (err: any) {
      setMessage(err.message)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Management"
        title="Academic sessions"
        description="Configure semesters and the active FYP cycle."
        actions={<Button size="sm" onClick={() => { setMessage(''); setAdding(true) }}><Plus className="h-4 w-4" /> New session</Button>}
      />
      {message && <p className="mb-4 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">{message}</p>}
      <ResourceTable rows={rows} columns={columns} searchKeys={['name']} searchPlaceholder="Search sessions…" />
      {adding && (
        <Modal title="New academic session" onClose={() => setAdding(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <Input label="Session name" name="name" placeholder="e.g. Fall 2026" required />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Start date" type="date" name="startDate" required />
              <Input label="End date" type="date" name="endDate" required />
            </div>
            <label className="flex items-center gap-2 text-sm text-navy-600">
              <input type="checkbox" name="isActive" className="h-4 w-4 rounded border-navy-300 text-brand-600" /> Set as active session
            </label>
            <Button type="submit" className="w-full" loading={create.isPending}>Create session</Button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export function AdminProjects() {
  const { data, isLoading, error, refetch } = useApiQuery<any>(['admin', 'projects'], '/admin/projects')
  if (isLoading) return <SkeletonPage />
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  const rows: any[] = data?.projects ?? []
  const columns: Column<any>[] = [
    { key: 'title', header: 'Project', render: (r) => <div><p className="max-w-[240px] truncate font-medium text-navy-900">{r.title}</p><p className="text-xs text-navy-400">{r.supervisor}</p></div> },
    { key: 'dept', header: 'Department' },
    { key: 'team', header: 'Team', render: (r) => <span>{r.team} member{r.team === 1 ? '' : 's'}</span> },
    { key: 'progress', header: 'Progress', render: (r) => <span className="text-xs text-navy-500">{r.progress}%</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusPill status={r.status} /> },
    { key: 'health', header: 'Health', render: (r) => <HealthPill level={r.health} /> },
  ]

  return (
    <div>
      <PageHeader eyebrow="Management" title="Projects" description="All projects across departments and sessions." />
      <div className="mb-5 grid gap-4 sm:grid-cols-4">
        <StatCard label="Total projects" value={rows.length} icon={FolderKanban} tone="brand" />
        <StatCard label="At risk" value={rows.filter((r) => r.health !== 'LOW').length} icon={AlertTriangle} tone="danger" />
        <StatCard label="In progress" value={rows.filter((r) => r.status === 'IN_PROGRESS').length} icon={TrendingUp} tone="success" />
        <StatCard label="Completed" value={rows.filter((r) => r.status === 'COMPLETED').length} icon={CheckCircle2} tone="info" />
      </div>
      <ResourceTable rows={rows} columns={columns} searchKeys={['title', 'dept', 'supervisor']} searchPlaceholder="Search projects…" filter={{ label: 'Status', key: 'status', options: Array.from(new Set(rows.map((r) => r.status))) }} />
    </div>
  )
}

export function AdminProposals() {
  const [active, setActive] = useState<any>(null)
  const [comments, setComments] = useState('')
  const [message, setMessage] = useState('')
  const { data, isLoading, error, refetch } = useApiQuery<any>(['admin', 'proposals'], '/admin/proposals', { refetchInterval: 15_000 })
  const decide = useApiMutation(
    ({ id, status }: { id: string; status: string }) => api.patch(`/admin/proposals/${id}/decision`, { status, comments }),
    [['admin', 'proposals'], ['admin', 'overview'], ['admin', 'projects'], ['admin', 'assignments']]
  )

  if (isLoading) return <SkeletonPage />
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  const rows: any[] = data?.proposals ?? []
  const columns: Column<any>[] = [
    { key: 'title', header: 'Proposal', render: (r) => <div><p className="max-w-[260px] truncate font-medium text-navy-900">{r.title}</p><p className="text-xs text-navy-400">{r.project}</p></div> },
    { key: 'student', header: 'Student' },
    { key: 'submitted', header: 'Submitted', render: (r) => <span className="text-xs text-navy-500">{fmtDate(r.submitted)}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusPill status={r.status} /> },
    { key: 'action', header: 'Decision', render: (r) => <Button variant="outline" size="sm" onClick={() => { setActive(r); setComments(r.comments || ''); setMessage('') }}>Review</Button> },
  ]

  const submitDecision = async (status: string) => {
    if (!active) return
    setMessage('')
    try {
      const res: any = await decide.mutateAsync({ id: active.id, status })
      setMessage(res.data?.message || 'Decision saved')
      setActive(null)
    } catch (err: any) {
      setMessage(err.message)
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Management" title="Proposal approvals" description="Review proposals and manage approval decisions." />
      {message && <p className="mb-4 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">{message}</p>}
      <ResourceTable rows={rows} columns={columns} searchKeys={['title', 'student', 'project']} searchPlaceholder="Search proposals…" filter={{ label: 'Status', key: 'status', options: Array.from(new Set(rows.map((r) => r.status))) }} />

      {active && (
        <Modal title={active.title} subtitle={`${active.student} · ${active.project}`} onClose={() => setActive(null)}>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-700">Decision comments (optional)</label>
              <textarea rows={4} value={comments} onChange={(e) => setComments(e.target.value)} className={textareaClass} placeholder="Feedback for the student…" />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="primary" loading={decide.isPending} onClick={() => submitDecision('PROPOSAL_APPROVED')}>Approve</Button>
              <Button variant="outline" loading={decide.isPending} onClick={() => submitDecision('PROPOSAL_REVISION_REQUIRED')}>Request revision</Button>
              <Button variant="danger" loading={decide.isPending} onClick={() => submitDecision('PROPOSAL_REJECTED')}>Reject</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export function AdminAssignments() {
  const [active, setActive] = useState<any>(null)
  const [supervisorId, setSupervisorId] = useState('')
  const [message, setMessage] = useState('')
  const { data, isLoading, error, refetch } = useApiQuery<any>(['admin', 'assignments'], '/admin/assignments')
  const assign = useApiMutation(
    (payload: { projectId: string; supervisorId: string }) => api.post('/admin/assignments', payload),
    [['admin', 'assignments'], ['admin', 'projects'], ['admin', 'overview']]
  )
  const recommendationsQ = useApiQuery<any>(
    ['admin', 'assignment-recommendations', active?.id ?? 'none'],
    `/admin/assignments/recommendations?projectId=${active?.id ?? ''}`,
    { enabled: !!active }
  )

  if (isLoading) return <SkeletonPage />
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  const rows: any[] = data?.assignments ?? []
  const supervisors: any[] = data?.supervisors ?? []
  const columns: Column<any>[] = [
    { key: 'title', header: 'Project', render: (r) => <span className="font-medium text-navy-900">{r.title}</span> },
    { key: 'student', header: 'Student' },
    { key: 'supervisor', header: 'Supervisor', render: (r) => <span className={r.supervisor === 'Unassigned' ? 'text-amber-600' : ''}>{r.supervisor}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusPill status={r.status} /> },
    { key: 'action', header: 'Action', render: (r) => <Button variant="outline" size="sm" onClick={() => { setActive(r); setSupervisorId(r.supervisorId || ''); setMessage('') }}>{r.supervisorId ? 'Reassign' : 'Assign'}</Button> },
  ]

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!active || !supervisorId) return
    setMessage('')
    try {
      const res: any = await assign.mutateAsync({ projectId: active.id, supervisorId })
      setMessage(res.data?.message || 'Supervisor assigned')
      setActive(null)
    } catch (err: any) {
      setMessage(err.message)
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Management" title="Supervisor assignments" description="Assign and reassign supervisors. Changes are recorded in the audit log." />
      {message && <p className="mb-4 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">{message}</p>}
      <ResourceTable rows={rows} columns={columns} searchKeys={['title', 'student', 'supervisor']} searchPlaceholder="Search assignments…" />
      {active && (
        <Modal title="Assign supervisor" subtitle={active.title} onClose={() => setActive(null)}>
          <form onSubmit={submit} className="space-y-4">
            <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-navy-900">
                  <Sparkles className="h-4 w-4 text-brand-600" /> Smart supervisor match
                </p>
                <Badge variant="brand">Ranked by fit</Badge>
              </div>
              <p className="mt-1 text-xs text-navy-500">Based on research overlap, department, availability, and current workload.</p>
              {recommendationsQ.isLoading ? (
                <div className="mt-3 space-y-2">
                  {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-white/80" />)}
                </div>
              ) : recommendationsQ.error ? (
                <p className="mt-3 text-xs text-red-600">{(recommendationsQ.error as Error).message}</p>
              ) : (
                <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                  {(recommendationsQ.data?.recommendations ?? []).map((r: any) => (
                    <div
                      key={r.id}
                      className={cn(
                        'rounded-lg border bg-white p-3 transition-colors',
                        supervisorId === r.id ? 'border-brand-500 ring-2 ring-brand-500/15' : 'border-navy-200'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-navy-900">{r.name}</p>
                          <p className="text-[11px] text-navy-400">{r.department} · {r.load}/{r.capacity} supervised</p>
                        </div>
                        <span className={cn(
                          'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold',
                          r.score >= 70 ? 'bg-emerald-50 text-emerald-700' : r.score >= 45 ? 'bg-amber-50 text-amber-700' : 'bg-navy-100 text-navy-500'
                        )}>
                          {r.score}% match
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {r.reasons.slice(0, 2).map((reason: string) => (
                          <span key={reason} className="rounded-md bg-navy-50 px-1.5 py-0.5 text-[10px] font-medium text-navy-500">{reason}</span>
                        ))}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={supervisorId === r.id ? 'primary' : 'outline'}
                        className="mt-2.5 h-8 w-full text-xs"
                        onClick={() => setSupervisorId(r.id)}
                      >
                        {supervisorId === r.id ? 'Selected' : 'Choose supervisor'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Select label="Or choose manually" value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)} required>
              <option value="" disabled>Select a supervisor</option>
              {supervisors.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.capacity} capacity)</option>)}
            </Select>
            <Button type="submit" className="w-full" loading={assign.isPending} disabled={!supervisorId}>Save assignment</Button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export function AdminDeadlines() {
  const [adding, setAdding] = useState(false)
  const [message, setMessage] = useState('')
  const { data, isLoading, error, refetch } = useApiQuery<any>(['admin', 'deadlines'], '/admin/deadlines')
  const create = useApiMutation((payload: any) => api.post('/admin/deadlines', payload), [['admin', 'deadlines']])

  if (isLoading) return <SkeletonPage />
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  const rows: any[] = data?.deadlines ?? []
  const columns: Column<any>[] = [
    { key: 'title', header: 'Deadline', render: (r) => <span className="font-medium text-navy-900">{r.title}</span> },
    { key: 'date', header: 'Date', render: (r) => fmtDate(r.date) },
    { key: 'scope', header: 'Scope' },
    { key: 'status', header: 'Status', render: (r) => <StatusPill status={r.status} /> },
  ]

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setMessage('')
    const form = new FormData(e.currentTarget)
    try {
      const res: any = await create.mutateAsync({ title: form.get('title'), date: form.get('date'), scope: form.get('scope'), status: form.get('status') })
      setMessage(res.data?.message || 'Deadline created')
      setAdding(false)
    } catch (err: any) {
      setMessage(err.message)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Management"
        title="Deadlines"
        description="University-wide submission and defense deadlines."
        actions={<Button size="sm" onClick={() => { setMessage(''); setAdding(true) }}><Plus className="h-4 w-4" /> Add deadline</Button>}
      />
      {message && <p className="mb-4 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">{message}</p>}
      <ResourceTable rows={rows} columns={columns} searchKeys={['title', 'scope']} searchPlaceholder="Search deadlines…" />
      {adding && (
        <Modal title="Add deadline" onClose={() => setAdding(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <Input label="Title" name="title" required />
            <Input label="Date" type="date" name="date" required />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Scope" name="scope" defaultValue="All departments" />
              <Select label="Status" name="status" defaultValue="NOT_STARTED">
                <option value="NOT_STARTED">Not started</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="COMPLETED">Completed</option>
              </Select>
            </div>
            <Button type="submit" className="w-full" loading={create.isPending}>Create deadline</Button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export function AdminEvaluations() {
  const [message, setMessage] = useState('')
  const { data, isLoading, error, refetch } = useApiQuery<any>(['admin', 'evaluations'], '/admin/evaluations')
  const release = useApiMutation((projectId?: string) => api.post('/admin/evaluations/release', projectId ? { projectId } : {}), [['admin', 'evaluations']])

  if (isLoading) return <SkeletonPage />
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  const { rubric, criteria, evaluations, stats } = data
  const rows: any[] = evaluations ?? []

  const doRelease = async (projectId?: string) => {
    setMessage('')
    try {
      const res: any = await release.mutateAsync(projectId)
      setMessage(res.data?.message || 'Results released')
    } catch (err: any) {
      setMessage(err.message)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Evaluation"
        title="Evaluations & rubrics"
        description="Monitor rubric criteria and release results to students."
        actions={<Button size="sm" loading={release.isPending} onClick={() => doRelease()}><Award className="h-4 w-4" /> Release all results</Button>}
      />
      {message && <p className="mb-4 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">{message}</p>}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <SectionHeader title={rubric?.name ?? 'Evaluation rubric'} description={rubric ? `${rubric.description} · total weight ${rubric.totalWeight}%` : 'No active rubric'} />
          <div className="mt-4 overflow-hidden rounded-xl border border-navy-100">
            <table className="w-full text-sm">
              <thead><tr className="bg-navy-50/60 text-left text-xs font-semibold uppercase tracking-wide text-navy-400"><th className="px-4 py-2.5">Criterion</th><th className="px-4 py-2.5">Max</th><th className="px-4 py-2.5">Weight</th></tr></thead>
              <tbody className="divide-y divide-navy-100">
                {(criteria ?? []).length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-navy-400">No rubric criteria configured.</td></tr>}
                {(criteria ?? []).map((c: any) => (
                  <tr key={c.id}><td className="px-4 py-3 font-medium text-navy-800">{c.criterion}</td><td className="px-4 py-3 text-navy-500">{c.max}</td><td className="px-4 py-3 text-navy-500">{c.weight}%</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-lg bg-navy-50 px-4 py-2.5 text-sm"><span className="font-medium text-navy-700">Total weight</span><span className="font-semibold text-navy-900">{(criteria ?? []).reduce((a: number, c: any) => a + c.weight, 0)}%</span></div>

          <div className="mt-6">
            <SectionHeader title="Evaluations" description={`${stats.evaluated} of ${stats.totalProjects} projects evaluated`} />
            <div className="mt-3 overflow-hidden rounded-xl border border-navy-100">
              <table className="w-full text-sm">
                <thead><tr className="bg-navy-50/60 text-left text-xs font-semibold uppercase tracking-wide text-navy-400"><th className="px-4 py-2.5">Project</th><th className="px-4 py-2.5">Score</th><th className="px-4 py-2.5">Released</th><th className="px-4 py-2.5"></th></tr></thead>
                <tbody className="divide-y divide-navy-100">
                  {rows.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-navy-400">No evaluations recorded.</td></tr>}
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 font-medium text-navy-800">{r.project}</td>
                      <td className="px-4 py-3 text-navy-600">{r.totalScore} / 100</td>
                      <td className="px-4 py-3"><Badge variant={r.isReleased ? 'success' : 'warning'}>{r.isReleased ? 'Released' : 'Pending'}</Badge></td>
                      <td className="px-4 py-3 text-right">{!r.isReleased && <Button variant="ghost" size="sm" loading={release.isPending} onClick={() => doRelease(r.projectId)}>Release</Button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
        <div className="space-y-5">
          <Card className="p-6 text-center">
            <p className="text-sm font-medium text-navy-500">Projects evaluated</p>
            <p className="mt-2 font-display text-4xl font-bold text-navy-900">{stats.evaluated}<span className="text-xl text-navy-400">/{stats.totalProjects}</span></p>
            <Badge variant="warning" className="mt-3">{stats.awaitingRelease} awaiting release</Badge>
          </Card>
          <Card className="p-5">
            <SectionHeader title="Top score" />
            {stats.topScore ? (
              <>
                <p className="mt-2 text-sm text-navy-700">{stats.topScore.project}</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.topScore.score}/100</p>
              </>
            ) : (
              <p className="mt-2 text-sm text-navy-400">No evaluations yet.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

export function AdminReports() {
  const { data, isLoading, error, refetch } = useApiQuery<any>(['admin', 'reports'], '/admin/reports')
  const projectsQ = useApiQuery<any>(['admin', 'projects'], '/admin/projects')

  if (isLoading) return <SkeletonPage />
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  const { stats, projectsByStatus, departmentPerformance, monthly } = data
  const projects: any[] = projectsQ.data?.projects ?? []

  const exportCsv = () =>
    downloadCsv(
      'university-report.csv',
      ['Project', 'Department', 'Supervisor', 'Status', 'Health', 'Risk score', 'Progress'],
      projects.map((p) => [p.title, p.dept, p.supervisor, p.status, p.health, p.riskScore, `${p.progress}%`])
    )

  return (
    <div>
      <PageHeader
        eyebrow="Reports"
        title="University reports"
        description="Session, department, supervisor, and status breakdowns."
        actions={<Button size="sm" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Projects" value={stats.totalProjects} icon={FolderKanban} tone="brand" />
        <StatCard label="Students" value={stats.totalStudents} icon={GraduationCap} tone="info" />
        <StatCard label="Supervisors" value={stats.totalSupervisors} icon={Users} tone="success" />
        <StatCard label="At risk" value={stats.atRisk} icon={AlertTriangle} tone="danger" />
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <SectionHeader title="Status distribution" />
          <div className="mt-2 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={projectsByStatus} dataKey="count" nameKey="status" innerRadius={50} outerRadius={85} paddingAngle={3} strokeWidth={0}>
                  {(projectsByStatus as any[]).map((entry, i) => <Cell key={entry.status} fill={palette[i % palette.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <SectionHeader title="Department comparison" />
          <div className="mt-2 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departmentPerformance} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="dept" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Bar dataKey="projects" name="Projects" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      <Card className="mt-5 p-5">
        <SectionHeader title="Projects created (last 6 months)" />
        <div className="mt-2 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Bar dataKey="projects" fill="#0ea5e9" radius={[6, 6, 0, 0]} barSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
}

/**
 * System mail outbox. With no SMTP provider configured, password-reset links
 * and other system mail are queued here with copyable links so the FYP office
 * can relay them to recipients.
 */
export function AdminMail() {
  const { data, isLoading, error, refetch } = useApiQuery<any>(['admin', 'mail'], '/admin/mail', { refetchInterval: 30_000 })
  const consume = useApiMutation((id: string) => api.post(`/admin/mail/${id}/consumed`), [['admin', 'mail']])
  if (isLoading) return <SkeletonPage />
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
  const rows: any[] = data?.mail ?? []

  return (
    <div>
      <PageHeader
        eyebrow="System"
        title="Mail outbox"
        description="Mail is delivered by email when SMTP is configured. Anything that fails to send is queued here so you can copy the link or code and relay it manually."
        actions={<Button size="sm" variant="outline" onClick={() => refetch()}>Refresh</Button>}
      />
      <div className="space-y-3">
        {rows.length === 0 && <EmptyState icon={Mail} title="Outbox empty" description="Password-reset requests will appear here." />}
        {rows.map((m) => (
          <Card key={m.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-navy-900">{m.subject}</p>
                <p className="text-xs text-navy-400">To {m.to} · {fmtDateTime(m.queuedAt)} {m.consumed && '· delivered'}</p>
                {m.body && <p className="mt-1.5 whitespace-pre-line text-sm text-navy-600">{m.body}</p>}
                {m.links.map((l: string) => (
                  <p key={l} className="mt-1.5 break-all font-mono text-xs text-brand-600">{l}</p>
                ))}
              </div>
              <div className="flex shrink-0 gap-2">
                {m.links[0] && (
                  <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(m.links[0])}>
                    <Copy className="h-3.5 w-3.5" /> Copy link
                  </Button>
                )}
                {!m.consumed && m.links[0] && (
                  <Button size="sm" loading={consume.isPending} onClick={() => consume.mutateAsync(m.id)}>Mark delivered</Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function AdminAuditLogs() {
  const { data, isLoading, error, refetch } = useApiQuery<any>(['admin', 'audit-logs'], '/admin/audit-logs')
  if (isLoading) return <SkeletonPage />
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  const rows: any[] = data?.logs ?? []
  const columns: Column<any>[] = [
    { key: 'actor', header: 'Actor', render: (r) => <span className="font-medium text-navy-900">{r.actor}</span> },
    { key: 'action', header: 'Action' },
    { key: 'target', header: 'Target', render: (r) => <span className="text-navy-600">{r.target || r.entityType}</span> },
    { key: 'time', header: 'Timestamp', render: (r) => <span className="text-xs text-navy-500">{fmtDateTime(r.time)}</span> },
  ]

  const exportLog = () =>
    downloadCsv('audit-log.csv', ['Actor', 'Action', 'Target', 'Entity', 'Timestamp'], rows.map((r) => [r.actor, r.action, r.target, r.entityType, fmtDateTime(r.time)]))

  return (
    <div>
      <PageHeader
        eyebrow="System"
        title="Audit logs"
        description="A record of important workflow and administrative actions."
        actions={<Button variant="outline" size="sm" onClick={exportLog}><Download className="h-4 w-4" /> Export log</Button>}
      />
      <ResourceTable rows={rows} columns={columns} searchKeys={['actor', 'action', 'target']} searchPlaceholder="Search audit log…" pageSize={10} />
    </div>
  )
}

export function AdminSettings() {
  const { data, isLoading, error, refetch } = useApiQuery<any>(['admin', 'settings'], '/admin/settings')
  const [message, setMessage] = useState('')
  const save = useApiMutation((payload: any) => api.put('/admin/settings', payload), [['admin', 'settings']])

  if (isLoading) return <SkeletonPage />
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  const s = data?.settings ?? {}

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setMessage('')
    const form = new FormData(e.currentTarget)
    const num = (key: string, fallback: number) => {
      const value = Number(form.get(key))
      return Number.isFinite(value) && value > 0 ? value : fallback
    }
    const payload = {
      teamMin: num('teamMin', 2),
      teamMax: num('teamMax', 4),
      minCgpa: Number(form.get('minCgpa')) || 2,
      allowPreferredSupervisor: form.get('allowPreferredSupervisor') === 'on',
      requireChangeApproval: form.get('requireChangeApproval') === 'on',
      mediumThreshold: num('mediumThreshold', 25),
      highThreshold: num('highThreshold', 50),
      inactivityDays: num('inactivityDays', 14),
      revisionFlag: num('revisionFlag', 3),
      notifications: {
        proposal: form.get('notif_proposal') === 'on',
        submission: form.get('notif_submission') === 'on',
        milestone: form.get('notif_milestone') === 'on',
        evaluation: form.get('notif_evaluation') === 'on',
      },
      security: {
        sessionDays: num('sessionDays', 7),
        rateLimit: form.get('rateLimit') === 'on',
        auditLogging: form.get('auditLogging') === 'on',
      },
    }
    try {
      const res: any = await save.mutateAsync(payload)
      setMessage(res.data?.message || 'Settings saved')
    } catch (err: any) {
      setMessage(err.message)
    }
  }

  return (
    <div>
      <PageHeader eyebrow="System" title="Settings" description="Platform-wide configuration and academic rules." />
      <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-2">
        <Card className="p-6">
          <SectionHeader title="Team & eligibility rules" description="Applied when students form teams" />
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Minimum team size" type="number" name="teamMin" defaultValue={s.teamMin} />
              <Input label="Maximum team size" type="number" name="teamMax" defaultValue={s.teamMax} />
            </div>
            <Input label="Minimum CGPA for FYP" type="number" step="0.01" name="minCgpa" defaultValue={s.minCgpa} />
            <label className="flex items-center gap-2 text-sm text-navy-600">
              <input type="checkbox" name="allowPreferredSupervisor" defaultChecked={s.allowPreferredSupervisor} className="h-4 w-4 rounded border-navy-300 text-brand-600" /> Allow students to request preferred supervisors
            </label>
            <label className="flex items-center gap-2 text-sm text-navy-600">
              <input type="checkbox" name="requireChangeApproval" defaultChecked={s.requireChangeApproval} className="h-4 w-4 rounded border-navy-300 text-brand-600" /> Require coordinator approval for supervisor changes
            </label>
          </div>
        </Card>

        <Card className="p-6">
          <SectionHeader title="Project Health thresholds" description="Rule-based monitor configuration" />
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Medium risk from (score)" type="number" name="mediumThreshold" defaultValue={s.mediumThreshold} />
              <Input label="High risk from (score)" type="number" name="highThreshold" defaultValue={s.highThreshold} />
            </div>
            <Input label="Inactivity threshold (days)" type="number" name="inactivityDays" defaultValue={s.inactivityDays} />
            <Input label="Revision requests before flag" type="number" name="revisionFlag" defaultValue={s.revisionFlag} />
            <p className="text-xs text-navy-400">Scores are recalculated when milestones, submissions, or reviews change.</p>
          </div>
        </Card>

        <Card className="p-6">
          <SectionHeader title="Notifications" description="Per-event notification preferences" />
          <div className="mt-4 space-y-3">
            {[
              { key: 'proposal', label: 'New proposal submitted' },
              { key: 'submission', label: 'Submission ready for review' },
              { key: 'milestone', label: 'Milestone overdue' },
              { key: 'evaluation', label: 'Evaluation released' },
            ].map((n) => (
              <label key={n.key} className="flex items-center justify-between rounded-lg border border-navy-100 px-3 py-2.5 text-sm text-navy-700">
                {n.label}<input type="checkbox" name={`notif_${n.key}`} defaultChecked={!!s.notifications?.[n.key]} className="h-4 w-4 rounded border-navy-300 text-brand-600" />
              </label>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <SectionHeader title="Security" description="Session and access policy" />
          <div className="mt-4 space-y-3 text-sm text-navy-600">
            <div className="flex items-center justify-between rounded-lg bg-navy-50 px-3 py-2.5"><span>Password hashing</span><Badge variant="success">Argon2id</Badge></div>
            <div className="flex items-center justify-between gap-3 rounded-lg bg-navy-50 px-3 py-2.5">
              <span>Session expiry (days)</span>
              <input type="number" name="sessionDays" defaultValue={s.security?.sessionDays ?? 7} className="h-8 w-20 rounded-lg border border-navy-200 bg-white px-2 text-right text-sm" />
            </div>
            <label className="flex items-center justify-between rounded-lg bg-navy-50 px-3 py-2.5">
              <span>Rate limiting</span><input type="checkbox" name="rateLimit" defaultChecked={!!s.security?.rateLimit} className="h-4 w-4 rounded border-navy-300 text-brand-600" />
            </label>
            <label className="flex items-center justify-between rounded-lg bg-navy-50 px-3 py-2.5">
              <span>Audit logging</span><input type="checkbox" name="auditLogging" defaultChecked={!!s.security?.auditLogging} className="h-4 w-4 rounded border-navy-300 text-brand-600" />
            </label>
          </div>
        </Card>

        <div className="flex items-center gap-3 lg:col-span-2">
          <Button type="submit" loading={save.isPending}><Save className="h-4 w-4" /> Save changes</Button>
          {message && <span className="text-sm font-medium text-brand-700">{message}</span>}
        </div>
      </form>
    </div>
  )
}

export function AdminSimilarity() {
  const { data, isLoading, error, refetch } = useApiQuery<any>(['admin', 'similarity'], '/admin/similarity')

  if (isLoading) return <SkeletonPage />
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  const pairs: any[] = data?.pairs ?? []

  return (
    <div>
      <PageHeader
        eyebrow="Integrity"
        title="Proposal similarity"
        description="Compares every proposal in the session pairwise on demand, with shared terms and teams highlighted for review."
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Proposals checked" value={data?.checked ?? 0} icon={FolderKanban} tone="brand" />
        <StatCard label="Flagged pairs" value={data?.flaggedCount ?? 0} icon={AlertTriangle} tone={data?.flaggedCount ? 'danger' : 'success'} />
        <StatCard label="Highest similarity" value={`${Math.round((data?.highest ?? 0) * 100)}%`} icon={TrendingUp} tone="info" />
        <StatCard label="Flag threshold" value={`${Math.round((data?.flaggedThreshold ?? 0) * 100)}%`} icon={ShieldCheck} tone="info" />
      </div>

      {pairs.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            icon={Copy}
            title="No similar proposals detected"
            description="Every checked proposal sits below the 28% flag threshold. This changes automatically as more teams submit proposals."
          />
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {pairs.map((p, i) => (
            <Card key={`${p.aId}-${p.bId}-${i}`} className={cn('p-5', p.flagged && 'border-red-200 bg-red-50/40')}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={p.flagged ? 'danger' : 'neutral'}>
                      <Copy className="h-3.5 w-3.5" /> {Math.round(p.similarity * 100)}% similar
                    </Badge>
                    {p.flagged && <Badge variant="warning">Manual review</Badge>}
                  </div>
                  <p className="mt-2 truncate text-sm font-semibold text-navy-900">{p.aTitle}</p>
                  <p className="text-xs text-navy-400">{p.aProject} {p.aMembers?.length ? `· ${p.aMembers.join(', ')}` : ''}</p>
                  <p className="mt-1.5 truncate text-sm font-semibold text-navy-900">{p.bTitle}</p>
                  <p className="text-xs text-navy-400">{p.bProject} {p.bMembers?.length ? `· ${p.bMembers.join(', ')}` : ''}</p>
                </div>
                <div className="w-full shrink-0 sm:w-72">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-navy-100">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        p.flagged ? 'bg-red-500' : p.similarity >= (data?.flaggedThreshold ?? 0.28) * 0.8 ? 'bg-amber-500' : 'bg-emerald-500'
                      )}
                      style={{ width: `${Math.min(100, Math.round(p.similarity * 100))}%` }}
                    />
                  </div>
                  {p.sharedTerms?.length > 0 && (
                    <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-navy-400">
                      Shared terms: {p.sharedTerms.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <p className="mt-4 text-xs text-navy-400">
        Similarity percentages highlight proposals worth reviewing together — flagged pairs are meant for a supervisor conversation, not an automatic judgment.
      </p>
    </div>
  )
}
