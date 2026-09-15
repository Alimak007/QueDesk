import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parse,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, List, MapPin, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, Card, CardHeader, EmptyState, ErrorState, PageHeader, Skeleton, Spinner, Tabs } from '@/components/ui';
import { useAuth } from '@/features/auth/useAuth';
import { useDocumentTitle, useQueryState } from '@/hooks';
import { EVENT_TYPE_MAP, EVENT_TYPES } from '@/lib/constants';
import { formatDate, formatDateRange, formatTime, relativeDay, toDateOnly, todayDateOnly } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { useEvents, useUpcomingEvents } from './api';
import { EventDetailsModal } from './EventDetailsModal';
import { EventFormModal } from './EventFormModal';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MAX_CHIPS = 3;

function EventChip({ event, onClick }) {
  const type = EVENT_TYPE_MAP[event.type] ?? EVENT_TYPE_MAP.other;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick(event);
      }}
      className={cn(
        'flex w-full items-center gap-1.5 truncate rounded-md px-1.5 py-0.5 text-left text-[11.5px] font-medium ring-1 ring-inset transition-opacity hover:opacity-80',
        type.chip,
      )}
      title={event.title}
    >
      {!event.isAllDay && <span className="hidden shrink-0 tabular opacity-70 2xl:inline">{event.startTime}</span>}
      <span className="truncate">{event.title}</span>
    </button>
  );
}

function EventListItem({ event, onClick, showDate = true }) {
  const type = EVENT_TYPE_MAP[event.type] ?? EVENT_TYPE_MAP.other;
  return (
    <button
      type="button"
      onClick={() => onClick(event)}
      className="flex w-full gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-slate-50"
    >
      <span className={cn('mt-1 w-1 shrink-0 self-stretch rounded-full', type.solid)} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-900">{event.title}</span>
        <span className="mt-0.5 block text-xs text-slate-500">
          {showDate && `${formatDateRange(event.startDate, event.endDate)} · `}
          {event.isAllDay ? 'All day' : `${formatTime(event.startTime)} – ${formatTime(event.endTime)}`}
        </span>
        {event.location && (
          <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-400">
            <MapPin size={11} /> {event.location}
          </span>
        )}
      </span>
    </button>
  );
}

