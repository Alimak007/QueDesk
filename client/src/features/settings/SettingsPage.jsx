import { Building2, ClipboardList, Ellipsis, History, Pencil, Plus, Star, Trash2, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Menu,
  MenuItem,
  MenuSeparator,
  PageHeader,
  Pagination,
  Select,
  SkeletonRows,
  Table,
  Tabs,
  Td,
  Th,
  THead,
  Tr,
  UserCell,
} from '@/components/ui';
import { useDocumentTitle, useQueryState } from '@/hooks';
import { timeAgo } from '@/lib/dates';
import { companyAssetUrl, useAuditLogs, useCompanies, useDeleteCompany } from './api';
import { FieldConfigurator } from './FieldConfigurator';

const TABS = [
  { value: 'companies', label: 'Companies', icon: Building2 },
  { value: 'lead-form', label: 'Lead form', icon: ClipboardList },
  { value: 'customer-form', label: 'Customer form', icon: UsersRound },
  { value: 'audit', label: 'Activity log', icon: History },
];

function CompaniesTab() {
  const navigate = useNavigate();
  const { data, isPending, isError, error, refetch } = useCompanies({ includeInactive: true });
  const removeCompany = useDeleteCompany();
  const [deleteTarget, setDeleteTarget] = useState(null);

  const confirmDelete = async () => {
    try {
      await removeCompany.mutateAsync(deleteTarget.id);
      toast.success('Company deleted');
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err.message);
      setDeleteTarget(null);
    }
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Companies</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Used on invoices and payslips: branding, tax details, bank information and document defaults.
          </p>
        </div>
        <Button as={Link} to="/settings/companies/new" leftIcon={Plus}>
          Add company
        </Button>
      </div>

      <Card>
        {isPending ? (
          <SkeletonRows rows={3} />
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : data.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No companies yet"
            description="Add the legal entity that issues your invoices and payslips."
            action={
              <Button as={Link} to="/settings/companies/new" leftIcon={Plus}>
                Add company
              </Button>
            }
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>Company</Th>
                <Th>Tax number</Th>
                <Th>Currency</Th>
                <Th>Branding</Th>
                <Th align="right">
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </THead>
            <tbody>
              {data.map((company) => (
                <Tr key={company.id} onClick={() => navigate(`/settings/companies/${company.id}`)}>
                  <Td>
                    <div className="flex items-center gap-3">
                      {company.logo ? (
                        <img src={companyAssetUrl(company, 'logo')} alt="" className="h-8 w-16 rounded object-contain ring-1 ring-slate-200" />
                      ) : (
                        <span className="flex h-8 w-16 items-center justify-center rounded bg-slate-100 text-[10px] text-slate-400">No logo</span>
                      )}
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 truncate text-sm font-medium text-slate-900">
                          {company.name}
                          {company.isDefault && (
                            <Badge tone="brand">
                              <Star size={10} /> Default
                            </Badge>
                          )}
                          {!company.isActive && <Badge tone="slate">Inactive</Badge>}
                        </p>
                        <p className="truncate text-xs text-slate-500">{company.address?.split('\n')[0] || '—'}</p>
                      </div>
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap text-slate-600">
                    {company.taxNumber ? `${company.taxLabel}: ${company.taxNumber}` : '—'}
                  </Td>
                  <Td>{company.currency}</Td>
                  <Td>
                    <div className="flex gap-1.5">
                      <Badge tone={company.logo ? 'green' : 'slate'}>{company.logo ? 'Logo' : 'No logo'}</Badge>
                      <Badge tone={company.signature ? 'green' : 'slate'}>{company.signature ? 'Signature' : 'No signature'}</Badge>
                    </div>
                  </Td>
                  <Td align="right">
                    <div onClick={(e) => e.stopPropagation()}>
                      <Menu
                        trigger={
                          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${company.name}`}>
                            <Ellipsis size={17} />
                          </Button>
                        }
                      >
                        <MenuItem icon={Pencil} onSelect={() => navigate(`/settings/companies/${company.id}`)}>
                          Edit company
                        </MenuItem>
                        <MenuSeparator />
                        <MenuItem icon={Trash2} tone="danger" onSelect={() => setDeleteTarget(company)}>
                          Delete
                        </MenuItem>
                      </Menu>
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this company?"
        description={`“${deleteTarget?.name}” will be removed. Companies used by invoices or payslips cannot be deleted — deactivate them instead.`}
        confirmLabel="Delete company"
        loading={removeCompany.isPending}
        onConfirm={confirmDelete}
      />
    </>
  );
}

const ENTITY_LABEL = {
  customer: 'Customer',
  payslip: 'Payslip',
  invoice: 'Invoice',
  permission: 'Permission',
  company: 'Company',
};

function AuditTab() {
  const [filters, setFilters] = useQueryState({ entityType: '', page: 1 });
  const { data, isPending, isError, error, refetch } = useAuditLogs({ ...filters, limit: 20 });

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Activity log</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Who created, changed, downloaded or deleted documents and permissions. Entries older than one month are removed
            automatically.
          </p>
        </div>
        <Select
          aria-label="Filter by type"
          className="w-52"
          value={filters.entityType}
          onChange={(e) => setFilters({ entityType: e.target.value })}
          placeholder="All activity"
        >
          {Object.entries(ENTITY_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      <Card>
        {isPending ? (
          <SkeletonRows rows={6} />
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : data.items.length === 0 ? (
          <EmptyState icon={History} title="Nothing logged yet" description="Document and permission changes will appear here." />
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  <Th>Who</Th>
                  <Th>Action</Th>
                  <Th>Details</Th>
                  <Th>When</Th>
                </tr>
              </THead>
              <tbody>
                {data.items.map((entry) => (
                  <Tr key={entry.id}>
                    <Td>{entry.actor ? <UserCell user={entry.actor} subtitle={null} size="xs" /> : <span className="text-slate-400">System</span>}</Td>
                    <Td>
                      <Badge tone="slate">{entry.action}</Badge>
                    </Td>
                    <Td className="max-w-md truncate text-slate-700">{entry.summary}</Td>
                    <Td className="whitespace-nowrap text-slate-500">{timeAgo(entry.createdAt)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination pagination={data.pagination} onPageChange={(page) => setFilters({ page })} />
          </>
        )}
      </Card>
    </>
  );
}

export default function SettingsPage() {
  useDocumentTitle('Settings');
  const [state, setState] = useQueryState({ tab: 'companies' });
  const tab = TABS.some((t) => t.value === state.tab) ? state.tab : 'companies';

  return (
    <>
      <PageHeader
        title="Settings"
        description="Company profiles, document branding and the configurable Lead and Customer forms."
      />

      <div className="mb-6">
        <Tabs value={tab} onChange={(value) => setState({ tab: value })} options={TABS} />
      </div>

      {tab === 'companies' && <CompaniesTab />}
      {tab === 'lead-form' && <FieldConfigurator entity="lead" />}
      {tab === 'customer-form' && <FieldConfigurator entity="customer" />}
      {tab === 'audit' && <AuditTab />}
    </>
  );
}
