import { ClipboardList, FilterX, PenLine, Plus, Search, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Card, EmptyState, ErrorState, Input, PageHeader, Pagination, Skeleton } from '@/components/ui';
import { usePermissions } from '@/features/auth/usePermissions';
import { useDebouncedValue, useDocumentTitle, useQueryState, useUrlParam } from '@/hooks';
import { formatDate, todayDateOnly } from '@/lib/dates';
import { useStatusReports } from './api';
import { ReportBody, ReportCard } from './ReportCard';
import { StatusFormModal } from './StatusFormModal';

export default function MyStatusPage({ embedded = false }) {
  useDocumentTitle(embedded ? undefined : 'My Daily Status');
  const { can } = usePermissions();
  const canSubmit = can('dailyStatus', 'create');
  const today = todayDateOnly();
  const [filters, setFilters] = useQueryState({ from: '', to: '', search: '', page: 1 });
  const [searchInput, setSearchInput] = useState(filters.search);
  const debouncedSearch = useDebouncedValue(searchInput, 350);
  const [action, setAction] = useUrlParam('action');
  const [modal, setModal] = useState({ open: false, report: null });

  useEffect(() => {
    if (debouncedSearch !== filters.search) setFilters({ search: debouncedSearch });
  }, [debouncedSearch, filters.search, setFilters]);

  // `scope: mine` keeps this view personal even for reviewers, who otherwise see everyone.
  const todayQuery = useStatusReports({ from: today, to: today, limit: 1, scope: 'mine' });
  const todayReport = todayQuery.data?.items?.[0];
  const { data, isPending, isError, error, refetch } = useStatusReports({ ...filters, scope: 'mine', limit: 10 });

  // `?action=new` (dashboard quick action) opens today's report, for editing if it already exists.
  const fromQuickAction = !modal.open && action === 'new' && !todayQuery.isPending;
  const modalOpen = modal.open || fromQuickAction;
  const modalReport = fromQuickAction ? (todayReport ?? null) : modal.report;

  const hasFilters = Boolean(filters.from || filters.to || filters.search);

  return (
    <>
      {embedded ? (
        canSubmit && (
          <div className="mb-4 flex justify-end">
            <Button leftIcon={Plus} onClick={() => setModal({ open: true, report: null })}>
              Add status
            </Button>
          </div>
        )
      ) : (
        <PageHeader
          title="My Daily Status"
          description="Submit your daily work updates and review your history."
          actions={
            canSubmit && (
              <Button leftIcon={Plus} onClick={() => setModal({ open: true, report: null })}>
                Add status
              </Button>
            )
          }
        />
      )}

      {/* Today */}
      <Card className="mb-6 overflow-hidden">
        {todayQuery.isPending ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ) : todayReport ? (
          <div className="grid lg:grid-cols-[260px_1fr]">
            <div className="border-b border-slate-100 bg-gradient-to-br from-emerald-50 to-white p-6 lg:border-b-0 lg:border-r">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                <span className="size-1.5 rounded-full bg-emerald-500" /> Submitted
              </span>
              <p className="mt-3 text-lg font-semibold text-slate-900">Today’s report</p>
              <p className="text-sm text-slate-500">{formatDate(today, 'EEEE, d MMMM')}</p>
              <Button variant="secondary" size="sm" className="mt-4" leftIcon={PenLine} onClick={() => setModal({ open: true, report: todayReport })}>
                Edit today’s report
              </Button>
            </div>
            <div className="p-6">
              <ReportBody report={todayReport} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-4 bg-gradient-to-r from-brand-50 via-white to-white p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/25">
                <Sparkles size={22} />
              </span>
              <div>
                <p className="text-base font-semibold text-slate-900">You haven’t submitted today’s status yet</p>
                <p className="text-sm text-slate-500">It only takes a minute — share what you worked on today.</p>
              </div>
            </div>
            <Button leftIcon={Plus} onClick={() => setModal({ open: true, report: null })}>
              Add today’s status
            </Button>
          </div>
        )}
      </Card>

      {/* History */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-base font-semibold text-slate-900">History</h2>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
          <Input
            leftIcon={Search}
            placeholder="Search reports…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search reports"
            className="sm:w-64"
          />
          <Input type="date" aria-label="From date" value={filters.from} max={today} onChange={(e) => setFilters({ from: e.target.value })} />
          <Input type="date" aria-label="To date" value={filters.to} max={today} min={filters.from || undefined} onChange={(e) => setFilters({ to: e.target.value })} />
          <Button
            variant="ghost"
            leftIcon={FilterX}
            disabled={!hasFilters}
            onClick={() => {
              setSearchInput('');
              setFilters({ from: '', to: '', search: '' });
            }}
          >
            Clear
          </Button>
        </div>
      </div>

      {isPending ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="space-y-3 p-5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </Card>
          ))}
        </div>
      ) : isError ? (
        <Card>
          <ErrorState error={error} onRetry={refetch} />
        </Card>
      ) : data.items.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title={hasFilters ? 'No reports match your filters' : 'No reports yet'}
            description={hasFilters ? 'Try a different date range or search term.' : 'Your submitted daily status reports will appear here.'}
          />
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {data.items.map((report) => (
              <ReportCard key={report.id} report={report} onEdit={(r) => setModal({ open: true, report: r })} />
            ))}
          </div>
          <Card className="mt-4">
            <Pagination pagination={data.pagination} onPageChange={(page) => setFilters({ page })} className="border-t-0" />
          </Card>
        </>
      )}

      <StatusFormModal
        open={modalOpen}
        report={modalReport}
        // Today's report already exists, so a new one must be for an earlier (missed) day.
        defaultDate={todayReport && !fromQuickAction ? '' : undefined}
        onOpenChange={(open) => {
          setModal((prev) => ({ ...prev, open }));
          if (!open) setAction(null);
        }}
      />
    </>
  );
}
