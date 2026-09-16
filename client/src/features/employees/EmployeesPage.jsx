import { Ellipsis, Eye, FilterX, KeyRound, Pencil, Plus, Search, ShieldCheck, Trash2, UserCheck, UserRoundX, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Menu,
  MenuItem,
  MenuSeparator,
  PageHeader,
  Pagination,
  Select,
  SkeletonRows,
  Table,
  Td,
  Th,
  THead,
  Tr,
  UserCell,
} from '@/components/ui';
import { usePermissions } from '@/features/auth/usePermissions';
import { useDebouncedValue, useDocumentTitle, useQueryState } from '@/hooks';
import { formatDate } from '@/lib/dates';
import { useDepartments, useEmployees } from './api';
import { EmployeeFormModal } from './EmployeeFormModal';
import { useEmployeeActions } from './useEmployeeActions';

const DEFAULTS = { search: '', department: '', role: '', status: '', page: 1, sortBy: 'firstName', sortOrder: 'asc' };

export function EmployeeStatusBadge({ status }) {
  return status === 'active' ? (
    <Badge tone="green" dot>
      Active
    </Badge>
  ) : (
    <Badge tone="slate" dot>
      Inactive
    </Badge>
  );
}

export function RoleBadge({ role }) {
  return role === 'admin' ? (
    <Badge tone="brand">
      <ShieldCheck size={12} /> Admin
    </Badge>
  ) : (
    <span className="text-sm text-slate-600">Employee</span>
  );
}

export default function EmployeesPage() {
  useDocumentTitle('Employees');
  const { can } = usePermissions();
  const navigate = useNavigate();
  const [filters, setFilters] = useQueryState(DEFAULTS);
  const [searchInput, setSearchInput] = useState(filters.search);
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [creating, setCreating] = useState(false);
  const actions = useEmployeeActions();

  useEffect(() => {
    if (debouncedSearch !== filters.search) setFilters({ search: debouncedSearch });
  }, [debouncedSearch, filters.search, setFilters]);

  const { data, isPending, isError, error, refetch, isFetching } = useEmployees({ ...filters, limit: 15 });
  const departments = useDepartments();

  const sortProps = (field) => ({
    sortable: true,
    sortDirection: filters.sortBy === field ? filters.sortOrder : undefined,
    onSort: () =>
      setFilters({
        sortBy: field,
        sortOrder: filters.sortBy === field && filters.sortOrder === 'asc' ? 'desc' : 'asc',
      }),
  });

  const hasFilters = Boolean(filters.search || filters.department || filters.role || filters.status);

  return (
    <>
      <PageHeader
        title="Employees"
        description="Add team members, manage their details and control portal access."
        actions={
          can('employees', 'create') && (
            <Button leftIcon={Plus} onClick={() => setCreating(true)}>
              Add employee
            </Button>
          )
        }
      />

      <Card>
        <div className="grid gap-2.5 border-b border-slate-100 px-5 py-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_auto]">
          <Input
            leftIcon={Search}
            placeholder="Search by name, email, ID or designation…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search employees"
          />
          <Select aria-label="Department" value={filters.department} onChange={(e) => setFilters({ department: e.target.value })} placeholder="All departments">
            {(departments.data ?? []).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
          <Select aria-label="Role" value={filters.role} onChange={(e) => setFilters({ role: e.target.value })} placeholder="All roles">
            <option value="employee">Employee</option>
            <option value="admin">Admin</option>
          </Select>
          <Select aria-label="Status" value={filters.status} onChange={(e) => setFilters({ status: e.target.value })} placeholder="Any status">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
          <Button
            variant="ghost"
            leftIcon={FilterX}
            disabled={!hasFilters}
            onClick={() => {
              setSearchInput('');
              setFilters({ search: '', department: '', role: '', status: '' });
            }}
          >
            Clear
          </Button>
        </div>

        {isPending ? (
          <SkeletonRows rows={8} />
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : data.items.length === 0 ? (
          <EmptyState
            icon={Users}
            title={hasFilters ? 'No employees match your filters' : 'No employees yet'}
            description={hasFilters ? 'Try a different search or clear the filters.' : 'Add your first team member to get started.'}
            action={
              !hasFilters &&
              can('employees', 'create') && (
                <Button leftIcon={Plus} onClick={() => setCreating(true)}>
                  Add employee
                </Button>
              )
            }
          />
        ) : (
          <div className={isFetching ? 'opacity-70 transition-opacity' : undefined}>
            <Table>
              <THead>
                <tr>
                  <Th {...sortProps('firstName')}>Employee</Th>
                  <Th {...sortProps('employeeId')}>ID</Th>
                  <Th {...sortProps('department')}>Department</Th>
                  <Th>Role</Th>
                  <Th>Status</Th>
                  <Th {...sortProps('joiningDate')}>Joined</Th>
                  <Th align="right">
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </THead>
              <tbody>
                {data.items.map((employee) => (
                  <Tr key={employee.id} onClick={() => navigate(`/employees/${employee.id}`)} className={employee.status === 'inactive' ? 'opacity-70' : undefined}>
                    <Td>
                      <UserCell user={employee} subtitle={employee.email} />
                    </Td>
                    <Td className="font-mono text-xs text-slate-600">{employee.employeeId}</Td>
                    <Td>
                      <p className="text-sm text-slate-800">{employee.department || '—'}</p>
                      {employee.designation && <p className="text-xs text-slate-500">{employee.designation}</p>}
                    </Td>
                    <Td>
                      <RoleBadge role={employee.role} />
                    </Td>
                    <Td>
                      <EmployeeStatusBadge status={employee.status} />
                    </Td>
                    <Td className="whitespace-nowrap text-slate-600">{employee.joiningDate ? formatDate(employee.joiningDate) : '—'}</Td>
                    <Td align="right">
                      <div onClick={(e) => e.stopPropagation()}>
                        <Menu
                          trigger={
                            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${employee.fullName}`}>
                              <Ellipsis size={17} />
                            </Button>
                          }
                        >
                          <MenuItem icon={Eye} onSelect={() => navigate(`/employees/${employee.id}`)}>
                            View details
                          </MenuItem>
                          {can('employees', 'edit') && (
                            <>
                              <MenuItem icon={Pencil} onSelect={() => actions.edit(employee)}>
                                Edit
                              </MenuItem>
                              <MenuItem icon={KeyRound} onSelect={() => actions.resetPassword(employee)}>
                                Reset password
                              </MenuItem>
                              <MenuSeparator />
                              <MenuItem
                                icon={employee.status === 'active' ? UserRoundX : UserCheck}
                                disabled={actions.isSelf(employee)}
                                onSelect={() => actions.toggleStatus(employee)}
                              >
                                {employee.status === 'active' ? 'Deactivate' : 'Reactivate'}
                              </MenuItem>
                            </>
                          )}
                          {can('employees', 'delete') && (
                            <MenuItem icon={Trash2} tone="danger" disabled={actions.isSelf(employee)} onSelect={() => actions.remove(employee)}>
                              Delete
                            </MenuItem>
                          )}
                        </Menu>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination pagination={data.pagination} onPageChange={(page) => setFilters({ page })} />
          </div>
        )}
      </Card>

      <EmployeeFormModal open={creating} onOpenChange={setCreating} />
      {actions.dialogs}
    </>
  );
}
