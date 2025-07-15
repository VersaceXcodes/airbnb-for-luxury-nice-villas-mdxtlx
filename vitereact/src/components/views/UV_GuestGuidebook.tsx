import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { z } from 'zod';
import { QRCodeCanvas } from 'qrcode.react';
import { guidebookSchema, type Guidebook } from '@schema';
import { useAppStore } from '@/store/main';

// ----------------------------------
// API fetchers
// ----------------------------------
const fetchBooking = async (bookingId: string) => {
  const { data } = await axios.get(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/guest/bookings/${bookingId}`, {
    withCredentials: true,
  });
  return data; // bookingSchema
};

const fetchGuidebook = async (villaId: string) => {
  const { data } = await axios.get(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/guidebooks/${villaId}`);
  return guidebookSchema.parse(data);
};

// ----------------------------------
// Helper to render POI cards
// ----------------------------------
type POI = { name: string; lat: number; lng: number; note: string };

// ----------------------------------
// Component
// ----------------------------------
const UV_GuestGuidebook: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();

  // -------- Ownership / Guidebook queries
  const {
    data: booking,
    isLoading: bookingLoading,
    error: bookingError,
  } = useQuery(['booking', bookingId], () => fetchBooking(bookingId!), { enabled: !!bookingId });

  const {
    data: guide,
    isLoading: guideLoading,
    error: guideError,
  } = useQuery(
    ['guidebook', booking?.villa_id],
    () => fetchGuidebook(booking!.villa_id),
    { enabled: !!booking?.villa_id },
  );

  //-------- Panic button visibility on night hours
  const [showPanic, setShowPanic] = React.useState(false);
  React.useEffect(() => {
    const now = new Date();
    const hours = now.getHours();
    if (hours >= 19 || hours < 8) setShowPanic(true);
  }, []);

  //-------- URL for QR
  const currentUrl = window.location.href;

  //-------- Error state
  const anyError = bookingError || guideError;
  if (anyError) {
    return (
      <>
        <div className="flex h-screen w-full items-center justify-center bg-neutral-50 dark:bg-neutral-900">
          <p className="text-neutral-700 dark:text-neutral-200">
            Not authorised to view this guidebook.
          </p>
        </div>
      </>
    );
  }

  if (bookingLoading || guideLoading) {
    return (
      <>
        <div className="flex h-screen w-full items-center justify-center bg-neutral-100 dark:bg-neutral-800">
          <p className="text-neutral-700 dark:text-neutral-200">Loading guidebook…</p>
        </div>
      </>
    );
  }

  //-------- Render
  return (
    <>
      {/* Map container */}
      <div className="sticky top-0 z-10 box-border">
        <iframe
          title="Villa & surrounding POI"
          className="h-[300px] w-full border-0"
          src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyBAAAAAAAAAAAAAAAAA&q=${
            guide?.title ?? ''
          }&center=${booking?.guest_user_id ? '0,0' : '45.4724,-121.8948'}&zoom=13`}
          allowFullScreen
        />
      </div>

      {/* Main content */}
      <div className="max-w-3xl mx-auto p-4 space-y-8">
        {/* QR code */}
        <div className="flex justify-center">
          <QRCodeCanvas value={currentUrl} size={128} />
        </div>

        {/* Content sections, auto-generated from markdown by splitting on H2 */}
        {guide?.content_md
          .split(/## (.*)\n/)
          .filter((_, i) => i % 2 === 1)
          .map((heading, idx) => {
            const body = guide.content_md.split(/## (.*)\n/)[idx * 2 + 2];
            return (
              <details
                key={idx}
                className="bg-white dark:bg-neutral-800 rounded shadow-md p-4"
              >
                <summary className="cursor-pointer text-lg font-semibold mb-2 text-neutral-800 dark:text-neutral-100">
                  {heading}
                </summary>
                <article
                  className="prose dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: body.replaceAll('\n', '<br/>'),
                  }}
                />
              </details>
            );
          })}
      </div>

      {/* Panic button appears only night hours */}
      {showPanic && (
        <div className="fixed bottom-4 right-4 z-20">
          <a
            href={`https://wa.me/${import.meta.env.VITE_WHATSAPP_NUMBER || '1234567890'}?text=Emergency%20-%20Need%20immediate%20concierge%20help.%20Booking:%20${bookingId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-2 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-red-700"
          >
            <span>24/7 Help</span>
            {/* SOS icon inline SVG */}
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 12h12M12 6v12"
              />
            </svg>
          </a>
        </div>
      )}
    </>
  );
};

export default UV_GuestGuidebook;