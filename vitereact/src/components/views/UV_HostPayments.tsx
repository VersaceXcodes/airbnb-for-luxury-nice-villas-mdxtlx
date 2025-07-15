import React, { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { format, subDays } from 'date-fns';
import { useAppStore } from '@/store/main';
import { z } from 'zod';
import { Payout, Host } from '@schema';

const UV_HostPayments: React.FC = () => {
  const apiClient = useAppStore(state => state.api_client);
  const authUser = useAppStore(state => state.auth_user);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // ------------ STATE MIRRORS URL --------------
  const activeTab = searchParams.get('tab') as 'payouts' | 'statements' | 'settings' || 'payouts';
  const urlSince = searchParams.get('since');
  const urlUntil = searchParams.get('until');
  const defaultRange = {
    start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd'),
  };
  const dateRange = {
    start: urlSince || defaultRange.start,
    end: urlUntil || defaultRange.end,
  };

  // -------------- FETCH HOST INFO -------------
  const { data: host } = useQuery<{ host: z.infer<typeof Host> }>({
    queryKey: ['host', authUser?.id],
    queryFn: () => apiClient.get(`/hosts/${authUser?.id}`).then(res => res.data),
    enabled: !!authUser?.id,
  });

  // -------------- FETCH PAYOUTS ---------------
  const { data: payouts = [] } = useQuery<Payout[]>({
    queryKey: ['payouts', authUser?.id, dateRange],
    queryFn: () =>
      apiClient
        .get(`/hosts/${authUser?.id}/payouts`, {
          params: {
            since: dateRange.start,
            until: dateRange.end,
          },
        })
        .then(res => res.data),

    enabled: !!authUser?.id,
  });

  // -------------- NEXT PAYOUT ---------------
  const { data: nextPayoutData } = useQuery<{ scheduled_date: string; estimated_amount_usd: number }>({
    queryKey: ['next-payout', authUser?.id],
    queryFn: () => apiClient.get(`/hosts/${authUser?.id}/payouts/next`).then(res => res.data),
    enabled: !!authUser?.id,
    retry: false,
  });

  // ------------- UPDATE SCHEDULE ------------
  const toggleMutation = useMutation<
    { host: z.infer<typeof Host> },
    unknown,
    { payout_schedule: 'daily' | 'weekly' | 'monthly' }
  >({
    mutationFn: values =>
      apiClient.put(`/hosts/${authUser?.id}/payouts/schedule`, values).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['host', authUser?.id] });
    },
  });

  // ------------- EXPORT ---------------
  const exportMutation = useMutation({
    mutationFn: () =>
      apiClient
        .post(`/hosts/${authUser?.id}/statements/export`, {
          since: dateRange.start,
          until: dateRange.end,
        })
        .then(r => r.data),
    onSuccess: ({ presigned_url }: { presigned_url: string }) => {
      window.location.href = presigned_url;
    },
  });

  // ------------------------------------
  return (
    <>
      <div className="min-h-screen bg-gray-50 pt-24 pb-12">
        {/* -------- Top card 96 px -------- */}
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-3xl font-bold text-gray-900">Payments</h1>
            {nextPayoutData && (
              <div className="mt-4 rounded-md border border-gray-200 bg-white p-4 text-sm shadow-sm sm:mt-0 sm:w-auto">
                <span className="font-medium">
                  Next payout scheduled {format(new Date(nextPayoutData.scheduled_date), 'PPP')} ·
                </span>{' '}
                <span className="font-semibold">${nextPayoutData.estimated_amount_usd.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* ----------- TABS ------------ */}
          <nav className="flex border-b border-gray-200">
            {['payouts', 'statements', 'settings'].map(tab => (
              <Link
                key={tab}
                to={`/host/payouts?tab=${tab}`}
                className={`mr-4 py-3 text-sm font-medium capitalize ${
                  activeTab === tab
                    ? 'border-b-2 border-brand-600 text-brand-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
              </Link>
            ))}
          </nav>

          {/* ----------- CONTENT ------------ */}
          <div className="mt-8">
            {activeTab === 'payouts' && (
              <>
                <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">From</label>
                    <input
                      type="date"
                      value={dateRange.start}
                      onChange={e =>
                        setSearchParams(prev => {
                          prev.set('since', e.target.value);
                          return prev;
                        })
                      }
                      className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                    />
                    <label className="text-sm text-gray-600">To</label>
                    <input
                      type="date"
                      value={dateRange.end}
                      onChange={e =>
                        setSearchParams(prev => {
                          prev.set('until', e.target.value);
                          return prev;
                        })
                      }
                      className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                    />
                  </div>
                </div>
                <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 font-medium text-gray-600 text-left">Date</th>
                        <th className="px-4 py-3 font-medium text-gray-600 text-left">Amount</th>
                        <th className="px-4 py-3 font-medium text-gray-600 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payouts.map(p => (
                        <tr key={p.id} className="even:bg-gray-50">
                          <td className="whitespace-nowrap px-4 py-3 text-gray-900">
                            {format(new Date(p.payout_date), 'PPP')}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                            ${p.amount_usd.toFixed(2)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                                p.status === 'paid'
                                  ? 'bg-green-100 text-green-800'
                                  : p.status === 'failed'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {activeTab === 'statements' && (
              <>
                <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-xl font-medium text-gray-900">Export Statements</h2>
                  <button
                    onClick={() => exportMutation.mutate()}
                    disabled={exportMutation.isPending}
                    className="rounded bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    {exportMutation.isPending ? 'Generating…' : 'Download CSV'}
                  </button>
                </div>
                <p className="text-sm text-gray-600">
                  You can download a CSV of all payouts for the selected date range.
                </p>
              </>
            )}

            {activeTab === 'settings' && (
              <>
                <h2 className="mb-2 text-xl font-medium text-gray-900">Payout Schedule</h2>
                <p className="mb-4 text-sm text-gray-600">
                  Select how frequently you want to receive payouts to your bank account.
                </p>
                <div className="space-y-3 rounded-md border border-gray-200 bg-white p-4">
                  {(['daily', 'weekly', 'monthly'] as const).map(option => (
                    <label key={option} className="flex cursor-pointer items-center">
                      <input
                        type="radio"
                        name="schedule"
                        value={option}
                        checked={host?.host?.payout_schedule === option}
                        onChange={() =>
                          toggleMutation.mutate({ payout_schedule: option })
                        }
                        disabled={toggleMutation.isPending}
                        className="mr-2 text-brand-600"
                      />
                      <span className="capitalize">{option}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_HostPayments;