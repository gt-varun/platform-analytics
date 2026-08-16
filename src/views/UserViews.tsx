import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CircleUser,
  Layers,
  Lock,
  Search,
  TrendingUp,
  UserRound,
  Users as UsersIcon,
  X,
} from 'lucide-react';
import { MODULES, MODULE_KEYS, TIERS, TIER_ORDER, TierId, includedSourceUnits } from '../config/pricing';
import { can } from '../config/roles';
import { ViewContext } from './context';
import { UserBilling } from '../types/platform';
import { allowanceForGranularity, TENURE_BANDS, tenureBand } from '../utils/billing';
import { bucketDailyUsage, granularityWarning } from '../utils/timeBuckets';
import {
  formatCredits,
  formatCurrency,
  formatDate,
  formatModuleValue,
  formatMonths,
} from '../utils/formatters';
import {
  Badge,
  Callout,
  Card,
  EmptyState,
  Meter,
  Pagination,
  SectionHeading,
  StatTile,
  TableWrap,
  usePagination,
} from '../components/ui';
import { GranularityToggle, RecommendationBadge, TierBadge, UnverifiedBadge } from '../components/domain';
import { ModuleAllowanceList } from '../components/ModuleAllowance';
import { HorizontalBars, ModuleTrendGrid, formatModuleQuantity } from '../components/charts';
import { ProvenanceBanner } from '../components/ProvenanceBanner';
import { usePalette } from '../theme';

/* ------------------------------------------------------------------ */
/* Shared per-user body — used by My Usage and the drill-down drawer    */
/* ------------------------------------------------------------------ */

