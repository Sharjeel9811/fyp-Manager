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

export const markAllRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  await Notification.updateMany({ userId: req.user!.id, isRead: false }, { isRead: true })
  res.json({ success: true, message: 'All notifications marked as read' })
})

export const deleteNotification = asyncHandler(async (req: AuthRequest, res: Response) => {
  await Notification.deleteOne({ _id: req.params.id, userId: req.user!.id })
  res.json({ success: true, message: 'Notification removed' })
})
