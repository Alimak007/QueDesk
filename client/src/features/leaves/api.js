import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cleanParams, http } from '@/lib/api';

export const leaveKeys = {
  all: ['leaves'],
  list: (params) => ['leaves', 'list', params],
  detail: (id) => ['leaves', 'detail', id],
  summary: (params) => ['leaves', 'summary', params],
  balances: (params) => ['leaves', 'balances', params],
};

export function useLeaves(params) {
  return useQuery({
    queryKey: leaveKeys.list(params),
    queryFn: () => http.get('/leaves', cleanParams(params)),
    placeholderData: keepPreviousData,
  });
}

export function useLeave(id) {
  return useQuery({
    queryKey: leaveKeys.detail(id),
    queryFn: () => http.get(`/leaves/${id}`).then((d) => d.leave),
    enabled: Boolean(id),
  });
}

export function useLeaveSummary(params = {}) {
  return useQuery({
    queryKey: leaveKeys.summary(params),
    queryFn: () => http.get('/leaves/summary', cleanParams(params)),
  });
}

/** Entitlement, used and remaining days per leave type. Own balance by default. */
export function useLeaveBalances(params = {}) {
  return useQuery({
    queryKey: leaveKeys.balances(params),
    queryFn: () => http.get('/leaves/balances', cleanParams(params)),
  });
}

export const previewLeaveDays = (body) => http.post('/leaves/preview', body).then((d) => d.days);

function useLeaveMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (leave) => {
      if (leave?.id) queryClient.setQueryData(leaveKeys.detail(leave.id), leave);
      queryClient.invalidateQueries({ queryKey: leaveKeys.all });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['daily-status', 'team'] });
    },
  });
}

export const useApplyLeave = () => useLeaveMutation((body) => http.post('/leaves', body).then((d) => d.leave));

export const useUpdateLeave = () =>
  useLeaveMutation(({ id, ...body }) => http.put(`/leaves/${id}`, body).then((d) => d.leave));

export const useCancelLeave = () => useLeaveMutation((id) => http.patch(`/leaves/${id}/cancel`).then((d) => d.leave));

export const useReviewLeave = () =>
  useLeaveMutation(({ id, ...body }) => http.patch(`/leaves/${id}/review`, body).then((d) => d.leave));
