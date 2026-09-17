import { Download, Ellipsis, Eye, FileText, FilterX, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
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
  Table,
  Td,
  Th,
  THead,
  Tr,
  UserCell,
} from '@/components/ui';
import { usePermissions } from '@/features/auth/usePermissions';
import { useCompanies } from '@/features/settings/api';
import { useEmployeeOptions } from '@/features/employees/api';
import { useDebouncedValue, useDocumentTitle, useQueryState } from '@/hooks';
import { formatDate, formatDateRange } from '@/lib/dates';
import { formatCurrency, fullName } from '@/lib/utils';
import { downloadPayslipPdf, useDeletePayslip, usePayslips } from './api';

const DEFAULTS = { search: '', employee: '', company: '', from: '', to: '', page: 1, sortBy: 'payDate', sortOrder: 'desc' };

export default function PayslipsPage() {
  useDocumentTitle('Payslips');
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [filters, setFilters] = useQueryState(DEFAULTS);
  const [searchInput, setSearchInput] = useState(filters.search);
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data, isPending, isError, error, refetch, isFetching } = usePayslips({ ...filters, limit: 15 });
  const employees = useEmployeeOptions({ enabled: can('employees', 'view') });
  const companies = useCompanies();
  const removePayslip = useDeletePayslip();

  useEffect(() => {
    if (debouncedSearch !== filters.search) setFilters({ search: debouncedSearch });
  }, [debouncedSearch, filters.search, setFilters]);

  const sortProps = (field) => ({
    sortable: true,
    sortDirection: filters.sortBy === field ? filters.sortOrder : undefined,
    onSort: () => setFilters({ sortBy: field, sortOrder: filters.sortBy === field && filters.sortOrder === 'desc' ? 'asc' : 'desc' }),
  });

  const download = async (payslip) => {
    try {
      await downloadPayslipPdf(payslip.id, payslip.payslipNumber);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const confirmDelete = async () => {
    try {
      await removePayslip.mutateAsync(deleteTarget.id);
      toast.success('Payslip deleted');
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const hasFilters = Boolean(filters.search || filters.employee || filters.company || filters.from || filters.to);

  return (
    <>
      <PageHeader
        title="Payslips"
        description="Generate and manage employee payslips."
        actions={
          can('payslips', 'create') && (
            <Button as={Link} to="/payslips/new" leftIcon={Plus}>
              Generate payslip
            </Button>
          )
        }
      />

      <Card>
        <div className="grid gap-2.5 border-b border-slate-100 px-5 py-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))_auto]">
          <Input
            leftIcon={Search}
            placeholder="Search number or employee…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search payslips"
          />
          <Select aria-label="Employee" value={filters.employee} onChange={(e) => setFilters({ employee: e.target.value })} placeholder="All employees">
            {(employees.data ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {fullName(u)}
              </option>
            ))}
          </Select>
          <Select aria-label="Company" value={filters.company} onChange={(e) => setFilters({ company: e.target.value })} placeholder="All companies">
            {(companies.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Input type="date" aria-label="Paid from" value={filters.from} onChange={(e) => setFilters({ from: e.target.value })} />
          <Input type="date" aria-label="Paid to" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilters({ to: e.target.value })} />
          <Button
            variant="ghost"
            leftIcon={FilterX}
            disabled={!hasFilters}
            onClick={() => {
              setSearchInput('');
              setFilters({ search: '', employee: '', company: '', from: '', to: '' });
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
            icon={FileText}
            title={hasFilters ? 'No payslips match your filters' : 'No payslips yet'}
            description={hasFilters ? 'Try a different search or clear the filters.' : 'Generate a payslip to get started.'}
            action={
              !hasFilters &&
              can('payslips', 'create') && (
                <Button as={Link} to="/payslips/new" leftIcon={Plus}>
                  Generate payslip
                </Button>
              )
            }
          />
        ) : (
          <div className={isFetching ? 'opacity-70 transition-opacity' : undefined}>
            <Table>
              <THead>
                <tr>
                  <Th>Employee</Th>
                  <Th {...sortProps('payslipNumber')}>Payslip No.</Th>
                  <Th>Salary period</Th>
                  <Th {...sortProps('payDate')}>Pay date</Th>
                  <Th align="right">Gross</Th>
                  <Th align="right" {...sortProps('netPay')}>
                    Net pay
                  </Th>
                  <Th align="right">
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </THead>
              <tbody>
                {data.items.map((payslip) => (
                  <Tr key={payslip.id} onClick={() => navigate(`/payslips/${payslip.id}`)}>
                    <Td>
                      <UserCell
                        user={payslip.employee ?? { firstName: payslip.employeeSnapshot?.name }}
                        subtitle={payslip.employeeSnapshot?.employeeId}
                      />
                    </Td>
                    <Td className="font-mono text-xs text-slate-600">{payslip.payslipNumber}</Td>
                    <Td className="whitespace-nowrap">{formatDateRange(payslip.periodStart, payslip.periodEnd)}</Td>
                    <Td className="whitespace-nowrap text-slate-600">{formatDate(payslip.payDate)}</Td>
                    <Td align="right" className="tabular">
                      {formatCurrency(payslip.grossEarnings, payslip.currency)}
                    </Td>
                    <Td align="right" className="font-semibold text-slate-900 tabular">
                      {formatCurrency(payslip.netPay, payslip.currency)}
                    </Td>
                    <Td align="right">
                      <div onClick={(e) => e.stopPropagation()}>
                        <Menu
                          trigger={
                            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${payslip.payslipNumber}`}>
                              <Ellipsis size={17} />
                            </Button>
                          }
                        >
                          <MenuItem icon={Eye} onSelect={() => navigate(`/payslips/${payslip.id}`)}>
                            View
                          </MenuItem>
                          {can('payslips', 'download') && (
                            <MenuItem icon={Download} onSelect={() => download(payslip)}>
                              Download PDF
                            </MenuItem>
                          )}
                          {can('payslips', 'edit') && (
                            <MenuItem icon={Pencil} onSelect={() => navigate(`/payslips/${payslip.id}/edit`)}>
                              Edit
                            </MenuItem>
                          )}
                          {can('payslips', 'delete') && (
                            <>
                              <MenuSeparator />
                              <MenuItem icon={Trash2} tone="danger" onSelect={() => setDeleteTarget(payslip)}>
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
        title="Delete this payslip?"
        description={`${deleteTarget?.payslipNumber} for ${deleteTarget?.employeeSnapshot?.name} will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete payslip"
        loading={removePayslip.isPending}
        onConfirm={confirmDelete}
      />
    </>
  );
}
