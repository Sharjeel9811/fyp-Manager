import { Router } from 'express'
import * as supervisor from '../controllers/supervisorController'
import { authenticate, authorize } from '../middleware/auth'

const router = Router()
router.use(authenticate, authorize('SUPERVISOR'))

router.get('/overview', supervisor.getOverview)
router.get('/projects', supervisor.getProjects)
router.get('/projects/:id/health', supervisor.getProjectDetail)
router.get('/reviews', supervisor.getReviews)
router.post('/proposals/:id/review', supervisor.reviewProposal)
router.post('/submissions/:id/review', supervisor.reviewSubmission)
router.get('/milestones', supervisor.getMilestones)
router.get('/health', supervisor.getHealth)
router.post('/health/recalculate', supervisor.recalculateHealth)
router.get('/schedule', supervisor.getSchedule)
router.get('/reports', supervisor.getReports)

export default router
