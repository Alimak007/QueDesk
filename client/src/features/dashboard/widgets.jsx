import { ArrowRight, CalendarDays } from 'lucide-react';
import { Link } from 'react-router';
import { Button, Card, CardHeader, EmptyState } from '@/components/ui';
import { EVENT_TYPE_MAP, OPTION_COLORS } from '@/lib/constants';
import { formatDate, formatTime, relativeDay } from '@/lib/dates';
import { cn, formatCurrency } from '@/lib/utils';

export function ViewAll({ to, label = 'View all' }) {
  return (
    <Button as={Link} to={to} variant="ghost" size="xs" rightIcon={ArrowRight}>
      {label}
    </Button>
  );
}

export function QuickAction({ to, icon: Icon, label, description, tone }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105', tone)}>
        <Icon size={19} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-900">{label}</span>
        <span className="block truncate text-xs text-slate-500">{description}</span>
      </span>
    </Link>
  );
}

export function UpcomingEventsCard({ events }) {
  return (
    <Card>
      <CardHeader icon={CalendarDays} title="Upcoming events" action={<ViewAll to="/calendar" label="Calendar" />} />
      {!events?.length ? (
        <EmptyState compact icon={CalendarDays} title="Nothing scheduled" description="Upcoming holidays and events will show here." />
      ) : (
        <ul className="px-3 pb-3">
          {events.map((event) => {
            const type = EVENT_TYPE_MAP[event.type] ?? EVENT_TYPE_MAP.other;
            return (
              <li key={event.id}>
                <Link to={`/calendar?month=${event.startDate.slice(0, 7)}`} className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-slate-50">
                  <span className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-slate-50 py-1.5 ring-1 ring-slate-200/70">
                    <span className="text-[10px] font-semibold uppercase text-slate-500">{formatDate(event.startDate, 'MMM')}</span>
                    <span className="text-lg font-semibold leading-none text-slate-900 tabular">{formatDate(event.startDate, 'd')}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">{event.title}</span>
                    <span className="flex items-center gap-1.5 text-xs text-slate-500">
                      <span className={cn('size-1.5 rounded-full', type.dot)} aria-hidden />
                      {type.label} · {relativeDay(event.startDate)}
                      {!event.isAllDay && ` · ${formatTime(event.startTime)}`}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/**
 * Pipeline by stage as labelled horizontal meters. Stage name and count are
 * always written out, so colour is never the only way to tell stages apart.
 */
export function PipelineBars({ sales, showValue = true }) {
  const stages = sales?.stages ?? [];
  const max = Math.max(...stages.map((s) => s.count), 1);

  if (!stages.length) return <p className="text-sm text-slate-500">No pipeline configured.</p>;

  return (
    <ul className="space-y-3" aria-label="Leads by stage">
      {stages.map((stage) => {
        const colors = OPTION_COLORS[stage.color] ?? OPTION_COLORS.slate;
        const pct = (stage.count / max) * 100;
        return (
          <li
            key={stage.value}
            className="group"
            title={`${stage.label}: ${stage.count} lead${stage.count === 1 ? '' : 's'}${showValue ? ` · ${formatCurrency(stage.total, sales.currency)}` : ''}`}
          >
            <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
              <span className="font-medium text-slate-700">{stage.label}</span>
              <span className="text-slate-500 tabular">
                <span className="font-semibold text-slate-900">{stage.count}</span>
                {showValue && <span className="ml-2">{formatCurrency(stage.total, sales.currency, { compact: true })}</span>}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn('h-full rounded-full transition-[width,filter] duration-500 group-hover:brightness-110', colors.bar)}
                style={{ width: `${stage.count ? Math.max(pct, 3) : 0}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
