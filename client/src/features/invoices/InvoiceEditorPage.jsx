import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Plus, Trash2, UserRoundSearch } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button, Card, CardHeader, Checkbox, ErrorState, FormField, Input, PageHeader, Select, Skeleton, Textarea } from '@/components/ui';
import { NoCompanyNotice } from '@/features/documents/NoCompanyNotice';
import { useCompanies } from '@/features/settings/api';
import { useDocumentTitle } from '@/hooks';
import { applyServerErrors } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import {
  INVOICE_STATUSES,
  useCreateInvoice,
  useInvoice,
  useInvoiceCustomers,
  useInvoiceDefaults,
  useUpdateInvoice,
} from './api';

const itemSchema = z.object({
  description: z.string().trim().min(1, 'Describe the item').max(500),
  quantity: z.coerce.number({ error: 'Required' }).min(0, 'Cannot be negative'),
  rate: z.coerce.number({ error: 'Required' }).min(0, 'Cannot be negative'),
  discountPercent: z.coerce.number().min(0).max(100, 'Max 100%'),
  taxRate: z.coerce.number().min(0).max(100, 'Max 100%'),
});

const schema = z
  .object({
    company: z.string().min(1, 'Select a company'),
    customer: z.string().optional(),
    status: z.string(),
    invoiceNumber: z.string().trim().max(40).optional(),
    invoiceDate: z.string().min(1, 'Required'),
    dueDate: z.string().min(1, 'Required'),
    paymentTerms: z.string().trim().max(120).optional(),
    poNumber: z.string().trim().max(60).optional(),
    poDate: z.string().optional(),
    billTo: z.object({
      name: z.string().trim().min(1, 'Customer name is required').max(150),
      address: z.string().trim().max(500).optional(),
      taxNumber: z.string().trim().max(60).optional(),
    }),
    shipTo: z.object({
      name: z.string().trim().max(150).optional(),
      address: z.string().trim().max(500).optional(),
      taxNumber: z.string().trim().max(60).optional(),
    }),
    shipToSameAsBillTo: z.boolean(),
    items: z.array(itemSchema).min(1, 'Add at least one line item'),
    amountPaid: z.coerce.number().min(0, 'Cannot be negative'),
    notes: z.string().trim().max(1000).optional(),
    terms: z.string().trim().max(2000).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.dueDate < v.invoiceDate) {
      ctx.addIssue({ code: 'custom', path: ['dueDate'], message: 'Due date cannot be before the invoice date' });
    }
    // Mirrors the server: a ship-to name is only needed once the addresses differ.
    if (!v.shipToSameAsBillTo && !v.shipTo?.name?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['shipTo', 'name'], message: 'Enter who the goods ship to' });
    }
  });

const emptyItem = (taxRate = 0) => ({ description: '', quantity: 1, rate: 0, discountPercent: 0, taxRate });

/** Mirrors the server calculation so totals update as you type. */
function computeTotals(items, amountPaid) {
  const rows = (items ?? []).map((item) => {
    const gross = (Number(item?.quantity) || 0) * (Number(item?.rate) || 0);
    const discount = (gross * (Number(item?.discountPercent) || 0)) / 100;
    const taxable = gross - discount;
    const tax = (taxable * (Number(item?.taxRate) || 0)) / 100;
    return { gross, discount, taxable, tax };
  });
  const subTotal = rows.reduce((s, r) => s + r.gross, 0);
  const discountTotal = rows.reduce((s, r) => s + r.discount, 0);
  const taxableAmount = rows.reduce((s, r) => s + r.taxable, 0);
  const taxTotal = rows.reduce((s, r) => s + r.tax, 0);
  const total = taxableAmount + taxTotal;
  return { rows, subTotal, discountTotal, taxableAmount, taxTotal, total, balanceDue: total - (Number(amountPaid) || 0) };
}

