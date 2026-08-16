import React, { useMemo } from 'react';
import { Activity, BarChart3, DollarSign, Gauge, PieChart as PieIcon, TrendingUp, UserX, Users } from 'lucide-react';
import { MODULES, MODULE_KEYS, ModuleKey, TIERS, TIER_ORDER } from '../config/pricing';
import { can } from '../config/roles';
import { ViewContext } from './context';
import { allowanceForGranularity } from '../utils/billing';
import { bucketCounts, bucketDailyUsage, granularityWarning } from '../utils/timeBuckets';
import { formatCurrency, formatDuration, formatPercent } from '../utils/formatters';
import { Badge, Callout, Card, EmptyState, SectionHeading, StatTile } from '../components/ui';
import { GranularityToggle, UnverifiedBadge } from '../components/domain';
import {
  CountsAreaChart,
  ModuleTrendGrid,
  UsageVsAllowanceBars,
  formatModuleQuantity,
} from '../components/charts';
import { AnalyticsChart } from '../components/AnalyticsChart';
import { ExecutiveBanner } from '../components/ExecutiveBanner';
import { InsightPanel } from '../components/InsightPanel';
import { NearLimitUsersTable } from '../components/NearLimitUsersTable';
import { computeBannerSummary, generateInsights } from '../utils/insights';
import { ProvenanceBanner } from '../components/ProvenanceBanner';
import { usePalette } from '../theme';

export interface OverviewRefs {
  usageTrend: React.MutableRefObject<HTMLDivElement | null>;
  tierBreakdown: React.MutableRefObject<HTMLDivElement | null>;
  providerBreakdown: React.MutableRefObject<HTMLDivElement | null>;
  growth: React.MutableRefObject<HTMLDivElement | null>;
}

