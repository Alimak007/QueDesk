import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Copy, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button, Card, CardHeader, ErrorState, FormField, Input, PageHeader, Select, Skeleton, Textarea } from '@/components/ui';
import { useEmployeeOptions } from '@/features/employees/api';
import { NoCompanyNotice } from '@/features/documents/NoCompanyNotice';
import { useCompanies } from '@/features/settings/api';
import { useDocumentTitle } from '@/hooks';
import { applyServerErrors } from '@/lib/api';
import { todayDateOnly } from '@/lib/dates';
import { formatCurrency, fullName } from '@/lib/utils';
import { useCreatePayslip, usePayslip, usePayslipDefaults, useUpdatePayslip } from './api';

const componentSchema = z.object({
  label: z.string().trim().min(1, 'Label is required').max(60),
  amount: z.coerce.number({ error: 'Enter an amount' }).min(0, 'Cannot be negative'),
});

const schema = z
  .object({
    employee: z.string().min(1, 'Select an employee'),
    company: z.string().min(1, 'Select a company'),
    periodStart: z.string().min(1, 'Required'),
    periodEnd: z.string().min(1, 'Required'),
    payDate: z.string().min(1, 'Required'),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, 'Use a 3-letter code, e.g. AED')
      .optional()
      .or(z.literal('')),
    earnings: z.array(componentSchema).min(1, 'Add at least one earning'),
    deductions: z.array(componentSchema),
    notes: z.string().trim().max(500).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.periodEnd < v.periodStart) {
      ctx.addIssue({ code: 'custom', path: ['periodEnd'], message: 'Period end cannot be before period start' });
    }
  });

const monthStart = () => `${todayDateOnly().slice(0, 7)}-01`;
const monthEnd = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
};

function ComponentRows({ control, register, name, errors, label, addLabel, currency }) {
  const { fields, append, remove } = useFieldArray({ control, name });
  const rows = useWatch({ control, name }) ?? [];
  const total = rows.reduce((sum, row) => sum + (Number(row?.amount) || 0), 0);

  return (
    <Card>
      <CardHeader
        title={label}
        action={
          <Button variant="soft" size="xs" leftIcon={Plus} onClick={() => append({ label: '', amount: 0 })}>
            {addLabel}
          </Button>
        }
      />
      <div className="space-y-2 px-5 pb-4">
        {fields.length === 0 && <p className="py-2 text-sm text-slate-500">None.</p>}
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-start gap-2">
            <FormField className="flex-1" error={errors?.[index]?.label?.message}>
              {(ids) => <Input {...ids} placeholder="e.g. Basic Pay" {...register(`${name}.${index}.label`)} />}
            </FormField>
            <FormField className="w-40" error={errors?.[index]?.amount?.message}>
              {(ids) => (
                <Input {...ids} type="number" step="0.01" min="0" className="text-right tabular" {...register(`${name}.${index}.amount`)} />
              )}
            </FormField>
            <Button variant="ghost" size="icon" onClick={() => remove(index)} aria-label={`Remove ${label} row ${index + 1}`}>
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
        <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
          <span className="font-medium text-slate-600">Total {label.toLowerCase()}</span>
          <span className="pr-11 font-semibold text-slate-900 tabular">{formatCurrency(total, currency)}</span>
        </div>
      </div>
    </Card>
  );
}

