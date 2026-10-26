import { Router } from 'express'
import { getFeed, publish, publishPresets } from '../controllers/githubController'
import { authenticate } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// Access is re-checked against project membership / assigned supervisor in the
// controller (same rules as the realtime project room).
router.get('/projects/:projectId', getFeed)
router.get('/projects/:projectId/publish/presets', publishPresets)
router.post('/projects/:projectId/publish', publish)

export default router
