import { BriefcaseBusiness, CalendarCheck2, CalendarDays, CircleCheck, ClipboardList, ClipboardPen, Hourglass, Plane, Plus, TrendingUp } from 'lucide-react';
import { Link } from 'react-router';
import { Button, Card, CardHeader, EmptyState, StatCard } from '@/components/ui';
import { ReportBody } from '@/features/daily-status/ReportCard';
import { LeaveStatusBadge, LeaveTypeLabel } from '@/features/leaves/components';
import { formatLeaveDays } from '@/features/leaves/utils';
import { formatDateRange, relativeDay } from '@/lib/dates';
import { formatCurrency, truncate } from '@/lib/utils';
import { PipelineBars, QuickAction, UpcomingEventsCard, ViewAll } from './widgets';

export function EmployeeDashboard({ data }) {
  const { leave, dailyStatus, sales } = data;
  const quickActions = [
    leave && { to: '/leave?action=new', icon: Plane, label: 'Apply leave', description: 'Request time off', tone: 'bg-sky-50 text-sky-600' },
    dailyStatus && {
      to: '/daily-status?action=new',
      icon: ClipboardPen,
      label: dailyStatus.todaySubmitted ? 'Update today’s status' : 'Add daily status',
      description: dailyStatus.todaySubmitted ? 'Already submitted today' : 'Share today’s progress',
      tone: 'bg-emerald-50 text-emerald-600',
    },
    sales && { to: '/leads?action=new', icon: BriefcaseBusiness, label: 'Add lead', description: 'Log a new lead', tone: 'bg-violet-50 text-violet-600' },
    data.upcomingEvents && { to: '/calendar', icon: CalendarDays, label: 'View calendar', description: 'Holidays & events', tone: 'bg-amber-50 text-amber-600' },
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      {quickActions.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => (
            <QuickAction key={action.to} {...action} />
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {leave && (
          <>
            <StatCard label="Leave taken this year" value={`${leave.approvedDaysThisYear} ${leave.approvedDaysThisYear === 1 ? 'day' : 'days'}`} icon={CalendarCheck2} tone="brand" to="/leave" />
            <StatCard label="Pending leave requests" value={leave.pendingCount} icon={Hourglass} tone="amber" to="/leave?status=pending" />
          </>
        )}
        {dailyStatus && (
          <>
            <StatCard label="Reports this month" value={dailyStatus.thisMonthCount} icon={ClipboardList} tone="green" to="/daily-status" />
            <StatCard
              label="Today’s status"
              value={dailyStatus.todaySubmitted ? 'Submitted' : 'Pending'}
              icon={CircleCheck}
              tone={dailyStatus.todaySubmitted ? 'green' : 'red'}
              to="/daily-status"
              hint={dailyStatus.todaySubmitted ? 'Nice work — thanks for the update.' : 'Don’t forget to submit before you log off.'}
            />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {dailyStatus && (
        <Card className="xl:col-span-2">
          <CardHeader icon={ClipboardList} title="Today’s status report" action={<ViewAll to="/daily-status" label="History" />} />
          <div className="px-5 pb-5">
            {dailyStatus.today ? (
              <ReportBody report={dailyStatus.today} />
            ) : (
              <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-slate-200 px-6 py-8 text-center">
                <p className="text-sm font-medium text-slate-800">You haven’t shared today’s update yet</p>
                <p className="mt-1 text-sm text-slate-500">A quick summary helps the team stay in sync.</p>
                <Button as={Link} to="/daily-status?action=new" className="mt-4" leftIcon={Plus}>
                  Add today’s status
                </Button>
              </div>
            )}
          </div>
        </Card>
        )}

        {data.upcomingEvents && <UpcomingEventsCard events={data.upcomingEvents} />}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {leave && (
        <Card>
          <CardHeader icon={Plane} title="My recent leave" action={<ViewAll to="/leave" />} />
          {leave.next && (
            <div className="mx-5 mb-3 rounded-xl bg-sky-50 px-4 py-3 ring-1 ring-sky-100">
              <p className="text-xs font-medium text-sky-800">Next approved leave</p>
              <p className="text-sm font-semibold text-sky-950">{formatDateRange(leave.next.startDate, leave.next.endDate)}</p>
            </div>
          )}
          {leave.recent.length === 0 ? (
            <EmptyState compact icon={Plane} title="No leave requests" description="Requests you submit will show here." />
          ) : (
            <ul className="divide-y divide-slate-100 border-t border-slate-100">
              {leave.recent.map((item) => (
                <li key={item.id}>
                  <Link to={`/leave?leave=${item.id}`} className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{formatDateRange(item.startDate, item.endDate)}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <LeaveTypeLabel type={item.type} className="text-xs text-slate-500" /> · {formatLeaveDays(item)}
                      </div>
                    </div>
                    <LeaveStatusBadge status={item.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        )}

        {dailyStatus && (
        <Card>
          <CardHeader icon={ClipboardList} title="Recent reports" action={<ViewAll to="/daily-status" />} />
          {dailyStatus.recent.length === 0 ? (
            <EmptyState compact icon={ClipboardList} title="No reports yet" />
          ) : (
            <ul className="divide-y divide-slate-100 border-t border-slate-100">
              {dailyStatus.recent.map((report) => (
                <li key={report.id} className="px-5 py-3">
                  <p className="text-xs font-medium text-slate-500">{relativeDay(report.date)}</p>
                  <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-sm text-slate-700">{truncate(report.workDone, 160)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        )}

        {sales && (
        <Card>
          <CardHeader
            icon={TrendingUp}
            title="Sales pipeline"
            description={`${sales.totalLeads} leads · ${sales.myLeads} owned by you`}
            action={<ViewAll to="/leads" />}
          />
          <div className="px-5 pb-5">
            <p className="mb-4 text-2xl font-semibold tracking-tight text-slate-900 tabular">
              {formatCurrency(sales.totalValue, sales.currency, { compact: true })}
              <span className="ml-1.5 text-xs font-normal text-slate-500">total value</span>
            </p>
            <PipelineBars sales={sales} showValue={false} />
          </div>
        </Card>
        )}
      </div>
    </div>
  );
}
