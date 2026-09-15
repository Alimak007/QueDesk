import { BriefcaseBusiness, ClipboardList, Hourglass, Palmtree, Plane, TrendingUp, UserCheck, Users } from 'lucide-react';
import { Link } from 'react-router';
import { Avatar, Badge, Card, CardHeader, EmptyState, StatCard, UserCell } from '@/components/ui';
import { LeaveTypeLabel } from '@/features/leaves/components';
import { SYSTEM_TITLE_KEY } from '@/features/sales/constants';
import { formatDateRange, relativeDay, timeAgo } from '@/lib/dates';
import { formatCurrency, fullName, truncate } from '@/lib/utils';
import { PipelineBars, UpcomingEventsCard, ViewAll } from './widgets';

export function AdminDashboard({ data }) {
  const { employees, leave, dailyStatus, sales } = data;
  const expected = Math.max(dailyStatus.total - dailyStatus.onLeave, 0);
  const completion = expected ? Math.round((dailyStatus.submitted / expected) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active employees"
          value={employees.active}
          icon={Users}
          tone="brand"
          to="/employees"
          hint={employees.inactive ? `${employees.inactive} inactive` : 'All accounts active'}
        />
        <StatCard
          label="Pending leave requests"
          value={leave.pendingCount}
          icon={Hourglass}
          tone="amber"
          to="/leave-management"
          hint={
            <span>
              <span className="text-emerald-700">{leave.approvedThisYear} approved</span> ·{' '}
              <span className="text-red-600">{leave.rejectedThisYear} rejected</span> this year
            </span>
          }
        />
        <StatCard
          label="Status reports today"
          value={`${dailyStatus.submitted}/${expected}`}
          icon={UserCheck}
          tone="green"
          to="/daily-status"
          hint={
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(completion, 100)}%` }} />
              </div>
              <span className="tabular">{completion}%</span>
            </div>
          }
        />
        <StatCard
          label="Pipeline value"
          value={formatCurrency(sales.totalValue, sales.currency, { compact: true })}
          icon={TrendingUp}
          tone="violet"
          to="/sales"
          hint={`${sales.totalLeads} leads in pipeline`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Needs attention */}
        <Card className="xl:col-span-2">
          <CardHeader
            icon={Plane}
            title="Leave requests awaiting review"
            description={leave.pendingCount ? `${leave.pendingCount} pending` : 'Nothing waiting on you'}
            action={<ViewAll to="/leave-management" />}
          />
          {leave.pending.length === 0 ? (
            <EmptyState compact icon={Plane} title="All caught up" description="New leave requests will appear here for review." />
          ) : (
            <ul className="divide-y divide-slate-100 border-t border-slate-100">
              {leave.pending.map((item) => (
                <li key={item.id}>
                  <Link
                    to={`/leave-management?leave=${item.id}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-3 transition-colors hover:bg-slate-50 md:grid-cols-[minmax(0,1.2fr)_9rem_minmax(0,1fr)_auto]"
                  >
                    <div className="min-w-0">
                      <UserCell user={item.employee} subtitle={item.employee?.department} />
                    </div>
                    <div className="hidden md:block">
                      <LeaveTypeLabel type={item.type} />
                    </div>
                    <div className="col-span-2 row-start-2 text-sm md:col-span-1 md:row-start-auto">
                      <p className="font-medium text-slate-900">{formatDateRange(item.startDate, item.endDate)}</p>
                      <p className="text-xs text-slate-500">
                        {item.isHalfDay ? 'Half day' : `${item.days} day${item.days === 1 ? '' : 's'}`} · requested {timeAgo(item.createdAt)}
                      </p>
                    </div>
                    <Badge tone="amber" dot className="col-start-2 row-start-1 justify-self-end md:col-start-auto md:row-start-auto">
                      Review
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader icon={Palmtree} title="On leave today" description={`${leave.onLeaveToday.length} ${leave.onLeaveToday.length === 1 ? 'person' : 'people'}`} />
          {leave.onLeaveToday.length === 0 ? (
            <EmptyState compact icon={Palmtree} title="Everyone’s in" description="No approved leave today." />
          ) : (
            <ul className="space-y-1 px-3 pb-3">
              {leave.onLeaveToday.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl p-2">
                  <UserCell user={item.employee} subtitle={`Until ${relativeDay(item.endDate)}`} />
                  <LeaveTypeLabel type={item.type} className="text-xs" />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader icon={ClipboardList} title="Latest status reports" description="What the team has been working on" action={<ViewAll to="/daily-status?view=reports" />} />
          {dailyStatus.recent.length === 0 ? (
            <EmptyState compact icon={ClipboardList} title="No reports yet" />
          ) : (
            <ul className="divide-y divide-slate-100 border-t border-slate-100">
              {dailyStatus.recent.map((report) => (
                <li key={report.id} className="flex gap-3 px-5 py-3.5">
                  <Avatar user={report.employee} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <Link to={`/employees/${report.employee?.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                        {fullName(report.employee)}
                      </Link>
                      <span className="text-slate-400"> · {relativeDay(report.date)}</span>
                    </p>
                    <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-sm text-slate-600">{truncate(report.workDone, 220)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <UpcomingEventsCard events={data.upcomingEvents} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader icon={TrendingUp} title="Pipeline by stage" description={`${sales.totalLeads} leads · ${formatCurrency(sales.totalValue, sales.currency, { compact: true })}`} action={<ViewAll to="/sales" />} />
          <div className="px-5 pb-5">
            <PipelineBars sales={sales} />
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader icon={BriefcaseBusiness} title="Recent leads" action={<ViewAll to="/sales?view=list" />} />
          {sales.recentLeads.length === 0 ? (
            <EmptyState compact icon={BriefcaseBusiness} title="No leads yet" />
          ) : (
            <ul className="divide-y divide-slate-100 border-t border-slate-100">
              {sales.recentLeads.map((lead) => (
                <li key={lead.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{lead.data?.[SYSTEM_TITLE_KEY] || 'Untitled lead'}</p>
                    <p className="truncate text-xs text-slate-500">
                      {lead.data?.company || '—'} · added {timeAgo(lead.createdAt)}
                    </p>
                  </div>
                  {sales.valueField && typeof lead.data?.[sales.valueField] === 'number' && (
                    <span className="hidden text-sm font-semibold text-slate-900 tabular sm:block">
                      {formatCurrency(lead.data[sales.valueField], sales.currency)}
                    </span>
                  )}
                  <Avatar user={lead.owner} size="xs" />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
