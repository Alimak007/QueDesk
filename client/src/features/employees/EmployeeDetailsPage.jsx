import { ArrowLeft, BriefcaseBusiness, CalendarDays, ClipboardList, Hash, KeyRound, Mail, Pencil, Phone, Plane, Trash2, UserCheck, UserRoundX } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Pagination, Skeleton, SkeletonRows, Table, Tabs, Td, Th, THead, Tr } from '@/components/ui';
import { ReportCard } from '@/features/daily-status/ReportCard';
import { useStatusReports } from '@/features/daily-status/api';
import { StatusFormModal } from '@/features/daily-status/StatusFormModal';
import { useLeaves } from '@/features/leaves/api';
import { LeaveStatusBadge, LeaveTypeLabel } from '@/features/leaves/components';
import { formatLeaveDays } from '@/features/leaves/utils';
import { LeaveDetailsSheet } from '@/features/leaves/LeaveDetailsSheet';
import { LeaveFormModal } from '@/features/leaves/LeaveFormModal';
import { useDocumentTitle } from '@/hooks';
import { formatDate, formatDateRange, timeAgo } from '@/lib/dates';
import { fullName } from '@/lib/utils';
import { useEmployee } from './api';
import { EmployeeStatusBadge, RoleBadge } from './EmployeesPage';
import { useEmployeeActions } from './useEmployeeActions';

function InfoItem({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Icon size={15} />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="truncate text-sm font-medium text-slate-800">{children || '—'}</p>
      </div>
    </div>
  );
}

