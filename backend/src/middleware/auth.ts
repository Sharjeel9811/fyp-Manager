import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import { Request, Response, NextFunction } from 'express'
import { User } from '../models'

export interface AppUser {
  id: string
  email: string
  role: 'STUDENT' | 'SUPERVISOR' | 'ADMIN'
  firstName: string
  lastName: string
}

export interface AuthRequest extends Request {
  user?: AppUser
}

/**
 * Cold-start tolerance. On serverless/Fluid the module can be evaluated before
 * `connectDB()` finishes opening; a DB lookup in auth would throw/timeout and
 * 401 a perfectly valid token — which the frontend treats as "logged out".
 * Give the connection a grace window instead.
 */
async function waitForDb(maxMs = 8000): Promise<boolean> {
  if (Number(mongoose.connection.readyState) === 1) return true
  const start = Date.now()
  while (Number(mongoose.connection.readyState) !== 1) {
    if (Date.now() - start >= maxMs) return Number(mongoose.connection.readyState) === 1
    await new Promise((r) => setTimeout(r, 250))
  }
  return true
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined

    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string; tokenVersion?: number }
    if (!(await waitForDb())) {
      // Not the client's fault — a valid token served by a warming instance.
      return res.status(503).json({ success: false, message: 'Service is warming up, retry in a moment' })
    }
    const user: any = await User.findById(decoded.id).select('_id email role firstName lastName isActive tokenVersion')

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid or inactive user' })
    }
    if ((decoded.tokenVersion || 0) !== (user.tokenVersion || 0)) {
      return res.status(401).json({ success: false, message: 'Session expired after a password change. Please sign in again.' })
    }

    req.user = {
      id: String(user._id),
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    }
    next()
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' })
  }
}

export const authorize = (...roles: AppUser['role'][]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' })
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied for this role' })
    }
    next()
  }
}
