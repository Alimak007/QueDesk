import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck2, CircleAlert } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button, Checkbox, FormField, Input, Modal, RadioCards, Select, Spinner, Textarea } from '@/components/ui';
import { useAuth } from '@/features/auth/useAuth';
import { useEmployeeOptions } from '@/features/employees/api';
import { useDebouncedValue } from '@/hooks';
import { applyServerErrors } from '@/lib/api';
import { HALF_DAY_SESSIONS, LEAVE_TYPES } from '@/lib/constants';
import { formatDate } from '@/lib/dates';
import { fullName } from '@/lib/utils';
import { previewLeaveDays, useRecordLeave } from './api';

const schema = z
  .object({
    employee: z.string().min(1, 'Select an employee'),
    type: z.enum(LEAVE_TYPES.map((t) => t.value), { error: 'Select a leave type' }),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().min(1, 'End date is required'),
    isHalfDay: z.boolean().optional().transform(Boolean),
    halfDaySession: z.string().nullable(),
    appliedOn: z.string().optional(),
    reason: z.string().trim().max(1000).optional(),
    reviewNote: z.string().trim().max(500).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.startDate && v.endDate && v.endDate < v.startDate) {
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End date cannot be before start date' });
    }
  });

const emptyValues = () => ({
  employee: '',
  type: 'casual',
  startDate: '',
  endDate: '',
  isHalfDay: false,
  halfDaySession: null,
  appliedOn: '',
  reason: '',
  reviewNote: '',
});

/**
 * Adds leave that was already approved — a past record from an old register,
 * or leave agreed outside the portal. It is saved as approved straight away and
 * nobody is notified.
 */
export function RecordLeaveModal({ open, onOpenChange }) {
  const { user } = useAuth();
  const employees = useEmployeeOptions({ enabled: open });
  const recordLeave = useRecordLeave();

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
    if (open) reset(emptyValues());
  }, [open, reset]);

  const [startDate, endDate, isHalfDay] = useWatch({ control, name: ['startDate', 'endDate', 'isHalfDay'] });
  const singleDay = Boolean(startDate) && startDate === endDate;

  useEffect(() => {
    if (!singleDay && isHalfDay) setValue('isHalfDay', false);
  }, [singleDay, isHalfDay, setValue]);

  const previewInput = useDebouncedValue({ startDate, endDate, isHalfDay: singleDay && isHalfDay }, 300);
  const canPreview = Boolean(previewInput.startDate && previewInput.endDate && previewInput.endDate >= previewInput.startDate);
  const preview = useQuery({
    queryKey: ['leaves', 'preview', { ...previewInput, halfDaySession: 'first_half' }],
    queryFn: () => previewLeaveDays({ ...previewInput, halfDaySession: 'first_half', type: 'casual', reason: 'preview' }),
    enabled: open && canPreview,
    retry: false,
    staleTime: 60_000,
  });

  const onSubmit = async (values) => {
    const body = {
      ...values,
      halfDaySession: values.isHalfDay ? values.halfDaySession : null,
      appliedOn: values.appliedOn || null,
    };
    try {
      const leave = await recordLeave.mutateAsync(body);
      toast.success('Leave recorded', {
        description: `${fullName(leave.employee)} · ${formatDate(leave.startDate)}${
          leave.endDate !== leave.startDate ? ` – ${formatDate(leave.endDate)}` : ''
        }`,
      });
      onOpenChange(false);
    } catch (err) {
      if (!applyServerErrors(err, setError)) toast.error(err.message);
    }
  };

  const people = (employees.data ?? []).filter((u) => u.id !== user.id);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Add past leave"
      description="Record leave that was already approved. It is saved as approved and the employee is not notified."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="record-leave-form" loading={recordLeave.isPending}>
            Record leave
          </Button>
        </>
      }
    >
      <form id="record-leave-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <FormField label="Employee" required error={errors.employee?.message}>
          {(field) => (
            <Select {...field} {...register('employee')} placeholder={employees.isPending ? 'Loading…' : 'Select an employee'}>
              {people.map((u) => (
                <option key={u.id} value={u.id}>
                  {fullName(u)}
                  {u.employeeId ? ` · ${u.employeeId}` : ''}
                  {u.status === 'inactive' ? ' (inactive)' : ''}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField label="Leave type" required error={errors.type?.message}>
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

        <div className="grid gap-4 sm:grid-cols-3">
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
          <FormField label="Applied on" error={errors.appliedOn?.message} hint="Optional">
            {(field) => <Input {...field} type="date" {...register('appliedOn')} />}
          </FormField>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Checkbox
              label="Half-day leave"
              description={singleDay ? 'Counts as half a day.' : 'Available when From and To are the same day.'}
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
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 font-medium text-brand-700 ring-1 ring-brand-200">
                  <CalendarCheck2 size={15} />
                  {preview.data} {preview.data === 1 ? 'day' : 'days'}
                </span>
              ) : null}
            </div>
          </div>
          {singleDay && isHalfDay && (
            <FormField className="mt-3" hint="Optional — leave it unselected if the register doesn’t say.">
              <Controller
                control={control}
                name="halfDaySession"
                render={({ field }) => <RadioCards value={field.value} onChange={field.onChange} options={HALF_DAY_SESSIONS} />}
              />
            </FormField>
          )}
        </div>

        <FormField label="Reason" error={errors.reason?.message} hint="Optional. Saturdays and Sundays are not counted.">
          {(field) => <Textarea {...field} rows={2} placeholder="e.g. Family function" {...register('reason')} />}
        </FormField>
        <FormField label="Remarks" error={errors.reviewNote?.message} hint="Optional. Shown on the leave as the approver’s note.">
          {(field) => <Textarea {...field} rows={2} placeholder="e.g. Approved by phone" {...register('reviewNote')} />}
        </FormField>
      </form>
    </Modal>
  );
}
