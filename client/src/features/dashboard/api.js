import { useQuery } from '@tanstack/react-query';
import { http } from '@/lib/api';
import { can } from '@/lib/permissions';

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => http.get('/dashboard'),
    refetchInterval: 2 * 60_000,
  });
}

/** Lightweight counts for sidebar badges: pending leave awaiting the user's review. */
export function useNavCounts(user) {
  const canApprove = can(user, 'leave', 'approve');
  const { data } = useQuery({
    queryKey: ['leaves', 'list', { status: 'pending', limit: 1, nav: true }],
    queryFn: () => http.get('/leaves', { status: 'pending', limit: 1 }),
    enabled: canApprove,
    refetchInterval: 60_000,
  });
  return { pendingLeaves: canApprove ? (data?.pagination?.total ?? 0) : 0 };
}