export default function PayslipEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  useDocumentTitle(isEdit ? 'Edit payslip' : 'Generate payslip');

  const existing = usePayslip(id);
  const employees = useEmployeeOptions();
  const companies = useCompanies();
  const createPayslip = useCreatePayslip();
  const updatePayslip = useUpdatePayslip();

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      employee: '',
      company: '',
      periodStart: monthStart(),
      periodEnd: monthEnd(),
      payDate: monthEnd(),
      currency: '',
      earnings: [{ label: 'Basic Pay', amount: 0 }],
      deductions: [],
      notes: '',
    },
  });

  const [employeeId, companyId, typedCurrency] = useWatch({ control, name: ['employee', 'company', 'currency'] });
  const defaults = usePayslipDefaults({ employee: employeeId, company: companyId }, { enabled: Boolean(employeeId) && !isEdit });

  useEffect(() => {
    if (!isEdit || !existing.data) return;
    const p = existing.data;
    reset({
      employee: p.employee?.id ?? p.employee,
      company: p.company?.id ?? p.company,
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      payDate: p.payDate,
      currency: p.currency ?? '',
      earnings: p.earnings.map((e) => ({ label: e.label, amount: e.amount })),
      deductions: p.deductions.map((d) => ({ label: d.label, amount: d.amount })),
      notes: p.notes ?? '',
    });
  }, [isEdit, existing.data, reset]);

  // Pre-select a company as soon as the list loads.
  useEffect(() => {
    if (isEdit || companyId || !companies.data?.length) return;
    setValue('company', companies.data[0].id);
  }, [isEdit, companyId, companies.data, setValue]);

  const applyDefaults = () => {
    if (!defaults.data) return;
    setValue('earnings', defaults.data.earnings, { shouldValidate: true });
    setValue('deductions', defaults.data.deductions, { shouldValidate: true });
    if (defaults.data.company) setValue('company', defaults.data.company);
    toast.success(defaults.data.copiedFrom ? `Copied from ${defaults.data.copiedFrom.payslipNumber}` : 'Loaded company defaults');
  };

  const companyCurrency = useMemo(
    () => companies.data?.find((c) => c.id === companyId)?.currency ?? 'INR',
    [companies.data, companyId],
  );
  // A typed code wins, so the totals below update as it is entered.
  const currency = /^[A-Za-z]{3}$/.test(typedCurrency ?? '') ? typedCurrency.toUpperCase() : companyCurrency;

  const onSubmit = async (values) => {
    const body = {
      ...values,
      earnings: values.earnings.map((e) => ({ label: e.label, amount: Number(e.amount) })),
      deductions: values.deductions.map((d) => ({ label: d.label, amount: Number(d.amount) })),
    };
    // Blank means "use the company's", which the server reads as the field being absent.
    if (!body.currency) delete body.currency;
    try {
      const saved = isEdit ? await updatePayslip.mutateAsync({ id, ...body }) : await createPayslip.mutateAsync(body);
      toast.success(isEdit ? 'Payslip updated' : `Payslip ${saved.payslipNumber} generated`);
      navigate(`/payslips/${saved.id}`);
    } catch (err) {
      if (!applyServerErrors(err, setError)) toast.error(err.message);
    }
  };

  if (!isEdit && !companies.isPending && companies.data?.length === 0) return <NoCompanyNotice document="payslip" />;
  if (isEdit && existing.isPending) return <Skeleton className="h-96 w-full rounded-2xl" />;
  if (isEdit && existing.isError) {
    return (
      <Card>
        <ErrorState error={existing.error} onRetry={existing.refetch} />
      </Card>
    );
  }

  return (
    <>
      <Link to="/payslips" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900">
        <ArrowLeft size={16} /> Payslips
      </Link>

      <PageHeader
        title={isEdit ? `Edit ${existing.data?.payslipNumber}` : 'Generate payslip'}
        description="Employee and company details are pulled from their existing records."
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/payslips')}>
              Cancel
            </Button>
            <Button type="submit" form="payslip-form" loading={isSubmitting}>
              {isEdit ? 'Save changes' : 'Generate payslip'}
            </Button>
          </>
        }
      />

      <form id="payslip-form" onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Payslip details" description="Who this payslip is for and which period it covers." />
            <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
              <FormField label="Employee" required error={errors.employee?.message}>
                {(ids) => (
                  <Controller
                    control={control}
                    name="employee"
                    render={({ field }) => (
                      <Select {...ids} {...field} disabled={isEdit} placeholder="Select an employee">
                        {(employees.data ?? []).map((u) => (
                          <option key={u.id} value={u.id}>
                            {fullName(u)} — {u.employeeId}
                          </option>
                        ))}
                      </Select>
                    )}
                  />
                )}
              </FormField>
              <FormField label="Company" required error={errors.company?.message} hint="Sets the branding and currency on the PDF.">
                {(ids) => (
                  <Controller
                    control={control}
                    name="company"
                    render={({ field }) => (
                      <Select {...ids} {...field} placeholder="Select a company">
                        {(companies.data ?? []).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.currency})
                          </option>
                        ))}
                      </Select>
                    )}
                  />
                )}
              </FormField>
              <FormField label="Period start" required error={errors.periodStart?.message}>
                {(ids) => <Input {...ids} type="date" {...register('periodStart')} />}
              </FormField>
              <FormField label="Period end" required error={errors.periodEnd?.message}>
                {(ids) => <Input {...ids} type="date" {...register('periodEnd')} />}
              </FormField>
              <FormField label="Pay date" required error={errors.payDate?.message}>
                {(ids) => <Input {...ids} type="date" {...register('payDate')} />}
              </FormField>
              <FormField
                label="Currency"
                error={errors.currency?.message}
                hint={`3-letter code. Leave blank to use the company's (${companyCurrency}).`}
              >
                {(ids) => (
                  <Input
                    {...ids}
                    className="uppercase"
                    maxLength={3}
                    placeholder={companyCurrency}
                    autoComplete="off"
                    {...register('currency')}
                  />
                )}
              </FormField>
              <FormField label="Note (optional)" error={errors.notes?.message} className="sm:col-span-2">
                {(ids) => <Textarea {...ids} rows={2} placeholder="Shown under the net pay" {...register('notes')} />}
              </FormField>
            </div>
          </Card>

          <ComponentRows
            control={control}
            register={register}
            name="earnings"
            errors={errors.earnings}
            label="Earnings"
            addLabel="Add earning"
            currency={currency}
          />
          {errors.earnings?.message && <p className="-mt-4 text-xs font-medium text-red-600">{errors.earnings.message}</p>}

          <ComponentRows
            control={control}
            register={register}
            name="deductions"
            errors={errors.deductions}
            label="Deductions"
            addLabel="Add deduction"
            currency={currency}
          />
        </div>

        <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <PayslipSummary control={control} currency={currency} />
          {!isEdit && defaults.data && (
            <Card className="p-5">
              <p className="text-sm font-semibold text-slate-900">
                {defaults.data.copiedFrom ? 'Previous payslip found' : 'Company salary components'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {defaults.data.copiedFrom
                  ? `${defaults.data.copiedFrom.payslipNumber} from ${defaults.data.copiedFrom.payDate}.`
                  : 'Prefill the standard components configured for this company.'}
              </p>
              <Button variant="secondary" size="sm" className="mt-3" leftIcon={Copy} onClick={applyDefaults}>
                {defaults.data.copiedFrom ? 'Copy amounts' : 'Use defaults'}
              </Button>
            </Card>
          )}
        </div>
      </form>
    </>
  );
}

