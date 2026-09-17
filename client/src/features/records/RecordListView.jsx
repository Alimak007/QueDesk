import { Plus } from 'lucide-react';
import { Button, Card, EmptyState, ErrorState, Pagination, SkeletonRows, Table, Td, Th, THead, Tr, UserCell } from '@/components/ui';
import { formatDate } from '@/lib/dates';
import { FieldValue } from '@/features/sales/fields';

/** Table of records (leads or customers) using the admin-configured columns. */
export function RecordListView({
  query,
  fields,
  settings,
  filters,
  setFilters,
  onOpen,
  onCreate,
  hasFilters,
  titleKey,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  createLabel,
  canCreate = true,
  extraColumns = [],
}) {
  const { data, isPending, isError, error, refetch, isFetching } = query;
  const columns = fields.filter((f) => f.showInList && f.isVisible);

  const sortProps = (sortBy) => ({
    sortable: true,
    sortDirection: filters.sortBy === sortBy ? filters.sortOrder : undefined,
    onSort: () => setFilters({ sortBy, sortOrder: filters.sortBy === sortBy && filters.sortOrder === 'desc' ? 'asc' : 'desc' }),
  });

  return (
    <Card>
      {isPending ? (
        <SkeletonRows rows={8} />
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={emptyIcon}
          title={hasFilters ? 'Nothing matches your filters' : emptyTitle}
          description={hasFilters ? 'Try a different search or clear the filters.' : emptyDescription}
          action={
            !hasFilters &&
            canCreate && (
              <Button leftIcon={Plus} onClick={() => onCreate()}>
                {createLabel}
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
                {extraColumns.map((col) => (
                  <Th key={col.key}>{col.label}</Th>
                ))}
                <Th>Owner</Th>
                <Th {...sortProps('createdAt')}>Created</Th>
              </tr>
            </THead>
            <tbody>
              {data.items.map((record) => (
                <Tr key={record.id} onClick={() => onOpen(record)}>
                  {columns.map((field) => (
                    <Td
                      key={field.key}
                      align={field.type === 'currency' || field.type === 'number' ? 'right' : 'left'}
                      className={field.key === titleKey ? 'font-medium text-slate-900' : 'max-w-56 truncate'}
                    >
                      <FieldValue field={field} value={record.data?.[field.key]} currency={settings?.currency} />
                    </Td>
                  ))}
                  {extraColumns.map((col) => (
                    <Td key={col.key}>{col.render(record)}</Td>
                  ))}
                  <Td>
                    <UserCell user={record.owner} size="xs" subtitle={null} />
                  </Td>
                  <Td className="whitespace-nowrap text-slate-500">{formatDate(record.createdAt, 'd MMM yyyy')}</Td>
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
