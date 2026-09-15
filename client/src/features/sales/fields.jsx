import { Check, ExternalLink, Minus } from 'lucide-react';
import { Badge, Checkbox, Input, Select, Textarea } from '@/components/ui';
import { OPTION_COLORS } from '@/lib/constants';
import { formatDate } from '@/lib/dates';
import { cn, formatCurrency, formatNumber } from '@/lib/utils';
import { optionFor } from './leadForm';

export function OptionBadge({ option, fallback }) {
  if (!option) return fallback ? <Badge>{fallback}</Badge> : <span className="text-slate-400">—</span>;
  const colors = OPTION_COLORS[option.color] ?? OPTION_COLORS.slate;
  return (
    <Badge className={colors.badge}>
      <span className={cn('size-1.5 rounded-full', colors.dot)} aria-hidden />
      {option.label}
    </Badge>
  );
}

/** Read-only presentation of a lead value according to its field type. */
export function FieldValue({ field, value, currency = 'INR', className }) {
  const empty = value === null || value === undefined || value === '';
  if (field.type === 'checkbox') {
    return value ? (
      <span className="inline-flex items-center gap-1 text-emerald-700">
        <Check size={14} /> Yes
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-slate-400">
        <Minus size={14} /> No
      </span>
    );
  }
  if (empty) return <span className="text-slate-400">—</span>;

  switch (field.type) {
    case 'dropdown':
      return <OptionBadge option={optionFor(field, value)} fallback={String(value)} />;
    case 'currency':
      return <span className={cn('tabular', className)}>{formatCurrency(value, currency)}</span>;
    case 'number':
      return <span className={cn('tabular', className)}>{formatNumber(value)}</span>;
    case 'date':
      return <span className={className}>{formatDate(value)}</span>;
    case 'email':
      return (
        <a href={`mailto:${value}`} onClick={(e) => e.stopPropagation()} className={cn('text-brand-700 hover:underline', className)}>
          {value}
        </a>
      );
    case 'phone':
      return (
        <a href={`tel:${value}`} onClick={(e) => e.stopPropagation()} className={cn('hover:text-brand-700', className)}>
          {value}
        </a>
      );
    case 'url':
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={cn('inline-flex items-center gap-1 text-brand-700 hover:underline', className)}
        >
          {value.replace(/^https?:\/\//, '')} <ExternalLink size={12} />
        </a>
      );
    case 'textarea':
      return <span className={cn('whitespace-pre-wrap', className)}>{value}</span>;
    default:
      return <span className={className}>{String(value)}</span>;
  }
}

/** Input control for a configured field. Works with react-hook-form's Controller. */
export function FieldInput({ field, value, onChange, onBlur, id, invalid, currency = 'INR', ...aria }) {
  const common = { id, onBlur, 'aria-invalid': invalid || undefined, ...aria };
  const placeholder = field.placeholder || undefined;

  switch (field.type) {
    case 'textarea':
      return <Textarea {...common} rows={4} placeholder={placeholder} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
    case 'number':
      return <Input {...common} type="number" inputMode="decimal" step="any" placeholder={placeholder} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
    case 'currency':
      return (
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">{currency}</span>
          <Input
            {...common}
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder={placeholder}
            className="pl-12 tabular"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    case 'email':
      return <Input {...common} type="email" placeholder={placeholder} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
    case 'phone':
      return <Input {...common} type="tel" placeholder={placeholder} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
    case 'url':
      return <Input {...common} type="url" placeholder={placeholder || 'https://'} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
    case 'date':
      return <Input {...common} type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
    case 'dropdown':
      return (
        <Select {...common} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder || `Select ${field.label.toLowerCase()}`}>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      );
    case 'checkbox':
      return (
        <div className="flex h-9 items-center">
          <Checkbox id={id} label={placeholder || 'Yes'} checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
        </div>
      );
    default:
      return <Input {...common} placeholder={placeholder} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
  }
}
