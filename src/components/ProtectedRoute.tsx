import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import { LoadingCar } from './LoadingCar'

interface ProtectedRouteProps {
  children: ReactNode
  requiredRole?: 'passenger' | 'driver' | 'admin'
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, role, loading, homePath } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingCar label="Loading..." />

  if (!user) {
    // Remember where they were going so login can send them back
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  // Admins can open any role-protected page
  if (requiredRole && role !== requiredRole && role !== 'admin') {
    return <Navigate to={homePath} replace />
  }

  return <>{children}</>
}
