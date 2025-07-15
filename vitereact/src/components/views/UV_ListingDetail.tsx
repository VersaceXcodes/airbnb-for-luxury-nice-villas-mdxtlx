import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { z } from 'zod';
import { villaSchema, CalendarEvent, guestReviewSchema } from '@schema';

// derive internal types
type Villa = z.infer<typeof villaSchema>;
type Review = z.infer<typeof guestReviewSchema>;

const UV_ListingDetail: React.FC = () => {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const [searchParams] = useSearchParams();
  const authUser = useAppStore((state) => state.auth_user);
  const screenSize = useAppStore((state) => state.screen_size);
  const pushNotification = useAppStore((state) => state.push_notification);

  // local client states
  const [selectedCheckIn, setSelectedCheckIn] = useState<string | null>(searchParams.get('start_date'));
  const [selectedCheckOut, setSelectedCheckOut] = useState<string | null>(searchParams.get('end_date'));
  const [selectedGuests, setSelectedGuests] = useState<number>(Number(searchParams.get('guests') || 2));
  const [conciergeAddons, setConciergeAddons] = useState<Array<{ id: string; name: string; price: number; per_guest: boolean }>>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [reviewPage, setReviewPage] = useState<number>(1);

  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  // --- react-query hooks for server state ---
  const { data: villa, isLoading: villaLoading, error: villaError } = useQuery<Villa, Error>({
    queryKey: ['villa', id, selectedCheckIn, selectedCheckOut],
    queryFn: async () => {
      const res = await axios.get(`${apiBase}/villas/${id}`, {
        params: { start: selectedCheckIn, end: selectedCheckOut },
      });
      return villaSchema.parse(res.data);
    },
    enabled: !!id,
  });

  const { data: reviews } = useQuery<Review[], Error>({
    queryKey: ['reviews', id, reviewPage],
    queryFn: async () => {
      const res = await axios.get(`${apiBase}/villas/${id}/reviews`);
      return z.array(guestReviewSchema).parse(res.data);
    },
    enabled: !!id,
  });

  const { data: wishlistStatus } = useQuery<boolean, Error>({
    queryKey: ['wishlistStatus', id, authUser?.id],
    queryFn: async () => {
      const res = await axios.get(`${apiBase}/guest/wishlist_status/${id}`, {
        headers: { Authorization: `Bearer ${authUser?.id}` }, // real token stored elsewhere
      });
      return z.boolean().parse(res.data.inWishlist);
    },
    enabled: !!authUser && !!id,
  });

  const photoGrid = useMemo(() => {
    if (!villa) return [];
    const spots = [
      `https://picsum.photos/seed/${id}/2048/1170`,
      `https://picsum.photos/seed/${id}-1/1366/768`,
      `https://picsum.photos/seed/${id}-2/1366/768`,
    ];
    return spots;
  }, [villa, id]);

  const averageNightly = useMemo(() => {
    if (!villa) return 0;
    return villa.base_price_usd_per_night;
  }, [villa]);

  const totalEstimate = useMemo(() => {
    if (!selectedCheckIn || !selectedCheckOut) return 0;
    const nights = (new Date(selectedCheckOut).getTime() - new Date(selectedCheckIn).getTime()) / 86400000;
    let baseCost = nights * averageNightly;
    conciergeAddons.forEach(({ price, per_guest }) => {
      baseCost += per_guest ? price * selectedGuests : price;
    });
    return baseCost;
  }, [averageNightly, selectedCheckIn, selectedCheckOut, selectedGuests, conciergeAddons]);

  const toggleWishlist = async () => {
    if (!authUser) {
      pushNotification({ type: 'info', title: 'Please sign in', body: 'Create an account to save favorites' });
      return;
    }
    try {
      await axios.post(
        `${apiBase}/guest/wishlist_items`,
        { villa_id: id },
        { headers: { Authorization: `Bearer ${authUser?.id}` } }
      );
      pushNotification({ type: 'success', title: 'Updated', body: 'Your favorites list was updated' });
    } catch (err) {
      pushNotification({ type: 'error', title: 'Error', body: 'Could not update wishlist' });
    }
  };

  useEffect(() => {
    const handle = () => {
      const hero = document.getElementById('hero');
      if (!hero) return;
      const rect = hero.getBoundingClientRect();
      if (rect.bottom < 20) {
        document.body.classList.add('pb-16');
      } else {
        document.body.classList.remove('pb-16');
      }
    };
    window.addEventListener('scroll', handle);
    return () => window.removeEventListener('scroll', handle);
  }, []);

  if (villaLoading) {
    return (
      <>
        <div className="animate-pulse">
          <div className="w-full h-[60vh] bg-slate-200" />
          <div className="p-8 space-y-4">
            <div className="h-8 bg-slate-200 rounded w-2/5" />
            <div className="h-4 bg-slate-200 rounded w-3/5" />
          </div>
        </div>
      </>
    );
  }

  if (villaError) {
    return (
      <>
        <div className="text-center p-20">
          <h1 className="text-3xl font-bold text-red-600">Villa not found or unavailable</h1>
          <Link to="/search" className="text-blue-500 underline mt-4 inline-block">Back to search</Link>
        </div>
      </>
    );
  }

  if (!villa) return null;

  // amenity overlay list
  const amenityKeys = ['pool', 'chef_kitchen', 'gym', 'cinema', 'concierge_24_7', 'pet_friendly', 'staff_quarters'];
  const amenityMap = [
    { key: 'pool', icon: '🏊', name: 'Private Pool' },
    { key: 'chef_kitchen', icon: '🍳', name: 'Chef Kitchen' },
    { key: 'gym', icon: '🏋️', name: 'Gym' },
    { key: 'cinema', icon: '🎬', name: 'Cinema Room' },
    { key: 'concierge_24_7', icon: '🛟', name: '24/7 Concierge' },
    { key: 'pet_friendly', icon: '🐾', name: 'Pet Friendly' },
    { key: 'staff_quarters', icon: '🛌', name: 'Staff Quarters' },
  ];

  const guestAddons = [
    { id: 'chef', name: 'Private Chef', price: 250, per_guest: false },
    { id: 'yacht', name: 'Yacht Charter (Daily)', price: 1800, per_guest: false },
    { id: 'massage', name: 'In-Villa Massage', price: 150, per_guest: true },
  ];

  return (
    <>
      {/* HERO FULL-SCREEN */}
      <section id="hero" className="relative h-screen w-full">
        <img src={photoGrid[0]} alt="Villa front" className="h-full w-full object-cover" />
        <div className="absolute top-4 right-4 z-10 flex gap-4">
          <button
            onClick={toggleWishlist}
            className="bg-black/30 text-white rounded-full p-3 hover:bg-black/50"
          >
            {wishlistStatus ? '❤️' : '🤍'}
          </button>
        </div>
      </section>

      {/* Sticky pricing bar mobile */}
      {screenSize === 'xs' || screenSize === 'sm' ? (
        <div className="sticky bottom-0 z-20 bg-white border-t px-4 py-3 shadow-t">
          <div className="flex justify-between items-center">
            <div>
              <div className="font-bold text-lg">≈ ${totalEstimate}</div>
              <div className="text-sm text-gray-500">for {selectedCheckIn ? `${Math.max(1, (new Date(selectedCheckOut || 0).getTime() - new Date(selectedCheckIn).getTime()) / 86400000)} nights` : 'select dates'}</div>
            </div>
            <Link
              to={`/checkout/${slug}-${id}?start_date=${selectedCheckIn}&end_date=${selectedCheckOut}&guests=${selectedGuests}`}
              className="bg-blue-600 text-white px-6 py-3 rounded-md font-bold"
            >
              Request to Book
            </Link>
          </div>
        </div>
      ) : null}

      {/* Main layout */}
      <main className="max-w-7xl mx-auto p-4 md:p-8 grid md:grid-cols-3 gap-8">
        {/* Left pane */}
        <div className="md:col-span-2 space-y-8">
          <div>
            <h1 className="text-4xl font-bold">{villa.title}</h1>
            <p className="text-gray-600">{villa.location_data.address}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center border-t border-b py-4">
            <div>
              <div className="text-2xl font-bold">{villa.max_guests}</div>
              <div className="text-sm text-gray-500">Guests</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{villa.bedrooms_total}</div>
              <div className="text-sm text-gray-500">Bedrooms</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{villa.bathrooms_total}</div>
              <div className="text-sm text-gray-500">Bathrooms</div>
            </div>
            <div>
              <div className="text-2xl">{villa.max_pets ? villa.max_pets : '—'}</div>
              <div className="text-sm text-gray-500">Pets</div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">About this villa</h2>
            <p className="line-clamp-3 hover:line-clamp-none transition">{villa.description}</p>
          </div>

          {/* Amenities */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Amenities</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {amenityMap.map((a) => (
                <div key={a.key} className="flex gap-2 items-center">
                  <span className="text-xl">{a.icon}</span>
                  <span>{a.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Visual gallery */}
          <div>
            <h2 className="text-2xl font-bold mb-4">Photo Gallery</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {photoGrid.map((img, idx) => (
                <img
                  key={idx}
                  src={img}
                  alt="villa gallery"
                  className="w-full h-40 object-cover rounded cursor-pointer"
                  onClick={() => setLightboxIndex(idx)}
                />
              ))}
            </div>
          </div>

          {/* Reviews */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Guest reviews</h2>
            {reviews?.map((r) => (
              <div key={r.id} className="border-b py-4">
                <p className="font-bold capitalize">{r.guest_user_id.slice(-5)}</p>
                <p className="text-sm text-gray-500 mb-2">{new Date(r.created_at).toLocaleDateString()}</p>
                <p className="line-clamp-3 hover:line-clamp-none">{r.content}</p>
              </div>
            ))}
            <p className="text-blue-500 underline cursor-pointer" onClick={() => setReviewPage(reviewPage + 1)}>
              Show more
            </p>
          </div>
        </div>

        {/* Right rail */}
        {screenSize === 'lg' || screenSize === 'xl' ? (
          <aside className="md:col-span-1 space-y-6 p-6 border rounded-lg h-fit sticky top-10">
            <div className="space-y-2">
              <p className="text-2xl font-bold">≈ ${averageNightly}/night</p>
              <p className="text-sm text-gray-500">Base price</p>
            </div>

            <div className="space-y-2">
              <label className="block font-semibold">Check in</label>
              <input
                type="date"
                value={selectedCheckIn || ''}
                onChange={(e) => setSelectedCheckIn(e.target.value)}
                className="w-full border rounded px-2 py-1"
              />
              <label className="block font-semibold">Check out</label>
              <input
                type="date"
                value={selectedCheckOut || ''}
                onChange={(e) => setSelectedCheckOut(e.target.value)}
                className="w-full border rounded px-2 py-1"
              />
              <label className="block font-semibold">Guests</label>
              <input
                type="number"
                min={1}
                max={villa.max_guests}
                value={selectedGuests}
                onChange={(e) => setSelectedGuests(Number(e.target.value))}
                className="w-full border rounded px-2 py-1"
              />
            </div>

            <div className="space-y-2">
              <h3 className="font-bold">Luxury add-ons</h3>
              {guestAddons.map((addon) => {
                const added = conciergeAddons.find((a) => a.id === addon.id);
                return (
                  <label key={addon.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!added}
                      onChange={() =>
                        setConciergeAddons(
                          added
                            ? conciergeAddons.filter((a) => a.id !== addon.id)
                            : [...conciergeAddons, addon]
                        )
                      }
                    />
                    <span>
                      {addon.name} (+${addon.per_guest ? addon.price * selectedGuests : addon.price})
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between">
                <span>Est. total</span>
                <span className="font-bold">${totalEstimate}</span>
              </div>
            </div>

            <Link
              to={`/checkout/${slug}-${id}?start_date=${selectedCheckIn}&end_date=${selectedCheckOut}&guests=${selectedGuests}`}
              className="w-full bg-blue-600 text-white py-3 rounded-md font-bold block text-center"
            >
              Request to Book
            </Link>

            <p className="text-xs text-center text-gray-500">
              You won't be charged until host accepts the reservation.
            </p>
          </aside>
        ) : null}
      </main>

      {/* Lightbox modal */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center"
          onClick={() => setLightboxIndex(null)}
        >
          <img
            src={photoGrid[lightboxIndex]}
            alt="Full view"
            className="max-w-3xl max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 text-white text-3xl"
            onClick={() => setLightboxIndex(null)}
          >
            &times;
          </button>
        </div>
      )}
    </>
  );
};

export default UV_ListingDetail;