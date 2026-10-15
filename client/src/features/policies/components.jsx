import { Badge } from '@/components/ui';
import { POLICY_CATEGORY_MAP, POLICY_STATUS_MAP } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function PolicyStatusBadge({ status }) {
  const meta = POLICY_STATUS_MAP[status];
  return (
    <Badge tone={meta?.tone ?? 'slate'} dot>
      {meta?.label ?? status}
    </Badge>
  );
}

export function PolicyCategoryLabel({ category, className }) {
  return (
    <span className={cn('text-xs font-medium uppercase tracking-wide text-brand-700', className)}>
      {POLICY_CATEGORY_MAP[category]?.label ?? category}
    </span>
  );
}

/**
 * Policy text as written: paragraphs and line breaks are kept, and nothing in
 * it is treated as markup.
 */
export function PolicyContent({ content, className }) {
  return (
    <div className={cn('whitespace-pre-wrap break-words text-[15px] leading-7 text-slate-700', className)}>{content}</div>
  );
}

/** Accepted / pending progress for one policy. */
export function AcceptanceMeter({ stats, className }) {
  if (!stats) return null;
  const { audience, accepted } = stats;
  const share = audience ? Math.round((accepted / audience) * 100) : 0;
  return (
    <div className={cn('min-w-28', className)}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium tabular text-slate-900">
          {accepted} / {audience}
        </span>
        <span className="tabular text-slate-500">{share}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${share}%` }} />
      </div>
    </div>
  );
}
