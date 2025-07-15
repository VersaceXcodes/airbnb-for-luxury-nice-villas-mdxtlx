import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { use_app_store } from '@/store/main';
import { z } from 'zod';

// ---- inline schemas ----
const suggestionSchema = z.object({ id: z.string(), label: z.string(), type: z.enum(['villa', 'city']) });
const suggestionsPayloadSchema = z.object({ suggestions: z.array(suggestionSchema) });

export const GV_TopNav: React.FC = () => {
  // --- Zustand store selectors ---
  const auth_user = use_app_store(state => state.auth_user);
  const api_client = use_app_store(state => state.api_client);
  const push_notification = use_app_store(state => state.push_notification);
  const clear_auth_user = use_app_store(state => state.clear_auth_user);

  // --- internal component state ---
  const [search_query, set_search_query] = useState('');
  const [show_suggestions, set_show_suggestions] = useState(false);
  const [show_notifications, set_show_notifications] = useState(false);
  const [show_user_menu, set_show_user_menu] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const nav_ref = useRef<HTMLElement>(null);
  const suggestions_ref = useRef<HTMLUListElement>(null);

  // --- queries ---
  const { data: suggestions_data, isFetching: is_suggestions_fetching } = useQuery(['suggestions', search_query], async () => {
    if (search_query.trim().length < 2) return { suggestions: [] };
    const { data } = await api_client.get(`/search/suggestions`, { params: { q: search_query } });
    return suggestionsPayloadSchema.parse(data);
  }, { enabled: search_query.trim().length >= 2 });

  const { data: wishlists_count } = useQuery(
    ['wishlists', auth_user?.id],
    async () => {
      const { data } = await api_client.get('/guest/wishlists');
      return { count: Array.isArray(data?.wishlists) ? data.wishlists.reduce((sum: number, w: any) => sum + w.villas?.length, 0) : 0 };
    },
    { enabled: Boolean(auth_user?.role === 'guest') },
  );

  // --- handlers ---
  const handle_suggestion_click = (item: z.infer<typeof suggestionSchema>) => {
    if (item.type === 'villa') {
      navigate(`/villas/${item.label.replace(/\s+/g, '-').toLowerCase()}-${item.id}`);
    } else {
      navigate(`/search?q=${encodeURIComponent(item.label)}`);
    }
    set_search_query('');
    set_show_suggestions(false);
  };

  const handle_logout = async () => {
    // optimistic logout for ux
    clear_auth_user();
    navigate('/');
  };

  // click-outside listeners
  useEffect(() => {
    const handle_click_outside = (e: MouseEvent) => {
      if (suggestions_ref.current && !suggestions_ref.current.contains(e.target as Node)) set_show_suggestions(false);
    };
    if (show_suggestions) document.addEventListener('mousedown', handle_click_outside);
    return () => document.removeEventListener('mousedown', handle_click_outside);
  }, [show_suggestions]);

  const desktop = window.innerWidth >= 1024;

  // single render block
  return (
    <>
      <nav ref={nav_ref} className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm shadow-sm h-14 lg:h-18 flex items-center justify-between px-4 lg:px-8">
        {/* left side */}
        <div className="flex items-center gap-4 lg:gap-6">
          <Link to="/" className="flex items-center">
            {/* text-based logo to avoid image import */}
            <span className="text-2xl font-serif text-amber-700 tracking-wider">Estates</span>
          </Link>

          {desktop && (
            <div className="group relative">
              <button className="font-medium text-sm hover:text-amber-700">Destinations</button>
              <div className="absolute left-0 top-full mt-2 hidden group-hover:grid grid-cols-3 gap-6 p-4 bg-white rounded shadow-xl min-w-[600px]">
                {['Greece', 'Italy', 'France', 'Spain', 'Portugal', 'Bali'].map(dest => (
                  <Link key={dest} to={`/search?q=${dest}`} className="hover:text-amber-700 text-sm">
                    {dest}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* center desktop search */}
        {desktop && (
          <div className="relative w-96 lg:w-[600px]">
            <input
              type="text"
              placeholder="Search villas or destinations…"
              className="w-full h-10 px-4 border border-gray-300 rounded-full focus:outline-none focus:ring-2 ring-amber-500"
              value={search_query}
              onChange={e => set_search_query(e.target.value)}
              onFocus={() => set_show_suggestions(true)}
            />
            {show_suggestions && suggestions_data?.suggestions?.length && (
              <ul ref={suggestions_ref} className="absolute left-0 right-0 top-full mt-1 bg-white shadow-lg rounded overflow-y-auto max-h-80">
                {suggestions_data.suggestions.map(item => (
                  <li key={item.id} onClick={() => handle_suggestion_click(item)} className="px-4 py-2 hover:bg-gray-100 cursor-pointer">
                    {item.label} <span className="text-xs text-gray-500">({item.type})</span>
                  </li>
                ))}
              </ul>
            )}
            {is_suggestions_fetching && (
              <div className="absolute top-full mt-1 right-2 text-xs text-gray-500">Loading…</div>
            )}
          </div>
        )}

        {/* right zone */}
        <div className="flex items-center gap-2 lg:gap-4 relative">
          {/* wishlist indicator */}
          {auth_user?.role === 'guest' && (
            <Link to="/wishlist" className="relative">
              <svg className="w-5 h-5 stroke-current fill-current" viewBox="0 0 24 24">
                <path d="M20.4 4.2C18.8 2.6 16.6 2 14.4 2c-2.2 0-4.4.6-5.9 2.1L12 5.8l3.5-3.6C17 .7 19.2 0 21.4 0c2.2 0 4.4.7 5.9 2.2 3.3 3.3 3.3 8.7 0 12L12 24 2.2 14.2c-3.3-3.3-3.3-8.7 0-12C3.7.7 5.9 0 8.1 0c2.2 0 4.4.7 5.9 2.2L12 5.8"/>
              </svg>
              {!!wishlists_count?.count && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full text-xs px-1 leading-tight">{wishlists_count.count}</span>
              )}
            </Link>
          )}

          {/* notification bell */}
          <button onClick={() => set_show_notifications(!show_notifications)} className="relative">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .528-.215.998-.595 1.432L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
            </svg>
          </button>

          {/* auth zone */}
          {!auth_user ? (
            <div className="flex items-center gap-2">
              <Link to="/login?mode=guest" className="text-sm font-medium hover:text-amber-700">Log in</Link>
              <Link to="/login?signup=true" className="text-sm font-medium bg-amber-600 px-3 py-1 rounded text-white hover:bg-amber-700">
                Sign up
              </Link>
            </div>
          ) : (
            <div className="relative">
              <img
                alt="avatar"
                src={auth_user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(auth_user.first_name || '')}${encodeURIComponent(auth_user.last_name || '')}`}
                className="w-7 h-7 rounded-full object-cover cursor-pointer"
                onClick={() => set_show_user_menu(!show_user_menu)}
              />
              {show_user_menu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white shadow-xl rounded py-1 text-sm z-40">
                  {auth_user.role === 'guest' && (
                    <>
                      <Link to="/trips" className="block px-4 py-2 hover:bg-gray-100">Trips</Link>
                      <Link to="/wishlist" className="block px-4 py-2 hover:bg-gray-100">Wishlist</Link>
                      <Link to="/profile" className="block px-4 py-2 hover:bg-gray-100">Profile</Link>
                    </>
                  )}
                  {auth_user.role === 'host' && (
                    <Link to="/host/dashboard" className="block px-4 py-2 hover:bg-gray-100">Host Dashboard</Link>
                  )}
                  {auth_user.role === 'admin' && (
                    <Link to="/admin/overview" className="block px-4 py-2 hover:bg-gray-100">Admin Console</Link>
                  )}
                  <hr className="my-1" />
                  <button onClick={handle_logout} className="block w-full text-left px-4 py-2 hover:bg-gray-100">Log out</button>
                </div>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* notifications drawer */}
      {show_notifications && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => set_show_notifications(false)} />
      )}
      <div
        className={
          `fixed top-0 z-50 transition-transform duration-300 ease-in-out bg-white shadow-lg ` +
          `${desktop ? 'right-0 mr-4 mt-18 w-90 h-120' : ''} ` +
          `${!desktop ? 'right-0 top-0 w-full h-full translate-x-0' : '-translate-x-full'} ` +
          `${show_notifications ? (desktop ? 'block' : 'translate-x-0') : (desktop ? 'hidden' : '-translate-x-full')}`
        }
      >
        <div className="p-4 font-medium flex justify-between items-center">
          <span>Notifications</span>
          <button onClick={() => set_show_notifications(false)} className="text-xl">&times;</button>
        </div>
        <div className="px-4">
          <p className="text-sm text-gray-500">No new notifications yet.</p>
        </div>
      </div>
    </>
  );
};