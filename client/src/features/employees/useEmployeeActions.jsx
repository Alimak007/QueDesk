import { Archive } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui';
import { useAuth } from '@/features/auth/useAuth';
import { fullName } from '@/lib/utils';
import { useDeleteEmployee, useSetEmployeeStatus } from './api';
import { EmployeeFormModal } from './EmployeeFormModal';
import { ResetPasswordModal } from './ResetPasswordModal';

/**
 * Shared employee actions (edit, reset password, (de)activate, delete) with
 * their dialogs, used by both the list and the details page.
 */
export function useEmployeeActions({ onDeleted } = {}) {
  const { user: me } = useAuth();
  const [editing, setEditing] = useState(null);
  const [resetting, setResetting] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBlocked, setDeleteBlocked] = useState(null);

  const setStatus = useSetEmployeeStatus();
  const remove = useDeleteEmployee();

  const confirmStatus = async () => {
    const next = statusTarget.status === 'active' ? 'inactive' : 'active';
    try {
      await setStatus.mutateAsync({ id: statusTarget.id, status: next });
      toast.success(next === 'inactive' ? 'Employee deactivated' : 'Employee reactivated', {
        description: next === 'inactive' ? `${fullName(statusTarget)} can no longer sign in.` : `${fullName(statusTarget)} can sign in again.`,
      });
      setStatusTarget(null);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const confirmDelete = async () => {
    try {
      await remove.mutateAsync(deleteTarget.id);
      toast.success('Employee deleted permanently');
      setDeleteTarget(null);
      onDeleted?.();
    } catch (err) {
      if (err.code === 'HAS_HISTORY') {
        setDeleteBlocked(deleteTarget);
        setDeleteTarget(null);
      } else {
        toast.error(err.message);
      }
    }
  };

  const isSelf = (employee) => employee?.id === me?.id;

  const dialogs = (
    <>
      <EmployeeFormModal open={Boolean(editing)} employee={editing} onOpenChange={(open) => !open && setEditing(null)} />
      <ResetPasswordModal employee={resetting} open={Boolean(resetting)} onOpenChange={(open) => !open && setResetting(null)} />

      <ConfirmDialog
        open={Boolean(statusTarget)}
        onOpenChange={(open) => !open && setStatusTarget(null)}
        tone={statusTarget?.status === 'active' ? 'danger' : 'primary'}
        title={statusTarget?.status === 'active' ? 'Deactivate this employee?' : 'Reactivate this employee?'}
        description={
          statusTarget?.status === 'active'
            ? `${fullName(statusTarget)} will be signed out immediately and won’t be able to sign in. Their leave, status reports and sales records are kept.`
            : `${fullName(statusTarget)} will be able to sign in again.`
        }
        confirmLabel={statusTarget?.status === 'active' ? 'Deactivate' : 'Reactivate'}
        loading={setStatus.isPending}
        onConfirm={confirmStatus}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete employee permanently?"
        description={`${fullName(deleteTarget)} will be removed from the portal. This cannot be undone. Employees with existing history can only be deactivated.`}
        confirmLabel="Delete permanently"
        loading={remove.isPending}
        onConfirm={confirmDelete}
      />

      <ConfirmDialog
        open={Boolean(deleteBlocked)}
        onOpenChange={(open) => !open && setDeleteBlocked(null)}
        tone="primary"
        title="This employee has history"
        description={`${fullName(deleteBlocked)} has leave requests, status reports or sales leads. To keep those records intact, deactivate the account instead.`}
        confirmLabel={deleteBlocked?.status === 'active' ? 'Deactivate instead' : 'OK'}
        onConfirm={() => {
          if (deleteBlocked?.status === 'active') setStatusTarget(deleteBlocked);
          setDeleteBlocked(null);
        }}
      >
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200">
          <Archive size={14} /> Deactivated employees keep their history and can be reactivated later.
        </p>
      </ConfirmDialog>
    </>
  );

  return {
    dialogs,
    isSelf,
    edit: setEditing,
    resetPassword: setResetting,
    toggleStatus: setStatusTarget,
    remove: setDeleteTarget,
  };
}
