import React, { useEffect, useRef } from 'react';
import { Link, useSearchParams, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { BookingStatusEnum } from '@schema';

const api_base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// useful types matching schema
interface ThreadEntry {
  bookingId: string;
  villaId: string;
  villaTitle: string;
  checkIn: string;
  checkOut: string;
  guestAvatarUrl?: string;
  guestName: string;
  lastMessageSnippet: string;
  lastTs: string;
  unreadCount: number;
  status: 'inquiry' | 'confirmed' | 'cancelled' | 'completed';
}
interface MessageEntry {
  id: string;
  senderRole: 'guest' | 'host';
  senderName: string;
  body: string;
  sentAt: string;
  readAt?: string;
  type: 'text' | 'file' | 'template';
  templateId?: string;
}

const TABS = ['inquiries', 'upcoming', 'past', 'support'] as const;

const UV_HostInbox: React.FC = () => {
  const [search, setSearch] = useSearchParams();
  const qTab = (search.get('tab') || 'inquiries') as (typeof TABS)[number];
  const qBookingId = search.get('bookingId') || search.get('threadId') || null;

  const user = useAppStore((s) => s.auth_user);
  const showToast = useAppStore((s) => s.push_notification);
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const setSelectedBookingId = (id: string | null) => {
    const newSearch = new URLSearchParams(search);
    if (id) newSearch.set('bookingId', id);
    else newSearch.delete('bookingId');
    setSearch(newSearch, { replace: true });
  };

  const tabToBookingFilter = (): string[] => {
    switch (qTab) {
      case 'inquiries':
        return ['inquiry'];
      case 'upcoming':
        return ['confirmed'];
      case 'past':
        return ['cancelled', 'completed'];
      case 'support':
      default:
        return [];
    }
  };

  // ------------- THREAD list query -------------
  const threadsQ = useQuery<ThreadEntry[], Error>({
    queryKey: ['host_threads', qTab, user?.id],
    async queryFn() {
      const filter = tabToBookingFilter();
      const res = await axios.get<ThreadEntry[]>(`${api_base}/bookings`, {
        params: { host_user_id: user?.id, ...(filter.length && { status: filter.join(',') }) },
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      return res.data;
    },
    enabled: !!user?.id,
  });

  // ------------- MESSAGES query -------------
  const messagesQ = useInfiniteQuery<MessageEntry[], Error>({
    queryKey: ['messages', qBookingId],
    async queryFn({ pageParam = 0 }) {
      const res = await axios.get<MessageEntry[]>(`${api_base}/bookings/${qBookingId}/messages`, {
        params: { limit: 50, offset: pageParam },
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      return res.data;
    },
    getNextPageParam: (_, pages) => pages.length * 50,
    enabled: !!qBookingId && !!user?.id,
  });

  // ------------- SEND message mutation -------------
  const mutation = useMutation<MessageEntry, Error, { body: string }>({
    async mutationFn({ body }) {
      const res = await axios.post<MessageEntry>(`${api_base}/messages`, {
        bookingId: qBookingId,
        body,
      }, { headers: { Authorization: `Bearer ${localStorage.getItem('token') || '' } }});
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', qBookingId] });
      setTimeout(() => scrollRef.current?.scrollTo?.({ top: 99999 }), 100);
    },
    onError: () => showToast({ type: 'error', title: 'Send failed', body: 'Could not deliver message.' }),
  });

  useEffect(() => {
    if (scrollRef.current && messagesQ.data)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [qBookingId, messagesQ.isSuccess]);

  // ------------- desktop breakpoint -------------
  const screenSize = useAppStore((s) => s.screen_size);
  const isMobile = screenSize === 'xs' || screenSize === 'sm';

  // ------------- compose state -------------
  const [composeText, setComposeText] = React.useState('');
  const handleSend = () => {
    if (!composeText.trim()) return;
    mutation.mutate({ body: composeText });
    setComposeText('');
  };

  return (
    <>
      <div className="min-h-screen flex flex-col bg-neutral-50">
        {/* HEADER */}
        <header className="bg-white shadow-sm px-4 py-2 border-b border-neutral-200 flex items-center">
          <span className="text-xl font-semibold">Host Inbox</span>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* THREAD LIST (desktop 320px or hidden on mobile when thread open) */}
          <aside
            className={`bg-white border-r border-neutral-200 overflow-y-auto transition-all ${isMobile && qBookingId ? 'hidden' : 'block'
              } ${!isMobile ? 'w-80 flex-shrink-0' : 'w-full'}`}
          >
            {/* tabs row */}
            <nav className="flex text-sm border-b border-neutral-200">
              {TABS.map((tab) => (
                <Link
                  key={tab}
                  to={`/host/inbox?tab=${tab}`}
                  className={`flex-1 py-2 text-center capitalize ${tab === qTab ? 'bg-blue-50 border-b-2 border-blue-600 text-blue-700' : 'text-neutral-600 hover:bg-neutral-100'}`}
                >
                  {tab}
                </Link>
              ))}
            </nav>

            {threadsQ.isLoading && <div className="p-4 text-center">Loading threads…</div>}
            {threadsQ.data?.length === 0 && (
              <div className="p-4 text-center text-sm text-neutral-500">No threads</div>
            )}
            {(threadsQ.data || []).map((t) => (
              <button
                key={t.bookingId}
                onClick={() => setSelectedBookingId(t.bookingId)}
                className={`w-full p-3 flex items-start space-x-3 border-b border-neutral-100 ${t.bookingId === qBookingId ? 'bg-blue-50' : 'hover:bg-neutral-50'}`}
              >
                <img
                  src={t.guestAvatarUrl || `https://picsum.photos/seed/${t.guestName}/40`}
                  alt={t.guestName}
                  className="w-10 h-10 rounded-full"
                />
                <div className="flex-1 text-left">
                  <p className="font-semibold text-sm">{t.guestName}</p>
                  <p className="text-xs text-neutral-600 truncate">{t.villaTitle}</p>
                  <p className="text-xs text-neutral-500 truncate max-w-[200px]">{t.lastMessageSnippet}</p>
                </div>
                <div className="text-right text-xs text-neutral-400">
                  <p>{new Date(t.lastTs).toLocaleDateString()}</p>
                  {t.unreadCount > 0 && (
                    <span className="inline-block bg-red-600 text-white rounded-full px-2 py-0.5">
                      {t.unreadCount}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </aside>

          {/* MESSAGES PANE */} 
          <section
            className={`flex-1 flex flex-col bg-neutral-50 overflow-hidden ${isMobile && !qBookingId ? 'hidden' : 'block'}`}
          >
            {!qBookingId ? (
              <div className="flex-1 flex items-center justify-center text-neutral-400">
                <div className="text-center">
                  <p className="mb-2">Select a thread to open messages</p>
                  <Link
                    to="/host/inbox?tab=inquiries"
                    className="text-blue-600 underline"
                  >
                    Browse inquiry threads
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {/* THREAD HEADER */}
                <div className="bg-white border-b border-neutral-200 px-4 py-3 flex items-center space-x-3">
                  {isMobile && (
                    <button
                      onClick={() => setSelectedBookingId(null)}
                      className="text-blue-600 text-xl"
                    >
                      ←
                    </button>
                  )}
                  <img
                    src={`https://picsum.photos/seed/${qBookingId}/32`}
                    className="w-8 h-8 rounded-full"
                    alt="booking"
                  />
                  <div>
                    <p className="font-semibold">
                      {threadsQ.data?.find((t) => t.bookingId === qBookingId)?.guestName}
                    </p>
                    <p className="text-sm text-neutral-500">
                      {threadsQ.data?.find((t) => t.bookingId === qBookingId)?.villaTitle}
                    </p>
                  </div>
                </div>

                {/* MESSAGES SCROLL */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messagesQ.isLoading && <p className="text-sm text-neutral-500">Messages loading…</p>}
                  {messagesQ.data?.pages
                    .flat()
                    .map((msg) => (
                      <div
                        key={msg.id}
                        className={`max-w-[70%] ${msg.senderRole === 'host' ? 'ml-auto text-right' : ''}`}
                      >
                        <div
                          className={`inline-block px-3 py-2 rounded-lg text-sm ${msg.senderRole === 'host' ? 'bg-blue-600 text-white' : 'bg-white shadow'}`}
                        >
                          {msg.body}
                        </div>
                        <p className="text-xs text-neutral-400 mt-1">{new Date(msg.sentAt).toLocaleTimeString()}</p>
                      </div>
                    ))}
                </div>

                {/* COMPOSE */}
                <div className="bg-white border-t border-neutral-200 p-3 flex items-end space-x-2">
                  <textarea
                    ref={inputRef}
                    value={composeText}
                    onChange={(e) => setComposeText(e.target.value)}
                    placeholder="Type your message…"
                    rows={1}
                    className="flex-1 resize-none rounded-md p-2 text-sm focus:ring-1 focus:ring-blue-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        handleSend();
                      }
                    }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!composeText.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
};

export default UV_HostInbox;