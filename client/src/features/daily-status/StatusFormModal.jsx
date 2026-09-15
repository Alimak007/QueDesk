import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button, FormField, Input, Modal, Textarea, UserCell } from '@/components/ui';
import { applyServerErrors } from '@/lib/api';
import { formatDate, todayDateOnly } from '@/lib/dates';
import { useCreateStatus, useUpdateStatus } from './api';

const schema = z.object({
  date: z.string().min(1, 'Date is required'),
  workDone: z.string().trim().min(3, 'Describe what you worked on (at least 3 characters)').max(5000),
  planNext: z.string().trim().max(3000).optional(),
  blockers: z.string().trim().max(2000).optional(),
  hoursWorked: z
    .union([z.literal(''), z.coerce.number().min(0, 'Cannot be negative').max(24, 'Cannot exceed 24 hours')])
    .optional(),
});

const empty = () => ({ date: todayDateOnly(), workDone: '', planNext: '', blockers: '', hoursWorked: '' });

export function StatusFormModal({ open, onOpenChange, report, defaultDate }) {
  const isEdit = Boolean(report);
  const create = useCreateStatus();
  const update = useUpdateStatus();
  const mutation = isEdit ? update : create;

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: empty() });

  useEffect(() => {
    if (!open) return;
    reset(
      report
        ? {
            date: report.date,
            workDone: report.workDone,
            planNext: report.planNext ?? '',
            blockers: report.blockers ?? '',
            hoursWorked: report.hoursWorked ?? '',
          }
        : { ...empty(), date: defaultDate ?? todayDateOnly() },
    );
  }, [open, report, defaultDate, reset]);

  const workDone = useWatch({ control, name: 'workDone' }) ?? '';

  const onSubmit = async ({ date, hoursWorked, ...values }) => {
    const body = { ...values, hoursWorked: hoursWorked === '' || hoursWorked === undefined ? null : Number(hoursWorked) };
    try {
      if (isEdit) await update.mutateAsync({ id: report.id, ...body });
      else await create.mutateAsync({ date, ...body });
      toast.success(isEdit ? 'Status report updated' : 'Status report submitted');
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
      title={isEdit ? 'Edit status report' : 'Add daily status'}
      description={isEdit ? `Report for ${formatDate(report.date, 'EEEE, d MMMM yyyy')}` : 'Share what you worked on today.'}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="status-form" loading={mutation.isPending}>
            {isEdit ? 'Save changes' : 'Submit report'}
          </Button>
        </>
      }
    >
      <form id="status-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {isEdit && report.employee?.firstName && (
          <div className="rounded-xl border border-slate-200 p-3">
            <UserCell user={report.employee} />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Date" required error={errors.date?.message} hint={isEdit ? 'The date of a report cannot be changed.' : undefined}>
            {(field) => <Input {...field} type="date" max={todayDateOnly()} readOnly={isEdit} className={isEdit ? "bg-slate-50 text-slate-500" : undefined} {...register('date')} />}
          </FormField>
          <FormField label="Hours worked" error={errors.hoursWorked?.message}>
            {(field) => (
              <Input {...field} type="number" inputMode="decimal" step="0.5" min="0" max="24" placeholder="e.g. 8" {...register('hoursWorked')} />
            )}
          </FormField>
        </div>

        <FormField
          label="What did you work on?"
          required
          error={errors.workDone?.message}
          hint={<span className="flex justify-between"><span>Tip: one item per line reads best.</span><span className="tabular">{workDone.length}/5000</span></span>}
        >
          {(field) => (
            <Textarea
              {...field}
              rows={6}
              placeholder={'• Implemented the leave approval flow\n• Reviewed pull requests'}
              {...register('workDone')}
            />
          )}
        </FormField>

        <FormField label="Plan for next working day" error={errors.planNext?.message}>
          {(field) => <Textarea {...field} rows={3} placeholder="What’s next on your list?" {...register('planNext')} />}
        </FormField>

        <FormField label="Blockers" error={errors.blockers?.message} hint="Anything slowing you down that the team should know about.">
          {(field) => <Textarea {...field} rows={2} placeholder="None" {...register('blockers')} />}
        </FormField>
      </form>
    </Modal>
  );
}
