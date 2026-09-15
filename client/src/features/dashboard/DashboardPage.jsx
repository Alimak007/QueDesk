import { Card, ErrorState, Skeleton } from '@/components/ui';
import { useAuth } from '@/features/auth/useAuth';
import { useDocumentTitle } from '@/hooks';
import { formatDate, greeting } from '@/lib/dates';
import { useDashboard } from './api';
import { AdminDashboard } from './AdminDashboard';
import { EmployeeDashboard } from './EmployeeDashboard';

function DashboardSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading dashboard">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} className="space-y-3 p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-16" />
          </Card>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="h-72 p-5 xl:col-span-2">
          <Skeleton className="h-4 w-48" />
        </Card>
        <Card className="h-72 p-5">
          <Skeleton className="h-4 w-32" />
        </Card>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  useDocumentTitle('Dashboard');
  const { user, isAdmin } = useAuth();
  const { data, isPending, isError, error, refetch } = useDashboard();

  return (
    <>
      <div className="mb-6">
        <p className="text-sm font-medium text-brand-600">{formatDate(new Date().toISOString(), 'EEEE, d MMMM')}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px]">
          {greeting()}, {user.firstName} 👋
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {isAdmin ? 'Here’s what needs your attention across the organisation.' : 'Here’s a snapshot of your day.'}
        </p>
      </div>

      {isPending ? (
        <DashboardSkeleton />
      ) : isError ? (
        <Card>
          <ErrorState error={error} onRetry={refetch} />
        </Card>
      ) : isAdmin ? (
        <AdminDashboard data={data} />
      ) : (
        <EmployeeDashboard data={data} />
      )}
    </>
  );
}