export const OverviewView: React.FC<{ ctx: ViewContext; refs: OverviewRefs }> = ({ ctx, refs }) => {
  const palette = usePalette();
  const data = ctx.summary;
  const banner = useMemo(() => computeBannerSummary(data), [data]);
  const insights = useMemo(() => generateInsights(data), [data]);

  const buckets = useMemo(
    () => bucketDailyUsage(data.daily_usage_trend, ctx.granularity),
    [data.daily_usage_trend, ctx.granularity]
  );

  const allowances = useMemo(() => {
    const result: Partial<Record<ModuleKey, number | null>> = {};
    for (const module of MODULE_KEYS) {
      const included = ctx.rollup.modules.find((m) => m.module === module)?.totalIncluded ?? 0;
      result[module] = allowanceForGranularity(included, ctx.granularity);
    }
    return result;
  }, [ctx.rollup.modules, ctx.granularity]);

  const allowancesPerCycle = useMemo(() => {
    const result: Partial<Record<ModuleKey, number | null>> = {};
    for (const module of MODULE_KEYS) {
      result[module] = ctx.rollup.modules.find((m) => m.module === module)?.totalIncluded ?? 0;
    }
    return result;
  }, [ctx.rollup.modules]);

  const growthBuckets = useMemo(
    () => bucketCounts(data.growth?.by_day ?? {}, ctx.granularity),
    [data.growth, ctx.granularity]
  );

  const tierChartData = useMemo(
    () =>
      TIER_ORDER.map((tier) => ({
        name: TIERS[tier].label,
        value: ctx.rollup.tierCounts[tier] ?? 0,
        color: palette.tier(tier),
      })).filter((row) => row.value > 0),
    [ctx.rollup.tierCounts, palette]
  );

  const channelChartData = useMemo(() => {
    // Channels borrow the series palette so they re-theme with everything else.
    const labels: Record<string, { name: string; color: string }> = {
      stripe: { name: 'Stripe direct', color: palette.module('meeting_time') },
      gcp_marketplace: { name: 'Google Marketplace', color: palette.tier('enterprise') },
    };
    return Object.entries(data.billing_provider_breakdown ?? {}).map(([key, value]) => ({
      name: labels[key]?.name ?? key.replace(/_/g, ' '),
      value,
      color: labels[key]?.color ?? palette.module('proposal'),
    }));
  }, [data.billing_provider_breakdown, palette]);

  const realMrr = data.revenue.real_mrr_usd ?? data.revenue.mrr_usd;
  const realArr = data.revenue.real_arr_usd ?? data.revenue.arr_usd;
  const warning = granularityWarning(ctx.granularity, ctx.days);

  return (
    <div className="space-y-6 stagger">
      <ExecutiveBanner summary={banner} />

      <section aria-label="Headline metrics" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Defense in depth: the nav already withholds this page from layers without
            revenue access, but the tile checks the permission itself too. */}
        {can(ctx.role, 'view:revenue') && (
          <StatTile
            label="Net MRR"
            value={formatCurrency(realMrr)}
            hint={`${formatCurrency(realArr)} ARR · net of coupons`}
            tone="success"
            icon={<DollarSign className="w-4 h-4" />}
            footnote={
              data.revenue.exempted_subscriber_count
                ? `${data.revenue.exempted_subscriber_count} exempt accounts excluded from revenue`
                : undefined
            }
          />
        )}
        <StatTile
          label="Live overage (this cycle)"
          value={formatCurrency(ctx.rollup.totalOverageUsd)}
          hint={`${ctx.rollup.usersWithOverage} accounts accruing now`}
          tone={ctx.rollup.totalOverageUsd > 0 ? 'danger' : 'success'}
          icon={<Gauge className="w-4 h-4" />}
          footnote="Uninvoiced — separate from receivables (§4.2)"
        />
        <StatTile
          label="Unpaid renewals & overages"
          value={formatCurrency(data.accounts_receivable.total_outstanding_usd)}
          hint={`${data.accounts_receivable.open_invoice_count} open invoices`}
          tone={data.accounts_receivable.overdue_invoice_count > 0 ? 'danger' : 'neutral'}
          badge={
            data.accounts_receivable.overdue_invoice_count > 0 ? (
              <Badge tone="danger">{data.accounts_receivable.overdue_invoice_count} overdue</Badge>
            ) : undefined
          }
        />
        {can(ctx.role, 'view:churn') && (
          <StatTile
            label="Churn rate"
            value={formatPercent(data.churn.churn_rate)}
            hint={`${data.churn.canceled_in_period} cancelled of ${data.churn.active_at_period_start_estimate} at period start`}
            tone={data.churn.churn_rate > 0.1 ? 'warning' : 'neutral'}
            icon={<UserX className="w-4 h-4" />}
            footnote="Approximate — no subscription history table exists yet"
          />
        )}
      </section>

      <section aria-label="Product usage" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {MODULE_KEYS.map((module) => {
          const feature = data.features[module];
          const rollup = ctx.rollup.modules.find((m) => m.module === module);
          const def = MODULES[module];
          return (
            <StatTile
              key={module}
              label={def.label}
              value={formatModuleQuantity(module, feature.total_units)}
              hint={`${feature.active_users} active users · avg ${
                def.sourceUnit === 'seconds'
                  ? formatDuration(feature.avg_per_active_user)
                  : feature.avg_per_active_user.toFixed(1)
              } each`}
              badge={rollup?.unreliable ? <UnverifiedBadge /> : undefined}
              footnote={
                rollup && rollup.totalOverageUsd > 0
                  ? `${formatCurrency(rollup.totalOverageUsd)} overage · ${rollup.usersOverLimit} over allowance`
                  : 'Within allowance across all accounts'
              }
              title={
                def.sourceUnit === 'seconds'
                  ? `${feature.total_units.toLocaleString()} seconds captured`
                  : `${feature.total_units.toLocaleString()} units`
              }
            />
          );
        })}
      </section>

      <Card>
        <SectionHeading
          title="Usage trend"
          requirement="§4.1 · §4.6"
          subtitle="Per module, each on its own scale — meeting seconds and proposal counts can't share an axis. Dashed line is the org allowance for the bucket."
          icon={<BarChart3 className="w-5 h-5 text-accent" />}
          actions={<GranularityToggle value={ctx.granularity} onChange={ctx.onGranularityChange} />}
        />
        {warning && (
          <Callout tone="neutral" className="mb-3">
            {warning}
          </Callout>
        )}
        <div ref={refs.usageTrend}>
          <ModuleTrendGrid buckets={buckets} allowances={allowances} allowancesPerCycle={allowancesPerCycle} />
        </div>
      </Card>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <div ref={refs.tierBreakdown}>
            <SectionHeading
              title="Tier mix"
              requirement="§4.3"
              subtitle="Active subscriptions by plan tier, with Enterprise as a first-class tier."
              icon={<PieIcon className="w-5 h-5 text-accent" />}
            />
            {tierChartData.length === 0 ? (
              <EmptyState title="No active subscriptions" />
            ) : (
              <AnalyticsChart type="donut" data={tierChartData} centerLabel="Accounts" />
            )}
          </div>
        </Card>

        <Card>
          <div ref={refs.providerBreakdown}>
            <SectionHeading
              title="Billing channels"
              requirement="§4.4"
              subtitle="Subscriptions per billing channel — who invoices and who collects. Not a count of payment providers."
              icon={<Activity className="w-5 h-5 text-accent" />}
            />
            {channelChartData.length === 0 ? (
              <EmptyState title="No billing channel data" />
            ) : (
              <AnalyticsChart type="donut" data={channelChartData} centerLabel="Subs" />
            )}
          </div>
        </Card>
      </section>

      <Card>
        <div ref={refs.growth}>
          <SectionHeading
            title={`Subscription growth — ${data.growth?.total ?? 0} new activations`}
            requirement="§4.5"
            subtitle="Kept as-is; the metric was flagged as already working well."
            icon={<Users className="w-5 h-5 text-positive" />}
            actions={<GranularityToggle value={ctx.granularity} onChange={ctx.onGranularityChange} />}
          />
          {growthBuckets.length === 0 ? (
            <EmptyState title="No new activations in this window" />
          ) : (
            <CountsAreaChart data={growthBuckets.map((b) => ({ label: b.label, count: b.count }))} height={200} />
          )}
        </div>
      </Card>

      {/* Live upsell targets straight from the API — not derived from the preview layer. */}
      <div>
        <NearLimitUsersTable users={data.near_limit_users} />
        <p className="text-[11px] text-muted mt-2 px-1">
          This list uses the <em>backend&apos;s own</em> limit configuration and currently returns{' '}
          {data.near_limit_users.length} account{data.near_limit_users.length === 1 ? '' : 's'}. The allowance model in
          this dashboard (§3) is applied client-side and independently counts {ctx.rollup.usersWithOverage} account
          {ctx.rollup.usersWithOverage === 1 ? '' : 's'} already over an allowance — the two disagree because the
          backend limits have not been set to the §3 package values. Worth reconciling before either number is quoted.
        </p>
      </div>

      <ProvenanceBanner layer={ctx.userLayer} compact />

      <InsightPanel insights={insights} />
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* §4.6 Module usage                                                   */
/* ------------------------------------------------------------------ */

export const ModulesView: React.FC<{ ctx: ViewContext }> = ({ ctx }) => {
  const palette = usePalette();
  const buckets = useMemo(
    () => bucketDailyUsage(ctx.summary.daily_usage_trend, ctx.granularity),
    [ctx.summary.daily_usage_trend, ctx.granularity]
  );
  const warning = granularityWarning(ctx.granularity, ctx.days);

  return (
    <div className="space-y-5 stagger">
      <ProvenanceBanner layer={ctx.userLayer} compact />

      <Card padded={false} className="px-5 py-4">
        <SectionHeading
          title="Module usage vs package allowance"
          requirement="§4.6"
          subtitle="Every module against the allowance included in the base packages, with the overage trigger drawn in."
          icon={<Gauge className="w-5 h-5 text-accent" />}
          actions={<GranularityToggle value={ctx.granularity} onChange={ctx.onGranularityChange} />}
        />
        {warning && <Callout tone="neutral">{warning}</Callout>}
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {MODULE_KEYS.map((module) => {
          const def = MODULES[module];
          const rollup = ctx.rollup.modules.find((m) => m.module === module);
          const allowance = allowanceForGranularity(rollup?.totalIncluded ?? 0, ctx.granularity);
          const feature = ctx.summary.features[module];

          const bars = buckets.map((bucket) => {
            const used = bucket[module] || 0;
            const cap = allowance ?? 0;
            return {
              label: bucket.label,
              included: cap > 0 ? Math.min(used, cap) : used,
              overage: cap > 0 ? Math.max(0, used - cap) : 0,
            };
          });

          const triggered = bars.some((bar) => bar.overage > 0);

          return (
            <Card key={module}>
              <SectionHeading
                title={def.label}
                subtitle={def.helpText}
                icon={<span className="w-3 h-3 rounded-full" style={{ backgroundColor: palette.module(def.key) }} />}
                actions={
                  <>
                    {rollup?.unreliable && <UnverifiedBadge />}
                    <Badge tone={triggered ? 'danger' : 'success'}>
                      {triggered ? 'overage triggered' : 'within allowance'}
                    </Badge>
                  </>
                }
              />

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-xl border border-line bg-sunken p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted font-bold">Used</p>
                  <p className="text-base font-bold text-ink num">
                    {formatModuleQuantity(module, feature.total_units)}
                  </p>
                </div>
                <div className="rounded-xl border border-line bg-sunken p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted font-bold">Adoption</p>
                  <p className="text-base font-bold text-ink num">
                    {feature.active_users}
                    <span className="text-xs text-muted font-medium"> / {ctx.rollup.userCount}</span>
                  </p>
                </div>
                <div className="rounded-xl border border-line bg-sunken p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted font-bold">Overage</p>
                  <p
                    className={`text-base font-bold num ${
                      (rollup?.totalOverageUsd ?? 0) > 0 ? 'text-critical' : 'text-ink'
                    }`}
                  >
                    {formatCurrency(rollup?.totalOverageUsd ?? 0)}
                  </p>
                </div>
              </div>

              <UsageVsAllowanceBars module={module} data={bars} allowance={allowance} height={200} />

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: palette.module(def.key) }} />
                  Within allowance
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-critical" />
                  Overage at {formatCurrency(def.overageRateUsd)}/{def.rateUnit}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-4 border-t-2 border-dashed border-critical" />
                  Org allowance ({allowance ? formatModuleQuantity(module, allowance) : 'n/a'})
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      <Callout tone="info" icon={<TrendingUp className="w-4 h-4 text-accent" />} title="Reading the allowance line">
        The allowance line is the sum of every account&apos;s included allowance, rescaled to the selected bucket
        (a monthly allowance shown on a weekly chart is ÷ 4.3). Individual accounts can be far over while the org
        aggregate sits under the line — the per-user and overage views are where that shows up.
      </Callout>
    </div>
  );
};
