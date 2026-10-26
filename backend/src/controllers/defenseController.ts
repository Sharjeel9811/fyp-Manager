import { Response } from 'express'
import * as defense from '../services/defense'
import { AuthRequest } from '../middleware/auth'
import { asyncHandler, fullName } from '../utils/helpers'

function actorFrom(req: AuthRequest): defense.DefenseActor {
  return {
    id: req.user!.id,
    role: req.user!.role,
    name: fullName(req.user!),
  }
}

export const getProjectState = asyncHandler(async (req: AuthRequest, res: Response) => {
  const state = await defense.getProjectState(req.params.projectId, actorFrom(req))
  res.json({ success: true, ...state })
})

export const start = asyncHandler(async (req: AuthRequest, res: Response) => {
  const state = await defense.startDefense(req.params.projectId, actorFrom(req), {
    durationMinutes: req.body?.durationMinutes,
  })
  res.status(201).json({ success: true, message: 'Live defense started', ...state })
})

export const score = asyncHandler(async (req: AuthRequest, res: Response) => {
  const state = await defense.submitScore(req.params.sessionId, actorFrom(req), {
    criterionId: req.body?.criterionId,
    score: req.body?.score,
    comment: req.body?.comment,
  })
  res.json({ success: true, message: 'Score locked', ...state })
})

export const next = asyncHandler(async (req: AuthRequest, res: Response) => {
  const state = await defense.advanceCriterion(req.params.sessionId, actorFrom(req))
  res.json({ success: true, message: 'Moved to the next criterion', ...state })
})

export const end = asyncHandler(async (req: AuthRequest, res: Response) => {
  const state = await defense.endDefense(req.params.sessionId, actorFrom(req))
  res.json({ success: true, message: 'Defense ended', ...state })
})

export const release = asyncHandler(async (req: AuthRequest, res: Response) => {
  const state = await defense.releaseResults(req.params.sessionId, actorFrom(req))
  res.json({ success: true, message: 'Defense results released', ...state })
})

export const unlock = asyncHandler(async (req: AuthRequest, res: Response) => {
  const state = await defense.unlockScore(req.params.sessionId, actorFrom(req), {
    evaluatorId: req.body?.evaluatorId,
    criterionId: req.body?.criterionId,
  })
  res.json({ success: true, message: 'Score unlocked', ...state })
})
