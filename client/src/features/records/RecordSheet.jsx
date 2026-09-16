import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button, ConfirmDialog, DescriptionList, Sheet, UserCell } from '@/components/ui';
import { FieldValue } from '@/features/sales/fields';
import { formatDate, timeAgo } from '@/lib/dates';
import { fullName } from '@/lib/utils';

/** Detail panel for a lead or customer, driven by the configured fields. */
export function RecordSheet({
  record,
  fields,
  settings,
  open,
  onOpenChange,
  onEdit,
  titleKey,
  statusKey,
  canEdit = true,
  canDelete = false,
  deleteMutation,
  deleteLabel = 'Delete',
  deleteDescription,
  headerActions,
  children,
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!record) return null;
  const statusField = fields.find((f) => f.key === statusKey);
  const title = record.data?.[titleKey] || 'Untitled';
  const detailFields = fields.filter((f) => f.key !== titleKey && f.key !== statusKey);

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(record.id);
      toast.success(`${deleteLabel} complete`);
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
        description={record.data?.company || undefined}
        footer={
          <>
            {canDelete && (
              <Button variant="danger-soft" leftIcon={Trash2} className="mr-auto" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            )}
            {headerActions}
            {canEdit && (
              <Button leftIcon={Pencil} onClick={() => onEdit(record)}>
                Edit
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">Owner</p>
              <UserCell user={record.owner} />
            </div>
            {statusField && (
              <div className="text-right">
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">{statusField.label}</p>
                <FieldValue field={statusField} value={record.data?.[statusField.key]} />
              </div>
            )}
          </div>

          {children}

          <DescriptionList
            items={detailFields.map((field) => ({
              label: field.label,
              value: <FieldValue field={field} value={record.data?.[field.key]} currency={settings?.currency} />,
              full: field.type === 'textarea',
            }))}
          />

          <div className="space-y-1 border-t border-slate-100 pt-4 text-xs text-slate-500">
            <p>
              Created by {fullName(record.createdBy) || 'unknown'} on {formatDate(record.createdAt, 'd MMM yyyy, h:mm a')}
            </p>
            {record.updatedBy && (
              <p>
                Last updated by {fullName(record.updatedBy)} {timeAgo(record.updatedAt)}
              </p>
            )}
          </div>
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`${deleteLabel}?`}
        description={deleteDescription ?? `“${title}” will be permanently removed for everyone. This cannot be undone.`}
        confirmLabel={deleteLabel}
        loading={deleteMutation?.isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}
