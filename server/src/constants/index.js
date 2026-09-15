export const ROLES = Object.freeze({
  ADMIN: 'admin',
  EMPLOYEE: 'employee',
});

export const USER_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
});

export const LEAVE_TYPES = Object.freeze(['casual', 'sick', 'earned', 'unpaid', 'other']);

export const LEAVE_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
});

export const HALF_DAY_SESSIONS = Object.freeze(['first_half', 'second_half']);

export const EVENT_TYPES = Object.freeze(['holiday', 'event', 'meeting', 'other']);

export const SALES_FIELD_TYPES = Object.freeze([
  'text',
  'textarea',
  'number',
  'currency',
  'email',
  'phone',
  'url',
  'date',
  'dropdown',
  'checkbox',
]);

/** Sales field keys that the system depends on; they can be relabelled but not removed. */
export const SYSTEM_SALES_FIELDS = Object.freeze({
  TITLE: 'leadName',
  STATUS: 'leadStatus',
});

export const NOTIFICATION_TYPES = Object.freeze({
  LEAVE_SUBMITTED: 'leave_submitted',
  LEAVE_APPROVED: 'leave_approved',
  LEAVE_REJECTED: 'leave_rejected',
  LEAVE_CANCELLED: 'leave_cancelled',
});
