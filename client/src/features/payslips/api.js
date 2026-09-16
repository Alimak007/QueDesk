import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cleanParams, downloadBlob, getBlob, http } from '@/lib/api';

export const payslipKeys = {
  all: ['payslips'],
  list: (params) => ['payslips', 'list', params],
  detail: (id) => ['payslips', 'detail', id],
};

export function usePayslips(params) {
  return useQuery({
    queryKey: payslipKeys.list(params),
    queryFn: () => http.get('/payslips', cleanParams(params)),
    placeholderData: keepPreviousData,
  });
}

export function usePayslip(id) {
  return useQuery({
    queryKey: payslipKeys.detail(id),
    queryFn: () => http.get(`/payslips/${id}`).then((d) => d.payslip),
    enabled: Boolean(id),
  });
}

/** Suggested salary components for a new payslip (last payslip, else company defaults). */
export function usePayslipDefaults({ employee, company }, options = {}) {
  return useQuery({
    queryKey: ['payslips', 'defaults', employee, company],
    queryFn: () => http.get('/payslips/defaults', cleanParams({ employee, company })),
    enabled: Boolean(employee),
    ...options,
  });
}

function usePayslipMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payslipKeys.all });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export const useCreatePayslip = () => usePayslipMutation((body) => http.post('/payslips', body).then((d) => d.payslip));

export const useUpdatePayslip = () =>
  usePayslipMutation(({ id, ...body }) => http.put(`/payslips/${id}`, body).then((d) => d.payslip));

export const useDeletePayslip = () => usePayslipMutation((id) => http.delete(`/payslips/${id}`));

export const fetchPayslipPdf = (id) => getBlob(`/payslips/${id}/pdf`);

export async function downloadPayslipPdf(id, payslipNumber) {
  downloadBlob(await getBlob(`/payslips/${id}/pdf`, { download: true }), `${payslipNumber}.pdf`);
}