export default function CalendarPage() {
  const { isAdmin } = useAuth();
  useDocumentTitle(isAdmin ? 'Calendar Management' : 'Calendar');

  const today = todayDateOnly();
  const [state, setState] = useQueryState({ month: format(new Date(), 'yyyy-MM'), view: 'month', type: '' });
  const [selectedDate, setSelectedDate] = useState(today);
  const [details, setDetails] = useState(null);
  const [form, setForm] = useState({ open: false, event: null, date: undefined });

  const monthDate = useMemo(() => {
    const parsed = parse(state.month, 'yyyy-MM', new Date());
    return Number.isNaN(parsed.getTime()) ? startOfMonth(new Date()) : parsed;
  }, [state.month]);

  const gridStart = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const range = { from: toDateOnly(gridStart), to: toDateOnly(gridEnd), type: state.type };
  const { data: events = [], isPending, isError, error, refetch, isFetching } = useEvents(range);
  const upcoming = useUpcomingEvents({ limit: 6 });

  const eventsByDay = useMemo(() => {
    const map = new Map();
    for (const event of events) {
      for (const day of days) {
        const key = toDateOnly(day);
        if (key >= event.startDate && key <= event.endDate) {
          if (!map.has(key)) map.set(key, []);
          map.get(key).push(event);
        }
      }
    }
    for (const list of map.values()) {
      list.sort((a, b) => Number(b.isAllDay) - Number(a.isAllDay) || (a.startTime ?? '').localeCompare(b.startTime ?? ''));
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, state.month]);

  const monthEvents = events.filter((e) => e.endDate >= toDateOnly(startOfMonth(monthDate)) && e.startDate <= toDateOnly(endOfMonth(monthDate)));
  const selectedEvents = eventsByDay.get(selectedDate) ?? [];

  const goToMonth = (offset) => setState({ month: format(addMonths(monthDate, offset), 'yyyy-MM') });
  const goToday = () => {
    setState({ month: format(new Date(), 'yyyy-MM') });
    setSelectedDate(today);
  };

  const openCreate = (date) => setForm({ open: true, event: null, date });

  return (
    <>
      <PageHeader
        title={isAdmin ? 'Calendar Management' : 'Company Calendar'}
        description={isAdmin ? 'Add and manage holidays, events and meetings for everyone.' : 'Holidays, company events and meetings.'}
        actions={
          isAdmin && (
            <Button leftIcon={Plus} onClick={() => openCreate(selectedDate)}>
              New event
            </Button>
          )
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="overflow-hidden">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <h2 className="min-w-40 text-lg font-semibold tracking-tight text-slate-900">{format(monthDate, 'MMMM yyyy')}</h2>
              <div className="flex items-center rounded-lg ring-1 ring-slate-200">
                <Button variant="ghost" size="icon-sm" onClick={() => goToMonth(-1)} aria-label="Previous month">
                  <ChevronLeft size={17} />
                </Button>
                <Button variant="ghost" size="sm" onClick={goToday}>
                  Today
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => goToMonth(1)} aria-label="Next month">
                  <ChevronRight size={17} />
                </Button>
              </div>
              {isFetching && !isPending && <Spinner size={16} />}
            </div>
            <Tabs
              size="sm"
              value={state.view}
              onChange={(view) => setState({ view })}
              options={[
                { value: 'month', label: 'Month', icon: CalendarDays },
                { value: 'agenda', label: 'Agenda', icon: List },
              ]}
            />
          </div>

          {/* Legend / type filter */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-5 py-2.5">
            <button
              type="button"
              onClick={() => setState({ type: '' })}
              className={cn(
                'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                !state.type ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              All
            </button>
            {EVENT_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setState({ type: state.type === t.value ? '' : t.value })}
                aria-pressed={state.type === t.value}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                  state.type === t.value ? `ring-1 ring-inset ${t.chip}` : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                <span className={cn('size-2 rounded-full', t.dot)} aria-hidden />
                {t.label}
              </button>
            ))}
          </div>

          {isError ? (
            <ErrorState error={error} onRetry={refetch} />
          ) : state.view === 'agenda' ? (
            <div className="min-h-96 p-3">
              {isPending ? (
                <div className="space-y-3 p-3">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : monthEvents.length === 0 ? (
                <EmptyState icon={CalendarDays} title="Nothing scheduled" description={`No events in ${format(monthDate, 'MMMM yyyy')}.`} />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {monthEvents.map((event) => (
                    <li key={event.id} className="flex gap-4 px-2 py-2">
                      <div className="w-14 shrink-0 pt-2 text-center">
                        <p className="text-[11px] font-semibold uppercase text-slate-400">{formatDate(event.startDate, 'EEE')}</p>
                        <p className="text-xl font-semibold leading-tight text-slate-900 tabular">{formatDate(event.startDate, 'd')}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <EventListItem event={event} onClick={setDetails} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="scrollbar-thin overflow-x-auto">
              <div className="min-w-[640px]">
                <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/60">
                  {WEEKDAYS.map((d, i) => (
                    <div key={d} className={cn('px-2 py-2 text-center text-xs font-medium text-slate-500', i >= 5 && 'text-slate-400')}>
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {days.map((day, index) => {
                    const key = toDateOnly(day);
                    const dayEvents = eventsByDay.get(key) ?? [];
                    const inMonth = isSameMonth(day, monthDate);
                    const isToday = key === today;
                    const isSelected = key === selectedDate;
                    const isWeekend = index % 7 >= 5;
                    const isHoliday = dayEvents.some((e) => e.type === 'holiday');

                    return (
                      <div
                        key={key}
                        role="button"
                        tabIndex={0}
                        aria-label={`${format(day, 'EEEE d MMMM')}${dayEvents.length ? `, ${dayEvents.length} events` : ''}`}
                        onClick={() => setSelectedDate(key)}
                        onDoubleClick={() => isAdmin && openCreate(key)}
                        onKeyDown={(e) => e.key === 'Enter' && setSelectedDate(key)}
                        className={cn(
                          'group relative min-h-28 cursor-pointer border-b border-r border-slate-100 p-1.5 text-left transition-colors [&:nth-child(7n)]:border-r-0',
                          !inMonth && 'bg-slate-50/50',
                          isWeekend && inMonth && 'bg-slate-50/30',
                          isHoliday && inMonth && 'bg-rose-50/30',
                          isSelected ? 'bg-brand-50/50 ring-2 ring-inset ring-brand-500/60' : 'hover:bg-slate-50',
                        )}
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <span
                            className={cn(
                              'flex size-7 items-center justify-center rounded-full text-[13px] font-medium tabular',
                              isToday ? 'bg-brand-600 text-white shadow-sm' : inMonth ? 'text-slate-800' : 'text-slate-400',
                            )}
                          >
                            {format(day, 'd')}
                          </span>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openCreate(key);
                              }}
                              className="rounded-md p-1 text-slate-400 opacity-0 transition-opacity hover:bg-white hover:text-brand-600 focus:opacity-100 group-hover:opacity-100"
                              aria-label={`Add event on ${format(day, 'd MMMM')}`}
                            >
                              <Plus size={14} />
                            </button>
                          )}
                        </div>
                        {isPending ? (
                          index % 5 === 2 && <Skeleton className="h-4 w-full" />
                        ) : (
                          <div className="space-y-1">
                            {dayEvents.slice(0, MAX_CHIPS).map((event) => (
                              <EventChip key={event.id} event={event} onClick={setDetails} />
                            ))}
                            {dayEvents.length > MAX_CHIPS && (
                              <p className="px-1.5 text-[11px] font-medium text-slate-500">+{dayEvents.length - MAX_CHIPS} more</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title={relativeDay(selectedDate)}
              description={formatDate(selectedDate, 'EEEE, d MMMM yyyy')}
              action={
                isAdmin && (
                  <Button variant="soft" size="xs" leftIcon={Plus} onClick={() => openCreate(selectedDate)}>
                    Add
                  </Button>
                )
              }
            />
            <div className="px-3 pb-3">
              {selectedEvents.length === 0 ? (
                <p className="px-2 pb-3 text-sm text-slate-500">No events on this day.</p>
              ) : (
                selectedEvents.map((event) => <EventListItem key={event.id} event={event} onClick={setDetails} showDate={false} />)
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Upcoming" description="Next holidays and events" />
            <div className="px-3 pb-3">
              {upcoming.isPending ? (
                <div className="space-y-2 p-2">
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </div>
              ) : !upcoming.data?.length ? (
                <p className="px-2 pb-3 text-sm text-slate-500">Nothing coming up.</p>
              ) : (
                upcoming.data.map((event) => <EventListItem key={event.id} event={event} onClick={setDetails} />)
              )}
            </div>
          </Card>
        </div>
      </div>

      <EventDetailsModal
        event={details}
        open={Boolean(details)}
        onOpenChange={(open) => !open && setDetails(null)}
        canManage={isAdmin}
        onEdit={(event) => {
          setDetails(null);
          setForm({ open: true, event, date: undefined });
        }}
      />
      {isAdmin && (
        <EventFormModal
          open={form.open}
          event={form.event}
          defaultDate={form.date}
          onOpenChange={(open) => setForm((prev) => ({ ...prev, open }))}
        />
      )}
    </>
  );
}
