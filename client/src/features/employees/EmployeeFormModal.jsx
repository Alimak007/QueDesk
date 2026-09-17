import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button, FormField, Input, Modal, RadioCards } from '@/components/ui';
import { applyServerErrors } from '@/lib/api';
import { DEFAULT_LEAVE_ENTITLEMENTS, LEAVE_TYPES } from '@/lib/constants';
import { useCreateEmployee, useDepartments, useUpdateEmployee } from './api';
import { generatePassword, passwordRule } from './passwords';

const base = {
  firstName: z.string().trim().min(1, 'First name is required').max(60),
  lastName: z.string().trim().max(60).optional(),
  email: z.string().trim().min(1, 'Email is required').pipe(z.email('Enter a valid email address')),
  employeeId: z.string().trim().max(20).regex(/^[A-Za-z0-9-_]*$/, 'Letters, numbers, - and _ only').optional(),
  phone: z.string().trim().max(20).regex(/^[+\d\s()-]*$/, 'Digits, spaces and + ( ) - only').optional(),
  department: z.string().trim().max(80).optional(),
  designation: z.string().trim().max(80).optional(),
  joiningDate: z.string().optional(),
  role: z.enum(['employee', 'admin']),
};

/** Blank means the type is uncapped, so an empty string is a valid entitlement. */
const entitlement = z
  .union([z.literal(''), z.coerce.number().int('Whole days only').min(0, 'Cannot be negative').max(366, 'That is more than a year')])
  .optional();

const leaveEntitlements = z.object(Object.fromEntries(LEAVE_TYPES.map((t) => [t.value, entitlement])));

const createSchema = z.object({ ...base, leaveEntitlements, password: passwordRule });
const editSchema = z.object({
  ...base,
  leaveEntitlements,
  employeeId: base.employeeId.refine((v) => v?.length, 'Employee ID is required'),
});

/** The form keeps entitlements as strings; blank round-trips as null (no limit). */
const entitlementsToForm = (stored) =>
  Object.fromEntries(
    LEAVE_TYPES.map((t) => {
      const value = stored?.[t.value];
      return [t.value, value === null || value === undefined ? '' : String(value)];
    }),
  );

const entitlementsToApi = (values) =>
  Object.fromEntries(LEAVE_TYPES.map((t) => [t.value, values[t.value] === '' ? null : Number(values[t.value])]));

const empty = () => ({
  firstName: '',
  lastName: '',
  email: '',
  employeeId: '',
  phone: '',
  department: '',
  designation: '',
  joiningDate: '',
  role: 'employee',
  leaveEntitlements: entitlementsToForm(DEFAULT_LEAVE_ENTITLEMENTS),
  password: generatePassword(),
});

