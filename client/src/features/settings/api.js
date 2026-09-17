import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, cleanParams, http } from '@/lib/api';

export const settingsKeys = {
  companies: ['companies'],
  company: (id) => ['companies', id],
  audit: (params) => ['audit-logs', params],
};

export function useCompanies({ includeInactive = false } = {}) {
  return useQuery({
    queryKey: [...settingsKeys.companies, { includeInactive }],
    queryFn: () => http.get('/companies', cleanParams({ includeInactive: includeInactive || undefined })).then((d) => d.items),
    staleTime: 60_000,
  });
}

export function useCompany(id) {
  return useQuery({
    queryKey: settingsKeys.company(id),
    queryFn: () => http.get(`/companies/${id}`).then((d) => d.company),
    enabled: Boolean(id),
  });
}

function useCompanyMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (company) => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.companies });
      if (company?.id) queryClient.setQueryData(settingsKeys.company(company.id), company);
    },
  });
}

export const useCreateCompany = () => useCompanyMutation((body) => http.post('/companies', body).then((d) => d.company));

export const useUpdateCompany = () =>
  useCompanyMutation(({ id, ...body }) => http.patch(`/companies/${id}`, body).then((d) => d.company));

export const useDeleteCompany = () => useCompanyMutation((id) => http.delete(`/companies/${id}`));

/** Uploads a logo or signature image for a company. */
export function useUploadCompanyAsset() {
  return useCompanyMutation(({ id, kind, file }) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/companies/${id}/${kind}`, form).then((res) => res.data.data.company);
  });
}

export const useRemoveCompanyAsset = () =>
  useCompanyMutation(({ id, kind }) => http.delete(`/companies/${id}/${kind}`).then((d) => d.company));

/** Cache-busted URL for a company image; `updatedAt` keeps previews fresh after re-upload. */
export const companyAssetUrl = (company, kind) =>
  company?.[kind] ? `/api/companies/${company.id}/${kind}?v=${encodeURIComponent(company.updatedAt ?? '')}` : null;

export function useAuditLogs(params) {
  return useQuery({
    queryKey: settingsKeys.audit(params),
    queryFn: () => http.get('/audit-logs', cleanParams(params)),
    placeholderData: keepPreviousData,
  });
}
