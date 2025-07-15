import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// Zod-less inline interface because only this view consumes it.
interface GuestProfileData {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  verified: boolean;
  passportVerified: boolean;
  reviewsAsGuestCount: number;
  completedBookingsCount: number;
  averageRating: number;
  quickNote?: string;
}

interface LastStayData {
  villaId: string;
  villaTitle: string;
  checkIn: string;
  checkOut: string;
  ratingGiven: number;
}

// Component
interface Props {
  open: boolean;
  close: () => void;
  guestId: string;
}

const UV_HostGuestProfileModal: React.FC<Props> = ({ open, close, guestId }) => {
  const authUser = useAppStore((state) => state.auth_user);
  const queryClient = useQueryClient();
  const screenSize = useAppStore((state) => state.screen_size);

  // note field
  const [noteText, setNoteText] = useState<string>('');

  const { data: guestProfile } = useQuery<GuestProfileData>({
    queryKey: ['guestProfile', guestId],
    queryFn: async () => {
      const { data } = await axios.get(`${apiBase}/users/${guestId}/profile/host_safe`, {
        headers: { Authorization: `Bearer ${useAppStore.getState().access_token}` },
      });
      setNoteText(data.quickNote ?? '');
      return data;
    },
    enabled: open && !!guestId,
    staleTime: 60_000,
  });

  const { data: lastStay } = useQuery<LastStayData | null>({
    queryKey: ['lastStay', guestId],
    queryFn: async () => {
      const { data } = await axios.get(
        `${apiBase}/users/${guestId}/last_stay`,
        { headers: { Authorization: `Bearer ${useAppStore.getState().access_token}` } },
      );
      return data || null;
    },
    enabled: open && !!guestId,
    staleTime: 60_000,
  });

  const mutationSave = useMutation({
    mutationFn: async ({ quick_note }: { quick_note: string }) => {
      await axios.patch(
        `${apiBase}/hosts/${authUser?.id}/guests/${guestId}/quick_note`,
        { quick_note },
        { headers: { Authorization: `Bearer ${useAppStore.getState().access_token}` } },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['guestProfile', guestId]);
    },
  });

  const handleNoteBlur = () => {
    if (guestProfile && noteText !== (guestProfile.quickNote ?? '')) {
      mutationSave.mutate({ quick_note: noteText });
    }
  };

  // exit early if not open
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs">
      <div
        className={`relative bg-white rounded-lg shadow-xl flex flex-col overflow-hidden
          ${screenSize === 'lg' || screenSize === 'xl' ? 'w-80' : 'w-full mx-6'}`}
      >
        {/* Header w/ close */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-base font-medium text-gray-900">Guest summary</h2>
          <button
            onClick={close}
            className="text-sm text-gray-500 hover:text-gray-900 transition"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col p-4 space-y-3 overflow-y-auto max-h-80">
          {/* Avatar row */}
          <div className="flex items-center space-x-3">
            <img
              src={guestProfile?.avatarUrl || 'https://picsum.photos/seed/avatar/64/64'}
              alt={`${guestProfile?.firstName} avatar`}
              className="h-12 w-12 rounded-full object-cover"
            />
            <div>
              <p className="font-semibold text-gray-900">
                {guestProfile ? `${guestProfile.firstName} ${guestProfile.lastName}` : '—'}
              </p>
              <div className="flex space-x-2 items-center text-xs text-gray-500">
                {guestProfile?.verified && (
                  <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded">ID verified</span>
                )}
                {guestProfile?.passportVerified && (
                  <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">Passport verified</span>
                )}
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 text-sm text-gray-700">
            <div>
              <p className="font-medium">{guestProfile?.completedBookingsCount || 0}</p>
              <p className="text-xs text-gray-500">Completed stays</p>
            </div>
            <div>
              <p className="font-medium">{guestProfile?.averageRating || '-'}/5</p>
              <p className="text-xs text-gray-500">Average rating</p>
            </div>
          </div>

          {/* Last stay quick look */}
          {lastStay && (
            <div className="text-sm">
              <p className="text-gray-700 font-medium">Most recent stay:</p>
              <p className="text-gray-600 text-xs">
                {lastStay.villaTitle} — {new Date(lastStay.checkIn).toLocaleDateString()} →{' '}
                {new Date(lastStay.checkOut).toLocaleDateString()}
                <span className="ml-2 text-yellow-500">★{lastStay.ratingGiven || '-'}</span>
              </p>
            </div>
          )}

          {/* Host note textarea */}
          <div className="pt-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Host private note
            </label>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onBlur={handleNoteBlur}
              placeholder="Quick memo to yourself…"
              rows={3}
              className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t bg-gray-50 text-center text-xs text-gray-500">
          Data refresh every minute
        </div>
      </div>
    </div>
  );
};

export default UV_HostGuestProfileModal;