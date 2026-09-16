import { BriefcaseBusiness, CircleCheck, FilterX, KanbanSquare, List, Plus, Search, Settings2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Badge, Button, Card, ErrorState, Input, PageHeader, Select, Skeleton, Tabs } from '@/components/ui';
import { useAuth } from '@/features/auth/useAuth';
import { usePermissions } from '@/features/auth/usePermissions';
import { useDirectory } from '@/features/employees/api';
import { useDebouncedValue, useDocumentTitle, useQueryState, useUrlParam } from '@/hooks';
import { OPTION_COLORS } from '@/lib/constants';
import { cn, formatCurrency } from '@/lib/utils';
import { useSalesConfig, useSalesSummary } from './api';
import { SYSTEM_TITLE_KEY } from './constants';
import { KanbanBoard } from './KanbanBoard';
import { RecordFormModal } from '@/features/records/RecordFormModal';
import { useCreateLead, useUpdateLead } from './api';
import { RecordListView } from '@/features/records/RecordListView';
import { useLeads } from './api';
import { LeadSheet } from './LeadSheet';

const DEFAULTS = { view: 'kanban', search: '', owner: '', group: '', state: '', page: 1, sortBy: 'createdAt', sortOrder: 'desc' };

function PipelineSummary({ settings }) {
  const { data, isPending } = useSalesSummary();

  if (isPending) return <Skeleton className="mb-6 h-20 w-full rounded-2xl" />;
  if (!data?.stages?.length) return null;

  const max = Math.max(...data.stages.map((s) => s.count), 1);

  return (
    <Card className="mb-6 p-4">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <div className="shrink-0">
          <p className="text-xs font-medium text-slate-500">Total pipeline</p>
          <p className="text-2xl font-semibold tracking-tight text-slate-900 tabular">
            {settings?.valueField ? formatCurrency(data.totalValue, data.currency, { compact: true }) : data.totalLeads}
          </p>
          <p className="text-xs text-slate-500">{data.totalLeads} leads</p>
        </div>
        <ul className="grid min-w-0 flex-1 grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 xl:grid-cols-6">
          {data.stages.map((stage) => {
            const colors = OPTION_COLORS[stage.color] ?? OPTION_COLORS.slate;
            return (
              <li key={stage.value} className="min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5 truncate text-xs font-medium text-slate-600">
                    <span className={cn('size-2 shrink-0 rounded-full', colors.dot)} /> {stage.label}
                  </span>
                  <span className="text-sm font-semibold text-slate-900 tabular">{stage.count}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className={cn('h-full rounded-full', colors.bar)} style={{ width: `${(stage.count / max) * 100}%` }} />
                </div>
                {settings?.valueField && (
                  <p className="mt-1 text-[11px] text-slate-500 tabular">{formatCurrency(stage.total, data.currency, { compact: true })}</p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}

export default function LeadsPage() {
  useDocumentTitle('Leads');
  const { isAdmin } = useAuth();
  const { can } = usePermissions();
  const [filters, setFilters] = useQueryState(DEFAULTS);
  const [searchInput, setSearchInput] = useState(filters.search);
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [action, setAction] = useUrlParam('action');

  const config = useSalesConfig();
  const directory = useDirectory();
  const fields = useMemo(() => config.data?.fields ?? [], [config.data]);
  const settings = config.data?.settings;
  const groupField = fields.find((f) => f.key === settings?.kanbanGroupField);

  const [openLead, setOpenLead] = useState(null);
  const [form, setForm] = useState({ open: false, lead: null, defaults: undefined });
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const listQuery = useLeads({
    search: filters.search,
    owner: filters.owner,
    group: filters.group,
    state: filters.state,
    page: filters.page,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    limit: 15,
  });

  useEffect(() => {
    if (debouncedSearch !== filters.search) setFilters({ search: debouncedSearch });
  }, [debouncedSearch, filters.search, setFilters]);

  const openCreate = (groupValue) =>
    setForm({
      open: true,
      lead: null,
      defaults: groupValue && groupField ? { [groupField.key]: groupValue } : undefined,
    });

  const hasFilters = Boolean(filters.search || filters.owner || (filters.view === 'list' && (filters.group || filters.state)));

  /** Converted leads leave the board, so the list is where you tell the two apart. */
  const conversionColumn = {
    key: 'conversion',
    label: 'Conversion',
    render: (lead) =>
      lead.customer ? (
        <Badge tone="green">
          <CircleCheck size={13} aria-hidden /> Converted to Customer
        </Badge>
      ) : (
        <Badge tone="slate" dot>
          Active
        </Badge>
      ),
  };

  return (
    <>
      <PageHeader
        title="Leads"
        description="Track leads across the pipeline. Every lead is shared with the team."
        actions={
          <>
            {isAdmin && (
              <Button as={Link} to="/settings?tab=lead-form" variant="secondary" leftIcon={Settings2}>
                Configure
              </Button>
            )}
            {can('leads', 'create') && (
              <Button leftIcon={Plus} onClick={() => openCreate()}>
                Add lead
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
          <PipelineSummary settings={settings} />

          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Tabs
              value={filters.view}
              onChange={(view) => setFilters({ view })}
              options={[
                { value: 'kanban', label: 'Kanban', icon: KanbanSquare },
                { value: 'list', label: 'List', icon: List },
              ]}
            />
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto]">
              <Input
                leftIcon={Search}
                placeholder="Search leads…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                aria-label="Search leads"
                className="sm:w-64"
              />
              <Select aria-label="Filter by owner" value={filters.owner} onChange={(e) => setFilters({ owner: e.target.value })} placeholder="All owners" className="sm:w-44">
                {(directory.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName}
                  </option>
                ))}
              </Select>
              {filters.view === 'list' && (
                <Select
                  aria-label="Filter by conversion"
                  value={filters.state}
                  onChange={(e) => setFilters({ state: e.target.value })}
                  placeholder="Active & converted"
                  className="sm:w-44"
                >
                  <option value="active">Active only</option>
                  <option value="converted">Converted only</option>
                </Select>
              )}
              {filters.view === 'list' && groupField && (
                <Select
                  aria-label={`Filter by ${groupField.label}`}
                  value={filters.group}
                  onChange={(e) => setFilters({ group: e.target.value })}
                  placeholder={`Any ${groupField.label.toLowerCase()}`}
                  className="sm:w-44"
                >
                  {groupField.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              )}
              <Button
                variant="ghost"
                leftIcon={FilterX}
                disabled={!hasFilters}
                onClick={() => {
                  setSearchInput('');
                  setFilters({ search: '', owner: '', group: '', state: '' });
                }}
              >
                Clear
              </Button>
            </div>
          </div>

          {config.isPending ? (
            <Skeleton className="h-96 w-full rounded-2xl" />
          ) : filters.view === 'list' ? (
            <RecordListView
              query={listQuery}
              fields={fields}
              settings={settings}
              filters={filters}
              setFilters={setFilters}
              hasFilters={hasFilters}
              titleKey={SYSTEM_TITLE_KEY}
              emptyIcon={BriefcaseBusiness}
              emptyTitle="No leads yet"
              emptyDescription="Create the first lead to start building your pipeline."
              createLabel="Add lead"
              canCreate={can('leads', 'create')}
              extraColumns={[conversionColumn]}
              onOpen={setOpenLead}
              onCreate={openCreate}
            />
          ) : (
            <KanbanBoard fields={fields} settings={settings} filters={filters} onOpen={setOpenLead} onCreate={openCreate} />
          )}
        </>
      )}

      <LeadSheet
        lead={openLead}
        fields={fields}
        settings={settings}
        open={Boolean(openLead)}
        onOpenChange={(open) => !open && setOpenLead(null)}
        onEdit={(lead) => {
          setOpenLead(null);
          setForm({ open: true, lead, defaults: undefined });
        }}
      />
      <RecordFormModal
        entity="lead"
        open={form.open || action === 'new'}
        record={form.lead}
        defaults={form.defaults}
        createMutation={createLead}
        updateMutation={updateLead}
        labels={{
          createTitle: 'Add lead',
          editTitle: 'Edit lead',
          description: 'Leads are shared with the whole team.',
          submit: 'Create lead',
          created: 'Lead created',
          updated: 'Lead updated',
          ownerHint: 'The teammate responsible for this lead.',
        }}
        onOpenChange={(open) => {
          setForm((prev) => ({ ...prev, open }));
          if (!open) setAction(null);
        }}
      />
    </>
  );
}
