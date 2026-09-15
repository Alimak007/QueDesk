import { todayDateOnly } from '@/lib/dates';

export function formatLeaveDays(leave) {
  if (leave.isHalfDay) return `Half day (${leave.halfDaySession === 'first_half' ? 'first half' : 'second half'})`;
  return `${leave.days} ${leave.days === 1 ? 'day' : 'days'}`;
}

/** Mirrors the API rules so the UI only offers actions that will succeed. */
export function leavePermissions(leave, { isAdmin }) {
  if (!leave) return {};
  const today = todayDateOnly();
  return {
    canEdit: isAdmin ? leave.status !== 'cancelled' : leave.status === 'pending',
    canCancel: !isAdmin && (leave.status === 'pending' || (leave.status === 'approved' && leave.startDate > today)),
    canApprove: isAdmin && ['pending', 'rejected'].includes(leave.status),
    canReject: isAdmin && ['pending', 'approved'].includes(leave.status),
  };
}
