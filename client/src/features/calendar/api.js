import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cleanParams, http } from '@/lib/api';

export const eventKeys = {
  all: ['events'],
  range: (params) => ['events', 'range', params],
  upcoming: (params) => ['events', 'upcoming', params],
};

export function useEvents(params) {
  return useQuery({
    queryKey: eventKeys.range(params),
    queryFn: () => http.get('/events', cleanParams(params)).then((d) => d.items),
    placeholderData: keepPreviousData,
  });
}

export function useUpcomingEvents(params = { limit: 6 }) {
  return useQuery({
    queryKey: eventKeys.upcoming(params),
    queryFn: () => http.get('/events/upcoming', cleanParams(params)).then((d) => d.items),
  });
}

function useEventMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventKeys.all });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export const useCreateEvent = () => useEventMutation((body) => http.post('/events', body).then((d) => d.event));

export const useUpdateEvent = () =>
  useEventMutation(({ id, ...body }) => http.put(`/events/${id}`, body).then((d) => d.event));

export const useDeleteEvent = () => useEventMutation((id) => http.delete(`/events/${id}`));
