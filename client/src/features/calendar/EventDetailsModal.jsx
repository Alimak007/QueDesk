import { CalendarRange, Clock, Info, MapPin, Pencil, Trash2, UserRound } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button, ConfirmDialog, Modal } from '@/components/ui';
import { usePermissions } from '@/features/auth/usePermissions';
import { EVENT_TYPE_MAP } from '@/lib/constants';
import { formatDateRange, formatTime } from '@/lib/dates';
import { cn, fullName } from '@/lib/utils';
import { useDeleteEvent } from './api';

function Row({ icon: Icon, children }) {
  return (
    <div className="flex gap-3 text-sm text-slate-700">
      <Icon size={17} className="mt-0.5 shrink-0 text-slate-400" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function EventDetailsModal({ event, open, onOpenChange, canManage, onEdit }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteEvent = useDeleteEvent();
  const { can } = usePermissions();
  const canDelete = can('calendar', 'delete');

  if (!event) return null;
  const type = EVENT_TYPE_MAP[event.type] ?? EVENT_TYPE_MAP.other;

  const handleDelete = async () => {
    try {
      await deleteEvent.mutateAsync(event.id);
      toast.success('Event deleted');
      setConfirmDelete(false);
      onOpenChange(false);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title={event.title}
        icon={<span className={cn('mt-1.5 size-3 shrink-0 rounded-full', type.solid)} aria-hidden />}
        footer={
          canManage || canDelete ? (
            <>
              {canDelete && (
                <Button variant="danger-soft" leftIcon={Trash2} className="mr-auto" onClick={() => setConfirmDelete(true)}>
                  Delete
                </Button>
              )}
              {canManage && (
                <Button variant="secondary" leftIcon={Pencil} onClick={() => onEdit(event)}>
                  Edit
                </Button>
              )}
            </>
          ) : (
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )
        }
      >
        <div className="space-y-4">
          <Badge className={type.chip}>{type.label}</Badge>
          <Row icon={CalendarRange}>{formatDateRange(event.startDate, event.endDate)}</Row>
          <Row icon={Clock}>{event.isAllDay ? 'All day' : `${formatTime(event.startTime)} – ${formatTime(event.endTime)}`}</Row>
          {event.location && <Row icon={MapPin}>{event.location}</Row>}
          {event.description && (
            <p className="whitespace-pre-wrap rounded-xl bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700 ring-1 ring-slate-200/70">
              {event.description}
            </p>
          )}
          {event.additionalInfo && (
            <Row icon={Info}>
              <span className="whitespace-pre-wrap">{event.additionalInfo}</span>
            </Row>
          )}
          {event.createdBy?.firstName && (
            <Row icon={UserRound}>
              <span className="text-slate-500">Added by {fullName(event.createdBy)}</span>
            </Row>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this event?"
        description={`“${event.title}” will be removed from the company calendar for everyone. This cannot be undone.`}
        confirmLabel="Delete event"
        loading={deleteEvent.isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}
