import { ArrowLeft, Download, Pencil, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { Button, Card, CardHeader, ConfirmDialog, DescriptionList, ErrorState, PageHeader, Skeleton, UserCell } from '@/components/ui';
import { usePermissions } from '@/features/auth/usePermissions';
import { PdfPreview } from '@/features/documents/PdfPreview';
import { useDocumentTitle } from '@/hooks';
import { formatDate, formatDateRange } from '@/lib/dates';
import { formatCurrency } from '@/lib/utils';
import { downloadPayslipPdf, fetchPayslipPdf, useDeletePayslip, usePayslip } from './api';

export default function PayslipViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const { data: payslip, isPending, isError, error, refetch } = usePayslip(id);
  const removePayslip = useDeletePayslip();
  const [confirmDelete, setConfirmDelete] = useState(false);

  useDocumentTitle(payslip ? payslip.payslipNumber : 'Payslip');

  const fetcher = useCallback(() => fetchPayslipPdf(id), [id]);

  const download = async () => {
    try {
      await downloadPayslipPdf(id, payslip.payslipNumber);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    try {
      await removePayslip.mutateAsync(id);
      toast.success('Payslip deleted');
      navigate('/payslips', { replace: true });
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

  const currency = payslip.currency;

  return (
    <>
      <Link to="/payslips" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900">
        <ArrowLeft size={16} /> Payslips
      </Link>

      <PageHeader
        title={payslip.payslipNumber}
        description={`${payslip.employeeSnapshot?.name} · ${formatDateRange(payslip.periodStart, payslip.periodEnd)}`}
        actions={
          <>
            {can('payslips', 'delete') && (
              <Button variant="danger-soft" leftIcon={Trash2} onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            )}
            {can('payslips', 'edit') && (
              <Button as={Link} to={`/payslips/${id}/edit`} variant="secondary" leftIcon={Pencil}>
                Edit
              </Button>
            )}
            {can('payslips', 'download') && (
              <Button leftIcon={Download} onClick={download}>
                Download PDF
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        {can('payslips', 'download') ? (
          <PdfPreview fetcher={fetcher} queryKey={['payslip-pdf', id]} onDownload={download} />
        ) : (
          <Card className="p-6">
            <p className="text-sm text-slate-500">You do not have permission to download this payslip.</p>
          </Card>
        )}

        <div className="space-y-6">
          <Card>
            <CardHeader title="Employee" />
            <div className="px-5 pb-5">
              <UserCell
                user={payslip.employee ?? { firstName: payslip.employeeSnapshot?.name }}
                subtitle={payslip.employeeSnapshot?.designation}
                size="md"
              />
              <DescriptionList
                className="mt-4"
                columns={1}
                items={[
                  { label: 'Employee ID', value: payslip.employeeSnapshot?.employeeId },
                  { label: 'Department', value: payslip.employeeSnapshot?.department || '—' },
                  {
                    label: 'Joining date',
                    value: payslip.employeeSnapshot?.joiningDate ? formatDate(payslip.employeeSnapshot.joiningDate) : '—',
                  },
                  { label: 'Company', value: payslip.company?.name },
                  { label: 'Pay date', value: formatDate(payslip.payDate) },
                ]}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Breakdown" />
            <div className="space-y-2 px-5 pb-5 text-sm">
              {payslip.earnings.map((row) => (
                <div key={`e-${row.label}`} className="flex justify-between">
                  <span className="text-slate-600">{row.label}</span>
                  <span className="tabular">{formatCurrency(row.amount, currency)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-slate-100 pt-2 font-medium">
                <span>Gross earnings</span>
                <span className="tabular">{formatCurrency(payslip.grossEarnings, currency)}</span>
              </div>
              {payslip.deductions.map((row) => (
                <div key={`d-${row.label}`} className="flex justify-between">
                  <span className="text-slate-600">{row.label}</span>
                  <span className="tabular">− {formatCurrency(row.amount, currency)}</span>
                </div>
              ))}
              <div className="flex justify-between">
                <span className="text-slate-600">Total deductions</span>
                <span className="tabular">− {formatCurrency(payslip.totalDeductions, currency)}</span>
              </div>
              <div className="flex items-baseline justify-between border-t border-slate-100 pt-3">
                <span className="font-semibold text-slate-900">Net pay</span>
                <span className="text-lg font-semibold text-slate-900 tabular">{formatCurrency(payslip.netPay, currency)}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this payslip?"
        description={`${payslip.payslipNumber} will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete payslip"
        loading={removePayslip.isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}
