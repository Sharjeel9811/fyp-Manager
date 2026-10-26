import { useApiQuery } from '@/hooks/useApi'
import { PageHeader, ErrorState, SkeletonPage } from '@/components/shared/Common'
import { KanbanBoard } from '@/components/KanbanBoard'
import { Card } from '@/components/ui/Card'

/**
 * The Kanban board lives under the student's project. Membership is checked
 * again server-side; supervisors and admins can reach the same board through
 * the API but the student workspace owns the page.
 */
export function StudentKanban() {
  const { data, isLoading, error, refetch } = useApiQuery<any>(['student', 'project'], '/student/project')

  if (isLoading) return <SkeletonPage />
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
  if (!data?.project) {
    return <Card className="p-6"><p className="text-sm text-navy-500">Join or create a project to use the task board.</p></Card>
  }

  return (
    <div>
      <PageHeader
        eyebrow="Project"
        title="Task board"
        description={`Live kanban for “${data.project.title}” — plan the work, drag it across the board, and see ownership at a glance.`}
      />
      <KanbanBoard projectId={data.project.id} />
    </div>
  )
}
