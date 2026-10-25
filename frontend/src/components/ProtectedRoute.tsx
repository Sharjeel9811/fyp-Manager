import { Navigate, useLocation } from 'react-router-dom'
import { useAuth, homeForRole, type Role } from '@/context/AuthContext'
import { PageLoader } from '@/components/shared/Common'

export function ProtectedRoute({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <PageLoader label="Signing you in…" />
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  if (!roles.includes(user.role)) return <Navigate to={homeForRole(user.role)} replace />
  return <>{children}</>
}
