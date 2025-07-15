import React, { useState, useEffect, ChangeEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// ---------- zod + type definitions (in-view) ----------
import { z } from 'zod';
const ticketSeverityEnum = z.enum(['low', 'medium', 'high', 'critical']);
const ticketTypeEnum = z.enum(['damage', 'overbooking', 'noise_complaint', 'other']);

interface TicketDraft {
  booking_id: string;
  ticket_type: z.infer<typeof ticketTypeEnum>;
  severity: z.infer<typeof ticketSeverityEnum>;
  subject: string;
  description: string;
  estimated_cost_usd?: number;
  photos: string[]; // Cloudinary https URLs
}

interface BookingSnapshot {
  id: string;
  villa_title: string;
  check_in: string;
  check_out: string;
  host_user_id: string;
  total_price_usd: number;
}

type CreateTicketResponse = {
  ticket_id: string;
  hold_id?: string;
};

// ---------- React Query helper factories ----------
const fetchBookingSnapshotFn = async (bookingId: string): Promise<BookingSnapshot> => {
  const { data } = await axios.get(
    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/bookings/${bookingId}?fields=id,villa_title,check_in,check_out,host_user_id,total_price_usd`,
    { withCredentials: true }
  );
  return data;
};

const getSignedUploadUrlFn = async (): Promise<{ signed_url: string; public_id: string }> => {
  const { data } = await axios.get(
    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/file_uploads/signed-url?purpose=ticket_photo`,
    { withCredentials: true }
  );
  return data;
};

const uploadToCloudinaryFn = async ({ signedUrl, file }: { signedUrl: string; file: File }) => {
  await axios.put(signedUrl, file, {
    headers: { 'Content-Type': file.type },
    withCredentials: false,
  });
};

const createTicketFn = async (payload: TicketDraft): Promise<CreateTicketResponse> => {
  // Map ticket_type to department + create extra damage report body if damage
  const postBody = {
    subject: payload.subject,
    reporter_user_id: payload.reporter_user_id,
    booking_id: payload.booking_id,
    department:
      payload.ticket_type === 'damage'
        ? 'host_support'
        : payload.ticket_type === 'overbooking'
        ? 'ops'
        : payload.ticket_type === 'noise_complaint'
        ? 'guest_support'
        : 'ops',
    priority: payload.severity as 'low' | 'high' | 'urgent',
  };

  const { data } = await axios.post(
    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/support_tickets`,
    payload.ticket_type === 'damage'
      ? { ...postBody, estimated_cost_usd: payload.estimated_cost_usd, photos: payload.photos }
      : { ...postBody, photos: payload.photos },
    { withCredentials: true }
  );
  return data;
};

// ---------- Main component ----------
const UV_HostSupportTicket: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const authUser = useAppStore((s) => s.auth_user);

  // Local state
  const [ticketDraft, setTicketDraft] = useState<TicketDraft>({
    booking_id: bookingId || '',
    ticket_type: 'damage',
    severity: 'medium',
    subject: '',
    description: '',
    estimated_cost_usd: undefined,
    photos: [],
  });
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // ---------- queries & mutations ----------
  const {
    data: bookingSnapshot,
    isLoading: loadingBooking,
    error: bookingError,
  } = useQuery<BookingSnapshot, Error>({
    queryKey: ['booking_context', bookingId],
    queryFn: () => fetchBookingSnapshotFn(bookingId!),
    enabled: !!bookingId,
  });

  const mutationCreateTicket = useMutation<CreateTicketResponse, Error, TicketDraft>({
    mutationFn: createTicketFn,
    onSuccess: (res) => {
      setCreatedTicketId(res.ticket_id);
      queryClient.invalidateQueries({ queryKey: ['booking_context'] });
    },
  });

  // ---------- event handlers ----------
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (ticketDraft.photos.length + files.length > 3) {
      setUploadError('Max 3 photos');
      return;
    }
    setUploadError('');
    setIsUploading(true);
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        setUploadError('Each file ≤5 MB');
        setIsUploading(false);
        return;
      }
      try {
        const { signed_url } = await getSignedUploadUrlFn();
        await uploadToCloudinaryFn({ signedUrl: signed_url, file });
        const url = signed_url.split('?')[0]; // cloudinary URL
        setTicketDraft((prev) => ({ ...prev, photos: [...prev.photos, url] }));
      } catch (err) {
        setUploadError('Upload failed');
      }
    }
    setIsUploading(false);
  };

  const handleSubmit = () => {
    if (!ticketDraft.subject.trim() || !ticketDraft.description.trim()) {
      alert('Subject & description required');
      return;
    }
    mutationCreateTicket.mutate({ ...ticketDraft, reporter_user_id: authUser!.id });
  };

  if (!bookingId) return <>Missing booking ID</>;

  if (bookingError) {
    return (
      <>Error loading booking: {(bookingError as any)?.response?.data?.error || 'Unknown error'}</>
    );
  }

  if (loadingBooking) {
    return <>Loading…</>;
  }

  if (createdTicketId) {
    return (
      <>
        <section className="max-w-2xl mx-auto p-6 mt-10">
          <h2 className="text-xl font-bold text-green-700 mb-2">Ticket #{createdTicketId} created</h2>
          <p className="mb-4">
            Our concierge team has been notified. We’ll follow-up within 24 hours.
          </p>
          <button
            className="bg-indigo-600 text-white px-4 py-2 rounded-md"
            onClick={() => navigate('/host/dashboard')}
          >
            Return to dashboard
          </button>
        </section>
      </>
    );
  }

  return (
    <>
      <main className="max-w-4xl mx-auto p-4 md:p-6 lg:p-8">
        <h1 className="text-2xl font-bold mb-4">Raise Support Ticket</h1>

        {bookingSnapshot && (
          <div className="border border-gray-200 rounded-lg p-4 mb-6 bg-gray-50">
            <p className="font-semibold">{bookingSnapshot.villa_title}</p>
            <p className="text-sm text-gray-600">
              {bookingSnapshot.check_in} ➡ {bookingSnapshot.check_out}
            </p>
            <p className="text-sm text-gray-600">Total: ${bookingSnapshot.total_price_usd}</p>
          </div>
        )}

        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          {/* Ticket type */}
          <div>
            <label className="block text-sm font-medium mb-1">Issue Type</label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              value={ticketDraft.ticket_type}
              onChange={(e) =>
                setTicketDraft((prev) => ({ ...prev, ticket_type: e.target.value as any }))
              }
            >
              <option value="damage">Damage</option>
              <option value="overbooking">Overbooking</option>
              <option value="noise_complaint">Noise Complaint</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Severity */}
          <div>
            <label className="block text-sm font-medium mb-1">Severity</label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              value={ticketDraft.severity}
              onChange={(e) =>
                setTicketDraft((prev) => ({ ...prev, severity: e.target.value as any }))
              }
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          {/* Damage only : cost */}
          {ticketDraft.ticket_type === 'damage' && (
            <div>
              <label className="block text-sm font-medium mb-1">Estimated Repair Cost (USD)</label>
              <input
                type="number"
                min="0"
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="e.g. 500"
                value={ticketDraft.estimated_cost_usd || ''}
                onChange={(e) =>
                  setTicketDraft((prev) => ({ ...prev, estimated_cost_usd: Number(e.target.value) || undefined }))
                }
              />
            </div>
          )}

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium mb-1">Subject</label>
            <input
              type="text"
              maxLength={255}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Short title"
              value={ticketDraft.subject}
              onChange={(e) => setTicketDraft((prev) => ({ ...prev, subject: e.target.value }))}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              rows={4}
              maxLength={2000}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Provide as much detail as possible…"
              value={ticketDraft.description}
              onChange={(e) => setTicketDraft((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>

          {/* Photo upload */}
          <div>
            <label className="block text-sm font-medium mb-1">Photos (max 3)</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={ticketDraft.photos.length >= 3 || isUploading}
              onChange={handleFileChange}
            />
            {uploadError && <p className="text-red-600 text-sm mt-1">{uploadError}</p>}
            {ticketDraft.photos.length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {ticketDraft.photos.map((url, idx) => (
                  <img
                    key={idx}
                    src={url}
                    alt="evidence"
                    className="h-24 w-full object-cover rounded-md border"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={mutationCreateTicket.isPending || !ticketDraft.subject || !ticketDraft.description}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-4 py-2 rounded-md"
          >
            {mutationCreateTicket.isPending ? 'Submitting…' : 'Submit & Escalate'}
          </button>
        </form>
      </main>
    </>
  );
};

export default UV_HostSupportTicket;