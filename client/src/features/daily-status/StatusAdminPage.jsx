import { addDays, format } from 'date-fns';
import { ChevronLeft, ChevronRight, ClipboardList, Clock, FilterX, LayoutGrid, List, Palmtree, Search, UserCheck, UserX, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Select,
  Skeleton,
  StatCard,
  Tabs,
  UserCell,
} from '@/components/ui';
import { useDepartments, useEmployeeOptions } from '@/features/employees/api';
import { useDebouncedValue, useDocumentTitle, useQueryState } from '@/hooks';
import { LEAVE_TYPE_MAP } from '@/lib/constants';
import { formatDate, parseDateOnly, relativeDay, timeAgo, todayDateOnly } from '@/lib/dates';
import { cn, fullName, truncate } from '@/lib/utils';
import { useStatusReports, useTeamBoard } from './api';
import { ReportBody, ReportCard } from './ReportCard';
import { StatusFormModal } from './StatusFormModal';

function TeamBoard({ onOpenReport }) {
  const today = todayDateOnly();
  const [filters, setFilters] = useQueryState({ date: today, department: '' });
  const [show, setShow] = useState('all');
  const departments = useDepartments();
  const { data, isPending, isError, error, refetch, isFetching } = useTeamBoard(filters);

  const shiftDate = (days) => {
    const next = format(addDays(parseDateOnly(filters.date), days), 'yyyy-MM-dd');
    if (next <= today) setFilters({ date: next });
  };

  const items = (data?.items ?? []).filter((item) => {
    if (show === 'submitted') return Boolean(item.report);
    if (show === 'missing') return !item.report && !item.leave;
    if (show === 'leave') return Boolean(item.leave);
    return true;
  });

  const stats = data?.stats;
  const expected = stats ? Math.max(stats.total - stats.onLeave, 0) : 0;
  const completion = expected ? Math.round((stats.submitted / expected) * 100) : 0;

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="icon" onClick={() => shiftDate(-1)} aria-label="Previous day">
            <ChevronLeft size={18} />
          </Button>
          <div className="min-w-44 text-center">
            <p className="text-sm font-semibold text-slate-900">{relativeDay(filters.date)}</p>
            <p className="text-xs text-slate-500">{formatDate(filters.date, 'EEEE, d MMMM yyyy')}</p>
          </div>
          <Button variant="secondary" size="icon" onClick={() => shiftDate(1)} disabled={filters.date >= today} aria-label="Next day">
            <ChevronRight size={18} />
          </Button>
          <Input
            type="date"
            aria-label="Pick a date"
            value={filters.date}
            max={today}
            onChange={(e) => e.target.value && setFilters({ date: e.target.value })}
            className="ml-1 w-40"
          />
        </div>
        <div className="flex gap-2">
          <Select
            aria-label="Filter by department"
            value={filters.department}
            onChange={(e) => setFilters({ department: e.target.value })}
            placeholder="All departments"
            className="w-48"
          >
            {(departments.data ?? []).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Reports submitted" value={stats ? `${stats.submitted}/${expected}` : '—'} icon={UserCheck} tone="green" loading={isPending}
          hint={stats && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(completion, 100)}%` }} />
            </div>
          )}
        />
        <StatCard label="Not submitted" value={stats?.pending ?? '—'} icon={UserX} tone="amber" loading={isPending} />
        <StatCard label="On leave" value={stats?.onLeave ?? '—'} icon={Palmtree} tone="blue" loading={isPending} />
        <StatCard label="Active employees" value={stats?.total ?? '—'} icon={Users} tone="slate" loading={isPending} />
      </div>

      <div className="mb-4">
        <Tabs
          size="sm"
          value={show}
          onChange={setShow}
          options={[
            { value: 'all', label: 'Everyone', count: stats?.total },
            { value: 'submitted', label: 'Submitted', count: stats?.submitted },
            { value: 'missing', label: 'Not submitted', count: stats?.pending },
            { value: 'leave', label: 'On leave', count: stats?.onLeave },
          ]}
        />
      </div>

      {isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Card key={i} className="space-y-3 p-5">
              <Skeleton className="h-8 w-40 rounded-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </Card>
          ))}
        </div>
      ) : isError ? (
        <Card>
          <ErrorState error={error} onRetry={refetch} />
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState icon={Users} title="Nobody here" description="No employees match this view." />
        </Card>
      ) : (
        <div className={cn('grid gap-4 md:grid-cols-2 xl:grid-cols-3', isFetching && 'opacity-70')}>
          {items.map(({ employee, report, leave }) => (
            <Card
              key={employee.id}
              className={cn(
                'flex flex-col p-5 transition-all',
                report && 'cursor-pointer hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md',
              )}
              onClick={report ? () => onOpenReport({ ...report, employee }) : undefined}
              role={report ? 'button' : undefined}
              tabIndex={report ? 0 : undefined}
              onKeyDown={report ? (e) => e.key === 'Enter' && onOpenReport({ ...report, employee }) : undefined}
            >
              <div className="flex items-start justify-between gap-3">
                <UserCell user={employee} subtitle={employee.designation || employee.department} />
                {report ? (
                  <Badge tone="green" dot>Submitted</Badge>
                ) : leave ? (
                  <Badge tone="blue" dot>{leave.isHalfDay ? 'Half-day leave' : 'On leave'}</Badge>
                ) : (
                  <Badge tone="amber" dot>Pending</Badge>
                )}
              </div>
              <div className="mt-4 flex-1">
                {report ? (
                  <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{truncate(report.workDone, 180)}</p>
                ) : leave ? (
                  <p className="text-sm text-slate-500">{LEAVE_TYPE_MAP[leave.type]?.label ?? 'Leave'} — no report expected.</p>
                ) : (
                  <p className="text-sm text-slate-400">No report submitted {filters.date === today ? 'yet today' : 'for this day'}.</p>
                )}
              </div>
              {report && (
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <span>Submitted {timeAgo(report.createdAt)}</span>
                  {typeof report.hoursWorked === 'number' && (
                    <span className="inline-flex items-center gap-1 tabular">
                      <Clock size={12} /> {report.hoursWorked}h
                    </span>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function AllReports({ onEdit }) {
  const [filters, setFilters] = useQueryState({ employee: '', from: '', to: '', search: '', page: 1 });
  const [searchInput, setSearchInput] = useState(filters.search);
  const debouncedSearch = useDebouncedValue(searchInput, 350);
  const employees = useEmployeeOptions();
  const { data, isPending, isError, error, refetch } = useStatusReports({ ...filters, limit: 10 });

  useEffect(() => {
    if (debouncedSearch !== filters.search) setFilters({ search: debouncedSearch });
  }, [debouncedSearch, filters.search, setFilters]);

  const hasFilters = Boolean(filters.employee || filters.from || filters.to || filters.search);

  return (
    <>
      <Card className="mb-4 p-4">
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto_auto_auto]">
          <Input leftIcon={Search} placeholder="Search in reports…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} aria-label="Search reports" />
          <Select aria-label="Filter by employee" value={filters.employee} onChange={(e) => setFilters({ employee: e.target.value })} placeholder="All employees">
            {(employees.data ?? [])
              .filter((u) => u.role === 'employee')
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {fullName(u)}
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
              setFilters({ employee: '', from: '', to: '', search: '' });
            }}
          >
            Clear
          </Button>
        </div>
      </Card>

      {isPending ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="space-y-3 p-5">
              <Skeleton className="h-8 w-48 rounded-full" />
              <Skeleton className="h-3 w-3/4" />
            </Card>
          ))}
        </div>
      ) : isError ? (
        <Card>
          <ErrorState error={error} onRetry={refetch} />
        </Card>
      ) : data.items.length === 0 ? (
        <Card>
          <EmptyState icon={ClipboardList} title="No reports found" description="Try adjusting the filters." />
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {data.items.map((report) => (
              <ReportCard key={report.id} report={report} showEmployee onEdit={onEdit} />
            ))}
          </div>
          <Card className="mt-4">
            <Pagination pagination={data.pagination} onPageChange={(page) => setFilters({ page })} className="border-t-0" />
          </Card>
        </>
      )}
    </>
  );
}

export default function StatusAdminPage() {
  useDocumentTitle('Daily Status');
  const [view, setView] = useQueryState({ view: 'board' });
  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(null);

  return (
    <>
      <PageHeader
        title="Daily Status"
        description="See what everyone worked on today, and browse historical reports."
        actions={
          <Tabs
            value={view.view}
            onChange={(v) => setView({ view: v, date: '', department: '', employee: '', from: '', to: '', search: '' })}
            options={[
              { value: 'board', label: 'Team board', icon: LayoutGrid },
              { value: 'reports', label: 'All reports', icon: List },
            ]}
          />
        }
      />

      {view.view === 'reports' ? <AllReports onEdit={setEditing} /> : <TeamBoard onOpenReport={setViewing} />}

      <Modal
        open={Boolean(viewing)}
        onOpenChange={(open) => !open && setViewing(null)}
        size="lg"
        title={viewing ? `${fullName(viewing.employee)} — ${relativeDay(viewing.date)}` : ''}
        description={viewing ? formatDate(viewing.date, 'EEEE, d MMMM yyyy') : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setViewing(null)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setEditing(viewing);
                setViewing(null);
              }}
            >
              Edit report
            </Button>
          </>
        }
      >
        {viewing && <ReportBody report={viewing} />}
      </Modal>

      <StatusFormModal open={Boolean(editing)} report={editing} onOpenChange={(open) => !open && setEditing(null)} />
    </>
  );
}
