import { Building2 } from 'lucide-react';
import { Link } from 'react-router';
import { Button, Card, EmptyState } from '@/components/ui';
import { useAuth } from '@/features/auth/useAuth';

/**
 * Payslips and invoices are issued by a company, so the first step on a fresh
 * install is adding one in Settings.
 */
export function NoCompanyNotice({ document = 'document' }) {
  const { isAdmin } = useAuth();

  return (
    <Card>
      <EmptyState
        icon={Building2}
        title="Add a company first"
        description={
          isAdmin
            ? `Every ${document} is issued by a company: its name, address, tax number, bank details, logo and signature come from that profile.`
            : `No company profile has been set up yet. Ask an administrator to add one before creating a ${document}.`
        }
        action={
          isAdmin && (
            <Button as={Link} to="/settings/companies/new">
              Add company
            </Button>
          )
        }
      />
    </Card>
  );
}
