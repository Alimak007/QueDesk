import { CalendarCheck2, CircleCheck, Hourglass, Plane, Plus } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Pagination, SkeletonRows, StatCard, Table, Tabs, Td, Th, THead, Tr } from '@/components/ui';
import { usePermissions } from '@/features/auth/usePermissions';
import { useDocumentTitle, useQueryState, useUrlParam } from '@/hooks';
import { LEAVE_STATUSES, LEAVE_TYPE_MAP } from '@/lib/constants';
import { formatDate, formatDateRange } from '@/lib/dates';
import { useLeaveBalances, useLeaves, useLeaveSummary } from './api';
import { LeaveStatusBadge, LeaveTypeLabel } from './components';
import { formatLeaveDays } from './utils';
import { LeaveDetailsSheet } from './LeaveDetailsSheet';
import { LeaveFormModal } from './LeaveFormModal';

export default function MyLeavePage({ embedded = false }) {
  useDocumentTitle(embedded ? undefined : 'My Leave');
  const { can } = usePermissions();
  const canApply = can('leave', 'create');
  const [filters, setFilters] = useQueryState({ status: '', page: 1 });
  const [action, setAction] = useUrlParam('action');
  const [detailsId, setDetailsId] = useUrlParam('leave');
  const [formState, setFormState] = useState({ open: false, leave: null });
  // `?action=new` (dashboard quick action) opens the form directly.
  const formOpen = formState.open || action === 'new';

  // `scope: mine` keeps this view personal even for approvers, who otherwise see everyone.
  const { data, isPending, isError, error, refetch } = useLeaves({ ...filters, scope: 'mine', limit: 10 });
  const summary = useLeaveSummary({ scope: 'mine' });
  const balances = useLeaveBalances();

  const s = summary.data;
  const byStatus = s?.byStatus ?? {};

  return (
    <>
      {embedded ? (
        canApply && (
          <div className="mb-4 flex justify-end">
            <Button leftIcon={Plus} onClick={() => setFormState({ open: true, leave: null })}>
              Apply leave
            </Button>
          </div>
        )
      ) : (
        <PageHeader
          title="My Leave"
          description="Apply for leave and track the status of your requests."
          actions={
            canApply && (
              <Button leftIcon={Plus} onClick={() => setFormState({ open: true, leave: null })}>
                Apply leave
              </Button>
            )
          }
        />
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={`Leave taken in ${s?.year ?? new Date().getFullYear()}`}
          value={`${s?.approvedDays ?? 0} ${s?.approvedDays === 1 ? 'day' : 'days'}`}
          icon={CalendarCheck2}
          tone="brand"
          loading={summary.isPending}
        />
        <StatCard label="Pending requests" value={byStatus.pending ?? 0} icon={Hourglass} tone="amber" loading={summary.isPending} />
        <StatCard label="Approved requests" value={byStatus.approved ?? 0} icon={CircleCheck} tone="green" loading={summary.isPending} />
        <Card className="p-5">
          <p className="text-[13px] font-medium text-slate-500">Balance by type</p>
          <ul className="mt-3 space-y-1.5">
            {(balances.data?.types ?? []).map((row) => {
              const type = LEAVE_TYPE_MAP[row.type];
              return (
                <li key={row.type} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 truncate text-slate-600">
                    <span className={`size-2 shrink-0 rounded-full ${type?.dot ?? 'bg-slate-300'}`} /> {type?.short ?? row.type}
                  </span>
                  {row.allowed === null ? (
                    <span className="tabular text-slate-500">
                      {row.used} used <span className="text-slate-400">· no limit</span>
                    </span>
                  ) : (
                    <span className="tabular">
                      <span className={row.remaining < 0 ? 'font-semibold text-red-600' : 'font-semibold text-slate-900'}>
                        {row.remaining}
                      </span>
                      <span className="text-slate-400"> / {row.allowed} left</span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <Tabs
            value={filters.status}
            onChange={(status) => setFilters({ status })}
            options={[{ value: '', label: 'All' }, ...LEAVE_STATUSES]}
          />
        </div>

        {isPending ? (
          <SkeletonRows rows={5} />
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : data.items.length === 0 ? (
          <EmptyState
            icon={Plane}
            title={filters.status ? 'No leave requests with this status' : 'No leave requests yet'}
            description="When you apply for leave, your requests and their status will appear here."
            action={
              canApply && (
                <Button leftIcon={Plus} onClick={() => setFormState({ open: true, leave: null })}>
                  Apply leave
                </Button>
              )
            }
          />
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  <Th>Dates</Th>
                  <Th>Type</Th>
                  <Th>Duration</Th>
                  <Th>Reason</Th>
                  <Th>Status</Th>
                  <Th>Applied</Th>
                </tr>
              </THead>
              <tbody>
                {data.items.map((leave) => (
                  <Tr key={leave.id} onClick={() => setDetailsId(leave.id)}>
                    <Td className="font-medium text-slate-900">{formatDateRange(leave.startDate, leave.endDate)}</Td>
                    <Td>
                      <LeaveTypeLabel type={leave.type} />
                    </Td>
                    <Td>
                      {leave.isHalfDay ? <Badge tone="blue">Half day</Badge> : <span className="tabular">{formatLeaveDays(leave)}</span>}
                    </Td>
                    <Td className="max-w-xs">
                      <span className="line-clamp-1">{leave.reason}</span>
                    </Td>
                    <Td>
                      <LeaveStatusBadge status={leave.status} />
                    </Td>
                    <Td className="whitespace-nowrap text-slate-500">{formatDate(leave.createdAt, 'd MMM yyyy')}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination pagination={data.pagination} onPageChange={(page) => setFilters({ page })} />
          </>
        )}
      </Card>

      <LeaveFormModal
        open={formOpen}
        leave={formState.leave}
        onOpenChange={(open) => {
          setFormState((prev) => ({ ...prev, open }));
          if (!open) setAction(null);
        }}
      />
      <LeaveDetailsSheet
        leaveId={detailsId}
        open={Boolean(detailsId)}
        onOpenChange={(open) => !open && setDetailsId(null)}
        onEdit={(leave) => {
          setDetailsId(null);
          setFormState({ open: true, leave });
        }}
      />
    </>
  );
}
