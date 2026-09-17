import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cleanParams, downloadBlob, getBlob, http } from '@/lib/api';

export const invoiceKeys = {
  all: ['invoices'],
  list: (params) => ['invoices', 'list', params],
  detail: (id) => ['invoices', 'detail', id],
};

export function useInvoices(params) {
  return useQuery({
    queryKey: invoiceKeys.list(params),
    queryFn: () => http.get('/invoices', cleanParams(params)),
    placeholderData: keepPreviousData,
  });
}

export function useInvoice(id) {
  return useQuery({
    queryKey: invoiceKeys.detail(id),
    queryFn: () => http.get(`/invoices/${id}`).then((d) => d.invoice),
    enabled: Boolean(id),
  });
}

/** Company-driven defaults: dates, terms, tax rate and the next invoice number. */
export function useInvoiceDefaults(company) {
  return useQuery({
    queryKey: ['invoices', 'defaults', company],
    queryFn: () => http.get('/invoices/defaults', { company }),
    enabled: Boolean(company),
  });
}

/** Customer picker for the invoice form (available to invoice creators). */
export function useInvoiceCustomers() {
  return useQuery({
    queryKey: ['invoices', 'lookups', 'customers'],
    queryFn: () => http.get('/invoices/lookups/customers').then((d) => d.items),
    staleTime: 60_000,
  });
}

export function useInvoiceSummary() {
  return useQuery({ queryKey: ['invoices', 'summary'], queryFn: () => http.get('/invoices/summary') });
}

function useInvoiceMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.all });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      if (invoice?.id) queryClient.setQueryData(invoiceKeys.detail(invoice.id), invoice);
    },
  });
}

export const useCreateInvoice = () => useInvoiceMutation((body) => http.post('/invoices', body).then((d) => d.invoice));

export const useUpdateInvoice = () =>
  useInvoiceMutation(({ id, ...body }) => http.put(`/invoices/${id}`, body).then((d) => d.invoice));

export const useUpdateInvoiceStatus = () =>
  useInvoiceMutation(({ id, ...body }) => http.patch(`/invoices/${id}/status`, body).then((d) => d.invoice));

export const useDeleteInvoice = () => useInvoiceMutation((id) => http.delete(`/invoices/${id}`));

export const fetchInvoicePdf = (id) => getBlob(`/invoices/${id}/pdf`);

export async function downloadInvoicePdf(id, invoiceNumber) {
  downloadBlob(await getBlob(`/invoices/${id}/pdf`, { download: true }), `${invoiceNumber}.pdf`);
}

export const INVOICE_STATUSES = [
  { value: 'draft', label: 'Draft', tone: 'slate' },
  { value: 'sent', label: 'Sent', tone: 'blue' },
  { value: 'paid', label: 'Paid', tone: 'green' },
  { value: 'cancelled', label: 'Cancelled', tone: 'red' },
];

export const INVOICE_STATUS_MAP = Object.fromEntries(INVOICE_STATUSES.map((s) => [s.value, s]));
