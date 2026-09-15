import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button, FormField, Input, Modal, RadioCards, Switch, Textarea } from '@/components/ui';
import { applyServerErrors } from '@/lib/api';
import { EVENT_TYPES } from '@/lib/constants';
import { todayDateOnly } from '@/lib/dates';
import { useCreateEvent, useUpdateEvent } from './api';

const schema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(150),
    type: z.enum(EVENT_TYPES.map((t) => t.value)),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().min(1, 'End date is required'),
    isAllDay: z.boolean(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    location: z.string().trim().max(200).optional(),
    description: z.string().trim().max(3000).optional(),
    additionalInfo: z.string().trim().max(2000).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.endDate < v.startDate) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End date cannot be before start date' });
    if (!v.isAllDay) {
      if (!v.startTime) ctx.addIssue({ code: 'custom', path: ['startTime'], message: 'Start time is required' });
      if (!v.endTime) ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'End time is required' });
      if (v.startTime && v.endTime && v.startDate === v.endDate && v.endTime <= v.startTime) {
        ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'End time must be after start time' });
      }
    }
  });

const empty = (date = todayDateOnly()) => ({
  title: '',
  type: 'event',
  startDate: date,
  endDate: date,
  isAllDay: true,
  startTime: '10:00',
  endTime: '11:00',
  location: '',
  description: '',
  additionalInfo: '',
});

export function EventFormModal({ open, onOpenChange, event, defaultDate }) {
  const isEdit = Boolean(event);
  const create = useCreateEvent();
  const update = useUpdateEvent();
  const mutation = isEdit ? update : create;

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: empty() });

  useEffect(() => {
    if (!open) return;
    reset(
      event
        ? {
            ...empty(),
            ...event,
            startTime: event.startTime || '10:00',
            endTime: event.endTime || '11:00',
            location: event.location ?? '',
            description: event.description ?? '',
            additionalInfo: event.additionalInfo ?? '',
          }
        : empty(defaultDate),
    );
  }, [open, event, defaultDate, reset]);

  const [isAllDay, startDate] = useWatch({ control, name: ['isAllDay', 'startDate'] });

  const onSubmit = async (values) => {
    const body = {
      title: values.title,
      type: values.type,
      startDate: values.startDate,
      endDate: values.endDate,
      isAllDay: values.isAllDay,
      startTime: values.isAllDay ? null : values.startTime,
      endTime: values.isAllDay ? null : values.endTime,
      location: values.location,
      description: values.description,
      additionalInfo: values.additionalInfo,
    };
    try {
      if (isEdit) await update.mutateAsync({ id: event.id, ...body });
      else await create.mutateAsync(body);
      toast.success(isEdit ? 'Event updated' : 'Event added to the calendar');
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
      title={isEdit ? 'Edit event' : 'New calendar event'}
      description="Events are visible to everyone in the organisation."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="event-form" loading={mutation.isPending}>
            {isEdit ? 'Save changes' : 'Add event'}
          </Button>
        </>
      }
    >
      <form id="event-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <FormField label="Title" required error={errors.title?.message}>
          {(field) => <Input {...field} placeholder="e.g. Diwali holiday, Quarterly town hall" {...register('title')} />}
        </FormField>

        <FormField label="Type" required>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <RadioCards value={field.value} onChange={field.onChange} columns={4} className="max-sm:grid-cols-2!" options={EVENT_TYPES} />
            )}
          />
        </FormField>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-slate-800">All-day event</p>
            <p className="text-xs text-slate-500">Turn off to set start and end times.</p>
          </div>
          <Controller
            control={control}
            name="isAllDay"
            render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="All-day event" />}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Start date" required error={errors.startDate?.message}>
            {(field) => (
              <Input
                {...field}
                type="date"
                {...register('startDate', {
                  onChange: (e) => {
                    if (getValues('endDate') < e.target.value) setValue('endDate', e.target.value);
                  },
                })}
              />
            )}
          </FormField>
          <FormField label="End date" required error={errors.endDate?.message}>
            {(field) => <Input {...field} type="date" min={startDate} {...register('endDate')} />}
          </FormField>
          {!isAllDay && (
            <>
              <FormField label="Start time" required error={errors.startTime?.message}>
                {(field) => <Input {...field} type="time" {...register('startTime')} />}
              </FormField>
              <FormField label="End time" required error={errors.endTime?.message}>
                {(field) => <Input {...field} type="time" {...register('endTime')} />}
              </FormField>
            </>
          )}
        </div>

        <FormField label="Location" error={errors.location?.message}>
          {(field) => <Input {...field} placeholder="Office, meeting room or video link" {...register('location')} />}
        </FormField>

        <FormField label="Description" error={errors.description?.message}>
          {(field) => <Textarea {...field} rows={3} placeholder="What is this event about?" {...register('description')} />}
        </FormField>

        <FormField label="Additional information" error={errors.additionalInfo?.message}>
          {(field) => <Textarea {...field} rows={2} placeholder="Dress code, what to bring, dial-in details…" {...register('additionalInfo')} />}
        </FormField>
      </form>
    </Modal>
  );
}
