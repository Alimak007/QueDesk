import { Copy, KeyRound, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button, FormField, Input, Modal } from '@/components/ui';
import { useResetOnChange } from '@/hooks';
import { fullName } from '@/lib/utils';
import { useResetEmployeePassword } from './api';
import { generatePassword, passwordRule } from './passwords';

export function ResetPasswordModal({ employee, open, onOpenChange }) {
  const reset = useResetEmployeePassword();
  const [password, setPassword] = useState(generatePassword);
  const [error, setError] = useState('');

  const reopened = useResetOnChange(open ? employee?.id : null);
  if (reopened) {
    setPassword(generatePassword());
    setError('');
  }

  const submit = async () => {
    const parsed = passwordRule.safeParse(password);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    try {
      await reset.mutateAsync({ id: employee.id, password });
      toast.success('Password reset', { description: `${fullName(employee)} has been signed out of all sessions.` });
      onOpenChange(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      toast.success('Password copied to clipboard');
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title="Reset password"
      description={employee ? `Set a new temporary password for ${fullName(employee)}.` : undefined}
      icon={
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <KeyRound size={17} />
        </span>
      }
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} loading={reset.isPending}>
            Reset password
          </Button>
        </>
      }
    >
      <FormField label="New password" error={error} hint="The employee will be signed out everywhere and must use this password.">
        {(field) => (
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                {...field}
                className="font-mono"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
              />
            </div>
            <Button variant="secondary" size="icon" onClick={copy} aria-label="Copy password">
              <Copy size={16} />
            </Button>
            <Button variant="secondary" size="icon" onClick={() => setPassword(generatePassword())} aria-label="Generate new password">
              <RefreshCw size={16} />
            </Button>
          </div>
        )}
      </FormField>
    </Modal>
  );
}
