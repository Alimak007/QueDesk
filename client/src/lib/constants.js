export const ROLES = Object.freeze({ ADMIN: 'admin', EMPLOYEE: 'employee' });

export const LEAVE_TYPES = [
  { value: 'casual', label: 'Casual leave', short: 'Casual', dot: 'bg-sky-500' },
  { value: 'sick', label: 'Sick leave', short: 'Sick', dot: 'bg-rose-500' },
  { value: 'earned', label: 'Earned leave', short: 'Earned', dot: 'bg-emerald-500' },
  { value: 'unpaid', label: 'Unpaid leave', short: 'Unpaid', dot: 'bg-amber-500' },
  { value: 'other', label: 'Other', short: 'Other', dot: 'bg-slate-400' },
];

export const LEAVE_TYPE_MAP = Object.fromEntries(LEAVE_TYPES.map((t) => [t.value, t]));

export const LEAVE_STATUSES = [
  { value: 'pending', label: 'Pending', tone: 'amber' },
  { value: 'approved', label: 'Approved', tone: 'green' },
  { value: 'rejected', label: 'Rejected', tone: 'red' },
  { value: 'cancelled', label: 'Cancelled', tone: 'slate' },
];

export const LEAVE_STATUS_MAP = Object.fromEntries(LEAVE_STATUSES.map((s) => [s.value, s]));

export const HALF_DAY_SESSIONS = [
  { value: 'first_half', label: 'First half' },
  { value: 'second_half', label: 'Second half' },
];

export const EVENT_TYPES = [
  { value: 'holiday', label: 'Holiday', chip: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-500', solid: 'bg-rose-500' },
  { value: 'event', label: 'Event', chip: 'bg-violet-50 text-violet-700 ring-violet-200', dot: 'bg-violet-500', solid: 'bg-violet-500' },
  { value: 'meeting', label: 'Meeting', chip: 'bg-sky-50 text-sky-700 ring-sky-200', dot: 'bg-sky-500', solid: 'bg-sky-500' },
  { value: 'other', label: 'Other', chip: 'bg-slate-100 text-slate-700 ring-slate-200', dot: 'bg-slate-400', solid: 'bg-slate-400' },
];

export const EVENT_TYPE_MAP = Object.fromEntries(EVENT_TYPES.map((t) => [t.value, t]));

export const SALES_FIELD_TYPES = [
  { value: 'text', label: 'Text', description: 'Single line of text' },
  { value: 'textarea', label: 'Long text', description: 'Multi-line notes' },
  { value: 'number', label: 'Number', description: 'Any numeric value' },
  { value: 'currency', label: 'Currency', description: 'Monetary amount' },
  { value: 'email', label: 'Email', description: 'Validated email address' },
  { value: 'phone', label: 'Phone', description: 'Phone number' },
  { value: 'url', label: 'URL', description: 'Website link' },
  { value: 'date', label: 'Date', description: 'Calendar date' },
  { value: 'dropdown', label: 'Dropdown', description: 'Pick one from a list' },
  { value: 'checkbox', label: 'Checkbox', description: 'Yes / no' },
];

export const SALES_FIELD_TYPE_MAP = Object.fromEntries(SALES_FIELD_TYPES.map((t) => [t.value, t]));

/** Tailwind classes for dropdown option colours configured by admins. */
export const OPTION_COLORS = {
  slate: { badge: 'bg-slate-100 text-slate-700 ring-slate-200', dot: 'bg-slate-400', bar: 'bg-slate-400' },
  blue: { badge: 'bg-blue-50 text-blue-700 ring-blue-200', dot: 'bg-blue-500', bar: 'bg-blue-500' },
  indigo: { badge: 'bg-indigo-50 text-indigo-700 ring-indigo-200', dot: 'bg-indigo-500', bar: 'bg-indigo-500' },
  violet: { badge: 'bg-violet-50 text-violet-700 ring-violet-200', dot: 'bg-violet-500', bar: 'bg-violet-500' },
  pink: { badge: 'bg-pink-50 text-pink-700 ring-pink-200', dot: 'bg-pink-500', bar: 'bg-pink-500' },
  red: { badge: 'bg-red-50 text-red-700 ring-red-200', dot: 'bg-red-500', bar: 'bg-red-500' },
  orange: { badge: 'bg-orange-50 text-orange-700 ring-orange-200', dot: 'bg-orange-500', bar: 'bg-orange-500' },
  amber: { badge: 'bg-amber-50 text-amber-800 ring-amber-200', dot: 'bg-amber-500', bar: 'bg-amber-500' },
  green: { badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500', bar: 'bg-emerald-500' },
  teal: { badge: 'bg-teal-50 text-teal-700 ring-teal-200', dot: 'bg-teal-500', bar: 'bg-teal-500' },
  cyan: { badge: 'bg-cyan-50 text-cyan-700 ring-cyan-200', dot: 'bg-cyan-500', bar: 'bg-cyan-500' },
};
