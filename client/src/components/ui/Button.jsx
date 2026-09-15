import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const VARIANTS = {
  primary:
    'bg-brand-600 text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300 disabled:shadow-none',
  secondary:
    'bg-white text-slate-700 ring-1 ring-inset ring-slate-300/80 shadow-sm hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100 disabled:text-slate-400',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200/70 disabled:text-slate-300',
  danger: 'bg-red-600 text-white shadow-sm shadow-red-600/20 hover:bg-red-700 active:bg-red-800 disabled:bg-red-300',
  'danger-soft': 'bg-red-50 text-red-700 hover:bg-red-100 active:bg-red-200/70 disabled:text-red-300',
  'success-soft': 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 active:bg-emerald-200/70 disabled:text-emerald-300',
  soft: 'bg-brand-50 text-brand-700 hover:bg-brand-100 active:bg-brand-200/70 disabled:text-brand-300',
  link: 'text-brand-600 hover:text-brand-700 hover:underline underline-offset-4 px-0! h-auto!',
};

const SIZES = {
  xs: 'h-7 px-2.5 text-xs gap-1.5 rounded-md',
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-9 px-3.5 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-5 text-[15px] gap-2 rounded-xl',
  icon: 'h-9 w-9 rounded-lg',
  'icon-sm': 'h-8 w-8 rounded-lg',
  'icon-xs': 'h-7 w-7 rounded-md',
};

export function Button({
  as: Component = 'button',
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  className,
  children,
  type,
  ...props
}) {
  const iconSize = size === 'xs' || size === 'icon-xs' ? 14 : 16;
  const isButton = Component === 'button';

  return (
    <Component
      type={isButton ? (type ?? 'button') : undefined}
      disabled={isButton ? disabled || loading : undefined}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium transition-colors duration-150 disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <LoaderCircle size={iconSize} className="animate-spin" aria-hidden />
      ) : (
        LeftIcon && <LeftIcon size={iconSize} aria-hidden />
      )}
      {children}
      {RightIcon && !loading && <RightIcon size={iconSize} aria-hidden />}
    </Component>
  );
}