function PayslipSummary({ control, currency }) {
  const [earnings, deductions] = useWatch({ control, name: ['earnings', 'deductions'] });
  const gross = (earnings ?? []).reduce((sum, row) => sum + (Number(row?.amount) || 0), 0);
  const totalDeductions = (deductions ?? []).reduce((sum, row) => sum + (Number(row?.amount) || 0), 0);
  const net = gross - totalDeductions;

  return (
    <Card>
      <CardHeader title="Summary" description="Recalculated on the server when you save." />
      <dl className="space-y-2.5 px-5 pb-5 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-600">Gross earnings</dt>
          <dd className="font-medium tabular">{formatCurrency(gross, currency)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-600">Total deductions</dt>
          <dd className="font-medium tabular">− {formatCurrency(totalDeductions, currency)}</dd>
        </div>
        <div className="flex items-baseline justify-between border-t border-slate-100 pt-3">
          <dt className="font-semibold text-slate-900">Net pay</dt>
          <dd className={`text-lg font-semibold tabular ${net < 0 ? 'text-red-600' : 'text-slate-900'}`}>
            {formatCurrency(net, currency)}
          </dd>
        </div>
        {net < 0 && <p className="text-xs font-medium text-red-600">Deductions cannot exceed total earnings.</p>}
      </dl>
    </Card>
  );
}
