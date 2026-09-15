import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button, ConfirmDialog, DescriptionList, Sheet, UserCell } from '@/components/ui';
import { useAuth } from '@/features/auth/useAuth';
import { formatDate, timeAgo } from '@/lib/dates';
import { fullName } from '@/lib/utils';
import { useDeleteLead } from './api';
import { SYSTEM_TITLE_KEY } from './constants';
import { FieldValue } from './fields';

export function LeadSheet({ lead, fields, settings, open, onOpenChange, onEdit }) {
  const { isAdmin } = useAuth();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const remove = useDeleteLead();

  if (!lead) return null;
  const groupField = fields.find((f) => f.key === settings?.kanbanGroupField);
  const title = lead.data?.[SYSTEM_TITLE_KEY] || 'Untitled lead';
  const detailFields = fields.filter((f) => f.key !== SYSTEM_TITLE_KEY);

  const handleDelete = async () => {
    try {
      await remove.mutateAsync(lead.id);
      toast.success('Lead deleted');
      setConfirmDelete(false);
      onOpenChange(false);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        description={lead.data?.company || undefined}
        footer={
          <>
            {isAdmin && (
              <Button variant="danger-soft" leftIcon={Trash2} className="mr-auto" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            )}
            <Button leftIcon={Pencil} onClick={() => onEdit(lead)}>
              Edit lead
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">Owner</p>
              <UserCell user={lead.owner} />
            </div>
            {groupField && (
              <div className="text-right">
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">{groupField.label}</p>
                <FieldValue field={groupField} value={lead.data?.[groupField.key]} />
              </div>
            )}
          </div>

          <DescriptionList
            items={detailFields
              .filter((f) => f.key !== groupField?.key)
              .map((field) => ({
                label: field.label,
                value: <FieldValue field={field} value={lead.data?.[field.key]} currency={settings?.currency} />,
                full: field.type === 'textarea',
              }))}
          />

          <div className="space-y-1 border-t border-slate-100 pt-4 text-xs text-slate-500">
            <p>
              Created by {fullName(lead.createdBy) || 'unknown'} on {formatDate(lead.createdAt, 'd MMM yyyy, h:mm a')}
            </p>
            {lead.updatedBy && (
              <p>
                Last updated by {fullName(lead.updatedBy)} {timeAgo(lead.updatedAt)}
              </p>
            )}
          </div>
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this lead?"
        description={`“${title}” will be permanently removed for everyone. This cannot be undone.`}
        confirmLabel="Delete lead"
        loading={remove.isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}
