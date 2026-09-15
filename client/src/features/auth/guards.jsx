import { Navigate, Outlet, useLocation } from 'react-router';
import { FullPageLoader } from '@/components/layout/FullPageLoader';
import { useAuth } from './useAuth';

/** Renders child routes only for signed-in users. */
export function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageLoader />;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  return <Outlet />;
}

/**
 * Restricts child routes to specific roles. This is a UX convenience only —
 * the API independently enforces every permission.
 */
export function RequireRole({ roles }) {
  const { user } = useAuth();
  if (!roles.includes(user?.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}

export function GuestOnly() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <FullPageLoader />;
  if (isAuthenticated) return <Navigate to={location.state?.from || '/'} replace />;
  return <Outlet />;
}
