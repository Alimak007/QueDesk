import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Send } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  Button,
  Card,
  CardHeader,
  Checkbox,
  ErrorState,
  FormField,
  Input,
  PageHeader,
  RadioCards,
  Select,
  Skeleton,
  Switch,
  Textarea,
} from '@/components/ui';
import { useDepartments } from '@/features/employees/api';
import { useDocumentTitle } from '@/hooks';
import { applyServerErrors } from '@/lib/api';
import { POLICY_CATEGORIES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useCreatePolicy, usePolicy, useUpdatePolicy } from './api';
import { PolicyStatusBadge } from './components';

const MAX_CONTENT = 50_000;

const schema = z
  .object({
    title: z.string().trim().min(1, 'Give the policy a title').max(150),
    category: z.string().min(1, 'Select a category'),
    summary: z.string().trim().max(300).optional(),
    content: z.string().trim().min(1, 'Write the policy text').max(MAX_CONTENT),
    audience: z.enum(['everyone', 'departments']),
    departments: z.array(z.string()),
    requiresAcceptance: z.boolean(),
    newVersion: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.audience === 'departments' && !v.departments.length) {
      ctx.addIssue({ code: 'custom', path: ['departments'], message: 'Choose at least one department' });
    }
  });

const BLANK = {
  title: '',
  category: 'employee',
  summary: '',
  content: '',
  audience: 'everyone',
  departments: [],
  requiresAcceptance: true,
  newVersion: false,
};

const toForm = (policy) => ({
  title: policy.title,
  category: policy.category,
  summary: policy.summary ?? '',
  content: policy.content,
  audience: policy.departments.length ? 'departments' : 'everyone',
  departments: policy.departments,
  requiresAcceptance: policy.requiresAcceptance,
  newVersion: false,
});

export default function PolicyEditorPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const policy = usePolicy(id);

  useDocumentTitle(isEdit ? 'Edit policy' : 'New policy');

  if (isEdit && policy.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }
  if (isEdit && policy.isError) {
    return (
      <Card>
        <ErrorState error={policy.error} onRetry={policy.refetch} />
      </Card>
    );
  }
  return <PolicyForm policy={isEdit ? policy.data : null} />;
}

