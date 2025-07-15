import React, { useEffect } from 'react';
import { Link, useSearchParams, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import type { Booking, Villa } from '@schema';

// one-shot confetti type
declare global {
  interface Window {
    confetti?: (opts?: {
      particleCount?: number;
      spread?: number;
      origin?: { x: number; y: number };
    }) => void;
  }
}

interface ConfirmationPayload {
  booking: Booking;
  villa: Villa;
  total_paid: number;
  next_payment_due_at?: string;
  voucher_url: string;
  share_url: string;
}

const UV_Confirmation: React.FC = () => {
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get('id');

  const authUser = useAppStore((s) => s.auth_user);
  const pushNotification = useAppStore((s) => s.push_notification);

  const { data, isLoading, isError, error } = useQuery<ConfirmationPayload, Error>({
    queryKey: ['bookingConfirmation', bookingId],
    queryFn: async () => {
      if (!bookingId) throw new Error('Missing booking id');
      const { data } = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/bookings/${bookingId}`,
        { params: { include: 'villa,payment,lodgingCredit' } },
      );
      return data as ConfirmationPayload;
    },
    enabled: !!bookingId,
    staleTime: 1000 * 60 * 5, // 5 min
  });

  useEffect(() => {
    if (!data || typeof window === 'undefined') return;

    // https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js
    if (!window.confetti) {
      const script = document.createElement('script');
      script.src =
        'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js';
      script.async = true;
      document.head.appendChild(script);
      script.onload = () => fireConfetti();
    } else {
      fireConfetti();
    }

    function fireConfetti() {
      const key = 'confirmation_celebration';
      if (sessionStorage.getItem(key)) return;
      window.confetti?.({
        particleCount: 150,
        spread: 90,
        origin: { x: 0.5, y: 0.5 },
      });
      sessionStorage.setItem(key, '1');
    }
  }, [data]);

  if (!bookingId) return <Navigate to="/" replace />;
  if (isLoading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-lg text-zinc-700 animate-pulse">Loading confirmation…</span>
      </div>
    );
  if (isError || !data)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
        <h1 className="text-3xl font-bold mb-2">Oops!</h1>
        <p className="text-zinc-600 mb-6 max-w-sm">{error?.message || 'Could not load booking data.'}</p>
        <Link
          to="/trips"
          className="px-6 py-2 bg-zinc-800 text-white rounded-md hover:bg-zinc-900"
        >
          Back to Trips
        </Link>
      </div>
    );

  const { booking, villa, total_paid, next_payment_due_at, voucher_url, share_url } = data;

  function handleShare() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(share_url);
      pushNotification({ type: 'success', title: 'Copied', body: 'Share link copied!' });
    } else {
      pushNotification({ type: 'info', title: 'Share', body: share_url });
    }
  }

  return (
    <>
      {/* Render block (single big) */}
      <main className="min-h-screen bg-zinc-50 flex flex-col items-center py-12 px-4">
        <section className="w-full max-w-xl">
          {/* Hero image */}
          <img
            src={villa.thumbnail_url || `https://picsum.photos/seed/${villa.id}/800/450`}
            alt={villa.title}
            width={800}
            height={450}
            className="w-full h-56 sm:h-64 object-cover rounded-xl shadow-lg"
          />

          {/* Headline */}
          <div className="text-center mt-6">
            <h1 className="text-3xl font-bold text-zinc-900">
              Congratulations{authUser ? `, ${authUser.first_name}` : ''}! 🎉
            </h1>
            <p className="mt-2 text-zinc-600">
              Your booking <b>#{booking.id}</b> for <b>{villa.title}</b> is confirmed.
            </p>
          </div>

          {/* Details card */}
          <div className="mt-8 bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
            <div className="flex justify-between">
              <span className="text-zinc-500">Dates</span>
              <span className="font-semibold">
                {new Date(booking.check_in).toLocaleDateString()} –
                {' '}
                {new Date(booking.check_out).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Total Paid (USD)</span>
              <span className="font-bold text-xl">${total_paid.toLocaleString()}</span>
            </div>

            {next_payment_due_at && (
              <div className="border-t border-zinc-200 pt-3">
                <span className="text-sm text-amber-600 font-semibold">
                  Next payment: {new Date(next_payment_due_at).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          {/* CTAs */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <a
              href={voucher_url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-zinc-900 text-white text-center py-3 rounded-lg hover:bg-zinc-800"
            >
              Download Voucher
            </a>
            <button
              onClick={handleShare}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700"
            >
              Share Booking
            </button>
          </div>

          <div className="mt-8">
            <Link
              to="/trips"
              className="block w-full text-center
                bg-amber-600 text-white py-3 rounded-lg
                hover:bg-amber-700 font-semibold"
            >
              Go to Trips
            </Link>
          </div>
        </section>
      </main>
    </>
  );
};

export default UV_Confirmation;