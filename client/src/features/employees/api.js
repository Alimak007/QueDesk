import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cleanParams, http } from '@/lib/api';

export const employeeKeys = {
  all: ['employees'],
  list: (params) => ['employees', 'list', params],
  detail: (id) => ['employees', 'detail', id],
  departments: ['employees', 'departments'],
  directory: ['employees', 'directory'],
  options: ['employees', 'options'],
};

export function useEmployees(params) {
  return useQuery({
    queryKey: employeeKeys.list(params),
    queryFn: () => http.get('/employees', cleanParams(params)),
    placeholderData: keepPreviousData,
  });
}

export function useEmployee(id) {
  return useQuery({
    queryKey: employeeKeys.detail(id),
    queryFn: () => http.get(`/employees/${id}`),
    enabled: Boolean(id),
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: employeeKeys.departments,
    queryFn: () => http.get('/employees/departments').then((d) => d.items),
    staleTime: 5 * 60 * 1000,
  });
}

/** Non-sensitive list of active colleagues (any role can read). */
export function useDirectory() {
  return useQuery({
    queryKey: employeeKeys.directory,
    queryFn: () => http.get('/employees/directory').then((d) => d.items),
    staleTime: 5 * 60 * 1000,
  });
}

/** Admin-only: every employee (including inactive) for filter dropdowns. */
export function useEmployeeOptions({ enabled = true } = {}) {
  return useQuery({
    queryKey: employeeKeys.options,
    queryFn: () => http.get('/employees', { limit: 100, sortBy: 'firstName', sortOrder: 'asc' }).then((d) => d.items),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

function useEmployeeMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.all });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export const useCreateEmployee = () => useEmployeeMutation((body) => http.post('/employees', body).then((d) => d.user));

export const useUpdateEmployee = () =>
  useEmployeeMutation(({ id, ...body }) => http.patch(`/employees/${id}`, body).then((d) => d.user));

export const useSetEmployeeStatus = () =>
  useEmployeeMutation(({ id, status }) => http.patch(`/employees/${id}/status`, { status }).then((d) => d.user));

export const useResetEmployeePassword = () =>
  useEmployeeMutation(({ id, password }) => http.post(`/employees/${id}/reset-password`, { password }));

export const useDeleteEmployee = () => useEmployeeMutation((id) => http.delete(`/employees/${id}`));
