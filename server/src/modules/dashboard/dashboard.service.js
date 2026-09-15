import { LEAVE_STATUS, ROLES, USER_STATUS } from '../../constants/index.js';
import { startOfMonth, todayDateOnly } from '../../utils/dates.js';
import { USER_SUMMARY_FIELDS } from '../../utils/mongoose.js';
import { DailyStatus } from '../daily-status/dailyStatus.model.js';
import { getTeamBoard } from '../daily-status/dailyStatus.service.js';
import { listUpcomingEvents } from '../events/event.service.js';
import { Leave } from '../leaves/leave.model.js';
import { getLeaveSummary, listOnLeave } from '../leaves/leave.service.js';
import { Lead } from '../sales/lead.model.js';
import { getSalesSummary, listRecentLeads } from '../sales/lead.service.js';
import { User } from '../users/user.model.js';

const EMPLOYEE_POPULATE = { path: 'employee', select: USER_SUMMARY_FIELDS };

export async function getEmployeeDashboard(actor) {
  const today = todayDateOnly();
  const mine = { employee: actor._id };

  const [
    leaveSummary,
    pendingLeaves,
    recentLeaves,
    todayReport,
    recentReports,
    reportsThisMonth,
    upcomingEvents,
    sales,
    myLeads,
  ] = await Promise.all([
    getLeaveSummary(actor),
    Leave.find({ ...mine, status: LEAVE_STATUS.PENDING }).sort({ startDate: 1 }).limit(5),
    Leave.find(mine).sort({ createdAt: -1 }).limit(5),
    DailyStatus.findOne({ ...mine, date: today }),
    DailyStatus.find(mine).sort({ date: -1 }).limit(5),
    DailyStatus.countDocuments({ ...mine, date: { $gte: startOfMonth(today), $lte: today } }),
    listUpcomingEvents({ limit: 5 }),
    getSalesSummary(),
    Lead.countDocuments({ owner: actor._id }),
  ]);

  const nextLeave = await Leave.findOne({
    ...mine,
    status: LEAVE_STATUS.APPROVED,
    endDate: { $gte: today },
  }).sort({ startDate: 1 });

  return {
    today,
    leave: {
      approvedDaysThisYear: leaveSummary.approvedDays,
      pendingCount: leaveSummary.byStatus.pending,
      byType: leaveSummary.byType,
      pending: pendingLeaves,
      recent: recentLeaves,
      next: nextLeave,
    },
    dailyStatus: {
      todaySubmitted: Boolean(todayReport),
      today: todayReport,
      recent: recentReports,
      thisMonthCount: reportsThisMonth,
    },
    upcomingEvents,
    sales: { ...sales, myLeads },
  };
}

export async function getAdminDashboard() {
  const today = todayDateOnly();
  const yearStart = `${today.slice(0, 4)}-01-01`;

  const [
    totalEmployees,
    inactiveEmployees,
    leaveCounts,
    pendingLeaves,
    onLeaveToday,
    teamBoard,
    recentReports,
    upcomingEvents,
    sales,
    recentLeads,
  ] = await Promise.all([
    User.countDocuments({ role: ROLES.EMPLOYEE, status: USER_STATUS.ACTIVE }),
    User.countDocuments({ status: USER_STATUS.INACTIVE }),
    Leave.aggregate([{ $match: { startDate: { $gte: yearStart } } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Leave.find({ status: LEAVE_STATUS.PENDING }).sort({ startDate: 1 }).limit(6).populate(EMPLOYEE_POPULATE),
    listOnLeave(today),
    getTeamBoard({ date: today }),
    DailyStatus.find().sort({ date: -1, updatedAt: -1 }).limit(6).populate(EMPLOYEE_POPULATE),
    listUpcomingEvents({ limit: 5 }),
    getSalesSummary(),
    listRecentLeads(5),
  ]);

  const leaveByStatus = Object.fromEntries(leaveCounts.map((r) => [r._id, r.count]));
  const pendingCount = await Leave.countDocuments({ status: LEAVE_STATUS.PENDING });

  return {
    today,
    employees: { active: totalEmployees, inactive: inactiveEmployees },
    leave: {
      pendingCount,
      approvedThisYear: leaveByStatus.approved ?? 0,
      rejectedThisYear: leaveByStatus.rejected ?? 0,
      pending: pendingLeaves,
      onLeaveToday,
    },
    dailyStatus: {
      ...teamBoard.stats,
      recent: recentReports,
    },
    upcomingEvents,
    sales: { ...sales, recentLeads },
  };
}
