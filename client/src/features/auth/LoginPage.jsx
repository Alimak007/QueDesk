import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router';
import { z } from 'zod';
import { Button, FormField, Input } from '@/components/ui';
import { useDocumentTitle } from '@/hooks';
import { Cityscape } from './Cityscape';
import { useAuth } from './useAuth';

const schema = z.object({
  email: z.string().trim().min(1, 'Email is required').pipe(z.email('Enter a valid email address')),
  password: z.string().min(1, 'Password is required'),
});

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
    <div className="relative min-h-dvh overflow-hidden bg-[#05071a]">
      {/* The backdrop runs edge to edge, behind everything. */}
      <Cityscape className="pointer-events-none absolute inset-0 size-full" />

      {/* Depth: a wash from the left so the wordmark reads, plus a vignette. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(130% 95% at 50% 95%, transparent 48%, rgba(5,7,26,0.58) 100%),' +
            'linear-gradient(100deg, rgba(5,7,26,0.86) 0%, rgba(5,7,26,0.45) 38%, rgba(5,7,26,0.10) 62%, rgba(5,7,26,0.35) 100%)',
        }}
        aria-hidden
      />

      <div className="relative mx-auto grid min-h-dvh w-full max-w-[1600px] items-center gap-12 px-6 py-10 lg:grid-cols-[1.1fr_auto] lg:px-16 xl:px-24">
        {/* Wordmark and thought */}
        <section className="hidden lg:block">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-brand-200 ring-1 ring-white/15 backdrop-blur">
            <span className="size-1.5 rounded-full bg-brand-400" />
            Que Info Technologies
          </span>

          <h1 className="mt-8 text-7xl font-semibold tracking-tight text-white xl:text-8xl">
            Que<span className="bg-gradient-to-r from-brand-300 to-sky-300 bg-clip-text text-transparent">Desk</span>
          </h1>

          <span className="mt-8 block h-px w-20 bg-gradient-to-r from-brand-400 to-transparent" aria-hidden />

          <p className="mt-8 max-w-md text-2xl font-light leading-relaxed text-slate-200/90">
            Great work begins with a clear desk
            <br />
            and a clear mind.
          </p>
        </section>

        {/* Sign-in card */}
        <section className="mx-auto w-full max-w-[26rem] lg:mx-0">
          <div className="relative">
            {/* A soft bloom behind the card lifts it off the skyline. */}
            <div
              className="pointer-events-none absolute -inset-6 rounded-[2rem] opacity-70 blur-2xl"
              style={{ background: 'radial-gradient(60% 60% at 50% 40%, rgba(99,102,241,0.45), transparent 70%)' }}
              aria-hidden
            />

            <div className="relative overflow-hidden rounded-3xl bg-white/[0.97] shadow-[0_45px_90px_-25px_rgba(2,4,20,0.85)] ring-1 ring-white/50 backdrop-blur-2xl">
              {/* Brand rule along the top edge. */}
              <div className="h-1 bg-gradient-to-r from-brand-500 via-brand-400 to-sky-400" aria-hidden />

              <div className="px-8 py-9 sm:px-10">
                {/* The wordmark lives beside the card on large screens, inside it on small ones. */}
                <p className="text-3xl font-semibold tracking-tight text-slate-900 lg:hidden">
                  Que<span className="text-brand-600">Desk</span>
                </p>

                <h2 className="mt-6 text-[1.7rem] font-semibold tracking-tight text-slate-900 lg:mt-0">Welcome back</h2>
                <p className="mt-1.5 text-sm text-slate-500">Sign in with the credentials provided by your administrator.</p>

                <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-5" noValidate>
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
                        className="h-12"
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
                        className="h-12"
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

                  <Button type="submit" size="lg" className="h-12 w-full" loading={isSubmitting} rightIcon={ArrowRight}>
                    Sign in
                  </Button>
                </form>

                <p className="mt-7 border-t border-slate-100 pt-5 text-center text-xs text-slate-500">
                  Forgot your password? Contact your portal administrator to reset it.
                </p>
              </div>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-white/40">© {new Date().getFullYear()} Que Info Technologies</p>
        </section>
      </div>
    </div>
  );
}
