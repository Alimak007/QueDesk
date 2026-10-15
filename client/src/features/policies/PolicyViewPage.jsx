import { Archive, ArrowLeft, CircleCheck, Pencil, Send, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Skeleton,
  SkeletonRows,
  Tabs,
  UserCell,
} from '@/components/ui';
import { useAuth } from '@/features/auth/useAuth';
import { useDocumentTitle } from '@/hooks';
import { formatDate } from '@/lib/dates';
import { fullName } from '@/lib/utils';
import { useDeletePolicy, usePolicy, usePolicyAcceptances, useSetPolicyStatus } from './api';
import { AcceptanceMeter, PolicyCategoryLabel, PolicyContent, PolicyStatusBadge } from './components';
import { describeAudience } from './utils';

const ACCEPTANCE_STATUS = {
  accepted: { label: 'Accepted', tone: 'green' },
  outdated: { label: 'Accepted an older version', tone: 'amber' },
  pending: { label: 'Not yet', tone: 'slate' },
};

export default function PolicyViewPage() {
  const { id } = useParams();
  const { isAdmin } = useAuth();
  const { data: policy, isPending, isError, error, refetch } = usePolicy(id);
  useDocumentTitle(policy?.title ?? 'Policy');

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Card className="p-6">
          <SkeletonRows rows={4} />
        </Card>
      </div>
    );
  }
  if (isError) {
    return (
      <Card>
        <ErrorState error={error} onRetry={refetch} />
      </Card>
    );
  }

  return (
    <>
      <Link to="/policies" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={15} /> All policies
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <div className="border-b border-slate-100 px-6 pb-5 pt-6 sm:px-8">
            <div className="flex flex-wrap items-center gap-2">
              <PolicyCategoryLabel category={policy.category} />
              {isAdmin && <PolicyStatusBadge status={policy.status} />}
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{policy.title}</h1>
            {policy.summary && <p className="mt-2 text-slate-600">{policy.summary}</p>}
            <p className="mt-3 text-xs text-slate-400">
              {policy.publishedAt ? `Version ${policy.version}` : 'Not published yet'}
              {policy.versionDate && ` · effective ${formatDate(policy.versionDate)}`}
              {` · applies to ${describeAudience(policy)}`}
            </p>
          </div>
          <PolicyContent content={policy.content} className="px-6 py-6 sm:px-8" />
        </Card>

        <div className="space-y-4">{isAdmin ? <AdminPanel policy={policy} /> : <EmployeePanel policy={policy} />}</div>
      </div>
    </>
  );
}

function EmployeePanel({ policy }) {
  const { acceptance } = policy;
  return (
    <Card className="p-5">
      {acceptance?.current ? (
        <div className="flex gap-3">
          <CircleCheck size={20} className="mt-0.5 shrink-0 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-slate-900">You accepted this policy</p>
            <p className="mt-0.5 text-sm text-slate-500">
              On {formatDate(acceptance.acceptedAt, 'd MMM yyyy, h:mm a')} (version {acceptance.version}).
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-600">
          {policy.requiresAcceptance
            ? 'You will be asked to accept this policy the next time you sign in.'
            : 'This policy is for your information; it does not need to be accepted.'}
        </p>
      )}
      <p className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
        Policies are set by your administrator and cannot be changed here. Questions? Ask HR.
      </p>
    </Card>
  );
}