export const UserUsagePanels: React.FC<{
  billing: UserBilling;
  ctx: ViewContext;
  showIdentity?: boolean;
}> = ({ billing, ctx, showIdentity = true }) => {
  const { user, lines, recommendation } = billing;
  const buckets = useMemo(
    () => bucketDailyUsage(user.daily, ctx.granularity),
    [user.daily, ctx.granularity]
  );
  const allowances = useMemo(
    () =>
      Object.fromEntries(
        lines.map((line) => [line.module, allowanceForGranularity(line.included, ctx.granularity)])
      ) as Partial<Record<(typeof MODULE_KEYS)[number], number | null>>,
    [lines, ctx.granularity]
  );
  const allowancesPerCycle = useMemo(
    () =>
      Object.fromEntries(lines.map((line) => [line.module, line.included])) as Partial<
        Record<(typeof MODULE_KEYS)[number], number | null>
      >,
    [lines]
  );
  const warning = granularityWarning(ctx.granularity, ctx.days);
  const cycleDaysLeft = Math.max(
    0,
    Math.ceil((new Date(user.billing_cycle_end).getTime() - Date.now()) / 86_400_000)
  );

  return (
    // No `stagger` here — this panel is nested inside My Usage and the drill-down
    // drawer, both of which already stagger; nesting would animate it twice.
    <div className="space-y-5">
      {showIdentity && (
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-sunken border border-line flex items-center justify-center shrink-0">
                <CircleUser className="w-5 h-5 text-muted" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-bold text-ink truncate">{user.display_name}</p>
                <p className="text-xs text-muted truncate">
                  {user.email} · {user.org_name}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <TierBadge tier={user.tier} />
              <Badge tone={user.billing_provider === 'stripe' ? 'info' : 'violet'}>
                {user.billing_provider === 'stripe' ? 'Stripe direct' : 'GCP Marketplace'}
              </Badge>
              {user.is_exempt && (
                <Badge tone="neutral" title="100%-off migration coupon — plan line bills $0, overage still accrues">
                  exempt
                </Badge>
              )}
              {billing.overTenureCap && (
                <Badge tone="warning" icon={<CalendarClock className="w-3 h-3" />}>
                  past {TIERS[user.tier].tenureCapMonths}-mo cap
                </Badge>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Live cycle position */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatTile
          label="Overage this cycle"
          value={formatCurrency(billing.totalOverageUsd)}
          hint={`${formatCredits(billing.totalOverageCredits)} · accruing live, not yet invoiced`}
          tone={billing.totalOverageUsd > 0 ? 'danger' : 'success'}
          badge={billing.totalOverageUsd > 0 ? <Badge tone="danger">over</Badge> : <Badge tone="success">within plan</Badge>}
        />
        <StatTile
          label="Projected invoice"
          value={billing.projectedInvoiceUsd == null ? 'Contract' : formatCurrency(billing.projectedInvoiceUsd)}
          hint={
            billing.planPriceUsd == null
              ? 'Negotiated Enterprise contract'
              : `${user.is_exempt ? '$0 plan (exempt)' : formatCurrency(billing.planPriceUsd) + ' plan'} + overage`
          }
          tone="info"
        />
        <StatTile
          label="Tenure on tier"
          value={formatMonths(billing.tenureMonths)}
          hint={`On ${TIERS[user.tier].label} since ${formatDate(user.tier_started_at)}`}
          tone={billing.overTenureCap ? 'warning' : 'neutral'}
          footnote={
            TIERS[user.tier].tenureCapMonths
              ? `Proposed cap: ${TIERS[user.tier].tenureCapMonths} months (tracked, not enforced)`
              : undefined
          }
        />
        <StatTile
          label="Billing cycle"
          value={`${Math.round(billing.cycleProgress * 100)}%`}
          hint={`${cycleDaysLeft} day${cycleDaysLeft === 1 ? '' : 's'} to ${formatDate(user.billing_cycle_end)}`}
          tone="neutral"
          footnote={`Cycle started ${formatDate(user.billing_cycle_start)}`}
        />
      </div>

      {/* Plan fit */}
      <Callout
        tone={
          recommendation.action === 'stay'
            ? 'success'
            : recommendation.action === 'upgrade'
            ? 'warning'
            : recommendation.action === 'downgrade'
            ? 'info'
            : 'violet'
        }
        icon={<TrendingUp className="w-4 h-4" />}
        title={
          recommendation.action === 'stay'
            ? 'Already on the cheapest plan for this usage'
            : recommendation.action === 'review_enterprise'
            ? 'Usage warrants an Enterprise conversation'
            : `${recommendation.action === 'upgrade' ? 'Move up to' : 'Move down to'} ${
                TIERS[recommendation.recommendedTier].label
              } — saves ${formatCurrency(recommendation.savingsUsd)}/mo`
        }
      >
        <p>{recommendation.rationale}</p>
        {recommendation.action !== 'stay' && (
          <p className="mt-1.5 text-muted">
            Today: {formatCurrency(recommendation.currentMonthlyUsd)}/mo on {TIERS[recommendation.currentTier].label} ·
            Recommended: {formatCurrency(recommendation.recommendedMonthlyUsd)}/mo
          </p>
        )}
      </Callout>

      {/* Allowance consumption per module */}
      <Card>
        <SectionHeading
          title="Usage against plan allowance"
          subtitle="Current billing cycle. Meeting time reads in days, hours and minutes; every module also prices its overage."
        />
        <ModuleAllowanceList lines={lines} />
      </Card>

      {/* Trend with granularity toggle */}
      <Card>
        <SectionHeading
          title="Usage trend"
          subtitle="Dashed line marks the allowance for the selected bucket — where it is crossed, overage starts."
          actions={<GranularityToggle value={ctx.granularity} onChange={ctx.onGranularityChange} />}
        />
        {warning && (
          <Callout tone="neutral" className="mb-3" icon={<AlertTriangle className="w-4 h-4 text-muted" />}>
            {warning}
          </Callout>
        )}
        <ModuleTrendGrid buckets={buckets} allowances={allowances} allowancesPerCycle={allowancesPerCycle} />
      </Card>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* User layer (§2, §4.1)                                               */
/* ------------------------------------------------------------------ */

export const MyUsageView: React.FC<{ ctx: ViewContext }> = ({ ctx }) => {
  const { currentUser, userLayer } = ctx;

  if (!currentUser) {
    return (
      <Card>
        <EmptyState
          title="No account resolved for this session"
          description="In production this view reads /me/usage for the signed-in user. No per-user data is available right now."
          icon={<UserRound className="w-8 h-8" />}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-5 stagger">
      <ProvenanceBanner layer={userLayer} />

      {userLayer.source === 'preview' && (
        <Card padded={false} className="px-4 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <p className="text-xs text-muted">
              <span className="font-semibold text-ink">Prototype control:</span> the User layer normally binds to
              the signed-in account. Simulate a different account to sanity-check the view.
            </p>
            <select
              value={currentUser.user.user_id}
              onChange={(event) => ctx.onCurrentUserChange(event.target.value)}
              className="bg-surface border border-line rounded-xl text-xs font-semibold text-ink px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/30 max-w-full"
            >
              {ctx.billings.map((billing) => (
                <option key={billing.user.user_id} value={billing.user.user_id}>
                  {billing.user.display_name} — {TIERS[billing.user.tier].label} ·{' '}
                  {formatCurrency(billing.totalOverageUsd)} overage
                </option>
              ))}
            </select>
          </div>
        </Card>
      )}

      <UserUsagePanels billing={currentUser} ctx={ctx} />

      <Callout tone="neutral" icon={<Lock className="w-4 h-4 text-muted" />}>
        This layer shows your data only. No other account&apos;s usage is loaded into this view — the access model makes that the
        hard boundary the other three layers are built on top of.
      </Callout>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Per-user table + drill-down (Management / Super Admin)              */
/* ------------------------------------------------------------------ */

type SortKey = 'overage' | 'usage' | 'tenure' | 'unpaid' | 'name';

export const UsersView: React.FC<{ ctx: ViewContext }> = ({ ctx }) => {
  const palette = usePalette();
  const [query, setQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<TierId | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('overage');

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = ctx.billings.filter((billing) => {
      if (tierFilter !== 'all' && billing.user.tier !== tierFilter) return false;
      if (!needle) return true;
      const user = billing.user;
      return [user.display_name, user.email, user.org_name, user.user_id]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });

    const sorters: Record<SortKey, (a: UserBilling, b: UserBilling) => number> = {
      overage: (a, b) => b.totalOverageUsd - a.totalOverageUsd,
      usage: (a, b) => b.user.cycle_usage.meeting_time - a.user.cycle_usage.meeting_time,
      tenure: (a, b) => b.tenureMonths - a.tenureMonths,
      unpaid: (a, b) => b.user.unpaid_usd - a.user.unpaid_usd,
      name: (a, b) => a.user.display_name.localeCompare(b.user.display_name),
    };
    return [...filtered].sort(sorters[sortKey]);
  }, [ctx.billings, query, tierFilter, sortKey]);

  // Re-sorting or re-filtering changes what the list means, so the reader goes
  // back to page 1 rather than landing mid-way through unfamiliar data.
  const pager = usePagination(rows, 12, `${query}|${tierFilter}|${sortKey}`);

  const selected = ctx.selectedUserId
    ? ctx.billings.find((billing) => billing.user.user_id === ctx.selectedUserId) ?? null
    : null;

  return (
    <div className="space-y-5 stagger">
      <ProvenanceBanner layer={ctx.userLayer} />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatTile label="Accounts in scope" value={String(ctx.rollup.userCount)} hint={`${ctx.rollup.payingUserCount} paying · ${ctx.rollup.exemptUserCount} exempt`} />
        <StatTile
          label="Accruing overage now"
          value={String(ctx.rollup.usersWithOverage)}
          hint="Users over at least one allowance this cycle"
          tone={ctx.rollup.usersWithOverage > 0 ? 'warning' : 'success'}
        />
        <StatTile
          label="Live overage value"
          value={formatCurrency(ctx.rollup.totalOverageUsd)}
          hint={`${formatCredits(ctx.rollup.totalOverageUsd)} across all accounts`}
          tone={ctx.rollup.totalOverageUsd > 0 ? 'danger' : 'success'}
        />
        <StatTile
          label="Plan-change candidates"
          value={String(ctx.rollup.upgradeCandidates)}
          hint="Cheaper on another tier at current usage"
          tone={ctx.rollup.upgradeCandidates > 0 ? 'info' : 'neutral'}
        />
      </div>

      <Card>
        <SectionHeading
          title="Per-user usage"
          subtitle="The lowest-level view every other layer aggregates from. Select a row for the full drill-down."
          icon={<UsersIcon className="w-5 h-5 text-accent" />}
          actions={
            <>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search account, org or ID"
                  className="bg-surface border border-line rounded-xl text-xs text-ink pl-8 pr-3 py-2 w-56 focus:outline-none focus:ring-2 focus:ring-accent/30 placeholder:text-subtle"
                />
              </div>
              <select
                value={tierFilter}
                onChange={(event) => setTierFilter(event.target.value as TierId | 'all')}
                className="bg-surface border border-line rounded-xl text-xs font-semibold text-ink px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/30"
              >
                <option value="all">All tiers</option>
                {TIER_ORDER.map((tier) => (
                  <option key={tier} value={tier}>
                    {TIERS[tier].label}
                  </option>
                ))}
              </select>
              <select
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value as SortKey)}
                className="bg-surface border border-line rounded-xl text-xs font-semibold text-ink px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/30"
              >
                <option value="overage">Sort: overage</option>
                <option value="usage">Sort: meeting minutes</option>
                <option value="tenure">Sort: tenure</option>
                <option value="unpaid">Sort: unpaid</option>
                <option value="name">Sort: name</option>
              </select>
            </>
          }
        />

        {rows.length === 0 ? (
          <EmptyState title="No accounts match" description="Clear the search or tier filter." />
        ) : (
          <TableWrap>
            <table className="w-full text-left text-xs border-collapse min-w-[980px]">
              <thead>
                <tr className="text-muted font-semibold border-b border-line text-[11px] uppercase">
                  <th className="pb-3 pr-3">Account</th>
                  <th className="pb-3 px-3">Tier · tenure</th>
                  {MODULE_KEYS.map((module) => (
                    <th key={module} className="pb-3 px-3">
                      {MODULES[module].shortLabel}
                    </th>
                  ))}
                  <th className="pb-3 px-3 text-right">Overage (cycle)</th>
                  <th className="pb-3 pl-3">Plan fit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pager.pageItems.map((billing) => (
                  <tr
                    key={billing.user.user_id}
                    onClick={() => ctx.onSelectUser(billing.user.user_id)}
                    className="hover:bg-sunken transition-colors cursor-pointer"
                  >
                    <td className="py-3 pr-3 max-w-[220px]">
                      <div className="font-semibold text-ink truncate">{billing.user.display_name}</div>
                      <div className="text-[11px] text-muted truncate">{billing.user.org_name}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-col gap-1">
                        <TierBadge tier={billing.user.tier} />
                        <span
                          className={`text-[11px] num ${billing.overTenureCap ? 'text-caution' : 'text-muted'}`}
                        >
                          {formatMonths(billing.tenureMonths)}
                          {billing.overTenureCap ? ' · past cap' : ''}
                        </span>
                      </div>
                    </td>
                    {billing.lines.map((line) => (
                      <td key={line.module} className="py-3 px-3 min-w-[110px]">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-ink font-medium num">
                            {formatModuleQuantity(line.module, line.used)}
                          </span>
                          {/* Only flag rows where the unreliable counter actually reports something. */}
                          {line.unreliable && line.used > 0 && <UnverifiedBadge label="?" />}
                        </div>
                        <Meter percent={line.percentUsed} color={palette.module(line.module)} compact />
                      </td>
                    ))}
                    <td className="py-3 px-3 text-right">
                      <div
                        className={`font-bold num ${billing.totalOverageUsd > 0 ? 'text-critical' : 'text-muted'}`}
                      >
                        {formatCurrency(billing.totalOverageUsd)}
                      </div>
                      {billing.user.unpaid_usd > 0 && (
                        <div className="text-[11px] text-caution">{formatCurrency(billing.user.unpaid_usd)} unpaid</div>
                      )}
                    </td>
                    <td className="py-3 pl-3">
                      <RecommendationBadge recommendation={billing.recommendation} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}

        <Pagination state={pager} noun={rows.length === ctx.billings.length ? 'accounts' : `of ${ctx.billings.length} accounts`} />

        <p className="text-[11px] text-muted mt-2">
          Usage columns are current-billing-cycle totals; meeting time reads in days, hours and minutes.
        </p>
      </Card>

      {selected && <UserDetailDrawer billing={selected} ctx={ctx} />}
    </div>
  );
};

const UserDetailDrawer: React.FC<{ billing: UserBilling; ctx: ViewContext }> = ({ billing, ctx }) => {
  const close = ctx.onSelectUser;

  // Escape closes it, and the page behind is locked so a scroll gesture over the
  // drawer cannot quietly move the table underneath it.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(null);
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [close]);

  return (
  <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label="Account detail">
    <button
      aria-label="Close detail"
      className="absolute inset-0 bg-scrim backdrop-blur-[2px] animate-fade"
      onClick={() => close(null)}
    />
    <div className="relative w-full max-w-3xl h-full overflow-y-auto bg-canvas border-l border-line p-5 sm:p-6 shadow-[-12px_0_40px_rgba(0,0,0,0.28)] animate-drawer">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted font-bold">Drill-down</p>
          <h2 className="text-xl font-bold text-ink">{billing.user.display_name}</h2>
          <p className="text-xs text-muted">
            {billing.user.email} · joined {formatDate(billing.user.subscription_started_at)} ·{' '}
            {billing.user.last_active_at ? `last active ${formatDate(billing.user.last_active_at)}` : 'no activity in window'}
          </p>
        </div>
        <button
          onClick={() => ctx.onSelectUser(null)}
          className="p-2 rounded-xl border border-line text-muted hover:text-ink hover:bg-surface"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <UserUsagePanels billing={billing} ctx={ctx} showIdentity={false} />

      {(billing.user.churn_reason || billing.user.renewal_reason) && can(ctx.role, 'view:churn') && (
        <Callout tone={billing.user.churn_reason ? 'danger' : 'success'} className="mt-5">
          <span className="font-semibold text-ink">
            {billing.user.churn_reason ? 'Cancellation reason: ' : 'Renewal reason: '}
          </span>
          {billing.user.churn_reason ?? billing.user.renewal_reason}
        </Callout>
      )}
    </div>
  </div>
  );
};

/* ------------------------------------------------------------------ */
/* Admin layer — rollups only, never individual rows (§2)              */
/* ------------------------------------------------------------------ */

export const RollupView: React.FC<{ ctx: ViewContext }> = ({ ctx }) => {
  const palette = usePalette();
  const { rollup } = ctx;
  const showsIndividuals = can(ctx.role, 'view:user_detail');

  const buckets = useMemo(() => {
    const merged = ctx.summary.daily_usage_trend.map((point) => ({
      day: point.day,
      meeting_time: point.meeting_time,
      kyc_count: point.kyc_count,
      simulator: point.simulator,
      proposal: point.proposal,
    }));
    return bucketDailyUsage(merged, ctx.granularity);
  }, [ctx.summary.daily_usage_trend, ctx.granularity]);

  const allowances = useMemo(() => {
    const result: Partial<Record<(typeof MODULE_KEYS)[number], number | null>> = {};
    for (const module of MODULE_KEYS) {
      const orgIncluded = rollup.modules.find((m) => m.module === module)?.totalIncluded ?? 0;
      result[module] = allowanceForGranularity(orgIncluded, ctx.granularity);
    }
    return result;
  }, [rollup.modules, ctx.granularity]);

  const allowancesPerCycle = useMemo(() => {
    const result: Partial<Record<(typeof MODULE_KEYS)[number], number | null>> = {};
    for (const module of MODULE_KEYS) {
      result[module] = rollup.modules.find((m) => m.module === module)?.totalIncluded ?? 0;
    }
    return result;
  }, [rollup.modules]);

  const tenureData = useMemo(() => {
    const counts = new Map<string, number>(TENURE_BANDS.map((band) => [band, 0]));
    for (const billing of ctx.billings) {
      const band = tenureBand(billing.tenureMonths);
      counts.set(band, (counts.get(band) ?? 0) + 1);
    }
    return TENURE_BANDS.map((band) => ({
      label: `${band} mo`,
      value: counts.get(band) ?? 0,
      color: band === '3-6' || band === '6-12' || band === '12+' ? palette.module('simulator') : palette.module('meeting_time'),
      note: band === '0-1' || band === '1-3' ? 'within proposed Starter cap' : 'past the proposed 3-month Starter cap',
    }));
  }, [ctx.billings, palette]);

  return (
    <div className="space-y-5 stagger">
      <ProvenanceBanner layer={ctx.userLayer} />

      {!showsIndividuals && (
        <Callout tone="info" icon={<Lock className="w-4 h-4 text-accent" />} title="Aggregated view by design">
          The Admin layer sees summarised usage across every user in scope — never another individual&apos;s raw
          detail. Counts and totals below are computed from the per-user layer, then stripped of identity.
        </Callout>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatTile label="Users in scope" value={String(rollup.userCount)} hint={`${rollup.exemptUserCount} on the 100%-off migration coupon`} icon={<UsersIcon className="w-4 h-4" />} />
        <StatTile
          label="Over allowance"
          value={String(rollup.usersWithOverage)}
          hint={`${rollup.modules.reduce((sum, m) => sum + m.usersNearLimit, 0)} more at 80%+ of a limit`}
          tone={rollup.usersWithOverage > 0 ? 'warning' : 'success'}
        />
        <StatTile
          label="Live overage value"
          value={formatCurrency(rollup.totalOverageUsd)}
          hint="Accrued this cycle across the org"
          tone={rollup.totalOverageUsd > 0 ? 'danger' : 'success'}
        />
        <StatTile
          label="Past Starter tenure cap"
          value={String(rollup.starterPastCap)}
          hint="Starters older than the proposed 3-month cap"
          tone={rollup.starterPastCap > 0 ? 'warning' : 'neutral'}
        />
      </div>

      <Card>
        <SectionHeading
          title="Module rollup"
          subtitle="Aggregated consumption against the sum of every account's included allowance."
          icon={<Layers className="w-5 h-5 text-accent" />}
        />
        <TableWrap>
          <table className="w-full text-left text-xs border-collapse min-w-[720px]">
            <thead>
              <tr className="text-muted font-semibold border-b border-line text-[11px] uppercase">
                <th className="pb-3 pr-3">Module</th>
                <th className="pb-3 px-3">Used</th>
                <th className="pb-3 px-3">Included (org)</th>
                <th className="pb-3 px-3 w-40">Consumption</th>
                <th className="pb-3 px-3 text-right">Users over / near</th>
                <th className="pb-3 pl-3 text-right">Overage value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rollup.modules.map((module) => {
                const def = MODULES[module.module];
                const percent = module.totalIncluded > 0 ? module.totalUsed / module.totalIncluded : null;
                return (
                  <tr key={module.module} className="hover:bg-sunken">
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: palette.module(def.key) }} />
                        <span className="font-semibold text-ink">{def.label}</span>
                        {module.unreliable && <UnverifiedBadge />}
                      </div>
                      <span className="text-[11px] text-muted">{module.activeUsers} active users</span>
                    </td>
                    <td className="py-3 px-3 text-ink font-medium num">
                      {formatModuleQuantity(module.module, module.totalUsed)}
                    </td>
                    <td className="py-3 px-3 text-muted num">
                      {formatModuleQuantity(module.module, module.totalIncluded)}
                    </td>
                    <td className="py-3 px-3">
                      <Meter percent={percent} color={palette.module(def.key)} />
                      <span className="text-[11px] text-muted num">
                        {percent == null ? '—' : `${Math.round(percent * 100)}%`}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right num">
                      <span className={module.usersOverLimit > 0 ? 'text-critical font-bold' : 'text-muted'}>
                        {module.usersOverLimit}
                      </span>
                      <span className="text-subtle"> / </span>
                      <span className="text-caution">{module.usersNearLimit}</span>
                    </td>
                    <td className="py-3 pl-3 text-right font-bold num text-ink">
                      {formatCurrency(module.totalOverageUsd)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      <Card>
        <SectionHeading
          title="Org usage trend"
          subtitle="Live aggregate series from /admin/usage-summary. The dashed line is the org-wide allowance for each bucket."
          actions={<GranularityToggle value={ctx.granularity} onChange={ctx.onGranularityChange} />}
        />
        <ModuleTrendGrid buckets={buckets} allowances={allowances} allowancesPerCycle={allowancesPerCycle} />
      </Card>

      <Card>
        <SectionHeading
          title="Tenure distribution"
          subtitle="How long accounts have held their current tier — the evidence base for the proposed 3-month Starter cap."
        />
        <HorizontalBars data={tenureData} valueFormatter={(v) => `${Math.round(v)}`} height={210} />
        <p className="text-[11px] text-muted mt-2">
          {rollup.starterPastCap} Starter account{rollup.starterPastCap === 1 ? '' : 's'} would be forced to migrate today
          if the cap were enforced.
        </p>
      </Card>

      <Card>
        <SectionHeading title="Tier mix" subtitle="Accounts by plan tier in this scope." />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {TIER_ORDER.map((tier) => {
            const count = ctx.rollup.tierCounts[tier];
            const included = includedSourceUnits(tier, 'meeting_time');
            return (
              <div key={tier} className="rounded-xl border border-line bg-sunken p-4">
                <div className="flex items-center justify-between mb-2">
                  <TierBadge tier={tier} />
                  <span className="text-xl font-extrabold text-ink num">{count}</span>
                </div>
                <p className="text-[11px] text-muted">
                  {included == null
                    ? 'Negotiated allowance per contract'
                    : `Includes ${formatModuleValue(included, 'seconds')} of meetings/cycle`}
                </p>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};
