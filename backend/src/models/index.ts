import mongoose, { Schema } from 'mongoose'

const opts = { timestamps: true }
const { ObjectId } = Schema.Types

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['STUDENT', 'SUPERVISOR', 'ADMIN'], required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    emailVerified: { type: Boolean, default: true },
    emailVerifyToken: { type: String, default: null },
    passwordResetToken: { type: String, default: null },
    passwordResetExpires: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    tokenVersion: { type: Number, default: 0 },
  },
  opts
)

const DepartmentSchema = new Schema(
  { name: { type: String, required: true, unique: true }, code: { type: String, required: true, unique: true } },
  opts
)

const AcademicSessionSchema = new Schema(
  { name: { type: String, required: true, unique: true }, startDate: Date, endDate: Date, isActive: { type: Boolean, default: false } },
  opts
)

const StudentProfileSchema = new Schema(
  { userId: { type: ObjectId, ref: 'User', required: true, unique: true }, studentId: { type: String, required: true, unique: true }, departmentId: { type: ObjectId, ref: 'Department' }, phone: String, bio: String },
  opts
)

const SupervisorProfileSchema = new Schema(
  { userId: { type: ObjectId, ref: 'User', required: true, unique: true }, employeeId: { type: String, required: true, unique: true }, departmentId: { type: ObjectId, ref: 'Department' }, researchInterests: String, availability: { type: Boolean, default: true }, maxSupervisees: { type: Number, default: 5 } },
  opts
)

const ProjectSchema = new Schema(
  {
    title: { type: String, required: true },
    status: {
      type: String,
      enum: ['PROPOSAL_DRAFT', 'PROPOSAL_SUBMITTED', 'PROPOSAL_UNDER_REVIEW', 'PROPOSAL_REVISION_REQUIRED', 'PROPOSAL_APPROVED', 'PROPOSAL_REJECTED', 'IN_PROGRESS', 'COMPLETED', 'SUSPENDED'],
      default: 'PROPOSAL_DRAFT',
    },
    departmentId: { type: ObjectId, ref: 'Department' },
    academicSessionId: { type: ObjectId, ref: 'AcademicSession' },
    riskScore: { type: Number, default: 0 },
    riskLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'LOW' },
    lastHealthCheck: { type: Date, default: Date.now },
    abstract: String,
    currentStage: { type: String, default: 'Proposal' },
    startedAt: Date,
  },
  opts
)

const ProjectMemberSchema = new Schema(
  { projectId: { type: ObjectId, ref: 'Project', required: true }, studentId: { type: ObjectId, ref: 'StudentProfile', required: true }, role: { type: String, default: 'MEMBER' }, joinedAt: { type: Date, default: Date.now } },
  opts
)
ProjectMemberSchema.index({ projectId: 1, studentId: 1 }, { unique: true })

const ProposalSchema = new Schema(
  {
    projectId: { type: ObjectId, ref: 'Project', required: true, unique: true },
    title: String,
    abstract: String,
    problemStatement: String,
    objectives: String,
    methodology: String,
    technologyStack: String,
    expectedOutcomes: String,
    status: { type: String, default: 'PROPOSAL_DRAFT' },
    version: { type: Number, default: 1 },
    submittedAt: Date,
    reviewedAt: Date,
    reviewComments: String,
    reviewedBy: { type: ObjectId, ref: 'User' },
  },
  opts
)

const ProposalVersionSchema = new Schema(
  { proposalId: { type: ObjectId, ref: 'Proposal', required: true }, versionNumber: Number, title: String, abstract: String, problemStatement: String, objectives: String, methodology: String, technologyStack: String, expectedOutcomes: String, submittedAt: { type: Date, default: Date.now } },
  opts
)

const SupervisorAssignmentSchema = new Schema(
  { projectId: { type: ObjectId, ref: 'Project', required: true, unique: true }, supervisorId: { type: ObjectId, ref: 'SupervisorProfile', required: true }, assignedAt: { type: Date, default: Date.now }, assignedBy: { type: ObjectId, ref: 'User' }, notes: String },
  opts
)
SupervisorAssignmentSchema.index({ projectId: 1, supervisorId: 1 }, { unique: true })

