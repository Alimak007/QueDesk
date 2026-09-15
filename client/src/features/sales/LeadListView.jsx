import { BriefcaseBusiness, Plus } from 'lucide-react';
import { Button, Card, EmptyState, ErrorState, Pagination, SkeletonRows, Table, Td, Th, THead, Tr, UserCell } from '@/components/ui';
import { formatDate } from '@/lib/dates';
import { useLeads } from './api';
import { SYSTEM_TITLE_KEY } from './constants';
import { FieldValue } from './fields';

export function LeadListView({ fields, settings, filters, setFilters, onOpen, onCreate, hasFilters }) {
  const { data, isPending, isError, error, refetch, isFetching } = useLeads({
    search: filters.search,
    owner: filters.owner,
    group: filters.group,
    page: filters.page,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    limit: 15,
  });

  const columns = fields.filter((f) => f.showInList && f.isVisible);

  const sortProps = (sortBy) => ({
    sortable: true,
    sortDirection: filters.sortBy === sortBy ? filters.sortOrder : undefined,
    onSort: () =>
      setFilters({ sortBy, sortOrder: filters.sortBy === sortBy && filters.sortOrder === 'desc' ? 'asc' : 'desc' }),
  });

  return (
    <Card>
      {isPending ? (
        <SkeletonRows rows={8} />
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={BriefcaseBusiness}
          title={hasFilters ? 'No leads match your filters' : 'No leads yet'}
          description={hasFilters ? 'Try a different search or clear the filters.' : 'Create the first lead to start building your pipeline.'}
          action={
            !hasFilters && (
              <Button leftIcon={Plus} onClick={() => onCreate()}>
                Add lead
              </Button>
            )
          }
        />
      ) : (
        <div className={isFetching ? 'opacity-70 transition-opacity' : undefined}>
          <Table className="min-w-[860px]">
            <THead>
              <tr>
                {columns.map((field) => (
                  <Th
                    key={field.key}
                    align={field.type === 'currency' || field.type === 'number' ? 'right' : 'left'}
                    {...(field.type === 'textarea' ? {} : sortProps(`data.${field.key}`))}
                  >
                    {field.label}
                  </Th>
                ))}
                <Th>Owner</Th>
                <Th {...sortProps('createdAt')}>Created</Th>
              </tr>
            </THead>
            <tbody>
              {data.items.map((lead) => (
                <Tr key={lead.id} onClick={() => onOpen(lead)}>
                  {columns.map((field) => (
                    <Td
                      key={field.key}
                      align={field.type === 'currency' || field.type === 'number' ? 'right' : 'left'}
                      className={field.key === SYSTEM_TITLE_KEY ? 'font-medium text-slate-900' : 'max-w-56 truncate'}
                    >
                      <FieldValue field={field} value={lead.data?.[field.key]} currency={settings?.currency} />
                    </Td>
                  ))}
                  <Td>
                    <UserCell user={lead.owner} size="xs" subtitle={null} />
                  </Td>
                  <Td className="whitespace-nowrap text-slate-500">{formatDate(lead.createdAt, 'd MMM yyyy')}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <Pagination pagination={data.pagination} onPageChange={(page) => setFilters({ page })} />
        </div>
      )}
    </Card>
  );
}
