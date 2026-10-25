# FYP Manager - Smart Final Year Project Management System

A comprehensive, real-time enabled Final Year Project Management System designed for universities to streamline the entire FYP lifecycle - from proposal submission to defense evaluation. Built with modern technologies and intelligent features to make project management more efficient and unique.

## Table of Contents
- [Overview](#overview)
- [Key Features](#key-features)
- [Real-Time Features](#real-time-features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Authentication & Security](#authentication--security)
- [Database Models](#database-models)
- [API Endpoints](#api-endpoints)
- [Frontend Structure](#frontend-structure)
- [Setup Instructions](#setup-instructions)
- [Default Credentials](#default-credentials)
- [Project Health Monitor Logic](#project-health-monitor-logic)
- [Smart Features Logic](#smart-features-logic)
- [Contributing](#contributing)
- [License](#license)

## Overview

FYP Manager is a full-stack web application that digitizes and automates the Final Year Project management process. It provides role-based dashboards for Students, Supervisors, and Administrators with intelligent features like smart supervisor matching, defense readiness scoring, real-time collaboration, and live activity tracking.

## Key Features

### For Students
- **Dashboard Overview** - Real-time project status, milestones, feedback, and defense readiness score
- **Project Proposal Management** - Draft, edit, and submit proposals with version control
- **Team Formation** - Create teams and invite members (max 4 members)
- **Milestone Tracking** - View assigned milestones with progress tracking
- **Document Submission** - Upload deliverables with submission history
- **Feedback & Comments** - Receive and respond to supervisor feedback
- **Defense & Evaluation** - View defense schedule and released evaluations
- **Defense Readiness Score** - AI-like scoring system with actionable recommendations
- **Profile Management** - Update profile and change password with real-time token rotation

### For Supervisors
- **Supervision Dashboard** - Overview of all assigned projects with health metrics
- **Proposal Reviews** - Review and approve/reject/revise student proposals
- **Submission Reviews** - Evaluate deliverables with structured feedback
- **Milestone Management** - Track milestone progress across projects
- **Project Health Monitor** - Rule-based risk assessment with explanations
- **Evaluation Schedule** - View upcoming defense schedules
- **Supervision Reports** - Analytics and CSV exports
- **Real-time Notifications** - Instant alerts for new submissions

### For Administrators
- **Admin Dashboard** - System-wide analytics and statistics
- **User Management** - Create, view, and manage all users
- **Project Management** - Oversee all projects across departments
- **Smart Supervisor Matching** - AI-powered recommendations based on research overlap, workload, and availability
- **Supervisor Assignments** - Assign supervisors with intelligent suggestions
- **Proposal Approvals** - Final approval/rejection of proposals
- **Departments & Sessions** - Manage academic structure
- **Deadlines Management** - Set and track FYP deadlines
- **Rubrics & Evaluations** - Configure evaluation criteria
- **Defense Scheduling** - Schedule and manage defense panels
- **Audit Logs** - Complete activity trail
- **System Settings** - Configure system-wide parameters

### UI/UX Enhancements
- **Framer Motion Animations** - Smooth page transitions, card animations, modal effects
- **Command Palette (Ctrl+K/Cmd+K)** - Quick navigation across the platform
- **Dark/Light Theme Ready** - Modern, clean interface
- **Responsive Design** - Works seamlessly on desktop and tablet
- **Skeleton Loading States** - Better perceived performance
- **Toast Notifications** - User feedback for all actions

## Real-Time Features

### WebSocket Infrastructure (Socket.IO)
The platform uses Socket.IO for bidirectional, real-time communication with JWT-based authentication.

#### 1. Live Presence System
- **Online Status Tracking** - Real-time tracking of active users
- **Presence Updates** - Broadcasts when users connect/disconnect
- **Online User Count** - Displayed across dashboards
- **Per-User Presence** - Check if specific users are online
- **Socket Rooms** - Room-based communication for project-specific features

**Logic:**
```javascript
// Server maintains in-memory Map<userId, Set<socketId>>
// On connection: Add socket to user's set, broadcast presence:update
// On disconnect: Remove socket, if set empty delete user and broadcast offline
```

#### 2. Real-Time Activity Feed
- **Live Event Broadcasting** - All major actions broadcast instantly
- **Activity Types**: proposal, review, assignment, info
- **Auto-Expiring Feed** - Shows last 50 activities
- **Visual Indicators** - Pulse animation on new activities
- **Timestamps** - Relative time display

**Triggered Events:**
- Proposal saved/submitted by students
- Proposal/submission reviewed by supervisors
- Supervisor assigned by admin
- Comments and replies

#### 3. Project-Specific Live Chat
- **Room-Based Messaging** - Each project has its own chat room
- **Real-Time Delivery** - Instant message broadcasting
- **Message History** - Last 200 messages cached in memory
- **Typing Indicators** - Shows who is typing with auto-timeout
- **Message Persistence** - Chat history retrievable on join
- **User Identification** - Messages show sender info

**Logic:**
```javascript
// Join room: socket.join(roomId)
// Send message: Validate, store in chatRooms Map, broadcast to room
// Typing: Track in typingUsers Map per room with 1.2s timeout
```

#### 4. Real-Time Notifications
- **Instant Delivery** - Notifications pushed via WebSocket
- **Event-Driven** - Triggered on assignments, reviews, comments
- **Fallback to Polling** - Works even if WebSocket disconnects

#### 5. Live Status Monitoring
- **Connection Status** - Visual indicator (WiFi/WiFiOff)
- **Heartbeat/Ping-Pong** - `activity:ping`/`activity:pong` for connection health
- **Auto-Reconnection** - Socket.IO handles reconnection automatically

### Integration Points
- **Auth Context Integration** - WebSocket connects only when user authenticated
- **Token-Based Auth** - Socket authenticates using JWT from localStorage
- **Dashboard Integration** - Live Activity Panel on all role dashboards
- **Event Hooks** - Backend emits events on CRUD operations

## Tech Stack

### Frontend
| Technology | Purpose | Version |
|------------|---------|---------|
| **React** | UI Framework | 18.2.0 |
| **TypeScript** | Type Safety | 5.3.3 |
| **Vite** | Build Tool & Dev Server | 5.0.8 |
| **React Router DOM** | Client-side Routing | 6.21.1 |
| **TanStack Query** | Data Fetching & Caching | 5.14.2 |
| **Tailwind CSS** | Styling Framework | 3.4.0 |
| **shadcn/ui** | Component Library (Radix UI based) | Latest |
| **Framer Motion** | Animations & Transitions | 14.6.0 |
| **Socket.IO Client** | Real-time Communication | 4.8.4 |
| **React Hook Form** | Form Management | 7.49.2 |
| **Zod** | Schema Validation | 3.22.4 |
| **Recharts** | Data Visualization | 2.10.3 |
| **Lucide React** | Icon Library | 0.303.0 |
| **Axios** | HTTP Client | 1.6.2 |
| **date-fns** | Date Utilities | 3.0.6 |

### Backend
| Technology | Purpose | Version |
|------------|---------|---------|
| **Node.js** | Runtime Environment | v18+ |
| **Express.js** | Web Framework | 4.18.2 |
| **TypeScript** | Type Safety | 5.3.3 |
| **MongoDB** | NoSQL Database | Latest |
| **Mongoose** | ODM for MongoDB | 8.0.3 |
| **Socket.IO** | Real-time Server | 4.8.4 |
| **JSON Web Token** | Authentication | 9.0.2 |
| **Argon2** | Password Hashing | 0.31.2 |
| **Helmet** | Security Headers | 7.1.0 |
| **CORS** | Cross-Origin Resource Sharing | 2.8.5 |
| **Express Rate Limit** | API Rate Limiting | 7.1.5 |
| **Multer** | File Upload | 1.4.5-lts.1 |
| **UUID** | Unique Identifiers | 9.0.1 |
| **Zod** | Request Validation | 3.22.4 |

## Architecture

### System Architecture
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend   │────▶│   Backend    │────▶│   MongoDB    │
│  (React/Vite)│     │ (Express/TS) │     │   Database   │
└─────────────┘     └─────────────┘     └─────────────┘
       │                    │
       │              ┌─────▼─────┐
       └─────────────▶│  Socket.IO │
                      │   Server   │
                      └───────────┘
```

### Request Flow
1. **Client Request** - Frontend makes HTTP request via Axios with JWT token
2. **Authentication Middleware** - Validates token and checks tokenVersion
3. **Route Handler** - Processes request through controller
4. **Business Logic** - Validates, processes data, updates database
5. **Real-Time Emission** - Broadcasts events via Socket.IO if applicable
6. **Response** - Returns JSON response to client
7. **State Update** - TanStack Query updates cache and UI

## Authentication & Security

### Authentication Flow
1. **Registration/Login** - User credentials validated, password verified with Argon2
2. **JWT Generation** - Token signed with user ID, role, and tokenVersion
3. **Token Storage** - Stored in localStorage as `fyp_token`
4. **Request Authorization** - Token sent in `Authorization: Bearer <token>` header
5. **Token Validation** - Middleware verifies signature and checks tokenVersion against DB
6. **Session Management** - Password change increments tokenVersion, invalidating all other sessions

### Security Measures
- **Password Hashing** - Argon2 algorithm for secure password storage
- **JWT with Token Versioning** - Runtime password changes invalidate old tokens
- **Role-Based Access Control (RBAC)** - Route-level protection by role
- **Helmet.js** - Security headers (XSS, CSP, etc.)
- **CORS Configuration** - Restricted to frontend origins
- **Rate Limiting** - 1000 requests per 15 minutes per IP
- **Input Validation** - Zod schemas for request validation
- **SQL/NoSQL Injection Prevention** - Mongoose parameterized queries
- **File Upload Security** - Multer with type/size restrictions

### Password Change Logic
```typescript
// On password change:
1. Verify current password with argon2.verify()
2. Hash new password with argon2.hash()
3. Increment user.tokenVersion
4. Save user
5. Generate new JWT with updated tokenVersion
6. Return new token to current session
7. All other sessions become invalid (tokenVersion mismatch)
```

## Database Models

### Core Models
| Model | Purpose | Key Fields |
|-------|---------|------------|
| **User** | Base user account | email, passwordHash, role, tokenVersion, isActive |
| **StudentProfile** | Student-specific data | userId, studentId, departmentId, CGPA, skills |
| **SupervisorProfile** | Supervisor-specific data | userId, employeeId, departmentId, researchInterests, maxSupervisees, availability |
| **Department** | Academic departments | name, code |
| **AcademicSession** | FYP sessions | name, startDate, endDate, isActive |

### Project Workflow Models
| Model | Purpose | Key Fields |
|-------|---------|------------|
| **Project** | FYP project instance | title, description, status, studentId, departmentId, academicSessionId |
| **ProjectMember** | Team members | projectId, studentId, role |
| **Proposal** | Project proposal | projectId, title, abstract, objectives, methodology, status, version, submittedAt |
| **ProposalVersion** | Proposal history | proposalId, versionNumber, all proposal fields |
| **SupervisorAssignment** | Supervisor-project mapping | projectId, supervisorId, assignedAt, assignedBy |

### Progress Tracking
| Model | Purpose | Key Fields |
|-------|---------|------------|
| **Milestone** | Project milestones | projectId, title, description, dueDate, status, progress |
| **Submission** | Deliverable submissions | projectId, milestoneId, title, fileUrl, status, reviewedAt |
| **Feedback** | Supervisor feedback | projectId, submissionId, authorId, content, isRevisionRequest |
| **Comment** | Threaded comments | projectId, authorId, content |

### Evaluation Models
| Model | Purpose | Key Fields |
|-------|---------|------------|
| **EvaluationRubric** | Grading rubric | name, totalMarks, isActive |
| **RubricCriterion** | Rubric criteria | rubricId, name, description, maxMarks, weight, order |
| **Evaluation** | Project evaluation | projectId, evaluatorId, scores, totalScore, comments, isReleased |
| **DefenseSchedule** | Defense sessions | projectId, scheduledDate, venue, duration, evaluators, status |

### System Models
| Model | Purpose | Key Fields |
|-------|---------|------------|
| **Notification** | User notifications | userId, title, message, type, link, read |
| **Deadline** | FYP deadlines | title, date, scope, status |
| **AuditLog** | Activity audit trail | userId, action, entityType, entityId, details, ipAddress |
| **Setting** | System configuration | key, value |
| **HealthScore** | Project health cache | projectId, score, level, factors, recommendations |

## API Endpoints

### Authentication (`/api/v1/auth`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/register` | Register new user | No |
| POST | `/login` | User login | No |
| GET | `/me` | Get current user | Yes |
| POST | `/logout` | User logout | Yes |
| POST | `/change-password` | Change password (rotates tokens) | Yes |

### Student Routes (`/api/v1/student`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/overview` | Dashboard data with readiness score | Student |
| GET | `/proposal` | Get proposal details | Student |
| PUT | `/proposal` | Save/update proposal (draft or submit) | Student |
| GET | `/team` | Get team members | Student |
| POST | `/team/invite` | Invite team member | Student |
| DELETE | `/team/:memberId` | Remove team member | Student |
| GET | `/milestones` | Get milestones | Student |
| GET | `/submissions` | Get submissions | Student |
| POST | `/submissions` | Create submission | Student |
| GET | `/feedback` | Get feedback | Student |
| POST | `/comments` | Add comment | Student |
| GET | `/evaluations` | Get evaluations & defense | Student |

### Supervisor Routes (`/api/v1/supervisor`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/overview` | Supervisor dashboard | Supervisor |
| GET | `/projects` | Assigned projects | Supervisor |
| GET | `/reviews` | Pending reviews (proposals/submissions) | Supervisor |
| POST | `/proposals/:id/review` | Review proposal | Supervisor |
| POST | `/submissions/:id/review` | Review submission | Supervisor |
| GET | `/milestones` | All milestones | Supervisor |
| GET | `/health` | Project health monitor | Supervisor |
| POST | `/health/recalculate` | Recalculate health scores | Supervisor |
| GET | `/schedule` | Defense schedule | Supervisor |
| GET | `/reports` | Supervision reports | Supervisor |

### Admin Routes (`/api/v1/admin`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/overview` | Admin dashboard | Admin |
| GET | `/users` | List all users | Admin |
| POST | `/users` | Create user | Admin |
| GET | `/projects` | All projects | Admin |
| GET | `/assignments` | Assignments overview | Admin |
| GET | `/assignments/recommendations` | Smart supervisor match | Admin |
| POST | `/assignments` | Assign supervisor | Admin |
| GET | `/proposals` | All proposals | Admin |
| POST | `/proposals/:id/decision` | Approve/reject proposal | Admin |
| GET | `/departments` | Departments | Admin |
| GET | `/sessions` | Academic sessions | Admin |
| GET | `/deadlines` | Deadlines | Admin |
| POST | `/deadlines` | Create deadline | Admin |
| GET | `/evaluations` | Evaluations overview | Admin |
| POST | `/evaluations/schedule` | Schedule defense | Admin |
| GET | `/audit-logs` | Audit trail | Admin |
| GET | `/settings` | System settings | Admin |

### Real-Time Routes (`/api/v1/realtime`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/status` | Get online count & users | Yes |
| GET | `/presence` | Check user presence | Yes |
| POST | `/activity` | Push activity event | Yes |

### WebSocket Events

#### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `room:join` | `roomId: string` | Join project chat room |
| `room:leave` | `roomId: string` | Leave project chat room |
| `chat:send` | `{roomId, text, sender}` | Send chat message |
| `chat:history` | `roomId: string` | Request chat history |
| `typing:start` | `{roomId, name}` | Start typing indicator |
| `typing:stop` | `{roomId}` | Stop typing indicator |
| `activity:ping` | - | Heartbeat ping |

#### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `connect` | - | Connection established |
| `disconnect` | - | Connection lost |
| `presence:update` | `{userId, online, count}` | Presence change |
| `activity:feed` | `ActivityItem` | New activity event |
| `room:joined` | `{roomId}` | Room join confirmation |
| `chat:message` | `ChatMsg` | New chat message |
| `chat:history` | `{roomId, messages}` | Chat history response |
| `typing:update` | `{roomId, users[]}` | Typing users update |
| `notification:new` | `Notification` | Real-time notification |
| `activity:pong` | `{ts, online}` | Heartbeat response |

## Frontend Structure

```
frontend/src/
├── components/
│   ├── ui/                    # shadcn/ui components (Button, Card, Input, etc.)
│   ├── shared/               # Shared components (Common, ResourceTable)
│   ├── motion/               # Animation wrappers (PageTransition)
│   ├── DashboardLayout.tsx   # Main layout with sidebar, header, nav
│   ├── CommandPalette.tsx    # Ctrl+K navigation
│   ├── LiveActivityPanel.tsx # Real-time activity feed
│   └── ProjectChat.tsx       # Real-time project chat
├── context/
│   ├── AuthContext.tsx       # Authentication state
│   └── RealtimeContext.tsx   # Socket.IO state management
├── hooks/
│   ├── useApi.ts             # TanStack Query wrappers
│   └── useMobile.ts          # Mobile detection
├── lib/
│   ├── api.ts                # Axios instance with interceptors
│   ├── utils.ts              # Utility functions (cn)
│   ├── format.ts             # Date/format helpers
│   └── csv.ts                # CSV export
├── pages/
│   ├── auth/                 # Login, Register
│   ├── student/              # Student dashboards & pages
│   ├── supervisor/           # Supervisor dashboards & pages
│   ├── admin/                # Admin dashboards & pages
│   └── shared/               # Shared pages (Profile, Notifications)
└── App.tsx                   # Route configuration
```

## Setup Instructions

### Prerequisites
- Node.js v18 or higher
- MongoDB (local installation or MongoDB Atlas)
- npm or yarn package manager

### Backend Setup
```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env
```

Configure `.env`:
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/fyp_manager
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRE=7d
FRONTEND_URL=http://localhost:5173
```

```bash
# Seed database with sample data
npm run seed

# Start development server
npm run dev
```

Backend runs on `http://localhost:5000`

### Frontend Setup
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend runs on `http://localhost:5173`

### Build for Production
```bash
# Backend
cd backend
npm run build
npm start

# Frontend
cd frontend
npm run build
npm run preview
```

## Default Credentials

| Role | Email | Password | Purpose |
|------|-------|----------|---------|
| **Admin** | admin@fypmanager.com | password123 | Full system access |
| **Supervisor** | supervisor@fypmanager.com | password123 | Project supervision |
| **Student** | student@fypmanager.com | password123 | Student project management |

*⚠️ Change these credentials in production environment.*

## Project Health Monitor Logic

The Project Health Monitor uses an explainable rule-based scoring system to identify at-risk projects.

### Scoring Algorithm
```javascript
score = 0
factors = []

// Overdue milestones
const overdueMilestones = milestones.filter(m => m.dueDate < now && m.status !== 'COMPLETED')
if (overdueMilestones.length > 0) {
  score += overdueMilestones.length * 20
  factors.push({ label: `${overdueMilestones.length} overdue milestone(s)`, pts: overdueMilestones.length * 20, active: true })
}

// Missed deadlines (within 7 days past)
const missedDeadlines = deadlines.filter(d => d.date < now && d.date > subDays(now, 7))
if (missedDeadlines.length > 0) {
  score += 15
  factors.push({ label: 'Recent missed deadline', pts: 15, active: true })
}

// No activity in 14+ days
const lastActivity = getLastActivity(project)
if (differenceInDays(now, lastActivity) >= 14) {
  score += 10
  factors.push({ label: 'No updates in 14+ days', pts: 10, active: true })
}

// Repeated revision requests (3+)
const revisions = feedback.filter(f => f.isRevisionRequest).length
if (revisions >= 3) {
  score += 15
  factors.push({ label: 'Repeated revision requests', pts: 15, active: true })
}

// Outstanding reviews (7+ days)
const pendingReviews = submissions.filter(s => s.status === 'SUBMITTED' && differenceInDays(now, s.submittedAt) >= 7)
if (pendingReviews.length > 0) {
  score += 10
  factors.push({ label: 'Reviews pending 7+ days', pts: 10, active: true })
}

score = Math.min(score, 100)
```

### Risk Classification
| Score Range | Level | Color | Action |
|-------------|-------|-------|--------|
| 0-24 | **LOW** | Green (#10b981) | Project on track, minimal intervention needed |
| 25-49 | **MEDIUM** | Amber (#f59e0b) | Needs attention, monitor closely |
| 50+ | **HIGH** | Red (#ef4444) | At risk, requires immediate supervisor intervention |

### Recommendations Engine
Based on active factors, the system generates actionable recommendations:
- Overdue milestones → "Follow up on overdue milestones and adjust timeline"
- No activity → "Schedule check-in meeting with student"
- Revisions → "Clarify expectations and provide detailed feedback"
- Pending reviews → "Review pending submissions promptly"

## Smart Features Logic

### 1. Smart Supervisor Matching
Algorithm scores supervisors based on multiple factors:

```javascript
score = 0

// Workload capacity (45 points max)
const load = currentAssignments[supervisorId] || 0
const capacity = supervisor.maxSupervisees || 5
const workloadRatio = 1 - Math.min(load / capacity, 1)
score += 45 * workloadRatio

// Availability (15 points)
if (supervisor.availability !== false && load < capacity) score += 15

// Research keyword overlap (25 points max)
const projectKeywords = extractKeywords(project.title, project.abstract, proposal.*)
const supervisorInterests = extractKeywords(supervisor.researchInterests)
const matched = intersection(projectKeywords, supervisorInterests)
score += Math.min(25, 10 + matched.length * 5)

// Same department (15 points)
if (supervisor.departmentId === project.departmentId) score += 15

score = Math.min(100, Math.round(score))
```

**Keyword Extraction:**
- Convert to lowercase
- Remove stop words (the, and, for, with, using, system, project, etc.)
- Filter words >= 3 characters
- Use for matching algorithm

### 2. Defense Readiness Score
Student dashboard calculates readiness across 4 components:

```javascript
components = [
  {
    key: 'proposal',
    label: 'Scope & proposal',
    max: 25,
    score: proposalApproved ? 25 : proposalExists ? 16 : 6,
    detail: ...
  },
  {
    key: 'delivery',
    label: 'Deliverable progress',
    max: 35,
    score: Math.round((progress / 100) * 35),
    detail: `${progress}% of planned work complete`
  },
  {
    key: 'quality',
    label: 'Review outcomes',
    max: 20,
    score: approvedSubmissions > 0 ? 20 : pendingReviews > 0 ? 12 : 6,
    detail: ...
  },
  {
    key: 'risk',
    label: 'Risk management',
    max: 20,
    score: healthScore <= 20 ? 20 : healthScore <= 49 ? 12 : 4,
    detail: ...
  }
]

totalScore = sum(components)
level = totalScore >= 80 ? 'READY' : totalScore >= 60 ? 'ON_TRACK' : 'NEEDS_FOCUS'
```

**Next Best Actions Algorithm:**
Prioritizes actions in order:
1. High priority: Proposal not approved, overdue milestones, revision requests
2. Medium priority: Pending reviews
3. If all good: Prepare for defense or maintain momentum

### 3. Command Palette
- **Trigger**: `Ctrl+K` (Windows/Linux) or `Cmd+K` (Mac)
- **Search**: Fuzzy search across all navigation items
- **Role-Aware**: Shows only relevant pages for user's role
- **Keyboard Navigation**: Arrow keys, Enter, Escape
- **Quick Access**: Navigate to any page in 2-3 keystrokes

### 4. Runtime Password Rotation
- **Token Versioning**: Each user has `tokenVersion` field (default 0)
- **Token Inclusion**: JWT includes `tokenVersion` claim
- **Validation**: Middleware checks token version against database
- **On Change**: Increments version, issues new token
- **Effect**: Old tokens rejected with "Session expired after password change" message
- **Current Session**: Gets fresh token, continues working

## Contributing

This is a Final Year Project. For questions or suggestions, please contact the development team.

## License

MIT License - see LICENSE file for details

---

**Built with ❤️ for efficient FYP management** | Version 1.0.0 | Last Updated: October 2026
