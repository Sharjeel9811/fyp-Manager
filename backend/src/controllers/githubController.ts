import { Response } from 'express'
import { getProjectRepoFetch, canViewProject } from '../services/github'
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
