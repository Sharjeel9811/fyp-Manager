import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { asyncHandler } from '../utils/helpers'
import { ChatMessage, StudentProfile, SupervisorProfile, ProjectMember, SupervisorAssignment } from '../models'
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

/**
 * REST chat history. Sockets deliver messages instantly, but two sockets can
 * live on different serverless instances, so the durable log is what makes
 * team chat reliable: the panel hydrates and refreshes from here.
 * Access = project members, the assigned supervisor, or admins.
 */
export const getChatHistory = asyncHandler(async (req: AuthRequest, res: Response) => {
  const projectId = String(req.params.roomId || '')
  const OBJECT_ID = /^[a-f\d]{24}$/i
  if (!OBJECT_ID.test(projectId)) {
    return res.status(400).json({ success: false, message: 'Invalid room' })
  }

  let allowed = req.user!.role === 'ADMIN'
  if (!allowed) {
    if (req.user!.role === 'STUDENT') {
      const profile: any = await StudentProfile.findOne({ userId: req.user!.id }).lean()
      allowed = !!(profile && (await ProjectMember.exists({ projectId, studentId: profile._id })))
    } else if (req.user!.role === 'SUPERVISOR') {
      const profile: any = await SupervisorProfile.findOne({ userId: req.user!.id }).lean()
      allowed = !!(profile && (await SupervisorAssignment.exists({ projectId, supervisorId: profile._id })))
    }
  }
  if (!allowed) return res.status(403).json({ success: false, message: 'Not a member of this project' })

  const rows: any[] = await ChatMessage.find({ projectId }).sort({ ts: 1 }).limit(200).lean()
  res.json({
    success: true,
    roomId: projectId,
    messages: rows.map((m) => ({
      id: (m as any).messageId || String(m._id),
      roomId: projectId,
      text: m.text,
      senderId: String(m.senderId),
      sender: { id: String(m.senderId), name: m.senderName, role: m.senderRole },
      ts: Number(m.ts),
    })),
  })
})
