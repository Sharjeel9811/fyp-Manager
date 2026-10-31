import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import * as auth from '../controllers/authController'
import { authenticate } from '../middleware/auth'

const router = Router()

/**
 * Only *failed* logins count, so normal sign-ins never consume the budget.
 * 100 bad passwords per IP+account per 15 minutes stops credential stuffing
 * while being unreachable in practice: nobody mistypes a password that many
 * times, and a shared campus NAT cannot lock an account out.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skipSuccessfulRequests: true,
  keyGenerator: (req: any) => `${req.ip}:${String(req.body?.email || '').toLowerCase()}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many failed login attempts. Try again in 15 minutes.' },
})

router.post('/register', auth.register)
router.post('/verify-otp', auth.verifyOtp)
router.post('/resend-otp', auth.resendOtp)
router.post('/dispatch-mail', auth.dispatchMail)
router.post('/login', loginLimiter, auth.login)
router.get('/verify-email/:token', auth.verifyEmail)
router.post('/forgot-password', auth.forgotPassword)
router.post('/reset-password', auth.resetPassword)
router.get('/me', authenticate, auth.getMe)
router.put('/me', authenticate, auth.updateMe)
router.put('/avatar', authenticate, auth.uploadAvatar)
router.delete('/avatar', authenticate, auth.removeAvatar)
router.put('/password', authenticate, auth.changePassword)
router.post('/logout', authenticate, auth.logout)

export default router
