import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function fullName(user) {
  if (!user) return '';
  return user.fullName || [user.firstName, user.lastName].filter(Boolean).join(' ');
}

export function initials(nameOrUser) {
  const name = typeof nameOrUser === 'string' ? nameOrUser : fullName(nameOrUser);
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?'
  );
}

const AVATAR_PALETTE = [
  'bg-indigo-100 text-indigo-700',
  'bg-sky-100 text-sky-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-700',
  'bg-violet-100 text-violet-700',
  'bg-teal-100 text-teal-700',
  'bg-orange-100 text-orange-700',
];

export function avatarColor(seed = '') {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

export function formatNumber(value, options) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('en-IN', options).format(Number(value));
}

export function formatCurrency(value, currency = 'INR', { compact = false } = {}) {
  if (value === null || value === undefined || value === '') return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: compact ? 1 : 0,
      notation: compact ? 'compact' : 'standard',
    }).format(Number(value));
  } catch {
    return `${currency} ${formatNumber(value)}`;
  }
}

export function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function truncate(text = '', length = 120) {
  if (!text || text.length <= length) return text;
  return `${text.slice(0, length).trimEnd()}…`;
}
