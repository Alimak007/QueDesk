/**
 * Registers every Mongoose model in one place.
 *
 * Several services resolve models lazily by name (to avoid circular imports),
 * so all of them must be registered before the first request is served.
 */
export { Asset } from './modules/companies/asset.model.js';
export { AuditLog } from './modules/audit/audit.model.js';
export { Company } from './modules/companies/company.model.js';
export { Counter } from './modules/users/counter.model.js';
export { Customer } from './modules/customers/customer.model.js';
export { DailyStatus } from './modules/daily-status/dailyStatus.model.js';
export { Event } from './modules/events/event.model.js';
export { Invoice } from './modules/invoices/invoice.model.js';
export { Lead } from './modules/sales/lead.model.js';
export { Leave } from './modules/leaves/leave.model.js';
export { Notification } from './modules/notifications/notification.model.js';
export { Payslip } from './modules/payslips/payslip.model.js';
export { SalesField } from './modules/sales/salesField.model.js';
export { SalesSettings } from './modules/sales/salesSettings.model.js';
export { User } from './modules/users/user.model.js';
