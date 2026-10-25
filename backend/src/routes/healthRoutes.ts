import { Router } from 'express'
import { systemHealth } from '../controllers/systemController'

const router = Router()

router.get('/', systemHealth)

export default router
