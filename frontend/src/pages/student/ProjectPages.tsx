import { useState } from 'react'
import {
  FolderKanban, Users, ListChecks, UploadCloud, MessageSquare, FileText,
  Clock, CheckCircle2, AlertTriangle, Plus, Send, Lock, Trash2,
} from 'lucide-react'
import { PageHeader, StatCard, StatusPill, SectionHeader, EmptyState, ErrorState, SkeletonPage } from '@/components/shared/Common'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Progress, Avatar } from '@/components/ui/Feedback'
import { fmtDate, fmtDateTime, relativeTime, titleCase } from '@/lib/format'
import { useApiQuery, useApiMutation } from '@/hooks/useApi'
import { useAuth } from '@/context/AuthContext'
import api from '@/lib/api'
import { GitHubFeed } from '@/components/GitHubFeed'

const textareaClass =
  'w-full rounded-xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm text-navy-900 shadow-sm transition-colors placeholder:text-navy-400 hover:border-navy-300 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10'

const statusVariant = (status: string): 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' => {
  if (['PROPOSAL_APPROVED', 'APPROVED', 'COMPLETED', 'ACTIVE'].includes(status)) return 'success'
  if (['PROPOSAL_REJECTED', 'REJECTED'].includes(status)) return 'danger'
  if (['PROPOSAL_REVISION_REQUIRED', 'NEEDS_REVISION'].includes(status)) return 'warning'
  if (['PROPOSAL_SUBMITTED', 'PROPOSAL_UNDER_REVIEW', 'UNDER_REVIEW'].includes(status)) return 'info'
  if (['PROPOSAL_DRAFT', 'NOT_STARTED', 'PENDING'].includes(status)) return 'neutral'
  return 'brand'
}

