import { Response } from 'express'
import * as mockDefense from '../services/mockDefense'
import { AuthRequest } from '../middleware/auth'
import { asyncHandler, fullName } from '../utils/helpers'

function actorFrom(req: AuthRequest): mockDefense.MockActor {
  return { id: req.user!.id, role: req.user!.role }
}

export const getLatest = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = await mockDefense.getLatest(req.params.projectId, actorFrom(req))
  res.json({ success: true, ...data })
})

export const start = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = await mockDefense.start(req.params.projectId, actorFrom(req))
  res.status(201).json({ success: true, message: 'Mock defense started', session: data.session })
})

export const answer = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = await mockDefense.answer(req.params.sessionId, actorFrom(req), {
    answer: req.body?.answer,
  })
  res.json({ success: true, message: 'Answer evaluated', ...data })
})
