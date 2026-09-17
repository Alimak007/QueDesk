import { Download, Ellipsis, Eye, FilterX, Pencil, Plus, ReceiptText, Search, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  Menu,
  MenuItem,
  MenuSeparator,
  PageHeader,
  Pagination,
  Select,
  SkeletonRows,
  StatCard,
  Table,
  Td,
  Th,
  THead,
  Tr,
} from '@/components/ui';
import { usePermissions } from '@/features/auth/usePermissions';
import { useCompanies } from '@/features/settings/api';
import { useDebouncedValue, useDocumentTitle, useQueryState } from '@/hooks';
import { formatDate } from '@/lib/dates';
import { cn, formatCurrency } from '@/lib/utils';
import { INVOICE_STATUS_MAP, INVOICE_STATUSES, downloadInvoicePdf, useDeleteInvoice, useInvoiceSummary, useInvoices } from './api';

const DEFAULTS = { search: '', company: '', status: '', from: '', to: '', page: 1, sortBy: 'invoiceDate', sortOrder: 'desc' };

export function InvoiceStatusBadge({ invoice }) {
  const meta = INVOICE_STATUS_MAP[invoice.status] ?? { label: invoice.status, tone: 'slate' };
  if (invoice.isOverdue) {
    return (
      <Badge tone="red" dot>
        Overdue
      </Badge>
    );
  }
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  );
}

