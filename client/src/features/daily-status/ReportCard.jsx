import { CircleCheckBig, Clock, ListTodo, OctagonAlert, Pencil } from 'lucide-react';
import { Button, Card, UserCell } from '@/components/ui';
import { formatDate, relativeDay, timeAgo } from '@/lib/dates';
import { cn, fullName } from '@/lib/utils';

function Section({ icon: Icon, title, tone, children }) {
  return (
    <div className="flex gap-3">
      <span className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg', tone)}>
        <Icon size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{title}</p>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{children}</p>
      </div>
    </div>
  );
}

export function ReportBody({ report, compact = false }) {
  return (
    <div className={cn('space-y-4', compact && 'space-y-3')}>
      <Section icon={CircleCheckBig} title="Work done" tone="bg-emerald-50 text-emerald-600">
        {report.workDone}
      </Section>
      {report.planNext && (
        <Section icon={ListTodo} title="Next" tone="bg-brand-50 text-brand-600">
          {report.planNext}
        </Section>
      )}
      {report.blockers && (
        <Section icon={OctagonAlert} title="Blockers" tone="bg-amber-50 text-amber-600">
          {report.blockers}
        </Section>
      )}
    </div>
  );
}

export function ReportCard({ report, showEmployee = false, onEdit }) {
  const edited = report.updatedAt && report.createdAt && new Date(report.updatedAt) - new Date(report.createdAt) > 60_000;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-3">
        <div className="flex min-w-0 items-center gap-4">
          {showEmployee ? (
            <UserCell user={report.employee} subtitle={`${relativeDay(report.date)} · ${formatDate(report.date)}`} to={`/employees/${report.employee?.id}`} />
          ) : (
            <div>
              <p className="text-sm font-semibold text-slate-900">{relativeDay(report.date)}</p>
              <p className="text-xs text-slate-500">{formatDate(report.date, 'd MMMM yyyy')}</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          {typeof report.hoursWorked === 'number' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 ring-1 ring-slate-200 tabular">
              <Clock size={12} /> {report.hoursWorked}h
            </span>
          )}
          <span title={formatDate(report.updatedAt, 'd MMM yyyy, h:mm a')}>
            {edited
              ? `Edited ${timeAgo(report.updatedAt)}${report.lastEditedBy && report.lastEditedBy.role === 'admin' ? ` by ${fullName(report.lastEditedBy)}` : ''}`
              : `Submitted ${timeAgo(report.createdAt)}`}
          </span>
          {onEdit && (
            <Button variant="ghost" size="icon-xs" onClick={() => onEdit(report)} aria-label="Edit report">
              <Pencil size={14} />
            </Button>
          )}
        </div>
      </div>
      <div className="px-5 py-4">
        <ReportBody report={report} />
      </div>
    </Card>
  );
}
