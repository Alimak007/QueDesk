import { Navigate, Outlet, useLocation } from 'react-router';
import { FullPageLoader } from '@/components/layout/FullPageLoader';
import { Logo } from '@/components/layout/Logo';
import { Card, ErrorState } from '@/components/ui';
import { canAccessModule, can } from '@/lib/permissions';
import { useAuth } from './useAuth';

/** Renders child routes only for signed-in users. */
export function RequireAuth() {
  const { isAuthenticated, isLoading, sessionUnavailable, sessionError, retrySession } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageLoader />;
  // The check failed rather than came back empty: keep the session, offer a retry.
  if (sessionUnavailable) return <SessionUnavailable error={sessionError} onRetry={retrySession} />;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  return <Outlet />;
}

/** Shown when the server could not be asked who is signed in. */
function SessionUnavailable({ error, onRetry }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-canvas px-6">
      <Logo size="lg" />
      <Card className="w-full max-w-md">
        <ErrorState error={{ message: error?.message ?? 'The server could not be reached.' }} onRetry={onRetry} />
        <p className="px-6 pb-6 text-center text-xs text-slate-500">
          You have not been signed out — the app just could not reach the server to check.
        </p>
      </Card>
    </div>
  );
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
