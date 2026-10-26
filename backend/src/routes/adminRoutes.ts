import { Router } from 'express'
import * as admin from '../controllers/adminController'
import { authenticate, authorize } from '../middleware/auth'

const router = Router()
router.use(authenticate, authorize('ADMIN'))

router.get('/overview', admin.getOverview)
router.get('/users', admin.getUsers)
router.post('/users', admin.createUser)
router.put('/users/:id', admin.updateUser)
router.delete('/users/:id', admin.deleteUser)
router.get('/departments', admin.getDepartments)
router.post('/departments', admin.createDepartment)
router.get('/sessions', admin.getSessions)
router.post('/sessions', admin.createSession)
router.patch('/sessions/:id/activate', admin.activateSession)
router.get('/projects', admin.getProjects)
router.get('/proposals', admin.getProposals)
router.patch('/proposals/:id/decision', admin.decideProposal)
router.get('/assignments/recommendations', admin.getAssignmentRecommendations)
router.get('/assignments', admin.getAssignments)
router.post('/assignments', admin.assignSupervisor)
router.get('/supervisors', admin.getSupervisors)
router.get('/deadlines', admin.getDeadlines)
router.post('/deadlines', admin.createDeadline)
router.get('/evaluations', admin.getEvaluations)
router.get('/similarity', admin.getSimilarity)
router.post('/evaluations/release', admin.releaseEvaluations)
router.get('/reports', admin.getReports)
router.get('/audit-logs', admin.getAuditLogs)
router.get('/settings', admin.getSettings)
router.put('/settings', admin.updateSettings)

export default router
