import { zodResolver } from '@hookform/resolvers/zod';
import { Settings2 } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Button, FormField, Modal, Select, Skeleton } from '@/components/ui';
import { useAuth } from '@/features/auth/useAuth';
import { useDirectory } from '@/features/employees/api';
import { useSalesConfig } from '@/features/sales/api';
import { FieldInput } from '@/features/sales/fields';
import { buildLeadSchema, initialLeadValues, toLeadPayload } from '@/features/sales/leadForm';
import { applyServerErrors } from '@/lib/api';
import { cn } from '@/lib/utils';

const WIDE_TYPES = new Set(['textarea']);

/**
 * Add / edit form for any record type that uses the configurable field engine
 * (leads and customers). The form itself is generated from the admin's
 * configuration, so it always matches what Settings defines.
 */
export function RecordFormModal({
  entity,
  open,
  onOpenChange,
  record,
  defaults,
  onSaved,
  createMutation,
  updateMutation,
  labels,
}) {
  const { user, isAdmin } = useAuth();
  const isEdit = Boolean(record);
  const config = useSalesConfig({ entity });
  const directory = useDirectory();
  const mutation = isEdit ? updateMutation : createMutation;

  const fields = useMemo(() => (config.data?.fields ?? []).filter((f) => f.isVisible), [config.data]);
  const currency = config.data?.settings?.currency;
  const schema = useMemo(() => buildLeadSchema(fields), [fields]);

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { data: {}, owner: '' } });

  useEffect(() => {
    if (!open || !fields.length) return;
    reset({
      data: { ...initialLeadValues(fields, record), ...(record ? {} : defaults) },
      owner: record?.owner?.id ?? user.id,
    });
  }, [open, fields, record, defaults, reset, user.id]);

  const onSubmit = async (values) => {
    const body = { data: toLeadPayload(fields, values.data), owner: values.owner || undefined };
    try {
      const saved = isEdit ? await mutation.mutateAsync({ id: record.id, ...body }) : await mutation.mutateAsync(body);
      toast.success(isEdit ? labels.updated : labels.created);
      onSaved?.(saved);
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
      title={isEdit ? labels.editTitle : labels.createTitle}
      description={labels.description}
      footer={
        <>
          {isAdmin && (
            <Button as={Link} to={`/settings?tab=${entity}-form`} variant="ghost" size="sm" leftIcon={Settings2} className="mr-auto">
              Configure fields
            </Button>
          )}
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form={`${entity}-form`} loading={mutation.isPending} disabled={config.isPending}>
            {isEdit ? 'Save changes' : labels.submit}
          </Button>
        </>
      }
    >
      {config.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <form id={`${entity}-form`} onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
            {fields.map((field) => (
              <Controller
                key={field.key}
                control={control}
                name={`data.${field.key}`}
                render={({ field: control_, fieldState }) => (
                  <FormField
                    label={field.label}
                    required={field.required}
                    error={fieldState.error?.message}
                    hint={field.helpText}
                    className={cn(WIDE_TYPES.has(field.type) && 'sm:col-span-2')}
                  >
                    {(ids) => (
                      <FieldInput
                        {...ids}
                        field={field}
                        currency={currency}
                        value={control_.value}
                        onChange={control_.onChange}
                        onBlur={control_.onBlur}
                        invalid={Boolean(fieldState.error)}
                      />
                    )}
                  </FormField>
                )}
              />
            ))}

            <Controller
              control={control}
              name="owner"
              render={({ field }) => (
                <FormField label="Owner" error={errors.owner?.message} hint={labels.ownerHint} className="sm:col-span-2">
                  {(ids) => (
                    <Select {...ids} value={field.value} onChange={field.onChange}>
                      {(directory.data ?? []).map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.fullName}
                          {person.id === user.id ? ' (you)' : ''}
                          {person.designation ? ` — ${person.designation}` : ''}
                        </option>
                      ))}
                      {record?.owner && !directory.data?.some((p) => p.id === record.owner.id) && (
                        <option value={record.owner.id}>
                          {record.owner.firstName} {record.owner.lastName} (inactive)
                        </option>
                      )}
                    </Select>
                  )}
                </FormField>
              )}
            />
          </div>
        </form>
      )}
    </Modal>
  );
}
