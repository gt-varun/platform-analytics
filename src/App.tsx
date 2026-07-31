import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PeriodDays, UsageSummaryResponse } from './types/analytics';
import { fetchUsageSummary, ApiError } from './services/api';
import { formatCurrency, formatPercent, formatMeetingTime } from './utils/formatters';
import { computeBannerSummary, generateInsights } from './utils/insights';
import { generateExecutivePdfReport } from './utils/pdfReportExporter';

import { PageHeader } from './components/PageHeader';
import { ExecutiveBanner } from './components/ExecutiveBanner';
import { MetricCard } from './components/MetricCard';
import { AnalyticsChart } from './components/AnalyticsChart';
import { AccountsReceivableTable } from './components/AccountsReceivableTable';
import { NearLimitUsersTable } from './components/NearLimitUsersTable';
import { InsightPanel } from './components/InsightPanel';
import { SkeletonLoader } from './components/SkeletonLoader';
import { ErrorState } from './components/ErrorState';
import { Toast } from './components/Toast';

import {
  DollarSign,
  TrendingUp,
  CreditCard,
  UserX,
  Video,
  FileCheck,
  Cpu,
  FileSpreadsheet,
  Users,
  PieChart as PieIcon,
  BarChart3,
} from 'lucide-react';

export function App() {
  const [days, setDays] = useState<PeriodDays>(30);
  const [data, setData] = useState<UsageSummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetching, setFetching] = useState<boolean>(false);
  const [error, setError] = useState<ApiError | null>(null);

  // PDF Export States
  const [exportingPdf, setExportingPdf] = useState<boolean>(false);
  const [exportStatusText, setExportStatusText] = useState<string>('Generating Executive Report...');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // DOM Refs for High Resolution Chart Capture
  const usageTrendRef = useRef<HTMLDivElement | null>(null);
  const tierBreakdownRef = useRef<HTMLDivElement | null>(null);
  const providerBreakdownRef = useRef<HTMLDivElement | null>(null);
  const growthRef = useRef<HTMLDivElement | null>(null);

  const loadData = useCallback(
    async (selectedDays: PeriodDays, isManualRefresh = false) => {
      if (isManualRefresh) {
        setFetching(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const result = await fetchUsageSummary(selectedDays);
        setData(result);
      } catch (err: unknown) {
        setError(err as ApiError);
      } finally {
        setLoading(false);
        setFetching(false);
      }
    },
    []
  );

  useEffect(() => {
    loadData(days);
  }, [days, loadData]);

  // Derived values memoization
  const bannerSummary = useMemo(() => (data ? computeBannerSummary(data) : null), [data]);
  const insights = useMemo(() => (data ? generateInsights(data) : []), [data]);

  // Format Tier Breakdown chart data
  const tierChartData = useMemo(() => {
    if (!data?.tier_breakdown) return [];
    const colors: Record<string, string> = { starter: '#6366f1', pro: '#10b981' };
    return Object.entries(data.tier_breakdown).map(([key, val]) => ({
      name: key.toUpperCase(),
      value: val,
      color: colors[key.toLowerCase()] || '#8b5cf6',
    }));
  }, [data]);

  // Format Billing Provider chart data
  const providerChartData = useMemo(() => {
    if (!data?.billing_provider_breakdown) return [];
    const colors: Record<string, string> = { stripe: '#6366f1', gcp_marketplace: '#f59e0b' };
    const labelNames: Record<string, string> = { stripe: 'Stripe', gcp_marketplace: 'Google Marketplace' };
    return Object.entries(data.billing_provider_breakdown).map(([key, val]) => ({
      name: labelNames[key] || key,
      value: val,
      color: colors[key] || '#ec4899',
    }));
  }, [data]);

  // Format Growth chart data
  const growthChartData = useMemo(() => {
    if (!data?.growth?.by_day) return [];
    return Object.entries(data.growth.by_day).map(([day, count]) => ({
      day,
      count,
    }));
  }, [data]);

  // PDF Export Handler with dynamic multi-stage progress
  const handleExportPdf = useCallback(async () => {
    if (!data) return;
    setExportingPdf(true);
    try {
      await generateExecutivePdfReport(
        data,
        insights,
        {
          usageTrend: usageTrendRef.current,
          tierBreakdown: tierBreakdownRef.current,
          providerBreakdown: providerBreakdownRef.current,
          growth: growthRef.current,
        },
        (status) => setExportStatusText(status)
      );
    } catch (err) {
      console.error('PDF export error:', err);
      setToastMessage('Unable to generate the PDF. Please try again.');
    } finally {
      setExportingPdf(false);
    }
  }, [data, insights]);

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 pb-16">
      {/* Sticky Header */}
      <PageHeader
        days={days}
        onDaysChange={(newDays) => setDays(newDays)}
        onRefresh={() => loadData(days, true)}
        onExportPdf={handleExportPdf}
        isFetching={fetching}
        isExportingPdf={exportingPdf}
        exportStatusText={exportStatusText}
        generatedAt={data?.generated_at}
      />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {loading ? (
          <SkeletonLoader />
        ) : error ? (
          <ErrorState error={error} onRetry={() => loadData(days)} />
        ) : data ? (
          <>
            {/* Executive Health Banner */}
            {bannerSummary && <ExecutiveBanner summary={bannerSummary} />}

            {/* SECTION 2: Executive KPI Cards */}
            <section aria-labelledby="section-kpis">
              <h2 id="section-kpis" className="sr-only">Executive KPIs</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="Monthly Recurring Revenue"
                  value={formatCurrency(data.revenue.mrr_usd)}
                  subtitle="Current monthly recurring revenue"
                  icon={<DollarSign className="w-5 h-5 text-indigo-400" />}
                  accentColor="border-indigo-500/20"
                />
                <MetricCard
                  title="Annual Recurring Revenue"
                  value={formatCurrency(data.revenue.arr_usd)}
                  subtitle="Annualized recurring revenue"
                  icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
                  accentColor="border-emerald-500/20"
                />
                <MetricCard
                  title="Outstanding Receivables"
                  value={formatCurrency(data.accounts_receivable.total_outstanding_usd)}
                  subtitle="Outstanding Stripe invoices"
                  icon={<CreditCard className="w-5 h-5 text-amber-400" />}
                  badge={
                    data.accounts_receivable.overdue_invoice_count > 0
                      ? { text: `${data.accounts_receivable.overdue_invoice_count} Overdue`, variant: 'danger' }
                      : undefined
                  }
                  accentColor={
                    data.accounts_receivable.overdue_invoice_count > 0
                      ? 'border-red-500/30'
                      : 'border-slate-800'
                  }
                />
                <MetricCard
                  title="Churn Rate"
                  value={formatPercent(data.churn.churn_rate)}
                  subtitle="Estimated churn in period"
                  icon={<UserX className="w-5 h-5 text-rose-400" />}
                  accentColor="border-rose-500/20"
                />
              </div>
            </section>

            {/* SECTION 3: Product Usage Overview */}
            <section aria-labelledby="section-usage-overview">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 id="section-usage-overview" className="text-lg font-bold text-white flex items-center">
                    <BarChart3 className="w-5 h-5 mr-2 text-indigo-400" />
                    Product Usage Overview
                  </h2>
                  <p className="text-xs text-slate-400">
                    Aggregated usage metrics across all four core features in the trailing {data.period_days}-day window
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Meeting Time Card */}
                <MetricCard
                  title="Meeting Time"
                  value={formatMeetingTime(data.features.meeting_time.total_units)}
                  subtitle={`Total seconds: ${data.features.meeting_time.total_units.toLocaleString()}s`}
                  icon={<Video className="w-5 h-5 text-indigo-400" />}
                  details={[
                    { label: 'Active Users', value: data.features.meeting_time.active_users.toString() },
                    {
                      label: 'Avg / Active',
                      value: formatMeetingTime(data.features.meeting_time.avg_per_active_user),
                    },
                  ]}
                  accentColor="border-indigo-500/20"
                />

                {/* KYC Count Card */}
                <MetricCard
                  title="KYC Checks"
                  value={data.features.kyc_count.total_units.toLocaleString()}
                  subtitle="Total KYC verifications executed"
                  icon={<FileCheck className="w-5 h-5 text-emerald-400" />}
                  details={[
                    { label: 'Active Users', value: data.features.kyc_count.active_users.toString() },
                    { label: 'Avg / Active', value: data.features.kyc_count.avg_per_active_user.toFixed(1) },
                  ]}
                  accentColor="border-emerald-500/20"
                />

                {/* Simulator Card */}
                <MetricCard
                  title="Simulator"
                  value={data.features.simulator.total_units.toLocaleString()}
                  subtitle="Total simulation runs launched"
                  icon={<Cpu className="w-5 h-5 text-amber-400" />}
                  details={[
                    { label: 'Active Users', value: data.features.simulator.active_users.toString() },
                    { label: 'Avg / Active', value: data.features.simulator.avg_per_active_user.toFixed(1) },
                  ]}
                  accentColor="border-amber-500/20"
                />

                {/* Proposal Card */}
                <MetricCard
                  title="Proposal"
                  value={data.features.proposal.total_units.toLocaleString()}
                  subtitle="Total proposal documents generated"
                  icon={<FileSpreadsheet className="w-5 h-5 text-pink-400" />}
                  details={[
                    { label: 'Active Users', value: data.features.proposal.active_users.toString() },
                    { label: 'Avg / Active', value: data.features.proposal.avg_per_active_user.toFixed(1) },
                  ]}
                  accentColor="border-pink-500/20"
                />
              </div>
            </section>

            {/* SECTION 4: Usage Trend Chart */}
            <section
              ref={usageTrendRef}
              aria-labelledby="section-usage-trend"
              className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h2 id="section-usage-trend" className="text-lg font-bold text-white">Daily Usage Trend</h2>
                  <p className="text-xs text-slate-400">
                    Daily distribution of Meeting Time, KYC Checks, Simulator runs, and Proposal generations
                  </p>
                </div>
              </div>
              <AnalyticsChart type="usage-trend" data={data.daily_usage_trend} />
            </section>

            {/* SECTION 5: Subscription Insights */}
            <section aria-labelledby="section-subscription-insights">
              <div className="flex items-center justify-between mb-4">
                <h2 id="section-subscription-insights" className="text-lg font-bold text-white flex items-center">
                  <PieIcon className="w-5 h-5 mr-2 text-indigo-400" />
                  Subscription Insights
                </h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div ref={tierBreakdownRef} className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl">
                  <div className="mb-4">
                    <h3 className="text-base font-bold text-white">Tier Breakdown</h3>
                    <p className="text-xs text-slate-400">Active subscriptions by plan tier (Starter vs Pro)</p>
                  </div>
                  <AnalyticsChart type="donut" data={tierChartData} centerLabel="Subscriptions" />
                </div>

                <div ref={providerBreakdownRef} className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl">
                  <div className="mb-4">
                    <h3 className="text-base font-bold text-white">Billing Provider Breakdown</h3>
                    <p className="text-xs text-slate-400">Active subscriptions by billing provider (Stripe vs GCP Marketplace)</p>
                  </div>
                  <AnalyticsChart type="donut" data={providerChartData} centerLabel="Providers" />
                </div>
              </div>
            </section>

            {/* SECTION 6: Revenue & Billing Health Tables */}
            <section aria-labelledby="section-revenue-health" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <h2 id="section-revenue-health" className="sr-only">Revenue & Billing Health</h2>
              <AccountsReceivableTable data={data.accounts_receivable} />
              <NearLimitUsersTable users={data.near_limit_users} />
            </section>

            {/* SECTION 7: Growth & Signups */}
            <section
              ref={growthRef}
              aria-labelledby="section-growth"
              className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 id="section-growth" className="text-lg font-bold text-white flex items-center">
                    <Users className="w-5 h-5 mr-2 text-emerald-400" />
                    Subscription Growth ({data.growth.total} New Activations)
                  </h2>
                  <p className="text-xs text-slate-400">Daily new paid subscription creations across the window</p>
                </div>
              </div>
              <AnalyticsChart type="growth" data={growthChartData} />
            </section>

            {/* SECTION 8: Business Summary Insight Panel */}
            <section aria-labelledby="section-insights">
              <h2 id="section-insights" className="sr-only">Derived Business Insights</h2>
              <InsightPanel insights={insights} />
            </section>
          </>
        ) : null}
      </main>

      {/* Toast Notification */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          type="error"
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}

export default App;