export default function InvoicesPage() {
  useDocumentTitle('Invoices');
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [filters, setFilters] = useQueryState(DEFAULTS);
  const [searchInput, setSearchInput] = useState(filters.search);
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data, isPending, isError, error, refetch, isFetching } = useInvoices({ ...filters, limit: 15 });
  const summary = useInvoiceSummary();
  const companies = useCompanies();
  const removeInvoice = useDeleteInvoice();

  useEffect(() => {
    if (debouncedSearch !== filters.search) setFilters({ search: debouncedSearch });
  }, [debouncedSearch, filters.search, setFilters]);

  const sortProps = (field) => ({
    sortable: true,
    sortDirection: filters.sortBy === field ? filters.sortOrder : undefined,
    onSort: () => setFilters({ sortBy: field, sortOrder: filters.sortBy === field && filters.sortOrder === 'desc' ? 'asc' : 'desc' }),
  });

  const download = async (invoice) => {
    try {
      await downloadInvoicePdf(invoice.id, invoice.invoiceNumber);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const confirmDelete = async () => {
    try {
      await removeInvoice.mutateAsync(deleteTarget.id);
      toast.success('Invoice deleted');
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const hasFilters = Boolean(filters.search || filters.company || filters.status || filters.from || filters.to);
  const currency = companies.data?.[0]?.currency ?? 'AED';

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Raise tax invoices from your company profiles and track what is outstanding."
        actions={
          can('invoices', 'create') && (
            <Button as={Link} to="/invoices/new" leftIcon={Plus}>
              New invoice
            </Button>
          )
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Invoices" value={summary.data?.count ?? 0} icon={ReceiptText} tone="brand" loading={summary.isPending} />
        <StatCard
          label="Outstanding"
          value={formatCurrency(summary.data?.outstanding ?? 0, currency, { compact: true })}
          icon={ReceiptText}
          tone="amber"
          loading={summary.isPending}
          hint="Sent invoices not yet paid"
        />
        <StatCard
          label="Paid"
          value={formatCurrency(summary.data?.paid ?? 0, currency, { compact: true })}
          icon={ReceiptText}
          tone="green"
          loading={summary.isPending}
        />
      </div>

      <Card>
        <div className="grid gap-2.5 border-b border-slate-100 px-5 py-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))_auto]">
          <Input
            leftIcon={Search}
            placeholder="Search number, customer or PO…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search invoices"
          />
          <Select aria-label="Company" value={filters.company} onChange={(e) => setFilters({ company: e.target.value })} placeholder="All companies">
            {(companies.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select aria-label="Status" value={filters.status} onChange={(e) => setFilters({ status: e.target.value })} placeholder="Any status">
            {INVOICE_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          <Input type="date" aria-label="From date" value={filters.from} onChange={(e) => setFilters({ from: e.target.value })} />
          <Input type="date" aria-label="To date" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilters({ to: e.target.value })} />
          <Button
            variant="ghost"
            leftIcon={FilterX}
            disabled={!hasFilters}
            onClick={() => {
              setSearchInput('');
              setFilters({ search: '', company: '', status: '', from: '', to: '' });
            }}
          >
            Clear
          </Button>
        </div>

        {isPending ? (
          <SkeletonRows rows={8} />
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : data.items.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title={hasFilters ? 'No invoices match your filters' : 'No invoices yet'}
            description={hasFilters ? 'Try a different search or clear the filters.' : 'Create your first invoice to get started.'}
            action={
              !hasFilters &&
              can('invoices', 'create') && (
                <Button as={Link} to="/invoices/new" leftIcon={Plus}>
                  New invoice
                </Button>
              )
            }
          />
        ) : (
          <div className={isFetching ? 'opacity-70 transition-opacity' : undefined}>
            <Table className="min-w-[900px]">
              <THead>
                <tr>
                  <Th {...sortProps('invoiceNumber')}>Invoice</Th>
                  <Th>Company</Th>
                  <Th>Customer</Th>
                  <Th {...sortProps('invoiceDate')}>Date</Th>
                  <Th {...sortProps('dueDate')}>Due</Th>
                  <Th align="right" {...sortProps('total')}>
                    Amount
                  </Th>
                  <Th>Status</Th>
                  <Th align="right">
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </THead>
              <tbody>
                {data.items.map((invoice) => (
                  <Tr key={invoice.id} onClick={() => navigate(`/invoices/${invoice.id}`)}>
                    <Td className="font-medium text-slate-900">{invoice.invoiceNumber}</Td>
                    <Td className="max-w-40 truncate text-slate-600">{invoice.company?.name ?? '—'}</Td>
                    <Td className="max-w-48 truncate">{invoice.billTo?.name ?? '—'}</Td>
                    <Td className="whitespace-nowrap text-slate-600">{formatDate(invoice.invoiceDate)}</Td>
                    <Td className={cn('whitespace-nowrap', invoice.isOverdue ? 'font-medium text-red-600' : 'text-slate-600')}>
                      {formatDate(invoice.dueDate)}
                    </Td>
                    <Td align="right" className="font-semibold text-slate-900 tabular">
                      {formatCurrency(invoice.total, invoice.currency)}
                    </Td>
                    <Td>
                      <InvoiceStatusBadge invoice={invoice} />
                    </Td>
                    <Td align="right">
                      <div onClick={(e) => e.stopPropagation()}>
                        <Menu
                          trigger={
                            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${invoice.invoiceNumber}`}>
                              <Ellipsis size={17} />
                            </Button>
                          }
                        >
                          <MenuItem icon={Eye} onSelect={() => navigate(`/invoices/${invoice.id}`)}>
                            View
                          </MenuItem>
                          {can('invoices', 'download') && (
                            <MenuItem icon={Download} onSelect={() => download(invoice)}>
                              Download PDF
                            </MenuItem>
                          )}
                          {can('invoices', 'edit') && (
                            <MenuItem icon={Pencil} onSelect={() => navigate(`/invoices/${invoice.id}/edit`)}>
                              Edit
                            </MenuItem>
                          )}
                          {can('invoices', 'delete') && (
                            <>
                              <MenuSeparator />
                              <MenuItem icon={Trash2} tone="danger" onSelect={() => setDeleteTarget(invoice)}>
                                Delete
                              </MenuItem>
                            </>
                          )}
                        </Menu>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination pagination={data.pagination} onPageChange={(page) => setFilters({ page })} />
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this invoice?"
        description={`${deleteTarget?.invoiceNumber} will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete invoice"
        loading={removeInvoice.isPending}
        onConfirm={confirmDelete}
      />
    </>
  );
}
