import { Ban, Check, CircleCheck, CircleX, Clock3, Pencil, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button, ConfirmDialog, DescriptionList, ErrorState, FormField, Sheet, Spinner, Textarea, UserCell } from '@/components/ui';
import { useAuth } from '@/features/auth/useAuth';
import { usePermissions } from '@/features/auth/usePermissions';
import { useResetOnChange } from '@/hooks';
import { formatDate, formatDateRange, timeAgo } from '@/lib/dates';
import { cn, fullName } from '@/lib/utils';
import { useCancelLeave, useLeave, useReviewLeave } from './api';
import { LeaveStatusBadge, LeaveTypeLabel } from './components';
import { formatLeaveDays, leavePermissions } from './utils';

function TimelineItem({ icon: Icon, tone, title, meta, children, last }) {
  return (
    <li className="relative flex gap-3 pb-5">
      {!last && <span className="absolute left-4 top-9 -bottom-0 w-px bg-slate-200" aria-hidden />}
      <span className={cn('relative flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white', tone)}>
        <Icon size={15} />
      </span>
      <div className="min-w-0 pt-1">
        <p className="text-sm font-medium text-slate-900">{title}</p>
        {meta && <p className="text-xs text-slate-500">{meta}</p>}
        {children}
      </div>
    </li>
  );
}

export function LeaveDetailsSheet({ leaveId, open, onOpenChange, onEdit, initialReviewMode = null }) {
  const { isAdmin, user } = useAuth();
  const { can } = usePermissions();
  const { data: leave, isPending, isError, error, refetch } = useLeave(open ? leaveId : null);
  const reviewLeave = useReviewLeave();
  const cancelLeave = useCancelLeave();
  const [reviewMode, setReviewMode] = useState(initialReviewMode);
  const [note, setNote] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);

  const perms = leavePermissions(leave, { can, isAdmin, userId: user.id });

  const reopened = useResetOnChange(open ? `${leaveId}:${initialReviewMode}` : null);
  if (reopened) {
    setReviewMode(initialReviewMode);
    setNote('');
  }

  const closeReview = () => {
    setReviewMode(null);
    setNote('');
  };

  const submitReview = async () => {
    try {
      await reviewLeave.mutateAsync({ id: leave.id, status: reviewMode, reviewNote: note.trim() || undefined });
      toast.success(reviewMode === 'approved' ? 'Leave approved' : 'Leave rejected', {
        description: `${fullName(leave.employee)} has been notified.`,
      });
      closeReview();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const submitCancel = async () => {
    try {
      await cancelLeave.mutateAsync(leave.id);
      toast.success('Leave request cancelled');
      setConfirmCancel(false);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const footer =
    leave && (perms.canEdit || perms.canCancel || perms.canApprove || perms.canReject) && !reviewMode ? (
      <>
        {perms.canCancel && (
          <Button variant="danger-soft" leftIcon={Ban} onClick={() => setConfirmCancel(true)} className="mr-auto">
            Cancel request
          </Button>
        )}
        {perms.canEdit && (
          <Button variant="secondary" leftIcon={Pencil} onClick={() => onEdit(leave)}>
            Edit
          </Button>
        )}
        {perms.canReject && (
          <Button variant="danger-soft" leftIcon={X} onClick={() => setReviewMode('rejected')}>
            Reject
          </Button>
        )}
        {perms.canApprove && (
          <Button leftIcon={Check} onClick={() => setReviewMode('approved')}>
            Approve
          </Button>
        )}
      </>
    ) : null;

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next) closeReview();
          onOpenChange(next);
        }}
        title="Leave request"
        description={leave ? `Submitted ${timeAgo(leave.createdAt)}` : undefined}
        footer={footer}
      >
        {isPending ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <div className="space-y-6">
            {!perms.isOwn && (
              <div className="rounded-xl border border-slate-200 p-4">
                <UserCell
                  user={leave.employee}
                  size="md"
                  subtitle={[leave.employee?.employeeId, leave.employee?.department].filter(Boolean).join(' · ')}
                  to={`/employees/${leave.employee?.id}`}
                />
              </div>
            )}

            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xl font-semibold tracking-tight text-slate-900">{formatDateRange(leave.startDate, leave.endDate)}</p>
                <p className="mt-1 text-sm text-slate-500">{formatLeaveDays(leave)}</p>
              </div>
              <LeaveStatusBadge status={leave.status} />
            </div>

            <DescriptionList
              items={[
                { label: 'Type', value: <LeaveTypeLabel type={leave.type} /> },
                { label: 'Duration', value: leave.days },
                { label: 'Reason', value: <span className="whitespace-pre-wrap">{leave.reason}</span>, full: true },
              ]}
            />

            {reviewMode && (
              <div
                className={cn(
                  'rounded-xl border p-4',
                  reviewMode === 'approved' ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50',
                )}
              >
                <p className="text-sm font-semibold text-slate-900">
                  {reviewMode === 'approved' ? 'Approve this leave?' : 'Reject this leave?'}
                </p>
                <p className="mt-0.5 text-xs text-slate-600">The employee will be notified of your decision.</p>
                <FormField label="Note to employee (optional)" className="mt-3">
                  {(field) => (
                    <Textarea
                      {...field}
                      rows={3}
                      value={note}
                      maxLength={500}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder={reviewMode === 'rejected' ? 'e.g. Please reschedule after the release.' : 'e.g. Enjoy your time off!'}
                    />
                  )}
                </FormField>
                <div className="mt-3 flex justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={closeReview} disabled={reviewLeave.isPending}>
                    Back
                  </Button>
                  <Button
                    size="sm"
                    variant={reviewMode === 'approved' ? 'primary' : 'danger'}
                    loading={reviewLeave.isPending}
                    onClick={submitReview}
                  >
                    {reviewMode === 'approved' ? 'Confirm approval' : 'Confirm rejection'}
                  </Button>
                </div>
              </div>
            )}

            <section>
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">Activity</h3>
              <ol>
                <TimelineItem
                  icon={Clock3}
                  tone="bg-slate-100 text-slate-600"
                  title="Request submitted"
                  meta={formatDate(leave.createdAt, 'd MMM yyyy, h:mm a')}
                  last={!leave.reviewedAt && !leave.cancelledAt}
                />
                {leave.reviewedAt && (
                  <TimelineItem
                    icon={leave.status === 'rejected' ? CircleX : CircleCheck}
                    tone={leave.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}
                    title={`${leave.status === 'rejected' ? 'Rejected' : 'Approved'} by ${fullName(leave.reviewedBy) || 'an admin'}`}
                    meta={formatDate(leave.reviewedAt, 'd MMM yyyy, h:mm a')}
                    last={!leave.cancelledAt}
                  >
                    {leave.reviewNote && (
                      <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">
                        “{leave.reviewNote}”
                      </p>
                    )}
                  </TimelineItem>
                )}
                {leave.cancelledAt && (
                  <TimelineItem
                    icon={Ban}
                    tone="bg-slate-100 text-slate-600"
                    title="Cancelled by employee"
                    meta={formatDate(leave.cancelledAt, 'd MMM yyyy, h:mm a')}
                    last
                  />
                )}
              </ol>
              {leave.lastEditedBy && (
                <p className="mt-1 text-xs text-slate-400">Last edited by {fullName(leave.lastEditedBy)}</p>
              )}
            </section>
          </div>
        )}
      </Sheet>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel this leave request?"
        description="The request will be withdrawn. You can submit a new request later if needed."
        confirmLabel="Cancel request"
        cancelLabel="Keep request"
        loading={cancelLeave.isPending}
        onConfirm={submitCancel}
      />
    </>
  );
}
