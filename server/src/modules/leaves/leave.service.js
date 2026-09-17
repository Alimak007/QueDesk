import mongoose from 'mongoose';
import { LEAVE_STATUS, LEAVE_TYPES, NOTIFICATION_TYPES } from '../../constants/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { countWeekdays, todayDateOnly } from '../../utils/dates.js';
import { USER_SUMMARY_FIELDS } from '../../utils/mongoose.js';
import { buildPage, getPagination } from '../../utils/pagination.js';
import { can } from '../../utils/permissions.js';
import { canManage, isAdmin } from '../../utils/scope.js';
import { notify, notifyUsersWithPermission } from '../notifications/notification.service.js';
import { Leave } from './leave.model.js';

const ACTIVE_STATUSES = [LEAVE_STATUS.PENDING, LEAVE_STATUS.APPROVED];

const POPULATE = [
  { path: 'employee', select: USER_SUMMARY_FIELDS },
  { path: 'reviewedBy', select: 'firstName lastName' },
  { path: 'lastEditedBy', select: 'firstName lastName' },
];

const fullName = (u) => [u?.firstName, u?.lastName].filter(Boolean).join(' ');

/**
 * Working days in the range, counting both ends but skipping Saturdays and
 * Sundays: Thursday to Monday is 3 days. Company holidays are *not* deducted —
 * a holiday the employee never asked off would silently shrink their request.
 */
export async function calculateLeaveDays({ startDate, endDate, isHalfDay }) {
  if (isHalfDay) return 0.5;

  const days = countWeekdays(startDate, endDate);
  if (days === 0) {
    throw ApiError.badRequest('Those dates are all weekend, so there is nothing to take off', {
      code: 'VALIDATION_ERROR',
      details: [{ path: 'endDate', message: 'Pick a range that includes at least one weekday' }],
    });
  }
  return days;
}

async function assertNoOverlap(employeeId, { startDate, endDate }, excludeId) {
  const filter = {
    employee: employeeId,
    status: { $in: ACTIVE_STATUSES },
    startDate: { $lte: endDate },
    endDate: { $gte: startDate },
  };
  if (excludeId) filter._id = { $ne: excludeId };

  const clash = await Leave.findOne(filter).lean();
  if (clash) {
    throw ApiError.conflict(
      `These dates overlap with an existing ${clash.status} leave (${clash.startDate} to ${clash.endDate})`,
      { details: [{ path: 'startDate', message: 'Overlaps with another leave request' }] },
    );
  }
}

const canManageLeave = (actor) => canManage(actor, 'leave', 'approve');
const isOwnLeave = (leave, actor) => String(leave.employee?._id ?? leave.employee) === String(actor._id);

/**
 * Filter for the leaves an actor may see. Approvers see everyone's unless they
 * explicitly ask for their own (`scope=mine`); everyone else is pinned to themselves.
 */
function leaveScope(actor, scope) {
  return canManageLeave(actor) && scope !== 'mine' ? {} : { employee: actor._id };
}

/** Loads a leave the actor is allowed to see; other employees' leaves are reported as not found. */
async function findScopedLeave(id, actor) {
  const leave = await Leave.findOne({ _id: id, ...leaveScope(actor) });
  if (!leave) throw ApiError.notFound('Leave request not found');
  return leave;
}

const notifyApprovers = (payload, exclude) => notifyUsersWithPermission('leave', 'approve', payload, { exclude });

export async function listLeaves(query, actor) {
  const { employee, status, type, from, to, sortBy, sortOrder, scope } = query;
  const filter = leaveScope(actor, scope);

  // The employee filter can only narrow an organisation-wide view, never widen a personal one.
  if (employee && !filter.employee) filter.employee = employee;
  if (status) filter.status = status;
  if (type) filter.type = type;
  if (from) filter.endDate = { $gte: from };
  if (to) filter.startDate = { $lte: to };

  const { page, limit, skip } = getPagination(query);
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: -1 };

  const [items, total] = await Promise.all([
    Leave.find(filter).sort(sort).skip(skip).limit(limit).populate(POPULATE),
    Leave.countDocuments(filter),
  ]);
  return buildPage(items, total, { page, limit });
}

