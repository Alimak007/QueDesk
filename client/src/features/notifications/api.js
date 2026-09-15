import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '@/lib/api';

export const notificationKeys = { all: ['notifications'] };

export function useNotifications() {
  return useQuery({
    queryKey: notificationKeys.all,
    queryFn: () => http.get('/notifications', { limit: 20 }),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => http.patch(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => http.patch('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}
