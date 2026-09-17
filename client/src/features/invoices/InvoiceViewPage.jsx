import { ArrowLeft, CircleCheck, Download, Pencil, Send, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { Button, Card, CardHeader, ConfirmDialog, DescriptionList, ErrorState, PageHeader, Skeleton } from '@/components/ui';
import { usePermissions } from '@/features/auth/usePermissions';
import { PdfPreview } from '@/features/documents/PdfPreview';
import { useDocumentTitle } from '@/hooks';
import { formatDate } from '@/lib/dates';
import { formatCurrency } from '@/lib/utils';
import {
  downloadInvoicePdf,
  fetchInvoicePdf,
  useDeleteInvoice,
  useInvoice,
  useUpdateInvoiceStatus,
} from './api';
import { InvoiceStatusBadge } from './InvoicesPage';

export default function InvoiceViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const { data: invoice, isPending, isError, error, refetch } = useInvoice(id);
  const updateStatus = useUpdateInvoiceStatus();
  const removeInvoice = useDeleteInvoice();
  const [confirmDelete, setConfirmDelete] = useState(false);

  useDocumentTitle(invoice ? invoice.invoiceNumber : 'Invoice');

  const fetcher = useCallback(() => fetchInvoicePdf(id), [id]);

  const download = async () => {
    try {
      await downloadInvoicePdf(id, invoice.invoiceNumber);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const setStatus = async (status) => {
    try {
      await updateStatus.mutateAsync({ id, status });
      toast.success(status === 'paid' ? 'Marked as paid' : `Invoice marked as ${status}`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    try {
      await removeInvoice.mutateAsync(id);
      toast.success('Invoice deleted');
      navigate('/invoices', { replace: true });
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (isPending) return <Skeleton className="h-96 w-full rounded-2xl" />;
  if (isError) {
    return (
      <Card>
        <ErrorState error={error} onRetry={refetch} />
      </Card>
    );
  }

  const currency = invoice.currency;
  const canEdit = can('invoices', 'edit');

  return (
    <>
      <Link to="/invoices" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900">
        <ArrowLeft size={16} /> Invoices
      </Link>

      <PageHeader
        title={invoice.invoiceNumber}
        description={`${invoice.billTo?.name ?? 'Customer'} · ${formatDate(invoice.invoiceDate)}`}
        actions={
          <>
            {can('invoices', 'delete') && (
              <Button variant="danger-soft" leftIcon={Trash2} onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            )}
            {canEdit && invoice.status === 'draft' && (
              <Button variant="secondary" leftIcon={Send} loading={updateStatus.isPending} onClick={() => setStatus('sent')}>
                Mark as sent
              </Button>
            )}
            {canEdit && invoice.balanceDue > 0 && invoice.status !== 'cancelled' && (
              <Button variant="success-soft" leftIcon={CircleCheck} loading={updateStatus.isPending} onClick={() => setStatus('paid')}>
                Mark as paid
              </Button>
            )}
            {canEdit && (
              <Button as={Link} to={`/invoices/${id}/edit`} variant="secondary" leftIcon={Pencil}>
                Edit
              </Button>
            )}
            {can('invoices', 'download') && (
              <Button leftIcon={Download} onClick={download}>
                Download PDF
              </Button>
            )}
          </>
        }
      >
        <div className="mt-3">
          <InvoiceStatusBadge invoice={invoice} />
        </div>
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        {can('invoices', 'download') ? (
          <PdfPreview fetcher={fetcher} queryKey={['invoice-pdf', id]} onDownload={download} />
        ) : (
          <Card className="p-6">
            <p className="text-sm text-slate-500">You do not have permission to download this invoice.</p>
          </Card>
        )}

        <div className="space-y-6">
          <Card>
            <CardHeader title="Summary" />
            <dl className="space-y-2.5 px-5 pb-5 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-600">Sub total</dt>
                <dd className="tabular">{formatCurrency(invoice.subTotal, currency)}</dd>
              </div>
              {invoice.discountTotal > 0 && (
                <div className="flex justify-between">
                  <dt className="text-slate-600">Discount</dt>
                  <dd className="tabular">− {formatCurrency(invoice.discountTotal, currency)}</dd>
                </div>
              )}
              {invoice.taxSummary.map((tax) => (
                <div key={tax.label} className="flex justify-between">
                  <dt className="text-slate-600">{tax.label}</dt>
                  <dd className="tabular">{formatCurrency(tax.tax, currency)}</dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between border-t border-slate-100 pt-3">
                <dt className="font-semibold text-slate-900">Total</dt>
                <dd className="text-lg font-semibold text-slate-900 tabular">{formatCurrency(invoice.total, currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Amount paid</dt>
                <dd className="tabular">{formatCurrency(invoice.amountPaid, currency)}</dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-slate-100 pt-3">
                <dt className="font-semibold text-slate-900">Balance due</dt>
                <dd className="text-lg font-semibold text-brand-700 tabular">{formatCurrency(invoice.balanceDue, currency)}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Details" />
            <div className="px-5 pb-5">
              <DescriptionList
                columns={1}
                items={[
                  { label: 'From', value: invoice.seller?.name ?? invoice.company?.name },
                  { label: 'Bill to', value: invoice.billTo?.name },
                  { label: 'Customer TRN', value: invoice.billTo?.taxNumber || '—' },
                  { label: 'Invoice date', value: formatDate(invoice.invoiceDate) },
                  { label: 'Due date', value: formatDate(invoice.dueDate) },
                  { label: 'Payment terms', value: invoice.paymentTerms || '—' },
                  { label: 'P.O. number', value: invoice.poNumber || '—' },
                  { label: 'Line items', value: `${invoice.items.length}` },
                ]}
              />
            </div>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this invoice?"
        description={`${invoice.invoiceNumber} will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete invoice"
        loading={removeInvoice.isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}
