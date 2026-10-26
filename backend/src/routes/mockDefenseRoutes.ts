import { Router } from 'express'
import * as mock from '../controllers/mockDefenseController'
import { authenticate, authorize } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// Students practise their own project's defense; admins may review any project.
// (Authorizationing is re-checked against project membership in the service.)
router.get('/projects/:projectId/latest', authorize('STUDENT', 'ADMIN'), mock.getLatest)
router.post('/projects/:projectId/start', authorize('STUDENT', 'ADMIN'), mock.start)
router.post('/sessions/:sessionId/answer', authorize('STUDENT', 'ADMIN'), mock.answer)

export default router
