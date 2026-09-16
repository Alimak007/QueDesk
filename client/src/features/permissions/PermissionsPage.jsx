import { Check, RotateCcw, Search, ShieldCheck, Undo2, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  EmptyState,
  ErrorState,
  Hint,
  Input,
  PageHeader,
  Skeleton,
} from '@/components/ui';
import { useEmployees } from '@/features/employees/api';
import { useDebouncedValue, useDocumentTitle, useResetOnChange, useUrlParam } from '@/hooks';
import { cn, fullName } from '@/lib/utils';
import { usePermissionCatalog, useResetPermissions, useSavePermissions, useUserPermissions } from './api';

const equal = (a = {}, b = {}) =>
  Object.keys({ ...a, ...b }).every((key) => [...(a[key] ?? [])].sort().join() === [...(b[key] ?? [])].sort().join());

function EmployeeList({ selectedId, onSelect }) {
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search, 300);
  const { data, isPending } = useEmployees({ search: debounced, limit: 50, sortBy: 'firstName', sortOrder: 'asc' });

  return (
    <Card className="flex h-fit flex-col xl:sticky xl:top-24">
      <div className="p-3">
        <Input leftIcon={Search} placeholder="Search employees…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search employees" />
      </div>
      <div className="scrollbar-thin max-h-[32rem] overflow-y-auto px-2 pb-2">
        {isPending ? (
          <div className="space-y-2 p-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <EmptyState compact icon={Users} title="No employees found" />
        ) : (
          <ul className="space-y-1">
            {data.items.map((employee) => {
              const isAdmin = employee.role === 'admin';
              return (
                <li key={employee.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(employee.id)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors',
                      employee.id === selectedId ? 'bg-brand-50 ring-1 ring-brand-200' : 'hover:bg-slate-50',
                    )}
                  >
                    <Avatar user={employee} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">{fullName(employee)}</span>
                      <span className="block truncate text-xs text-slate-500">{employee.designation || employee.email}</span>
                    </span>
                    {isAdmin && <Badge tone="brand">Admin</Badge>}
                    {employee.status === 'inactive' && <Badge tone="slate">Inactive</Badge>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}

export default function PermissionsPage() {
  useDocumentTitle('Permissions');
  const [selectedId, setSelectedId] = useUrlParam('employee');
  const catalog = usePermissionCatalog();
  const details = useUserPermissions(selectedId);
  const savePermissions = useSavePermissions();
  const resetPermissions = useResetPermissions();

  const [draft, setDraft] = useState(null);

  // Load the saved permissions into the editable draft whenever a different
  // employee (or a newer server response) arrives.
  if (useResetOnChange(details.data ? `${selectedId}:${details.dataUpdatedAt}` : null)) {
    setDraft(details.data.permissions);
  }

  const employee = details.data?.user;
  const isAdminUser = employee?.role === 'admin';
  const dirty = useMemo(() => draft && details.data && !equal(draft, details.data.permissions), [draft, details.data]);

  const toggle = (module, action) => {
    setDraft((prev) => {
      const current = new Set(prev[module] ?? []);
      if (current.has(action)) current.delete(action);
      else current.add(action);
      return { ...prev, [module]: [...current] };
    });
  };

  const toggleModule = (module, actions, grant) => {
    setDraft((prev) => ({ ...prev, [module]: grant ? actions.map((a) => a.action) : [] }));
  };

  const save = async () => {
    try {
      await savePermissions.mutateAsync({ id: selectedId, permissions: draft });
      toast.success('Permissions updated', { description: `${fullName(employee)} will see the change immediately.` });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const reset = async () => {
    try {
      const result = await resetPermissions.mutateAsync({ id: selectedId });
      setDraft(result.permissions);
      toast.success('Reset to the default employee permissions');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const groups = useMemo(() => {
    const modules = catalog.data?.modules ?? [];
    return modules.reduce((acc, module) => {
      (acc[module.group] ??= []).push(module);
      return acc;
    }, {});
  }, [catalog.data]);

  return (
    <>
      <PageHeader
        title="Permissions"
        description="Choose exactly what each employee can see and do. Every rule is enforced by the API as well."
        actions={
          selectedId &&
          !isAdminUser && (
            <>
              <Button variant="ghost" leftIcon={Undo2} disabled={!dirty} onClick={() => setDraft(details.data.permissions)}>
                Discard
              </Button>
              <Button variant="secondary" leftIcon={RotateCcw} loading={resetPermissions.isPending} onClick={reset}>
                Reset to defaults
              </Button>
              <Button leftIcon={Check} disabled={!dirty} loading={savePermissions.isPending} onClick={save}>
                Save changes
              </Button>
            </>
          )
        }
      />

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <EmployeeList selectedId={selectedId} onSelect={setSelectedId} />

        {!selectedId ? (
          <Card>
            <EmptyState
              icon={ShieldCheck}
              title="Select an employee"
              description="Pick someone on the left to review and change what they can access."
            />
          </Card>
        ) : details.isPending || catalog.isPending ? (
          <Skeleton className="h-96 w-full rounded-2xl" />
        ) : details.isError ? (
          <Card>
            <ErrorState error={details.error} onRetry={details.refetch} />
          </Card>
        ) : (
          <div className="space-y-6">
            <Card className="p-5">
              <div className="flex flex-wrap items-center gap-3">
                <Avatar user={employee} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold text-slate-900">{fullName(employee)}</p>
                  <p className="text-sm text-slate-500">
                    {employee.designation || 'Employee'} · {employee.email}
                  </p>
                </div>
                {isAdminUser ? (
                  <Badge tone="brand">
                    <ShieldCheck size={12} /> Administrator
                  </Badge>
                ) : (
                  <Badge tone={details.data.isCustomised ? 'violet' : 'slate'}>
                    {details.data.isCustomised ? 'Custom permissions' : 'Default permissions'}
                  </Badge>
                )}
              </div>
              {isAdminUser && (
                <p className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900 ring-1 ring-brand-100">
                  Administrators always have full access. To limit this person, change their role to Employee in Employee Management first.
                </p>
              )}
            </Card>

            {!isAdminUser &&
              Object.entries(groups).map(([group, modules]) => (
                <Card key={group}>
                  <CardHeader title={group} />
                  <div className="divide-y divide-slate-100">
                    {modules.map((module) => {
                      const granted = draft?.[module.key] ?? [];
                      const all = granted.length === module.actions.length;
                      return (
                        <div key={module.key} className="px-5 py-4">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-slate-900">{module.label}</p>
                            <Button variant="link" size="xs" onClick={() => toggleModule(module.key, module.actions, !all)}>
                              {all ? 'Clear all' : 'Grant all'}
                            </Button>
                          </div>
                          <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2 xl:grid-cols-3">
                            {module.actions.map(({ action, description }) => (
                              <Hint key={action} content={description}>
                                <span>
                                  <Checkbox
                                    label={action[0].toUpperCase() + action.slice(1)}
                                    description={description}
                                    checked={granted.includes(action)}
                                    onChange={() => toggle(module.key, action)}
                                  />
                                </span>
                              </Hint>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ))}
          </div>
        )}
      </div>
    </>
  );
}
