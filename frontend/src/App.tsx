import { Routes, Route, Navigate, Link } from 'react-router-dom'
import { DashboardLayout } from '@/components/DashboardLayout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import LandingPage from '@/pages/LandingPage'
import Login from '@/pages/auth/Login'
import Register from '@/pages/auth/Register'
import { ForgotPassword, ResetPassword, VerifyEmail } from '@/pages/auth/PasswordPages'
import StudentDashboard from '@/pages/student/Dashboard'
import {
  StudentProject, StudentProposal, StudentTeam, StudentMilestones,
  StudentSubmissions, StudentFeedback, StudentEvaluations,
} from '@/pages/student/ProjectPages'
import SupervisorDashboard from '@/pages/supervisor/Dashboard'
import {
  SupervisorProjects, SupervisorReviews, SupervisorMilestones,
  SupervisorHealth, SupervisorSchedule, SupervisorReports,
} from '@/pages/supervisor/SupervisorPages'
import AdminDashboard from '@/pages/admin/Dashboard'
import {
  AdminUsers, AdminDepartments, AdminSessions, AdminProjects, AdminProposals,
  AdminAssignments, AdminDeadlines, AdminEvaluations, AdminReports, AdminAuditLogs, AdminSettings,
} from '@/pages/admin/AdminPages'
import { ProfilePage, NotificationsPage } from '@/pages/shared/ProfilePages'
import { Button } from '@/components/ui/Button'

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-navy-50 px-6 text-center">
      <p className="font-display text-7xl font-extrabold text-brand-600">404</p>
      <h1 className="mt-3 text-2xl font-bold text-navy-900">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-navy-500">The page you're looking for doesn't exist or has moved.</p>
      <Link to="/" className="mt-6"><Button>Back to home</Button></Link>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />

      <Route path="/student" element={<ProtectedRoute roles={['STUDENT']}><DashboardLayout role="STUDENT" /></ProtectedRoute>}>
        <Route index element={<Navigate to="/student/dashboard" replace />} />
        <Route path="dashboard" element={<StudentDashboard />} />
        <Route path="project" element={<StudentProject />} />
        <Route path="proposal" element={<StudentProposal />} />
        <Route path="team" element={<StudentTeam />} />
        <Route path="milestones" element={<StudentMilestones />} />
        <Route path="submissions" element={<StudentSubmissions />} />
        <Route path="feedback" element={<StudentFeedback />} />
        <Route path="evaluations" element={<StudentEvaluations />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage role="STUDENT" />} />
      </Route>

      <Route path="/supervisor" element={<ProtectedRoute roles={['SUPERVISOR']}><DashboardLayout role="SUPERVISOR" /></ProtectedRoute>}>
        <Route index element={<Navigate to="/supervisor/dashboard" replace />} />
        <Route path="dashboard" element={<SupervisorDashboard />} />
        <Route path="projects" element={<SupervisorProjects />} />
        <Route path="proposal-reviews" element={<SupervisorReviews kind="proposal" />} />
        <Route path="submission-reviews" element={<SupervisorReviews kind="submission" />} />
        <Route path="milestones" element={<SupervisorMilestones />} />
        <Route path="health" element={<SupervisorHealth />} />
        <Route path="schedule" element={<SupervisorSchedule />} />
        <Route path="reports" element={<SupervisorReports />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage role="SUPERVISOR" />} />
      </Route>

      <Route path="/admin" element={<ProtectedRoute roles={['ADMIN']}><DashboardLayout role="ADMIN" /></ProtectedRoute>}>
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="departments" element={<AdminDepartments />} />
        <Route path="sessions" element={<AdminSessions />} />
        <Route path="projects" element={<AdminProjects />} />
        <Route path="proposals" element={<AdminProposals />} />
        <Route path="assignments" element={<AdminAssignments />} />
        <Route path="deadlines" element={<AdminDeadlines />} />
        <Route path="evaluations" element={<AdminEvaluations />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="audit-logs" element={<AdminAuditLogs />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage role="ADMIN" />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
