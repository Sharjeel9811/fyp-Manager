import { Response } from 'express'
import * as argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { Department, StudentProfile, SupervisorProfile, User } from '../models'
import { AppUser, AuthRequest } from '../middleware/auth'
import { asyncHandler, displayName } from '../utils/helpers'

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
  const user: any = await User.create({
    email: String(email).toLowerCase(),
    passwordHash,
    firstName,
    lastName,
    role,
    emailVerified: true,
    emailVerifyToken: uuidv4(),
  })

  if (role === 'STUDENT') {
    await StudentProfile.create({
      userId: user._id,
      studentId: studentId || `STU-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      departmentId: deptId,
    })
  } else {
    await SupervisorProfile.create({
      userId: user._id,
      employeeId: employeeId || `SUP-${Math.floor(1000 + Math.random() * 9000)}`,
      departmentId: deptId,
    })
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
