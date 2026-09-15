import { ChevronLeft, ChevronRight, CircleAlert, Inbox, RotateCcw } from 'lucide-react';
import { Link } from 'react-router';
import { avatarColor, cn, fullName, initials } from '@/lib/utils';
import { Button } from './Button';

/* --------------------------------- Card ---------------------------------- */

export function Card({ className, children, ...props }) {
  return (
    <div className={cn('rounded-2xl border border-slate-200/80 bg-white shadow-card', className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ title, description, action, icon: Icon, className }) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-5 pt-4 pb-3', className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <Icon size={16} />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-semibold text-slate-900">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* --------------------------------- Badge --------------------------------- */

const TONES = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  blue: 'bg-sky-50 text-sky-700 ring-sky-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
};

const DOTS = {
  slate: 'bg-slate-400',
  brand: 'bg-brand-500',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  blue: 'bg-sky-500',
  violet: 'bg-violet-500',
};

export function Badge({ tone = 'slate', dot = false, className, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        TONES[tone] ?? tone,
        className,
      )}
    >
      {dot && <span className={cn('size-1.5 rounded-full', DOTS[tone] ?? 'bg-current')} aria-hidden />}
      {children}
    </span>
  );
}

/* --------------------------------- Avatar -------------------------------- */

const AVATAR_SIZES = {
  xs: 'size-6 text-[10px]',
  sm: 'size-8 text-xs',
  md: 'size-9 text-[13px]',
  lg: 'size-12 text-base',
  xl: 'size-16 text-xl',
};

export function Avatar({ user, name, size = 'md', className }) {
  const label = name ?? fullName(user);
  return (
    <span
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold ring-2 ring-white',
        AVATAR_SIZES[size],
        avatarColor(label),
        className,
      )}
      aria-hidden
    >
      {initials(label)}
    </span>
  );
}

export function UserCell({ user, subtitle, to, size = 'sm' }) {
  const content = (
    <span className="flex min-w-0 items-center gap-2.5">
      <Avatar user={user} size={size} />
      <span className="min-w-0">
        <span className={cn('block truncate text-sm font-medium text-slate-900', to && 'group-hover:text-brand-700')}>
          {fullName(user) || 'Unknown user'}
        </span>
        {subtitle !== undefined ? (
          subtitle && <span className="block truncate text-xs text-slate-500">{subtitle}</span>
        ) : (
          user?.designation && <span className="block truncate text-xs text-slate-500">{user.designation}</span>
        )}
      </span>
    </span>
  );
  return to ? (
    <Link to={to} className="group inline-flex min-w-0">
      {content}
    </Link>
  ) : (
    content
  );
}

/* ------------------------------- Feedback -------------------------------- */

export function Spinner({ size = 20, className }) {
  return (
    <svg className={cn('animate-spin text-brand-600', className)} width={size} height={size} viewBox="0 0 24 24" fill="none" role="status" aria-label="Loading">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.15" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded-md bg-slate-200/70', className)} aria-hidden />;
}

export function SkeletonRows({ rows = 5, className }) {
  return (
    <div className={cn('divide-y divide-slate-100', className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3.5">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2.5 w-1/5" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, className, compact = false }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-8' : 'px-6 py-14', className)}>
      <div className="relative mb-4">
        <div className="absolute inset-0 scale-150 rounded-full bg-brand-100/40 blur-xl" aria-hidden />
        <span className="relative flex size-12 items-center justify-center rounded-2xl bg-white text-brand-600 shadow-card ring-1 ring-slate-200">
          <Icon size={22} />
        </span>
      </div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)} role="alert">
      <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-red-50 text-red-600">
        <CircleAlert size={22} />
      </span>
      <h3 className="text-sm font-semibold text-slate-900">Couldn’t load this</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{error?.message || 'Something went wrong.'}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" leftIcon={RotateCcw} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/* ------------------------------- Navigation ------------------------------ */

export function Pagination({ pagination, onPageChange, className }) {
  if (!pagination || pagination.total === 0) return null;
  const { page, limit, total, totalPages } = pagination;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const pages = [];
  const windowStart = Math.max(1, Math.min(page - 2, totalPages - 4));
  for (let p = windowStart; p <= Math.min(totalPages, windowStart + 4); p += 1) pages.push(p);

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3', className)}>
      <p className="text-xs text-slate-500 tabular">
        Showing <span className="font-medium text-slate-700">{from}–{to}</span> of{' '}
        <span className="font-medium text-slate-700">{total}</span>
      </p>
      {totalPages > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <Button variant="ghost" size="icon-sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
            <ChevronLeft size={16} />
          </Button>
          {pages.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-current={p === page ? 'page' : undefined}
              className={cn(
                'h-8 min-w-8 rounded-lg px-2 text-[13px] font-medium tabular transition-colors',
                p === page ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              {p}
            </button>
          ))}
          <Button variant="ghost" size="icon-sm" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} aria-label="Next page">
            <ChevronRight size={16} />
          </Button>
        </nav>
      )}
    </div>
  );
}

export function Tabs({ value, onChange, options, className, size = 'md' }) {
  return (
    <div
      role="tablist"
      className={cn('inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl bg-slate-100 p-1 scrollbar-thin', className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value ?? 'all'}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-all',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-[13px]',
              active ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5' : 'text-slate-600 hover:text-slate-900',
            )}
          >
            {Icon && <Icon size={15} aria-hidden />}
            {option.label}
            {option.count !== undefined && option.count !== null && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-px text-[11px] tabular',
                  active ? 'bg-brand-50 text-brand-700' : 'bg-slate-200/80 text-slate-600',
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------- Layout -------------------------------- */

export function PageHeader({ title, description, actions, children }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const STAT_TONES = {
  brand: 'bg-brand-50 text-brand-600 ring-brand-100',
  green: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  amber: 'bg-amber-50 text-amber-600 ring-amber-100',
  red: 'bg-red-50 text-red-600 ring-red-100',
  blue: 'bg-sky-50 text-sky-600 ring-sky-100',
  violet: 'bg-violet-50 text-violet-600 ring-violet-100',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export function StatCard({ label, value, icon: Icon, tone = 'brand', hint, to, loading, className }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-slate-500">{label}</p>
        {Icon && (
          <span className={cn('flex size-9 items-center justify-center rounded-xl ring-1 ring-inset', STAT_TONES[tone])}>
            <Icon size={18} />
          </span>
        )}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-20" />
      ) : (
        <p className="mt-1 text-[28px] font-semibold leading-tight tracking-tight text-slate-900 tabular">{value}</p>
      )}
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </>
  );

  const classes = cn(
    'block rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card',
    to && 'transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md',
    className,
  );

  return to ? (
    <Link to={to} className={classes}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}

export function DescriptionList({ items, className, columns = 2 }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-4', columns === 2 ? 'sm:grid-cols-2' : 'grid-cols-1', className)}>
      {items
        .filter(Boolean)
        .map(({ label, value, full }) => (
          <div key={label} className={cn('min-w-0', full && 'sm:col-span-2')}>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
            <dd className="mt-1 break-words text-sm text-slate-800">{value ?? '—'}</dd>
          </div>
        ))}
    </dl>
  );
}
