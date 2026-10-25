import dotenv from 'dotenv'
dotenv.config()
import mongoose from 'mongoose'
import * as argon2 from 'argon2'
import {
  AcademicSession, AuditLog, Deadline, DefenseSchedule, Department, Evaluation,
  EvaluationRubric, Feedback, Milestone, Notification, Project, ProjectMember,
  Proposal, ProposalVersion, RubricCriterion, Setting, StudentProfile, Submission,
  SupervisorAssignment, SupervisorProfile, User,
} from './models'
import { calculateProjectHealth } from './services/health'

const now = new Date()
const day = 86400000
const days = (n: number) => new Date(now.getTime() + n * day)
const monthName = now.toLocaleString('en', { month: 'short' })
const year = now.getFullYear()
const sessionName = now.getMonth() >= 7 ? `Fall ${year}` : `Spring ${year}`

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI missing')
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 })
  console.log('Connected. Clearing existing data…')

  await Promise.all([
    User.deleteMany({}), Department.deleteMany({}), AcademicSession.deleteMany({}),
    StudentProfile.deleteMany({}), SupervisorProfile.deleteMany({}), Project.deleteMany({}),
    ProjectMember.deleteMany({}), Proposal.deleteMany({}), ProposalVersion.deleteMany({}),
    SupervisorAssignment.deleteMany({}), Milestone.deleteMany({}), Submission.deleteMany({}),
    Feedback.deleteMany({}), Notification.deleteMany({}), Evaluation.deleteMany({}),
    EvaluationRubric.deleteMany({}), RubricCriterion.deleteMany({}), DefenseSchedule.deleteMany({}),
    AuditLog.deleteMany({}), Deadline.deleteMany({}), Setting.deleteMany({}),
  ])

  const passwordHash = await argon2.hash('password123')

  const [cs, se, ds, cy] = await Department.create([
    { name: 'Computer Science', code: 'CS' },
    { name: 'Software Engineering', code: 'SE' },
    { name: 'Data Science', code: 'DS' },
    { name: 'Cybersecurity', code: 'CY' },
  ])

  const session = await AcademicSession.create({
    name: sessionName,
    startDate: days(-60),
    endDate: days(240),
    isActive: true,
  })

  const mkUser = async (firstName: string, lastName: string, email: string, role: string) =>
    User.create({ firstName, lastName, email, passwordHash, role, emailVerified: true, isActive: true })

  const admin = await mkUser('Sarah', 'Malik', 'admin@fypmanager.com', 'ADMIN')
  const john = await mkUser('John', 'Smith', 'supervisor@fypmanager.com', 'SUPERVISOR')
  const ayesha = await mkUser('Ayesha', 'Khan', 'ayesha.khan@uni.edu', 'SUPERVISOR')
  const fatima = await mkUser('Fatima', 'Noor', 'fatima.noor@uni.edu', 'SUPERVISOR')
  const ahmed = await mkUser('Ahmed', 'Raza', 'ahmed.raza@uni.edu', 'SUPERVISOR')
  const sana = await mkUser('Sana', 'Iqbal', 'sana.iqbal@uni.edu', 'SUPERVISOR')

  const mkSupervisor = (userId: any, employeeId: string, departmentId: any, interests: string, max = 5) =>
    SupervisorProfile.create({ userId, employeeId, departmentId, researchInterests: interests, maxSupervisees: max })

  const pJohn = await mkSupervisor(john._id, 'SUP-001', cs._id, 'Artificial intelligence, NLP, and human-centred web systems')
  const pAyesha = await mkSupervisor(ayesha._id, 'SUP-002', cs._id, 'Distributed systems, cloud computing, and real-time analytics')
  const pFatima = await mkSupervisor(fatima._id, 'SUP-003', se._id, 'Software architecture, accessibility, and engineering education')
  const pAhmed = await mkSupervisor(ahmed._id, 'SUP-004', ds._id, 'Computer vision, data science, and mobile computing')
  const pSana = await mkSupervisor(sana._id, 'SUP-005', cy._id, 'Applied cryptography, blockchain, and security engineering')

  const students = [
    ['Alice', 'Johnson', 'student@fypmanager.com', 'STU-2021-0142', cs, 'Final year Computer Science student interested in applied AI and web engineering.'],
    ['Daniel', 'Mensah', 'daniel.mensah@uni.edu', 'STU-2021-0188', cs, 'Backend engineering and API design.'],
    ['Sara', 'Iqbal', 'sara.iqbal@uni.edu', 'STU-2021-0203', cs, 'Frontend engineering and interaction design.'],
    ['Bilal', 'Ahmed', 'bilal.ahmed@uni.edu', 'STU-2021-0155', cs, 'IoT and sustainability systems.'],
    ['Hamza', 'Sheikh', 'hamza.sheikh@uni.edu', 'STU-2021-0162', cs, 'Embedded systems and data pipelines.'],
    ['Maria', 'Joseph', 'maria.joseph@uni.edu', 'STU-2021-0171', cs, 'Data visualisation and analytics.'],
    ['Hina', 'Raza', 'hina.raza@uni.edu', 'STU-2021-0210', cy, 'Blockchain and applied cryptography.'],
    ['Nida', 'Hasan', 'nida.hasan@uni.edu', 'STU-2021-0215', cy, 'Security operations and forensics.'],
    ['Fahad', 'Mirza', 'fahad.mirza@uni.edu', 'STU-2021-0221', cy, 'Smart contracts and distributed ledgers.'],
    ['Omar', 'Farooq', 'omar.farooq@uni.edu', 'STU-2021-0301', se, 'Accessible software and inclusive design.'],
    ['Zainab', 'Ali', 'zainab.ali@uni.edu', 'STU-2021-0310', se, 'UX research and frontend systems.'],
    ['Tariq', 'Mehmood', 'tariq.mehmood@uni.edu', 'STU-2021-0318', se, 'Quality assurance and test automation.'],
    ['Aisha', 'Noor', 'aisha.noor@uni.edu', 'STU-2021-0324', se, 'Mobile learning applications.'],
    ['Zara', 'Hussain', 'zara.hussain@uni.edu', 'STU-2021-0402', ds, 'Computer vision for accessibility.'],
    ['Imran', 'Qureshi', 'imran.qureshi@uni.edu', 'STU-2021-0411', ds, 'Geospatial data and mobile navigation.'],
    ['Usman', 'Tariq', 'usman.tariq@uni.edu', 'STU-2021-0120', cs, 'Real-time systems and computer vision.'],
    ['Saad', 'Rafiq', 'saad.rafiq@uni.edu', 'STU-2021-0127', cs, 'Streaming infrastructure and ML inference.'],
    ['Mahnoor', 'Aslam', 'mahnoor.aslam@uni.edu', 'STU-2021-0133', cs, 'Human-computer interaction and ethics.'],
  ] as const

  const studentProfiles: Record<string, any> = {}
  for (const [first, last, email, studentId, dept, bio] of students) {
    const u = await mkUser(first, last, email as string, 'STUDENT')
    const profile = await StudentProfile.create({ userId: u._id, studentId, departmentId: (dept as any)._id, bio })
    studentProfiles[email as string] = { user: u, profile }
  }

  const sp = (email: string) => studentProfiles[email].profile
  const su = (email: string) => studentProfiles[email].user

  interface SeedProject {
    title: string
    status: string
    dept: any
    stage: string
    abstract: string
    lead: string
    team: { email: string; role?: string }[]
    supervisor: any
    milestones: { title: string; status: string; progress: number; due: number; desc: string }[]
    proposal: { status: string; submitted: number; reviewed?: number; comments?: string }
  }

  const projectsSeed: SeedProject[] = [
    {
      title: 'AI-Powered Chatbot for University Help Desk',
      status: 'IN_PROGRESS',
      dept: cs,
      stage: 'Implementation',
      abstract:
        'An intelligent assistant that answers common student inquiries using retrieval-augmented NLP over the university knowledge base.',
      lead: 'student@fypmanager.com',
      team: [
        { email: 'student@fypmanager.com', role: 'LEAD' },
        { email: 'daniel.mensah@uni.edu' },
        { email: 'sara.iqbal@uni.edu' },
      ],
      supervisor: pJohn,
      milestones: [
        { title: 'Literature Review', status: 'COMPLETED', progress: 100, due: -120, desc: 'Survey retrieval-augmented generation and help-desk automation.' },
        { title: 'System Design', status: 'COMPLETED', progress: 100, due: -60, desc: 'Architecture, data model, and integration plan for the assistant.' },
        { title: 'Implementation', status: 'IN_PROGRESS', progress: 55, due: 18, desc: 'Build retrieval pipeline, chat UI, and admin console.' },
        { title: 'Testing', status: 'IN_PROGRESS', progress: 25, due: -3, desc: 'Evaluate answer quality and response latency with the help desk.' },
        { title: 'Final Report & Defense', status: 'NOT_STARTED', progress: 0, due: 10, desc: 'Final documentation, evaluation chapter, and defense preparation.' },
      ],
      proposal: { status: 'PROPOSAL_APPROVED', submitted: -150, reviewed: -120, comments: 'Clear scope and feasible plan. Proceed to implementation.' },
    },
    {
      title: 'Smart Campus Energy Monitoring Dashboard',
      status: 'IN_PROGRESS',
      dept: cs,
      stage: 'Implementation',
      abstract:
        'A campus-wide dashboard that streams energy readings from IoT meters and highlights anomalies to reduce consumption.',
      lead: 'bilal.ahmed@uni.edu',
      team: [
        { email: 'bilal.ahmed@uni.edu', role: 'LEAD' },
        { email: 'hamza.sheikh@uni.edu' },
        { email: 'maria.joseph@uni.edu' },
      ],
      supervisor: pJohn,
      milestones: [
        { title: 'Requirements', status: 'COMPLETED', progress: 100, due: -90, desc: 'Stakeholder interviews and metering requirements.' },
        { title: 'System Design', status: 'COMPLETED', progress: 100, due: -30, desc: 'Streaming architecture and dashboard wireframes.' },
        { title: 'Implementation', status: 'IN_PROGRESS', progress: 40, due: 35, desc: 'Ingest meter data and build live charts.' },
        { title: 'Testing', status: 'NOT_STARTED', progress: 0, due: 90, desc: 'Validate anomaly detection and load handling.' },
        { title: 'Final Report', status: 'NOT_STARTED', progress: 0, due: 150, desc: 'Document results and savings analysis.' },
      ],
      proposal: { status: 'PROPOSAL_APPROVED', submitted: -160, reviewed: -140, comments: 'Approved with a note to include privacy safeguards for occupancy data.' },
    },
    {
      title: 'Blockchain-Based Certificate Verification',
      status: 'PROPOSAL_UNDER_REVIEW',
      dept: cy,
      stage: 'Literature Review',
      abstract:
        'A tamper-evident certificate registry using smart contracts so employers can verify university credentials instantly.',
      lead: 'hina.raza@uni.edu',
      team: [
        { email: 'hina.raza@uni.edu', role: 'LEAD' },
        { email: 'nida.hasan@uni.edu' },
        { email: 'fahad.mirza@uni.edu' },
      ],
      supervisor: pJohn,
      milestones: [
        { title: 'Proposal revision', status: 'NEEDS_REVISION', progress: 18, due: -12, desc: 'Clarify revocation model and gas-cost analysis.' },
        { title: 'Literature Review', status: 'IN_PROGRESS', progress: 30, due: -5, desc: 'Review credential standards and on-chain privacy.' },
        { title: 'Prototype', status: 'NOT_STARTED', progress: 0, due: 45, desc: 'Deploy registry contracts on a public test network.' },
        { title: 'Final Report', status: 'NOT_STARTED', progress: 0, due: 120, desc: 'Document threat model and evaluation.' },
      ],
      proposal: { status: 'PROPOSAL_UNDER_REVIEW', submitted: -8, comments: 'Revise scope and include a cost/benefit comparison.' },
    },
    {
      title: 'Accessible Learning Management System',
      status: 'IN_PROGRESS',
      dept: se,
      stage: 'Implementation',
      abstract:
        'An LMS rebuilt around WCAG 2.2, screen-reader navigation, and adjustable reading modes for neurodiverse learners.',
      lead: 'omar.farooq@uni.edu',
      team: [
        { email: 'omar.farooq@uni.edu', role: 'LEAD' },
        { email: 'zainab.ali@uni.edu' },
        { email: 'tariq.mehmood@uni.edu' },
        { email: 'aisha.noor@uni.edu' },
      ],
      supervisor: pFatima,
      milestones: [
        { title: 'Requirements', status: 'COMPLETED', progress: 100, due: -100, desc: 'Accessibility audits and learner interviews.' },
        { title: 'Design', status: 'COMPLETED', progress: 100, due: -70, desc: 'Inclusive design system and prototypes.' },
        { title: 'Implementation', status: 'IN_PROGRESS', progress: 74, due: 21, desc: 'Build course player, quizzes, and reading modes.' },
        { title: 'Testing', status: 'IN_PROGRESS', progress: 50, due: 45, desc: 'Assistive-technology testing and WCAG validation.' },
        { title: 'Final Report', status: 'NOT_STARTED', progress: 0, due: 120, desc: 'Report accessibility outcomes.' },
      ],
      proposal: { status: 'PROPOSAL_APPROVED', submitted: -170, reviewed: -150, comments: 'Approved. Include participants with lived experience in testing.' },
    },
    {
      title: 'Campus Navigation for Visually Impaired',
      status: 'PROPOSAL_SUBMITTED',
      dept: ds,
      stage: 'Proposal',
      abstract:
        'A mobile navigation assistant using on-device vision and haptic cues to guide students through campus safely.',
      lead: 'zara.hussain@uni.edu',
      team: [
        { email: 'zara.hussain@uni.edu', role: 'LEAD' },
        { email: 'imran.qureshi@uni.edu' },
      ],
      supervisor: pJohn,
      milestones: [
        { title: 'Proposal', status: 'IN_PROGRESS', progress: 25, due: 15, desc: 'Define scope and evaluation plan.' },
        { title: 'Literature Review', status: 'NOT_STARTED', progress: 0, due: 40, desc: 'Review assistive navigation research.' },
        { title: 'Prototype', status: 'NOT_STARTED', progress: 0, due: 85, desc: 'Build on-device obstacle detection demo.' },
      ],
      proposal: { status: 'PROPOSAL_SUBMITTED', submitted: -2 },
    },
    {
      title: 'Real-time Exam Proctoring System',
      status: 'COMPLETED',
      dept: cs,
      stage: 'Completed',
      abstract:
        'A privacy-aware proctoring system using on-device gaze and head-pose signals with human-in-the-loop review.',
      lead: 'usman.tariq@uni.edu',
      team: [
        { email: 'usman.tariq@uni.edu', role: 'LEAD' },
        { email: 'saad.rafiq@uni.edu' },
        { email: 'mahnoor.aslam@uni.edu' },
      ],
      supervisor: pAyesha,
      milestones: [
        { title: 'Requirements', status: 'COMPLETED', progress: 100, due: -260, desc: 'Define signals and privacy constraints.' },
        { title: 'Implementation', status: 'COMPLETED', progress: 100, due: -200, desc: 'Build detection pipeline and reviewer console.' },
        { title: 'Evaluation', status: 'COMPLETED', progress: 100, due: -150, desc: 'Measure accuracy and false-positive rate.' },
        { title: 'Final Report', status: 'COMPLETED', progress: 100, due: -120, desc: 'Final thesis and defense.' },
      ],
      proposal: { status: 'PROPOSAL_APPROVED', submitted: -300, reviewed: -280, comments: 'Approved. Strong privacy-first framing.' },
    },
  ]

  const rubric = await EvaluationRubric.create({ name: 'Standard FYP Evaluation Rubric', description: 'Weighted criteria used for final FYP assessment.', isActive: true, totalWeight: 100 })
  const criteriaSeed = [
    { name: 'Problem Definition', maxScore: 10, weight: 10 },
    { name: 'Technical Implementation', maxScore: 30, weight: 30 },
    { name: 'Innovation', maxScore: 20, weight: 20 },
    { name: 'Documentation', maxScore: 20, weight: 20 },
    { name: 'Presentation & Defense', maxScore: 20, weight: 20 },
  ]
  const criteria: any[] = []
  for (let i = 0; i < criteriaSeed.length; i++) {
    criteria.push(await RubricCriterion.create({ rubricId: rubric._id, ...criteriaSeed[i], order: i }))
  }

  const projectIds: string[] = []
  const leadName: Record<string, string> = {}

  for (let idx = 0; idx < projectsSeed.length; idx++) {
    const s = projectsSeed[idx]
    const leadUser = su(s.lead)
    leadName[String(idx)] = `${leadUser.firstName} ${leadUser.lastName}`
    const project = await Project.create({
      title: s.title,
      status: s.status,
      departmentId: s.dept._id,
      academicSessionId: session._id,
      abstract: s.abstract,
      currentStage: s.stage,
      startedAt: days(-180),
    })
    projectIds.push(String(project._id))

    for (const member of s.team) {
      await ProjectMember.create({ projectId: project._id, studentId: sp(member.email)._id, role: member.role || 'MEMBER' })
    }

    await SupervisorAssignment.create({ projectId: project._id, supervisorId: s.supervisor._id, assignedAt: days(-170), assignedBy: admin._id })

    const proposal = await Proposal.create({
      projectId: project._id,
      title: s.title,
      abstract: s.abstract,
      problemStatement: 'The current process is slow, fragmented, and difficult to audit, creating avoidable delays for students and staff.',
      objectives: '1. Design a reliable solution.\n2. Validate it with real users.\n3. Evaluate impact against clear metrics.',
      methodology: 'Agile delivery across four milestones, combining applied research with iterative prototyping and user testing.',
      technologyStack: 'React, TypeScript, Node.js, MongoDB, and Python where required.',
      expectedOutcomes: 'A working, evaluated system that demonstrably improves the target workflow.',
      status: s.proposal.status,
      version: 2,
      submittedAt: days(s.proposal.submitted),
      reviewedAt: s.proposal.reviewed ? days(s.proposal.reviewed) : undefined,
      reviewComments: s.proposal.comments,
      reviewedBy: s.proposal.reviewed ? s.supervisor.userId : undefined,
    })

    await ProposalVersion.create({
      proposalId: proposal._id,
      versionNumber: 1,
      title: s.title,
      abstract: s.abstract,
      problemStatement: proposal.problemStatement,
      objectives: proposal.objectives,
      methodology: proposal.methodology,
      technologyStack: proposal.technologyStack,
      expectedOutcomes: proposal.expectedOutcomes,
      submittedAt: days(s.proposal.submitted - 20),
    })
    if (s.proposal.reviewed) {
      await ProposalVersion.create({
        proposalId: proposal._id,
        versionNumber: 2,
        title: s.title,
        abstract: s.abstract,
        problemStatement: proposal.problemStatement,
        objectives: proposal.objectives,
        methodology: proposal.methodology,
        technologyStack: proposal.technologyStack,
        expectedOutcomes: proposal.expectedOutcomes,
        submittedAt: days(s.proposal.submitted),
      })
    }

    for (let m = 0; m < s.milestones.length; m++) {
      const ms = s.milestones[m]
      await Milestone.create({
        projectId: project._id,
        title: ms.title,
        description: ms.desc,
        startDate: days(ms.due - 40),
        dueDate: days(ms.due),
        status: ms.status,
        completionPercentage: ms.progress,
        deliverableRequirements: 'Submit a PDF report and supporting files.',
        order: m,
      })
    }
  }

  const P = (i: number) => projectIds[i]

  const submissionsSeed = [
    { project: 0, title: 'Interim Report v2', type: 'Report', status: 'APPROVED', submitted: -40, version: 2, student: 'student@fypmanager.com' },
    { project: 0, title: 'System Architecture Document', type: 'Document', status: 'UNDER_REVIEW', submitted: -10, version: 1, student: 'student@fypmanager.com' },
    { project: 0, title: 'Progress Presentation', type: 'Presentation', status: 'NEEDS_REVISION', submitted: -30, version: 1, student: 'student@fypmanager.com' },
    { project: 1, title: 'Design Document', type: 'Document', status: 'UNDER_REVIEW', submitted: -5, version: 1, student: 'bilal.ahmed@uni.edu' },
    { project: 2, title: 'Revised Project Proposal', type: 'Proposal', status: 'UNDER_REVIEW', submitted: -8, version: 2, student: 'hina.raza@uni.edu' },
    { project: 3, title: 'Implementation Progress', type: 'Report', status: 'APPROVED', submitted: -15, version: 1, student: 'omar.farooq@uni.edu' },
    { project: 4, title: 'Proposal Document', type: 'Proposal', status: 'UNDER_REVIEW', submitted: -2, version: 1, student: 'zara.hussain@uni.edu' },
    { project: 5, title: 'Final Report', type: 'Report', status: 'APPROVED', submitted: -200, version: 3, student: 'usman.tariq@uni.edu' },
    { project: 5, title: 'Final Presentation', type: 'Presentation', status: 'APPROVED', submitted: -190, version: 2, student: 'usman.tariq@uni.edu' },
  ]

  const submissionIds: any[] = []
  for (const s of submissionsSeed) {
    const doc = await Submission.create({
      projectId: P(s.project),
      studentId: sp(s.student)._id,
      title: s.title,
      type: s.type,
      description: '',
      status: s.status,
      submittedAt: days(s.submitted),
      reviewedAt: s.status === 'UNDER_REVIEW' ? undefined : days(s.submitted + 5),
      reviewerId: s.status === 'UNDER_REVIEW' ? undefined : projectsSeed[s.project].supervisor.userId,
      version: s.version,
    })
    submissionIds.push(doc)
  }

  const feedbackSeed = [
    { project: 0, by: john, content: 'Strong progress on the interim report. Please expand the evaluation section and add comparative analysis before the final submission.', revision: false, daysAgo: -38, submission: 0, title: 'Interim Report v2' },
    { project: 0, by: john, content: 'The presentation needs clearer problem framing. Rework the first three slides and rehearse the demo flow.', revision: true, daysAgo: -28, submission: 2, title: 'Progress Presentation' },
    { project: 2, by: john, content: 'The revocation model is underspecified. Revise the proposal and include a gas-cost comparison before resubmission.', revision: true, daysAgo: -9, submission: 4, title: 'Revised Project Proposal' },
    { project: 2, by: john, content: 'Scope is still too broad for the timeline. Narrow to one credential type and justify the choice.', revision: true, daysAgo: -6, submission: 4, title: 'Revised Project Proposal' },
    { project: 1, by: john, content: 'Good dashboard direction. Add a privacy note about occupancy-derived data in the design document.', revision: false, daysAgo: -4, submission: 3, title: 'Design Document' },
    { project: 3, by: fatima, content: 'Accessibility testing plan looks solid. Involve at least two participants with lived experience.', revision: false, daysAgo: -12, submission: 5, title: 'Implementation Progress' },
  ]

  for (const f of feedbackSeed) {
    await Feedback.create({
      projectId: P(f.project),
      submissionId: submissionIds[f.submission]?._id,
      authorId: f.by._id,
      content: f.content,
      isRevisionRequest: f.revision,
    })
  }

  const mkEvaluation = async (projectIdx: number, scores: number[], released: boolean, evaluatorId: any, comments: string, evaluatedDays: number) => {
    const total = scores.reduce((a, b) => a + b, 0)
    return Evaluation.create({
      projectId: P(projectIdx),
      evaluatorId,
      rubricId: rubric._id,
      scores: criteria.map((c: any, i: number) => ({ criterionId: c._id, name: c.name, max: c.maxScore, weight: c.weight, score: scores[i] })),
      totalScore: total,
      comments,
      isReleased: released,
      evaluatedAt: days(evaluatedDays),
    })
  }

  await mkEvaluation(0, [8, 24, 15, 16, 17], true, john._id, 'Solid implementation and clear documentation. Expand the evaluation chapter.', -5)
  await mkEvaluation(5, [9, 27, 18, 18, 18], true, ayesha._id, 'Excellent privacy-first design and rigorous evaluation.', -110)
  await mkEvaluation(3, [8, 22, 16, 15, 16], false, fatima._id, 'Strong accessibility work; final release pending moderation.', -3)

  const defenseSeed = [
    { project: 0, date: 120, venue: 'Block B — Seminar Hall 2', panel: ['Dr. Ayesha Khan', 'Dr. Fatima Noor', 'Dr. Ahmed Raza'] },
    { project: 1, date: 90, venue: 'Block B — Seminar Hall 1', panel: ['Dr. John Smith', 'Dr. Sana Iqbal', 'Dr. Ahmed Raza'] },
    { project: 2, date: 60, venue: 'Block C — Seminar Hall 1', panel: ['Dr. John Smith', 'Dr. Sana Iqbal', 'Dr. Fatima Noor'] },
    { project: 3, date: 100, venue: 'Block A — Auditorium', panel: ['Dr. Fatima Noor', 'Dr. Ayesha Khan', 'Dr. John Smith'] },
    { project: 5, date: -110, venue: 'Block B — Seminar Hall 2', panel: ['Dr. Ayesha Khan', 'Dr. John Smith', 'Dr. Ahmed Raza'] },
  ]
  for (const d of defenseSeed) {
    const at = new Date(days(d.date))
    at.setHours(10, 30, 0, 0)
    await DefenseSchedule.create({ projectId: P(d.project), scheduledDate: at, venue: d.venue, duration: 30, evaluators: d.panel, status: d.date < 0 ? 'COMPLETED' : 'SCHEDULED' })
  }

  await Deadline.create([
    { title: 'Proposal submission', date: days(-30), scope: 'All departments', status: 'COMPLETED' },
    { title: 'Interim report', date: days(5), scope: 'Computer Science', status: 'UNDER_REVIEW' },
    { title: 'Final report', date: days(150), scope: 'All departments', status: 'NOT_STARTED' },
    { title: 'Final defense week', date: days(170), scope: 'All departments', status: 'NOT_STARTED' },
  ])

  const aliceUser = su('student@fypmanager.com')
  const notificationsSeed = [
    { userId: aliceUser._id, title: 'Feedback received', message: 'Dr. John Smith reviewed your Interim Report v2.', type: 'feedback', unread: true, link: '/student/feedback', ago: -2 },
    { userId: aliceUser._id, title: 'Deadline approaching', message: 'Final Report & Defense is due within 10 days.', type: 'deadline', unread: true, link: '/student/milestones', ago: -6 },
    { userId: aliceUser._id, title: 'Submission approved', message: 'Your Interim Report v2 was approved.', type: 'approved', unread: false, link: '/student/submissions', ago: -40 },
    { userId: aliceUser._id, title: 'New comment', message: 'Your supervisor added a comment on your project workspace.', type: 'comment', unread: false, link: '/student/project', ago: -72 },
    { userId: john._id, title: 'Submission awaiting review', message: 'Alice Johnson submitted System Architecture Document.', type: 'submission', unread: true, link: '/supervisor/submission-reviews', ago: -10 },
    { userId: john._id, title: 'Proposal awaiting review', message: 'Hina Raza submitted a revised proposal.', type: 'proposal', unread: true, link: '/supervisor/proposal-reviews', ago: -8 },
    { userId: admin._id, title: 'Proposal submitted', message: 'A new proposal is ready for a coordinator decision.', type: 'proposal', unread: true, link: '/admin/proposals', ago: -2 },
    { userId: admin._id, title: 'Project flagged high risk', message: 'Blockchain-Based Certificate Verification needs attention.', type: 'health', unread: false, link: '/admin/projects', ago: -5 },
  ]
  for (const n of notificationsSeed) {
    await Notification.create({ userId: n.userId, title: n.title, message: n.message, type: n.type, isRead: !n.unread, link: n.link, createdAt: days(n.ago) })
  }

  const auditSeed = [
    { by: admin, project: 2, action: 'Assigned supervisor', entity: 'SupervisorAssignment', title: projectsSeed[2].title, ago: -1 },
    { by: john, project: 0, action: 'Requested revision', entity: 'Submission', title: 'Progress Presentation — Alice Johnson', ago: -2 },
    { by: admin, project: 1, action: 'Approved proposal', entity: 'Proposal', title: projectsSeed[1].title, ago: -3 },
    { by: admin, project: null, action: 'Recalculated project health', entity: 'Project', title: 'All active projects', ago: -4 },
    { by: ayesha, project: 5, action: 'Released evaluation', entity: 'Evaluation', title: projectsSeed[5].title, ago: -5 },
    { by: fatima, project: 3, action: 'Reviewed submission', entity: 'Submission', title: 'Implementation Progress — Omar Farooq', ago: -6 },
  ]
  for (const a of auditSeed) {
    await AuditLog.create({ userId: a.by._id, projectId: a.project !== null ? P(a.project) : null, action: a.action, entityType: a.entity, entityId: null, details: { title: a.title }, createdAt: days(a.ago) })
  }

  await Setting.create({ key: 'platform', value: {} })

  console.log('Calculating project health…')
  for (const id of projectIds) await calculateProjectHealth(id)

  const counts = {
    users: await User.countDocuments(),
    students: await StudentProfile.countDocuments(),
    supervisors: await SupervisorProfile.countDocuments(),
    projects: await Project.countDocuments(),
    milestones: await Milestone.countDocuments(),
    submissions: await Submission.countDocuments(),
    feedback: await Feedback.countDocuments(),
    notifications: await Notification.countDocuments(),
    auditLogs: await AuditLog.countDocuments(),
  }
  console.log('Seed complete:', counts)
  console.log(`Session: ${sessionName}`)
  console.log('Logins (password: password123): student@fypmanager.com | supervisor@fypmanager.com | admin@fypmanager.com')

  await mongoose.disconnect()
  process.exit(0)
}

main().catch(async (err) => {
  console.error('Seed failed:', err)
  await mongoose.disconnect().catch(() => undefined)
  process.exit(1)
})
