/**
 * Date-only values (leave dates, report dates, event dates) are stored as
 * ISO `YYYY-MM-DD` strings. This keeps them timezone-agnostic and lets MongoDB
 * range-compare them lexicographically.
 */

export const DATE_ONLY_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidDateOnly(value) {
  if (typeof value !== 'string' || !DATE_ONLY_REGEX.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function toDateOnly(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayDateOnly() {
  return toDateOnly(new Date());
}

export function addDays(dateOnly, days) {
  const d = new Date(`${dateOnly}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Iterates every date between start and end (inclusive). */
export function* eachDate(start, end) {
  for (let cur = start; cur <= end; cur = addDays(cur, 1)) {
    yield cur;
  }
}

export function isWeekend(dateOnly) {
  const day = new Date(`${dateOnly}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

export function startOfYear(dateOnly = todayDateOnly()) {
  return `${dateOnly.slice(0, 4)}-01-01`;
}

export function endOfYear(dateOnly = todayDateOnly()) {
  return `${dateOnly.slice(0, 4)}-12-31`;
}

export function startOfMonth(dateOnly = todayDateOnly()) {
  return `${dateOnly.slice(0, 7)}-01`;
}
