import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cleanParams, http } from '@/lib/api';

export const salesKeys = {
  all: ['sales'],
  config: (entity = 'lead', includeArchived = false) => ['sales', 'config', { entity, includeArchived }],
  leads: ['sales', 'leads'],
  list: (params) => ['sales', 'leads', 'list', params],
  board: (params) => ['sales', 'leads', 'board', params],
  summary: ['sales', 'leads', 'summary'],
};

/** Field configuration for a record type: `lead` (default) or `customer`. */
export function useSalesConfig({ includeArchived = false, entity = 'lead' } = {}) {
  return useQuery({
    queryKey: salesKeys.config(entity, includeArchived),
    queryFn: () => http.get('/sales/config', cleanParams({ entity, includeArchived: includeArchived || undefined })),
    staleTime: 60_000,
  });
}

export function useSalesSummary() {
  return useQuery({ queryKey: salesKeys.summary, queryFn: () => http.get('/sales/leads/summary') });
}

export function useLeads(params) {
  return useQuery({
    queryKey: salesKeys.list(params),
    queryFn: () => http.get('/sales/leads', cleanParams(params)),
    placeholderData: keepPreviousData,
  });
}

export function useLeadBoard(params) {
  return useQuery({
    queryKey: salesKeys.board(params),
    queryFn: () => http.get('/sales/leads/board', cleanParams(params)),
    placeholderData: keepPreviousData,
  });
}

function useInvalidateSales() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: salesKeys.all });
    // A stage change can create or remove a customer.
    queryClient.invalidateQueries({ queryKey: ['customers'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
}

export function useCreateLead() {
  const invalidate = useInvalidateSales();
  return useMutation({ mutationFn: (body) => http.post('/sales/leads', body).then((d) => d.lead), onSuccess: invalidate });
}

export function useUpdateLead() {
  const invalidate = useInvalidateSales();
  return useMutation({
    mutationFn: ({ id, ...body }) => http.patch(`/sales/leads/${id}`, body).then((d) => d.lead),
    onSuccess: invalidate,
  });
}

export function useDeleteLead() {
  const invalidate = useInvalidateSales();
  return useMutation({ mutationFn: (id) => http.delete(`/sales/leads/${id}`), onSuccess: invalidate });
}

/** Kanban move with an optimistic update so cards settle instantly. */
export function useMoveLead(boardParams) {
  const queryClient = useQueryClient();
  const key = salesKeys.board(boardParams);

  return useMutation({
    mutationFn: ({ id, value, position }) => http.patch(`/sales/leads/${id}/move`, { value, position }).then((d) => d.lead),
    onMutate: async ({ id, value, position }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);
      if (previous) {
        queryClient.setQueryData(key, (board) => ({
          ...board,
          leads: board.leads.map((lead) =>
            lead.id === id ? { ...lead, position, data: { ...lead.data, [board.groupField]: value } } : lead,
          ),
        }));
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: salesKeys.leads });
      // Dragging into or out of the customer stage adds or removes a customer.
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/* ------------------------------ Configuration ----------------------------- */

function useConfigMutation(mutationFn) {
  const invalidate = useInvalidateSales();
  return useMutation({ mutationFn, onSuccess: invalidate });
}

export const useCreateField = () => useConfigMutation((body) => http.post('/sales/fields', body).then((d) => d.field));

export const useConvertLeadToCustomer = () =>
  useConfigMutation((leadId) => http.post(`/sales/leads/${leadId}/convert`));

export const useUpdateField = () =>
  useConfigMutation(({ id, ...body }) => http.patch(`/sales/fields/${id}`, body).then((d) => d.field));

export const useArchiveField = () =>
  useConfigMutation(({ id, archived }) => http.patch(`/sales/fields/${id}/${archived ? 'archive' : 'restore'}`));

export const useDeleteField = () => useConfigMutation((id) => http.delete(`/sales/fields/${id}`));

export const useReorderFields = () => useConfigMutation(({ entity, ids }) => http.put('/sales/fields/reorder', { entity, ids }));

export const useUpdateSalesSettings = () =>
  useConfigMutation((body) => http.put('/sales/config/settings', body).then((d) => d.settings));
