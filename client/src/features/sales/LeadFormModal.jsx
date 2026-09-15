import { zodResolver } from '@hookform/resolvers/zod';
import { Settings2 } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Button, FormField, Modal, Select, Skeleton } from '@/components/ui';
import { useAuth } from '@/features/auth/useAuth';
import { useDirectory } from '@/features/employees/api';
import { applyServerErrors } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useCreateLead, useSalesConfig, useUpdateLead } from './api';
import { FieldInput } from './fields';
import { buildLeadSchema, initialLeadValues, toLeadPayload } from './leadForm';

const WIDE_TYPES = new Set(['textarea']);

export function LeadFormModal({ open, onOpenChange, lead, defaults, onSaved }) {
  const { user, isAdmin } = useAuth();
  const isEdit = Boolean(lead);
  const config = useSalesConfig();
  const directory = useDirectory();
  const create = useCreateLead();
  const update = useUpdateLead();
  const mutation = isEdit ? update : create;

  // The form is generated from the admin-configured, visible fields.
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
      data: { ...initialLeadValues(fields, lead), ...(lead ? {} : defaults) },
      owner: lead?.owner?.id ?? user.id,
    });
  }, [open, fields, lead, defaults, reset, user.id]);

  const onSubmit = async (values) => {
    const body = { data: toLeadPayload(fields, values.data), owner: values.owner || undefined };
    try {
      const saved = isEdit ? await update.mutateAsync({ id: lead.id, ...body }) : await create.mutateAsync(body);
      toast.success(isEdit ? 'Lead updated' : 'Lead created');
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
      title={isEdit ? 'Edit lead' : 'Add lead'}
      description={isEdit ? 'Changes are visible to everyone in Sales.' : 'Leads are shared with the whole team.'}
      footer={
        <>
          {isAdmin && (
            <Button as={Link} to="/sales/configuration" variant="ghost" size="sm" leftIcon={Settings2} className="mr-auto">
              Configure fields
            </Button>
          )}
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="lead-form" loading={mutation.isPending} disabled={config.isPending}>
            {isEdit ? 'Save changes' : 'Create lead'}
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
        <form id="lead-form" onSubmit={handleSubmit(onSubmit)} noValidate>
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
                <FormField label="Owner" error={errors.owner?.message} hint="The teammate responsible for this lead." className="sm:col-span-2">
                  {(ids) => (
                    <Select {...ids} value={field.value} onChange={field.onChange}>
                      {(directory.data ?? []).map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.fullName}
                          {person.id === user.id ? ' (you)' : ''}
                          {person.designation ? ` — ${person.designation}` : ''}
                        </option>
                      ))}
                      {lead?.owner && !directory.data?.some((p) => p.id === lead.owner.id) && (
                        <option value={lead.owner.id}>
                          {lead.owner.firstName} {lead.owner.lastName} (inactive)
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
