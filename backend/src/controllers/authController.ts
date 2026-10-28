import { Response } from 'express'
import * as argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { Department, StudentProfile, SupervisorProfile, User } from '../models'
import { AppUser, AuthRequest } from '../middleware/auth'
import { asyncHandler, displayName } from '../utils/helpers'
import { disconnectUser } from '../services/realtime'

function signToken(user: any): string {
  return jwt.sign(
    { id: String(user._id), role: user.role, tokenVersion: user.tokenVersion || 0 },
    process.env.JWT_SECRET as string,
    { expiresIn: (process.env.JWT_EXPIRE || '7d') as any }
  )
}

async function buildProfile(userId: string) {
  const user: any = await User.findById(userId).lean()
  if (!user) return null

  const student: any = await StudentProfile.findOne({ userId }).lean()
  const supervisor: any = await SupervisorProfile.findOne({ userId }).lean()
  const profile = student || supervisor
  let department = null
  if (profile?.departmentId) {
    department = await Department.findById(profile.departmentId).lean()
  }

  return {
    id: String(user._id),
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    name: displayName(user.role, user),
    // Sent as a data: URI so the <img> header avatar works without sending an
    // Authorization header; absent when the user has never uploaded one.
    avatar: user.avatar?.mime ? `data:${user.avatar.mime};base64,${user.avatar.data}` : null,
    emailVerified: user.emailVerified,
    isActive: user.isActive,
    studentId: student?.studentId || null,
    employeeId: supervisor?.employeeId || null,
    phone: profile?.phone || null,
    bio: student?.bio || supervisor?.researchInterests || null,
    department: department?.name || null,
    departmentId: department?._id ? String(department._id) : null,
    maxSupervisees: supervisor?.maxSupervisees ?? null,
    availability: supervisor?.availability ?? null,
    createdAt: user.createdAt,
  }
}

