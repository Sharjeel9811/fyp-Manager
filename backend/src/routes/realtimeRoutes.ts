import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { getRealtimeStatus, pushActivity, checkPresence } from '../controllers/realtimeController'

const router = Router()
router.use(authenticate)
router.get('/status', getRealtimeStatus)
router.get('/presence', checkPresence)
router.post('/activity', pushActivity)

export default router

