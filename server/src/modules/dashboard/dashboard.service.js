import { LEAVE_STATUS, ROLES, USER_STATUS } from '../../constants/index.js';
import { startOfMonth, todayDateOnly } from '../../utils/dates.js';
import { USER_SUMMARY_FIELDS } from '../../utils/mongoose.js';
import { can } from '../../utils/permissions.js';
import { DailyStatus } from '../daily-status/dailyStatus.model.js';
import { getTeamBoard } from '../daily-status/dailyStatus.service.js';
import { listUpcomingEvents } from '../events/event.service.js';
import { getInvoiceSummary } from '../invoices/invoice.service.js';
import { Invoice } from '../invoices/invoice.model.js';
import { Leave } from '../leaves/leave.model.js';
import { getLeaveSummary, listOnLeave } from '../leaves/leave.service.js';
import { Payslip } from '../payslips/payslip.model.js';
import { Customer } from '../customers/customer.model.js';
import { Lead } from '../sales/lead.model.js';
import { getSalesSummary, listRecentLeads } from '../sales/lead.service.js';
import { User } from '../users/user.model.js';

const EMPLOYEE_POPULATE = { path: 'employee', select: USER_SUMMARY_FIELDS };

/** Only resolves the promise when the actor holds the permission. */
const when = (allowed, promise, fallback = null) => (allowed ? promise : Promise.resolve(fallback));

export async function getEmployeeDashboard(actor) {
  const today = todayDateOnly();
  const mine = { employee: actor._id };
  const seesLeave = can(actor, 'leave', 'view');
  const seesStatus = can(actor, 'dailyStatus', 'view');
  const seesCalendar = can(actor, 'calendar', 'view');
  const seesLeads = can(actor, 'leads', 'view');

  const [leaveSummary, pendingLeaves, recentLeaves, nextLeave, todayReport, recentReports, reportsThisMonth, upcomingEvents, sales, myLeads] =
    await Promise.all([
      when(seesLeave, getLeaveSummary(actor, { scope: 'mine' })),
      when(seesLeave, Leave.find({ ...mine, status: LEAVE_STATUS.PENDING }).sort({ startDate: 1 }).limit(5), []),
      when(seesLeave, Leave.find(mine).sort({ createdAt: -1 }).limit(5), []),
      when(seesLeave, Leave.findOne({ ...mine, status: LEAVE_STATUS.APPROVED, endDate: { $gte: today } }).sort({ startDate: 1 })),
      when(seesStatus, DailyStatus.findOne({ ...mine, date: today })),
      when(seesStatus, DailyStatus.find(mine).sort({ date: -1 }).limit(5), []),
      when(seesStatus, DailyStatus.countDocuments({ ...mine, date: { $gte: startOfMonth(today), $lte: today } }), 0),
      when(seesCalendar, listUpcomingEvents({ limit: 5 }), []),
      when(seesLeads, getSalesSummary()),
      when(seesLeads, Lead.countDocuments({ owner: actor._id }), 0),
    ]);

  return {
    today,
    leave: seesLeave
      ? {
          approvedDaysThisYear: leaveSummary.approvedDays,
          pendingCount: leaveSummary.byStatus.pending,
          byType: leaveSummary.byType,
          pending: pendingLeaves,
          recent: recentLeaves,
          next: nextLeave,
        }
      : null,
    dailyStatus: seesStatus
      ? { todaySubmitted: Boolean(todayReport), today: todayReport, recent: recentReports, thisMonthCount: reportsThisMonth }
      : null,
    upcomingEvents: seesCalendar ? upcomingEvents : null,
    sales: seesLeads ? { ...sales, myLeads } : null,
  };
}

export async function getAdminDashboard(actor) {
  const today = todayDateOnly();
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const seesEmployees = can(actor, 'employees', 'view');
  const approvesLeave = can(actor, 'leave', 'approve');
  const reviewsStatus = can(actor, 'dailyStatus', 'review');
  const seesLeads = can(actor, 'leads', 'view');
  const seesInvoices = can(actor, 'invoices', 'view');
  const seesPayslips = can(actor, 'payslips', 'view');
  const seesCustomers = can(actor, 'customers', 'view');

  const [
    totalEmployees,
    inactiveEmployees,
    leaveCounts,
    pendingLeaves,
    pendingCount,
    onLeaveToday,
    teamBoard,
    recentReports,
    upcomingEvents,
    sales,
    recentLeads,
    customerCount,
    invoices,
    recentInvoices,
    payslipCount,
  ] = await Promise.all([
    when(seesEmployees, User.countDocuments({ role: ROLES.EMPLOYEE, status: USER_STATUS.ACTIVE }), 0),
    when(seesEmployees, User.countDocuments({ status: USER_STATUS.INACTIVE }), 0),
    when(approvesLeave, Leave.aggregate([{ $match: { startDate: { $gte: yearStart } } }, { $group: { _id: '$status', count: { $sum: 1 } } }]), []),
    when(approvesLeave, Leave.find({ status: LEAVE_STATUS.PENDING }).sort({ startDate: 1 }).limit(6).populate(EMPLOYEE_POPULATE), []),
    when(approvesLeave, Leave.countDocuments({ status: LEAVE_STATUS.PENDING }), 0),
    when(approvesLeave, listOnLeave(today), []),
    when(reviewsStatus, getTeamBoard({ date: today })),
    when(reviewsStatus, DailyStatus.find().sort({ date: -1, updatedAt: -1 }).limit(6).populate(EMPLOYEE_POPULATE), []),
    when(can(actor, 'calendar', 'view'), listUpcomingEvents({ limit: 5 }), []),
    when(seesLeads, getSalesSummary()),
    when(seesLeads, listRecentLeads(5), []),
    when(seesCustomers, Customer.countDocuments(), 0),
    when(seesInvoices, getInvoiceSummary()),
    when(seesInvoices, Invoice.find().sort({ createdAt: -1 }).limit(5).populate('company', 'name'), []),
    when(seesPayslips, Payslip.countDocuments(), 0),
  ]);

  const leaveByStatus = Object.fromEntries((leaveCounts ?? []).map((r) => [r._id, r.count]));

  return {
    today,
    employees: seesEmployees ? { active: totalEmployees, inactive: inactiveEmployees } : null,
    leave: approvesLeave
      ? {
          pendingCount,
          approvedThisYear: leaveByStatus.approved ?? 0,
          rejectedThisYear: leaveByStatus.rejected ?? 0,
          pending: pendingLeaves,
          onLeaveToday,
        }
      : null,
    dailyStatus: reviewsStatus ? { ...teamBoard.stats, recent: recentReports } : null,
    upcomingEvents,
    sales: seesLeads ? { ...sales, recentLeads } : null,
    customers: seesCustomers ? { total: customerCount } : null,
    finance: seesInvoices ? { ...invoices, recent: recentInvoices } : null,
    payslips: seesPayslips ? { total: payslipCount } : null,
  };
}
