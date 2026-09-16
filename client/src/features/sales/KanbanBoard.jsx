import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Building2, Plus, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Avatar, Button, ErrorState, Hint, Skeleton } from '@/components/ui';
import { OPTION_COLORS } from '@/lib/constants';
import { timeAgo } from '@/lib/dates';
import { cn, formatCurrency, fullName } from '@/lib/utils';
import { useLeadBoard, useMoveLead } from './api';
import { SYSTEM_TITLE_KEY } from './constants';

const NONE = '__none__';
const GAP = 1024;

// Prefer the droppable directly under the pointer; fall back to the nearest one.
function collisionDetection(args) {
  const within = pointerWithin(args);
  return within.length ? within : closestCorners(args);
}

function LeadCardView({ lead, settings, dragging, overlay }) {
  const value = settings?.valueField ? lead.data?.[settings.valueField] : null;
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200/90 bg-white p-3.5 text-left shadow-card transition-shadow',
        dragging && 'opacity-40',
        overlay && 'rotate-[1.5deg] cursor-grabbing shadow-pop ring-2 ring-brand-500/30',
        !overlay && !dragging && 'hover:border-slate-300 hover:shadow-md',
      )}
    >
      <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">{lead.data?.[SYSTEM_TITLE_KEY] || 'Untitled lead'}</p>
      {(lead.data?.company || lead.data?.contactPerson) && (
        <div className="mt-2 space-y-1">
          {lead.data?.company && (
            <p className="flex items-center gap-1.5 truncate text-xs text-slate-600">
              <Building2 size={13} className="shrink-0 text-slate-400" /> {lead.data.company}
            </p>
          )}
          {lead.data?.contactPerson && (
            <p className="flex items-center gap-1.5 truncate text-xs text-slate-600">
              <UserRound size={13} className="shrink-0 text-slate-400" /> {lead.data.contactPerson}
            </p>
          )}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
        {typeof value === 'number' ? (
          <span className="text-sm font-semibold text-slate-900 tabular">{formatCurrency(value, settings.currency)}</span>
        ) : (
          <span className="text-xs text-slate-400">{timeAgo(lead.updatedAt)}</span>
        )}
        <Hint content={`Owner: ${fullName(lead.owner)}`}>
          <span>
            <Avatar user={lead.owner} size="xs" />
          </span>
        </Hint>
      </div>
    </div>
  );
}

function DraggableLead({ lead, columnValue, settings, onOpen }) {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: lead.id, data: { lead, columnValue } });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `card:${lead.id}`, data: { lead, columnValue } });

  return (
    <div ref={setDropRef} className="relative">
      {isOver && !isDragging && <div className="absolute -top-1.5 left-1 right-1 h-0.5 rounded-full bg-brand-500" aria-hidden />}
      <div
        ref={setDragRef}
        {...listeners}
        {...attributes}
        onClick={() => onOpen(lead)}
        onKeyDown={(e) => {
          listeners?.onKeyDown?.(e);
          if (e.key === 'Enter') onOpen(lead);
        }}
        className="cursor-grab touch-manipulation rounded-xl focus-visible:outline-2 focus-visible:outline-brand-500 active:cursor-grabbing"
        aria-roledescription="Draggable lead card"
      >
        <LeadCardView lead={lead} settings={settings} dragging={isDragging} />
      </div>
    </div>
  );
}

