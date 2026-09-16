import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarDays, ClipboardList, Eye, EyeOff, KanbanSquare, Lock, Mail, Plane, ReceiptText, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router';
import { z } from 'zod';
import { Logo } from '@/components/layout/Logo';
import { Button, FormField, Input } from '@/components/ui';
import { useDocumentTitle } from '@/hooks';
import { useAuth } from './useAuth';

const schema = z.object({
  email: z.string().trim().min(1, 'Email is required').pipe(z.email('Enter a valid email address')),
  password: z.string().min(1, 'Password is required'),
});

const HIGHLIGHTS = [
  { icon: Plane, title: 'Leave, without the email chains', text: 'Apply, track and approve requests in a couple of clicks.' },
  { icon: ClipboardList, title: 'Daily status in one place', text: 'A searchable history of what everyone worked on.' },
  { icon: CalendarDays, title: 'A shared company calendar', text: 'Holidays, events and meetings that everyone can see.' },
  { icon: KanbanSquare, title: 'Leads to customers', text: 'A pipeline you configure, converting won leads into customers.' },
  { icon: ReceiptText, title: 'Payslips and invoices', text: 'Branded PDF documents generated from your own company profiles.' },
];

export default function LoginPage() {
  useDocumentTitle('Sign in');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  const onSubmit = async (values) => {
    setFormError('');
    try {
      await login(values);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setFormError(err.message);
    }
  };

  return (
    <div className="grid min-h-dvh bg-white lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-slate-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              'radial-gradient(60rem 40rem at 10% -10%, rgba(99,102,241,0.55), transparent 60%), radial-gradient(40rem 30rem at 110% 110%, rgba(56,189,248,0.25), transparent 60%)',
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
          aria-hidden
        />

        <div className="relative flex items-center gap-2.5 text-white">
          <span className="flex size-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
            <ShieldCheck size={18} />
          </span>
          <span className="text-sm font-medium text-white/80">Que Info Technologies</span>
        </div>

        <div className="relative max-w-lg">
          <h1 className="text-4xl font-semibold leading-[1.15] tracking-tight text-white">
            Everything your team needs, <span className="text-brand-300">in one portal.</span>
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-300">
            Replace scattered emails with a single, secure workspace for leave, daily updates, the company calendar and
            sales.
          </p>

          <ul className="mt-10 grid gap-5">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] text-brand-200 ring-1 ring-white/10">
                  <Icon size={19} />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-white">{title}</span>
                  <span className="mt-0.5 block text-sm text-slate-400">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-500">© {new Date().getFullYear()} Que Info Technologies. All rights reserved.</p>
      </aside>

      {/* Form panel */}
      <main className="flex items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-sm">
          <Logo size="lg" />

          <div className="mt-10">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Welcome back</h2>
            <p className="mt-1.5 text-sm text-slate-500">Sign in with the credentials provided by your administrator.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
            {formError && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            <FormField label="Email address" error={errors.email?.message}>
              {(field) => (
                <Input
                  {...field}
                  {...register('email')}
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  leftIcon={Mail}
                  className="h-11"
                />
              )}
            </FormField>

            <FormField label="Password" error={errors.password?.message}>
              {(field) => (
                <Input
                  {...field}
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  leftIcon={Lock}
                  className="h-11"
                  rightSlot={
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="rounded-md p-2 text-slate-400 hover:text-slate-600"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  }
                />
              )}
            </FormField>

            <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
              Sign in
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500">
            Forgot your password? Contact your portal administrator to reset it.
          </p>
        </div>
      </main>
    </div>
  );
}
