import { useId } from 'react';
import { cn } from '@/lib/utils';

export function LogoMark({ className }) {
  // Unique per instance: a gradient defined inside a hidden (display:none) copy cannot be referenced.
  const gradientId = `logo-gradient-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#4338ca" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${gradientId})`} />
      <path
        d="M16 8.5a7.5 7.5 0 1 0 4.03 13.83l2.02 2.02 1.98-1.98-1.98-1.98A7.5 7.5 0 0 0 16 8.5Zm0 3a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z"
        fill="#fff"
      />
    </svg>
  );
}

export function Logo({ size = 'md', className, showText = true }) {
  const mark = size === 'lg' ? 'size-11' : 'size-8';
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark className={cn(mark, 'shrink-0 drop-shadow-sm')} />
      {showText && (
        <span className="leading-none">
          <span className={cn('block font-semibold tracking-tight text-slate-900', size === 'lg' ? 'text-xl' : 'text-[15px]')}>
            QueDesk
          </span>
          <span className="mt-0.5 block text-[11px] font-medium text-slate-500">Que Info Technologies</span>
        </span>
      )}
    </span>
  );
}
