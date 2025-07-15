import React, { useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useParams, createSearchParams, useSearchParams, Link } from 'react-router-dom';
import { z } from 'zod';
import { useAppStore } from '@/store/main';
import { format, subDays, parseISO, eachDayOfInterval } from 'date-fns';

// ----- minimal inline types from datamap -----
interface KPIs {
  occupancy: number;
  adr: number;
  revpal: number;
  responseTimeMinutes: number;
  inquiryConversion: number;
  totalRevenueUSD: number;
}
interface DailyRevenue {
  day: string;
  revenueUSD: number;
  bookingsCount: number;
}
interface PricingRecommendation {
  suggestionId: string;
  villaTitle: string;
  message: string;
  suggestedPrice: number;
  priceDeltaPercent: number;
  villaId: string;
}

const uvHostPerformanceFC: React.FC = () => {
  const queryClient = useQueryClient();
  const authUser = useAppStore(s => s.auth_user);
  const screenSize = useAppStore(s => s.screen_size);

  // ----- URL dateRange handling -----
  const [search, setSearch] = useSearchParams();
  const mappedRangeParam = search.get('dateRange') || '30_days_ago,today';
  let [startParam, endParam] = mappedRangeParam.split(',');
  if (startParam === '30_days_ago') startParam = subDays(new Date(), 30).toISOString().split('T')[0];
  if (endParam === 'today') endParam = new Date().toISOString().split('T')[0];

  const selectedDateRange = {
    start: startParam,
    end: endParam,
  };

  // ----- react-query fetch -----
  const { isLoading: loadingKpis, data } = useQuery(
    ['host-kpis', authUser?.id, selectedDateRange],
    async () => {
      const url = `${
        import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
      }/hosts/${authUser!.id}/kpis?start=${selectedDateRange.start}&end=${selectedDateRange.end}`;
      const { data } = await axios.get(url);
      const parsed = z.object({
        kpis: z.object({
          occupancy: z.number(),
          adr: z.number(),
          revpal: z.number(),
          responseTimeMinutes: z.number(),
          inquiryConversion: z.number(),
          totalRevenueUSD: z.number(),
        }),
        revenueHistory: z.array(
          z.object({
            day: z.string(),
            revenueUSD: z.number(),
            bookingsCount: z.number(),
          })
        ),
        pricingRecommendations: z.array(
          z.object({
            suggestionId: z.string(),
            villaTitle: z.string(),
            message: z.string(),
            suggestedPrice: z.number(),
            priceDeltaPercent: z.number(),
            villaId: z.string(),
          })
        ),
      }).parse(data);
      return parsed;
    },
    {
      enabled: !!authUser?.id,
    }
  );

  // ----- mutations -----
  const applyPricingMutation = useMutation(
    async (rec: PricingRecommendation) => {
      const url = `${
        import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
      }/villas/${rec.villaId}/pricing_rules`;
      await axios.patch(url, {
        rule_type: 'season',
        start_date: selectedDateRange.start,
        end_date: selectedDateRange.end,
        adjustment_percent: rec.priceDeltaPercent,
      });
    },
    {
      onSuccess: () => queryClient.invalidateQueries(['host-kpis']),
    }
  );

  const exportReportMutation = useMutation(
    async () => {
      const url = `${
        import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
      }/hosts/${authUser!.id}/reports/performance`;
      const { data } = await axios.post(url);
      return data.signed_url as string;
    },
    {
      onSuccess: (signedUrl) => {
        window.open(signedUrl, '_blank');
      },
    }
  );

  // ----- handle date range picker -----
  const handleDateChange = (newRange: { start: string; end: string }) => {
    setSearch(
      createSearchParams({
        dateRange: `${newRange.start},${newRange.end}`,
      }).toString()
    );
  };

  // ----- revenueChart spark-line -----
  const revenueChartData = useMemo(() => {
    const d = data?.revenueHistory || [];
    const padded = eachDayOfInterval({
      start: parseISO(selectedDateRange.start),
      end: parseISO(selectedDateRange.end),
    }).map(d => {
      const match = d.find(r => r.day === format(d, 'yyyy-MM-dd'));
      return { day: format(d, 'MMM dd'), revenueUSD: match ? match.revenueUSD : 0 };
    });
    return padded;
  }, [data, selectedDateRange]);

  const kpiData: KPIs = data?.kpis || {
    occupancy: 0,
    adr: 0,
    revpal: 0,
    responseTimeMinutes: 0,
    inquiryConversion: 0,
    totalRevenueUSD: 0,
  };

  const recommendations: PricingRecommendation[] = data?.pricingRecommendations || [];

  // prettier-ignore
  return (
    <>
      {/* container */}
      <div className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:py-8 lg:px-8">
        {/* header */}
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Revenue & KPI Analytics</h1>
          <p className="mt-2 text-sm text-gray-600">Smart optimization guidance for your portfolio</p>
        </header>

        {/* date range picker */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:space-x-4">
          <label htmlFor="dateRange" className="block text-sm font-medium text-gray-700 mb-2 sm:mb-0">Date range:</label>
          <input
            type="date"
            value={selectedDateRange.start}
            onChange={e => handleDateChange({ ...selectedDateRange, start: e.target.value })}
            className="border rounded px-3 py-1 text-sm"
          />
          <span className="mx-2 text-gray-500">–</span>
          <input
            type="date"
            value={selectedDateRange.end}
            onChange={e => handleDateChange({ ...selectedDateRange, end: e.target.value })}
            className="border rounded px-3 py-1 text-sm"
          />
          <button
            onClick={() => exportReportMutation.mutate()}
            disabled={exportReportMutation.isLoading}
            className="ml-auto mt-2 sm:mt-0 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          >
            {exportReportMutation.isLoading ? 'Generating…' : 'Export CSV'}
          </button>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-8">
          {[
            { label: 'Occupancy', value: kpiData.occupancy, unit: '%' },
            { label: 'ADR', value: kpiData.adr, unit: 'USD' },
            { label: 'RevPAL', value: kpiData.revpal, unit: 'USD' },
            { label: 'Response time', value: kpiData.responseTimeMinutes, unit: 'min' },
            { label: 'Inquiry conversion', value: kpiData.inquiryConversion, unit: '%' },
            { label: 'Revenue', value: kpiData.totalRevenueUSD, unit: 'USD' },
          ].map(card => (
            <div key={card.label} className="rounded-lg bg-white p-4 shadow">
              <p className="text-xs text-gray-500">{card.label}</p>
              <p className="text-xl font-semibold text-gray-900">
                {loadingKpis ? '…' : `${typeof card.value === 'number' ? card.value.toLocaleString() : card.value}${card.unit || ''}`}
              </p>
            </div>
          ))}
        </div>

        {/* revenue spark-line or numeric delta */}
        <div className="mb-10">
          {screenSize === 'sm' || screenSize === 'xs' ? (
            <div className="rounded-lg bg-white p-4 shadow">
              <p className="text-md font-semibold">Revenue delta vs previous period: <span className="text-gray-900">{kpiData.totalRevenueUSD.toLocaleString()} USD</span></p>
            </div>
          ) : (
            <div className="rounded-lg bg-white p-4 shadow">
              <h2 className="mb-2 text-lg font-semibold text-gray-900">Revenue trend (past period)</h2>
              <div className="h-48 flex items-end space-x-1">
                {revenueChartData.map(d => {
                  const max = Math.max(...revenueChartData.map(r => r.revenueUSD)) || 1;
                  const height = (d.revenueUSD / max) * 100;
                  return (
                    <div
                      key={d.day}
                      className="flex-1 bg-indigo-600 rounded-t hover:bg-indigo-500"
                      style={{ height: `${Math.max(height, 4)}%` }}
                      title={`${d.day}: $${d.revenueUSD}`}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* AI pricing recommendations */}
        <div>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">AI Pricing Recommendations</h2>
          <div className="space-y-4">
            {recommendations.map(rec => (
              <div key={rec.suggestionId} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg bg-white p-4 shadow">
                <div>
                  <p className="font-semibold text-gray-900">{rec.villaTitle}</p>
                  <p className="text-sm text-gray-600">{rec.message}</p>
                </div>
                <div className="flex items-center space-x-2 mt-3 sm:mt-0">
                  <span className={`text-sm ${rec.priceDeltaPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {rec.priceDeltaPercent >= 0 ? '+' : ''}{rec.priceDeltaPercent}%
                  </span>
                  <button
                    onClick={() => applyPricingMutation.mutate(rec)}
                    disabled={applyPricingMutation.isLoading}
                    className="rounded bg-indigo-600 px-3 py-1 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    Apply
                  </button>
                </div>
              </div>
            ))}
            {!recommendations.length && (
              <div className="text-sm text-gray-500">No pricing suggestions at the moment.</div>
            )}
          </div>
        </div>

      </div>
    </>
  );
};
export default uvHostPerformanceFC;