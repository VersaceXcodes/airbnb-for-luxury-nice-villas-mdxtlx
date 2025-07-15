import React, { useState, useEffect, useMemo } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { CalendarEvent, CreateCalendarEventInput, UpdateCalendarEventInput } from '@schema';

type CalendarView = 'month' | 'week' | 'list';

interface CalendarEventsResponse {
  events: CalendarEvent[];
}

interface SyncResponse {
  ok: boolean;
}

export default function UV_HostCalendar() {
  const navigate = useNavigate();
  const { villaId: paramVillaId } = useParams<{ villaId?: string }>();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const authUser = useAppStore((state) => state.auth_user);
  const apiClient = useAppStore((state) => state.api_client);

  // State mapping
  const selectedVillaId = paramVillaId ?? searchParams.get('villaId') ?? null;
  const [calendarView, setCalendarView] = useState<CalendarView>((searchParams.get('view') as CalendarView) || 'month');
  const [selectedDateRange, setSelectedDateRange] = useState<{ start: string; end: string } | null>(null);
  const [unsavedRules, setUnsavedRules] = useState<
    Array<{ start: string; end: string; deltaPrice?: number; minStay?: number; action: 'block' | 'price' | 'stay' }>
  >([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [since] = useState(() => new Date().toISOString().slice(0, 10));

  // utility – helper to get end of month
  const until = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  }, []);

  // Fetch events
  const { data: events = [], isLoading, error, refetch } = useQuery<CalendarEvent[], Error>({
    queryKey: ['calendarEvents', selectedVillaId, since, until],
    queryFn: async () => {
      if (!selectedVillaId) return [];
      const url = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/villas/${selectedVillaId}/calendar_events?since=${since}&until=${until}`;
      const { data } = await axios.get<CalendarEventsResponse>(url, { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } });
      return data.events || [];
    },
    enabled: !!selectedVillaId,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  // Fetch host / villa list to populate selector
  const { data: myVillas = [] } = useQuery<{ id: string; title: string }[]>({
    queryKey: ['myVillas', authUser?.id],
    queryFn: async () => {
      if (!authUser) return [];
      const url = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/hosts/${authUser.id}/listings`;
      const { data } = await axios.get<{ id: string; title: string }[]>(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      });
      return data;
    },
    enabled: !!authUser,
  });

  // mutate create block
  const createBlockMutation = useMutation<CalendarEvent, Error, Omit<CreateCalendarEventInput, 'villa_id'>>({
    mutationFn: async (payload) => {
      const url = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/calendar_events`;
      const { data } = await axios.post<CalendarEvent>(
        url,
        { ...payload, villa_id: selectedVillaId! },
        { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } },
      );
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendarEvents', selectedVillaId] }),
  });

  // bulk update
  const bulkMutation = useMutation<CalendarEvent[], Error, any>({
    mutationFn: async (payload) => {
      const url = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/calendar_events/bulk`;
      const { data } = await axios.patch<CalendarEvent[]>(url, payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarEvents', selectedVillaId] });
      setShowBulkModal(false);
    },
  });

  // iCal sync
  const syncMutation = useMutation<SyncResponse, Error>({
    mutationFn: async () => {
      const url = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/hosts/${authUser?.id}/ical/sync`;
      const { data } = await axios.post<SyncResponse>(url, {}, { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } });
      return data;
    },
  });

  // Helper – build matrix of cells
  const days = useMemo(() => {
    const out: { date: string; events: CalendarEvent[] }[] = [];
    const dt = new Date(since);
    for (let i = 0; i < 35; i++) {
      const d = new Date(dt);
      d.setDate(dt.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      out.push({ date: iso, events: events.filter((e) => e.start_date.slice(0, 10) <= iso && e.end_date.slice(0, 10) > iso) });
    }
    return out;
  }, [since, events]);

  // handle cell click
  const handleCellClick = (date: string) => {
    // quick block toggle if no prior event
    if (!selectedVillaId) return;
    const existing = events.find((e) => e.start_date.slice(0, 10) === date && e.event_type === 'blocked');
    if (existing) {
      axios.delete(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/calendar_events/${existing.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      }).then(() => refetch());
    } else {
      createBlockMutation.mutate({
        event_type: 'blocked',
        start_date: new Date(date),
        end_date: new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000),
        note: 'manual block via calendar',
      });
    }
  };

  return (
    <>
      {/* Full host calendar view */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Top toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-y-2 mb-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-lg">Calendar</span>
            <select
              className="border px-2 py-1 text-sm rounded"
              value={selectedVillaId || ''}
              onChange={(e) => {
                const id = e.target.value || null;
                navigate(`/host/calendar${id ? `/${id}` : ''}`, { replace: true });
              }}
            >
              <option value="">All villas</option>
              {myVillas.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.title}
                </option>
              ))}
            </select>
            <select
              className="border px-2 py-1 text-sm rounded"
              value={calendarView}
              onChange={(e) => setCalendarView(e.target.value as CalendarView)}
            >
              <option value="month">Month</option>
              <option value="week">Week</option>
              <option value="list">List</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="bg-slate-100 border px-3 py-1 rounded text-sm"
              onClick={() => setShowBulkModal(true)}
            >
              Bulk edit
            </button>
            <button
              className="bg-slate-100 border px-3 py-1 rounded text-sm"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              {syncMutation.isPending ? 'Syncing...' : 'Sync iCal'}
            </button>
          </div>
        </div>

        {error && <div className="text-red-700 mb-4">Error loading calendar: {error.message}</div>}
        {isLoading && <div className="text-gray-500 mb-4">Loading events...</div>}

        {/* Calendar grid (month view) */}
        <div className="grid grid-cols-7 gap-px bg-gray-200 font-mono text-xs">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="bg-gray-50 py-1 text-center font-semibold">
              {d}
            </div>
          ))}
          {days.map(({ date, events }) => {
            const blockEvent = events.find((e) => e.event_type === 'blocked');
            const bookingEvent = events.find((e) => e.event_type === 'booking');
            const bg = blockEvent ? 'bg-gray-400' : bookingEvent ? 'bg-red-500' : 'bg-green-100';
            return (
              <div
                key={date}
                onClick={() => handleCellClick(date)}
                className={`h-24 p-1 cursor-pointer transition hover:ring-2 ring-blue-500 ${bg}`}
              >
                {date.slice(-2)}
                {bookingEvent && <div className="truncate italic text-white text-[10px]">{bookingEvent.note || 'Booked'}</div>}
              </div>
            );
          })}
        </div>

        {/* List view */}
        {calendarView === 'list' && (
          <div className="mt-4 space-y-2">
            {events.map((ev) => (
              <div key={ev.id} className="flex justify-between text-sm border rounded px-3 py-2">
                <span>
                  {ev.start_date.slice(0, 10)} → {ev.end_date.slice(0, 10)}
                </span>
                <span className="capitalize">{ev.event_type}</span>
              </div>
            ))}
          </div>
        )}

        {/* Mini side panel placeholder for detail when cell clicked */}
        {selectedDateRange && (
          <div className="fixed z-30 bottom-20 right-4 w-72 border rounded bg-white shadow-lg p-4">
            <button onClick={() => setSelectedDateRange(null)} className="float-right text-sm">
              ×
            </button>
            <p>
              {selectedDateRange.start} → {selectedDateRange.end}
            </p>
            <Link
              to={`/host/inbox`}
              className="text-sm mt-2 underline"
            >
              Open Inbox
            </Link>
          </div>
        )}

        {/* Bulk edit modal */}
        {showBulkModal && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
            <div className="bg-white rounded p-4 w-full max-w-sm">
              <h3 className="font-semibold mb-2">Bulk Edit</h3>
              <label className="block mb-2 text-sm">
                How to apply rule?
                <select
                  className="w-full border px-2 py-1 mt-1"
                  value={unsavedRules.length ? unsavedRules[0]?.action : 'price'}
                  onChange={(e) =>
                    setUnsavedRules((prev) =>
                      prev.map((r) => ({ ...r, action: e.target.value as any }))
                    )
                  }
                >
                  <option value="block">Block</option>
                  <option value="price">Price adjustment (%)</option>
                </select>
              </label>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setShowBulkModal(false)}
                  className="border px-3 py-1 rounded text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    // example submit payload
                    bulkMutation.mutate({ rules: unsavedRules });
                  }}
                  className="bg-black text-white px-3 py-1 rounded text-sm"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}