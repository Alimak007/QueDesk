import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cleanParams, http } from '@/lib/api';

export const statusKeys = {
  all: ['daily-status'],
  list: (params) => ['daily-status', 'list', params],
  team: (params) => ['daily-status', 'team', params],
};

export function useStatusReports(params, options = {}) {
  return useQuery({
    queryKey: statusKeys.list(params),
    queryFn: () => http.get('/daily-status', cleanParams(params)),
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useTeamBoard(params) {
  return useQuery({
    queryKey: statusKeys.team(params),
    queryFn: () => http.get('/daily-status/team', cleanParams(params)),
    placeholderData: keepPreviousData,
  });
}

function useStatusMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: statusKeys.all });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export const useCreateStatus = () => useStatusMutation((body) => http.post('/daily-status', body).then((d) => d.report));

export const useUpdateStatus = () =>
  useStatusMutation(({ id, ...body }) => http.put(`/daily-status/${id}`, body).then((d) => d.report));
