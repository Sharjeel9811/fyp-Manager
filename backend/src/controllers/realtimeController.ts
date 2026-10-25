import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { asyncHandler } from '../utils/helpers'
import { broadcastActivity, getOnlineCount, getOnlineUsers, isUserOnline } from '../services/realtime'

export const getRealtimeStatus = asyncHandler(async (_req: AuthRequest, res: Response) => {
  res.json({ success: true, online: getOnlineCount(), users: getOnlineUsers(), ts: Date.now() })
})

export const pushActivity = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { type, message, meta } = req.body || {}
  broadcastActivity({ type: type || 'info', message: message || 'Activity update', meta: meta || {}, by: req.user?.email })
  res.json({ success: true })
})

export const checkPresence = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = String(req.query.userId || '')
  res.json({ success: true, userId, online: userId ? isUserOnline(userId) : false })
})

