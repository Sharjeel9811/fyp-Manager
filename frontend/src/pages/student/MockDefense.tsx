import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Bot, CheckCircle2, MessagesSquare, Play, Send,
  Sparkles, Trophy, AlertTriangle, GraduationCap,
} from 'lucide-react'
import { PageHeader, EmptyState, ErrorState, SkeletonPage } from '@/components/shared/Common'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Feedback'
import { useApiQuery, useApiMutation } from '@/hooks/useApi'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'
import api from '@/lib/api'

const answerClass =
  'w-full rounded-xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm text-navy-900 shadow-sm transition-colors placeholder:text-navy-400 hover:border-navy-300 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10'

const providerLabel = (p?: string) =>
  !p || p === 'RULE_BASED'
    ? 'Rule-based examiner (no LLM key configured)'
    : `AI examiner · ${p}`

/**
 * Mock defense: the student answers panel-style questions about their own
 * project and each answer is judged instantly. LLM keys stay in the backend;
 * without one the rule-based examiner keeps the feature usable.
 */
export function StudentMockDefense() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data, isLoading, error, refetch } = useApiQuery<any>(['student', 'project'], '/student/project')

  const projectId: string | undefined = data?.project?.id
  const sessionQ = useApiQuery<any>(
    ['mockdefense', projectId],
    projectId ? `/mockdefense/projects/${projectId}/latest` : '/mockdefense/none',
    { enabled: !!projectId }
  )

  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null)

  const answer = useApiMutation(
    (body: { sessionId: string; answer: string }) =>
      api.post(`/mockdefense/sessions/${body.sessionId}/answer`, { answer: body.answer }),
    [['mockdefense', projectId]]
  )

  if (isLoading) return <SkeletonPage />
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  const projectTitle = data?.project?.title
  const session = sessionQ.data?.session
  const history: any[] = sessionQ.data?.history ?? []

  const answered = session ? session.rounds.filter((r: any) => r.answered).length : 0
  const currentRound = session
    ? session.rounds.find((r: any) => !r.answered)
    : null

  const start = async () => {
    setNotice(null)
    try {
      await api.post(`/mockdefense/projects/${projectId}/start`)
      await queryClient.invalidateQueries({ queryKey: ['mockdefense', projectId] })
    } catch (err: any) {
      setNotice({ text: err?.message || 'Could not start the session', error: true })
    }
  }

  const submit = async () => {
    if (!session || !currentRound) return
    setBusy(true)
    setNotice(null)
    try {
      await answer.mutateAsync({ sessionId: session.id, answer: draft })
      setDraft('')
    } catch (err: any) {
      setNotice({ text: err?.message || 'Could not submit the answer', error: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Practice"
        title="Mock defense"
        description={`Rehearse your viva for “${projectTitle}”. Answer five panel questions and get instant, rubric-aware feedback.`}
      />

      {projectId ? (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-5">
            {!session && (
              <Card className="p-6 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                  <GraduationCap className="h-7 w-7" />
                </span>
                <h3 className="mt-3 text-lg font-semibold text-navy-900">Run a mock defense</h3>
                <p className="mx-auto mt-1 max-w-md text-sm text-navy-500">
                  {providerLabel(history[0]?.provider)}
                  {user?.studentId ? '' : ''} — five questions drawn from your proposal, scored 0–10 with concrete
                  improvement hints. Nothing here affects your official evaluation.
                </p>
                <Button className="mx-auto mt-4" onClick={start} loading={busy}>
                  <Play className="h-4 w-4" /> Start mock defense
                </Button>
                {notice && <p className="mt-3 text-sm text-red-600">{notice.text}</p>}
              </Card>
            )}

            {session && (
              <Card className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={session.status === 'ACTIVE' ? 'info' : 'success'}>
                      <MessagesSquare className="h-3.5 w-3.5" />
                      {session.status === 'ACTIVE' ? 'Session in progress' : 'Session finished'}
                    </Badge>
                    <Badge variant="neutral">{providerLabel(session.provider)}</Badge>
                  </div>
                  <span className="text-xs text-navy-400">
                    Question {Math.min(answered + 1, session.rounds.length)} of {session.rounds.length}
                  </span>
                </div>
                <Progress value={(answered / session.rounds.length) * 100} className="mt-3" />

                <ol className="mt-5 space-y-4">
                  {session.rounds.map((r: any, i: number) => {
                    const isCurrent = !r.answered && i === answered
                    const isLocked = !r.answered && i !== answered
                    return (
                    <li key={i} className={cn('rounded-xl border p-4', isLocked ? 'border-navy-100 bg-navy-50/50 opacity-60' : 'border-navy-100')}>
                      <p className="flex items-start gap-2 text-sm font-medium text-navy-900">
                        <Bot className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                        {r.question}
                      </p>
                      {r.answered ? (
                        <div className="mt-3 space-y-2">
                          <div className="rounded-lg bg-navy-50 px-3 py-2 text-sm text-navy-700">
                            <span className="font-semibold text-navy-500">You: </span>
                            {r.answer}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={r.score >= 7 ? 'success' : r.score >= 4 ? 'warning' : 'danger'}>
                              <Sparkles className="h-3.5 w-3.5" /> {r.score}/10
                            </Badge>
                          </div>
                          <p className="text-sm text-navy-600">{r.feedback}</p>
                          {r.strengths?.length > 0 && (
                            <ul className="space-y-1">
                              {r.strengths.map((s: string) => (
                                <li key={s} className="flex items-start gap-1.5 text-xs text-emerald-700">
                                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {s}
                                </li>
                              ))}
                            </ul>
                          )}
                          {r.improvements?.length > 0 && (
                            <ul className="space-y-1">
                              {r.improvements.map((s: string) => (
                                <li key={s} className="flex items-start gap-1.5 text-xs text-amber-700">
                                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {s}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ) : isCurrent ? (
                        <div className="mt-3 space-y-2">
                          <textarea
                            className={cn(answerClass, 'min-h-[96px] resize-y')}
                            rows={3}
                            maxLength={4000}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            placeholder="Answer as if the panel is in front of you…"
                          />
                          <div className="flex justify-end">
                            <Button onClick={submit} loading={busy || answer.isPending}>
                              <Send className="h-4 w-4" /> Submit answer
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-navy-400">Answer the previous questions first — this one unlocks after.</p>
                      )}
                    </li>
                    )
                  })}
                </ol>

                {session.status === 'FINISHED' && (
                  <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-emerald-700" />
                      <p className="font-semibold text-emerald-900">
                        {session.totalScore} / {session.maxScore}
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-emerald-800">{session.summary}</p>
                    <Button size="sm" variant="outline" className="mt-3" onClick={start} loading={busy}>
                      <Play className="h-4 w-4" /> Practise again
                    </Button>
                  </div>
                )}
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <Card className="p-6">
              <h3 className="text-sm font-semibold text-navy-900">Previous sessions</h3>
              {history.length === 0 ? (
                <p className="mt-2 text-xs text-navy-400">No finished sessions yet.</p>
              ) : (
                <ul className="mt-3 space-y-2.5">
                  {history.map((h) => (
                    <li key={h.id} className="flex items-center justify-between rounded-lg bg-navy-50 px-3 py-2 text-sm">
                      <span className="text-navy-600">{h.rounds.length} questions</span>
                      <span className="font-semibold text-navy-900">
                        {h.totalScore}/{h.maxScore}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card className="p-6">
              <h3 className="text-sm font-semibold text-navy-900">How scoring works</h3>
              <p className="mt-2 text-xs leading-relaxed text-navy-500">
                {providerLabel(session?.provider || history[0]?.provider || 'RULE_BASED')}
                {session?.provider === 'RULE_BASED'
                  ? '. Answers are judged on how well they anchor to specific parts of your proposal — name your components, metrics, and evidence.'
                  : '. A language model judges clarity, specificity, and evidence; scores are advisory.'}
              </p>
            </Card>
          </div>
        </div>
      ) : (
        <EmptyState icon={GraduationCap} title="No project yet" description="Join or create a project to practise a mock defense." />
      )}
    </div>
  )
}
