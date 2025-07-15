// src/components/views/UV_GuestTripsDashboard.tsx
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { Booking } from '@schema';

type Tab = 'upcoming' | 'past';
interface LoyaltyBalance {
  amount_usd: number;
}

const UV_GuestTripsDashboard: React.FC = () => {
  const [active_tab, set_active_tab] = useState<Tab>('upcoming');
  const [show_mobile_fab, set_show_mobile_fab] = useState(false);
  const [selected_booking_id, set_selected_booking_id] = useState<string | null>(null);

  const auth_user = useAppStore((state) => state.auth_user);

  // bookings
  const { data: bookings = [], isLoading, isError } = useQuery<Booking[], Error>(
    ['guest-bookings', auth_user?.id],
    async () => {
      const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/guest/bookings`, {
        params: { guest_user_id: auth_user?.id, limit: 100, sort_by: 'check_in', sort_order: 'desc' },
      });
      return res.data;
    },
    { enabled: !!auth_user?.id }
  );

  // loyalty
  const { data: loyalty } = useQuery<LoyaltyBalance | null, Error>(
    ['loyalty-credits', auth_user?.id],
    async () => {
      const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/loyalty_credits/balance`, {
        params: { guest_user_id: auth_user?.id },
      });
      return res.data;
    },
    { enabled: !!auth_user?.id }
  );

  const now = new Date();
  const upcoming = useMemo(
    () => bookings.filter((b) => new Date(b.check_out) > now),
    [bookings]
  );
  const past = useMemo(
    () => bookings.filter((b) => new Date(b.check_out) <= now),
    [bookings]
  );
  const current_list = active_tab === 'upcoming' ? upcoming : past;

  // incomplete tasks red banner
  const pending_tasks_count = useMemo(() => {
    return bookings.filter(
      (b) =>
        new Date(b.check_in) > now &&
        (b.status === 'in_progress' || !b.contract_signed_at || b.balance_usd > 0)
    ).length;
  }, [bookings]);

  return (
    <>
      {/* Loyalty chip */}
      <div className="relative max-w-7xl mx-auto px-4 py-4">
        <div className="flex justify-end">
          {loyalty && loyalty.amount_usd > 0 && (
            <Link
              to="/profile"
              className="flex items-center gap-2 rounded-lg bg-amber-100 border border-amber-300 px-3 py-1 text-sm font-semibold text-amber-800 no-underline"
            >
              💳 ${loyalty.amount_usd.toLocaleString()} credit
            </Link>
          )}
        </div>
      </div>

      {/* Page shell */}
      <div className="max-w-7xl mx-auto px-4 pb-32">
        <h1 className="text-3xl font-bold mb-4">My Trips</h1>

        {pending_tasks_count > 0 && (
          <div className="mb-4 bg-red-50 border border-red-300 rounded-md p-3 text-red-800">
            🚨 You have {pending_tasks_count} booking{pending_tasks_count > 1 ? 's' : ''} requiring attention
            – ID, contract or balance still pending.
          </div>
        )}

        {/* Tabs */}
        <div className="mb-4 border-b">
          <nav className="-mb-px flex gap-x-8">
            {(['upcoming', 'past'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => set_active_tab(tab)}
                className={`capitalize py-2 border-b-2 font-semibold text-sm ${
                  active_tab === tab
                    ? 'border-amber-500 text-amber-600'
                    : 'border-transparent text-slate-600 hover:text-slate-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* List */}
        {isLoading && <div className="animate-pulse space-y-4"><div className="h-40 bg-slate-200 rounded" /></div>}
        {isError && (
          <p className="text-center text-red-600">Failed to load trips. Please refresh.</p>
        )}
        {!isLoading && !isError && current_list.length === 0 && (
          <div className="text-center py-8">
            <p className="text-slate-500 mb-4">
              {active_tab === 'upcoming' ? 'No upcoming trips' : 'No past trips'}
            </p>
            <Link
              to="/search"
              className="btn bg-amber-600 text-white px-4 py-2 rounded-md text-sm hover:bg-amber-700"
            >
              Browse villas
            </Link>
          </div>
        )}
        <div className="grid gap-6">
          {current_list.map((booking) => {
            const check_in = new Date(booking.check_in);
            const check_out = new Date(booking.check_out);
            const count_down =
              active_tab === 'upcoming'
                ? Math.max(0, Math.ceil((check_in.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
                : 0;
            return (
              <div
                key={booking.id}
                className="bg-white rounded-xl shadow-md overflow-hidden md:flex"
              >
                <div
                  className="w-full md:w-72 h-36 md:h-44 bg-cover bg-center"
                  style={{ backgroundImage: `url(https://picsum.photos/seed/${booking.villa_id}/400/300)` }}
                />
                <div className="p-4 flex-1">
                  <div className="flex justify-between items-start">
                    <span className={`inline-block px-2 py-1 text-xs font-bold rounded-full ${
                      booking.status === 'confirmed'
                        ? 'bg-green-100 text-green-800'
                        : booking.status === 'cancelled'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {booking.status}
                    </span>
                    <div className="relative">
                      <button
                        onClick={() => set_selected_booking_id(selected_booking_id === booking.id ? null : booking.id)}
                        className="text-slate-400 hover:text-slate-800"
                      >
                        ⋯
                      </button>
                      {selected_booking_id === booking.id && (
                        <div className="absolute top-8 right-0 w-44 bg-white rounded shadow-lg z-10 text-sm">
                          <Link
                            to={`/checkout/${booking.villa_id}?edit=true&bookingId=${booking.id}`}
                            className="block px-4 py-2 hover:bg-slate-100"
                            onClick={() => set_selected_booking_id(null)}
                          >
                            Change Dates / Guests
                          </Link>
                          <button
                            onClick={() => {
                              window.open(
                                `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/bookings/${booking.id}/voucher`,
                                '_blank'
                              );
                              set_selected_booking_id(null);
                            }}
                            className="block w-full text-left px-4 py-2 hover:bg-slate-100"
                          >
                            Download Voucher
                          </button>
                          <button
                            onClick={() => {
                              alert('Messaging drawer stub – click OK to acknowledge.');
                              set_selected_booking_id(null);
                            }}
                            className="block w-full text-left px-4 py-2 hover:bg-slate-100"
                          >
                            Message Host
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-lg font-semibold text-slate-800">{booking.id.replace('bk_', '#')}</p>
                  <p className="text-sm text-slate-600">
                    From {check_in.toLocaleDateString()} to {check_out.toLocaleDateString()}
                  </p>
                  {active_tab === 'upcoming' && count_down > 0 && (
                    <p className="text-sm font-medium text-amber-600">
                      {count_down} day{count_down !== 1 ? 's' : ''} to go
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-500">
                    Total ${booking.total_usd.toLocaleString()}
                    {booking.balance_usd > 0 && ` – ${booking.balance_usd.toLocaleString()} due`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile FAB only */}
      {window.innerWidth < 768 && (
        <>
          {/* Scroll listener emulation */}
          <style>
            {`
              document.addEventListener('scroll',()=>{
                const bottom = window.scrollY + window.innerHeight >= document.body.scrollHeight - 100;
                set_show_mobile_fab(window.scrollY >= 400 && !bottom);
              });
            `}
          </style>
        </>
      )}
    </>
  );
};

export default UV_GuestTripsDashboard;