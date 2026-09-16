import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cleanParams, http } from '@/lib/api';

export const customerKeys = {
  all: ['customers'],
  list: (params) => ['customers', 'list', params],
  detail: (id) => ['customers', 'detail', id],
};

export function useCustomers(params) {
  return useQuery({
    queryKey: customerKeys.list(params),
    queryFn: () => http.get('/customers', cleanParams(params)),
    placeholderData: keepPreviousData,
  });
}

function useCustomerMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      // A conversion changes the lead too.
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export const useCreateCustomer = () => useCustomerMutation((body) => http.post('/customers', body).then((d) => d.customer));

export const useUpdateCustomer = () =>
  useCustomerMutation(({ id, ...body }) => http.patch(`/customers/${id}`, body).then((d) => d.customer));

export const useDeleteCustomer = () => useCustomerMutation((id) => http.delete(`/customers/${id}`));

/** Converts a lead into a customer (idempotent on the server). */
export const useConvertLead = () => useCustomerMutation((leadId) => http.post(`/sales/leads/${leadId}/convert`));
