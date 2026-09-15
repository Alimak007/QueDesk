import { useQuery } from '@tanstack/react-query';
import { http } from '@/lib/api';

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => http.get('/dashboard'),
    refetchInterval: 2 * 60_000,
  });
}

/** Lightweight counts for sidebar badges. */
export function useNavCounts(isAdmin) {
  const { data } = useQuery({
    queryKey: ['leaves', 'list', { status: 'pending', limit: 1, nav: true }],
    queryFn: () => http.get('/leaves', { status: 'pending', limit: 1 }),
    enabled: isAdmin,
    refetchInterval: 60_000,
  });
  return { pendingLeaves: data?.pagination?.total ?? 0 };
}