export async function getLeave(id, actor) {
  const leave = await findScopedLeave(id, actor);
  return leave.populate(POPULATE);
}

export async function applyLeave(data, actor) {
  await assertNoOverlap(actor._id, data);
  const days = await calculateLeaveDays(data);

  const leave = await Leave.create({ ...data, days, employee: actor._id, status: LEAVE_STATUS.PENDING });

  await notifyApprovers(
    {
      type: NOTIFICATION_TYPES.LEAVE_SUBMITTED,
      title: 'New leave request',
      message: `${fullName(actor)} requested ${days} day(s) of ${data.type} leave from ${data.startDate} to ${data.endDate}.`,
      link: `/leave?tab=team&leave=${leave.id}`,
    },
    actor._id,
  );

  return leave.populate(POPULATE);
}

export async function updateLeave(id, data, actor) {
  const leave = await findScopedLeave(id, actor);

  if (leave.status === LEAVE_STATUS.CANCELLED) {
    throw ApiError.conflict('Cancelled leave requests cannot be edited');
  }
  const own = isOwnLeave(leave, actor);
  if (own && !can(actor, 'leave', 'edit')) throw ApiError.forbidden();
  if (!own && !canManageLeave(actor)) throw ApiError.forbidden();
  if (own && !isAdmin(actor) && leave.status !== LEAVE_STATUS.PENDING) {
    throw ApiError.conflict('Only pending leave requests can be edited. Please contact your administrator.');
  }

  await assertNoOverlap(leave.employee, data, leave._id);
  const days = await calculateLeaveDays(data);

  Object.assign(leave, data, { days, lastEditedBy: actor._id });
  await leave.save();
  return leave.populate(POPULATE);
}

export async function cancelLeave(id, actor) {
  // Cancelling is always self-service; approvers reject instead.
  const leave = await Leave.findOne({ _id: id, employee: actor._id });
  if (!leave) throw ApiError.notFound('Leave request not found');

  const cancellable =
    leave.status === LEAVE_STATUS.PENDING ||
    (leave.status === LEAVE_STATUS.APPROVED && leave.startDate > todayDateOnly());

  if (!cancellable) {
    throw ApiError.conflict('Only pending leaves, or approved leaves that have not started, can be cancelled');
  }

  const wasApproved = leave.status === LEAVE_STATUS.APPROVED;
  leave.status = LEAVE_STATUS.CANCELLED;
  leave.cancelledAt = new Date();
  await leave.save();
  await leave.populate(POPULATE);

  await notifyApprovers(
    {
      type: NOTIFICATION_TYPES.LEAVE_CANCELLED,
      title: wasApproved ? 'Approved leave cancelled' : 'Leave request cancelled',
      message: `${fullName(leave.employee)} cancelled their leave from ${leave.startDate} to ${leave.endDate}.`,
      link: `/leave?tab=team&leave=${leave.id}`,
    },
    actor._id,
  );

  return leave;
}

export async function reviewLeave(id, { status, reviewNote = '' }, actor) {
  const leave = await Leave.findById(id);
  if (!leave) throw ApiError.notFound('Leave request not found');
  if (isOwnLeave(leave, actor)) throw ApiError.forbidden('You cannot review your own leave request');

  if (leave.status === LEAVE_STATUS.CANCELLED) {
    throw ApiError.conflict('This leave request was cancelled by the employee');
  }
  if (leave.status === status) {
    throw ApiError.conflict(`This leave request is already ${status}`);
  }
  if (status === LEAVE_STATUS.APPROVED) {
    await assertNoOverlap(leave.employee, leave, leave._id);
  }

  Object.assign(leave, { status, reviewNote, reviewedBy: actor._id, reviewedAt: new Date() });
  await leave.save();

  const approved = status === LEAVE_STATUS.APPROVED;
  await notify(leave.employee, {
    type: approved ? NOTIFICATION_TYPES.LEAVE_APPROVED : NOTIFICATION_TYPES.LEAVE_REJECTED,
    title: approved ? 'Leave approved' : 'Leave rejected',
    message: `Your ${leave.type} leave from ${leave.startDate} to ${leave.endDate} was ${status} by ${fullName(actor)}.${
      reviewNote ? ` Note: ${reviewNote}` : ''
    }`,
    link: `/leave?leave=${leave.id}`,
  });

  return leave.populate(POPULATE);
}

