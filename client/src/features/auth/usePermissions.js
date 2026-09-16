import { useCallback, useMemo } from 'react';
import { can as canFor } from '@/lib/permissions';
import { useAuth } from './useAuth';

/**
 * Permission helpers bound to the signed-in user, e.g. `can('invoices', 'create')`.
 * These only decide what to show; the API enforces every rule independently.
 */
export function usePermissions() {
  const { user, isAdmin } = useAuth();

  const can = useCallback((module, ...actions) => canFor(user, module, ...actions), [user]);

  return useMemo(() => ({ can, isAdmin, permissions: user?.permissions ?? {} }), [can, isAdmin, user]);
}
