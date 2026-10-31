import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarDays, FolderKanban, GripVertical, Plus, Trash2, UserRound, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/shared/Common'
import { useApiQuery, useApiMutation } from '@/hooks/useApi'
import { fmtDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import api from '@/lib/api'

/**
 * Per-project Kanban board (TODO / In progress / Review / Done).
 *
 * Drag & drop is native HTML5 drag events — no library. A drop reports the
 * destination column and the card it was dropped on ("place after") to
 * PATCH /kanban/cards/:id/move, and the server positions the card between its
 * new neighbours, so two people moving cards at once cannot clobber each
 * other's columns. Mutations also broadcast `kanban:update` over sockets;
 * the 8s poll below is the fallback.
 */

const COLUMNS = [
  { key: 'TODO', label: 'To do' },
  { key: 'IN_PROGRESS', label: 'In progress' },
  { key: 'REVIEW', label: 'In review' },
  { key: 'DONE', label: 'Done' },
] as const

const priorityTone = { HIGH: 'danger', MEDIUM: 'warning', LOW: 'neutral' } as const

interface BoardData {
  columns: string[]
  members: Array<{ studentId: string; name: string }>
  cards: Array<{
    id: string
    title: string
    description: string
    column: string
    order: number
    assigneeStudentId: string | null
    assigneeName: string | null
    priority: string
    dueDate: string | null
  }>
}

function CardModal({
  title,
  initial,
  members,
  onClose,
  onSave,
  saving,
}: {
  title: string
  initial: any
  members: Array<{ studentId: string; name: string }>
  onClose: () => void
  onSave: (payload: any) => void
  saving: boolean
}) {
  const [form, setForm] = useState({
    title: initial?.title || '',
    description: initial?.description || '',
    priority: initial?.priority || 'MEDIUM',
    column: initial?.column || 'TODO',
    assigneeStudentId: initial?.assigneeStudentId || '',
    dueDate: initial?.dueDate ? String(initial.dueDate).slice(0, 10) : '',
  })
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-900/40 backdrop-blur-sm" onClick={onClose} />
      <Card className="relative z-10 w-full max-w-md p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-navy-900">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-navy-400 hover:bg-navy-100" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form
          className="mt-4 space-y-3.5"
          onSubmit={(e) => {
            e.preventDefault()
            onSave({
              title: form.title,
              description: form.description,
              priority: form.priority,
              column: form.column,
              assigneeStudentId: form.assigneeStudentId || null,
              dueDate: form.dueDate || null,
            })
          }}
        >
          <Input label="Title" value={form.title} onChange={(e) => set('title', e.target.value)} required minLength={2} maxLength={120} placeholder="e.g. Draft similarity evaluation" />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-700">Details</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              maxLength={1000}
              placeholder="Optional context, links, acceptance criteria…"
              className="w-full rounded-xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm text-navy-900 shadow-sm placeholder:text-navy-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Column" value={form.column} onChange={(e) => set('column', e.target.value)}>
              {COLUMNS.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </Select>
            <Select label="Priority" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </Select>
            <Select label="Assignee" value={form.assigneeStudentId} onChange={(e) => set('assigneeStudentId', e.target.value)}>
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.studentId} value={m.studentId}>{m.name}</option>
              ))}
            </Select>
            <Input label="Due date" type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={saving}>Save card</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

