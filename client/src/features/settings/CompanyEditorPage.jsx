import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ImagePlus, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button, Card, CardHeader, Checkbox, ErrorState, FormField, Input, PageHeader, Skeleton, Textarea } from '@/components/ui';
import { useDocumentTitle } from '@/hooks';
import { applyServerErrors } from '@/lib/api';
import {
  companyAssetUrl,
  useCompany,
  useCreateCompany,
  useRemoveCompanyAsset,
  useUpdateCompany,
  useUploadCompanyAsset,
} from './api';

const schema = z.object({
  name: z.string().trim().min(1, 'Company name is required').max(150),
  shortName: z.string().trim().max(40).optional(),
  address: z.string().trim().max(500).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.union([z.literal(''), z.string().trim().pipe(z.email('Enter a valid email address'))]).optional(),
  website: z.string().trim().max(120).optional(),
  taxLabel: z.string().trim().max(20).optional(),
  taxNumber: z.string().trim().max(60).optional(),
  registrationNumber: z.string().trim().max(60).optional(),
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/, '3-letter ISO code'),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  bank: z.object({
    bankName: z.string().trim().max(120).optional(),
    accountName: z.string().trim().max(150).optional(),
    accountNumber: z.string().trim().max(60).optional(),
    iban: z.string().trim().max(60).optional(),
    swift: z.string().trim().max(30).optional(),
    branchAddress: z.string().trim().max(200).optional(),
  }),
  invoice: z.object({
    title: z.string().trim().max(60).optional(),
    prefix: z.string().trim().max(12).optional(),
    nextNumber: z.coerce.number().int().min(1),
    sequencePadding: z.coerce.number().int().min(1).max(10),
    includeYearMonth: z.boolean(),
    quantityLabel: z.string().trim().max(20).optional(),
    taxLabel: z.string().trim().max(40).optional(),
    defaultTaxRate: z.coerce.number().min(0).max(100),
    paymentTermsDays: z.coerce.number().int().min(0).max(365),
    paymentTerms: z.string().trim().max(120).optional(),
    notes: z.string().trim().max(1000).optional(),
    terms: z.string().trim().max(2000).optional(),
    showShipTo: z.boolean(),
    signatureLabel: z.string().trim().max(60).optional(),
  }),
  payslip: z.object({
    title: z.string().trim().max(60).optional(),
    prefix: z.string().trim().max(12).optional(),
    confidentialityNote: z.string().trim().max(120).optional(),
    currencyLabel: z.string().trim().max(10).optional(),
    footerNote: z.string().trim().max(300).optional(),
  }),
});

const BLANK = {
  name: '',
  shortName: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  taxLabel: 'TRN',
  taxNumber: '',
  registrationNumber: '',
  currency: 'AED',
  isDefault: false,
  isActive: true,
  bank: { bankName: '', accountName: '', accountNumber: '', iban: '', swift: '', branchAddress: '' },
  invoice: {
    title: 'TAX INVOICE',
    prefix: 'INV-',
    nextNumber: 1,
    sequencePadding: 6,
    includeYearMonth: true,
    quantityLabel: 'Hours',
    taxLabel: 'Standard Rate',
    defaultTaxRate: 5,
    paymentTermsDays: 30,
    paymentTerms: '30 days from invoice date',
    notes: 'Thank you for your business',
    terms: '',
    showShipTo: true,
    signatureLabel: 'Authorized Signature',
  },
  payslip: {
    title: 'Payslip',
    prefix: 'PS-',
    confidentialityNote: 'Private & Confidential',
    currencyLabel: '',
    footerNote: 'This is a system generated statement and does not require any signature or stamp',
  },
};

