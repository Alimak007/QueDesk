import { ArrowRight, CircleCheck, UserRoundPlus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Badge, Button, ConfirmDialog } from '@/components/ui';
import { usePermissions } from '@/features/auth/usePermissions';
import { useConvertLead } from '@/features/customers/api';
import { RecordSheet } from '@/features/records/RecordSheet';
import { formatDate } from '@/lib/dates';
import { useDeleteLead } from './api';
import { SYSTEM_STATUS_KEY, SYSTEM_TITLE_KEY } from './constants';

export function LeadSheet({ lead, fields, settings, open, onOpenChange, onEdit }) {
  const { can } = usePermissions();
  const deleteLead = useDeleteLead();
  const convertLead = useConvertLead();
  const [confirmConvert, setConfirmConvert] = useState(false);

  if (!lead) return null;

  const converted = Boolean(lead.customer);
  const canConvert = can('customers', 'create') && !converted;

  const convert = async () => {
    try {
      const result = await convertLead.mutateAsync(lead.id);
      setConfirmConvert(false);
      toast.success(result.created ? 'Lead converted to a customer' : 'This lead is already a customer', {
        description: result.created ? 'You can find it in the Customers module.' : undefined,
      });
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <RecordSheet
        record={lead}
        fields={fields}
        settings={settings}
        open={open}
        onOpenChange={onOpenChange}
        onEdit={onEdit}
        titleKey={SYSTEM_TITLE_KEY}
        statusKey={SYSTEM_STATUS_KEY}
        canEdit={can('leads', 'edit') && !converted}
        canDelete={can('leads', 'delete')}
        deleteMutation={deleteLead}
        deleteLabel="Delete lead"
        headerActions={
          canConvert && (
            <Button variant="secondary" leftIcon={UserRoundPlus} onClick={() => setConfirmConvert(true)}>
              Convert to customer
            </Button>
          )
        }
      >
        {converted && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-100">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-900">
                <CircleCheck size={15} /> Converted to a customer
              </p>
              <p className="mt-0.5 text-xs text-emerald-800/80">
                {lead.convertedAt ? `On ${formatDate(lead.convertedAt, 'd MMM yyyy')}. ` : ''}
                This lead is now read-only and no longer appears on the board — edit the customer instead.
              </p>
            </div>
            {can('customers', 'view') && (
              <Button as={Link} to={`/customers?customer=${lead.customer.id ?? lead.customer}`} variant="ghost" size="sm" rightIcon={ArrowRight}>
                Open
              </Button>
            )}
          </div>
        )}
      </RecordSheet>

      <ConfirmDialog
        open={confirmConvert}
        onOpenChange={setConfirmConvert}
        tone="primary"
        title="Convert this lead into a customer?"
        description="A customer record will be created with this lead's details. The lead leaves the board and stays in the list, marked as converted."
        confirmLabel="Convert to customer"
        loading={convertLead.isPending}
        onConfirm={convert}
      >
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200">
          <Badge tone="violet">Once only</Badge> Converting again will simply open the existing customer.
        </p>
      </ConfirmDialog>
    </>
  );
}