function Column({ column, leads, settings, onOpen, onCreate }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${column.value ?? NONE}`, data: { columnValue: column.value } });
  const colors = OPTION_COLORS[column.color] ?? OPTION_COLORS.slate;

  return (
    <section className="flex w-[292px] shrink-0 flex-col rounded-2xl bg-slate-100/70 ring-1 ring-slate-200/60" aria-label={column.label}>
      <header className="flex items-center gap-2 px-3.5 pb-2 pt-3">
        <span className={cn('size-2.5 rounded-full', colors.dot)} aria-hidden />
        <h3 className="truncate text-[13px] font-semibold uppercase tracking-wide text-slate-700">{column.label}</h3>
        <span className="rounded-full bg-white px-1.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200 tabular">{leads.length}</span>
        {column.value !== null && (
          <Button variant="ghost" size="icon-xs" className="ml-auto" onClick={() => onCreate(column.value)} aria-label={`Add lead to ${column.label}`}>
            <Plus size={15} />
          </Button>
        )}
      </header>
      {settings?.valueField && (
        <p className="px-3.5 pb-2 text-xs font-medium text-slate-500 tabular">{formatCurrency(column.total, settings.currency, { compact: true })}</p>
      )}
      <div
        ref={setNodeRef}
        className={cn(
          'scrollbar-thin mx-1.5 mb-1.5 flex min-h-32 flex-1 flex-col gap-2.5 overflow-y-auto rounded-xl p-1.5 transition-colors',
          isOver && 'bg-brand-50/80 ring-2 ring-inset ring-brand-300',
        )}
      >
        {leads.map((lead) => (
          <DraggableLead key={lead.id} lead={lead} columnValue={column.value} settings={settings} onOpen={onOpen} />
        ))}
        {leads.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 py-6 text-xs text-slate-400">
            Drop leads here
          </div>
        )}
      </div>
    </section>
  );
}

export function KanbanBoard({ fields, settings, filters, onOpen, onCreate }) {
  const boardParams = { search: filters.search, owner: filters.owner };
  const { data, isPending, isError, error, refetch } = useLeadBoard(boardParams);
  const move = useMoveLead(boardParams);
  const [activeLead, setActiveLead] = useState(null);

  const groupField = fields.find((f) => f.key === data?.groupField);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    // Space picks up / drops a card; Enter is reserved for opening it.
    useSensor(KeyboardSensor, { keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] } }),
  );

  // Group and order client-side so optimistic moves render instantly.
  const grouped = useMemo(() => {
    if (!data) return [];
    const known = new Set(data.columns.filter((c) => c.value !== null).map((c) => c.value));
    const buckets = new Map(data.columns.map((c) => [c.value, []]));
    for (const lead of data.leads) {
      const raw = lead.data?.[data.groupField];
      const key = known.has(raw) ? raw : null;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(lead);
    }
    const valueKey = settings?.valueField;
    const columns = data.columns.map((column) => {
      const leads = (buckets.get(column.value) ?? []).sort((a, b) => a.position - b.position);
      const total = valueKey ? leads.reduce((sum, l) => sum + (typeof l.data?.[valueKey] === 'number' ? l.data[valueKey] : 0), 0) : 0;
      return { column: { ...column, total }, leads };
    });
    const orphaned = buckets.get(null);
    if (orphaned?.length && !data.columns.some((c) => c.value === null)) {
      columns.push({ column: { value: null, label: 'Uncategorised', color: 'slate', total: 0 }, leads: orphaned });
    }
    return columns;
  }, [data, settings?.valueField]);

  const handleDragEnd = ({ active, over }) => {
    setActiveLead(null);
    if (!over) return;

    const lead = active.data.current.lead;
    const fromValue = active.data.current.columnValue;
    const toValue = over.data.current?.columnValue ?? null;

    if (toValue === null && groupField?.required) {
      toast.error(`${groupField.label} is required — pick a stage column.`);
      return;
    }

    const target = grouped.find((g) => g.column.value === toValue);
    const siblings = (target?.leads ?? []).filter((l) => l.id !== lead.id);

    let position;
    if (String(over.id).startsWith('card:')) {
      const overLead = over.data.current.lead;
      if (overLead.id === lead.id) return;
      const index = siblings.findIndex((l) => l.id === overLead.id);
      const before = siblings[index - 1];
      position = before ? (before.position + overLead.position) / 2 : overLead.position - GAP;
    } else {
      const last = siblings[siblings.length - 1];
      position = last ? last.position + GAP : 0;
      if (fromValue === toValue && siblings.length && lead.position > last.position) return;
    }

    move.mutate(
      { id: lead.id, value: toValue, position },
      {
        onSuccess: () => {
          if (fromValue !== toValue) toast.success(`Moved to ${target?.column.label ?? 'Uncategorised'}`);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  if (isPending) {
    return (
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="w-[292px] shrink-0 space-y-2.5 rounded-2xl bg-slate-100/70 p-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {data.truncated && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
          Showing the first 1,000 leads. Use search or the owner filter to narrow the board.
        </p>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={({ active }) => setActiveLead(active.data.current.lead)}
        onDragCancel={() => setActiveLead(null)}
        onDragEnd={handleDragEnd}
        accessibility={{
          announcements: {
            onDragStart: ({ active }) => `Picked up ${active.data.current?.lead?.data?.[SYSTEM_TITLE_KEY] ?? 'lead'}.`,
            onDragOver: ({ over }) => (over ? `Over ${over.data.current?.columnValue ?? 'uncategorised'}.` : 'Not over a column.'),
            onDragEnd: ({ over }) => (over ? 'Lead moved.' : 'Lead dropped outside the board.'),
            onDragCancel: () => 'Move cancelled.',
          },
        }}
      >
        <div className="scrollbar-thin -mx-4 flex h-[calc(100dvh-300px)] min-h-[480px] gap-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {grouped.map(({ column, leads }) => (
            <Column key={column.value ?? NONE} column={column} leads={leads} settings={settings} onOpen={onOpen} onCreate={onCreate} />
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }}>
          {activeLead ? (
            <div className="w-[264px]">
              <LeadCardView lead={activeLead} settings={settings} overlay />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}
