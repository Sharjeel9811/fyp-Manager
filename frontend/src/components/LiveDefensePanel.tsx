import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Activity, CheckCircle2, EyeOff, Lock, Play, Radio, SkipForward,
  Square, Timer, Trophy, Unlock, Users,
} from 'lucide-react'
import { useApiQuery, useApiMutation } from '@/hooks/useApi'
import { useRealtime } from '@/context/RealtimeContext'
import { useAuth } from '@/context/AuthContext'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Progress } from '@/components/ui/Feedback'
import { SectionHeader, EmptyState, ErrorState, SkeletonPage } from '@/components/shared/Common'
import { fmtDateTime, titleCase } from '@/lib/format'
import { cn } from '@/lib/utils'
import api from '@/lib/api'

const textareaClass =
  'w-full rounded-xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm text-navy-900 shadow-sm transition-colors placeholder:text-navy-400 hover:border-navy-300 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10'

const statusVariant = (status?: string) =>
  status === 'LIVE' ? 'info' : status === 'COMPLETED' ? 'success' : 'neutral'

function formatClock(seconds: number) {
  const safe = Math.max(0, seconds)
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

export function LiveDefensePanel({ projectId }: { projectId: string }) {
  const queryKey = useMemo(() => ['defense', projectId], [projectId])
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { socket } = useRealtime()

  const { data, isLoading, error, refetch } = useApiQuery<any>(queryKey, `/defense/projects/${projectId}`, {
    refetchInterval: 15_000,
  })

  const start = useApiMutation(
    (body: { durationMinutes: number }) => api.post(`/defense/projects/${projectId}/start`, body),
    [queryKey]
  )
  const score = useApiMutation(
    (body: { criterionId: string; score: number; comment: string }) =>
      api.post(`/defense/sessions/${data?.session?.id}/score`, body),
    [queryKey]
  )
  const next = useApiMutation(
    () => api.post(`/defense/sessions/${data?.session?.id}/next`),
    [queryKey]
  )
  const end = useApiMutation(
    () => api.post(`/defense/sessions/${data?.session?.id}/end`),
    [queryKey]
  )
  const release = useApiMutation(
    () => api.post(`/defense/sessions/${data?.session?.id}/release`),
    [queryKey]
  )
  const unlock = useApiMutation(
    (body: { evaluatorId: string; criterionId: string }) =>
      api.post(`/defense/sessions/${data?.session?.id}/unlock`, body),
    [queryKey]
  )

  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null)
  const [duration, setDuration] = useState(30)
  const [scoreValue, setScoreValue] = useState('')
  const [comment, setComment] = useState('')
  const [now, setNow] = useState(Date.now())
  const serverSkew = useRef(0)

  const session = data?.session
  const permissions = data?.permissions ?? {}
  const canEvaluate = !!permissions.canEvaluate
  const canControl = !!permissions.canControl
  const schedule = data?.schedule
  const progress = data?.progress ?? { expectedEvaluators: 0, submittedEvaluators: 0, submittedScores: 0, totalScores: 0 }
  const aggregate = data?.aggregate
  const criteria: any[] = session?.criteria ?? []
  const current =
    criteria.find((c) => c.criterionId === session?.currentCriterionId) ?? criteria[0] ?? null
  const currentRow = current
    ? aggregate?.rows?.find((r: any) => r.criterionId === current.criterionId)
    : null
  const myEntry = currentRow?.scores?.find((s: any) => s.evaluatorId === user?.id) ?? null
  const locked = !!myEntry

  useEffect(() => {
    if (schedule?.duration) setDuration(Number(schedule.duration))
  }, [schedule?.duration])

  useEffect(() => {
    if (!socket) return
    socket.emit('room:join', projectId)
    return () => {
      socket.emit('room:leave', projectId)
    }
  }, [socket, projectId])

  useEffect(() => {
    if (!socket) return

    const apply = (payload: any) => {
      if (!payload?.project?.id || payload.project.id !== projectId) return
      queryClient.setQueryData(queryKey, payload)
    }

    const onPublicState = (payload: any) => {
      // Panel members and admins already hold the detailed view; never downgrade them.
      const currentState: any = queryClient.getQueryData(queryKey)
      if (currentState?.permissions?.canControl) return
      apply(payload)
    }

    const onReleased = (payload: any) => {
      const currentState: any = queryClient.getQueryData(queryKey)
      const keepDetail = currentState?.permissions?.canControl
      apply({
        ...payload,
        permissions: keepDetail ? currentState.permissions : payload.permissions,
      })
      queryClient.invalidateQueries({ queryKey: ['student', 'evaluations'] })
    }

    const onEnded = () => refetch()
    const onScored = (payload: any) => {
      setNotice({ text: `${payload?.evaluatorName || 'An evaluator'} locked ${payload?.criterionName || 'a score'}.` })
    }

    socket.on('defense:state', onPublicState)
    socket.on('defense:detail', apply)
    socket.on('defense:released', onReleased)
    socket.on('defense:ended', onEnded)
    socket.on('defense:scored', onScored)

    return () => {
      socket.off('defense:state', onPublicState)
      socket.off('defense:detail', apply)
      socket.off('defense:released', onReleased)
      socket.off('defense:ended', onEnded)
      socket.off('defense:scored', onScored)
    }
  }, [socket, projectId, queryKey, queryClient, refetch])

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(tick)
  }, [])

  useEffect(() => {
    const serverNow = data?.session?.timer?.serverNow
    if (typeof serverNow === 'number') serverSkew.current = serverNow - Date.now()
  }, [data?.session?.timer?.serverNow])

  useEffect(() => {
    if (!current) return
    setScoreValue(myEntry?.score != null ? String(myEntry.score) : '')
    setComment(myEntry?.comment || '')
    // Re-sync only when the criterion or the locked value changes, not on each keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.criterionId, myEntry?.score])

  const run = async (fn: () => Promise<any>, success: string) => {
    setNotice(null)
    try {
      const res: any = await fn()
      if (res?.data?.project) queryClient.setQueryData(queryKey, res.data)
      setNotice({ text: success })
    } catch (err: any) {
      setNotice({ text: err?.message || 'Request failed', error: true })
    }
  }

  if (isLoading) return <SkeletonPage />
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
  if (!data) return null

  const remaining = session
    ? Math.max(
        0,
        Math.ceil(
          (new Date(session.endsAt).getTime() - (now + serverSkew.current)) / 1000
        )
      )
    : 0
  const totalSeconds = (session?.durationMinutes || 30) * 60
  const elapsed = totalSeconds ? Math.min(100, ((totalSeconds - remaining) / totalSeconds) * 100) : 0
  const evaluators: any[] = aggregate?.evaluators ?? []
  const elapsedSeconds =
    session?.endedAt && session?.startedAt
      ? Math.max(
          0,
          Math.round(
            (new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 1000
          )
        )
      : 0

  const submitScore = () => {
    if (!current) return
    const value = Number(scoreValue)
    if (!Number.isFinite(value)) {
      setNotice({ text: 'Enter a numeric score before submitting.', error: true })
      return
    }
    void run(
      () =>
        score.mutateAsync({
          criterionId: current.criterionId,
          score: value,
          comment,
        }),
      `Locked ${value} / ${current.maxScore} for ${current.name}.`
    )
  }

  return (
    <div className="space-y-5">
      {notice && (
        <p
          className={cn(
            'rounded-xl px-4 py-2.5 text-sm font-medium',
            notice.error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
          )}
        >
          {notice.text}
        </p>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant(session?.status)}>
                <Radio className="h-3.5 w-3.5" />
                {session ? titleCase(session.status) : 'Not started'}
              </Badge>
              {session?.resultsReleased && (
                <Badge variant="success">
                  <Trophy className="h-3.5 w-3.5" /> Results released
                </Badge>
              )}
            </div>
            <h3 className="mt-2 truncate text-lg font-semibold text-navy-900">{data.project.title}</h3>
            <p className="mt-1 text-sm text-navy-500">
              {schedule?.date
                ? `${fmtDateTime(schedule.date)} · ${schedule.venue || 'Venue to be announced'}`
                : 'No defense has been scheduled yet.'}
            </p>
            {schedule?.panel?.length > 0 && (
              <p className="mt-1 text-xs text-navy-400">Panel: {schedule.panel.join(', ')}</p>
            )}
          </div>

          {session && (
            <div className="shrink-0 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-navy-400">
                {session.status === 'LIVE' ? 'Time remaining' : 'Defense duration'}
              </p>
              <p
                className={cn(
                  'mt-1 font-mono text-4xl font-bold tabular-nums',
                  session.status === 'LIVE' && remaining <= 60 ? 'text-red-600' : 'text-navy-900'
                )}
              >
                {session.status === 'LIVE' ? formatClock(remaining) : formatClock(elapsedSeconds)}
              </p>
              <Progress
                value={session.status === 'LIVE' ? elapsed : 100}
                className="mx-auto mt-2 w-40"
                barClassName={
                  session.status === 'LIVE' && remaining <= 60 ? 'bg-red-500' : 'bg-brand-600'
                }
              />
            </div>
          )}
        </div>

        {session && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-navy-100 bg-navy-50/50 px-6 py-3 text-xs text-navy-500">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              {progress.submittedEvaluators}/{progress.expectedEvaluators || '—'} evaluators submitted
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" />
              {progress.submittedScores}/{progress.totalScores || '—'} scores locked
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              Current criterion: {current?.name || '—'}
            </span>
          </div>
        )}
      </Card>

      {!session && (
        <Card className="p-6">
          {canControl ? (
            <div>
              <SectionHeader
                title="Start the live defense"
                description="The rubric, panel, and timer are snapshotted when the session starts."
              />
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="sm:w-48">
                  <Input
                    label="Duration (minutes)"
                    type="number"
                    min={5}
                    max={180}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                  />
                </div>
                <Button
                  loading={start.isPending}
                  onClick={() =>
                    run(
                      () => start.mutateAsync({ durationMinutes: Number(duration) }),
                      'Live defense started.'
                    )
                  }
                >
                  <Play className="h-4 w-4" /> Start live defense
                </Button>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={Timer}
              title="No live defense yet"
              description="The panel has not started this defense. This page updates automatically when it begins."
            />
          )}
        </Card>
      )}

      {session && (
        <>
          <div className="flex flex-wrap gap-2">
            {criteria.map((c, index) => {
              const active = c.criterionId === session.currentCriterionId
              return (
                <div
                  key={c.criterionId}
                  className={cn(
                    'rounded-xl border px-3.5 py-2.5 transition-colors',
                    active
                      ? 'border-brand-300 bg-brand-50 shadow-sm'
                      : 'border-navy-100 bg-white'
                  )}
                >
                  <p
                    className={cn(
                      'text-xs font-semibold',
                      active ? 'text-brand-700' : 'text-navy-700'
                    )}
                  >
                    {index + 1}. {c.name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-navy-400">
                    {c.maxScore} pts · {c.weight}% weight
                  </p>
                </div>
              )
            })}
          </div>

          {canEvaluate && session.status === 'LIVE' && current && (
            <Card className="p-6">
              <SectionHeader
                title={`Score “${current.name}”`}
                description={`Out of ${current.maxScore}. Submitted scores lock immediately; an admin can unlock a mistake.`}
              />
              {locked ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-emerald-800">
                    <CheckCircle2 className="h-4 w-4" />
                    Locked at {myEntry.score} / {current.maxScore}
                    {myEntry.comment ? <span className="font-normal text-emerald-700">— {myEntry.comment}</span> : null}
                  </div>
                  <span className="text-xs text-emerald-700">Ask an admin to unlock if it needs correcting.</span>
                </div>
              ) : (
                <div className="mt-4 grid gap-3 lg:grid-cols-[140px_1fr_auto] lg:items-end">
                  <Input
                    label="Score"
                    type="number"
                    min={0}
                    max={current.maxScore}
                    step="0.5"
                    value={scoreValue}
                    onChange={(e) => setScoreValue(e.target.value)}
                  />
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-navy-700">
                      Comment (optional)
                    </label>
                    <textarea
                      className={cn(textareaClass, 'min-h-[44px] resize-y')}
                      rows={1}
                      maxLength={1000}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Short justification for the panel record"
                    />
                  </div>
                  <Button loading={score.isPending} onClick={submitScore}>
                    <Lock className="h-4 w-4" /> Submit &amp; lock
                  </Button>
                </div>
              )}
            </Card>
          )}

          {canControl && (
            <Card className="p-6">
              <SectionHeader
                title="Panel controls"
                description="Move through the rubric and finish the session. Results stay hidden until release."
              />
              <div className="mt-4 flex flex-wrap gap-2">
                {session.status === 'LIVE' && (
                  <>
                    <Button
                      variant="outline"
                      loading={next.isPending}
                      onClick={() => run(() => next.mutateAsync(), 'Moved to the next criterion.')}
                    >
                      <SkipForward className="h-4 w-4" /> Next criterion
                    </Button>
                    <Button
                      variant="danger"
                      loading={end.isPending}
                      onClick={() => run(() => end.mutateAsync(), 'Defense ended.')}
                    >
                      <Square className="h-4 w-4" /> End defense
                    </Button>
                  </>
                )}
                {session.status === 'COMPLETED' && user?.role === 'ADMIN' && (
                  <Button
                    loading={release.isPending}
                    disabled={session.resultsReleased}
                    onClick={() => run(() => release.mutateAsync(), 'Results released to the students.')}
                  >
                    <Trophy className="h-4 w-4" /> {session.resultsReleased ? 'Results released' : 'Release results'}
                  </Button>
                )}
                {session.status === 'COMPLETED' && user?.role !== 'ADMIN' && (
                  <p className="rounded-xl bg-navy-50 px-4 py-2.5 text-sm text-navy-500">
                    {session.resultsReleased
                      ? 'Results have been released to the students.'
                      : 'The defense has ended. An administrator releases the results to the students.'}
                  </p>
                )}
                {session.status === 'COMPLETED' && (
                  <Button
                    variant="outline"
                    loading={start.isPending}
                    onClick={() =>
                      run(
                        () =>
                          start.mutateAsync({ durationMinutes: Number(session.durationMinutes) || 30 }),
                        'A new defense session has started.'
                      )
                    }
                  >
                    <Play className="h-4 w-4" /> Start another defense
                  </Button>
                )}
              </div>
            </Card>
          )}

          {aggregate ? (
            <Card className="p-6">
              <SectionHeader
                title={session.resultsReleased ? 'Final scores' : 'Live aggregate'}
                description={`${aggregate.submittedEvaluators} evaluator(s) submitted · ${aggregate.total} / ${aggregate.maxTotal} average total`}
              />
              <div className="mt-4 overflow-x-auto rounded-xl border border-navy-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-navy-50/60 text-left text-xs font-semibold uppercase tracking-wide text-navy-400">
                      <th className="px-4 py-2.5">Criterion</th>
                      <th className="px-4 py-2.5">Max</th>
                      {evaluators.map((e) => (
                        <th key={e.evaluatorId || e.name} className="px-4 py-2.5">
                          {e.name}
                        </th>
                      ))}
                      <th className="px-4 py-2.5">Average</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-100">
                    {aggregate.rows?.map((row: any) => (
                      <tr key={row.criterionId}>
                        <td className="px-4 py-3 font-medium text-navy-800">{row.name}</td>
                        <td className="px-4 py-3 text-navy-500">{row.maxScore}</td>
                        {evaluators.map((e) => {
                          const entry = row.scores?.find(
                            (s: any) => s.evaluatorId === e.evaluatorId
                          )
                          return (
                            <td key={e.evaluatorId || e.name} className="px-4 py-3">
                              {entry ? (
                                <span className="inline-flex items-center gap-1.5 text-navy-700">
                                  {entry.score}
                                  {user?.role === 'ADMIN' && session.status === 'LIVE' && entry.evaluatorId && (
                                    <button
                                      type="button"
                                      title="Unlock this score"
                                      className="rounded p-0.5 text-navy-400 hover:bg-amber-50 hover:text-amber-600"
                                      onClick={() =>
                                        run(
                                          () =>
                                            unlock.mutateAsync({
                                              evaluatorId: entry.evaluatorId,
                                              criterionId: row.criterionId,
                                            }),
                                          'Score unlocked.'
                                        )
                                      }
                                    >
                                      <Unlock className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </span>
                              ) : (
                                <span className="text-navy-300">—</span>
                              )}
                            </td>
                          )
                        })}
                        <td className="px-4 py-3 font-semibold text-navy-900">
                          {row.average ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-navy-50/60 font-semibold text-navy-900">
                      <td className="px-4 py-3">Total</td>
                      <td className="px-4 py-3">{aggregate.maxTotal}</td>
                      {evaluators.map((e) => (
                        <td key={e.evaluatorId || e.name} className="px-4 py-3 text-navy-500">
                          {e.submittedCount} scored
                        </td>
                      ))}
                      <td className="px-4 py-3">{aggregate.total} / {aggregate.maxTotal}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          ) : (
            <Card className="p-6">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-100 text-navy-500">
                  <EyeOff className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-navy-900">Live aggregate hidden</p>
                  <p className="mt-1 text-xs text-navy-500">
                    Panel scores stay private until the coordinator releases the results. You can
                    still see how many evaluators have submitted.
                  </p>
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
