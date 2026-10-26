import { Response } from 'express'
import { getProjectRepoFetch, canViewProject, publishProject, repoSlugFromTitle } from '../services/github'
import { Project } from '../models'
import { AuthRequest } from '../middleware/auth'
import { asyncHandler } from '../utils/helpers'

export const getFeed = asyncHandler(async (req: AuthRequest, res: Response) => {
  const allowed = await canViewProject(req.user!.id, req.user!.role, req.params.projectId)
  if (!allowed) return res.status(403).json({ success: false, message: 'You do not have access to this repository' })

  const { repo, data, fresh } = await getProjectRepoFetch(req.params.projectId)
  if (!repo) {
    return res.json({ success: true, repo: null, feed: null, fresh: false, message: 'The team has not linked a repository yet' })
  }
  res.json({ success: true, repo, feed: data, fresh })
})

/**
 * Default repository name the publish form suggests, derived from the project
 * title (the body of a slug can come from the title alone).
 */
export const publishPresets = asyncHandler(async (req: AuthRequest, res: Response) => {
  const allowed = await canViewProject(req.user!.id, req.user!.role, req.params.projectId)
  if (!allowed) return res.status(403).json({ success: false, message: 'You do not have access to this project' })
  const project: any = await Project.findById(req.params.projectId).select('title githubRepo').lean()
  if (!project) return res.status(404).json({ success: false, message: 'Project not found' })
  res.json({ success: true, suggestedName: repoSlugFromTitle(project.title), linkedRepo: project.githubRepo || null })
})

export const publish = asyncHandler(async (req: AuthRequest, res: Response) => {
  const allowed = await canViewProject(req.user!.id, req.user!.role, req.params.projectId)
  if (!allowed) return res.status(403).json({ success: false, message: 'You do not have access to this project' })

  const result = await publishProject(req.params.projectId, { id: req.user!.id, role: req.user!.role }, req.body || {})
  const message = result.created
    ? `Created ${result.repo} on GitHub and published ${result.files.length} file(s)`
    : `Updated the repository with the latest project documents`
  res.json({ success: true, message, published: { ...result, files: result.files }, warnings: result.warnings })
})
