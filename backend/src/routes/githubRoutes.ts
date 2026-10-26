import { Router } from 'express'
import { getFeed } from '../controllers/githubController'
import { authenticate } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// Access is re-checked against project membership / assigned supervisor in the
// controller (same rules as the realtime project room).
router.get('/projects/:projectId', getFeed)

export default router