/** Upload / preview / remove for a company logo or signature. */
function AssetField({ company, kind, label, hint }) {
  const inputRef = useRef(null);
  const upload = useUploadCompanyAsset();
  const removeAsset = useRemoveCompanyAsset();
  const url = companyAssetUrl(company, kind);

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      await upload.mutateAsync({ id: company.id, kind, file });
      toast.success(`${label} updated`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-sm font-medium text-slate-800">{label}</p>
      <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
      <div className="mt-3 flex items-center gap-4">
        <div className="flex h-20 w-40 items-center justify-center rounded-lg bg-slate-50 ring-1 ring-slate-200">
          {url ? (
            <img src={url} alt={`${label} preview`} className="max-h-16 max-w-36 object-contain" />
          ) : (
            <span className="flex flex-col items-center gap-1 text-slate-400">
              <ImagePlus size={20} />
              <span className="text-[11px]">No {kind}</span>
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          <Button variant="secondary" size="sm" leftIcon={Upload} loading={upload.isPending} onClick={() => inputRef.current?.click()}>
            {url ? 'Replace' : 'Upload'}
          </Button>
          {url && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={Trash2}
              loading={removeAsset.isPending}
              onClick={() => removeAsset.mutateAsync({ id: company.id, kind }).then(() => toast.success(`${label} removed`))}
            >
              Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CompanyEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const existing = useCompany(id);
  const createCompany = useCreateCompany();
  const updateCompany = useUpdateCompany();

  useDocumentTitle(isEdit ? existing.data?.name ?? 'Company' : 'New company');

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: BLANK });

  useEffect(() => {
    if (!isEdit || !existing.data) return;
    const c = existing.data;
    reset({
      ...BLANK,
      ...c,
      bank: { ...BLANK.bank, ...(c.bank ?? {}) },
      invoice: { ...BLANK.invoice, ...(c.invoice ?? {}) },
      payslip: { ...BLANK.payslip, ...(c.payslip ?? {}) },
    });
  }, [isEdit, existing.data, reset]);

  const onSubmit = async (values) => {
    try {
      const saved = isEdit ? await updateCompany.mutateAsync({ id, ...values }) : await createCompany.mutateAsync(values);
      toast.success(isEdit ? 'Company updated' : 'Company created');
      if (!isEdit) navigate(`/settings/companies/${saved.id}`, { replace: true });
    } catch (err) {
      if (!applyServerErrors(err, setError)) toast.error(err.message);
    }
  };

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
      <Link to="/settings" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900">
        <ArrowLeft size={16} /> Settings
      </Link>

      <PageHeader
        title={isEdit ? existing.data.name : 'New company'}
        description="These details appear on invoices and payslips."
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/settings')}>
              Cancel
            </Button>
            <Button type="submit" form="company-form" loading={isSubmitting}>
              {isEdit ? 'Save changes' : 'Create company'}
            </Button>
          </>
        }
      />

      <form id="company-form" onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-6 xl:grid-cols-2">
        <Card className="xl:col-span-2">
          <CardHeader title="Company profile" description="Printed in the document header." />
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
            <FormField label="Registered name" required error={errors.name?.message}>
              {(ids) => <Input {...ids} {...register('name')} />}
            </FormField>
            <FormField label="Short name" error={errors.shortName?.message} hint="Used in the payslip confidentiality line.">
              {(ids) => <Input {...ids} placeholder="e.g. Que" {...register('shortName')} />}
            </FormField>
            <FormField label="Address" error={errors.address?.message} className="sm:col-span-2" hint="Line breaks are preserved.">
              {(ids) => <Textarea {...ids} rows={3} {...register('address')} />}
            </FormField>
            <FormField label="Phone" error={errors.phone?.message}>
              {(ids) => <Input {...ids} {...register('phone')} />}
            </FormField>
            <FormField label="Email" error={errors.email?.message}>
              {(ids) => <Input {...ids} type="email" {...register('email')} />}
            </FormField>
            <FormField label="Website" error={errors.website?.message}>
              {(ids) => <Input {...ids} {...register('website')} />}
            </FormField>
            <FormField label="Currency" required error={errors.currency?.message}>
              {(ids) => <Input {...ids} className="uppercase" maxLength={3} {...register('currency')} />}
            </FormField>
            <FormField label="Tax label" error={errors.taxLabel?.message} hint="TRN, VAT, GSTIN…">
              {(ids) => <Input {...ids} {...register('taxLabel')} />}
            </FormField>
            <FormField label="Tax number" error={errors.taxNumber?.message}>
              {(ids) => <Input {...ids} {...register('taxNumber')} />}
            </FormField>
            <FormField label="Registration number" error={errors.registrationNumber?.message}>
              {(ids) => <Input {...ids} {...register('registrationNumber')} />}
            </FormField>
            <div className="flex flex-col justify-end gap-3 pb-1">
              <Checkbox label="Default company" description="Pre-selected on new documents." {...register('isDefault')} />
              <Checkbox label="Active" description="Inactive companies are hidden from pickers." {...register('isActive')} />
            </div>
          </div>
        </Card>

        {isEdit && (
          <Card className="xl:col-span-2">
            <CardHeader title="Branding" description="PNG, JPEG or WebP, up to 5 MB. Used on the PDF documents." />
            <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
              <AssetField company={existing.data} kind="logo" label="Logo" hint="Appears on invoices and payslips." />
              <AssetField company={existing.data} kind="signature" label="Signature" hint="Printed above the authorised signature line on invoices." />
            </div>
          </Card>
        )}

        <Card>
          <CardHeader title="Bank details" description="Shown in the invoice bank details box." />
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
            <FormField label="Bank name" error={errors.bank?.bankName?.message}>
              {(ids) => <Input {...ids} {...register('bank.bankName')} />}
            </FormField>
            <FormField label="Account name" error={errors.bank?.accountName?.message}>
              {(ids) => <Input {...ids} {...register('bank.accountName')} />}
            </FormField>
            <FormField label="Account number" error={errors.bank?.accountNumber?.message}>
              {(ids) => <Input {...ids} {...register('bank.accountNumber')} />}
            </FormField>
            <FormField label="IBAN" error={errors.bank?.iban?.message}>
              {(ids) => <Input {...ids} {...register('bank.iban')} />}
            </FormField>
            <FormField label="SWIFT" error={errors.bank?.swift?.message}>
              {(ids) => <Input {...ids} {...register('bank.swift')} />}
            </FormField>
            <FormField label="Branch address" error={errors.bank?.branchAddress?.message}>
              {(ids) => <Input {...ids} {...register('bank.branchAddress')} />}
            </FormField>
          </div>
        </Card>

        <Card>
          <CardHeader title="Invoice defaults" description="Numbering, tax and the wording used on new invoices." />
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
            <FormField label="Document title" error={errors.invoice?.title?.message}>
              {(ids) => <Input {...ids} {...register('invoice.title')} />}
            </FormField>
            <FormField label="Number prefix" error={errors.invoice?.prefix?.message}>
              {(ids) => <Input {...ids} className="font-mono" {...register('invoice.prefix')} />}
            </FormField>
            <FormField label="Next number" error={errors.invoice?.nextNumber?.message} hint="The next invoice will use this sequence.">
              {(ids) => <Input {...ids} type="number" min="1" {...register('invoice.nextNumber')} />}
            </FormField>
            <FormField label="Sequence digits" error={errors.invoice?.sequencePadding?.message}>
              {(ids) => <Input {...ids} type="number" min="1" max="10" {...register('invoice.sequencePadding')} />}
            </FormField>
            <FormField label="Quantity column label" error={errors.invoice?.quantityLabel?.message} hint="e.g. Hours, Qty, Days.">
              {(ids) => <Input {...ids} {...register('invoice.quantityLabel')} />}
            </FormField>
            <FormField label="Tax label" error={errors.invoice?.taxLabel?.message}>
              {(ids) => <Input {...ids} {...register('invoice.taxLabel')} />}
            </FormField>
            <FormField label="Default tax rate (%)" error={errors.invoice?.defaultTaxRate?.message}>
              {(ids) => <Input {...ids} type="number" step="0.01" min="0" max="100" {...register('invoice.defaultTaxRate')} />}
            </FormField>
            <FormField label="Payment terms (days)" error={errors.invoice?.paymentTermsDays?.message}>
              {(ids) => <Input {...ids} type="number" min="0" max="365" {...register('invoice.paymentTermsDays')} />}
            </FormField>
            <FormField label="Payment terms text" error={errors.invoice?.paymentTerms?.message} className="sm:col-span-2">
              {(ids) => <Input {...ids} {...register('invoice.paymentTerms')} />}
            </FormField>
            <FormField label="Default note" error={errors.invoice?.notes?.message} className="sm:col-span-2">
              {(ids) => <Textarea {...ids} rows={2} {...register('invoice.notes')} />}
            </FormField>
            <FormField label="Default terms & conditions" error={errors.invoice?.terms?.message} className="sm:col-span-2">
              {(ids) => <Textarea {...ids} rows={3} {...register('invoice.terms')} />}
            </FormField>
            <FormField label="Signature label" error={errors.invoice?.signatureLabel?.message}>
              {(ids) => <Input {...ids} {...register('invoice.signatureLabel')} />}
            </FormField>
            <div className="flex items-end pb-2">
              <Checkbox label="Show Ship To block" {...register('invoice.showShipTo')} />
            </div>
            <div className="sm:col-span-2">
              <NumberPreview register={register} />
            </div>
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Payslip defaults" description="Wording used on generated payslips." />
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
            <FormField label="Document title" error={errors.payslip?.title?.message}>
              {(ids) => <Input {...ids} {...register('payslip.title')} />}
            </FormField>
            <FormField label="Number prefix" error={errors.payslip?.prefix?.message}>
              {(ids) => <Input {...ids} className="font-mono" {...register('payslip.prefix')} />}
            </FormField>
            <FormField label="Confidentiality note" error={errors.payslip?.confidentialityNote?.message}>
              {(ids) => <Input {...ids} {...register('payslip.confidentialityNote')} />}
            </FormField>
            <FormField
              label="Currency label"
              error={errors.payslip?.currencyLabel?.message}
              hint="Printed in the payslip amount columns. Leave blank to use the company currency."
            >
              {(ids) => <Input {...ids} placeholder="e.g. Rs" {...register('payslip.currencyLabel')} />}
            </FormField>
            <FormField label="Footer note" error={errors.payslip?.footerNote?.message} className="sm:col-span-2">
              {(ids) => <Textarea {...ids} rows={2} {...register('payslip.footerNote')} />}
            </FormField>
          </div>
        </Card>
      </form>
    </>
  );
}

/** Shows how the next invoice number will look with the current settings. */
function NumberPreview({ register }) {
  return (
    <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200">
      Invoice numbers look like <span className="font-mono font-medium text-slate-900">INV-202605000017</span> when “include year and
      month” is on, or <span className="font-mono font-medium text-slate-900">INV-000017</span> when it is off.
      <span className="mt-2 block">
        <Checkbox label="Include year and month in the number" {...register('invoice.includeYearMonth')} />
      </span>
    </p>
  );
}