export function StudentProject() {
  const { data, isLoading, error, refetch } = useApiQuery<any>(['student', 'project'], '/student/project')
  const submissionsQ = useApiQuery<any>(['student', 'submissions'], '/student/submissions')

  if (isLoading) return <SkeletonPage />
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
  if (!data) return null

  const { project, team, health, timeline } = data
  const submissions = submissionsQ.data?.submissions ?? []
  const completed = (data.milestones as any[]).filter((m) => m.status === 'COMPLETED').length
  const level = (health.level || 'LOW') as 'LOW' | 'MEDIUM' | 'HIGH'
  const gradient = level === 'HIGH' ? 'from-red-500 to-rose-600' : level === 'LOW' ? 'from-emerald-500 to-teal-600' : 'from-amber-500 to-orange-600'

  return (
    <div>
      <PageHeader
        eyebrow="Project Workspace"
        title={project.title}
        description={`${project.department} · ${project.session} · Supervisor ${project.supervisor}`}
        actions={<Badge variant={statusVariant(project.status)}>{titleCase(project.status)}</Badge>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Completion" value={`${project.progress}%`} icon={FolderKanban} tone="brand" />
        <StatCard label="Milestones done" value={`${completed} / ${data.milestones.length}`} icon={ListChecks} tone="success" />
        <StatCard label="Submissions" value={submissions.length} icon={UploadCloud} tone="info" />
        <StatCard label="Team size" value={project.teamSize ?? team.length} icon={Users} tone="warning" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card className="p-6 xl:col-span-2">
          <SectionHeader title="Project overview" />
          <p className="mt-3 text-sm leading-relaxed text-navy-600">{project.abstract || 'No abstract has been provided yet.'}</p>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {[
              { k: 'Supervisor', v: project.supervisor },
              { k: 'Department', v: project.department },
              { k: 'Session', v: project.session },
              { k: 'Started', v: fmtDate(project.started) },
              { k: 'Defense', v: fmtDate(project.defenseDate) },
              { k: 'Stage', v: project.stage || '—' },
            ].map((x) => (
              <div key={x.k} className="rounded-xl bg-navy-50/60 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-navy-400">{x.k}</p>
                <p className="mt-0.5 text-sm font-medium text-navy-800">{x.v}</p>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <div className="flex items-center justify-between text-sm"><span className="font-medium text-navy-700">Overall progress</span><span className="font-semibold text-navy-900">{project.progress}%</span></div>
            <Progress value={project.progress} className="mt-2 h-2.5" />
          </div>
        </Card>

        <Card className="p-6">
          <SectionHeader title="Project health" />
          <div className={`mt-4 rounded-2xl bg-gradient-to-br ${gradient} p-4 text-white`}>
            <div className="flex items-center justify-between"><span className="text-sm font-semibold">{titleCase(level)} risk</span><span className="font-display text-3xl font-bold">{health.score}</span></div>
            <p className="mt-1 text-xs text-white/80">Last checked {relativeTime(health.lastChecked)}</p>
          </div>
          <ul className="mt-4 space-y-2">
            {(health.reasons as string[]).length === 0 && <li className="text-xs text-navy-500">No risk factors detected.</li>}
            {(health.reasons as string[]).map((r) => (
              <li key={r} className="flex items-start gap-2 text-xs text-navy-600"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" /> {r}</li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-5">
        <SectionHeader title="GitHub contributions" description="Commits, contributors, and repository pulse for the team's repo." />
        <div className="mt-3">
          <GitHubFeed projectId={project.id} />
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card className="p-6">
          <SectionHeader title="Team members" description={`${team.length} members`} />
          <ul className="mt-3 space-y-3">
            {(team as any[]).map((m) => (
              <li key={m.id} className="flex items-center gap-3">
                <Avatar first={m.name.split(' ')[0]} last={m.name.split(' ')[1]} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-navy-800">{m.name}</p>
                  <p className="text-xs text-navy-400">{m.id} · {m.email}</p>
                </div>
                <Badge variant={m.isLead ? 'brand' : 'neutral'}>{m.role}</Badge>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-6">
          <SectionHeader title="Activity timeline" description="Recent workspace events" />
          <ol className="mt-3 space-y-3 border-l border-navy-200 pl-4">
            {(timeline as any[]).length === 0 && <li className="text-xs text-navy-400">No activity recorded yet.</li>}
            {(timeline as any[]).map((a) => (
              <li key={a.id} className="relative">
                <span className="absolute -left-[22px] flex h-4 w-4 items-center justify-center rounded-full bg-white ring-2 ring-brand-200"><span className="h-1.5 w-1.5 rounded-full bg-brand-500" /></span>
                <p className="text-sm text-navy-700">{a.title}</p>
                <p className="text-xs text-navy-400">{relativeTime(a.date)} · {a.actor}</p>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  )
}

export function StudentProposal() {
  const { data, isLoading, error, refetch } = useApiQuery<any>(['student', 'proposal'], '/student/proposal')
  const [message, setMessage] = useState('')
  const proposal = data?.proposal
  const versions: any[] = data?.versions ?? []

  const mutation = useApiMutation(
    (payload: { submit: boolean; values: Record<string, string> }) =>
      api.put('/student/proposal', { ...payload.values, submit: payload.submit }),
    [['student', 'proposal'], ['student', 'overview']]
  )

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setMessage('')
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const submit = submitter?.value === 'submit'
    const form = new FormData(e.currentTarget)
    const values: Record<string, string> = {}
    ;['title', 'abstract', 'problemStatement', 'objectives', 'methodology', 'technologyStack', 'expectedOutcomes'].forEach((k) => {
      values[k] = String(form.get(k) || '')
    })
    if (submit && Object.values(values).some((v) => !v.trim())) {
      setMessage('Complete every section before submitting for review.')
      return
    }
    try {
      const res: any = await mutation.mutateAsync({ submit, values })
      setMessage(res.data?.message || 'Saved')
    } catch (err: any) {
      setMessage(err.message)
    }
  }

  if (isLoading) return <SkeletonPage />
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  const sections = [
    { name: 'abstract', title: 'Abstract' },
    { name: 'problemStatement', title: 'Problem statement' },
    { name: 'objectives', title: 'Objectives' },
    { name: 'methodology', title: 'Methodology' },
    { name: 'technologyStack', title: 'Technology stack' },
    { name: 'expectedOutcomes', title: 'Expected outcomes' },
  ]

  return (
    <div>
      <PageHeader
        eyebrow="Proposal"
        title="Project proposal"
        description={proposal ? `Version ${proposal.version} · ${titleCase(proposal.status)}${proposal.reviewedAt ? ` · reviewed ${fmtDate(proposal.reviewedAt)}` : ''}` : 'Draft and submit your project proposal'}
        actions={proposal ? <Badge variant={statusVariant(proposal.status)}>{titleCase(proposal.status)}</Badge> : undefined}
      />
      <div className="grid gap-5 lg:grid-cols-3">
        <form onSubmit={handleSubmit} className="space-y-5 lg:col-span-2">
          <Card className="p-6">
            <div className="space-y-5">
              <Input label="Proposal title" name="title" defaultValue={proposal?.title || ''} />
              {sections.map((s) => (
                <div key={s.name}>
                  <label className="mb-1.5 block text-sm font-medium text-navy-700">{s.title}</label>
                  <textarea name={s.name} rows={s.name === 'abstract' ? 3 : 4} defaultValue={proposal?.[s.name] || ''} className={textareaClass} />
                </div>
              ))}
            </div>
            {proposal?.reviewComments && (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-semibold">Supervisor comments</p>
                <p className="mt-1">{proposal.reviewComments}</p>
              </div>
            )}
            {message && <p className="mt-4 rounded-lg bg-navy-50 px-3 py-2 text-sm font-medium text-navy-700">{message}</p>}
            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="submit" value="draft" variant="outline" loading={mutation.isPending}>Save draft</Button>
              <Button type="submit" value="submit" loading={mutation.isPending}>Submit for review <Send className="h-4 w-4" /></Button>
            </div>
          </Card>
        </form>

        <div className="space-y-5">
          <Card className="p-5">
            <SectionHeader title="Status" />
            <div className="mt-3 space-y-2 text-sm text-navy-600">
              <p><span className="text-navy-400">Status:</span> {proposal ? titleCase(proposal.status) : 'Not started'}</p>
              <p><span className="text-navy-400">Version:</span> {proposal?.version ?? 0}</p>
              <p><span className="text-navy-400">Submitted:</span> {fmtDate(proposal?.submittedAt)}</p>
              <p><span className="text-navy-400">Supervisor:</span> {proposal?.supervisor ?? 'Unassigned'}</p>
            </div>
          </Card>
          <Card className="p-5">
            <SectionHeader title="Version history" />
            <ul className="mt-3 space-y-2">
              {versions.length === 0 && <li className="text-xs text-navy-400">No submitted versions yet.</li>}
              {versions.map((x) => (
                <li key={x.id} className="flex items-center justify-between rounded-lg border border-navy-100 px-3 py-2">
                  <div><p className="text-sm font-medium text-navy-800">{x.version}</p><p className="text-xs text-navy-400">{fmtDate(x.date)}</p></div>
                  <Badge variant="neutral">{x.note}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}
export function StudentTeam() {
  const { user } = useAuth()
  const { data, isLoading, error, refetch } = useApiQuery<any>(['student', 'team'], '/student/team')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')

  const invite = useApiMutation((payload: { email: string }) => api.post('/student/team/invite', payload), [['student', 'team'], ['student', 'overview'], ['student', 'project']])
  const remove = useApiMutation((id: string) => api.delete(`/student/team/${id}`), [['student', 'team'], ['student', 'overview'], ['student', 'project']])

  if (isLoading) return <SkeletonPage />
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  const team: any[] = data?.team ?? []
  const maxSize = data?.maxSize ?? 4

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    try {
      const res: any = await invite.mutateAsync({ email })
      setMessage(res.data?.message || 'Member added')
      setEmail('')
    } catch (err: any) {
      setMessage(err.message)
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Team" title="Project team" description="Manage your team members. Teams are limited to 4 members by university policy." actions={<Badge variant="brand">{team.length} / {maxSize} members</Badge>} />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {team.map((m) => (
            <Card key={m.id} className="flex items-center gap-4 p-5">
              <Avatar first={m.name.split(' ')[0]} last={m.name.split(' ')[1]} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-navy-900">{m.name}</p>
                <p className="text-xs text-navy-400">{m.id} · {m.email}</p>
              </div>
              <Badge variant={m.isLead ? 'brand' : 'neutral'}>{m.role}</Badge>
              {m.id !== user?.studentId && (
                <button
                  onClick={() => remove.mutate(m.memberId)}
                  disabled={remove.isPending}
                  className="rounded-lg p-2 text-navy-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Remove member"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </Card>
          ))}
        </div>
        <Card className="h-fit p-5">
          <SectionHeader title="Add a member" description="They must be an eligible student." />
          <form className="mt-4 space-y-3" onSubmit={handleInvite}>
            <Input label="Student email" type="email" placeholder="student@university.edu" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Button type="submit" className="w-full" loading={invite.isPending} disabled={team.length >= maxSize}><Plus className="h-4 w-4" /> Add to team</Button>
          </form>
          {message && <p className="mt-3 rounded-lg bg-navy-50 px-3 py-2 text-xs font-medium text-navy-700">{message}</p>}
          <p className="mt-3 flex items-center gap-1.5 text-xs text-navy-400"><Lock className="h-3.5 w-3.5" /> Only registered students can be added.</p>
        </Card>
      </div>
    </div>
  )
}

export function StudentMilestones() {
  const { data, isLoading, error, refetch } = useApiQuery<any>(['student', 'milestones'], '/student/milestones')
  const [message, setMessage] = useState('')
  const update = useApiMutation(
    ({ id, status }: { id: string; status: string }) => api.patch(`/student/milestones/${id}`, { status }),
    [['student', 'milestones'], ['student', 'overview'], ['student', 'project']]
  )

  if (isLoading) return <SkeletonPage />
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  const milestones: any[] = data?.milestones ?? []

  const change = async (id: string, status: string) => {
    setMessage('')
    try {
      await update.mutateAsync({ id, status })
    } catch (err: any) {
      setMessage(err.message)
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Milestones" title="Milestones & tasks" description="Track deliverables, deadlines, and completion." />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Completed" value={milestones.filter((m) => m.status === 'COMPLETED').length} icon={CheckCircle2} tone="success" />
        <StatCard label="In progress" value={milestones.filter((m) => m.status === 'IN_PROGRESS').length} icon={Clock} tone="brand" />
        <StatCard label="Not started" value={milestones.filter((m) => m.status === 'NOT_STARTED').length} icon={ListChecks} tone="warning" />
      </div>
      {message && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{message}</p>}
      <div className="mt-5 space-y-3">
        {milestones.length === 0 && <EmptyState icon={ListChecks} title="No milestones yet" description="Your supervisor or coordinator will add project milestones." />}
        {milestones.map((m) => (
          <Card key={m.id} className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${m.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' : m.status === 'IN_PROGRESS' ? 'bg-brand-50 text-brand-600' : 'bg-navy-100 text-navy-400'}`}>
                  {m.status === 'COMPLETED' ? <CheckCircle2 className="h-5 w-5" /> : <ListChecks className="h-5 w-5" />}
                </span>
                <div>
                  <p className="text-sm font-semibold text-navy-900">{m.title}</p>
                  <p className="text-xs text-navy-400">Due {fmtDate(m.due)} · Owner {m.owner}</p>
                  {m.description && <p className="mt-1 max-w-xl text-xs text-navy-500">{m.description}</p>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-32"><Progress value={m.progress} className="h-1.5" /></div>
                <span className="w-9 text-xs font-medium text-navy-500">{m.progress}%</span>
                <select
                  value={m.status}
                  onChange={(e) => change(m.id, e.target.value)}
                  disabled={update.isPending}
                  className="h-9 rounded-lg border border-navy-200 bg-white px-2 text-xs font-medium text-navy-700 focus:border-brand-400 focus:outline-none"
                >
                  <option value="NOT_STARTED">Not started</option>
                  <option value="IN_PROGRESS">In progress</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="UNDER_REVIEW">Under review</option>
                </select>
                <StatusPill status={m.status} />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function StudentSubmissions() {
  const { data, isLoading, error, refetch } = useApiQuery<any>(['student', 'submissions'], '/student/submissions')
  const [message, setMessage] = useState('')
  const create = useApiMutation(
    (payload: { title: string; type: string; description: string }) => api.post('/student/submissions', payload),
    [['student', 'submissions'], ['student', 'overview'], ['student', 'project']]
  )
  const remove = useApiMutation((id: string) => api.delete(`/student/submissions/${id}`), [['student', 'submissions'], ['student', 'overview']])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setMessage('')
    const form = new FormData(e.currentTarget)
    try {
      const res: any = await create.mutateAsync({
        title: String(form.get('title') || ''),
        type: String(form.get('type') || 'Report'),
        description: String(form.get('description') || ''),
      })
      setMessage(res.data?.message || 'Submitted')
      ;(e.target as HTMLFormElement).reset()
    } catch (err: any) {
      setMessage(err.message)
    }
  }

  const withdraw = async (id: string) => {
    setMessage('')
    try {
      await remove.mutateAsync(id)
    } catch (err: any) {
      setMessage(err.message)
    }
  }

  if (isLoading) return <SkeletonPage />
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  const submissions: any[] = data?.submissions ?? []

  return (
    <div>
      <PageHeader eyebrow="Submissions" title="Documents & deliverables" description="Submit reports, presentations, and supporting documents. Versions are preserved." />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <SectionHeader title="All submissions" description={`${submissions.length} records`} />
          <div className="mt-3 divide-y divide-navy-100">
            {submissions.length === 0 && <p className="py-6 text-sm text-navy-400">No submissions yet.</p>}
            {submissions.map((s) => (
              <div key={s.id} className="flex items-center gap-3 py-3.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><FileText className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-navy-900">{s.title}</p>
                  <p className="text-xs text-navy-400">{s.type} · v{s.version} · {fmtDate(s.submitted)}</p>
                  {s.description && <p className="truncate text-xs text-navy-400">{s.description}</p>}
                </div>
                <StatusPill status={s.status} />
                {s.status === 'PENDING' && (
                  <button onClick={() => withdraw(s.id)} className="rounded-lg p-2 text-navy-400 hover:bg-red-50 hover:text-red-600" aria-label="Withdraw">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>
        <Card className="h-fit p-6">
          <SectionHeader title="New submission" description="A title is required to submit." />
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <Input label="Title" name="title" placeholder="e.g. System Architecture Document" required />
            <Select label="Type" name="type" defaultValue="Report">
              <option>Report</option>
              <option>Presentation</option>
              <option>Code</option>
              <option>Design</option>
              <option>Other</option>
            </Select>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-700">Description</label>
              <textarea name="description" rows={3} className={textareaClass} placeholder="Brief summary of this deliverable" />
            </div>
            <Button type="submit" className="w-full" loading={create.isPending}><Send className="h-4 w-4" /> Submit for review</Button>
          </form>
          {message && <p className="mt-3 rounded-lg bg-navy-50 px-3 py-2 text-xs font-medium text-navy-700">{message}</p>}
          <p className="mt-3 flex items-center gap-1.5 text-xs text-navy-400"><Lock className="h-3.5 w-3.5" /> Submissions are visible to your supervisor only.</p>
        </Card>
      </div>
    </div>
  )
}

export function StudentFeedback() {
  const { data, isLoading, error, refetch } = useApiQuery<any>(['student', 'feedback'], '/student/feedback')
  const [replies, setReplies] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const reply = useApiMutation(({ id, content }: { id: string; content: string }) => api.post(`/student/feedback/${id}/reply`, { content }), [['student', 'feedback']])

  if (isLoading) return <SkeletonPage />
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  const items: any[] = data?.feedback ?? []

  const send = async (id: string) => {
    const content = (replies[id] || '').trim()
    if (!content) return
    setMessage('')
    try {
      const res: any = await reply.mutateAsync({ id, content })
      setReplies((prev) => ({ ...prev, [id]: '' }))
      setMessage(res.data?.message || 'Reply sent')
    } catch (err: any) {
      setMessage(err.message)
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Feedback" title="Supervisor feedback" description="Structured feedback linked to specific submissions and versions." />
      {message && <p className="mb-4 rounded-lg bg-navy-50 px-3 py-2 text-sm font-medium text-navy-700">{message}</p>}
      <div className="space-y-4">
        {items.length === 0 && <EmptyState icon={MessageSquare} title="No feedback yet" description="Feedback from your supervisor will appear here." />}
        {items.map((f) => (
          <Card key={f.id} className="p-5">
            <div className="flex items-start gap-3">
              <Avatar first={f.author.split(' ')[0]} last={f.author.split(' ').slice(-1)[0]} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-navy-900">{f.author}</p>
                  <Badge variant="neutral">{f.authorRole}</Badge>
                  {f.isRevision && <Badge variant="warning">Revision requested</Badge>}
                  <span className="text-xs text-navy-400">{fmtDate(f.date)}</span>
                </div>
                <p className="mt-0.5 text-xs text-navy-400">On {f.submission}</p>
                <p className="mt-2 text-sm leading-relaxed text-navy-700">{f.content}</p>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    value={replies[f.id] || ''}
                    onChange={(e) => setReplies((prev) => ({ ...prev, [f.id]: e.target.value }))}
                    placeholder="Write a reply…"
                    className="h-9 flex-1 rounded-lg border border-navy-200 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-500/10"
                  />
                  <Button size="sm" onClick={() => send(f.id)} loading={reply.isPending}><Send className="h-4 w-4" /> Reply</Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function StudentEvaluations() {
  const { data, isLoading, error, refetch } = useApiQuery<any>(['student', 'evaluations'], '/student/evaluations')

  if (isLoading) return <SkeletonPage />
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  const evaluations: any[] = data?.evaluations ?? []
  const defense = data?.defense
  const total = evaluations.reduce((a, b) => a + (b.score || 0), 0)
  const max = evaluations.reduce((a, b) => a + (b.max || 0), 0)

  return (
    <div>
      <PageHeader eyebrow="Evaluations" title="Evaluation results" description="Scores are shown after the coordinator releases results." />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <SectionHeader title="Rubric scores" description="Standard FYP Evaluation Rubric" />
          {!data?.released || evaluations.length === 0 ? (
            <div className="mt-4">
              <EmptyState icon={Lock} title="Results not released" description="Your evaluation results will appear here once the FYP Office releases them." />
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-navy-100">
              <table className="w-full text-sm">
                <thead><tr className="bg-navy-50/60 text-left text-xs font-semibold uppercase tracking-wide text-navy-400"><th className="px-4 py-2.5">Criterion</th><th className="px-4 py-2.5">Weight</th><th className="px-4 py-2.5">Score</th></tr></thead>
                <tbody className="divide-y divide-navy-100">
                  {evaluations.map((e) => (
                    <tr key={e.id}>
                      <td className="px-4 py-3 font-medium text-navy-800">{e.criterion}</td>
                      <td className="px-4 py-3 text-navy-500">{e.weight}%</td>
                      <td className="px-4 py-3"><span className="font-semibold text-navy-900">{e.score}</span><span className="text-navy-400"> / {e.max}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <div className="space-y-5">
          <Card className="p-6 text-center">
            <p className="text-sm font-medium text-navy-500">Total score</p>
            <p className="mt-2 font-display text-5xl font-bold text-navy-900">{total}<span className="text-2xl text-navy-400">/{max || '—'}</span></p>
            {data?.released ? <Badge variant="success" className="mt-3">Results released</Badge> : <Badge variant="neutral" className="mt-3">Pending release</Badge>}
          </Card>
          <Card className="p-5">
            <SectionHeader title="Defense schedule" />
            {defense ? (
              <div className="mt-3 space-y-1.5 text-sm text-navy-600">
                <p className="font-medium text-navy-800">{fmtDateTime(defense.date)}</p>
                <p>{defense.venue || 'Venue to be announced'}</p>
                <p className="text-xs text-navy-400">Panel: {(defense.panel || []).join(', ') || 'To be announced'}</p>
                <p className="text-xs text-navy-400">Status: {titleCase(defense.status)}</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-navy-400">No defense has been scheduled yet.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
