import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({ open, onOpenChange, title, description, size = 'md', footer, children, className, icon }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl bg-white shadow-pop ring-1 ring-slate-900/5 focus:outline-none data-[state=open]:animate-scale-in',
            SIZES[size],
            className,
          )}
          onOpenAutoFocus={(e) => {
            // Focus the first form control rather than the close button.
            const target = e.currentTarget?.querySelector?.('input:not([type=hidden]), textarea, select');
            if (target) {
              e.preventDefault();
              target.focus();
            }
          }}
        >
          <div className="flex items-start gap-3 border-b border-slate-100 px-6 pb-4 pt-5">
            {icon}
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-base font-semibold text-slate-900">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-sm text-slate-500">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              className="-mr-2 -mt-1 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close"
            >
              <X size={18} />
            </Dialog.Close>
          </div>
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && (
            <div className="flex flex-wrap items-center justify-end gap-2 rounded-b-2xl border-t border-slate-100 bg-slate-50/60 px-6 py-3.5">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Sheet({ open, onOpenChange, title, description, footer, children, width = 'max-w-xl', headerExtra }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-[1px] data-[state=open]:animate-fade-in" />
        <Dialog.Content
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-pop focus:outline-none data-[state=open]:animate-slide-in-right',
            width,
          )}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex items-start gap-3 border-b border-slate-100 px-6 py-4">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate text-base font-semibold text-slate-900">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-sm text-slate-500">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            {headerExtra}
            <Dialog.Close
              className="-mr-2 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close"
            >
              <X size={18} />
            </Dialog.Close>
          </div>
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-3.5">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
