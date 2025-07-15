import React, { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { z } from 'zod';

/* -------------------------------------------------------------------------- */
/*                           Schema inference helpers                           */
/* -------------------------------------------------------------------------- */
const moderationQueueRowSchema = z.object({
  id: z.string(),
  villa_title: z.string(),
  owner_name: z.string(),
  created_at: z.string(),
  status: z.enum(['pending', 'approved', 'rejected', 'needs_review']),
  checklist: z.object({
    photos_verified: z.boolean(),
    description_complete: z.boolean(),
    insurance_verified: z.boolean(),
    inspection_passed: z.boolean(),
  }),
});
type ModerationQueueRow = z.infer<typeof moderationQueueRowSchema>;

const dmgTicketSchema = z.object({
  id: z.string(),
  booking_id: z.string(),
  villa_title: z.string(),
  reported_at: z.string(),
  severity: z.string(),
  estimated_cost_usd: z.number().optional(),
  photos: z.array(z.string()),
  stripe_hold_id: z.string().optional(),
});
type DmgTicket = z.infer<typeof dmgTicketSchema>;

type KpiResp = {
  totalListings: number;
  pendingModeration: number;
  activeTickets: number;
  revenueToday: number;
};

type OverrideResp = {
  booking: {
    id: string;
    guest_email: string;
    villa_title: string;
    check_in: string;
    check_out: string;
    current_status: string;
    possible_actions: string[];
  };
};

/* -------------------------------------------------------------------------- */
/*                          Admin Dashboard Component                           */
/* -------------------------------------------------------------------------- */
const UV_AdminDashboard: React.FC = () => {
  const authUser = useAppStore((s) => s.auth_user);
  const notify = useAppStore((s) => s.push_notification);

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const tabParam = searchParams.get('tab') ?? 'overview';
  const cityFilter = searchParams.get('city') ?? '';
  const minStayFilter = searchParams.get('minStay') ?? '';

  const [activeTab, setActiveTab] = useState<'overview'|'queue'|'bookings'|'tickets'|'content'>(tabParam as any);
  const [modal, setModal] = useState<'damage'|null>(null);
  const [modalItem, setModalItem] = useState<DmgTicket | null>(null);
  const [inlineEdit, setInlineEdit] = useState<{id:string,field:keyof Pick<ModerationQueueRow,'villa_title'|'owner_name'>;} | null>(null);
  const [inputBuffer, setInputBuffer] = useState('');

  /* ------------------------------------------------------------------------ */
  /*                                 Guards                                   */
  /* ------------------------------------------------------------------------ */
  if (!authUser || authUser.role !== 'admin') {
    return <div className="p-10 text-center text-red-500">Access denied – admin role required</div>;
  }

  /* ------------------------------------------------------------------------ */
  /*                                Queries                                   */
  /* ------------------------------------------------------------------------ */
  const { data: kpis, isLoading: kpiLoading } = useQuery({
    queryKey: ['admin-kpis'],
    queryFn: async () => {
      const { data } = await axios.get<KpiResp>(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/admin/kpis`);
      return data;
    },
  });

  const { data: moderationRows = [], isLoading: rowsLoading } = useQuery({
    queryKey: ['moderation-queue', cityFilter, minStayFilter],
    queryFn: async () => {
      const { data } = await axios.get<ModerationQueueRow[]>(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/admin/moderation_queue`,
        { params: { city: cityFilter, minStay: minStayFilter } }
      );
      return data;
    },
    enabled: activeTab === 'queue',
  });

  const { data: dmgTickets = [], isLoading: dmgLoading } = useQuery({
    queryKey: ['damage-tickets'],
    queryFn: async () => {
      const { data } = await axios.get<DmgTicket[]>(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/admin/damage_tickets?resolved=false`);
      return data;
    },
    enabled: activeTab === 'tickets',
  });

  /* ------------------------------------------------------------------------ */
  /*                               Mutations                                  */
  /* ------------------------------------------------------------------------ */
  const updateModerationMut = useMutation({
    mutationFn: async ({ id, status, notes="" }: {id:string; status:string; notes?:string}) => {
      await axios.patch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/admin/moderation_queue/${id}`, { status, notes });
    },
    onSuccess: () => { queryClient.invalidateQueries({queryKey:['moderation-queue']}); notify({type:'success',title:'Updated',body:'Moderation updated'}); },
    onError: () => notify({type:'error',title:'Error',body:'Could not update'}),
  });

  const overrideBookingMut = useMutation({
    mutationFn: async ({ bookingId, action }: {bookingId:string; action:string}) => {
      const { data } = await axios.post<OverrideResp>(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/admin/bookings/${bookingId}/override`, { action });
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({queryKey:['admin-kpis']}); notify({type:'success',title:'Override',body:'Action executed'}); },
    onError:   () => notify({type:'error',title:'Error',body:'Override failed'}),
  });

  /* ------------------------------------------------------------------------ */
  /*                              Handlers                                    */
  /* ------------------------------------------------------------------------ */
  const handleTab = (next:'overview'|'queue'|'bookings'|'tickets'|'content') => {
    setActiveTab(next);
    searchParams.set('tab', next);
    setSearchParams(searchParams);
  };

  const submitInline = () => {
    setInlineEdit(null);
    setInputBuffer('');
  };

  /* ------------------------------------------------------------------------ */
  /*                            Main render                                   */
  /* ------------------------------------------------------------------------ */
  return (
    <>
      <div className="flex min-h-screen bg-slate-50">
        {/* Nav */}
        <nav className="w-60 border-r border-slate-200 pt-6 flex flex-col gap-2 px-4">
          {['overview','queue','bookings','tickets','content'].map((t) => (
            <button
              key={t}
              onClick={() => handleTab(t as any)}
              className={`text-left px-4 py-2 rounded-md ${activeTab === t ? 'bg-blue-100 text-blue-700 font-semibold' : 'hover:bg-slate-100'}`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </nav>

        {/* Body */}
        <main className="flex-1 p-6">
          {/* Overview */}
          {activeTab === 'overview' && (
            <>
              <h1 className="text-2xl font-bold mb-6">Dashboard Overview</h1>
              {kpiLoading ? <div className="text-slate-400">Loading KPIs…</div> : kpis ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                  <div className="bg-white rounded-md shadow px-4 py-6 text-center"><p className="text-sm text-slate-500">Total Listings</p><p className="text-3xl font-bold">{kpis.totalListings}</p></div>
                  <div className="bg-white rounded-md shadow px-4 py-6 text-center"><p className="text-sm text-slate-500">Pending Moderation</p><p className="text-3xl font-bold text-orange-500">{kpis.pendingModeration}</p></div>
                  <div className="bg-white rounded-md shadow px-4 py-6 text-center"><p className="text-sm text-slate-500">Active Tickets</p><p className="text-3xl font-bold text-red-600">{kpis.activeTickets}</p></div>
                  <div className="bg-white rounded-md shadow px-4 py-6 text-center"><p className="text-sm text-slate-500">Revenue Today</p><p className="text-3xl font-bold text-green-600">${kpis.revenueToday}</p></div>
                </div>
              ) : null}
            </>
          )}

          {/* Moderation Queue */}
          {activeTab === 'queue' && (
            <>
              <h1 className="text-2xl font-bold mb-4">Listing Moderation Queue</h1>
              <div className="mb-4 flex gap-4">
                <input value={cityFilter} onChange={e => {searchParams.set('city', e.target.value); setSearchParams(searchParams);}} placeholder="City" className="border px-2 py-1 rounded" />
                <input value={minStayFilter} onChange={e => {searchParams.set('minStay', e.target.value); setSearchParams(searchParams);}} placeholder="Min stay" type="number" className="border px-2 py-1 rounded w-20" />
              </div>
              {rowsLoading ? <div>Loading…</div> : (
                <div className="overflow-x-auto bg-white rounded shadow">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="py-3 px-4 text-left text-xs font-medium uppercase">Villa</th>
                        <th className="py-3 px-4 text-left text-xs font-medium uppercase">Owner</th>
                        <th className="py-3 px-4 text-left text-xs font-medium uppercase">Checklist</th>
                        <th className="py-3 px-4 text-left text-xs font-medium uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {moderationRows.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50">
                          <td className="py-2 px-4 text-sm">
                            {inlineEdit?.id===row.id && inlineEdit.field==='villa_title' ? (
                              <input 
                                value={inputBuffer} 
                                onBlur={submitInline}
                                onChange={e=>setInputBuffer(e.target.value)} 
                                className="border rounded px-1 w-full" 
                                autoFocus
                              />
                            ) : (
                              <span onDoubleClick={()=>{setInlineEdit({id:row.id,field:'villa_title'});setInputBuffer(row.villa_title)}}>{row.villa_title}</span>
                            )}
                          </td>
                          <td className="py-2 px-4 text-sm">
                            {inlineEdit?.id===row.id && inlineEdit.field==='owner_name' ? (
                              <input 
                                value={inputBuffer} 
                                onBlur={submitInline}
                                onChange={e=>setInputBuffer(e.target.value)} 
                                className="border rounded px-1 w-full" 
                                autoFocus
                              />
                            ) : (
                              <span onDoubleClick={()=>{setInlineEdit({id:row.id,field:'owner_name'});setInputBuffer(row.owner_name)}}>{row.owner_name}</span>
                            )}
                          </td>
                          <td className="py-2 px-4 text-sm space-x-2">
                            {Object.entries(row.checklist).map(([k,v]) => (
                              <span key={k} className={`px-2 py-1 rounded text-xs ${v?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{k}</span>
                            ))}
                          </td>
                          <td className="py-2 px-4 text-sm">
                            <select value={row.status} onChange={e=>updateModerationMut.mutate({id:row.id,status:e.target.value})} className="border rounded px-2 py-1 text-xs">
                              <option value="pending">Pending</option>
                              <option value="approved">Approved</option>
                              <option value="rejected">Rejected</option>
                              <option value="needs_review">Needs Review</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* Damage Tickets */}
          {activeTab === 'tickets' && (
            <>
              <h1 className="text-2xl font-bold mb-4">Unresolved Damage Tickets</h1>
              {dmgLoading ? <div>Loading…</div> : (
                <div className="bg-white rounded shadow divide-y">
                  {dmgTickets.map(t => (
                    <div key={t.id} className="flex justify-between items-center p-4">
                      <div>
                        <p className="font-semibold">{t.villa_title}</p>
                        <p className="text-sm text-slate-600">Reported: {new Date(t.reported_at).toLocaleDateString()}</p>
                        <p className="text-sm text-slate-600">Severity: {t.severity}</p>
                        <p className="text-sm text-slate-600">Est Cost: ${t.estimated_cost_usd ?? 'N/A'}</p>
                      </div>
                      <button onClick={()=>{setModalItem(t);setModal('damage')}} className="text-xs underline">View</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Bookings & Content stubs (empty tables) */}
          {activeTab === 'bookings' && <h1 className="text-2xl font-bold">Booking Override – coming soon</h1>}
          {activeTab === 'content'  && <h1 className="text-2xl font-bold">CMS Editor – coming soon</h1>}
        </main>

      </div>

      {/* Damage Modal */}
      {modal==='damage' && modalItem && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50" onClick={()=>setModal(null)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-lg" onClick={e=>e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{modalItem.villa_title}</h2>
            <p className="text-sm mb-2">Request ID: {modalItem.id}</p>
            <p className="text-sm mb-2">Estimated Cost: ${modalItem.estimated_cost_usd ?? 'N/A'}</p>
            <div className="flex gap-1 mb-4">
              {modalItem.photos.slice(0,4).map(p=>(
                <img key={p} src={`https://picsum.photos/seed/${p}/96/64`} alt="damage" className="rounded" />
              ))}
            </div>
            {modalItem.stripe_hold_id && <p className="text-xs text-slate-500">Hold ID: {modalItem.stripe_hold_id}</p>}
            <button onClick={()=>setModal(null)} className="mt-6 w-full bg-blue-600 text-white py-2 rounded">Close</button>
          </div>
        </div>
      )}
    </>
  );
};

export default UV_AdminDashboard;