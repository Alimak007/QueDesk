import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '@/lib/api';

export const permissionKeys = {
  catalog: ['permissions', 'catalog'],
  user: (id) => ['permissions', 'user', id],
};

export function usePermissionCatalog() {
  return useQuery({ queryKey: permissionKeys.catalog, queryFn: () => http.get('/permissions/catalog'), staleTime: Infinity });
}

export function useUserPermissions(userId) {
  return useQuery({
    queryKey: permissionKeys.user(userId),
    queryFn: () => http.get(`/permissions/users/${userId}`),
    enabled: Boolean(userId),
  });
}

function usePermissionMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: permissionKeys.user(variables.id ?? variables) });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      // The edited user may be the current one; refresh their session permissions.
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

export const useSavePermissions = () =>
  usePermissionMutation(({ id, permissions }) => http.put(`/permissions/users/${id}`, { permissions }));

export const useResetPermissions = () => usePermissionMutation(({ id }) => http.post(`/permissions/users/${id}/reset`));
