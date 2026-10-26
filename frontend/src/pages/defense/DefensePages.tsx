import { useEffect, useState } from 'react'
import { Radio } from 'lucide-react'
import { PageHeader, EmptyState, ErrorState, SkeletonPage } from '@/components/shared/Common'
import { Select } from '@/components/ui/Input'
import { LiveDefensePanel } from '@/components/LiveDefensePanel'
import { useApiQuery } from '@/hooks/useApi'

function ProjectPicker({
  projects,
  selected,
  onChange,
}: {
  projects: any[]
  selected: string
  onChange: (value: string) => void
}) {
  if (!projects.length) return null
  return (
    <div className="w-full sm:w-[22rem]">
      <Select value={selected} onChange={(e) => onChange(e.target.value)} aria-label="Select project">
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
          </option>
        ))}
      </Select>
    </div>
  )
}

export function StudentLiveDefense() {
  const { data, isLoading, error, refetch } = useApiQuery<any>(['student', 'project'], '/student/project')

  if (isLoading) return <SkeletonPage />
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  const projectId = data?.project?.id

  return (
    <div>
      <PageHeader
        eyebrow="Live defense"
        title="Defense room"
        description="Follow the panel timer and see your results the moment the coordinator releases them."
      />
      {projectId ? (
        <LiveDefensePanel projectId={projectId} />
      ) : (
        <EmptyState
          icon={Radio}
          title="No project yet"
          description="Your defense room appears once you are part of a project."
        />
      )}
    </div>
  )
}

export function SupervisorLiveDefense() {
  const { data, isLoading, error, refetch } = useApiQuery<any>(['supervisor', 'projects'], '/supervisor/projects')
  const projects: any[] = data?.projects ?? []
  const [selected, setSelected] = useState('')

  useEffect(() => {
    if (!selected && projects.length) setSelected(String(projects[0].id))
  }, [projects, selected])

  if (isLoading) return <SkeletonPage />
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  return (
    <div>
      <PageHeader
        eyebrow="Evaluation"
        title="Live defense"
        description="Score the current rubric criterion. Submitted scores lock instantly and the panel aggregate updates live."
        actions={<ProjectPicker projects={projects} selected={selected} onChange={setSelected} />}
      />
      {selected ? (
        <LiveDefensePanel projectId={selected} />
      ) : (
        <EmptyState
          icon={Radio}
          title="No assigned projects"
          description="Live defenses appear here once a project is assigned to you or you are named on its panel."
        />
      )}
    </div>
  )
}

export function AdminLiveDefense() {
  const { data, isLoading, error, refetch } = useApiQuery<any>(['admin', 'projects'], '/admin/projects')
  const projects: any[] = data?.projects ?? []
  const [selected, setSelected] = useState('')

  useEffect(() => {
    if (!selected && projects.length) setSelected(String(projects[0].id))
  }, [projects, selected])

  if (isLoading) return <SkeletonPage />
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  return (
    <div>
      <PageHeader
        eyebrow="Evaluation"
        title="Live defense control"
        description="Start a session, follow the rubric, unlock a mistaken score, and release results when the panel is done."
        actions={<ProjectPicker projects={projects} selected={selected} onChange={setSelected} />}
      />
      {selected ? (
        <LiveDefensePanel projectId={selected} />
      ) : (
        <EmptyState
          icon={Radio}
          title="No projects"
          description="Create or seed a project before running a live defense."
        />
      )}
    </div>
  )
}