function PolicyForm({ policy }) {
  const navigate = useNavigate();
  const createPolicy = useCreatePolicy();
  const updatePolicy = useUpdatePolicy();
  const departments = useDepartments();

  const isEdit = Boolean(policy);
  const isPublished = policy?.status === 'published';
  const everPublished = Boolean(policy?.publishedAt);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: policy ? toForm(policy) : BLANK });

  useEffect(() => {
    if (policy) reset(toForm(policy));
  }, [policy, reset]);

  const [audience, content, requiresAcceptance] = useWatch({ control, name: ['audience', 'content', 'requiresAcceptance'] });

  const save = (publish) =>
    handleSubmit(async ({ audience: who, departments: chosen, newVersion, ...values }) => {
      const body = { ...values, departments: who === 'departments' ? chosen : [], publish };
      try {
        const saved = isEdit
          ? await updatePolicy.mutateAsync({ id: policy.id, ...body, newVersion })
          : await createPolicy.mutateAsync(body);
        toast.success(
          publish && !isPublished ? 'Policy published' : isEdit ? 'Policy saved' : 'Draft saved',
          {
            description:
              (publish && !isPublished) || (newVersion && everPublished)
                ? saved.requiresAcceptance
                  ? 'Employees it applies to will be asked to accept it when they next use QueDesk.'
                  : undefined
                : undefined,
          },
        );
        navigate(`/policies/${saved.id}`);
      } catch (err) {
        if (!applyServerErrors(err, setError)) toast.error(err.message);
      }
    });

  const saving = isSubmitting || createPolicy.isPending || updatePolicy.isPending;
  const departmentOptions = [...new Set([...(departments.data ?? []), ...(policy?.departments ?? [])])].sort();

  return (
    <>
      <Link
        to={isEdit ? `/policies/${policy.id}` : '/policies'}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={15} /> {isEdit ? 'Back to the policy' : 'All policies'}
      </Link>
      <PageHeader
        title={isEdit ? 'Edit policy' : 'New policy'}
        description={
          isEdit
            ? 'Changes to a published policy are seen by employees straight away.'
            : 'Save it as a draft while you work on it; employees only see it once it is published.'
        }
        actions={isEdit && <PolicyStatusBadge status={policy.status} />}
      />

      <form onSubmit={(e) => e.preventDefault()} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="space-y-5 p-6">
          <FormField label="Title" required error={errors.title?.message}>
            {(field) => <Input {...field} placeholder="e.g. Code of Conduct" {...register('title')} />}
          </FormField>
          <div className="grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)]">
            <FormField label="Category" required error={errors.category?.message}>
              {(field) => (
                <Select {...field} {...register('category')}>
                  {POLICY_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            <FormField label="Summary" error={errors.summary?.message} hint="One or two lines shown in the list.">
              {(field) => <Input {...field} maxLength={300} placeholder="What this policy covers" {...register('summary')} />}
            </FormField>
          </div>
          <FormField
            label="Policy text"
            required
            error={errors.content?.message}
            hint={`Paste or type the full policy. Line breaks are kept. ${(content ?? '').length.toLocaleString()} / ${MAX_CONTENT.toLocaleString()} characters.`}
          >
            {(field) => (
              <Textarea
                {...field}
                rows={22}
                maxLength={MAX_CONTENT}
                className="font-[inherit] text-[15px] leading-7"
                placeholder={'1. Purpose\nThis policy explains…\n\n2. Scope\nIt applies to…'}
                {...register('content')}
              />
            )}
          </FormField>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Who it applies to" />
            <div className="space-y-4 px-5 pb-5">
              <Controller
                control={control}
                name="audience"
                render={({ field }) => (
                  <RadioCards
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      { value: 'everyone', label: 'Everyone' },
                      { value: 'departments', label: 'Departments' },
                    ]}
                  />
                )}
              />
              {audience === 'departments' && (
                <FormField error={errors.departments?.message}>
                  <Controller
                    control={control}
                    name="departments"
                    render={({ field }) =>
                      departmentOptions.length ? (
                        <div className="scrollbar-thin max-h-56 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
                          {departmentOptions.map((dept) => (
                            <Checkbox
                              key={dept}
                              label={dept}
                              checked={field.value.includes(dept)}
                              onChange={(e) =>
                                field.onChange(e.target.checked ? [...field.value, dept] : field.value.filter((d) => d !== dept))
                              }
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">No departments yet — set one on your employees first.</p>
                      )
                    }
                  />
                </FormField>
              )}
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <Controller
              control={control}
              name="requiresAcceptance"
              render={({ field }) => (
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Employees must accept it</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {field.value
                        ? 'They read it and confirm before they can use QueDesk.'
                        : 'Shown under Policies for information only.'}
                    </p>
                  </div>
                  <Switch checked={field.value} onChange={field.onChange} label="Employees must accept it" />
                </div>
              )}
            />
            {everPublished && (
              <div className={cn('rounded-xl border p-3.5', requiresAcceptance ? 'border-amber-200 bg-amber-50/60' : 'border-slate-200')}>
                <Checkbox
                  label="This is a significant change"
                  description={`Publishes version ${policy.version + 1}${
                    requiresAcceptance ? ' and asks everyone it applies to to accept it again' : ''
                  }. Leave unticked for small fixes such as typos.`}
                  {...register('newVersion')}
                />
              </div>
            )}
          </Card>

          <Card className="flex flex-col gap-2 p-5">
            {isPublished ? (
              <Button onClick={save(false)} loading={saving}>
                Save changes
              </Button>
            ) : (
              <>
                <Button leftIcon={Send} onClick={save(true)} loading={saving}>
                  {isEdit ? 'Save and publish' : 'Publish'}
                </Button>
                <Button variant="secondary" onClick={save(false)} disabled={saving}>
                  {isEdit ? 'Save' : 'Save as draft'}
                </Button>
              </>
            )}
          </Card>
        </div>
      </form>
    </>
  );
}
