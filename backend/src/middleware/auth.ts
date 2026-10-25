import jwt from 'jsonwebtoken'
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

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined

    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string; tokenVersion?: number }
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