/**
 * What an employee is entitled to this year and how much of it is gone.
 *
 * `used` is derived from the approved leave itself rather than a running
 * counter, so approving spends the allowance, and rejecting, cancelling or
 * deleting a request gives it straight back — the two can never drift apart.
 */
export async function getLeaveBalances(employeeId, { year = Number(todayDateOnly().slice(0, 4)) } = {}) {
  const { User } = await import('../users/user.model.js');
  const employee = await User.findById(employeeId).select('leaveEntitlements').lean();
  if (!employee) throw ApiError.notFound('Employee not found');

  const rows = await Leave.aggregate([
    {
      $match: {
        employee: new mongoose.Types.ObjectId(String(employeeId)),
        status: { $in: [LEAVE_STATUS.APPROVED, LEAVE_STATUS.PENDING] },
        startDate: { $gte: `${year}-01-01`, $lte: `${year}-12-31` },
      },
    },
    { $group: { _id: { type: '$type', status: '$status' }, days: { $sum: '$days' } } },
  ]);

  const entitlements = employee.leaveEntitlements ?? {};
  const types = LEAVE_TYPES.map((type) => {
    const used = rows.find((r) => r._id.type === type && r._id.status === LEAVE_STATUS.APPROVED)?.days ?? 0;
    const pending = rows.find((r) => r._id.type === type && r._id.status === LEAVE_STATUS.PENDING)?.days ?? 0;
    // `null` allowance means the type is uncapped, so there is nothing to run down.
    const allowed = entitlements[type] ?? null;
    return { type, allowed, used, pending, remaining: allowed === null ? null : allowed - used };
  });

  return { year, types };
}

/** Per-type totals for a year, scoped to the actor (or organisation-wide for approvers). */
export async function getLeaveSummary(actor, { year = Number(todayDateOnly().slice(0, 4)), scope } = {}) {
  const match = {
    ...leaveScope(actor, scope),
    startDate: { $gte: `${year}-01-01`, $lte: `${year}-12-31` },
  };

  const rows = await Leave.aggregate([
    { $match: match },
    { $group: { _id: { status: '$status', type: '$type' }, days: { $sum: '$days' }, count: { $sum: 1 } } },
  ]);

  const byType = Object.fromEntries(LEAVE_TYPES.map((t) => [t, { approvedDays: 0, pendingDays: 0 }]));
  const byStatus = Object.fromEntries(Object.values(LEAVE_STATUS).map((s) => [s, 0]));

  for (const { _id, days, count } of rows) {
    byStatus[_id.status] += count;
    if (_id.status === LEAVE_STATUS.APPROVED) byType[_id.type].approvedDays += days;
    if (_id.status === LEAVE_STATUS.PENDING) byType[_id.type].pendingDays += days;
  }

  const approvedDays = Object.values(byType).reduce((sum, t) => sum + t.approvedDays, 0);
  return { year, byType, byStatus, approvedDays };
}

/** Approved leaves covering a given date — organisation-wide, admin use only. */
export async function listOnLeave(date = todayDateOnly()) {
  return Leave.find({ status: LEAVE_STATUS.APPROVED, startDate: { $lte: date }, endDate: { $gte: date } })
    .populate('employee', USER_SUMMARY_FIELDS)
    .sort({ endDate: 1 });
}
