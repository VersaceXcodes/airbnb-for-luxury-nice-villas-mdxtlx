import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { z } from 'zod';

const badgeCountsSchema = z.object({
  search: z.number().int().nonnegative(),
  wishlist: z.number().int().nonnegative(),
  trips: z.number().int().nonnegative(),
  inbox: z.number().int().nonnegative(),
  profile: z.number().int().nonnegative(),
});

type BadgeCounts = z.infer<typeof badgeCountsSchema>;

const GV_BottomBar: React.FC = () => {
  const screenSize = useAppStore((state) => state.screen_size);
  const wsSocket = useAppStore((state) => state.ws_socket);
  const location = useLocation();

  const [badgeCounts, setBadgeCounts] = React.useState<BadgeCounts>({
    search: 0,
    wishlist: 0,
    trips: 0,
    inbox: 0,
    profile: 0,
  });

  const fetchBadgeCounts = async (): Promise<BadgeCounts> => {
    const url = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/notifications/counts`;
    const { data } = await axios.get(url);
    return badgeCountsSchema.parse(data);
  };

  const countsQuery = useQuery({
    queryKey: ['notifications', 'counts'],
    queryFn: fetchBadgeCounts,
    refetchInterval: 30_000,
  });

  React.useEffect(() => {
    if (wsSocket) {
      const handler = (payload: BadgeCounts) => setBadgeCounts(payload);
      wsSocket.on('badge_refresh', handler);
      return () => {
        wsSocket.off('badge_refresh', handler);
      };
    }
  }, [wsSocket]);

  React.useEffect(() => {
    if (countsQuery.data) {
      setBadgeCounts(countsQuery.data);
    }
  }, [countsQuery.data]);

  const isViewportMobile = screenSize === 'xs' || screenSize === 'sm';

  if (!isViewportMobile) return null;

  const routes = [
    { path: '/search', label: 'Search', badgeKey: 'search' as const },
    { path: '/wishlist', label: 'Wishlist', badgeKey: 'wishlist' as const },
    { path: '/trips', label: 'Trips', badgeKey: 'trips' as const },
    { path: '/host/inbox', label: 'Inbox', badgeKey: 'inbox' as const },
    { path: '/profile', label: 'Profile', badgeKey: 'profile' as const },
  ];

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 h-14 bg-white border-t border-gray-200 flex px-1 z-40 md:hidden print:hidden select-none shadow-t">
        {routes.map((r) => {
          const isActive = location.pathname.startsWith(r.path);
          const activeClasses = isActive
            ? ' border-t-2 border-amber-400 text-amber-500'
            : ' text-gray-400';
          const IconEl = (
            <svg
              className="w-6 h-6"
              viewBox="0 0 24 24"
              fill={isActive ? 'currentColor' : 'none'}
              stroke={isActive ? '#00000000' : 'currentColor'}
            >
              {r.label === 'Search' && (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-4.35-4.35m0 0A3 3 0 012 9a3 3 0 011-1.65"
                />
              )}
              {r.label === 'Wishlist' && (
                <>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </>
              )}
              {r.label === 'Trips' && (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              )}
              {r.label === 'Inbox' && (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              )}
              {r.label === 'Profile' && (
                <>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </>
              )}
            </svg>
          );
          return (
            <Link
              key={r.path}
              to={r.path}
              className={`flex-1 flex flex-col items-center justify-center space-y-1 ${activeClasses} transition-all`}
            >
              <div className="relative">
                {IconEl}
                {badgeCounts[r.badgeKey] > 0 && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {badgeCounts[r.badgeKey] > 9 ? '9+' : badgeCounts[r.badgeKey]}
                  </div>
                )}
              </div>
              <span className="text-[10px] leading-tight font-medium whitespace-nowrap">
                {r.label}
              </span>
            </Link>
          );
        })}
      </nav>
      <div className="md:hidden pb-14" />
    </>
  );
};

export default GV_BottomBar;