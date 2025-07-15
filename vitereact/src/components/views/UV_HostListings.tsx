// @/components/views/UV_HostListings.tsx
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import axios from 'axios';
import { z } from 'zod';
import { villaSchema } from '@/schema'; // defined earlier

interface HostKpiRow {
  villa_id: string;
  revenue_usd: number;
  occupancy_percent: number;
  start_date: string;
  end_date: string;
}

export default function UV_HostListings(): React.ReactElement {
  const authUser = useAppStore((state) => state.auth_user);

  const hostId = authUser?.id as string;

  const {
    data: villas = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['hosts', hostId, 'villas'],
    queryFn: async () => {
      const { data } = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/villas`,
        {
          params: { host_user_id: hostId, limit: 100, sort_by: 'created_at', sort_order: 'desc' },
        },
      );
      // we expect { villas: Villa[] }
      return z.array(villaSchema).parse(data.villas);
    },
    enabled: !!hostId,
  });

  const villaIds = useMemo(() => villas.map((v) => v.id), [villas]);

  const {
    data: kpis = [] as HostKpiRow[],
    isLoading: isLoadingKpis,
  } = useQuery({
    queryKey: ['hosts', hostId, 'kpis', villaIds],
    queryFn: async () => {
      const { data } = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/hosts/${hostId}/kpis`,
        { params: { villa_ids: villaIds.join(',') } },
      );
      return data as HostKpiRow[];
    },
    enabled: villaIds.length > 0,
  });

  const lookup = useMemo(() => {
    const map = new Map<string, HostKpiRow>();
    kpis.forEach((k) => map.set(k.villa_id, k));
    return map;
  }, [kpis]);

  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const toggleSelect = (villaId: string) => {
    const next = new Set(selected);
    next.has(villaId) ? next.delete(villaId) : next.add(villaId);
    setSelected(next);
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-slate-100 text-slate-700';
      case 'under_review': return 'bg-amber-100 text-amber-700';
      case 'live': return 'bg-emerald-100 text-emerald-700';
      case 'suspended': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const fmtCurrency = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  return (
    <>
      <div className="min-h-screen bg-slate-50 text-slate-800">
        {/* Toolbar */}
        <header className="max-w-7xl mx-auto px-4 py-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold">My Villa Portfolio</h1>
          <div className="flex items-center gap-3">
            {selected.size > 0 && (
              <span className="text-sm italic text-slate-600 mr-2">
                {selected.size} selected
              </span>
            )}
            <button
              className="text-white bg-amber-600 hover:bg-amber-700 px-4 py-2 rounded-md text-sm font-medium h-9"
              disabled
              title="Coming soon"
            >
              Bulk Actions
            </button>
            <Link
              to="/host/listings/new"
              className="inline-flex items-center bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-md text-sm font-medium h-9"
            >
              Add Listing
            </Link>
          </div>
        </header>

        {/* Content */}
        <main className="max-w-7xl mx-auto px-4 pb-8">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-amber-600 border-r-transparent"></div>
              <p className="mt-2 text-slate-500">Loading your villas...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-700">
              <p>Unable to load listings. Please reload the page.</p>
            </div>
          ) : villas.length === 0 ? (
            <div className="text-center py-20">
              <img
                src="https://picsum.photos/seed/empty/200/200"
                alt="Empty portfolio"
                className="mx-auto h-40 w-40 rounded-2xl object-cover mb-4 shadow"
              />
              <h2 className="text-lg font-semibold mb-2">No villas yet</h2>
              <p className="text-slate-500 mb-6 max-w-sm mx-auto">
                Create your first luxury villa listing to start welcoming guests.
              </p>
              <Link
                to="/host/listings/new"
                className="bg-amber-600 hover:bg-amber-700 text-white py-2 px-5 rounded-md text-sm font-medium"
              >
                Add Your First Villa
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto min-w-full">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-100 text-sm text-left text-slate-600">
                  <tr>
                    <th className="p-2">
                      <input
                        type="checkbox"
                        className="sr-only"
                        style={{ display: 'none' }}
                        checked={selected.size > 0}
                        readOnly
                      />
                    </th>
                    <th className="py-3 px-2 font-medium">Thumbnail</th>
                    <th className="py-3 px-2 font-medium">Title</th>
                    <th className="py-3 px-2 font-medium">Status</th>
                    <th className="py-3 px-2 font-medium text-right">Occupancy</th>
                    <th className="py-3 px-2 font-medium text-right">Revenue (30d)</th>
                    <th className="py-3 px-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {villas.map((villa) => {
                    const kpi = lookup.get(villa.id);
                    return (
                      <tr key={villa.id} className="hover:bg-slate-50">
                        <td className="p-2">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 focus:ring-indigo-500"
                            checked={selected.has(villa.id)}
                            onChange={() => toggleSelect(villa.id)}
                          />
                        </td>
                        <td className="p-2">
                          <img
                            src={
                              villa.thumbnail_url?.length
                                ? villa.thumbnail_url
                                : `https://picsum.photos/seed/${villa.id}/60/40`
                            }
                            alt={villa.title}
                            className="h-10 w-16 object-cover rounded"
                          />
                        </td>
                        <td className="p-2 font-medium break-words max-w-[180px]">
                          {villa.title}
                        </td>
                        <td className="p-2">
                          <span
                            className={`inline-flex rounded-full px-2 text-xs font-semibold py-1 ${statusColor(
                              villa.status,
                            )}`}
                          >
                            {villa.status}
                          </span>
                        </td>
                        <td className="p-2 text-right">
                          {!kpi || isLoadingKpis ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            `${Math.round(kpi.occupancy_percent)}%`
                          )}
                        </td>
                        <td className="p-2 text-right">
                          {!kpi || isLoadingKpis ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            fmtCurrency(kpi.revenue_usd)
                          )}
                        </td>
                        <td className="p-2 text-center">
                          <Link
                            to={`/host/listings/${villa.id}/edit`}
                            className="text-amber-600 hover:text-amber-800 text-sm"
                          >
                            Edit
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </>
  );
}