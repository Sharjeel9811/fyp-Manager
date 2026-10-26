import { useState } from 'react'
import { GitBranch, Github, Link2, Loader2, Star, UserRound, RefreshCw, ExternalLink, AlertTriangle } from 'lucide-react'
import { useApiQuery, useApiMutation } from '@/hooks/useApi'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/shared/Common'
import { fmtDateTime, relativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import api from '@/lib/api'

/**
 * Contribution feed for the project's linked public GitHub repository.
 * Data comes from the backend's 5-minute cache in front of api.github.com,
 * so opening this page never costs the team rate-limit budget per request.
 */
export function GitHubFeed({ projectId }: { projectId: string }) {
  const { data, isLoading, error, refetch, isFetching } = useApiQuery<any>(
    ['github', projectId],
    `/github/projects/${projectId}`,
    { refetchInterval: 60_000 }
  )

  const [repoUrl, setRepoUrl] = useState('')
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)

  const linkRepo = useApiMutation(
    (repoUrl: string) => api.put('/student/project/repo', { repoUrl: repoUrl.trim() }),
    [['github', projectId], ['student', 'project']]
  )

  const feed = data?.feed
  const commits: any[] = feed?.commits ?? []
  const contributors: any[] = feed?.contributors ?? []

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

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 text-sm text-navy-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading repository data…
        </div>
      </Card>
    )
  }
  if (error) {
    return (
      <Card className="p-6">
        <p className="text-sm text-red-600">{(error as Error).message}</p>
      </Card>
    )
  }

  if (!data?.repo) {
    return (
      <Card className="p-6">
        <EmptyState
          icon={Github}
          title="Link your repository"
          description="Add the public GitHub repository your team develops in to get a live contribution feed here and visible progress for your supervisor."
        />
        <div className="mx-auto mt-4 flex w-full max-w-md flex-col gap-2 sm:flex-row">
          <Input
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
          />
          <Button onClick={save} loading={linkRepo.isPending}>
            <Link2 className="h-4 w-4" /> Link
          </Button>
        </div>
        {message && (
          <p className={cn('mt-3 text-center text-sm font-medium', message.error ? 'text-red-600' : 'text-emerald-700')}>
            {message.text}
          </p>
        )}
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="brand">
              <Github className="h-3.5 w-3.5" /> {feed.repo}
            </Badge>
            {feed.fresh ? <Badge variant="success">Live fetch</Badge> : <Badge variant="neutral">Cached 5 min</Badge>}
          </div>
          {feed.description ? (
            <p className="mt-2 max-w-xl truncate text-sm text-navy-500">{feed.description}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" loading={isFetching} onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" /> Refresh
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
          <p className="mt-0.5 font-semibold text-navy-900">{feed.pushedAt ? relativeTime(new Date(feed.pushedAt)) : '—'}</p>
        </div>
      </div>

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
    </Card>
  )
}
