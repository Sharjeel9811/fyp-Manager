import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import * as auth from '../controllers/authController'
import { authenticate } from '../middleware/auth'

const router = Router()

/**
 * The global /api limiter (1000 / 15 min) is far too loose for credential
 * stuffing. This one only counts *failed* logins, so normal sign-ins never
 * consume the budget: 10 bad passwords per IP per 15 minutes.
 *
 * Deliberately keyed by IP (express-rate-limit's default) rather than email, so
 * an attacker cannot lock a known account out of its own login. On a shared
 * campus NAT, raise `max` or key by IP + email once Redis is available.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many failed login attempts. Try again in 15 minutes.' },
})

router.post('/register', auth.register)
router.post('/verify-otp', auth.verifyOtp)
router.post('/resend-otp', auth.resendOtp)
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
