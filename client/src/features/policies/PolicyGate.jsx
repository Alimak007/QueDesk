import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, LogOut, ScrollText } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router';
import { toast } from 'sonner';
import { FullPageLoader } from '@/components/layout/FullPageLoader';
import { Logo } from '@/components/layout/Logo';
import { Button, Card, Checkbox, ErrorState } from '@/components/ui';
import { useAuth } from '@/features/auth/useAuth';
import { onPolicyAcceptanceRequired } from '@/lib/api';
import { formatDate } from '@/lib/dates';
import { cn, fullName } from '@/lib/utils';
import { policyKeys, useAcceptPolicies, usePendingPolicies } from './api';
import { PolicyCategoryLabel, PolicyContent } from './components';

/**
 * Employees must accept the company policies meant for them before they can
 * use the portal — on their first sign-in, and again whenever a policy is
 * published or significantly changed. The API enforces the same rule.
 */
export function PolicyGate() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const pending = usePendingPolicies({ enabled: !isAdmin });

  useEffect(() => {
    // A policy published while the app is open: the API starts refusing, so ask again.
    onPolicyAcceptanceRequired(() => queryClient.invalidateQueries({ queryKey: policyKeys.pending }));
    return () => onPolicyAcceptanceRequired(null);
  }, [queryClient]);

  if (isAdmin) return <Outlet />;
  if (pending.isPending) return <FullPageLoader />;
  if (pending.isError) {
    return (
      <GateFrame>
        <Card className="mx-auto max-w-md">
          <ErrorState error={pending.error} onRetry={pending.refetch} />
        </Card>
      </GateFrame>
    );
  }
  if (pending.data.length) return <AcceptPolicies policies={pending.data} onRetry={pending.refetch} />;
  return <Outlet />;
}

function GateFrame({ children }) {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span className="hidden sm:inline">Signed in as {fullName(user)}</span>
            <Button variant="ghost" size="sm" leftIcon={LogOut} onClick={logout}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">{children}</main>
    </div>
  );
}

function AcceptPolicies({ policies, onRetry }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const accept = useAcceptPolicies();
  const [index, setIndex] = useState(0);
  const [read, setRead] = useState(() => new Set());
  const [agreed, setAgreed] = useState(() => new Set());

  const current = policies[Math.min(index, policies.length - 1)];
  const isLast = index >= policies.length - 1;
  const hasRead = read.has(current.id);
  const allAgreed = policies.every((p) => agreed.has(p.id));

  const markRead = useCallback((id) => setRead((prev) => (prev.has(id) ? prev : new Set(prev).add(id))), []);

  // A policy short enough to fit without scrolling counts as read once shown.
  const measure = useCallback(
    (node) => {
      if (node && node.scrollHeight <= node.clientHeight + 8) markRead(current.id);
    },
    [current.id, markRead],
  );

  const onScroll = (event) => {
    const node = event.currentTarget;
    if (node.scrollTop + node.clientHeight >= node.scrollHeight - 8) markRead(current.id);
  };

  const toggleAgreed = (checked) =>
    setAgreed((prev) => {
      const next = new Set(prev);
      if (checked) next.add(current.id);
      else next.delete(current.id);
      return next;
    });

  const submit = async () => {
    try {
      await accept.mutateAsync(policies.map((p) => ({ id: p.id, version: p.version })));
      queryClient.setQueryData(policyKeys.pending, []);
      toast.success('Thank you — you’re all set', {
        description: 'You can read the policies again any time under Policies.',
      });
    } catch (err) {
      toast.error(err.message);
      if (err.code === 'POLICY_CHANGED') {
        setIndex(0);
        setRead(new Set());
        setAgreed(new Set());
        onRetry();
      }
    }
  };

  return (
    <GateFrame>
      <div className="mb-6 max-w-2xl">
        <p className="text-sm font-medium text-brand-700">Welcome, {user.firstName}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Please read and accept our policies</h1>
        <p className="mt-2 text-sm text-slate-600">
          Before you start, read {policies.length === 1 ? 'the policy' : `each of the ${policies.length} policies`} below and
          confirm that you agree to follow {policies.length === 1 ? 'it' : 'them'}. You can read them again whenever you need
          to under <span className="font-medium text-slate-800">Policies</span>.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav aria-label="Policies to accept">
          <ol className="space-y-1.5">
            {policies.map((policy, i) => {
              const done = agreed.has(policy.id);
              const active = i === index;
              return (
                <li key={policy.id}>
                  <button
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-current={active ? 'step' : undefined}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                      active ? 'bg-white font-medium text-slate-900 shadow-card ring-1 ring-slate-200' : 'text-slate-600 hover:bg-white/70',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                        done ? 'bg-emerald-500 text-white' : active ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-600',
                      )}
                    >
                      {done ? <Check size={14} /> : i + 1}
                    </span>
                    <span className="min-w-0 truncate">{policy.title}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <Card className="flex min-w-0 flex-col">
          <div className="border-b border-slate-100 px-6 pb-4 pt-5">
            <PolicyCategoryLabel category={current.category} />
            <h2 className="mt-1 text-lg font-semibold text-slate-900">{current.title}</h2>
            {current.summary && <p className="mt-1 text-sm text-slate-500">{current.summary}</p>}
            <p className="mt-2 text-xs text-slate-400">
              Version {current.version}
              {current.versionDate && ` · effective ${formatDate(current.versionDate)}`}
            </p>
          </div>

          <div
            key={current.id}
            ref={measure}
            onScroll={onScroll}
            tabIndex={0}
            aria-label={`${current.title} — policy text`}
            className="scrollbar-thin max-h-[52vh] min-h-48 overflow-y-auto px-6 py-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
          >
            <PolicyContent content={current.content} />
          </div>

          <div className="space-y-4 rounded-b-2xl border-t border-slate-100 bg-slate-50/60 px-6 py-4">
            <Checkbox
              key={`agree-${current.id}`}
              checked={agreed.has(current.id)}
              onChange={(e) => toggleAgreed(e.target.checked)}
              disabled={!hasRead}
              label={`I have read and understood the ${current.title} and agree to follow it.`}
              description={hasRead ? undefined : 'Scroll to the end of the policy to continue.'}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button variant="ghost" leftIcon={ArrowLeft} onClick={() => setIndex((i) => i - 1)} disabled={index === 0}>
                Previous
              </Button>
              {isLast ? (
                <Button leftIcon={ScrollText} onClick={submit} disabled={!allAgreed} loading={accept.isPending}>
                  {policies.length === 1 ? 'Accept and continue' : `Accept all ${policies.length} and continue`}
                </Button>
              ) : (
                <Button rightIcon={ArrowRight} onClick={() => setIndex((i) => i + 1)} disabled={!agreed.has(current.id)}>
                  Next policy
                </Button>
              )}
            </div>
            {isLast && !allAgreed && policies.length > 1 && (
              <p className="text-right text-xs text-slate-500">Agree to every policy on the left to continue.</p>
            )}
          </div>
        </Card>
      </div>
    </GateFrame>
  );
}
