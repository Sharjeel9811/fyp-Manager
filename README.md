# FYP Manager - Smart Final Year Project Management System

A comprehensive, real-time enabled Final Year Project Management System designed for universities to streamline the entire FYP lifecycle - from proposal submission to defense evaluation. Built with modern technologies and intelligent features to make project management more efficient and unique.

## Live Deployment

| Service | URL |
|---------|-----|
| **Web App (Frontend)** | https://fypmanager.vercel.app |
| **REST API (Backend)** | https://fyp-manager-api.vercel.app/api/v1 |
| **API Health Check** | https://fyp-manager-api.vercel.app/health |
| **Source Code** | https://github.com/Sharjeel9811/fyp-Manager |

**Demo accounts** (password `password123` for all): `student@fypmanager.com`, `supervisor@fypmanager.com`, `admin@fypmanager.com`

> **Why the backend has two targets:** Vercel serverless functions are request-scoped, so they can serve the REST API but cannot hold a Socket.IO connection open and cannot share in-memory presence between instances. The frontend therefore lives on Vercel, while the same Express app is also deployed as a long-running Node service (see [Real-Time Deployment](#real-time-deployment-render)). Until that service is created, every dashboard keeps polling its REST data (15s interval + refetch on tab focus) and the Live Activity panel shows the real connection state instead of pretending to be live.

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
- [Real-Time Deployment (Render)](#real-time-deployment-render)
- [Testing Real-Time](#testing-real-time)
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
The platform uses Socket.IO for bidirectional, real-time communication. The socket is authenticated with the same JWT the REST API uses, so a socket can never see more than its user is allowed to see over HTTP.

**Connection:** the client connects to the bare API origin (`new URL(VITE_API_URL).origin`) with `auth: { token }`. Socket.IO needs the origin, not the `/api/v1` path — pointing it at the API path makes the server treat `api` as a namespace and the connection fails.

**Handshake rules (same as the REST `authenticate` middleware):**
1. A bearer token must be present in `handshake.auth.token`.
2. The token signature must verify against `JWT_SECRET`.
3. The user must still exist and be `isActive`.
4. `tokenVersion` in the token must equal the user's `tokenVersion`, so a password change invalidates live sockets too.

Rejected handshakes close with `unauthorized` or `session-expired`; the client surfaces that in the panel instead of retrying forever.

#### 1. Live Presence System
- **Per-User Presence** - One user may have several tabs; presence is tracked per user, not per socket
- **Online Count** - Unique authenticated users currently connected
- **Presence Snapshot** - A new socket immediately receives `presence:state`, then everyone receives `presence:update`
- **Correct Semantics** - A user is only online if they have an open authenticated socket; the server running does not make anyone online

**Logic:**
```javascript
// Server keeps Map<userId, { sockets: Set<socketId>, role, name }>
// connection: add socketId, send presence:state, broadcast presence:update {online:true}
// disconnect: remove socketId; only when the set is empty, broadcast {online:false}
```

#### 2. Real-Time Activity Feed
- **Database first** - controllers persist the change, then `await broadcastActivity(...)`
- **Authorized fan-out** - supervisors, admins, the project audience (team members + assigned supervisor) and the actor; Socket.IO de-duplicates sockets in several rooms
- **Admin-only manual push** - `POST /api/v1/realtime/activity` is not available to students/supervisors, so feed items cannot be spoofed
- **Dedupe on the client** - items carry a stable `id`; the feed ignores repeats (reconnect redelivery, React StrictMode double effects)
- **Auto-Expiring Feed** - last 50 activities kept in memory

**Triggered Events:**
- Proposal saved/submitted by students
- Proposal/submission reviewed by supervisors
- Supervisor assigned by admin

#### 3. Project-Specific Live Chat
- **Room-Based Messaging** - Each project has its own chat room
- **Authorized Joins** - `room:join` verifies ProjectMember / SupervisorAssignment (admin allowed); refusals come back as `room:denied`
- **Real-Time Delivery** - Instant message broadcasting
- **Message History** - Last 200 messages cached in memory
- **Typing Indicators** - Shows who is typing with auto-timeout

#### 4. Real-Time Notifications
- **Instant Delivery** - `notification:new` pushed to the target user's room
- **Fallback to Polling** - Works even if WebSocket disconnects

#### 5. Connection, Presence and Activity are shown separately
`RealtimeContext` exposes a status union — `idle` (signed out), `connecting`, `online`, `reconnecting`, `offline`, `unauthorized` — plus `onlineUsers` and `activityFeed`. The panel therefore never equates "socket down" with "nobody online", and the fallback banner says polling is still active.

**Client lifecycle:**
- One socket per authenticated session, created in `useEffect` keyed on the user id (not created on render)
- All listeners removed in cleanup, socket disconnected on logout
- Reconnection with backoff (`reconnectionAttempts: Infinity`), offline users cleared while disconnected
- A 5s token watcher reconnects with a rotated token after a password change
- Polling (15s + focus refetch) stays enabled as a fallback for dashboard data; it is idempotent, so it cannot duplicate activity rows

### Integration Points
- **Auth Context Integration** - WebSocket connects only when a user is authenticated
- **Token-Based Auth** - Socket handshake uses the stored JWT (`fyp_token`)
- **Dashboard Integration** - Live Activity Panel on all role dashboards
- **Event Hooks** - Backend emits events after successful database writes only

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
                    ┌──────────────────────────┐
   Browser ────────▶│  Vercel: React/Vite SPA  │
                    └────────────┬─────────────┘
                                 │  HTTPS (REST)  +  WSS (Socket.IO)
                    ┌────────────▼─────────────┐
                    │  Render: Express + TS    │
                    │  http.createServer(app)  │
                    │  Socket.IO attached      │
                    └────────────┬─────────────┘
                                 │  Mongoose
                    ┌────────────▼─────────────┐
                    │  MongoDB Atlas           │
                    └──────────────────────────┘
```

The same Express app serves both transports from one HTTP server: REST under
`/api/v1`, Socket.IO under `/socket.io`. Presence, chat history and typing state
live in that process's memory, which is why the API must run as a single
long-lived instance (not serverless, not multiple replicas without a Redis
adapter).

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
- **JWT with Token Versioning** - Runtime password changes invalidate old tokens (REST *and* live sockets)
- **Role-Based Access Control (RBAC)** - Route-level protection by role
- **Socket Handshake Auth** - JWT verified on connect; inactive users and stale `tokenVersion`s are refused
- **Socket Room Authorization** - `room:join` checks ProjectMember / SupervisorAssignment; admins only for cross-project
- **Scoped Broadcasts** - activity fan-out targets role rooms plus the project's own audience; no global student broadcast
- **Helmet.js** - Security headers (XSS, CSP, etc.)
- **CORS Configuration** - One shared origin list for REST and Socket.IO (`FRONTEND_URL`, plus localhost in development)
- **Rate Limiting** - 1000 requests per 15 minutes per IP
- **Input Validation** - Zod schemas for request validation; socket payloads length-checked and type-checked
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
| GET | `/status` | Get online count & sessions | Yes |
| GET | `/presence?userId=` | Check a user's presence | Yes |
| POST | `/activity` | Push activity event | Admin only |

### WebSocket Events

#### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `room:join` | `roomId: string` | Join project chat room |
| `room:leave` | `roomId: string` | Leave project chat room |
| `chat:send` | `{roomId, text}` | Send chat message (sender taken from the socket) |
| `chat:history` | `roomId: string` | Request chat history |
| `typing:start` | `{roomId, name}` | Start typing indicator |
| `typing:stop` | `{roomId}` | Stop typing indicator |
| `activity:ping` | - | Heartbeat ping |

#### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `connect` | - | Connection established |
| `disconnect` | - | Connection lost |
| `connect_error` | `Error` | Rejected handshake (`unauthorized` / `session-expired`) |
| `presence:state` | `{self, users[], count}` | Presence snapshot on connect |
| `presence:update` | `{userId, role, name, online, count}` | Presence change |
| `activity:feed` | `ActivityItem` | New activity event |
| `room:joined` | `{roomId}` | Room join confirmation |
| `room:denied` | `{roomId, reason}` | Join refused (`forbidden`, `invalid-room`, `error`) |
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

# Create .env file (VITE_API_URL must include /api/v1)
cp .env.example .env
```

Configure `.env`:
```env
VITE_API_URL=http://localhost:5000/api/v1
```

```bash
# Start development server
npm run dev
```

Frontend runs on `http://localhost:5173`. Only `VITE_*` variables reach the browser — never put `JWT_SECRET`, `MONGODB_URI`, or any other secret in this file.

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

## Real-Time Deployment (Render)

`render.yaml` in the repo root is a Render Blueprint for the API service. The frontend stays on Vercel.

### 1. Create the API service
1. Push this repo to GitHub (already connected for the live deployment).
2. In Render: **New → Blueprint**, select the repo, apply the detected `render.yaml`.
3. Render reads `backend/` as the root and runs:
   - Build: `npm install && npm run build`
   - Start: `npm start` (`node dist/index.js`)
   - Health check: `/health`
4. `PORT` is injected by Render; the server already reads `process.env.PORT`.

### 2. Environment variables

**Render → fyp-manager-api → Environment**

| Variable | Value | Notes |
|----------|-------|-------|
| `MONGODB_URI` | your Atlas SRV URI | Paste in the dashboard, never in git |
| `JWT_SECRET` | same secret as the current backend | Rotating it signs everyone out |
| `JWT_EXPIRE` | `7d` | Must be a duration string, not the secret |
| `NODE_ENV` | `production` | |
| `FRONTEND_URL` | `https://fypmanager.vercel.app` | REST CORS + Socket.IO origin; comma-separated list allowed |
| `PORT` | *(do not set)* | Provided by Render |

**Vercel → fyp-manager → Settings → Environment Variables**

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://<your-service>.onrender.com/api/v1` |

The `/api/v1` suffix matters for REST; the client strips it to get the socket origin automatically, so do not point the socket at `/api/v1` yourself.

### 3. Repoint and verify
1. Save the Vercel env var, then **Redeploy** the frontend (Vite inlines env vars at build time).
2. If you keep the Render URL in `FRONTEND_URL`, no change is needed there; for a custom domain, add it to `FRONTEND_URL` before redeploying.
3. Check `https://<your-service>.onrender.com/health` → `{"status":"ok","database":"connected"}`.
4. Open the app, sign in, and confirm the Live Activity panel shows “N online” instead of “Offline”.

### Plan notes
- Render **free** instances sleep after ~15 minutes of inactivity. The first request after sleep has a cold start and existing sockets drop; the client reconnects automatically and polling covers the gap. For always-on real-time, use the Starter plan.
- Run exactly **one** instance. Presence/chat are in-process; multiple instances require the Socket.IO Redis adapter.
- MongoDB Atlas must allow Render's egress IPs. `0.0.0.0/0` is the simplest option for a demo cluster.
- Vercel hosting of the API can stay as a REST-only fallback, but it can never serve WebSockets.

## Testing Real-Time

With the backend running locally (`PORT=5010`, database reachable) from `backend/`:

```bash
node rt-inspect.cjs   # fixture overview: students, projects, assignments
node rt-test.cjs      # end-to-end socket test suite
```

`rt-test.cjs` logs in as student, second student, supervisor and admin, then verifies:
- JWT handshake, `presence:state` snapshot, online/offline transitions
- student activity reaching the supervisor without a refresh, exactly once
- no leakage of a project's activity to an unrelated student
- authorized/denied `room:join`, chat isolation
- anonymous and stale-`tokenVersion` sockets rejected
- several supervisor tabs each receiving one copy; presence counting users not sockets
- heartbeat, reconnect presence, REST overviews, admin-only activity push

It snapshots and restores the demo proposal/project so the seeded data is unchanged.

To verify in the browser: sign in as the student in one window and the supervisor in another, save a proposal draft as the student, and watch the supervisor's Live Activity panel update with no refresh. Then stop the API — the panel should switch to “Reconnecting…” and resume by itself when the API returns.

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
