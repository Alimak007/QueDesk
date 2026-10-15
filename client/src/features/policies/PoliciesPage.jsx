import { CircleCheck, Plus, ScrollText } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  SkeletonRows,
  Table,
  Tabs,
  Td,
  Th,
  THead,
  Tr,
} from '@/components/ui';
import { useAuth } from '@/features/auth/useAuth';
import { useDocumentTitle, useQueryState } from '@/hooks';
import { POLICY_STATUSES } from '@/lib/constants';
import { formatDate, timeAgo } from '@/lib/dates';
import { truncate } from '@/lib/utils';
import { usePolicies } from './api';
import { AcceptanceMeter, PolicyCategoryLabel, PolicyStatusBadge } from './components';
import { describeAudience } from './utils';

export default function PoliciesPage() {
  const { isAdmin } = useAuth();
  useDocumentTitle('Policies');
  return isAdmin ? <ManagePolicies /> : <MyPolicies />;
}

function ManagePolicies() {
  const navigate = useNavigate();
  const [filters, setFilters] = useQueryState({ status: '' });
  const { data, isPending, isError, error, refetch } = usePolicies({ status: filters.status });

  return (
    <>
      <PageHeader
        title="Policies"
        description="Write and publish company policies. Employees accept the ones that apply to them before they can use QueDesk."
        actions={
          <Button as={Link} to="/policies/new" leftIcon={Plus}>
            New policy
          </Button>
        }
      />

      <Card>
        <div className="border-b border-slate-100 px-5 py-4">
          <Tabs
            value={filters.status}
            onChange={(status) => setFilters({ status })}
            options={[{ value: '', label: 'All' }, ...POLICY_STATUSES.map(({ value, label }) => ({ value, label }))]}
          />
        </div>

        {isPending ? (
          <SkeletonRows rows={4} />
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : data.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title={filters.status ? 'No policies here' : 'No policies yet'}
            description={
              filters.status
                ? 'Try another tab.'
                : 'Write your first policy — a code of conduct, leave rules, IT security — and publish it for employees to accept.'
            }
            action={
              !filters.status && (
                <Button as={Link} to="/policies/new" leftIcon={Plus}>
                  New policy
                </Button>
              )
            }
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>Policy</Th>
                <Th>Applies to</Th>
                <Th>Status</Th>
                <Th>Accepted</Th>
                <Th>Updated</Th>
              </tr>
            </THead>
            <tbody>
              {data.map((policy) => (
                <Tr key={policy.id} onClick={() => navigate(`/policies/${policy.id}`)}>
                  <Td>
                    <PolicyCategoryLabel category={policy.category} className="text-[11px]" />
                    <span className="block font-medium text-slate-900">{policy.title}</span>
                    {policy.summary && <span className="block text-xs text-slate-500">{truncate(policy.summary, 90)}</span>}
                  </Td>
                  <Td className="max-w-48 truncate">{describeAudience(policy)}</Td>
                  <Td>
                    <span className="flex items-center gap-1.5">
                      <PolicyStatusBadge status={policy.status} />
                      {policy.publishedAt && <span className="text-xs text-slate-400">v{policy.version}</span>}
                    </span>
                  </Td>
                  <Td>
                    {!policy.requiresAcceptance ? (
                      <span className="text-xs text-slate-500">Not required</span>
                    ) : policy.status === 'published' ? (
                      <AcceptanceMeter stats={policy.stats} />
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-slate-500">{timeAgo(policy.updatedAt)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}

function MyPolicies() {
  const { data, isPending, isError, error, refetch } = usePolicies();

  return (
    <>
      <PageHeader title="Policies" description="The company policies that apply to you. They are read-only." />
      {isPending ? (
        <Card>
          <SkeletonRows rows={3} />
        </Card>
      ) : isError ? (
        <Card>
          <ErrorState error={error} onRetry={refetch} />
        </Card>
      ) : data.length === 0 ? (
        <Card>
          <EmptyState icon={ScrollText} title="No policies yet" description="Policies your company publishes will appear here." />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((policy) => (
            <Link key={policy.id} to={`/policies/${policy.id}`} className="group">
              <Card className="flex h-full flex-col p-5 transition-shadow group-hover:shadow-pop">
                <PolicyCategoryLabel category={policy.category} className="text-[11px]" />
                <h2 className="mt-1 font-semibold text-slate-900 group-hover:text-brand-700">{policy.title}</h2>
                {policy.summary && <p className="mt-1 text-sm text-slate-500">{truncate(policy.summary, 140)}</p>}
                <div className="mt-auto pt-4">
                  {policy.acceptance?.current ? (
                    <Badge tone="green">
                      <CircleCheck size={12} /> Accepted {formatDate(policy.acceptance.acceptedAt)}
                    </Badge>
                  ) : policy.requiresAcceptance ? (
                    <Badge tone="amber">Waiting for your acceptance</Badge>
                  ) : (
                    <Badge tone="slate">For your information</Badge>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
