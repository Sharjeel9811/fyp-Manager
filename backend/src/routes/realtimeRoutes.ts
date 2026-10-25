import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth'
import { getRealtimeStatus, pushActivity, checkPresence } from '../controllers/realtimeController'

const router = Router()
router.use(authenticate)
router.get('/status', getRealtimeStatus)
router.get('/presence', checkPresence)
router.post('/activity', authorize('ADMIN'), pushActivity)

export default router
