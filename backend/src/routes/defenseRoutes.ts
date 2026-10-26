import { Router } from 'express'
import * as defense from '../controllers/defenseController'
import { authenticate, authorize } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// Read: students may read their own project's public state; supervisors/admins
// get the detailed view when they are on the panel.
router.get('/projects/:projectId', defense.getProjectState)

// Control: assigned supervisor, panel member, or admin (re-checked in the service).
router.post('/projects/:projectId/start', authorize('SUPERVISOR', 'ADMIN'), defense.start)
router.post('/sessions/:sessionId/score', authorize('SUPERVISOR', 'ADMIN'), defense.score)
router.post('/sessions/:sessionId/next', authorize('SUPERVISOR', 'ADMIN'), defense.next)
router.post('/sessions/:sessionId/end', authorize('SUPERVISOR', 'ADMIN'), defense.end)

// Coordination only.
router.post('/sessions/:sessionId/release', authorize('ADMIN'), defense.release)
router.post('/sessions/:sessionId/unlock', authorize('ADMIN'), defense.unlock)

export default router
