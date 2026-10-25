require('dotenv').config()
const mongoose = require('mongoose')
const { User, StudentProfile, Project, ProjectMember, SupervisorProfile, SupervisorAssignment } = require('./dist/models')

;(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })

  const students = await User.find({ role: 'STUDENT' }).select('email firstName lastName').lean()
  console.log('STUDENTS:', students.length)
  for (const s of students) {
    const profile = await StudentProfile.findOne({ userId: s._id }).select('_id studentId').lean()
    const memberships = profile
      ? await ProjectMember.find({ studentId: profile._id }).select('projectId role').lean()
      : []
    const projects = []
    for (const m of memberships) {
      const p = await Project.findById(m.projectId).select('title status').lean()
      projects.push({ id: String(m.projectId), title: p && p.title, role: m.role })
    }
    console.log(`- ${s.email} (${String(s._id)}) memberOf=${JSON.stringify(projects)}`)
  }

  const sups = await User.find({ role: 'SUPERVISOR' }).select('email').lean()
  console.log('SUPERVISORS:', sups.length)

  const assignments = await SupervisorAssignment.find().lean()
  for (const a of assignments) {
    const p = await Project.findById(a.projectId).select('title').lean()
    const sp = await SupervisorProfile.findById(a.supervisorId).select('userId').lean()
    const u = sp ? await User.findById(sp.userId).select('email').lean() : null
    console.log('ASSIGN:', p && p.title, '<-', u && u.email, 'projectId=' + String(a.projectId))
  }

  await mongoose.disconnect()
})().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
