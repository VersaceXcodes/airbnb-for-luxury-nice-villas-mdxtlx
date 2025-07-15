import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { Heart, Share, ChevronDown } from 'lucide-react';
import { z } from 'zod';

// --- INFERRED TYPES from Zod ---
type VillaTiny = {
  id: string;
  slug: string;
  title: string;
  thumbnail_url: string;
  price_usd_per_night: number;
};
type WishlistItem = {
  villa: VillaTiny;
  added_at: string;
};

// --- API UTILITIES ---
const apiUrl = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}`;

// main component
const UV_GuestWishlist: React.FC = () => {
  const auth = useAppStore((s) => s.auth_user);
  const pushNotification = useAppStore((s) => s.push_notification);
  const qc = useQueryClient();

  // ------------ Query: get Singleton Wishlist ------------
  const { data: wishlistData } = useQuery({
    queryKey: ['guestWishlist', auth?.id],
    queryFn: async () => {
      const { data } = await axios.get(`${apiUrl}/guest/wishlists?limit=1`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token') ?? ''}` },
      });
      return data[0] ?? null; // Backend returns array; we want first
    },
    enabled: !!auth?.id,
  });

  const wishlistId = wishlistData?.id;

  // ------------ Query: Items ------------
  const { data: items = [] } = useQuery<WishlistItem[]>({
    queryKey: ['wishlistItems', wishlistId],
    queryFn: async () => {
      const { data } = await axios.get(`${apiUrl}/guest/wishlists/${wishlistId}/items`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token') ?? ''}` },
      });
      return data.items;
    },
    enabled: !!wishlistId,
  });

  // ------------ Mutation: Remove ------------
  const removeMutation = useMutation({
    mutationFn: async (villa_id: string) =>
      axios.delete(`${apiUrl}/guest/wishlists/${wishlistId}/items/${villa_id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token') ?? ''}` },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wishlistItems', wishlistId] }),
  });

  // ------------ Mutation / Share -------------
  const generateShareUrl = () => {
    if (!wishlistId) {
      return '';
    }
    // mock share URL - back-end returns share slug; frontend constructs full
    return `${window.location.origin}/wishlist/${wishlistId}`;
  };

  const handleShare = () => {
    const url = generateShareUrl();
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      pushNotification({ type: 'success', title: 'Share link copied' });
      // Snowplow event
      if ('snowplow' in window) {
        (window as any).snowplow('trackSelfDescribingEvent', {
          schema: 'iglu:com.estates/wishlist-share/jsonschema/1-0-0',
          data: { wishlist_id: wishlistId },
        });
      }
    });
  };

  // ------------ Filter state -------------
  const [filter, setFilter] = React.useState<'recent' | 'price'>('recent');
  const sortedItems = React.useMemo(() => {
    if (!items.length) return [];
    return [...items].sort(
      (a, b) =>
        filter === 'recent'
          ? new Date(b.added_at).getTime() - new Date(a.added_at).getTime()
          : a.villa.price_usd_per_night - b.villa.price_usd_per_night,
    );
  }, [items, filter]);

  // ------------ Empty State ------------
  if (auth == null) return null; // handled route guard
  if (!items.length)
    return (
      <>
        <div className="mt-12 flex flex-col items-center justify-center px-4">
          <svg
            viewBox="0 0 200 200"
            className="h-48 w-48 text-slate-300"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M100 50a30 30 0 1 0 0 60a30 30 0 1 0 0-60z" />
            <path d="M120 80l20 40l-80 0l20-40a20 20 0 0 1 40 0z" />
            <path d="M70 100l-20 30l-30-50l40 0z" />
            <path d="M130 100l20 30l30-50l-40 0z" />
          </svg>
          <h2 className="mt-6 text-xl font-semibold text-slate-700">
            Start curating your next escape
          </h2>
          <Link
            to="/search"
            className="mt-4 rounded-lg bg-sand-600 px-4 py-2 text-white hover:bg-sand-700"
          >
            Discover Villas
          </Link>
        </div>
      </>
    );

  return (
    <>
      {/* Header with title, share & filter */}
      <header className="flex items-center justify-between p-4 md:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">My Wishlist</h1>
        <div className="flex items-center space-x-4">
          {/* Filter */}
          <div className="relative">
            <select
              className="appearance-none rounded-md border border-slate-300 bg-white py-2 pl-3 pr-8 text-sm font-medium hover:border-slate-400"
              value={filter}
              onChange={(e) => setFilter(e.target.value as 'recent' | 'price')}
            >
              <option value="recent">Recently Added</option>
              <option value="price">Price ↓</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2" />
          </div>
          {/* Share */}
          <button
            onClick={handleShare}
            className="flex items-center space-x-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
          >
            <Share className="h-4 w-4" />
            <span>Share</span>
          </button>
        </div>
      </header>

      {/* Masonry grid */}
      <section className="grid grid-cols-1 gap-4 px-4 py-2 sm:grid-cols-2 md:gap-6 lg:grid-cols-2 2xl:grid-cols-3">
        {sortedItems.map(({ villa }) => (
          <div className="group relative" key={villa.id}>
            <Link to={`/villas/${villa.slug}-${villa.id}`} className="block">
              <img
                className="aspect-video w-full rounded-xl object-cover shadow-sm transition group-hover:shadow-lg"
                src={villa.thumbnail_url || `https://picsum.photos/seed/${villa.id}/420/240`}
                alt={villa.title}
              />
            </Link>
            <button
              className="absolute top-2 right-2 rounded-full bg-slate-50/80 p-1.5 backdrop-blur-sm transition hover:bg-slate-100"
              aria-label="Remove from wishlist"
              onClick={() => removeMutation.mutate(villa.id)}
            >
              <Heart className="h-5 w-5 fill-rose-600 text-rose-600" />
            </button>
            <div className="mt-2 px-1">
              <h3 className="truncate font-semibold text-slate-800">{villa.title}</h3>
              <p className="text-sm text-slate-600">${villa.price_usd_per_night} / night</p>
            </div>
          </div>
        ))}
      </section>
    </>
  );
};

export default UV_GuestWishlist;