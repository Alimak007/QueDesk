import { ClipboardList, User } from 'lucide-react';
import { PageHeader, Tabs } from '@/components/ui';
import { usePermissions } from '@/features/auth/usePermissions';
import { useDocumentTitle, useUrlParam } from '@/hooks';
import MyStatusPage from './MyStatusPage';
import StatusAdminPage from './StatusAdminPage';

/**
 * One Daily Status entry point: employees submit and browse their own reports,
 * reviewers additionally get the team board and the full report history.
 */
export default function DailyStatusPage() {
  const { can } = usePermissions();
  const reviews = can('dailyStatus', 'review');
  const canSeeOwn = can('dailyStatus', 'view');
  const [tab, setTab] = useUrlParam('tab');

  useDocumentTitle('Daily Status');

  if (!reviews) return <MyStatusPage />;
  if (!canSeeOwn) return <StatusAdminPage />;

  const active = tab === 'mine' ? 'mine' : 'team';

  return (
    <>
      <PageHeader
        title="Daily Status"
        description="See what the team worked on, and keep your own updates up to date."
        actions={
          <Tabs
            value={active}
            onChange={(value) => setTab(value === 'team' ? null : value)}
            options={[
              { value: 'team', label: 'Team', icon: ClipboardList },
              { value: 'mine', label: 'My status', icon: User },
            ]}
          />
        }
      />
      {active === 'mine' ? <MyStatusPage embedded /> : <StatusAdminPage embedded />}
    </>
  );
}
