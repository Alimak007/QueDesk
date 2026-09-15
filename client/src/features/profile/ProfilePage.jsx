import { zodResolver } from '@hookform/resolvers/zod';
import { BriefcaseBusiness, CalendarDays, Hash, KeyRound, Mail, Phone, ShieldCheck } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Avatar, Badge, Button, Card, CardHeader, FormField, Input, PageHeader } from '@/components/ui';
import { authApi } from '@/features/auth/api';
import { useAuth } from '@/features/auth/useAuth';
import { passwordRule } from '@/features/employees/passwords';
import { useDocumentTitle } from '@/hooks';
import { applyServerErrors } from '@/lib/api';
import { formatDate } from '@/lib/dates';
import { fullName } from '@/lib/utils';

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: passwordRule,
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ['newPassword'], message: 'Choose a different password' });

const contactSchema = z.object({
  phone: z.string().trim().max(20).regex(/^[+\d\s()-]*$/, 'Digits, spaces and + ( ) - only'),
});

function Detail({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="truncate text-sm font-medium text-slate-900">{value || '—'}</p>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  useDocumentTitle('My profile');
  const { user, setUser, isAdmin } = useAuth();

  const contact = useForm({ resolver: zodResolver(contactSchema), defaultValues: { phone: user.phone ?? '' } });
  const password = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  useEffect(() => {
    contact.reset({ phone: user.phone ?? '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.phone]);

  const saveContact = async (values) => {
    try {
      setUser(await authApi.updateProfile(values));
      toast.success('Contact details updated');
    } catch (err) {
      if (!applyServerErrors(err, contact.setError)) toast.error(err.message);
    }
  };

  const changePassword = async ({ currentPassword, newPassword }) => {
    try {
      setUser(await authApi.changePassword({ currentPassword, newPassword }));
      password.reset();
      toast.success('Password changed', { description: 'Other sessions have been signed out.' });
    } catch (err) {
      if (!applyServerErrors(err, password.setError)) toast.error(err.message);
    }
  };

  return (
    <>
      <PageHeader title="My profile" description="Your employee details and account security." />

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="h-fit overflow-hidden">
          <div className="h-20 bg-gradient-to-r from-brand-500 via-brand-600 to-sky-500" />
          <div className="-mt-10 px-6 pb-4">
            <Avatar user={user} size="xl" className="ring-4" />
            <h2 className="mt-3 text-lg font-semibold text-slate-900">{fullName(user)}</h2>
            <p className="text-sm text-slate-500">{user.designation || (isAdmin ? 'Administrator' : 'Employee')}</p>
            <div className="mt-2 flex gap-2">
              {isAdmin ? (
                <Badge tone="brand">
                  <ShieldCheck size={12} /> Admin
                </Badge>
              ) : (
                <Badge>Employee</Badge>
              )}
              <Badge tone="green" dot>
                Active
              </Badge>
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              <Detail icon={Hash} label="Employee ID" value={user.employeeId} />
              <Detail icon={Mail} label="Email" value={user.email} />
              <Detail icon={Phone} label="Phone" value={user.phone} />
              <Detail icon={BriefcaseBusiness} label="Department" value={user.department} />
              <Detail icon={CalendarDays} label="Joined" value={user.joiningDate && formatDate(user.joiningDate, 'd MMMM yyyy')} />
            </div>
            <p className="mt-3 text-xs text-slate-400">To change your name, email or role, contact your administrator.</p>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader icon={Phone} title="Contact details" description="Keep your phone number up to date." />
            <form onSubmit={contact.handleSubmit(saveContact)} className="flex flex-col gap-3 px-5 pb-5 sm:flex-row sm:items-start" noValidate>
              <FormField label="Phone number" error={contact.formState.errors.phone?.message} className="flex-1">
                {(ids) => <Input {...ids} type="tel" placeholder="+91 98765 43210" {...contact.register('phone')} />}
              </FormField>
              <Button type="submit" variant="secondary" className="sm:mt-6" loading={contact.formState.isSubmitting} disabled={!contact.formState.isDirty}>
                Save
              </Button>
            </form>
          </Card>

          <Card>
            <CardHeader icon={KeyRound} title="Change password" description="Use at least 8 characters with a letter and a number." />
            <form onSubmit={password.handleSubmit(changePassword)} className="space-y-4 px-5 pb-5" noValidate>
              <FormField label="Current password" error={password.formState.errors.currentPassword?.message}>
                {(ids) => <Input {...ids} type="password" autoComplete="current-password" {...password.register('currentPassword')} />}
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="New password" error={password.formState.errors.newPassword?.message}>
                  {(ids) => <Input {...ids} type="password" autoComplete="new-password" {...password.register('newPassword')} />}
                </FormField>
                <FormField label="Confirm new password" error={password.formState.errors.confirmPassword?.message}>
                  {(ids) => <Input {...ids} type="password" autoComplete="new-password" {...password.register('confirmPassword')} />}
                </FormField>
              </div>
              <div className="flex justify-end">
                <Button type="submit" loading={password.formState.isSubmitting}>
                  Update password
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
