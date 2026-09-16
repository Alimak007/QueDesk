import { Navigate, Outlet, useLocation } from 'react-router';
import { FullPageLoader } from '@/components/layout/FullPageLoader';
import { canAccessModule, can } from '@/lib/permissions';
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
 * Restricts child routes to a module (optionally to specific actions), so a
 * user cannot reach a page by typing its URL. The API enforces the same rules.
 */
export function RequirePermission({ module, actions }) {
  const { user } = useAuth();
  const allowed = actions?.length ? can(user, module, ...actions) : canAccessModule(user, module);
  if (!allowed) return <Navigate to="/" replace />;
  return <Outlet />;
}

export function RequireAdmin() {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return <Outlet />;
}

export function GuestOnly() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <FullPageLoader />;
  if (isAuthenticated) return <Navigate to={location.state?.from || '/'} replace />;
  return <Outlet />;
}

/** Keeps old bookmarks working after the navigation restructure. */
export function RedirectTo({ to }) {
  const { search, hash } = useLocation();
  return <Navigate to={`${to}${search}${hash}`} replace />;
}
