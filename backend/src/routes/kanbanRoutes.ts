import { Router } from 'express'
import * as kanban from '../controllers/kanbanController'
import { authenticate } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// Board access is re-checked in the service: team members manage the board,
// the assigned supervisor and admins can view and edit, other roles get 403.
router.get('/projects/:projectId', kanban.list)
router.post('/projects/:projectId', kanban.create)
router.patch('/cards/:cardId', kanban.update)
router.patch('/cards/:cardId/move', kanban.move)
router.delete('/cards/:cardId', kanban.remove)

export default router
