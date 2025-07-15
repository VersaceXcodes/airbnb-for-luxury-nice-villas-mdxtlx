import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { twMerge } from 'tailwind-merge';
import { useAppStore } from '@/store/main';
import type { Villa } from '@schema';

/* SSR-friendly helper to format price */
const format_price = (p: number) =>
  p >= 1000 ? `$${Math.round(p).toLocaleString()}` : `$${Math.round(p)}`;

/* Newsletter payload types */
interface NewsletterRequest {
  email: string;
}
interface NewsletterResponse {
  message: string;
}

/* === Main View === */
const UV_Landing: React.FC = () => {
  /* ------------- Global store usage ------------- */
  const screenSize = useAppStore((s) => s.screen_size);
  const push_notification = useAppStore((s) => s.push_notification);

  /* ------------- Local component states ------------- */
  const [form, setForm] = React.useState({
    email: '',
    submitting: false,
    error: undefined as string | undefined,
  });
  const videoRef = React.useRef<HTMLVideoElement>(null);

  /* ------------- Featured villas query ------------- */
  const { data: featuredVillas = [], isLoading } = useQuery({
    queryKey: ['landingFeatured'],
    queryFn: async () => {
      const { data } = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/search?limit=10&published_only=true&sort_by=created_at&sort_order=desc`,
      );
      return data.villas as Villa[];
    },
    staleTime: 300_000, // 5 min
  });

  /* ------------- Newsletter mutation ------------- */
  const handle_newsletter_submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+$/.test(form.email)) {
      setForm((f) => ({ ...f, error: 'Please enter a valid email.' }));
      return;
    }
    setForm((f) => ({ ...f, submitting: true, error: undefined }));
    try {
      await axios.post<NewsletterResponse>(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/subscribe`,
        { email: form.email.trim() } as NewsletterRequest,
      );
      setForm({ email: '', submitting: false, error: undefined });
      push_notification({ type: 'success', title: 'Subscribed', body: 'Receive elite retreats in your inbox.' });
    } catch (err: any) {
      setForm((f) => ({ ...f, submitting: false, error: err?.response?.data?.error || 'Failed to subscribe.' }));
    }
  };

  /* ------------- Hero intersection observer for autoplay ------------- */
  React.useEffect(() => {
    if (!videoRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.7) {
          videoRef.current?.play().catch(() => {});
        } else {
          videoRef.current?.pause();
        }
      },
      { threshold: 0.7 },
    );
    observer.observe(videoRef.current);
    return () => observer.disconnect();
  }, []);

  /* ------------- UTM logging on first mount (if ref exists) ------------- */
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      console.log(`UTM ref captured: ${ref}`); // replace future analytics call
    }
  }, []);

  /* ------------- Render block ------------- */
  return (
    <>
      {/* Hero + TopNav overlay */}
      <section className="relative h-screen w-full overflow-hidden">
        {/* Glass-blur nav will already be sticky in GV_TopNav through App.tsx */}

        {/* Video / Poster */}
        <video
          id="hero-video"
          ref={videoRef}
          className="absolute top-0 left-0 w-full h-full object-cover z-0"
          poster={
            screenSize === 'xs' || screenSize === 'sm'
              ? 'https://picsum.photos/seed/hero_m/1280/720'
              : 'https://picsum.photos/seed/hero/1920/1080'
          }
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-label="Flagship villa cinematic aerial footage"
        >
          {/* 25 MB WebM for desktop fallback JPG */}
          <source
            src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4"
            type="video/mp4"
          />
        </video>

        {/* Crown Overlay */}
        <div className="absolute inset-0 bg-black/30 z-10 flex flex-col items-center justify-center text-white text-center px-6">
          <h1 className="text-4xl md:text-7xl font-light tracking-wider">Estates</h1>
          <p className="mt-3 text-base md:text-lg max-w-xl">Redefine luxury holidays – only hand-picked villas.</p>
          <Link
            to="/search"
            className="mt-6 inline-block px-8 py-3 bg-amber-600 text-white font-semibold rounded-sm hover:bg-amber-700 transition"
          >
            Explore Villas
          </Link>
        </div>

        {/* Optional unmute button (desktop only) */}
        {screenSize !== 'xs' && screenSize !== 'sm' && (
          <button
            onClick={() => {
              if (!videoRef.current) return;
              videoRef.current.muted = !videoRef.current.muted;
            }}
            className="absolute top-4 right-4 z-20 bg-black/40 rounded-full p-2 text-white w-10 h-10 flex items-center justify-center"
            aria-label="Toggle unmute"
          >
            🔊
          </button>
        )}
      </section>

      {/* How it Works carousel */}
      <section className="bg-white py-20 px-6">
        <h2 className="text-3xl md:text-4xl font-light text-center mb-16">How Estates Works</h2>
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-10 text-center">
          {['Guest'].map((role) => (
            <div key={role}>
              <strong className="block text-xl">Luxury Traveller</strong>
              <p className="mt-2 text-slate-600 text-sm max-w-xs mx-auto">
                Search, book & enjoy concierge support in under 15 minutes.
              </p>
            </div>
          ))}
          {['Host'].map((role) => (
            <div key={role}>
              <strong className="block text-xl">Villa Owner</strong>
              <p className="mt-2 text-slate-600 text-sm max-w-xs mx-auto">
                List easily—Estates handles pricing, contracts & guest vetting.
              </p>
            </div>
          ))}
          {['Concierge'].map((role) => (
            <div key={role}>
              <strong className="block text-xl">24/7 Concierge</strong>
              <p className="mt-2 text-slate-600 text-sm max-w-xs mx-auto">
                Curated insiders & emergency support across all stays.
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured Villas horizontally scrollable */}
      <section className="bg-slate-50 py-20 px-6">
        <h2 className="text-3xl md:text-4xl font-light text-center mb-10">Exclusive Curated Homes</h2>
        {isLoading ? (
          <div className="max-w-7xl mx-auto flex space-x-4 overflow-x-auto">
            {Array.from({ length: 10 }).map((_, idx) => (
              <div key={idx} className="w-72 h-40 bg-slate-200 rounded-md animate-pulse shrink-0" />
            ))}
          </div>
        ) : (
          <div className="max-w-7xl mx-auto flex space-x-6 overflow-x-auto pb-4">
            {featuredVillas.map((villa) => (
              <Link
                key={villa.id}
                to={`/villas/${villa.slug}-${villa.id}`}
                className="block w-80 shrink-0 bg-white rounded overflow-hidden shadow hover:shadow-xl transition"
              >
                <img
                  src={villa.hero_url || `https://picsum.photos/seed/${villa.id}/400/225`}
                  alt={villa.title}
                  width={400}
                  height={225}
                  className="w-full h-48 object-cover"
                  loading="lazy"
                />
                <div className="p-4">
                  <h3 className="truncate font-semibold">{villa.title}</h3>
                  <p className="text-slate-500 text-sm mt-1">
                    {format_price(villa.base_price_usd_per_night)} / night · up to {villa.max_guests} guests
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Newsletter */}
      <section className="bg-amber-50 py-20 px-6">
        <form onSubmit={handle_newsletter_submit} className="max-w-lg mx-auto">
          <h2 className="text-2xl md:text-3xl font-light text-center mb-6">Stay in the Loop</h2>
          <p className="text-center mb-6">Receive elite retreats once a month</p>
          <div className="flex">
            <input
              type="email"
              placeholder="your@email.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value, error: undefined })}
              className="flex-1 px-4 py-3 border border-slate-300 rounded-l focus:outline-none focus:border-amber-500"
              required
            />
            <button
              type="submit"
              disabled={form.submitting}
              className="px-6 py-3 bg-amber-600 text-white font-semibold rounded-r hover:bg-amber-700 disabled:opacity-60 transition"
            >
              {form.submitting ? '…' : 'Subscribe'}
            </button>
          </div>
          {form.error && <p className="text-red-600 text-sm mt-2">{form.error}</p>}
        </form>
      </section>

      {/* Footer is provided by GV_Footer via App – therefore none here */}

      {/* Hidden Intercom bubble is site-wide via <GV_Footer> script tag */}
    </>
  );
};

export default UV_Landing;