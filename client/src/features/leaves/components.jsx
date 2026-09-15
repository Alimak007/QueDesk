import { Badge } from '@/components/ui';
import { LEAVE_STATUS_MAP, LEAVE_TYPE_MAP } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function LeaveStatusBadge({ status }) {
  const meta = LEAVE_STATUS_MAP[status] ?? { label: status, tone: 'slate' };
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  );
}

export function LeaveTypeLabel({ type, className }) {
  const meta = LEAVE_TYPE_MAP[type] ?? { label: type, dot: 'bg-slate-400' };
  return (
    <span className={cn('inline-flex items-center gap-2 whitespace-nowrap text-sm text-slate-700', className)}>
      <span className={cn('size-2 shrink-0 rounded-full', meta.dot)} aria-hidden />
      {meta.label}
    </span>
  );
}
