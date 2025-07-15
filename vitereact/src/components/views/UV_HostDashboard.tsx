import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Tooltip
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// ----------------------------------------------------------
// Static SVG icons (MIT license, heroicons 2.x)
// ----------------------------------------------------------
const VillaIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18a2.25 2.25 0 002.25 2.25h12.75a2.25 2.25 0 002.25-2.25v-18a2 2 0 00-2-2H4.25a2 2 0 00-2 2z" />
  </svg>
);
const CalendarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h6.75" />
  </svg>
);
const InboxIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0018.75 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
  </svg>
);
const PerformanceIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
);
const PayoutsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h19.5M2.25 15h19.5M2.25 18h19.5M2.25 12.75h19.5" />
  </svg>
);
const SupportIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
  </svg>
);
const ChevronLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
  </svg>
);
const SettingsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-1.007 1.099-1.093l1.188-.223a2.25 2.25 0 012.048-.095l.678.439c.39.253.731.575 1.004.948l.678.879a2.25 2.25 0 00-1.055.83l-.539.67c-.278.346-.078.91 0 1.163l.54.841a2.25 2.25 0 001.058.83l.862.21c.127.593.31 1.155.533 1.679l-.869.559a2.25 2.25 0 00-.918 1.942v.584a2.25 2.25 0 00.918 1.942l.86.553c-.175.475-.357.938-.544 1.39l-.83.21a2.25 2.25 0 00-1.948.961l-.885-.87c-.41-.4-1.01-.72-1.738-.72-.728 0-1.328.32-1.738.72l-.885.87a2.25 2.25 0 00-1.948-.961l-.83-.21a12.193 12.193 0 00-.544-1.39l.861-.553a2.25 2.25 0 00.918-1.942v-.584a2.25 2.25 0 00-.918-1.942l-.869-.559c.221-.524.405-1.086.533-1.679l.862-.21a2.25 2.25 0 001.058-.83l.539-.671c.278-.346.078-.91 0-1.163l-.54-.841a2.25 2.25 0 00-1.058-.83l-.678-.879z" />
  </svg>
);

const KpiSpark: React.FC<{ label: string; value: string; sparkData: { v: number }[] }> = ({ label, value, sparkData }) => (
  <div className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-200 w-full">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-neutral-600">{label}</p>
        <p className="text-2xl font-bold text-neutral-900">{value}</p>
      </div>
      <div className="h-12 w-24">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sparkData}>
            <Tooltip
              contentStyle={{ display: 'none' }}
              cursor={{ stroke: '#e2e8f0' }}
            />
            <Line
              type="monotone"
              dataKey="v"
              strokeWidth={2}
              stroke={label.includes('Occupancy') ? '#facc15' : label.includes('ADR') ? '#06b6d4' : label.includes('RevPAL') ? '#22c55e' : '#a855f7'}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  </div>
);

