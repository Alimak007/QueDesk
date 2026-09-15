import { TriangleAlert } from 'lucide-react';
import { Button } from './Button';
import { Modal } from './Modal';

export function ConfirmDialog({
  open,
  onOpenChange,
  title = 'Are you sure?',
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  loading = false,
  onConfirm,
  children,
}) {
  return (
    <Modal
      open={open}
      onOpenChange={(next) => !loading && onOpenChange(next)}
      size="sm"
      title={title}
      icon={
        tone === 'danger' ? (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 ring-4 ring-red-50/60">
            <TriangleAlert size={18} />
          </span>
        ) : null
      }
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description && <p className="text-sm leading-relaxed text-slate-600">{description}</p>}
      {children}
    </Modal>
  );
}
