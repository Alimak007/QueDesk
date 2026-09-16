import { LEAVE_STATUS, ROLES, USER_STATUS } from '../../constants/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { todayDateOnly } from '../../utils/dates.js';
import { USER_SUMMARY_FIELDS } from '../../utils/mongoose.js';
import { buildPage, escapeRegex, getPagination } from '../../utils/pagination.js';
import { can } from '../../utils/permissions.js';
import { canManage } from '../../utils/scope.js';
import { Leave } from '../leaves/leave.model.js';
import { User } from '../users/user.model.js';
import { DailyStatus } from './dailyStatus.model.js';

const POPULATE = [
  { path: 'employee', select: USER_SUMMARY_FIELDS },
  { path: 'lastEditedBy', select: 'firstName lastName role' },
];

const canReview = (actor) => canManage(actor, 'dailyStatus', 'review');

/** Reviewers see everyone's reports unless they ask for their own; others only see theirs. */
function reportScope(actor, scope) {
  return canReview(actor) && scope !== 'mine' ? {} : { employee: actor._id };
}

async function findScopedReport(id, actor) {
  const report = await DailyStatus.findOne({ _id: id, ...reportScope(actor) });
  if (!report) throw ApiError.notFound('Status report not found');
  return report;
}

export async function listReports(query, actor) {
  const { employee, from, to, search, scope } = query;
  const filter = reportScope(actor, scope);

  // Can only narrow an organisation-wide view, never widen a personal one.
  if (employee && !filter.employee) filter.employee = employee;
  if (from || to) filter.date = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ workDone: rx }, { planNext: rx }, { blockers: rx }];
  }

  const { page, limit, skip } = getPagination(query);
  const [items, total] = await Promise.all([
    DailyStatus.find(filter).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limit).populate(POPULATE),
    DailyStatus.countDocuments(filter),
  ]);
  return buildPage(items, total, { page, limit });
}

export async function getReport(id, actor) {
  const report = await findScopedReport(id, actor);
  return report.populate(POPULATE);
}

export async function createReport(data, actor) {
  const existing = await DailyStatus.findOne({ employee: actor._id, date: data.date }).select('_id').lean();
  if (existing) {
    throw ApiError.conflict('You have already submitted a report for this date. Edit it instead.', {
      code: 'DUPLICATE_REPORT',
      details: [{ path: 'date', message: 'A report already exists for this date' }],
    });
  }
  const report = await DailyStatus.create({ ...data, employee: actor._id });
  return report.populate(POPULATE);
}

export async function updateReport(id, data, actor) {
  const report = await findScopedReport(id, actor);
  const own = String(report.employee) === String(actor._id);
  if (own ? !can(actor, 'dailyStatus', 'edit') : !canReview(actor)) throw ApiError.forbidden();
  Object.assign(report, data, { lastEditedBy: actor._id });
  await report.save();
  return report.populate(POPULATE);
}

/**
 * Admin board: every active employee alongside their report for the date,
 * so it is obvious who has and has not reported, and who is on leave.
 */
export async function getTeamBoard({ date = todayDateOnly(), department }) {
  const userFilter = { role: ROLES.EMPLOYEE, status: USER_STATUS.ACTIVE };
  if (department) userFilter.department = department;

  const employees = await User.find(userFilter).select(USER_SUMMARY_FIELDS).sort({ firstName: 1, lastName: 1 });
  const ids = employees.map((e) => e._id);

  const [reports, leaves] = await Promise.all([
    DailyStatus.find({ date, employee: { $in: ids } }),
    Leave.find({
      employee: { $in: ids },
      status: LEAVE_STATUS.APPROVED,
      startDate: { $lte: date },
      endDate: { $gte: date },
    }).select('employee type isHalfDay'),
  ]);

  const reportByEmployee = new Map(reports.map((r) => [r.employee.toString(), r]));
  const leaveByEmployee = new Map(leaves.map((l) => [l.employee.toString(), l]));

  const items = employees.map((employee) => ({
    employee,
    report: reportByEmployee.get(employee.id) ?? null,
    leave: leaveByEmployee.get(employee.id) ?? null,
  }));

  return {
    date,
    items,
    stats: {
      total: employees.length,
      submitted: reports.length,
      onLeave: leaves.length,
      pending: items.filter((i) => !i.report && !i.leave).length,
    },
  };
}
