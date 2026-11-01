import { Link } from 'react-router-dom'
import { Github } from 'lucide-react'
import { PageHeader, EmptyState, ErrorState, SkeletonPage } from '@/components/shared/Common'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { GitHubFeed } from '@/components/GitHubFeed'
import { useApiQuery } from '@/hooks/useApi'

/**
 * Dedicated GitHub integration page.
 *
 * The same feed is embedded on the Project Workspace page for context; this
 * page gives it a first-class destination in the sidebar and keeps the nav
 * item's route distinct (two nav entries sharing `/student/project` made both
 * look active and duplicated the layout indicator).
 */
export function StudentGitHub() {
  const { data, isLoading, error, refetch } = useApiQuery<any>(['student', 'project'], '/student/project', {
    refetchInterval: 30_000,
  })

  if (isLoading) return <SkeletonPage />

  if (error) {
    const msg = (error as Error).message
    if (/no project/i.test(msg)) {
      return (
        <Card className="p-8 text-center">
          <EmptyState
            icon={Github}
            title="No project yet"
            description="Your team hasn't registered a project yet. Register one first, then link the team's GitHub repository here."
          />
          <div className="mt-4 flex justify-center">
            <Link to="/student/team"><Button>Start on the Team page</Button></Link>
          </div>
        </Card>
      )
    }
    return <ErrorState message={msg} onRetry={() => refetch()} />
  }

  const project = data?.project
  if (!project) return null

  return (
    <div>
      <PageHeader
        eyebrow="Project Workspace"
        title="GitHub contributions"
        description={`Commits, contributors, and repository pulse for “${project.title}”.`}
      />
      <GitHubFeed projectId={project.id} />
    </div>
  )
}