export function KanbanBoard({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useApiQuery<BoardData>(
    ['kanban', projectId],
    `/kanban/projects/${projectId}`,
    { refetchInterval: 8_000 }
  )

  const [dragCardId, setDragCardId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  const [modal, setModal] = useState<{ mode: 'create' } | { mode: 'edit'; card: any } | null>(null)

  const updateCard = useApiMutation((p: { cardId: string; body: any }) => api.patch(`/kanban/cards/${p.cardId}`, p.body), [['kanban', projectId]])
  const moveCard = useApiMutation((p: { cardId: string; body: any }) => api.patch(`/kanban/cards/${p.cardId}/move`, p.body), [['kanban', projectId]])
  const createCard = useApiMutation((body: any) => api.post(`/kanban/projects/${projectId}`, body), [['kanban', projectId]])
  const deleteCard = useApiMutation((cardId: string) => api.delete(`/kanban/cards/${cardId}`), [['kanban', projectId]])

  const cardsByColumn = useMemo(() => {
    const map: Record<string, BoardData['cards']> = {}
    if (data) {
      for (const col of COLUMNS) map[col.key] = data.cards.filter((c) => c.column === col.key)
    }
    return map
  }, [data])

  const bump = () => queryClient.invalidateQueries({ queryKey: ['kanban', projectId] })

  const onDropInto = async (column: string, event: React.DragEvent) => {
    event.preventDefault()
    const cardId = dragCardId || event.dataTransfer.getData('text/kanban-card')
    setDragCardId(null)
    setDragOverColumn(null)
    if (!cardId) return
    const element = (event.target as HTMLElement).closest('[data-card-id]')
    const afterCardId = element?.getAttribute('data-card-id')
    if (afterCardId === cardId) return
    // Optimistic reposition, then let the server confirm.
    queryClient.setQueryData<BoardData>(['kanban', projectId], (prev) => {
      if (!prev) return prev
      const cards = prev.cards.map((c) => (c.id === cardId ? { ...c, column } : c))
      return { ...prev, cards }
    })
    try {
      await moveCard.mutateAsync({ cardId, body: { column, afterCardId } })
    } catch {
      bump()
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {COLUMNS.map((c) => (
          <Card key={c.key} className="h-48 animate-pulse bg-navy-100/60" />
        ))}
      </div>
    )
  }
  if (error) {
    return <Card className="p-6"><p className="text-sm text-red-600">{(error as Error).message}</p></Card>
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-navy-400">Drag cards between the columns — everyone on the project shares one live board.</p>
        <Button size="sm" onClick={() => setModal({ mode: 'create' })}>
          <Plus className="h-4 w-4" /> Add card
        </Button>
      </div>

      {data!.cards.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="Your board is empty"
          description="Add the first card to start planning the team's work — analysis, prototyping, testing, whatever needs doing next."
          action={<Button onClick={() => setModal({ mode: 'create' })}><Plus className="h-4 w-4" /> Add card</Button>}
        />
      ) : (
        <div
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
          onDragOver={(e) => e.preventDefault()}
        >
          {COLUMNS.map((col) => {
            const cards: BoardData['cards'] = cardsByColumn[col.key] || []
            const isOver = dragOverColumn === col.key && dragCardId
            return (
              <div
                key={col.key}
                onDragOver={(e) => { e.preventDefault(); setDragOverColumn(col.key) }}
                onDragLeave={() => setDragOverColumn((c) => (c === col.key ? null : c))}
                onDrop={(e) => onDropInto(col.key, e)}
                className={cn(
                  'flex min-h-[220px] flex-col rounded-2xl border p-3 transition-colors',
                  isOver ? 'border-brand-400 bg-brand-50/40' : 'border-navy-200 bg-navy-100/50'
                )}
              >
                <div className="mb-2.5 flex items-center justify-between px-1">
                  <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-navy-500">
                    {col.label}
                    <Badge variant="neutral">{cards.length}</Badge>
                  </span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {cards.map((card) => (
                    <div
                      key={card.id}
                      data-card-id={card.id}
                      draggable
                      onDragStart={(e) => {
                        setDragCardId(card.id)
                        e.dataTransfer.setData('text/kanban-card', card.id)
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onDragEnd={() => { setDragCardId(null); setDragOverColumn(null) }}
                      className={cn(
                        'group cursor-grab rounded-xl border border-navy-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-lift active:cursor-grabbing',
                        dragCardId === card.id && 'opacity-40'
                      )}
                    >
                      <div className="flex items-start gap-1.5">
                        <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-navy-300" />
                        <div className="min-w-0 flex-1">
                          <p className={cn('text-sm font-semibold text-navy-900', card.column === 'DONE' && 'line-through decoration-navy-400')}>{card.title}</p>
                          {card.description && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-navy-500">{card.description}</p>}
                        </div>
                      </div>
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pl-5">
                        <Badge variant={priorityTone[(card.priority as 'HIGH' | 'MEDIUM' | 'LOW') ?? 'MEDIUM']}>
                          {card.priority.toLowerCase()}
                        </Badge>
                        {card.dueDate && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-navy-400">
                            <CalendarDays className="h-3 w-3" /> {fmtDate(card.dueDate)}
                          </span>
                        )}
                        {card.assigneeName && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-navy-400">
                            <UserRound className="h-3 w-3" /> {card.assigneeName}
                          </span>
                        )}
                        <span className="ms-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() => setModal({ mode: 'edit', card })}
                            className="rounded-md px-1.5 py-1 text-[11px] font-semibold text-brand-600 hover:bg-brand-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await deleteCard.mutateAsync(card.id)
                              } catch { bump() }
                            }}
                            className="rounded-md px-1.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50"
                            aria-label="Delete card"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      </div>
                    </div>
                  ))}
                  {cards.length === 0 && (
                    <p className="rounded-xl border border-dashed border-navy-200 px-3 py-6 text-center text-xs text-navy-400">
                      Drop cards here
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal?.mode === 'create' && (
        <CardModal
          title="Add a card"
          initial={null}
          members={data!.members}
          saving={createCard.isPending}
          onClose={() => setModal(null)}
          onSave={async (payload) => {
            try {
              await createCard.mutateAsync({ ...payload, column: payload.column || 'TODO' })
              setModal(null)
              bump()
            } catch (err: any) {
              alert(err.message)
            }
          }}
        />
      )}
      {modal?.mode === 'edit' && (
        <CardModal
          title="Edit card"
          initial={modal.card}
          members={data!.members}
          saving={updateCard.isPending}
          onClose={() => setModal(null)}
          onSave={async (payload) => {
            try {
              await updateCard.mutateAsync({ cardId: modal.card.id, body: payload })
              setModal(null)
              bump()
            } catch (err: any) {
              alert(err.message)
            }
          }}
        />
      )}
    </div>
  )
}
