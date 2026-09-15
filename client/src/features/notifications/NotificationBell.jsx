import { Bell, BellOff, CircleCheck, CircleX, Plane, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, PopoverPanel, Spinner } from '@/components/ui';
import { timeAgo } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from './api';

const TYPE_STYLES = {
  leave_submitted: { icon: Plane, className: 'bg-brand-50 text-brand-600' },
  leave_approved: { icon: CircleCheck, className: 'bg-emerald-50 text-emerald-600' },
  leave_rejected: { icon: CircleX, className: 'bg-red-50 text-red-600' },
  leave_cancelled: { icon: Undo2, className: 'bg-slate-100 text-slate-600' },
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data, isPending } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unread = data?.unreadCount ?? 0;
  const items = data?.items ?? [];

  const handleOpenItem = (notification) => {
    if (!notification.readAt) markRead.mutate(notification.id);
    setOpen(false);
    if (notification.link) navigate(notification.link);
  };

  return (
    <PopoverPanel
      open={open}
      onOpenChange={setOpen}
      className="w-[min(24rem,calc(100vw-1.5rem))]"
      trigger={
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
          <Bell size={19} />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white ring-2 ring-white tabular">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      }
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Notifications</p>
          <p className="text-xs text-slate-500">{unread ? `${unread} unread` : 'You’re all caught up'}</p>
        </div>
        {unread > 0 && (
          <Button variant="link" size="xs" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
            Mark all as read
          </Button>
        )}
      </div>

      <div className="scrollbar-thin max-h-[26rem] overflow-y-auto">
        {isPending ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <BellOff size={18} />
            </span>
            <p className="text-sm font-medium text-slate-800">No notifications yet</p>
            <p className="mt-0.5 text-xs text-slate-500">Leave updates will show up here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((n) => {
              const style = TYPE_STYLES[n.type] ?? TYPE_STYLES.leave_submitted;
              const Icon = style.icon;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleOpenItem(n)}
                    className={cn(
                      'flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50',
                      !n.readAt && 'bg-brand-50/30',
                    )}
                  >
                    <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', style.className)}>
                      <Icon size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-slate-900">{n.title}</span>
                        {!n.readAt && <span className="size-2 shrink-0 rounded-full bg-brand-500" aria-label="Unread" />}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-slate-600">{n.message}</span>
                      <span className="mt-1 block text-[11px] text-slate-400">{timeAgo(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </PopoverPanel>
  );
}
