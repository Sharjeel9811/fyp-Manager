import { Router } from 'express'
import * as notifications from '../controllers/notificationController'
import { authenticate } from '../middleware/auth'

const router = Router()
router.use(authenticate)

router.get('/', notifications.getNotifications)
router.patch('/read-all', notifications.markAllRead)
router.patch('/:id/read', notifications.markRead)
router.delete('/:id', notifications.deleteNotification)

export default router
