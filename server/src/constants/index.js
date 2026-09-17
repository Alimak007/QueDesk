export const ROLES = Object.freeze({
  ADMIN: 'admin',
  EMPLOYEE: 'employee',
});

export const USER_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
});

export const LEAVE_TYPES = Object.freeze(['casual', 'sick', 'earned', 'wfh', 'unpaid', 'other']);

/**
 * Days of each type a new employee gets per calendar year. `null` means the
 * type is not capped — unpaid leave has no allowance to run down. Admins set
 * these per person when adding or editing an employee.
 */
export const DEFAULT_LEAVE_ENTITLEMENTS = Object.freeze({
  casual: 12,
  sick: 6,
  earned: 12,
  wfh: 24,
  unpaid: null,
  other: null,
});

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

/** Record types that share the configurable-field engine. */
export const FIELD_ENTITIES = Object.freeze(['lead', 'customer']);

export const SYSTEM_CUSTOMER_FIELDS = Object.freeze({
  TITLE: 'customerName',
  STATUS: 'customerStatus',
});

/** System (non-removable) field keys per entity. */
export const SYSTEM_FIELD_KEYS = Object.freeze({
  lead: Object.values(SYSTEM_SALES_FIELDS),
  customer: Object.values(SYSTEM_CUSTOMER_FIELDS),
});

export const TITLE_FIELD_KEY = Object.freeze({
  lead: SYSTEM_SALES_FIELDS.TITLE,
  customer: SYSTEM_CUSTOMER_FIELDS.TITLE,
});

/** Default lead stage that turns a lead into a customer. */
export const CUSTOMER_STAGE_VALUE = 'customer';

export const NOTIFICATION_TYPES = Object.freeze({
  LEAVE_SUBMITTED: 'leave_submitted',
  LEAVE_APPROVED: 'leave_approved',
  LEAVE_REJECTED: 'leave_rejected',
  LEAVE_CANCELLED: 'leave_cancelled',
});
