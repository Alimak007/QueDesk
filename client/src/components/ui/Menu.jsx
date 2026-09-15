import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Popover from '@radix-ui/react-popover';
import * as Tooltip from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';

export function Menu({ trigger, children, align = 'end', className }) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={6}
          className={cn(
            'z-50 min-w-44 rounded-xl bg-white p-1 shadow-pop ring-1 ring-slate-900/5 data-[state=open]:animate-fade-in',
            className,
          )}
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function MenuItem({ icon: Icon, children, tone, onSelect, disabled }) {
  return (
    <DropdownMenu.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        'flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40',
        tone === 'danger'
          ? 'text-red-600 data-[highlighted]:bg-red-50'
          : 'text-slate-700 data-[highlighted]:bg-slate-100 data-[highlighted]:text-slate-900',
      )}
    >
      {Icon && <Icon size={16} className="shrink-0 opacity-80" aria-hidden />}
      {children}
    </DropdownMenu.Item>
  );
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-slate-100" />;
}

export function MenuLabel({ children }) {
  return <DropdownMenu.Label className="px-2.5 py-1.5 text-xs font-medium text-slate-500">{children}</DropdownMenu.Label>;
}

export function PopoverPanel({ trigger, children, align = 'end', className, open, onOpenChange }) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={8}
          collisionPadding={12}
          className={cn(
            'z-50 rounded-2xl bg-white shadow-pop ring-1 ring-slate-900/5 focus:outline-none data-[state=open]:animate-fade-in',
            className,
          )}
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function TooltipProvider({ children }) {
  return <Tooltip.Provider delayDuration={250}>{children}</Tooltip.Provider>;
}

export function Hint({ content, children, side = 'top' }) {
  if (!content) return children;
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={side}
          sideOffset={6}
          className="z-[60] max-w-xs rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow-lg data-[state=delayed-open]:animate-fade-in"
        >
          {content}
          <Tooltip.Arrow className="fill-slate-900" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