// ----------------------------------------------------------
// Component
// ----------------------------------------------------------
const UV_HostDashboard: React.FC = () => {
  const auth_user = useAppStore(state => state.auth_user);
  const [collapsed, setCollapsed] = useState(false);

  // ------------------------------------------------------------
  // Server calls
  // ------------------------------------------------------------
  const { data: kpis, isLoading: kLoading } = useQuery({
    queryKey: ['hostKpis', auth_user?.id],
    queryFn: async () => {
      const { data } = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/hosts/${auth_user?.id}/kpis`,
        { withCredentials: true }
      );
      return data; // { occupancy:number, adr_usd:number, revpal_usd:number, response_time_minutes:number }
    },
    enabled: !!auth_user?.id,
  });

  const { data: nextPayout, isLoading: pLoading } = useQuery({
    queryKey: ['nextPayout', auth_user?.id],
    queryFn: async () => {
      const { data } = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/hosts/${auth_user?.id}/payouts/next`,
        { withCredentials: true }
      );
      return data; // { next_payout_date:string, total_due_usd:number }
    },
    enabled: !!auth_user?.id,
  });

  const { data: inquiries, isLoading: iLoading } = useQuery({
    queryKey: ['openInquiries', auth_user?.id],
    queryFn: async () => {
      const { data } = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/hosts/${auth_user?.id}/inquiries?status=pending`,
        { withCredentials: true }
      );
      return data as any[]; // Inquiry[]
    },
    enabled: !!auth_user?.id,
  });

  const { data: conflicts, isLoading: cLoading } = useQuery({
    queryKey: ['calendarConflicts', auth_user?.id],
    queryFn: async () => {
      const { data } = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/hosts/${auth_user?.id}/calendar_events?conflicts=true`,
        { withCredentials: true }
      );
      return data as any[]; // CalendarEvent[]
    },
    enabled: !!auth_user?.id,
  });

  // ------------------------------------------------------------
  // Sidebar config
  // ------------------------------------------------------------
  const navItems = [
    { name: 'My Villas', path: '/host/listings', Icon: VillaIcon },
    { name: 'Calendar', path: '/host/calendar', Icon: CalendarIcon },
    { name: 'Inquiries', path: '/host/inbox', Icon: InboxIcon },
    { name: 'Performance', path: '/host/performance', Icon: PerformanceIcon },
    { name: 'Payouts', path: '/host/payouts', Icon: PayoutsIcon },
    { name: 'Support', path: '/host/damage', Icon: SupportIcon },
  ];

  const isLoading = kLoading || pLoading || iLoading || cLoading;
  const hasData = !isLoading;
  const today = Date.now();
  const daysRemaining = nextPayout ? new Date(nextPayout.next_payout_date).getTime() : 0;

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------
  return (
    <>
      <div className="min-h-screen bg-neutral-50 flex">
        {/* sidebar */}
        <aside
          className={`bg-white border-r border-neutral-200 h-screen sticky top-0 flex flex-col transition-all duration-300 ${collapsed ? 'w-20' : 'w-64'}`}
        >
          <div className="p-4 flex justify-between items-center">
            {!collapsed && <p className="font-bold text-lg">Estates</p>}
            <button
              type="button"
              aria-label="toggle menu"
              className="p-2 rounded hover:bg-neutral-100"
              onClick={() => setCollapsed(!collapsed)}
            >
              <ChevronLeftIcon />
            </button>
          </div>

          <nav className="flex-1 px-2 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors
                  ${window.location.pathname.startsWith(item.path)
                    ? 'bg-amber-100 text-amber-900'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                }`}
              >
                <item.Icon />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            ))}
          </nav>
        </aside>

        {/* main */}
        <main className="flex-1 flex flex-col">
          {/* top bar */}
          <header className="bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between shrink-0">
            <div>
              <h1 className="text-xl font-semibold">Dashboard</h1>
              <p className="text-sm text-neutral-600">
                {!pLoading && nextPayout && (
                  <>
                    Next payout in&nbsp;
                    <strong>
                      {Math.max(
                        0,
                        Math.ceil((daysRemaining - today) / (24 * 60 * 60 * 1000))
                      )}{' '}
                      days – ${nextPayout.total_due_usd.toLocaleString()}
                    </strong>
                  </>
                )}
              </p>
            </div>

            <div className="flex items-center gap-4">
              {/* settings */}
              <button
                type="button"
                className="p-2 rounded-md hover:bg-neutral-100"
                title="Settings"
              >
                <SettingsIcon />
              </button>
            </div>
          </header>

          {/* content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {isLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-32 bg-neutral-200 rounded-2xl animate-pulse" />
                ))}
              </div>
            )}

            {/* KPI cards */}
            {hasData && (
              <section
                aria-labelledby="kpi-heading"
                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6"
              >
                <KpiSpark
                  label="Occupancy"
                  value={`${((kpis?.occupancy_rate ?? 0) * 100).toFixed(1)}%`}
                  sparkData={
                    kpis?.occupancy_trend_30day?.map((v: number) => ({ v })) ?? []
                  }
                />
                <KpiSpark
                  label="ADR"
                  value={`$${(kpis?.adr_usd ?? 0).toLocaleString()}`}
                  sparkData={
                    kpis?.adr_trend_30day?.map((v: number) => ({ v })) ?? []
                  }
                />
                <KpiSpark
                  label="RevPAL"
                  value={`$${(kpis?.revpal_usd ?? 0).toLocaleString()}`}
                  sparkData={
                    kpis?.revpal_trend_30day?.map((v: number) => ({ v })) ?? []
                  }
                />
                <KpiSpark
                  label="Response Time"
                  value={`${kpis?.response_time_minutes ?? 0} min`}
                  sparkData={
                    kpis?.response_trend_30day?.map((v: number) => ({ v })) ?? []
                  }
                />
              </section>
            )}

            {/* Action needed feed */}
            {hasData && (
              <section aria-labelledby="feed-heading">
                <h2 id="feed-heading" className="text-lg font-semibold mb-4 text-neutral-800">
                  Action needed
                </h2>
                <ul className="space-y-4">
                  {inquiries?.length === 0 &&
                    conflicts?.length === 0 &&
                    !iLoading && !cLoading && (
                      <li className="text-sm text-neutral-500 p-4 bg-white rounded-xl shadow-sm">
                        No pending actions right now.
                      </li>
                    )}
                  {inquiries?.map((inq) => (
                    <li
                      key={inq.id}
                      className="bg-white rounded-xl p-4 shadow-sm border border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <p className="text-sm text-neutral-700">
                        New inquiry for&nbsp;
                        <strong>{inq.villa?.title || 'villa'}</strong> from&nbsp;
                        {inq.guest?.first_name || 'Guest'}:&nbsp;"
                        {inq.message.slice(0, 80)}…"
                      </p>
                      <Link
                        to={`/host/inbox/${inq.id}`}
                        className="text-sm text-amber-600 font-medium hover:underline"
                      >
                        View
                      </Link>
                    </li>
                  ))}
                  {conflicts?.map((evt) => (
                    <li
                      key={evt.id}
                      className="bg-white rounded-xl p-4 shadow-sm border border-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <p className="text-sm text-red-700">
                        Calendar conflict:&nbsp;
                        <strong>{evt.note}</strong>
                      </p>
                      <Link
                        to="/host/calendar"
                        className="text-sm text-amber-600 font-medium hover:underline"
                      >
                        Go to Calendar
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </main>
      </div>
    </>
  );
};

export default UV_HostDashboard;