function EmployeeLeaves({ employeeId }) {
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);
  const [editing, setEditing] = useState(null);
  const { data, isPending, isError, error, refetch } = useLeaves({ employee: employeeId, page, limit: 8 });

  if (isPending) return <SkeletonRows rows={4} />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  if (!data.items.length) return <EmptyState compact icon={Plane} title="No leave requests" description="This employee hasn’t applied for leave yet." />;

  return (
    <>
      <Table>
        <THead>
          <tr>
            <Th>Dates</Th>
            <Th>Type</Th>
            <Th>Duration</Th>
            <Th>Status</Th>
            <Th>Requested</Th>
          </tr>
        </THead>
        <tbody>
          {data.items.map((leave) => (
            <Tr key={leave.id} onClick={() => setOpenId(leave.id)}>
              <Td className="font-medium text-slate-900">{formatDateRange(leave.startDate, leave.endDate)}</Td>
              <Td>
                <LeaveTypeLabel type={leave.type} />
              </Td>
              <Td>{formatLeaveDays(leave)}</Td>
              <Td>
                <LeaveStatusBadge status={leave.status} />
              </Td>
              <Td className="text-slate-500">{timeAgo(leave.createdAt)}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <Pagination pagination={data.pagination} onPageChange={setPage} />
      <LeaveDetailsSheet
        leaveId={openId}
        open={Boolean(openId)}
        onOpenChange={(open) => !open && setOpenId(null)}
        onEdit={(leave) => {
          setOpenId(null);
          setEditing(leave);
        }}
      />
      <LeaveFormModal open={Boolean(editing)} leave={editing} onOpenChange={(open) => !open && setEditing(null)} />
    </>
  );
}

function EmployeeReports({ employeeId }) {
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const { data, isPending, isError, error, refetch } = useStatusReports({ employee: employeeId, page, limit: 5 });

  if (isPending) return <SkeletonRows rows={3} />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  if (!data.items.length) return <EmptyState compact icon={ClipboardList} title="No status reports" description="Reports submitted by this employee will appear here." />;

  return (
    <div className="p-5">
      <div className="space-y-4">
        {data.items.map((report) => (
          <ReportCard key={report.id} report={report} onEdit={setEditing} />
        ))}
      </div>
      <Pagination pagination={data.pagination} onPageChange={setPage} className="mt-4 border-t-0 px-0" />
      <StatusFormModal open={Boolean(editing)} report={editing} onOpenChange={(open) => !open && setEditing(null)} />
    </div>
  );
}

export default function EmployeeDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('leaves');
  const { data, isPending, isError, error, refetch } = useEmployee(id);
  const actions = useEmployeeActions({ onDeleted: () => navigate('/employees', { replace: true }) });
  const employee = data?.user;
  useDocumentTitle(employee ? fullName(employee) : 'Employee');

  return (
    <>
      <Link to="/employees" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900">
        <ArrowLeft size={16} /> All employees
      </Link>

      {isPending ? (
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="size-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        </Card>
      ) : isError ? (
        <Card>
          <ErrorState error={error} onRetry={refetch} />
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card className="overflow-hidden">
              <div className="h-20 bg-gradient-to-r from-brand-500 via-brand-600 to-sky-500" />
              <div className="-mt-10 px-6 pb-6">
                <Avatar user={employee} size="xl" className="ring-4" />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-semibold tracking-tight text-slate-900">{fullName(employee)}</h1>
                </div>
                <p className="text-sm text-slate-500">{employee.designation || 'No designation'}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <EmployeeStatusBadge status={employee.status} />
                  <RoleBadge role={employee.role} />
                </div>

                <div className="mt-6 space-y-4">
                  <InfoItem icon={Hash} label="Employee ID">
                    <span className="font-mono">{employee.employeeId}</span>
                  </InfoItem>
                  <InfoItem icon={Mail} label="Email">
                    <a href={`mailto:${employee.email}`} className="hover:text-brand-700">
                      {employee.email}
                    </a>
                  </InfoItem>
                  <InfoItem icon={Phone} label="Phone">
                    {employee.phone}
                  </InfoItem>
                  <InfoItem icon={BriefcaseBusiness} label="Department">
                    {employee.department}
                  </InfoItem>
                  <InfoItem icon={CalendarDays} label="Joined">
                    {employee.joiningDate && formatDate(employee.joiningDate, 'd MMMM yyyy')}
                  </InfoItem>
                </div>

                <p className="mt-6 text-xs text-slate-400">
                  {employee.lastLoginAt ? `Last signed in ${timeAgo(employee.lastLoginAt)}` : 'Has not signed in yet'}
                </p>

                <div className="mt-5 grid grid-cols-2 gap-2">
                  <Button variant="secondary" size="sm" leftIcon={Pencil} onClick={() => actions.edit(employee)}>
                    Edit
                  </Button>
                  <Button variant="secondary" size="sm" leftIcon={KeyRound} onClick={() => actions.resetPassword(employee)}>
                    Password
                  </Button>
                  <Button
                    variant={employee.status === 'active' ? 'danger-soft' : 'success-soft'}
                    size="sm"
                    leftIcon={employee.status === 'active' ? UserRoundX : UserCheck}
                    disabled={actions.isSelf(employee)}
                    onClick={() => actions.toggleStatus(employee)}
                  >
                    {employee.status === 'active' ? 'Deactivate' : 'Reactivate'}
                  </Button>
                  <Button variant="ghost" size="sm" leftIcon={Trash2} disabled={actions.isSelf(employee)} onClick={() => actions.remove(employee)}>
                    Delete
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="grid grid-cols-3 divide-x divide-slate-100">
              {[
                { label: 'Leaves', value: data.history.leaves },
                { label: 'Reports', value: data.history.reports },
                { label: 'Leads', value: data.history.leads },
              ].map((s) => (
                <div key={s.label} className="px-4 py-4 text-center">
                  <p className="text-xl font-semibold text-slate-900 tabular">{s.value}</p>
                  <p className="text-xs text-slate-500">{s.label}</p>
                </div>
              ))}
            </Card>
          </div>

          <Card className="min-w-0">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <Tabs
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'leaves', label: 'Leave history', icon: Plane, count: data.history.leaves },
                  { value: 'reports', label: 'Daily status', icon: ClipboardList, count: data.history.reports },
                ]}
              />
              {employee.status === 'inactive' && <Badge tone="amber">Account deactivated</Badge>}
            </div>
            {tab === 'leaves' ? <EmployeeLeaves employeeId={employee.id} /> : <EmployeeReports employeeId={employee.id} />}
          </Card>
        </div>
      )}

      {actions.dialogs}
    </>
  );
}
