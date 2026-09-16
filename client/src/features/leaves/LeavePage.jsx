import { Plane, User } from 'lucide-react';
import { PageHeader, Tabs } from '@/components/ui';
import { usePermissions } from '@/features/auth/usePermissions';
import { useDocumentTitle, useUrlParam } from '@/hooks';
import LeaveManagementPage from './LeaveManagementPage';
import MyLeavePage from './MyLeavePage';

/**
 * One Leave entry point for everybody: employees see their own requests,
 * approvers get the organisation-wide queue plus a tab for their own leave.
 */
export default function LeavePage() {
  const { can } = usePermissions();
  const approves = can('leave', 'approve');
  const canSeeOwn = can('leave', 'view');
  const [tab, setTab] = useUrlParam('tab');

  useDocumentTitle('Leave');

  if (!approves) return <MyLeavePage />;
  if (!canSeeOwn) return <LeaveManagementPage />;

  const active = tab === 'mine' ? 'mine' : 'team';

  return (
    <>
      <PageHeader
        title="Leave"
        description="Review team requests and manage your own leave."
        actions={
          <Tabs
            value={active}
            onChange={(value) => setTab(value === 'team' ? null : value)}
            options={[
              { value: 'team', label: 'Team requests', icon: Plane },
              { value: 'mine', label: 'My leave', icon: User },
            ]}
          />
        }
      />
      {active === 'mine' ? <MyLeavePage embedded /> : <LeaveManagementPage embedded />}
    </>
  );
}
