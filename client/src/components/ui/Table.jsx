import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Table({ className, children }) {
  return (
    <div className="scrollbar-thin w-full overflow-x-auto">
      <table className={cn('w-full min-w-[640px] border-separate border-spacing-0 text-left text-sm', className)}>
        {children}
      </table>
    </div>
  );
}

export function THead({ children }) {
  return <thead className="bg-slate-50/80">{children}</thead>;
}

export function Th({ className, children, sortable, sortDirection, onSort, align = 'left' }) {
  const content = sortable ? (
    <button
      type="button"
      onClick={onSort}
      className={cn('group inline-flex items-center gap-1 hover:text-slate-900', align === 'right' && 'flex-row-reverse')}
    >
      {children}
      {sortDirection === 'asc' ? (
        <ArrowUp size={13} className="text-brand-600" />
      ) : sortDirection === 'desc' ? (
        <ArrowDown size={13} className="text-brand-600" />
      ) : (
        <ArrowUpDown size={13} className="opacity-0 transition-opacity group-hover:opacity-60" />
      )}
    </button>
  ) : (
    children
  );

  return (
    <th
      scope="col"
      aria-sort={sortDirection ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
      className={cn(
        'whitespace-nowrap border-y border-slate-200/80 px-4 py-2.5 text-xs font-medium text-slate-500 first:pl-5 last:pr-5',
        align === 'right' && 'text-right',
        className,
      )}
    >
      {content}
    </th>
  );
}

export function Tr({ className, onClick, children }) {
  return (
    <tr
      onClick={onClick}
      className={cn('group transition-colors hover:bg-slate-50/70', onClick && 'cursor-pointer', className)}
    >
      {children}
    </tr>
  );
}

export function Td({ className, children, align = 'left' }) {
  return (
    <td
      className={cn(
        'border-b border-slate-100 px-4 py-3 align-middle text-slate-700 first:pl-5 last:pr-5 group-last:border-b-0',
        align === 'right' && 'text-right',
        className,
      )}
    >
      {children}
    </td>
  );
}
