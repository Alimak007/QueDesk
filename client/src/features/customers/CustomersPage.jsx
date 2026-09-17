import { ArrowLeftRight, FilterX, Plus, Search, Settings2, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Badge, Button, Card, ErrorState, Input, PageHeader, Select, Skeleton } from '@/components/ui';
import { usePermissions } from '@/features/auth/usePermissions';
import { useDirectory } from '@/features/employees/api';
import { RecordFormModal } from '@/features/records/RecordFormModal';
import { RecordListView } from '@/features/records/RecordListView';
import { RecordSheet } from '@/features/records/RecordSheet';
import { useSalesConfig } from '@/features/sales/api';
import { SYSTEM_CUSTOMER_STATUS_KEY, SYSTEM_CUSTOMER_TITLE_KEY } from '@/features/sales/constants';
import { useDebouncedValue, useDocumentTitle, useQueryState, useUrlParam } from '@/hooks';
import { formatDate } from '@/lib/dates';
import { useCreateCustomer, useCustomers, useDeleteCustomer, useUpdateCustomer } from './api';

const DEFAULTS = { search: '', owner: '', status: '', source: '', page: 1, sortBy: 'createdAt', sortOrder: 'desc' };

export default function CustomersPage() {
  useDocumentTitle('Customers');
  const { can, isAdmin } = usePermissions();
  const [filters, setFilters] = useQueryState(DEFAULTS);
  const [searchInput, setSearchInput] = useState(filters.search);
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [action, setAction] = useUrlParam('action');
  const [openId, setOpenId] = useUrlParam('customer');

  const config = useSalesConfig({ entity: 'customer' });
  const directory = useDirectory();
  const fields = useMemo(() => config.data?.fields ?? [], [config.data]);
  const settings = config.data?.settings;
  const statusField = fields.find((f) => f.key === SYSTEM_CUSTOMER_STATUS_KEY);

  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();

  const query = useCustomers({ ...filters, limit: 15 });
  const [form, setForm] = useState({ open: false, record: null });

  useEffect(() => {
    if (debouncedSearch !== filters.search) setFilters({ search: debouncedSearch });
  }, [debouncedSearch, filters.search, setFilters]);

  const openRecord = query.data?.items.find((c) => c.id === openId) ?? null;
  const hasFilters = Boolean(filters.search || filters.owner || filters.status || filters.source);

  return (
    <>
      <PageHeader
        title="Customers"
        description="Won business, converted from leads or added directly. The form is configured in Settings."
        actions={
          <>
            {isAdmin && (
              <Button as={Link} to="/settings?tab=customer-form" variant="secondary" leftIcon={Settings2}>
                Configure
              </Button>
            )}
            {can('customers', 'create') && (
              <Button leftIcon={Plus} onClick={() => setForm({ open: true, record: null })}>
                Add customer
              </Button>
            )}
          </>
        }
      />

      {config.isError ? (
        <Card>
          <ErrorState error={config.error} onRetry={config.refetch} />
        </Card>
      ) : (
        <>
          <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto]">
            <Input
              leftIcon={Search}
              placeholder="Search customers…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search customers"
            />
            <Select aria-label="Filter by owner" value={filters.owner} onChange={(e) => setFilters({ owner: e.target.value })} placeholder="All owners">
              {(directory.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
            </Select>
            <Select aria-label="Filter by status" value={filters.status} onChange={(e) => setFilters({ status: e.target.value })} placeholder="Any status">
              {(statusField?.options ?? []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Select aria-label="Filter by source" value={filters.source} onChange={(e) => setFilters({ source: e.target.value })} placeholder="Any source">
              <option value="lead">Converted lead</option>
              <option value="manual">Added directly</option>
            </Select>
            <Button
              variant="ghost"
              leftIcon={FilterX}
              disabled={!hasFilters}
              onClick={() => {
                setSearchInput('');
                setFilters({ search: '', owner: '', status: '', source: '' });
              }}
            >
              Clear
            </Button>
          </div>

          {config.isPending ? (
            <Skeleton className="h-96 w-full rounded-2xl" />
          ) : (
            <RecordListView
              query={query}
              fields={fields}
              settings={settings}
              filters={filters}
              setFilters={setFilters}
              hasFilters={hasFilters}
              titleKey={SYSTEM_CUSTOMER_TITLE_KEY}
              emptyIcon={UsersRound}
              emptyTitle="No customers yet"
              emptyDescription="Convert a lead or add a customer directly to get started."
              createLabel="Add customer"
              canCreate={can('customers', 'create')}
              onCreate={() => setForm({ open: true, record: null })}
              onOpen={(record) => setOpenId(record.id)}
              extraColumns={[
                {
                  key: 'source',
                  label: 'Source',
                  render: (record) =>
                    record.source === 'lead' ? (
                      <Badge tone="violet">
                        <ArrowLeftRight size={11} /> From lead
                      </Badge>
                    ) : (
                      <span className="text-sm text-slate-500">Direct</span>
                    ),
                },
              ]}
            />
          )}
        </>
      )}

      <RecordSheet
        record={openRecord}
        fields={fields}
        settings={settings}
        open={Boolean(openRecord)}
        onOpenChange={(open) => !open && setOpenId(null)}
        titleKey={SYSTEM_CUSTOMER_TITLE_KEY}
        statusKey={SYSTEM_CUSTOMER_STATUS_KEY}
        canEdit={can('customers', 'edit')}
        canDelete={can('customers', 'delete')}
        deleteMutation={deleteCustomer}
        deleteLabel="Delete customer"
        onEdit={(record) => {
          setOpenId(null);
          setForm({ open: true, record });
        }}
      >
        {openRecord?.source === 'lead' && (
          <div className="rounded-xl bg-violet-50 px-4 py-3 text-sm ring-1 ring-violet-100">
            <p className="font-medium text-violet-900">Converted from a lead</p>
            <p className="mt-0.5 text-xs text-violet-800/80">
              {openRecord.lead?.data?.leadName ? `Original lead: ${openRecord.lead.data.leadName}. ` : 'The original lead has since been removed. '}
              {openRecord.convertedAt && `Converted on ${formatDate(openRecord.convertedAt, 'd MMM yyyy')}.`}
            </p>
          </div>
        )}
      </RecordSheet>

      <RecordFormModal
        entity="customer"
        open={form.open || action === 'new'}
        record={form.record}
        createMutation={createCustomer}
        updateMutation={updateCustomer}
        labels={{
          createTitle: 'Add customer',
          editTitle: 'Edit customer',
          description: 'Customer records are shared with the whole team.',
          submit: 'Create customer',
          created: 'Customer created',
          updated: 'Customer updated',
          ownerHint: 'The teammate who looks after this account.',
        }}
        onOpenChange={(open) => {
          setForm((prev) => ({ ...prev, open }));
          if (!open) setAction(null);
        }}
      />
    </>
  );
}