export function EmployeeFormModal({ open, onOpenChange, employee, onCreated }) {
  const isEdit = Boolean(employee);
  const create = useCreateEmployee();
  const update = useUpdateEmployee();
  const departments = useDepartments();
  const mutation = isEdit ? update : create;
  const [showPassword, setShowPassword] = useState(true);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(isEdit ? editSchema : createSchema), defaultValues: empty() });

  useEffect(() => {
    if (!open) return;
    reset(
      employee
        ? {
            firstName: employee.firstName,
            lastName: employee.lastName ?? '',
            email: employee.email,
            employeeId: employee.employeeId,
            phone: employee.phone ?? '',
            department: employee.department ?? '',
            designation: employee.designation ?? '',
            joiningDate: employee.joiningDate ?? '',
            role: employee.role,
            leaveEntitlements: entitlementsToForm(employee.leaveEntitlements),
          }
        : empty(),
    );
  }, [open, employee, reset]);

  const onSubmit = async ({ joiningDate, employeeId, leaveEntitlements: entitlements, ...values }) => {
    const body = { ...values, joiningDate: joiningDate || null, leaveEntitlements: entitlementsToApi(entitlements) };
    if (employeeId) body.employeeId = employeeId;
    try {
      const saved = isEdit ? await update.mutateAsync({ id: employee.id, ...body }) : await create.mutateAsync(body);
      toast.success(isEdit ? 'Employee updated' : 'Employee added', {
        description: isEdit ? undefined : `${saved.fullName} (${saved.employeeId}) can now sign in.`,
      });
      if (!isEdit) onCreated?.(saved, values.password);
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
      title={isEdit ? 'Edit employee' : 'Add employee'}
      description={isEdit ? `${employee.employeeId} · ${employee.email}` : 'Create an account so this person can sign in to the portal.'}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="employee-form" loading={mutation.isPending}>
            {isEdit ? 'Save changes' : 'Add employee'}
          </Button>
        </>
      }
    >
      <form id="employee-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <fieldset className="space-y-4">
          <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Personal details</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="First name" required error={errors.firstName?.message}>
              {(field) => <Input {...field} autoComplete="off" {...register('firstName')} />}
            </FormField>
            <FormField label="Last name" error={errors.lastName?.message}>
              {(field) => <Input {...field} autoComplete="off" {...register('lastName')} />}
            </FormField>
            <FormField label="Work email" required error={errors.email?.message}>
              {(field) => <Input {...field} type="email" autoComplete="off" placeholder="name@company.com" {...register('email')} />}
            </FormField>
            <FormField label="Phone" error={errors.phone?.message}>
              {(field) => <Input {...field} type="tel" placeholder="+91 98765 43210" {...register('phone')} />}
            </FormField>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Employment</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Employee ID"
              required={isEdit}
              error={errors.employeeId?.message}
              hint={isEdit ? undefined : 'Leave blank to auto-generate (e.g. EMP-0007).'}
            >
              {(field) => <Input {...field} className="uppercase" placeholder={isEdit ? '' : 'Auto'} {...register('employeeId')} />}
            </FormField>
            <FormField label="Joining date" error={errors.joiningDate?.message}>
              {(field) => <Input {...field} type="date" {...register('joiningDate')} />}
            </FormField>
            <FormField label="Department" error={errors.department?.message}>
              {(field) => (
                <>
                  <Input {...field} list="department-options" placeholder="e.g. Engineering" {...register('department')} />
                  <datalist id="department-options">
                    {(departments.data ?? []).map((d) => (
                      <option key={d} value={d} />
                    ))}
                  </datalist>
                </>
              )}
            </FormField>
            <FormField label="Designation" error={errors.designation?.message}>
              {(field) => <Input {...field} placeholder="e.g. Software Engineer" {...register('designation')} />}
            </FormField>
          </div>
          <FormField label="Role" required hint="Admins can manage employees, approve leave and configure Sales.">
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <RadioCards
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    { value: 'employee', label: 'Employee', dot: 'bg-slate-400' },
                    { value: 'admin', label: 'Admin', dot: 'bg-brand-500' },
                  ]}
                />
              )}
            />
          </FormField>
        </fieldset>

        <fieldset>
          <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Leave entitlement</legend>
          <p className="mb-3 text-xs text-slate-500">
            Days of each type this person may take per calendar year. Approved leave is deducted from the balance; rejected and
            cancelled requests are not. Leave a box empty for no limit.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            {LEAVE_TYPES.map((type) => (
              <FormField key={type.value} label={type.label} error={errors.leaveEntitlements?.[type.value]?.message}>
                {(field) => (
                  <Input
                    {...field}
                    type="number"
                    min="0"
                    max="366"
                    step="1"
                    placeholder="No limit"
                    {...register(`leaveEntitlements.${type.value}`)}
                  />
                )}
              </FormField>
            ))}
          </div>
        </fieldset>

        {!isEdit && (
          <fieldset>
            <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Sign-in</legend>
            <FormField label="Temporary password" required error={errors.password?.message} hint="Share this securely. The employee can change it from their profile.">
              {(field) => (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      {...field}
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      className="font-mono"
                      {...register('password')}
                      rightSlot={
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="rounded-md p-2 text-slate-400 hover:text-slate-600"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      }
                    />
                  </div>
                  <Button
                    variant="secondary"
                    leftIcon={RefreshCw}
                    onClick={() => setValue('password', generatePassword(), { shouldValidate: true })}
                  >
                    Generate
                  </Button>
                </div>
              )}
            </FormField>
          </fieldset>
        )}
      </form>
    </Modal>
  );
}
