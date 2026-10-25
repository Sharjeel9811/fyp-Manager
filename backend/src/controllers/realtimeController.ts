import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { asyncHandler } from '../utils/helpers'
import {
  broadcastActivity,
  getOnlineCount,
  getOnlineSessions,
  getOnlineUsers,
  isUserOnline,
} from '../services/realtime'

export const getRealtimeStatus = asyncHandler(async (_req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    online: getOnlineCount(),
    users: getOnlineUsers(),
    sessions: getOnlineSessions(),
    ts: Date.now(),
  })
})

/**
 * Manual activity push. Admin-only: letting every authenticated user emit
 * arbitrary feed items would allow spoofed/duplicated activity rows.
 */
export const pushActivity = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { type, message, meta } = req.body || {}
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ success: false, message: 'A message is required' })
  }

  const item = await broadcastActivity({
    type: typeof type === 'string' ? type.slice(0, 32) : 'info',
    message: message.slice(0, 300),
    meta: meta && typeof meta === 'object' ? meta : {},
    byUserId: req.user!.id,
  })

  res.json({ success: true, activity: item })
})

export const checkPresence = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = String(req.query.userId || '')
  res.json({ success: true, userId, online: userId ? isUserOnline(userId) : false })
})
