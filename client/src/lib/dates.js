import { format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday, parseISO } from 'date-fns';

/** Date-only values travel as `YYYY-MM-DD`; parse them as local dates. */
export function parseDateOnly(value) {
  if (!value) return null;
  return value.length === 10 ? parseISO(value) : new Date(value);
}

export function toDateOnly(date = new Date()) {
  return format(date, 'yyyy-MM-dd');
}

export function todayDateOnly() {
  return toDateOnly(new Date());
}

export function formatDate(value, pattern = 'd MMM yyyy') {
  const date = parseDateOnly(value);
  return date ? format(date, pattern) : '—';
}

export function formatDateShort(value) {
  return formatDate(value, 'd MMM');
}

export function formatDateRange(start, end) {
  if (!start) return '—';
  if (!end || start === end) return formatDate(start, 'EEE, d MMM yyyy');
  const s = parseDateOnly(start);
  const e = parseDateOnly(end);
  const sameYear = s.getFullYear() === e.getFullYear();
  const sameMonth = sameYear && s.getMonth() === e.getMonth();
  if (sameMonth) return `${format(s, 'd')} – ${format(e, 'd MMM yyyy')}`;
  if (sameYear) return `${format(s, 'd MMM')} – ${format(e, 'd MMM yyyy')}`;
  return `${format(s, 'd MMM yyyy')} – ${format(e, 'd MMM yyyy')}`;
}

export function relativeDay(value) {
  const date = parseDateOnly(value);
  if (!date) return '';
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'EEE, d MMM');
}

export function timeAgo(value) {
  if (!value) return '';
  return `${formatDistanceToNowStrict(new Date(value))} ago`;
}

export function formatTime(value) {
  if (!value) return '';
  const [h, m] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(h, m, 0, 0);
  return format(date, 'h:mm a');
}

export function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