function AdminPanel({ policy }) {
  const navigate = useNavigate();
  const setStatus = useSetPolicyStatus();
  const deletePolicy = useDeletePolicy();
  const [confirm, setConfirm] = useState(null);

  const changeStatus = async (status) => {
    try {
      await setStatus.mutateAsync({ id: policy.id, status });
      toast.success(status === 'published' ? 'Policy published' : 'Policy archived', {
        description:
          status === 'published' && policy.requiresAcceptance
            ? 'Employees it applies to will be asked to accept it.'
            : status === 'archived'
              ? 'Employees no longer see it. The record of who accepted it is kept.'
              : undefined,
      });
      setConfirm(null);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const remove = async () => {
    try {
      await deletePolicy.mutateAsync(policy.id);
      toast.success('Policy deleted');
      navigate('/policies', { replace: true });
    } catch (err) {
      toast.error(err.message);
      setConfirm(null);
    }
  };

  const CONFIRMS = {
    publish: {
      title: 'Publish this policy?',
      description: policy.requiresAcceptance
        ? `Employees it applies to (${describeAudience(policy)}) will have to read and accept it before they can continue using QueDesk.`
        : `Employees it applies to (${describeAudience(policy)}) will be able to read it under Policies.`,
      confirmLabel: 'Publish',
      onConfirm: () => changeStatus('published'),
      loading: setStatus.isPending,
      tone: 'primary',
    },
    archive: {
      title: 'Archive this policy?',
      description: 'Employees will no longer see it or be asked to accept it. The record of who accepted it is kept, and you can publish it again later.',
      confirmLabel: 'Archive',
      onConfirm: () => changeStatus('archived'),
      loading: setStatus.isPending,
      tone: 'primary',
    },
    delete: {
      title: 'Delete this policy?',
      description: 'This cannot be undone. A policy that anyone has accepted cannot be deleted — archive it instead.',
      confirmLabel: 'Delete',
      onConfirm: remove,
      loading: deletePolicy.isPending,
      tone: 'danger',
    },
  };
  const dialog = confirm ? CONFIRMS[confirm] : null;

  return (
    <>
      <Card className="p-5">
        <div className="flex flex-wrap gap-2">
          <Button as={Link} to={`/policies/${policy.id}/edit`} variant="secondary" leftIcon={Pencil}>
            Edit
          </Button>
          {policy.status === 'published' ? (
            <Button variant="secondary" leftIcon={Archive} onClick={() => setConfirm('archive')}>
              Archive
            </Button>
          ) : (
            <Button leftIcon={Send} onClick={() => setConfirm('publish')}>
              Publish
            </Button>
          )}
          <Button variant="danger-soft" size="icon" aria-label="Delete policy" onClick={() => setConfirm('delete')}>
            <Trash2 size={16} />
          </Button>
        </div>
        <dl className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Acceptance</dt>
            <dd className="text-right text-slate-900">{policy.requiresAcceptance ? 'Required' : 'Not required'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Created by</dt>
            <dd className="text-right text-slate-900">{fullName(policy.createdBy) || '—'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Last edited</dt>
            <dd className="text-right text-slate-900">
              {formatDate(policy.updatedAt)}
              {policy.updatedBy && ` by ${fullName(policy.updatedBy)}`}
            </dd>
          </div>
        </dl>
      </Card>

      {policy.publishedAt && policy.requiresAcceptance && <AcceptanceList policy={policy} />}

      <ConfirmDialog
        open={Boolean(dialog)}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={dialog?.title}
        description={dialog?.description}
        confirmLabel={dialog?.confirmLabel}
        tone={dialog?.tone}
        loading={dialog?.loading}
        onConfirm={dialog?.onConfirm}
      />
    </>
  );
}

function AcceptanceList({ policy }) {
  const { data, isPending, isError, error, refetch } = usePolicyAcceptances(policy.id);
  const [filter, setFilter] = useState('pending');

  const items = data?.items ?? [];
  const outstanding = items.filter((i) => i.status !== 'accepted');
  const shown = filter === 'pending' ? outstanding : items.filter((i) => i.status === 'accepted');

  return (
    <Card>
      <CardHeader icon={Users} title="Who has accepted" description={`Version ${policy.version}`} />
      <div className="px-5 pb-3">
        <AcceptanceMeter stats={policy.stats} />
      </div>
      {isPending ? (
        <SkeletonRows rows={3} />
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <>
          <div className="border-t border-slate-100 px-5 py-3">
            <Tabs
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'pending', label: 'Waiting', count: outstanding.length },
                { value: 'accepted', label: 'Accepted', count: items.length - outstanding.length },
              ]}
            />
          </div>
          {shown.length === 0 ? (
            <EmptyState
              compact
              icon={filter === 'pending' ? CircleCheck : Users}
              title={filter === 'pending' ? 'Everyone has accepted' : 'Nobody yet'}
              description={filter === 'pending' ? undefined : 'Employees accept it the next time they sign in.'}
            />
          ) : (
            <ul className="scrollbar-thin max-h-96 divide-y divide-slate-100 overflow-y-auto border-t border-slate-100">
              {shown.map((item) => (
                <li key={item.employee.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <UserCell user={item.employee} subtitle={item.employee.department || item.employee.employeeId} />
                  <span className="shrink-0 text-right">
                    <Badge tone={ACCEPTANCE_STATUS[item.status].tone}>{ACCEPTANCE_STATUS[item.status].label}</Badge>
                    {item.acceptedAt && (
                      <span className="mt-0.5 block text-[11px] text-slate-400">{formatDate(item.acceptedAt)}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}
