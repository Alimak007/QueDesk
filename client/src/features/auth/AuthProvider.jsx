import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { onUnauthorized } from '@/lib/api';
import { ROLES } from '@/lib/constants';
import { authApi } from './api';
import { AUTH_QUERY_KEY, AuthContext } from './authContext';

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();

  /**
   * The session probe answers 200 with `user: null` when nobody is signed in,
   * so an *error* here never means "signed out" — it means we could not ask.
   * Those two must stay apart: treating a failed check as a sign-out is what
   * throws a perfectly valid session onto the login page.
   */
  const {
    data: user,
    isPending,
    isError: sessionUnavailable,
    error: sessionError,
    refetch: retrySession,
  } = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: authApi.session,
    staleTime: 5 * 60 * 1000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });

  /**
   * Swaps the signed-in user and drops every other cached query so no data
   * from a previous session survives. The auth query itself must NOT be
   * removed (as `queryClient.clear()` would): this component observes it, and a
   * removed query would leave the observer holding the stale user.
   */
  const replaceSession = useCallback(
    (nextUser) => {
      queryClient.cancelQueries({ predicate: (q) => q.queryKey[0] !== AUTH_QUERY_KEY[0] });
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== AUTH_QUERY_KEY[0] });
      queryClient.setQueryData(AUTH_QUERY_KEY, nextUser);
    },
    [queryClient],
  );

  const signOutLocally = useCallback(() => replaceSession(null), [replaceSession]);

  useEffect(() => {
    onUnauthorized(() => {
      if (queryClient.getQueryData(AUTH_QUERY_KEY)) {
        toast.error('Your session has ended. Please sign in again.');
      }
      signOutLocally();
    });
    return () => onUnauthorized(null);
  }, [queryClient, signOutLocally]);

  const login = useCallback(
    async (credentials) => {
      const loggedIn = await authApi.login(credentials);
      replaceSession(loggedIn);
      return loggedIn;
    },
    [replaceSession],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      signOutLocally();
    }
  }, [signOutLocally]);

  const setUser = useCallback((next) => queryClient.setQueryData(AUTH_QUERY_KEY, next), [queryClient]);

  const value = useMemo(
    () => ({
      user: user ?? null,
      isLoading: isPending,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === ROLES.ADMIN,
      /** The check itself failed; the visitor may well still be signed in. */
      sessionUnavailable,
      sessionError,
      retrySession,
      login,
      logout,
      setUser,
    }),
    [user, isPending, sessionUnavailable, sessionError, retrySession, login, logout, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
