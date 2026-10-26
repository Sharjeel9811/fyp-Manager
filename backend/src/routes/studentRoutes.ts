import { Router } from 'express'
import * as student from '../controllers/studentController'
import { authenticate, authorize } from '../middleware/auth'

const router = Router()
router.use(authenticate, authorize('STUDENT'))

router.get('/overview', student.getOverview)
router.get('/project', student.getProject)
router.post('/project/register', student.registerProject)
router.put('/project/repo', student.updateRepo)
router.get('/proposal', student.getProposal)
router.put('/proposal', student.saveProposal)
router.get('/team', student.getTeam)
router.post('/team/invite', student.inviteMember)
router.delete('/team/:id', student.removeMember)
router.get('/milestones', student.getMilestones)
router.patch('/milestones/:id', student.updateMilestone)
router.get('/submissions', student.getSubmissions)
router.post('/submissions', student.createSubmission)
router.delete('/submissions/:id', student.deleteSubmission)
router.get('/feedback', student.getFeedback)
router.post('/feedback/:id/reply', student.replyToFeedback)
router.get('/evaluations', student.getEvaluations)

export default router