export default function InvoiceEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  useDocumentTitle(isEdit ? 'Edit invoice' : 'New invoice');

  const existing = useInvoice(id);
  const companies = useCompanies();
  const customers = useInvoiceCustomers();
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      company: '',
      customer: '',
      status: 'draft',
      invoiceNumber: '',
      invoiceDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date().toISOString().slice(0, 10),
      paymentTerms: '',
      poNumber: '',
      poDate: '',
      billTo: { name: '', address: '', taxNumber: '' },
      shipTo: { name: '', address: '', taxNumber: '' },
      shipToSameAsBillTo: true,
      items: [emptyItem()],
      amountPaid: 0,
      notes: '',
      terms: '',
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const [companyId, items, amountPaid, sameAsBill, customerId] = useWatch({
    control,
    name: ['company', 'items', 'amountPaid', 'shipToSameAsBillTo', 'customer'],
  });
  const defaults = useInvoiceDefaults(!isEdit ? companyId : undefined);

  const company = companies.data?.find((c) => c.id === companyId);
  const currency = company?.currency ?? 'AED';
  const quantityLabel = company?.invoice?.quantityLabel ?? 'Qty';
  const totals = useMemo(() => computeTotals(items, amountPaid), [items, amountPaid]);

  /* Load an existing invoice */
  useEffect(() => {
    if (!isEdit || !existing.data) return;
    const inv = existing.data;
    reset({
      company: inv.company?.id ?? inv.company,
      customer: inv.customer?.id ?? '',
      status: inv.status,
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate,
      dueDate: inv.dueDate,
      paymentTerms: inv.paymentTerms ?? '',
      poNumber: inv.poNumber ?? '',
      poDate: inv.poDate ?? '',
      billTo: { name: inv.billTo?.name ?? '', address: inv.billTo?.address ?? '', taxNumber: inv.billTo?.taxNumber ?? '' },
      shipTo: { name: inv.shipTo?.name ?? '', address: inv.shipTo?.address ?? '', taxNumber: inv.shipTo?.taxNumber ?? '' },
      shipToSameAsBillTo: inv.shipToSameAsBillTo,
      items: inv.items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        rate: i.rate,
        discountPercent: i.discountPercent ?? 0,
        taxRate: i.taxRate ?? 0,
      })),
      amountPaid: inv.amountPaid ?? 0,
      notes: inv.notes ?? '',
      terms: inv.terms ?? '',
    });
  }, [isEdit, existing.data, reset]);

  /* Pre-select a company for a new invoice */
  useEffect(() => {
    if (isEdit || companyId || !companies.data?.length) return;
    setValue('company', companies.data.find((c) => c.isDefault)?.id ?? companies.data[0].id);
  }, [isEdit, companyId, companies.data, setValue]);

  /* Apply the selected company's defaults */
  useEffect(() => {
    if (isEdit || !defaults.data) return;
    setValue('invoiceDate', defaults.data.invoiceDate);
    setValue('dueDate', defaults.data.dueDate);
    setValue('paymentTerms', defaults.data.paymentTerms);
    setValue('notes', defaults.data.notes);
    setValue('terms', defaults.data.terms);
  }, [isEdit, defaults.data, setValue]);

  /* Selecting a customer fills Bill To from their record */
  useEffect(() => {
    if (!customerId || !customers.data) return;
    const picked = customers.data.find((c) => c.id === customerId);
    if (!picked) return;
    setValue('billTo.name', picked.name, { shouldValidate: true });
    if (picked.billingAddress) setValue('billTo.address', picked.billingAddress);
    if (picked.taxNumber) setValue('billTo.taxNumber', picked.taxNumber);
  }, [customerId, customers.data, setValue]);

  const onSubmit = async (values) => {
    const body = {
      ...values,
      customer: values.customer || null,
      poDate: values.poDate || null,
      invoiceNumber: values.invoiceNumber || undefined,
      items: values.items.map((i) => ({
        description: i.description,
        quantity: Number(i.quantity),
        rate: Number(i.rate),
        discountPercent: Number(i.discountPercent) || 0,
        taxRate: Number(i.taxRate) || 0,
      })),
      amountPaid: Number(values.amountPaid) || 0,
    };
    try {
      const saved = isEdit ? await updateInvoice.mutateAsync({ id, ...body }) : await createInvoice.mutateAsync(body);
      toast.success(isEdit ? 'Invoice updated' : `Invoice ${saved.invoiceNumber} created`);
      navigate(`/invoices/${saved.id}`);
    } catch (err) {
      if (!applyServerErrors(err, setError)) toast.error(err.message);
    }
  };

  if (!isEdit && !companies.isPending && companies.data?.length === 0) return <NoCompanyNotice document="invoice" />;
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
      <Link to="/invoices" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900">
        <ArrowLeft size={16} /> Invoices
      </Link>

      <PageHeader
        title={isEdit ? `Edit ${existing.data?.invoiceNumber}` : 'New invoice'}
        description={
          defaults.data?.nextNumberPreview && !isEdit
            ? `Will be numbered ${defaults.data.nextNumberPreview} unless you set one.`
            : 'Company details, bank information and branding come from the selected company.'
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/invoices')}>
              Cancel
            </Button>
            <Button type="submit" form="invoice-form" loading={isSubmitting}>
              {isEdit ? 'Save changes' : 'Create invoice'}
            </Button>
          </>
        }
      />

      <form id="invoice-form" onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Invoice details" />
            <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
              <FormField label="From company" required error={errors.company?.message} hint="Sets the header, bank details, tax label and currency.">
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
              <FormField label="Status" error={errors.status?.message}>
                {(ids) => (
                  <Controller
                    control={control}
                    name="status"
                    render={({ field }) => (
                      <Select {...ids} {...field}>
                        {INVOICE_STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </Select>
                    )}
                  />
                )}
              </FormField>
              <FormField label="Invoice date" required error={errors.invoiceDate?.message}>
                {(ids) => <Input {...ids} type="date" {...register('invoiceDate')} />}
              </FormField>
              <FormField label="Due date" required error={errors.dueDate?.message}>
                {(ids) => <Input {...ids} type="date" {...register('dueDate')} />}
              </FormField>
              <FormField label="Payment terms" error={errors.paymentTerms?.message}>
                {(ids) => <Input {...ids} placeholder="30 days from invoice date" {...register('paymentTerms')} />}
              </FormField>
              <FormField label="Invoice number" error={errors.invoiceNumber?.message} hint={isEdit ? undefined : 'Leave blank to use the next number.'}>
                {(ids) => <Input {...ids} className="font-mono" placeholder="Auto" {...register('invoiceNumber')} />}
              </FormField>
              <FormField label="P.O. number" error={errors.poNumber?.message}>
                {(ids) => <Input {...ids} placeholder="e.g. 720-PO-074087" {...register('poNumber')} />}
              </FormField>
              <FormField label="P.O. date" error={errors.poDate?.message}>
                {(ids) => <Input {...ids} type="date" {...register('poDate')} />}
              </FormField>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Bill to"
              description="Pick a customer to fill these in, or type them manually."
              icon={UserRoundSearch}
            />
            <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
              <FormField label="Customer" className="sm:col-span-2" hint="Links the invoice to a customer record.">
                {(ids) => (
                  <Controller
                    control={control}
                    name="customer"
                    render={({ field }) => (
                      <Select {...ids} {...field} placeholder="No linked customer">
                        {(customers.data ?? []).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                            {c.company ? ` — ${c.company}` : ''}
                          </option>
                        ))}
                      </Select>
                    )}
                  />
                )}
              </FormField>
              <FormField label="Name" required error={errors.billTo?.name?.message}>
                {(ids) => <Input {...ids} {...register('billTo.name')} />}
              </FormField>
              <FormField label="TRN / Tax number" error={errors.billTo?.taxNumber?.message}>
                {(ids) => <Input {...ids} {...register('billTo.taxNumber')} />}
              </FormField>
              <FormField label="Address" error={errors.billTo?.address?.message} className="sm:col-span-2">
                {(ids) => <Textarea {...ids} rows={3} {...register('billTo.address')} />}
              </FormField>

              <div className="sm:col-span-2">
                <Checkbox label="Ship to the same address" {...register('shipToSameAsBillTo')} />
              </div>

              {!sameAsBill && (
                <>
                  <FormField label="Ship to name" error={errors.shipTo?.name?.message}>
                    {(ids) => <Input {...ids} {...register('shipTo.name')} />}
                  </FormField>
                  <FormField label="Ship to TRN" error={errors.shipTo?.taxNumber?.message}>
                    {(ids) => <Input {...ids} {...register('shipTo.taxNumber')} />}
                  </FormField>
                  <FormField label="Ship to address" error={errors.shipTo?.address?.message} className="sm:col-span-2">
                    {(ids) => <Textarea {...ids} rows={3} {...register('shipTo.address')} />}
                  </FormField>
                </>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Line items"
              action={
                <Button variant="soft" size="xs" leftIcon={Plus} onClick={() => append(emptyItem(company?.invoice?.defaultTaxRate ?? 0))}>
                  Add item
                </Button>
              }
            />
            <div className="space-y-3 px-5 pb-5">
              {fields.map((field, index) => (
                <div key={field.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_repeat(4,minmax(0,6rem))_auto]">
                    <FormField label={index === 0 ? 'Description' : undefined} error={errors.items?.[index]?.description?.message}>
                      {(ids) => <Input {...ids} placeholder="Item & description" {...register(`items.${index}.description`)} />}
                    </FormField>
                    <FormField label={index === 0 ? quantityLabel : undefined} error={errors.items?.[index]?.quantity?.message}>
                      {(ids) => <Input {...ids} type="number" step="any" min="0" className="text-right tabular" {...register(`items.${index}.quantity`)} />}
                    </FormField>
                    <FormField label={index === 0 ? 'Rate' : undefined} error={errors.items?.[index]?.rate?.message}>
                      {(ids) => <Input {...ids} type="number" step="0.01" min="0" className="text-right tabular" {...register(`items.${index}.rate`)} />}
                    </FormField>
                    <FormField label={index === 0 ? 'Disc %' : undefined} error={errors.items?.[index]?.discountPercent?.message}>
                      {(ids) => <Input {...ids} type="number" step="0.01" min="0" max="100" className="text-right tabular" {...register(`items.${index}.discountPercent`)} />}
                    </FormField>
                    <FormField label={index === 0 ? 'Tax %' : undefined} error={errors.items?.[index]?.taxRate?.message}>
                      {(ids) => <Input {...ids} type="number" step="0.01" min="0" max="100" className="text-right tabular" {...register(`items.${index}.taxRate`)} />}
                    </FormField>
                    <div className={index === 0 ? 'pt-6' : undefined}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                        aria-label={`Remove line ${index + 1}`}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                  <p className="mt-2 text-right text-xs text-slate-500">
                    Amount <span className="font-medium text-slate-800 tabular">{formatCurrency(totals.rows[index]?.taxable ?? 0, currency)}</span>
                    <span className="mx-2 text-slate-300">·</span>
                    Tax <span className="font-medium text-slate-800 tabular">{formatCurrency(totals.rows[index]?.tax ?? 0, currency)}</span>
                  </p>
                </div>
              ))}
              {errors.items?.message && <p className="text-xs font-medium text-red-600">{errors.items.message}</p>}
            </div>
          </Card>

          <Card>
            <CardHeader title="Notes & terms" description="Printed at the bottom of the invoice." />
            <div className="grid gap-4 px-5 pb-5">
              <FormField label="Note" error={errors.notes?.message}>
                {(ids) => <Textarea {...ids} rows={2} {...register('notes')} />}
              </FormField>
              <FormField label="Terms & conditions" error={errors.terms?.message}>
                {(ids) => <Textarea {...ids} rows={3} {...register('terms')} />}
              </FormField>
            </div>
          </Card>
        </div>

        <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <Card>
            <CardHeader title="Totals" description="Recalculated on the server when you save." />
            <dl className="space-y-2.5 px-5 pb-5 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-600">Sub total</dt>
                <dd className="tabular">{formatCurrency(totals.subTotal, currency)}</dd>
              </div>
              {totals.discountTotal > 0 && (
                <div className="flex justify-between">
                  <dt className="text-slate-600">Discount</dt>
                  <dd className="tabular">− {formatCurrency(totals.discountTotal, currency)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-slate-600">Taxable amount</dt>
                <dd className="tabular">{formatCurrency(totals.taxableAmount, currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">{company?.invoice?.taxLabel ?? 'Tax'}</dt>
                <dd className="tabular">{formatCurrency(totals.taxTotal, currency)}</dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-slate-100 pt-3">
                <dt className="font-semibold text-slate-900">Total</dt>
                <dd className="text-lg font-semibold text-slate-900 tabular">{formatCurrency(totals.total, currency)}</dd>
              </div>
              <FormField label="Amount paid" error={errors.amountPaid?.message} className="pt-2">
                {(ids) => <Input {...ids} type="number" step="0.01" min="0" className="text-right tabular" {...register('amountPaid')} />}
              </FormField>
              <div className="flex items-baseline justify-between border-t border-slate-100 pt-3">
                <dt className="font-semibold text-slate-900">Balance due</dt>
                <dd className="text-lg font-semibold text-brand-700 tabular">{formatCurrency(totals.balanceDue, currency)}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </form>
    </>
  );
}