export const register = asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName, role, studentId, employeeId, departmentId, departmentName } = req.body

  if (!email || !password || !firstName || !lastName || !role) {
    return res.status(400).json({ success: false, message: 'Missing required fields' })
  }
  if (!['STUDENT', 'SUPERVISOR'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Invalid role' })
  }
  if (String(password).length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' })
  }

  const existing = await User.findOne({ email: String(email).toLowerCase() })
  if (existing) {
    return res.status(400).json({ success: false, message: 'Email already registered' })
  }

  let deptId = departmentId
  if (!deptId && departmentName) {
    const dept: any = await Department.findOne({ name: departmentName })
    deptId = dept?._id
  }
  if (!deptId) {
    const dept: any = await Department.findOne()
    deptId = dept?._id
  }

  const passwordHash = await argon2.hash(password)
  let user: any
  try {
    user = await User.create({
      email: String(email).toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      role,
      emailVerified: true,
      emailVerifyToken: uuidv4(),
    })

    if (role === 'STUDENT') {
      const sid = studentId || `STU-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
      // Duplicate student IDs leave an unusable orphaned user behind, so the
      // uniqueness check happens before the profile row is ever created.
      await StudentProfile.create({
        userId: user._id,
        studentId: sid,
        departmentId: deptId,
      })
    } else {
      await SupervisorProfile.create({
        userId: user._id,
        employeeId: employeeId || `SUP-${Math.floor(1000 + Math.random() * 9000)}`,
        departmentId: deptId,
      })
    }
  } catch (err: any) {
    // Roll the bare user back so the email isn't locked out forever; surface
    // a friendly message for duplicate IDs.
    if (user?._id) await User.deleteOne({ _id: user._id }).catch(() => {})
    const dup = err && String(err.code) === '11000'
    if (dup) {
      return res.status(400).json({ success: false, message: 'That ID is already taken — check your student/staff ID and try again' })
    }
    throw err
  }

  const token = signToken(user)
  const profile = await buildProfile(String(user._id))

  res.status(201).json({
    success: true,
    message: 'Account created successfully',
    token,
    user: profile,
  })
})

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' })
  }

  const user: any = await User.findOne({ email: String(email).toLowerCase() })
  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' })
  }
  if (!user.isActive) {
    return res.status(403).json({ success: false, message: 'This account is inactive' })
  }

  const valid = await argon2.verify(user.passwordHash, password)
  if (!valid) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' })
  }

  user.lastLoginAt = new Date()
  await user.save()

  const token = signToken(user)
  const profile = await buildProfile(String(user._id))

  res.json({ success: true, token, user: profile })
})

export const getMe = asyncHandler(async (req: AuthRequest, res) => {
  const profile = await buildProfile(req.user!.id)
  if (!profile) return res.status(404).json({ success: false, message: 'User not found' })
  res.json({ success: true, user: profile })
})

export const updateMe = asyncHandler(async (req: AuthRequest, res) => {
  const { firstName, lastName, phone, bio, researchInterests } = req.body
  const updates: any = {}
  if (firstName) updates.firstName = firstName
  if (lastName) updates.lastName = lastName

  const user: any = await User.findByIdAndUpdate(req.user!.id, updates, { new: true })
  if (!user) return res.status(404).json({ success: false, message: 'User not found' })

  if (req.user!.role === 'STUDENT') {
    await StudentProfile.findOneAndUpdate(
      { userId: user._id },
      { ...(phone !== undefined && { phone }), ...(bio !== undefined && { bio }) }
    )
  } else if (req.user!.role === 'SUPERVISOR') {
    await SupervisorProfile.findOneAndUpdate(
      { userId: user._id },
      { ...(phone !== undefined && { phone }), ...(researchInterests !== undefined && { researchInterests }) }
    )
  }

  const profile = await buildProfile(String(user._id))
  res.json({ success: true, message: 'Profile updated', user: profile })
})

/**
 * Upload (or replace) the caller's profile picture. The browser sends a square
 * JPEG data URL it downscaled through canvas, so the payload stays small; the
 * raw bytes are capped at 200 KB and stored in the user document — the prod
 * API runs on an ephemeral filesystem, so uploaded media lives in MongoDB.
 */
const AVATAR_MAX_BYTES = 200 * 1024
export const uploadAvatar = asyncHandler(async (req: AuthRequest, res) => {
  const dataUrl = typeof req.body?.dataUrl === 'string' ? req.body.dataUrl : ''
  const match = dataUrl.match(/^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=]+)$/)
  if (!match) {
    return res.status(400).json({ success: false, message: 'Send the picture as a base64 image data URL (png, jpeg, or webp)' })
  }
  const [, mime, base64] = match
  const bytes = Buffer.from(base64, 'base64')
  if (bytes.length === 0) return res.status(400).json({ success: false, message: 'The picture is empty' })
  if (bytes.length > AVATAR_MAX_BYTES) {
    return res.status(400).json({ success: false, message: 'Picture is too large — please pick one under 200 KB' })
  }

  const user: any = await User.findByIdAndUpdate(
    req.user!.id,
    { avatar: { mime, data: base64, uploadedAt: new Date() } },
    { new: true }
  )
  if (!user) return res.status(404).json({ success: false, message: 'User not found' })

  const profile = await buildProfile(String(user._id))
  res.json({ success: true, message: 'Profile picture updated', user: profile })
})

export const removeAvatar = asyncHandler(async (req: AuthRequest, res) => {
  const user: any = await User.findByIdAndUpdate(req.user!.id, { avatar: null }, { new: true })
  if (!user) return res.status(404).json({ success: false, message: 'User not found' })
  const profile = await buildProfile(String(user._id))
  res.json({ success: true, message: 'Profile picture removed', user: profile })
})

export const changePassword = asyncHandler(async (req: AuthRequest, res) => {
  const { currentPassword, newPassword } = req.body
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Current and new password are required' })
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' })
  }

  const user: any = await User.findById(req.user!.id)
  if (!user) return res.status(404).json({ success: false, message: 'User not found' })

  const valid = await argon2.verify(user.passwordHash, currentPassword)
  if (!valid) return res.status(400).json({ success: false, message: 'Current password is incorrect' })

  user.passwordHash = await argon2.hash(newPassword)
  user.tokenVersion = (user.tokenVersion || 0) + 1
  await user.save()

  // Old sockets still carry the previous tokenVersion; drop them so the client
  // reconnects with the fresh token instead of running on a stale credential.
  disconnectUser(String(user._id))

  const token = signToken(user)
  const profile = await buildProfile(String(user._id))
  res.json({
    success: true,
    message: 'Password changed successfully. Other sessions have been signed out.',
    token,
    user: profile,
  })
})

export const verifyEmail = asyncHandler(async (req, res) => {
  const user: any = await User.findOne({ emailVerifyToken: req.params.token })
  if (!user) return res.status(400).json({ success: false, message: 'Invalid verification token' })

  user.emailVerified = true
  user.emailVerifyToken = null
  await user.save()
  res.json({ success: true, message: 'Email verified successfully' })
})

export const forgotPassword = asyncHandler(async (req, res) => {
  const user: any = await User.findOne({ email: String(req.body.email || '').toLowerCase() })
  if (user) {
    user.passwordResetToken = uuidv4()
    user.passwordResetExpires = new Date(Date.now() + 3600000)
    await user.save()
  }
  res.json({ success: true, message: 'If the email exists, a reset link has been sent' })
})

export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body
  if (!token || !password) {
    return res.status(400).json({ success: false, message: 'Token and password are required' })
  }
  const user: any = await User.findOne({ passwordResetToken: token, passwordResetExpires: { $gt: new Date() } })
  if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired token' })

  user.passwordHash = await argon2.hash(password)
  user.passwordResetToken = null
  user.passwordResetExpires = null
  user.tokenVersion = (user.tokenVersion || 0) + 1
  await user.save()
  res.json({ success: true, message: 'Password reset successfully' })
})

export const logout = asyncHandler(async (_req, res) => {
  res.json({ success: true, message: 'Logged out successfully' })
})
