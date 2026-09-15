import { Check, FilterX, Plane, X } from 'lucide-react';
import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Hint,
  Input,
  PageHeader,
  Pagination,
  Select,
  SkeletonRows,
  Table,
  Tabs,
  Td,
  Th,
  THead,
  Tr,
  UserCell,
} from '@/components/ui';
import { useEmployeeOptions } from '@/features/employees/api';
import { useDocumentTitle, useQueryState, useUrlParam } from '@/hooks';
import { LEAVE_STATUSES, LEAVE_TYPES } from '@/lib/constants';
import { formatDateRange, timeAgo } from '@/lib/dates';
import { fullName } from '@/lib/utils';
import { useLeaves } from './api';
import { LeaveStatusBadge, LeaveTypeLabel } from './components';
import { formatLeaveDays } from './utils';
import { LeaveDetailsSheet } from './LeaveDetailsSheet';
import { LeaveFormModal } from './LeaveFormModal';

const DEFAULTS = { status: 'pending', employee: '', type: '', from: '', to: '', page: 1 };

export default function LeaveManagementPage() {
  useDocumentTitle('Leave Management');
  const [filters, setFilters] = useQueryState(DEFAULTS);
  const [detailsId, setDetailsId] = useUrlParam('leave');
  const [reviewMode, setReviewMode] = useState(null);
  const openDetails = (id, mode = null) => {
    setReviewMode(mode);
    setDetailsId(id);
  };
  const [editLeave, setEditLeave] = useState(null);

  const { data, isPending, isError, error, refetch, isFetching } = useLeaves({
    ...filters,
    limit: 15,
    sortBy: filters.status === 'pending' ? 'startDate' : 'createdAt',
    sortOrder: filters.status === 'pending' ? 'asc' : 'desc',
  });
  const pendingCount = useLeaves({ status: 'pending', limit: 1 }).data?.pagination.total;
  const employees = useEmployeeOptions();

  const hasExtraFilters = Boolean(filters.employee || filters.type || filters.from || filters.to);

  return (
    <>
      <PageHeader title="Leave Management" description="Review, approve and track leave requests across the organisation." />

      <Card>
        <div className="space-y-3 border-b border-slate-100 px-5 py-4">
          <Tabs
            value={filters.status}
            onChange={(status) => setFilters({ status })}
            options={[
              ...LEAVE_STATUSES.map((s) => ({ ...s, count: s.value === 'pending' ? pendingCount : undefined })),
              { value: '', label: 'All requests' },
            ]}
          />
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <Select
              aria-label="Filter by employee"
              value={filters.employee}
              onChange={(e) => setFilters({ employee: e.target.value })}
              placeholder="All employees"
            >
              {(employees.data ?? [])
                .filter((u) => u.role === 'employee')
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {fullName(u)} {u.status === 'inactive' ? '(inactive)' : ''}
                  </option>
                ))}
            </Select>
            <Select aria-label="Filter by type" value={filters.type} onChange={(e) => setFilters({ type: e.target.value })} placeholder="All types">
              {LEAVE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
            <Input type="date" aria-label="From date" value={filters.from} onChange={(e) => setFilters({ from: e.target.value })} />
            <Input type="date" aria-label="To date" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilters({ to: e.target.value })} />
            <Button
              variant="ghost"
              leftIcon={FilterX}
              disabled={!hasExtraFilters}
              onClick={() => setFilters({ employee: '', type: '', from: '', to: '' })}
            >
              Clear
            </Button>
          </div>
        </div>

        {isPending ? (
          <SkeletonRows rows={6} />
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : data.items.length === 0 ? (
          <EmptyState
            icon={Plane}
            title={filters.status === 'pending' && !hasExtraFilters ? 'No pending requests' : 'No leave requests found'}
            description={
              filters.status === 'pending' && !hasExtraFilters
                ? 'You’re all caught up. New requests will appear here.'
                : 'Try adjusting the filters to see more results.'
            }
          />
        ) : (
          <div className={isFetching ? 'opacity-70 transition-opacity' : undefined}>
            <Table>
              <THead>
                <tr>
                  <Th>Employee</Th>
                  <Th>Type</Th>
                  <Th>Dates</Th>
                  <Th>Duration</Th>
                  <Th>Status</Th>
                  <Th>Requested</Th>
                  <Th align="right">
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </THead>
              <tbody>
                {data.items.map((leave) => (
                  <Tr key={leave.id} onClick={() => openDetails(leave.id)}>
                    <Td>
                      <UserCell user={leave.employee} subtitle={leave.employee?.department || leave.employee?.designation} />
                    </Td>
                    <Td>
                      <LeaveTypeLabel type={leave.type} />
                    </Td>
                    <Td className="whitespace-nowrap font-medium text-slate-900">{formatDateRange(leave.startDate, leave.endDate)}</Td>
                    <Td className="whitespace-nowrap">
                      {leave.isHalfDay ? <Badge tone="blue">Half day</Badge> : <span className="tabular">{formatLeaveDays(leave)}</span>}
                    </Td>
                    <Td>
                      <LeaveStatusBadge status={leave.status} />
                    </Td>
                    <Td className="whitespace-nowrap text-slate-500">{timeAgo(leave.createdAt)}</Td>
                    <Td align="right">
                      {leave.status === 'pending' && (
                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Hint content="Reject">
                            <Button
                              variant="danger-soft"
                              size="icon-sm"
                              aria-label={`Reject leave for ${fullName(leave.employee)}`}
                              onClick={() => openDetails(leave.id, 'rejected')}
                            >
                              <X size={16} />
                            </Button>
                          </Hint>
                          <Hint content="Approve">
                            <Button
                              variant="success-soft"
                              size="icon-sm"
                              aria-label={`Approve leave for ${fullName(leave.employee)}`}
                              onClick={() => openDetails(leave.id, 'approved')}
                            >
                              <Check size={16} />
                            </Button>
                          </Hint>
                        </div>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination pagination={data.pagination} onPageChange={(page) => setFilters({ page })} />
          </div>
        )}
      </Card>

      <LeaveDetailsSheet
        leaveId={detailsId}
        open={Boolean(detailsId)}
        initialReviewMode={reviewMode}
        onOpenChange={(open) => !open && openDetails(null)}
        onEdit={(leave) => {
          openDetails(null);
          setEditLeave(leave);
        }}
      />
      <LeaveFormModal open={Boolean(editLeave)} leave={editLeave} onOpenChange={(open) => !open && setEditLeave(null)} />
    </>
  );
}
