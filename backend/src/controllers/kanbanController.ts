import { Response } from 'express'
import * as kanban from '../services/kanban'
import { AuthRequest } from '../middleware/auth'
import { asyncHandler } from '../utils/helpers'

function actor(req: AuthRequest): kanban.BoardActor {
  return { id: req.user!.id, role: req.user!.role }
}

/**
 * Shape the caller: every action re-checks project membership inside the
 * service (route guard is the first check, not the only one).
 */
export const list = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ success: true, ...(await kanban.list(req.params.projectId, actor(req))) })
})

export const create = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = await kanban.create(req.params.projectId, actor(req), req.body)
  res.status(201).json({ success: true, message: 'Card added to the board', ...data })
})

export const update = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = await kanban.update(req.params.cardId, actor(req), req.body)
  res.json({ success: true, message: 'Card updated', ...data })
})

export const move = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = await kanban.move(req.params.cardId, actor(req), req.body)
  res.json({ success: true, message: 'Card moved', ...data })
})

export const remove = asyncHandler(async (req: AuthRequest, res: Response) => {
  await kanban.remove(req.params.cardId, actor(req))
  res.json({ success: true, message: 'Card deleted' })
})
