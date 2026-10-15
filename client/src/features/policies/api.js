import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cleanParams, http } from '@/lib/api';

export const policyKeys = {
  all: ['policies'],
  list: (params) => ['policies', 'list', params],
  detail: (id) => ['policies', 'detail', id],
  acceptances: (id) => ['policies', 'acceptances', id],
  pending: ['policies', 'pending'],
};

export function usePolicies(params = {}) {
  return useQuery({
    queryKey: policyKeys.list(params),
    queryFn: () => http.get('/policies', cleanParams(params)).then((d) => d.items),
  });
}

export function usePolicy(id) {
  return useQuery({
    queryKey: policyKeys.detail(id),
    queryFn: () => http.get(`/policies/${id}`).then((d) => d.policy),
    enabled: Boolean(id),
  });
}

export function usePolicyAcceptances(id, { enabled = true } = {}) {
  return useQuery({
    queryKey: policyKeys.acceptances(id),
    queryFn: () => http.get(`/policies/${id}/acceptances`),
    enabled: Boolean(id) && enabled,
  });
}

/** Policies the signed-in employee still has to accept. */
export function usePendingPolicies({ enabled = true } = {}) {
  return useQuery({
    queryKey: policyKeys.pending,
    queryFn: () => http.get('/policies/pending').then((d) => d.items),
    enabled,
    staleTime: 60_000,
  });
}

function usePolicyMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (policy) => {
      if (policy?.id) queryClient.setQueryData(policyKeys.detail(policy.id), policy);
      queryClient.invalidateQueries({ queryKey: policyKeys.all });
    },
  });
}

export const useCreatePolicy = () => usePolicyMutation((body) => http.post('/policies', body).then((d) => d.policy));

export const useUpdatePolicy = () =>
  usePolicyMutation(({ id, ...body }) => http.put(`/policies/${id}`, body).then((d) => d.policy));

export const useSetPolicyStatus = () =>
  usePolicyMutation(({ id, status }) => http.patch(`/policies/${id}/status`, { status }).then((d) => d.policy));

export const useDeletePolicy = () => usePolicyMutation((id) => http.delete(`/policies/${id}`));

export function useAcceptPolicies() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (policies) => http.post('/policies/accept', { policies }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: policyKeys.all });
    },
  });
}
