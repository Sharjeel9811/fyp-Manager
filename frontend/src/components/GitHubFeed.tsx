import { useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { GitBranch, Github, Link2, Loader2, Star, UserRound, RefreshCw, ExternalLink, AlertTriangle, UploadCloud } from 'lucide-react'
import { useApiQuery, useApiMutation } from '@/hooks/useApi'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input, Select } from '@/components/ui/Input'
import { EmptyState } from '@/components/shared/Common'
import { fmtDateTime, relativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import api from '@/lib/api'

/**
 * Contribution feed for the project's linked public GitHub repository.
 *
 * Commits are re-polled every 60s here and cached for only 90s server-side, so
 * a push to the connected repo shows up within a minute or two. Repo metadata
 * is cached much longer server-side to protect GitHub's rate limit. The
 * Refresh button forces a fresh fetch, bypassing both caches.
 */

const tokenInputClass =
  'w-full rounded-xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm text-navy-900 shadow-sm placeholder:text-navy-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10'

/**
 * Publish-to-GitHub modal. The student signs in with their own personal
 * access token (sent once, never stored server-side); the backend creates
 * the repository under that account and pushes README + proposal docs.
 */
function PublishModal({
  projectId,
  onClose,
}: {
  projectId: string
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  // Presets give the suggested repo name and whether the project already
  // publishes somewhere (re-publish updates that repo instead).
  const { data: presets } = useApiQuery<{ suggestedName: string; linkedRepo: string | null }>(
    ['github-read-preset', projectId],
    `/github/projects/${projectId}/publish/presets`
  )

  const [repoName, setRepoName] = useState('')
  const [token, setToken] = useState('')
  const [visibility, setVisibility] = useState('PRIVATE')
  const [result, setResult] = useState<{ text: string; error?: boolean; url?: string[] } | null>(null)

  const isUpdate = !!presets?.linkedRepo

  const publish = useApiMutation(() =>
    api.post(`/github/projects/${projectId}/publish`, {
      token: token.trim(),
      repoName: repoName.trim() || presets?.suggestedName || '',
      visibility,
    })
  )

  const submit = async () => {
    setResult(null)
    try {
      const res: any = await publish.mutateAsync()
      queryClient.invalidateQueries({ queryKey: ['github', projectId] })
      queryClient.invalidateQueries({ queryKey: ['github-read-preset', projectId] })
      queryClient.invalidateQueries({ queryKey: ['student', 'project'] })
      const published = res.data?.published
      setResult({
        text: res.data?.message || 'Published',
        url: published?.repoUrl ? [published.repoUrl] : [],
      })
    } catch (err: any) {
      setResult({ text: err?.message || 'Publish failed', error: true })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-900/40 backdrop-blur-sm" onClick={onClose} />
      <Card className="relative z-10 w-full max-w-md p-6">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-semibold text-navy-900">
            <Github className="h-4 w-4" /> {isUpdate ? 'Update repository' : 'Publish to GitHub'}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-navy-400 hover:bg-navy-100" aria-label="Close">
            ✕
          </button>
        </div>

        {result ? (
          <div className="mt-4 space-y-3">
            <p className={cn('text-sm font-medium', result.error ? 'text-red-600' : 'text-emerald-700')}>{result.text}</p>
            {result.url?.map((u) => (
              <a key={u} href={u} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-semibold text-brand-600 hover:underline">
                <ExternalLink className="h-4 w-4" /> {u}
              </a>
            ))}
            <div className="flex justify-end pt-1">
              <Button onClick={onClose}>{result.error ? 'Close' : 'Done'}</Button>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-1.5 text-xs leading-relaxed text-navy-500">
              {isUpdate
                ? `Publishing again refreshes the README and proposal in ${presets?.linkedRepo}.`
                : 'Creates a repository on your GitHub account and publishes the project overview and latest proposal into it. The token is used once and is not stored.'}
            </p>
            <div className="mt-4 space-y-3.5">
              <label className="block">
                <span className="mb-1.5 flex items-center justify-between text-sm font-medium text-navy-700">
                  GitHub access token
                  <a
                    href="https://github.com/settings/tokens?type=beta"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-brand-600 hover:underline"
                  >
                    Create one ↗
                  </a>
                </span>
                <input
                  type="password"
                  autoComplete="off"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="ghp_… or github_pat_…"
                  className={tokenInputClass}
                />
                <span className="mt-1 block text-[11px] text-navy-400">
                  Needs repository write access (classic tokens: the "repo" scope).
                </span>
              </label>

              {!isUpdate && (
                <>
                  <Input
                    label="Repository name"
                    value={repoName}
                    onChange={(e) => setRepoName(e.target.value)}
                    placeholder={presets?.suggestedName || 'fyp-project'}
                    hint={presets?.suggestedName ? undefined : 'Lowercase letters, numbers, and dashes'}
                  />
                  <Select label="Visibility" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
                    <option value="PRIVATE">Private (recommended)</option>
                    <option value="PUBLIC">Public</option>
                  </Select>
                </>
              )}
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={submit} loading={publish.isPending} disabled={token.trim().length < 20}>
                <UploadCloud className="h-4 w-4" /> {isUpdate ? 'Publish update' : 'Create repo & publish'}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

/**
 * Change / remove the linked GitHub repository. Same endpoint as the setup
 * form's Link button, so an existing link can simply be re-pointed.
 */
function RepoLinkModal({
  projectId,
  currentRepo,
  onClose,
}: {
  projectId: string
  currentRepo: string
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [repoUrl, setRepoUrl] = useState(currentRepo ? `https://github.com/${currentRepo}` : '')
  const [result, setResult] = useState<{ text: string; error?: boolean } | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    const url = repoUrl.trim()
    if (!url) {
      setResult({ text: 'Enter a GitHub repository such as https://github.com/owner/repo', error: true })
      return
    }
    setBusy(true)
    setResult(null)
    try {
      const res = await api.put('/student/project/repo', { repoUrl: url })
      queryClient.invalidateQueries({ queryKey: ['github', projectId] })
      queryClient.invalidateQueries({ queryKey: ['github-read-preset', projectId] })
      queryClient.invalidateQueries({ queryKey: ['student', 'project'] })
      setResult({ text: res.data?.message || `Repository ${res.data?.githubRepo || url} linked` })
    } catch (err: any) {
      setResult({ text: err?.message || 'Could not link that repository', error: true })
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    setResult(null)
    try {
      const res = await api.put('/student/project/repo', { clear: true })
      queryClient.invalidateQueries({ queryKey: ['github', projectId] })
      queryClient.invalidateQueries({ queryKey: ['github-read-preset', projectId] })
      queryClient.invalidateQueries({ queryKey: ['student', 'project'] })
      setResult({ text: res.data?.message || 'Repository unlinked' })
    } catch (err: any) {
      setResult({ text: err?.message || 'Could not remove that link', error: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-900/40 backdrop-blur-sm" onClick={onClose} />
      <Card className="relative z-10 w-full max-w-md p-6">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-semibold text-navy-900">
            <Link2 className="h-4 w-4" /> {currentRepo ? 'Change repository' : 'Link repository'}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-navy-400 hover:bg-navy-100" aria-label="Close">
            ✕
          </button>
        </div>

        {result ? (
          <div className="mt-4 space-y-3">
            <p className={cn('text-sm font-medium', result.error ? 'text-red-600' : 'text-emerald-700')}>{result.text}</p>
            <div className="flex justify-end pt-1">
              <Button onClick={onClose}>{result.error ? 'Close' : 'Done'}</Button>
            </div>
          </div>
        ) : (
          <>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm font-medium text-navy-700">GitHub repository</span>
              <Input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/owner/repo" />
              <span className="mt-1 block text-[11px] text-navy-400">
                {currentRepo
                  ? `The team is currently linked to ${currentRepo}.`
                  : 'Paste the public repository your team pushes to.'}
              </span>
            </label>
            <div className="mt-5 flex items-center justify-between gap-2">
              <Button variant="outline" onClick={remove} loading={busy} disabled={!currentRepo}>
                Remove link
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button onClick={save} loading={busy} disabled={!repoUrl.trim()}>
                  <Link2 className="h-4 w-4" /> Save
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

export function GitHubFeed({ projectId }: { projectId: string }) {
  const { data, isLoading, error, refetch, isFetching } = useApiQuery<any>(
    ['github', projectId],
    `/github/projects/${projectId}`,
    { refetchInterval: 60_000 }
  )
  const queryClient = useQueryClient()

  const [repoUrl, setRepoUrl] = useState('')
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)
  const [publishOpen, setPublishOpen] = useState(false)
  const [repoLinkOpen, setRepoLinkOpen] = useState(false)
  const [forcing, setForcing] = useState(false)

  /** Bypass the backend cache so a just-pushed commit appears right away. */
  const forceRefresh = async () => {
    if (forcing) return
    setForcing(true)
    try {
      const res = await api.get(`/github/projects/${projectId}?refresh=1`)
      queryClient.setQueryData(['github', projectId], res.data)
    } catch {
      // Keep the existing error surface: a normal refetch will report it.
      await refetch()
    } finally {
      setForcing(false)
    }
  }

  const linkRepo = useApiMutation(
    (repoUrl: string) => api.put('/student/project/repo', { repoUrl: repoUrl.trim() }),
    [['github', projectId], ['student', 'project']]
  )

  const feed = data?.feed
  const commits: any[] = feed?.commits ?? []
  const contributors: any[] = feed?.contributors ?? []
  const activity: Array<{ date: string; commits: number }> = feed?.activity ?? []

  const save = async () => {
    setMessage(null)
    try {
      const res: any = await linkRepo.mutateAsync(repoUrl)
      setMessage({ text: res?.data?.message || 'Repository linked.' })
      setRepoUrl('')
    } catch (err: any) {
      setMessage({ text: err?.message || 'Could not link the repository', error: true })
    }
  }

  let content: ReactNode

  if (isLoading) {
    content = (
      <Card className="p-6">
        <div className="flex items-center gap-2 text-sm text-navy-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading repository data…
        </div>
      </Card>
    )
  } else if (error) {
    // A deleted, private, or mistyped repository lands here. Offer a way out —
    // otherwise the page is a dead end and "Try again" never succeeds.
    content = (
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-red-600">{(error as Error).message}</p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setRepoLinkOpen(true)}>
              <Link2 className="h-4 w-4" /> Change repo
            </Button>
            <Button size="sm" variant="outline" loading={forcing} onClick={forceRefresh}>
              <RefreshCw className="h-4 w-4" /> Try again
            </Button>
          </div>
        </div>
      </Card>
    )
  } else if (!data?.repo) {
    content = (
      <Card className="p-6">
        <EmptyState
          icon={Github}
          title="Set up the team repository"
          description="Link the GitHub repository your team develops in — or let FYP Manager create one on your account and fill it with the project overview, team, milestones, and latest proposal."
        />
        <div className="mx-auto mt-4 w-full max-w-md space-y-3">
          <div className="flex gap-2">
            <Input
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
            />
            <Button onClick={save} loading={linkRepo.isPending} className="shrink-0">
              <Link2 className="h-4 w-4" /> Link
            </Button>
          </div>
          <div className="flex items-center gap-3 text-xs text-navy-400">
            <span className="h-px flex-1 bg-navy-100" /> or <span className="h-px flex-1 bg-navy-100" />
          </div>
          <Button className="w-full" onClick={() => setPublishOpen(true)}>
            <UploadCloud className="h-4 w-4" /> Create repo &amp; publish docs
          </Button>
        </div>
        {message && (
          <p className={cn('mt-3 text-center text-sm font-medium', message.error ? 'text-red-600' : 'text-emerald-700')}>
            {message.text}
          </p>
        )}
        {publishOpen && <PublishModal projectId={projectId} onClose={() => setPublishOpen(false)} />}
      </Card>
    )
  } else {
    content = (
      <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="brand">
              <Github className="h-3.5 w-3.5" /> {feed.repo}
            </Badge>
            {data?.fresh ? <Badge variant="success">Live fetch</Badge> : <Badge variant="neutral">Auto-refresh · 90s</Badge>}
          </div>
          {feed.description ? (
            <p className="mt-2 max-w-xl truncate text-sm text-navy-500">{feed.description}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" loading={forcing || (isFetching && !forcing)} onClick={forceRefresh}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={() => setRepoLinkOpen(true)}>
            <Link2 className="h-4 w-4" /> Change repo
          </Button>
          <Button size="sm" variant="outline" onClick={() => setPublishOpen(true)}>
            <UploadCloud className="h-4 w-4" /> Re-publish docs
          </Button>
          <a href={feed.url} target="_blank" rel="noreferrer">
            <Button size="sm" variant="outline">
              <ExternalLink className="h-4 w-4" /> Open repo
            </Button>
          </a>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div className="rounded-xl bg-navy-50 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-xs text-navy-400"><Star className="h-3.5 w-3.5" /> Stars</p>
          <p className="mt-0.5 font-semibold text-navy-900">{feed.stars}</p>
        </div>
        <div className="rounded-xl bg-navy-50 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-xs text-navy-400"><AlertTriangle className="h-3.5 w-3.5" /> Open issues</p>
          <p className="mt-0.5 font-semibold text-navy-900">{feed.openIssues}</p>
        </div>
        <div className="rounded-xl bg-navy-50 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-xs text-navy-400"><GitBranch className="h-3.5 w-3.5" /> Branch</p>
          <p className="mt-0.5 truncate font-semibold text-navy-900">{feed.defaultBranch}</p>
        </div>
        <div className="rounded-xl bg-navy-50 px-3 py-2.5">
          <p className="text-xs text-navy-400">Last push</p>
          <p className="mt-0.5 font-semibold text-navy-900">
            {!feed.empty && feed.pushedAt ? relativeTime(new Date(feed.pushedAt)) : '—'}
          </p>
        </div>
      </div>

      {feed.empty ? (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-navy-900">This repository is empty</p>
              <p className="mt-1 text-sm text-navy-600">
                GitHub reports <span className="font-mono text-xs">{feed.repo}</span> with no commits on{' '}
                <span className="font-semibold">{feed.defaultBranch}</span> yet, so there is nothing to chart. Push your
                first commit and it appears here within a minute.
              </p>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-black/5 p-3 text-xs leading-relaxed text-navy-800">{`git init
git add .
git commit -m "Initial commit"
git branch -M ${feed.defaultBranch}
git remote add origin ${feed.url}.git
git push -u origin ${feed.defaultBranch}`}</pre>
              <p className="mt-3 text-xs text-navy-600">
                Already pushed somewhere else?{' '}
                <button
                  type="button"
                  onClick={() => setRepoLinkOpen(true)}
                  className="font-semibold text-brand-600 hover:text-brand-700"
                >
                  Change the linked repository
                </button>
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {activity.length > 0 && (
            <div className="mt-5 rounded-xl border border-navy-100 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">Commit activity · last 14 days</p>
                <Badge variant="neutral">{activity.reduce((n, a) => n + a.commits, 0)} commits</Badge>
              </div>
              <div className="mt-3 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activity}>
                    <XAxis dataKey="date" tickFormatter={(v: string) => String(v).slice(5)} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
                    <Bar dataKey="commits" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">Latest commits</p>
              <ol className="mt-2 space-y-2.5">
                {commits.map((c) => (
                  <li key={c.sha} className="flex items-start gap-3 rounded-xl border border-navy-100 px-3.5 py-2.5">
                    <span className="mt-0.5 rounded-md bg-navy-100 px-1.5 py-0.5 font-mono text-[11px] text-navy-600">{c.sha}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-navy-800">{c.message}</span>
                      <span className="text-xs text-navy-400">
                        {c.author} · {c.date ? fmtDateTime(c.date) : ''}
                      </span>
                    </span>
                  </li>
                ))}
                {commits.length === 0 && <li className="text-sm text-navy-400">No commits returned yet.</li>}
              </ol>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">Contributions</p>
              <ul className="mt-2 space-y-2">
                {contributors.map((u: any) => (
                  <li key={u.login} className="flex items-center justify-between rounded-xl border border-navy-100 px-3 py-2">
                    <span className="flex items-center gap-2 text-sm text-navy-700">
                      <UserRound className="h-4 w-4 text-navy-400" />
                      {u.login}
                    </span>
                    <Badge variant="neutral">{u.commits} commits</Badge>
                  </li>
                ))}
                {contributors.length === 0 && <li className="text-sm text-navy-400">No contributor data yet.</li>}
              </ul>
            </div>
          </div>
        </>
      )}
      {publishOpen && <PublishModal projectId={projectId} onClose={() => setPublishOpen(false)} />}
      </Card>
    )
  }

  return (
    <>
      {content}
      {repoLinkOpen && (
        <RepoLinkModal projectId={projectId} currentRepo={data?.repo || ''} onClose={() => setRepoLinkOpen(false)} />
      )}
    </>
  )
}
