import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck2, CircleAlert } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button, Checkbox, FormField, Input, Modal, RadioCards, Spinner, Textarea } from '@/components/ui';
import { useDebouncedValue } from '@/hooks';
import { applyServerErrors } from '@/lib/api';
import { cn } from '@/lib/utils';
import { HALF_DAY_SESSIONS, LEAVE_TYPE_MAP, LEAVE_TYPES } from '@/lib/constants';
import { todayDateOnly } from '@/lib/dates';
import { previewLeaveDays, useApplyLeave, useLeaveBalances, useUpdateLeave } from './api';

const schema = z
  .object({
    type: z.enum(LEAVE_TYPES.map((t) => t.value), { error: 'Select a leave type' }),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().min(1, 'End date is required'),
    // Disabled checkboxes are reported as undefined by react-hook-form.
    isHalfDay: z.boolean().optional().transform(Boolean),
    halfDaySession: z.string().nullable(),
    reason: z.string().trim().min(3, 'Please add a short reason (at least 3 characters)').max(1000),
  })
  .superRefine((v, ctx) => {
    if (v.startDate && v.endDate && v.endDate < v.startDate) {
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End date cannot be before start date' });
    }
    if (v.isHalfDay && !v.halfDaySession) {
      ctx.addIssue({ code: 'custom', path: ['halfDaySession'], message: 'Select which half of the day' });
    }
  });

const emptyValues = () => ({
  type: 'casual',
  startDate: todayDateOnly(),
  endDate: todayDateOnly(),
  isHalfDay: false,
  halfDaySession: null,
  reason: '',
});

export function LeaveFormModal({ open, onOpenChange, leave }) {
  const isEdit = Boolean(leave);
  const applyLeave = useApplyLeave();
  const updateLeave = useUpdateLeave();
  const mutation = isEdit ? updateLeave : applyLeave;

  const form = useForm({ resolver: zodResolver(schema), defaultValues: emptyValues() });
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    setError,
    formState: { errors },
  } = form;

  useEffect(() => {
    if (!open) return;
    reset(
      leave
        ? {
            type: leave.type,
            startDate: leave.startDate,
            endDate: leave.endDate,
            isHalfDay: leave.isHalfDay,
            halfDaySession: leave.halfDaySession,
            reason: leave.reason,
          }
        : emptyValues(),
    );
  }, [open, leave, reset]);

  const [type, startDate, endDate, isHalfDay, halfDaySession] = useWatch({
    control,
    name: ['type', 'startDate', 'endDate', 'isHalfDay', 'halfDaySession'],
  });
  const balances = useLeaveBalances();
  const balance = balances.data?.types.find((t) => t.type === type);
  const singleDay = Boolean(startDate) && startDate === endDate;

  useEffect(() => {
    if (!singleDay && isHalfDay) setValue('isHalfDay', false);
  }, [singleDay, isHalfDay, setValue]);

  const previewInput = useDebouncedValue(
    { startDate, endDate, isHalfDay: singleDay && isHalfDay, halfDaySession: halfDaySession || 'first_half' },
    300,
  );
  const canPreview = Boolean(previewInput.startDate && previewInput.endDate && previewInput.endDate >= previewInput.startDate);
  const preview = useQuery({
    queryKey: ['leaves', 'preview', previewInput],
    queryFn: () => previewLeaveDays({ ...previewInput, type: 'casual', reason: 'preview' }),
    enabled: open && canPreview,
    retry: false,
    staleTime: 60_000,
  });

  // Editing an approved request already spends its days, so exclude them from the comparison.
  const alreadyCounted = isEdit && leave?.status === 'approved' && leave.type === type ? leave.days : 0;
  const overAllowance =
    balance?.allowed !== null && balance !== undefined && preview.data !== undefined
      ? balance.used - alreadyCounted + preview.data > balance.allowed
      : false;

  const onSubmit = async (values) => {
    const body = { ...values, halfDaySession: values.isHalfDay ? values.halfDaySession : null };
    try {
      await mutation.mutateAsync(isEdit ? { id: leave.id, ...body } : body);
      toast.success(isEdit ? 'Leave request updated' : 'Leave request submitted', {
        description: isEdit ? undefined : 'Your administrator has been notified.',
      });
      onOpenChange(false);
    } catch (err) {
      if (!applyServerErrors(err, setError)) toast.error(err.message);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={isEdit ? 'Edit leave request' : 'Apply for leave'}
      description={isEdit ? 'Update the details of this request.' : 'Your request will be sent to an administrator for approval.'}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="leave-form" loading={mutation.isPending}>
            {isEdit ? 'Save changes' : 'Submit request'}
          </Button>
        </>
      }
    >
      <form id="leave-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <FormField
          label="Leave type"
          required
          error={errors.type?.message}
          hint={
            balance
              ? balance.allowed === null
                ? `${LEAVE_TYPE_MAP[type]?.short ?? type} has no yearly limit.`
                : `${balance.remaining} of ${balance.allowed} ${LEAVE_TYPE_MAP[type]?.short ?? type} days left this year.`
              : undefined
          }
        >
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <RadioCards
                value={field.value}
                onChange={field.onChange}
                columns={3}
                className="max-sm:grid-cols-2!"
                options={LEAVE_TYPES.map((t) => ({ value: t.value, label: t.short, dot: t.dot }))}
              />
            )}
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="From" required error={errors.startDate?.message}>
            {(field) => (
              <Input
                {...field}
                type="date"
                {...register('startDate', {
                  onChange: (e) => {
                    const end = form.getValues('endDate');
                    if (!end || end < e.target.value) setValue('endDate', e.target.value);
                  },
                })}
              />
            )}
          </FormField>
          <FormField label="To" required error={errors.endDate?.message}>
            {(field) => <Input {...field} type="date" min={startDate || undefined} {...register('endDate')} />}
          </FormField>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Checkbox
              label="Half-day leave"
              description={singleDay ? 'Take only part of the day off.' : 'Available when From and To are the same day.'}
              disabled={!singleDay}
              {...register('isHalfDay')}
            />
            <div className="flex items-center gap-2 text-sm" aria-live="polite">
              {!canPreview ? null : preview.isFetching ? (
                <Spinner size={16} />
              ) : preview.isError ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-amber-700">
                  <CircleAlert size={16} /> {preview.error.message}
                </span>
              ) : preview.data !== undefined ? (
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 font-medium ring-1',
                    overAllowance ? 'text-amber-700 ring-amber-300' : 'text-brand-700 ring-brand-200',
                  )}
                >
                  <CalendarCheck2 size={15} />
                  {preview.data} {preview.data === 1 ? 'day' : 'days'}
                </span>
              ) : null}
            </div>
          </div>

          {singleDay && isHalfDay && (
            <FormField className="mt-3" error={errors.halfDaySession?.message}>
              <Controller
                control={control}
                name="halfDaySession"
                render={({ field }) => (
                  <RadioCards value={field.value} onChange={field.onChange} options={HALF_DAY_SESSIONS} />
                )}
              />
            </FormField>
          )}
        </div>

        <FormField label="Reason" required error={errors.reason?.message} hint="Saturdays and Sundays are not counted.">
          {(field) => <Textarea {...field} rows={3} placeholder="e.g. Personal work" {...register('reason')} />}
        </FormField>
      </form>
    </Modal>
  );
}
