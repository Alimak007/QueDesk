import { ChevronDown } from 'lucide-react';
import { useId } from 'react';
import { cn } from '@/lib/utils';

const controlBase =
  'block w-full rounded-lg border bg-white text-sm text-slate-900 shadow-xs transition-[border-color,box-shadow] placeholder:text-slate-400 focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500';

const controlState = (invalid) =>
  invalid
    ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15'
    : 'border-slate-300 hover:border-slate-400 focus:border-brand-500 focus:ring-brand-500/15';

export function Label({ htmlFor, required, children, className }) {
  return (
    <label htmlFor={htmlFor} className={cn('mb-1.5 block text-[13px] font-medium text-slate-700', className)}>
      {children}
      {required && <span className="ml-0.5 text-red-500" aria-hidden>*</span>}
    </label>
  );
}

/**
 * Wraps a control with label, hint and error. The child receives `id`,
 * `aria-invalid` and `aria-describedby` via render-prop when a function.
 */
export function FormField({ label, required, error, hint, className, children, id: providedId }) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const controlProps = { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy };

  return (
    <div className={cn('min-w-0', className)}>
      {label && (
        <Label htmlFor={id} required={required}>
          {label}
        </Label>
      )}
      {typeof children === 'function' ? children(controlProps) : children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs font-medium text-red-600">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function Input({ className, invalid, leftIcon: LeftIcon, rightSlot, ...props }) {
  const isInvalid = invalid ?? props['aria-invalid'];
  if (!LeftIcon && !rightSlot) {
    return <input className={cn(controlBase, controlState(isInvalid), 'h-9 px-3', className)} {...props} />;
  }
  return (
    <div className="relative">
      {LeftIcon && (
        <LeftIcon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
      )}
      <input
        className={cn(controlBase, controlState(isInvalid), 'h-9 px-3', LeftIcon && 'pl-9', rightSlot && 'pr-10', className)}
        {...props}
      />
      {rightSlot && <div className="absolute inset-y-0 right-1 flex items-center">{rightSlot}</div>}
    </div>
  );
}

export function Textarea({ className, invalid, rows = 4, ...props }) {
  const isInvalid = invalid ?? props['aria-invalid'];
  return (
    <textarea
      rows={rows}
      className={cn(controlBase, controlState(isInvalid), 'resize-y px-3 py-2 leading-relaxed', className)}
      {...props}
    />
  );
}

export function Select({ className, invalid, children, placeholder, ...props }) {
  const isInvalid = invalid ?? props['aria-invalid'];
  return (
    <div className="relative">
      <select
        className={cn(
          controlBase,
          controlState(isInvalid),
          'h-9 cursor-pointer appearance-none pl-3 pr-9',
          className,
        )}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {children}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
        aria-hidden
      />
    </div>
  );
}

export function Checkbox({ label, description, className, id: providedId, ...props }) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  return (
    <label htmlFor={id} className={cn('flex cursor-pointer items-start gap-2.5', className)}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-4 cursor-pointer rounded border-slate-300 accent-brand-600"
        {...props}
      />
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-sm font-medium text-slate-800">{label}</span>}
          {description && <span className="block text-xs text-slate-500">{description}</span>}
        </span>
      )}
    </label>
  );
}

export function Switch({ checked, onChange, disabled, label, size = 'md', className, ...props }) {
  const dims = size === 'sm' ? { track: 'h-5 w-9', thumb: 'size-4', on: 'translate-x-4' } : { track: 'h-6 w-11', thumb: 'size-5', on: 'translate-x-5' };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        'relative inline-flex shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50',
        dims.track,
        checked ? 'bg-brand-600' : 'bg-slate-300',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'inline-block rounded-full bg-white shadow-sm ring-0 transition-transform duration-200',
          dims.thumb,
          checked ? dims.on : 'translate-x-0',
        )}
      />
    </button>
  );
}

/** Pill-style radio group for small option sets. */
export function RadioCards({ value, onChange, options, className, columns = 2 }) {
  return (
    <div role="radiogroup" className={cn('grid gap-2', className)} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-all',
              active
                ? 'border-brand-500 bg-brand-50/60 text-brand-800 ring-4 ring-brand-500/10'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
            )}
          >
            {option.dot && <span className={cn('size-2 rounded-full', option.dot)} aria-hidden />}
            <span className="font-medium">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