const MilestoneSchema = new Schema(
  {
    projectId: { type: ObjectId, ref: 'Project', required: true },
    title: { type: String, required: true },
    description: String,
    startDate: Date,
    dueDate: Date,
    status: { type: String, enum: ['NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'NEEDS_REVISION', 'COMPLETED'], default: 'NOT_STARTED' },
    completionPercentage: { type: Number, default: 0 },
    deliverableRequirements: String,
    order: { type: Number, default: 0 },
  },
  opts
)

const TaskSchema = new Schema(
  { milestoneId: { type: ObjectId, ref: 'Milestone', required: true }, title: String, description: String, status: { type: String, default: 'NOT_STARTED' }, dueDate: Date },
  opts
)

const SubmissionSchema = new Schema(
  {
    projectId: { type: ObjectId, ref: 'Project', required: true },
    milestoneId: { type: ObjectId, ref: 'Milestone', default: null },
    studentId: { type: ObjectId, ref: 'StudentProfile' },
    title: { type: String, required: true },
    type: { type: String, default: 'Report' },
    description: String,
    status: { type: String, enum: ['PENDING', 'UNDER_REVIEW', 'NEEDS_REVISION', 'APPROVED', 'REJECTED'], default: 'PENDING' },
    submittedAt: { type: Date, default: Date.now },
    reviewedAt: Date,
    reviewerId: { type: ObjectId, ref: 'User' },
    version: { type: Number, default: 1 },
  },
  opts
)

const SubmissionFileSchema = new Schema(
  { submissionId: { type: ObjectId, ref: 'Submission', required: true }, fileName: String, filePath: String, fileSize: Number, mimeType: String, uploadedAt: { type: Date, default: Date.now } },
  opts
)

const FeedbackSchema = new Schema(
  { projectId: { type: ObjectId, ref: 'Project', required: true }, submissionId: { type: ObjectId, ref: 'Submission', default: null }, authorId: { type: ObjectId, ref: 'User', required: true }, content: { type: String, required: true }, isRevisionRequest: { type: Boolean, default: false } },
  opts
)

const CommentSchema = new Schema(
  { projectId: { type: ObjectId, ref: 'Project', required: true }, authorId: { type: ObjectId, ref: 'User', required: true }, content: { type: String, required: true } },
  opts
)

const NotificationSchema = new Schema(
  { userId: { type: ObjectId, ref: 'User', required: true }, title: String, message: String, type: { type: String, default: 'info' }, isRead: { type: Boolean, default: false }, link: String, createdAt: { type: Date, default: Date.now } },
  opts
)

const EvaluationRubricSchema = new Schema(
  { name: { type: String, required: true }, description: String, isActive: { type: Boolean, default: true }, totalWeight: { type: Number, default: 100 } },
  opts
)

const RubricCriterionSchema = new Schema(
  { rubricId: { type: ObjectId, ref: 'EvaluationRubric', required: true }, name: String, description: String, maxScore: Number, weight: Number, order: { type: Number, default: 0 } },
  opts
)

const EvaluationSchema = new Schema(
  {
    projectId: { type: ObjectId, ref: 'Project', required: true },
    evaluatorId: { type: ObjectId, ref: 'User' },
    rubricId: { type: ObjectId, ref: 'EvaluationRubric' },
    scores: [{ criterionId: ObjectId, name: String, max: Number, weight: Number, score: Number }],
    totalScore: { type: Number, default: 0 },
    comments: String,
    isReleased: { type: Boolean, default: false },
    evaluatedAt: { type: Date, default: Date.now },
  },
  opts
)

const DefenseScheduleSchema = new Schema(
  { projectId: { type: ObjectId, ref: 'Project', required: true, unique: true }, scheduledDate: Date, venue: String, duration: { type: Number, default: 30 }, evaluators: [String], status: { type: String, default: 'SCHEDULED' }, notes: String },
  opts
)

const AuditLogSchema = new Schema(
  { userId: { type: ObjectId, ref: 'User', default: null }, projectId: { type: ObjectId, ref: 'Project', default: null }, action: String, entityType: String, entityId: String, details: Object, ipAddress: String, createdAt: { type: Date, default: Date.now } },
  opts
)

const DeadlineSchema = new Schema(
  { title: { type: String, required: true }, date: { type: Date, required: true }, scope: { type: String, default: 'All departments' }, status: { type: String, default: 'NOT_STARTED' } },
  opts
)

const SettingSchema = new Schema(
  { key: { type: String, required: true, unique: true }, value: Object },
  opts
)

export const User = mongoose.model('User', UserSchema)
export const Department = mongoose.model('Department', DepartmentSchema)
export const AcademicSession = mongoose.model('AcademicSession', AcademicSessionSchema)
export const StudentProfile = mongoose.model('StudentProfile', StudentProfileSchema)
export const SupervisorProfile = mongoose.model('SupervisorProfile', SupervisorProfileSchema)
export const Project = mongoose.model('Project', ProjectSchema)
export const ProjectMember = mongoose.model('ProjectMember', ProjectMemberSchema)
export const Proposal = mongoose.model('Proposal', ProposalSchema)
export const ProposalVersion = mongoose.model('ProposalVersion', ProposalVersionSchema)
export const SupervisorAssignment = mongoose.model('SupervisorAssignment', SupervisorAssignmentSchema)
export const Milestone = mongoose.model('Milestone', MilestoneSchema)
export const Task = mongoose.model('Task', TaskSchema)
export const Submission = mongoose.model('Submission', SubmissionSchema)
export const SubmissionFile = mongoose.model('SubmissionFile', SubmissionFileSchema)
export const Feedback = mongoose.model('Feedback', FeedbackSchema)
export const Comment = mongoose.model('Comment', CommentSchema)
export const Notification = mongoose.model('Notification', NotificationSchema)
export const EvaluationRubric = mongoose.model('EvaluationRubric', EvaluationRubricSchema)
export const RubricCriterion = mongoose.model('RubricCriterion', RubricCriterionSchema)
export const Evaluation = mongoose.model('Evaluation', EvaluationSchema)
export const DefenseSchedule = mongoose.model('DefenseSchedule', DefenseScheduleSchema)
export const AuditLog = mongoose.model('AuditLog', AuditLogSchema)
export const Deadline = mongoose.model('Deadline', DeadlineSchema)
export const Setting = mongoose.model('Setting', SettingSchema)
