import { todayDateOnly } from '@/lib/dates';

export function formatLeaveDays(leave) {
  if (leave.isHalfDay) return `Half day (${leave.halfDaySession === 'first_half' ? 'first half' : 'second half'})`;
  return `${leave.days} ${leave.days === 1 ? 'day' : 'days'}`;
}

/**
 * Mirrors the API rules so the UI only offers actions that will succeed.
 * Own leave follows the self-service rules; other people's leave needs the
 * `approve` permission.
 */
export function leavePermissions(leave, { can, isAdmin, userId }) {
  if (!leave) return {};
  const today = todayDateOnly();
  const own = String(leave.employee?.id ?? leave.employee) === String(userId);
  const approves = can('leave', 'approve');

  return {
    isOwn: own,
    canEdit: own
      ? can('leave', 'edit') && (isAdmin || leave.status === 'pending')
      : approves && leave.status !== 'cancelled',
    canCancel:
      own &&
      can('leave', 'delete') &&
      (leave.status === 'pending' || (leave.status === 'approved' && leave.startDate > today)),
    canApprove: !own && approves && ['pending', 'rejected'].includes(leave.status),
    canReject: !own && approves && ['pending', 'approved'].includes(leave.status),
  };
}
