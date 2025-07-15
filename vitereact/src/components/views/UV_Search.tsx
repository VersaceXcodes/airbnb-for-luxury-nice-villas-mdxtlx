import React, { useEffect, useMemo, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import axios from "axios";
import { useAppStore } from "@/store/main";
import { Loader2, MapPin, X } from "lucide-react";

// --- shared schema (tiny subset returned by /search endpoint for cards) -----------------
interface VillaTiny {
  id: string;
  slug: string;
  title: string;
  hero_image_url: string;
  price_total_usd: number;
  max_guests: number;
  instant_book: boolean;
  location_data: { lat: number; lng: number };
  amenities: string[];
}

const UV_Search: React.FC = () => {
  // -------- 1. Zustand selectors (single value access) -----------------
  const authUser = useAppStore(s => s.auth_user);
  const screenSize = useAppStore(s => s.screen_size);
  const pushNotification = useAppStore(s => s.push_notification);
  const apiClient = useAppStore(s => s.api_client);

  // -------- 2. URL params ------------------------------------------------
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") || "";
  const minGuests = Number(searchParams.get("min_guests") || "");
  const maxPrice = Number(searchParams.get("max_price") || "");
  const amenities = searchParams.get("amenities")
    ? (searchParams.get("amenities") as string).split(",")
    : [];
  const startDate = searchParams.get("start_date") || "";
  const endDate = searchParams.get("end_date") || "";
  const sortBy = searchParams.get("sort_by") || "created_at";

  // -------- 3. Infinite search query -------------------------------------
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useInfiniteQuery<{
    data: VillaTiny[];
    nextOffset?: number;
    total: number;
  }>({
    queryKey: [
      "searchVillas",
      q,
      minGuests,
      maxPrice,
      startDate,
      endDate,
      amenities.join(","),
      sortBy,
    ],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const res = await apiClient.get(
        `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"}/search`,
        {
          params: {
            q,
            min_guests: minGuests || undefined,
            max_price: maxPrice || undefined,
            amenities: amenities.length ? amenities.join(",") : undefined,
            start_date: startDate || undefined,
            end_date: endDate || undefined,
            sort_by: sortBy,
            limit: 50,
            offset: pageParam,
          },
        }
      );
      return res.data;
    },
    getNextPageParam: (lastPg) => lastPg.nextOffset,
    staleTime: 5 * 60 * 1000,
  });

  // flatten pages
  const villaResults = useMemo(
    () => data?.pages.flatMap(p => p.data) || [],
    [data]
  );

  // -------- 4. Wishlist toggling and cache optimisation ------------------
  const wishlistIds = useMemo(() => {
    const s = new Set<string>();
    if (authUser?.wishlist_villa_ids)
      authUser.wishlist_villa_ids.forEach((id: string) => s.add(id));
    return s;
  }, [authUser]);

  const toggleWishlist = async (villaId: string) => {
    if (!authUser) {
      pushNotification({ type: "info", title: "Sign in", body: "Login to manage your wishlist." });
      return;
    }
    const prev = wishlistIds.has(villaId);
    // optimistic toggle
    apiClient
      .post(`${import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"}/guest/wishlists/toggle`, {
        villa_id: villaId,
      })
      .catch(() => pushNotification({ type: "error", title: "Wishlist", body: "Could not update wishlist" }));
  };

  // -------- 5. Map state --------------------------------------------------
  const [mapCenter, setMapCenter] = React.useState({ lat: 43.6532, lng: 7.0221, zoom: 8 });
  const [activePopup, setActivePopup] = React.useState<VillaTiny | null>(null);

  // reset center after new results
  useEffect(() => {
    if (villaResults.length > 0) {
      const first = villaResults[0];
      setMapCenter({ lat: first.location_data.lat, lng: first.location_data.lng, zoom: 9 });
    }
  }, [villaResults]);

  // -------- 6. Scroll observer for infinite loading -----------------------
  const observerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!observerRef.current) return;
    const io = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
    });
    io.observe(observerRef.current);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // -------- 7. Filter drawer state ----------------------------------------
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  // -------- 8. Responsive Map/List toggle ---------------------------------
  const isDesktop = ["lg", "xl"].includes(screenSize);
  const [showMap, setShowMap] = React.useState(isDesktop);

  useEffect(() => setShowMap(isDesktop), [isDesktop]);

  // -------- 9. Helper – remove param --------------------------------------
  const removeParam = (key: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete(key);
    setSearchParams(newParams, { replace: true });
  };

  // -------- 10. SSR guard --------------------------------------------------
  const isSSR = typeof window === "undefined";

  return (
    <>
      {/* -------------- Filter toggle button mobile ---------------- */}
      {!isDesktop && (
        <header className="sticky top-0 bg-white z-30 shadow px-4 py-2 flex justify-between">
          <h1 className="font-bold">Estates Search</h1>
          <div className="flex gap-4">
            <button
              onClick={() => setFiltersOpen(true)}
              className="font-semibold px-3 py-1.5 rounded-md border text-sm flex items-center gap-1"
            >
              Filters
            </button>
            <button
              onClick={() => setShowMap(!showMap)}
              className="font-semibold px-3 py-1.5 rounded-md border text-sm flex items-center gap-1"
            >
              {showMap ? "List" : "Map"}
            </button>
          </div>
        </header>
      )}

      {/* -------------- Layout split -------------------------------- */}
      <main
        className={`
          flex h-[calc(100vh-var(--nav-height,0))] overflow-hidden
          ${isDesktop ? "flex-row" : "flex-col-reverse"}
        `}
      >
        {showMap && (
          <section
            className={`
              relative
              ${isDesktop ? "flex-[1_1_60%]" : "flex-[1_1_100%]"}
            `}
          >
            {/* Map stub without external component import */}
            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
              <MapPin className="w-10 h-10 text-gray-400" />
              <span className="ml-2 text-gray-600">Google Maps View</span>
            </div>

            {/* Clickable markers inside image map layer */}
            {villaResults.map(v => (
              <div
                key={v.id}
                className="absolute w-8 h-8 rounded-full bg-blue-700 text-white flex items-center justify-center shadow-lg cursor-pointer text-xs font-bold"
                style={{
                  width: "28px",
                  height: "28px",
                  transform: `translate(
                    ${((v.location_data.lng - mapCenter.lng) * 50000 + (isDesktop ? 400 : 200) - 14)}px,
                    ${((mapCenter.lat - v.location_data.lat) * 50000 + 100 - 14)}px
                  )`,
                }}
                onClick={() => setActivePopup(v)}
              >
                ${Math.round(v.price_total_usd)}
              </div>
            ))}

            {/* Mini popup overlay */}
            {activePopup && (
              <div
                className="absolute p-3 bg-white rounded shadow max-w-sm bottom-20 left-1/2 -translate-x-1/2"
                onClick={() => setActivePopup(null)}
              >
                <button className="absolute top-1 right-1">
                  <X size={16} />
                </button>
                <img
                  src={activePopup.hero_image_url}
                  alt={activePopup.title}
                  className="w-full h-24 object-cover rounded mb-2"
                />
                <Link to={`/villas/${activePopup.slug}-${activePopup.id}`}>
                  <h4 className="font-bold">{activePopup.title}</h4>
                </Link>
                <p>
                  ${activePopup.price_total_usd} total · {activePopup.max_guests} guests
                </p>
              </div>
            )}
          </section>
        )}

        {/* -------------- Villa Rail / cards ---------------------------- */}
        <section
          className={`
            overflow-y-auto px-3 py-4
            ${isDesktop ? "flex-[1_1_40%]" : "flex-[1_1_100%]"}
          `}
        >
          {isLoading && (
            <div className="flex flex-col gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-36 bg-gray-200 rounded animate-pulse" />
              ))}
            </div>
          )}

          {isError && (
            <div className="text-center text-red-600 py-10">
              Failed to load villas.{" "}
              <button onClick={() => refetch()} className="underline">
                Retry
              </button>
            </div>
          )}

          {!isSSR && villaResults.length === 0 && !isLoading && (
            <div className="text-center my-12">
              <img
                src="https://picsum.photos/seed/yacht/400/280"
                alt="Empty yacht"
                className="rounded mb-4 mx-auto"
              />
              <h3 className="text-xl font-bold mb-2">No villas found</h3>
              <p className="text-gray-500 mb-4">
                Try adjusting your filters or explore featured gems.
              </p>
              <Link
                to="/search"
                className="text-blue-700 font-semibold underline"
                onClick={() => setSearchParams({})}
              >
                Reset all filters
              </Link>
            </div>
          )}

          {villaResults.map(villa => (
            <Link
              key={villa.id}
              to={`/villas/${villa.slug}-${villa.id}`}
              className="block mb-4 bg-white rounded shadow hover:shadow-lg"
            >
              <div className="h-48 rounded-t overflow-hidden">
                <img
                  src={villa.hero_image_url}
                  alt={villa.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-3">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-md">{villa.title}</h3>
                  <button
                    type="button"
                    onClick={e => {
                      e.preventDefault();
                      toggleWishlist(villa.id);
                    }}
                  >
                    {wishlistIds.has(villa.id) ? "❤️" : "🤍"}
                  </button>
                </div>
                <p className="text-sm text-gray-600 mb-1">
                  ${villa.price_total_usd} total
                </p>
                <p className="text-sm text-gray-600">
                  Up to {villa.max_guests} guests{" "}
                  {villa.instant_book && (
                    <span className="ml-2 px-1.5 py-0.5 bg-green-100 text-green-800 text-xs rounded">
                      Instant Book
                    </span>
                  )}
                </p>
              </div>
            </Link>
          ))}

          {/* Infinite scroll trigger */}
          <div ref={observerRef} className="pb-10" />
          {isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          )}
        </section>

        {/* -------------- Filter Drawer ----------------------------------- */}
        {filtersOpen && (
          <aside
            className={`fixed inset-0 z-50 bg-black bg-opacity-50 flex ${
              isDesktop ? "justify-start" : "justify-center items-end"
            }`}
          >
            <div
              className={`
                bg-white shadow-xl max-h-full overflow-y-auto
                ${isDesktop ? "w-96" : "w-full max-w-lg rounded-t-3xl"}
              `}
            >
              <header className="flex justify-between px-4 py-3 border-b">
                <h2 className="font-bold text-lg">Filters</h2>
                <button onClick={() => setFiltersOpen(false)}>
                  <X size={20} />
                </button>
              </header>

              {/* Price */}
              <div className="p-4">
                <label className="block font-semibold mb-2">Max Price ($)</label>
                <input
                  type="range"
                  min={1000}
                  max={20000}
                  step={100}
                  value={maxPrice || 20000}
                  onChange={e => {
                    const v = Number(e.target.value);
                    const p = new URLSearchParams(searchParams);
                    if (v === 20000) p.delete("max_price");
                    else p.set("max_price", String(v));
                    setSearchParams(p, { replace: true });
                  }}
                  className="w-full"
                />
                <p className="text-sm text-gray-900 mt-1">
                  Up to {maxPrice ? `$${maxPrice}` : "$20 000"}
                </p>
              </div>

              {/* Guests */}
              <div className="p-4">
                <label className="block font-semibold mb-2">Min Guests</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={minGuests || ""}
                  placeholder="Any"
                  onChange={e => {
                    const v = Number(e.target.value);
                    const p = new URLSearchParams(searchParams);
                    if (!v) p.delete("min_guests");
                    else p.set("min_guests", String(v));
                    setSearchParams(p, { replace: true });
                  }}
                  className="w-full border rounded px-2 py-1"
                />
              </div>

              {/* Amenities chips */}
              {["pool", "chef_kitchen", "gym", "cinema", "sea_view", "concierge_24_7"].map(tag => {
                const active = amenities.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => {
                      const p = new URLSearchParams(searchParams);
                      const next = active
                        ? amenities.filter(a => a !== tag)
                        : [...amenities, tag];
                      if (next.length) p.set("amenities", next.join(","));
                      else p.delete("amenities");
                      setSearchParams(p, { replace: true });
                    }}
                    className={`mx-1 mb-2 px-2 py-1 text-xs rounded-full border ${
                      active ? "bg-blue-600 text-white" : "border-gray-300"
                    }`}
                  >
                    {tag.replace("_", " ")}
                  </button>
                );
              })}

              {/* Dates */}
              <div className="p-4">
                <label className="block font-semibold mb-2">Check-in</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => {
                    const p = new URLSearchParams(searchParams);
                    p.set("start_date", e.target.value);
                    setSearchParams(p, { replace: true });
                  }}
                  className="w-full border rounded px-2 py-1"
                />
                <label className="block font-semibold mt-2 mb-2">Check-out</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => {
                    const p = new URLSearchParams(searchParams);
                    p.set("end_date", e.target.value);
                    setSearchParams(p, { replace: true });
                  }}
                  className="w-full border rounded px-2 py-1"
                />
              </div>

              <footer className="p-4">
                <button
                  onClick={() => {
                    const p = new URLSearchParams();
                    ["q", start Date, endDate].forEach(k => {
                      const v = searchParams.get(k);
                      if (v) p.set(k, v);
                    });
                    setSearchParams(p, { replace: true });
                    setFiltersOpen(false);
                  }}
                  className="w-full bg-blue-700 text-white font-bold py-2 rounded"
                >
                  Apply Filters
                </button>
                <button
                  onClick={() => setSearchParams({}, { replace: true })}
                  className="w-full mt-2 text-sm text-gray-600 underline"
                >
                  Clear all
                </button>
              </footer>
            </div>
          </aside>
        )}
      </main>

      {/* -------------- Overlay on desktop for fixed filter icon ----- */}
      {isDesktop && (
        <button
          onClick={() => setFiltersOpen(true)}
          className="fixed top-24 left-6 bg-blue-700 text-white px-3 py-2 rounded shadow z-30"
        >
          Filters
        </button>
      )}
    </>
  );
};

export default UV_Search;