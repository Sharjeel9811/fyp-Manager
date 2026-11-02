import { Response } from 'express'
import { Notification } from '../models'
import { AuthRequest } from '../middleware/auth'
import { asyncHandler } from '../utils/helpers'

function mapNotification(n: any) {
  return {
    id: String(n._id),
    title: n.title,
    message: n.message,
    type: n.type,
    unread: !n.isRead,
    isRead: !!n.isRead,
    link: n.link || null,
    time: n.createdAt,
    createdAt: n.createdAt,
  }
}

export const getNotifications = asyncHandler(async (req: AuthRequest, res: Response) => {
  const items: any[] = await Notification.find({ userId: req.user!.id }).sort({ createdAt: -1 }).limit(50).lean()
  res.json({
    success: true,
    notifications: items.map(mapNotification),
    unread: items.filter((n) => !n.isRead).length,
  })
})

export const markRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  await Notification.updateOne({ _id: req.params.id, userId: req.user!.id }, { isRead: true })
  res.json({ success: true, message: 'Marked as read' })
})

/**
 * Mark a specific set of notifications read — used when the header dropdown is
 * opened, so the unread badge clears for exactly what the user just saw.
 */
export const markManyRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id: any) => typeof id === 'string').slice(0, 100) : []
  if (!ids.length) return res.json({ success: true, message: 'Nothing to mark as read', updated: 0 })
  const result = await Notification.updateMany(
    { _id: { $in: ids }, userId: req.user!.id, isRead: false },
    { isRead: true }
  )
  res.json({ success: true, message: 'Marked as read', updated: result.modifiedCount ?? 0 })
})

export const markAllRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  await Notification.updateMany({ userId: req.user!.id, isRead: false }, { isRead: true })
  res.json({ success: true, message: 'All notifications marked as read' })
})

export const deleteNotification = asyncHandler(async (req: AuthRequest, res: Response) => {
  await Notification.deleteOne({ _id: req.params.id, userId: req.user!.id })
  res.json({ success: true, message: 'Notification removed' })
})
