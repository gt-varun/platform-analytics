import React, { useMemo, useState } from 'react';
import {
  AlertOctagon,
  ArrowUpRight,
  Banknote,
  Building2,
  CalendarClock,
  CreditCard,
  FileWarning,
  Gauge,
  Info,
  Receipt,
  TrendingUp,
} from 'lucide-react';
import {
  MODULES,
  MODULE_KEYS,
  ModuleKey,
  TIERS,
  TIER_ORDER,
  TierId,
  includedSourceUnits,
} from '../config/pricing';
import { can } from '../config/roles';
import { ViewContext } from './context';
import { allowanceForGranularity, upgradeBreakEven } from '../utils/billing';
import { bucketCounts, bucketDailyUsage, granularityWarning } from '../utils/timeBuckets';
import { formatCredits, formatCurrency, formatDate, formatMonths } from '../utils/formatters';
import {
  Badge,
  Callout,
  Card,
  EmptyState,
  Pagination,
  SectionHeading,
  StatTile,
  TableWrap,
  usePagination,
} from '../components/ui';
import { GranularityToggle, RecommendationBadge, TierBadge, UnverifiedBadge } from '../components/domain';
import { CountsAreaChart, HorizontalBars, UsageVsAllowanceBars, formatModuleQuantity } from '../components/charts';
import { ProvenanceBanner } from '../components/ProvenanceBanner';
import { usePalette } from '../theme';

/* ------------------------------------------------------------------ */
/* §4.2 Overage tracking                                               */
/* ------------------------------------------------------------------ */

export const OverageView: React.FC<{ ctx: ViewContext }> = ({ ctx }) => {
  const palette = usePalette();
  const [module, setModule] = useState<ModuleKey>('meeting_time');
  const showIdentity = can(ctx.role, 'view:user_detail') || can(ctx.role, 'view:invoices');
  const canDrill = can(ctx.role, 'view:user_detail');

  const topAccruing = useMemo(
    () => [...ctx.billings].filter((b) => b.totalOverageUsd > 0).sort((a, b) => b.totalOverageUsd - a.totalOverageUsd),
    [ctx.billings]
  );
  const accruingPager = usePagination(topAccruing, 10);

  const buckets = useMemo(
    () => bucketDailyUsage(ctx.summary.daily_usage_trend, ctx.granularity),
    [ctx.summary.daily_usage_trend, ctx.granularity]
  );

  const orgAllowance = useMemo(() => {
    const rollupModule = ctx.rollup.modules.find((m) => m.module === module);
    return allowanceForGranularity(rollupModule?.totalIncluded ?? 0, ctx.granularity);
  }, [ctx.rollup.modules, module, ctx.granularity]);

  const splitBars = useMemo(
    () =>
      buckets.map((bucket) => {
        const used = bucket[module] || 0;
        const cap = orgAllowance ?? 0;
        return {
          label: bucket.label,
          included: cap > 0 ? Math.min(used, cap) : used,
          overage: cap > 0 ? Math.max(0, used - cap) : 0,
        };
      }),
    [buckets, module, orgAllowance]
  );

  const overageByModule = useMemo(
    () =>
      ctx.rollup.modules
        .map((m) => ({
          label: MODULES[m.module].label,
          value: m.totalOverageUsd,
          color: palette.module(m.module),
          note: m.unreliable ? 'under-reports — KYC bug §5.1' : undefined,
        }))
        .sort((a, b) => b.value - a.value),
    [ctx.rollup.modules, palette]
  );

  const ar = ctx.summary.accounts_receivable;
  const warning = granularityWarning(ctx.granularity, ctx.days);

  return (
    <div className="space-y-5 stagger">
      <ProvenanceBanner layer={ctx.userLayer} />

      {/* The §4.2 distinction, stated before any number is shown. */}
      <Callout tone="info" icon={<Info className="w-4 h-4 text-accent" />} title="Two different things, never mixed">
        <ul className="space-y-1 list-disc pl-4">
          <li>
            <span className="font-semibold text-ink">Live overage accrual</span> — usage past the included allowance
            in the <em>current, open</em> billing cycle. Not invoiced yet, changes by the hour.
          </li>
          <li>
            <span className="font-semibold text-ink">Unpaid renewals &amp; overages</span> — invoices already issued
            and still unpaid. This is what &quot;Outstanding Receivables&quot; now means, and nothing else.
          </li>
        </ul>
      </Callout>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatTile
          label="Live overage (this cycle)"
          value={formatCurrency(ctx.rollup.totalOverageUsd)}
          hint={`${formatCredits(ctx.rollup.totalOverageUsd)} · accruing now, not invoiced`}
          tone={ctx.rollup.totalOverageUsd > 0 ? 'danger' : 'success'}
          icon={<Gauge className="w-4 h-4" />}
        />
        <StatTile
          label="Accounts accruing"
          value={String(ctx.rollup.usersWithOverage)}
          hint={`of ${ctx.rollup.userCount} accounts in scope`}
          tone={ctx.rollup.usersWithOverage > 0 ? 'warning' : 'success'}
        />
        <StatTile
          label="Unpaid renewals & overages"
          value={formatCurrency(ar.total_outstanding_usd)}
          hint={`${ar.open_invoice_count} open invoice${ar.open_invoice_count === 1 ? '' : 's'} · ${formatCurrency(ar.overdue_usd)} overdue`}
          tone={ar.overdue_invoice_count > 0 ? 'danger' : 'neutral'}
          icon={<Receipt className="w-4 h-4" />}
          footnote="Invoiced and unpaid only — was “Outstanding Receivables” (§4.2)"
        />
        <StatTile
          label="Would invoice today"
          value={formatCurrency(ctx.rollup.totalOverageUsd + ar.total_outstanding_usd)}
          hint="Live accrual + already-unpaid, if every cycle closed now"
          tone="info"
        />
      </div>

      {ctx.rollup.modules.some((m) => m.unreliable) && (
        <Callout
          tone="danger"
          icon={<AlertOctagon className="w-4 h-4 text-critical" />}
          title="KYC overage tracking is broken (§5.1)"
        >
          KYC overage is blocked by a backend dependency tied to KYC initiation — initiated-but-uncompleted checks are
          not counted, so every KYC figure below <span className="font-semibold text-ink">under-reports</span>. Owner:
          Avi / backend, confirm via Sai. Each affected number carries an <UnverifiedBadge /> marker until the fix lands.
        </Callout>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <SectionHeading
            title="Overage by module"
            requirement="§4.2"
            subtitle="Live accrual this cycle, priced with the current rate card."
          />
          {overageByModule.every((row) => row.value === 0) ? (
            <EmptyState
              title="No overage accrued this cycle"
              description="Every account is inside its included allowance right now."
            />
          ) : (
            <HorizontalBars data={overageByModule} height={210} />
          )}
          <TableWrap>
            <table className="w-full text-left text-xs mt-3 border-collapse">
              <thead>
                <tr className="text-muted font-semibold border-b border-line text-[11px] uppercase">
                  <th className="pb-2 pr-3">Module</th>
                  <th className="pb-2 px-3">Rate</th>
                  <th className="pb-2 px-3 text-right">Units over</th>
                  <th className="pb-2 px-3 text-right">Accounts</th>
                  <th className="pb-2 pl-3 text-right">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ctx.rollup.modules.map((row) => {
                  const def = MODULES[row.module];
                  return (
                    <tr key={row.module}>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: palette.module(def.key) }} />
                          <span className="text-ink font-medium">{def.label}</span>
                          {row.unreliable && <UnverifiedBadge />}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-muted num">
                        {formatCurrency(def.overageRateUsd)}/{def.rateUnit}
                      </td>
                      <td className="py-2.5 px-3 text-right text-ink num">
                        {formatModuleQuantity(row.module, row.totalOverageUnits)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-muted num">{row.usersOverLimit}</td>
                      <td className="py-2.5 pl-3 text-right font-bold text-ink num">
                        {formatCurrency(row.totalOverageUsd)}
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
            title="Overage trigger"
            requirement="§4.6"
            subtitle="Where consumption crosses the org-wide allowance, the bar turns red — that segment is what bills."
            actions={
              <>
                <select
                  value={module}
                  onChange={(event) => setModule(event.target.value as ModuleKey)}
                  className="bg-surface border border-line rounded-xl text-xs font-semibold text-ink px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/30"
                >
                  {MODULE_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {MODULES[key].label}
                    </option>
                  ))}
                </select>
                <GranularityToggle value={ctx.granularity} onChange={ctx.onGranularityChange} />
              </>
            }
          />
          {warning && (
            <Callout tone="neutral" className="mb-3">
              {warning}
            </Callout>
          )}
          <UsageVsAllowanceBars module={module} data={splitBars} allowance={orgAllowance} />
          <div className="flex items-center gap-4 mt-2 text-[11px] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: palette.module(module) }} />
              Within allowance
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-critical" />
              Overage (billable)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 border-t-2 border-dashed border-critical" />
              Allowance
            </span>
          </div>
        </Card>
      </div>

      <Card>
        <SectionHeading
          title="Accounts accruing overage now"
          requirement="§4.2"
          subtitle={
            showIdentity
              ? 'Ranked by live accrual this cycle. Per user, per module.'
              : 'Ranked by live accrual. Identity is withheld in this layer (§2) — rollups only.'
          }
          icon={<Banknote className="w-5 h-5 text-caution" />}
        />
        {topAccruing.length === 0 ? (
          <EmptyState title="Nothing accruing" description="No account is over an allowance in the current cycle." />
        ) : (
          <TableWrap>
            <table className="w-full text-left text-xs border-collapse min-w-[760px]">
              <thead>
                <tr className="text-muted font-semibold border-b border-line text-[11px] uppercase">
                  <th className="pb-3 pr-3">Account</th>
                  <th className="pb-3 px-3">Tier</th>
                  {MODULE_KEYS.map((key) => (
                    <th key={key} className="pb-3 px-3 text-right">
                      {MODULES[key].shortLabel}
                    </th>
                  ))}
                  <th className="pb-3 px-3 text-right">Cycle overage</th>
                  <th className="pb-3 pl-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {accruingPager.pageItems.map((billing, index) => (
                  <tr
                    key={billing.user.user_id}
                    className={`hover:bg-sunken transition-colors ${canDrill ? 'cursor-pointer' : ''}`}
                    onClick={canDrill ? () => ctx.onSelectUser(billing.user.user_id) : undefined}
                  >
                    <td className="py-3 pr-3">
                      {showIdentity ? (
                        <>
                          <div className="font-semibold text-ink">{billing.user.display_name}</div>
                          <div className="text-[11px] text-muted">{billing.user.email}</div>
                        </>
                      ) : (
                        <span className="font-mono text-ink-2">Account #{accruingPager.from + index}</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <TierBadge tier={billing.user.tier} />
                    </td>
                    {billing.lines.map((line) => (
                      <td
                        key={line.module}
                        className={`py-3 px-3 text-right num ${line.overageUnits > 0 ? 'text-critical font-semibold' : 'text-muted'}`}
                      >
                        {line.overageUnits > 0 ? `+${formatModuleQuantity(line.module, line.overageUnits)}` : '—'}
                      </td>
                    ))}
                    <td className="py-3 px-3 text-right font-bold text-ink num">
                      {formatCurrency(billing.totalOverageUsd)}
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
        <Pagination state={accruingPager} noun="accounts accruing" />
      </Card>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* §4.3 Plans & tiers                                                  */
/* ------------------------------------------------------------------ */

export const PlansView: React.FC<{ ctx: ViewContext }> = ({ ctx }) => {
  const palette = usePalette();
  const showIdentity = can(ctx.role, 'view:user_detail') || can(ctx.role, 'view:invoices');

  const candidates = useMemo(
    () =>
      ctx.billings
        .filter((billing) => billing.recommendation.action !== 'stay')
        .sort((a, b) => b.recommendation.savingsUsd - a.recommendation.savingsUsd),
    [ctx.billings]
  );

  const pastCap = useMemo(
    () => ctx.billings.filter((billing) => billing.overTenureCap && billing.user.tier === 'starter'),
    [ctx.billings]
  );
  const candidatesPager = usePagination(candidates, 10);
  const pastCapPager = usePagination(pastCap, 10);

  // If the proposed 3-month Starter cap were enforced today (§3).
  const migrationImpactUsd = useMemo(() => {
    const delta = (TIERS.pro.priceUsd ?? 0) - (TIERS.starter.priceUsd ?? 0);
    return pastCap.length * delta;
  }, [pastCap.length]);

  const tierMrr = ctx.summary.revenue.real_mrr_by_tier_usd ?? ctx.summary.revenue.mrr_by_tier_usd ?? {};
  const breakEven = useMemo(() => upgradeBreakEven('starter', 'pro'), []);

  return (
    <div className="space-y-5 stagger">
      <ProvenanceBanner layer={ctx.userLayer} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {TIER_ORDER.map((tier) => {
          const def = TIERS[tier];
          const count = ctx.rollup.tierCounts[tier] ?? 0;
          const mrr = tierMrr[tier] ?? 0;
          return (
            <Card key={tier} className="flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <TierBadge tier={tier} />
                  <p className="text-[11px] text-muted mt-1.5">
                    {def.priceUsd == null ? 'Negotiated per contract' : `${formatCurrency(def.priceUsd)} / month`}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-extrabold text-ink num">{count}</div>
                  <div className="text-[11px] text-muted">accounts</div>
                </div>
              </div>

              <div className="rounded-xl border border-line bg-sunken p-3 space-y-1.5">
                {MODULE_KEYS.map((moduleKey) => {
                  const included = includedSourceUnits(tier, moduleKey);
                  return (
                    <div key={moduleKey} className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1.5 text-muted">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: palette.module(moduleKey) }} />
                        {MODULES[moduleKey].label}
                      </span>
                      <span className="text-ink font-semibold num">
                        {included == null ? 'contract' : formatModuleQuantity(moduleKey, included)}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px]">
                <span className="text-muted">Net MRR (post-coupon)</span>
                <span className="font-bold text-ink num">{formatCurrency(mrr)}</span>
              </div>

              {def.note && <p className="text-[11px] text-muted mt-3 pt-3 border-t border-line">{def.note}</p>}
            </Card>
          );
        })}
      </div>

      <Callout tone="violet" icon={<Info className="w-4 h-4 text-accent" />} title="Enterprise is a first-class tier here (§3)">
        Enterprise is already sold to Google but has no Stripe subscription row, so it never appeared in the old
        tier breakdown. It is rendered above as its own tier with a negotiated allowance. The per-module Enterprise
        breakdown is explicitly deferred to v2 (§4.3).
      </Callout>

      <Card>
        <SectionHeading
          title="Plan-change candidates"
          requirement="§4.3"
          subtitle="Accounts whose overage exceeds the delta to the next tier — the proactive “the $55 plan saves you $5” list."
          icon={<ArrowUpRight className="w-5 h-5 text-caution" />}
        />
        {candidates.length === 0 ? (
          <EmptyState
            title="Everyone is on the cheapest plan for their usage"
            description="No account would pay less on a different tier at current consumption."
          />
        ) : (
          <TableWrap>
            <table className="w-full text-left text-xs border-collapse min-w-[860px]">
              <thead>
                <tr className="text-muted font-semibold border-b border-line text-[11px] uppercase">
                  <th className="pb-3 pr-3">Account</th>
                  <th className="pb-3 px-3">Current tier</th>
                  <th className="pb-3 px-3 text-right">Overage</th>
                  <th className="pb-3 px-3 text-right">Cost today</th>
                  <th className="pb-3 px-3">Recommended</th>
                  <th className="pb-3 px-3 text-right">Cost after</th>
                  <th className="pb-3 pl-3 text-right">Saving / mo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {candidatesPager.pageItems.map((billing, index) => (
                  <tr key={billing.user.user_id} className="hover:bg-sunken">
                    <td className="py-3 pr-3">
                      {showIdentity ? (
                        <>
                          <div className="font-semibold text-ink">{billing.user.display_name}</div>
                          <div className="text-[11px] text-muted">{billing.user.org_name}</div>
                        </>
                      ) : (
                        <span className="font-mono text-ink-2">Account #{candidatesPager.from + index}</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <TierBadge tier={billing.user.tier} />
                    </td>
                    <td className="py-3 px-3 text-right text-critical font-semibold num">
                      {formatCurrency(billing.totalOverageUsd)}
                    </td>
                    <td className="py-3 px-3 text-right text-ink num">
                      {formatCurrency(billing.recommendation.currentMonthlyUsd)}
                    </td>
                    <td className="py-3 px-3">
                      <TierBadge tier={billing.recommendation.recommendedTier} />
                    </td>
                    <td className="py-3 px-3 text-right text-ink num">
                      {formatCurrency(billing.recommendation.recommendedMonthlyUsd)}
                    </td>
                    <td className="py-3 pl-3 text-right font-bold text-positive num">
                      {formatCurrency(billing.recommendation.savingsUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
        <Pagination state={candidatesPager} noun="candidates" />
      </Card>

      <Card>
        <SectionHeading
          title="Does upgrading actually pay?"
          requirement="§8"
          subtitle="Break-even test for Starter → Pro: how much allowance Pro must include before an upgrade saves money, per module."
          icon={<Info className="w-5 h-5 text-accent" />}
        />
        {breakEven ? (
          <>
            <TableWrap>
              <table className="w-full text-left text-xs border-collapse min-w-[720px]">
                <thead>
                  <tr className="text-muted font-semibold border-b border-line text-[11px] uppercase">
                    <th className="pb-3 pr-3">Module</th>
                    <th className="pb-3 px-3 text-right">Starter includes</th>
                    <th className="pb-3 px-3 text-right">Pro includes</th>
                    <th className="pb-3 px-3 text-right">Pro needs at least</th>
                    <th className="pb-3 pl-3">Upgrade ever pays?</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {breakEven.map((row) => (
                    <tr key={row.module} className="hover:bg-sunken">
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: palette.module(row.module) }} />
                          <span className="text-ink font-medium">{MODULES[row.module].label}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right text-muted num">
                        {formatModuleQuantity(row.module, row.includedFrom)}
                      </td>
                      <td className="py-3 px-3 text-right text-ink num">
                        {formatModuleQuantity(row.module, row.includedTo)}
                      </td>
                      <td className="py-3 px-3 text-right text-ink-2 num">
                        {formatModuleQuantity(row.module, row.requiredIncludedTo)}
                      </td>
                      <td className="py-3 pl-3">
                        {row.viable ? (
                          <Badge tone="success">yes</Badge>
                        ) : (
                          <Badge tone="danger">
                            never — short by {formatModuleQuantity(row.module, row.shortfall)}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            <Callout tone="warning" className="mt-3">
              <span className="font-semibold text-ink">Read this before confirming the Pro bundle.</span> The price
              step from Starter to Pro is{' '}
              {formatCurrency((TIERS.pro.priceUsd ?? 0) - (TIERS.starter.priceUsd ?? 0))}. Where a module&apos;s row says
              &quot;never&quot;, an account whose overage sits in that module is <em>always</em> cheaper staying on
              Starter no matter how far over it goes — so the &quot;move them up a tier&quot; motion in §1 quietly
              cannot work for them. Raising that module&apos;s Pro allowance, or its overage rate, is what makes the
              recommendation engine able to fire.
            </Callout>
          </>
        ) : (
          <EmptyState title="Break-even needs two list-priced tiers" description="Enterprise is negotiated, so it has no list comparison." />
        )}
      </Card>

      <Card>
        <SectionHeading
          title="Tenure on tier & the proposed 3-month Starter cap"
          requirement="§3 · §8"
          subtitle="Tracked now so the policy can be decided with real data — nothing is enforced by the dashboard."
          icon={<CalendarClock className="w-5 h-5 text-accent" />}
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <StatTile
            label="Starters past 3 months"
            value={String(pastCap.length)}
            hint="Would be forced to migrate if the cap were live"
            tone={pastCap.length > 0 ? 'warning' : 'success'}
          />
          <StatTile
            label="MRR impact if enforced"
            value={formatCurrency(migrationImpactUsd)}
            hint={`${pastCap.length} × ${formatCurrency((TIERS.pro.priceUsd ?? 0) - (TIERS.starter.priceUsd ?? 0))} tier delta`}
            tone="info"
            footnote="Gross, before churn risk from forced migration"
          />
          <StatTile
            label="Median Starter tenure"
            value={formatMonths(medianTenure(ctx.billings.filter((b) => b.user.tier === 'starter').map((b) => b.tenureMonths)))}
            hint="Across all Starter accounts in scope"
          />
        </div>

        {pastCap.length > 0 && (
          <TableWrap>
            <table className="w-full text-left text-xs border-collapse min-w-[620px]">
              <thead>
                <tr className="text-muted font-semibold border-b border-line text-[11px] uppercase">
                  <th className="pb-3 pr-3">Account</th>
                  <th className="pb-3 px-3">On Starter since</th>
                  <th className="pb-3 px-3 text-right">Tenure</th>
                  <th className="pb-3 px-3 text-right">Overage this cycle</th>
                  <th className="pb-3 pl-3">Plan fit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pastCapPager.pageItems.map((billing, index) => (
                  <tr key={billing.user.user_id} className="hover:bg-sunken">
                    <td className="py-3 pr-3">
                      {showIdentity ? (
                        <span className="font-semibold text-ink">{billing.user.display_name}</span>
                      ) : (
                        <span className="font-mono text-ink-2">Account #{pastCapPager.from + index}</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-muted">{formatDate(billing.user.tier_started_at)}</td>
                    <td className="py-3 px-3 text-right text-caution font-semibold num">
                      {formatMonths(billing.tenureMonths)}
                    </td>
                    <td className="py-3 px-3 text-right text-ink num">
                      {formatCurrency(billing.totalOverageUsd)}
                    </td>
                    <td className="py-3 pl-3">
                      <RecommendationBadge recommendation={billing.recommendation} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pastCap.length > 15 && (
              <p className="text-[11px] text-muted mt-2">+{pastCap.length - 15} more past the proposed cap.</p>
            )}
          </TableWrap>
        )}
        <Pagination state={pastCapPager} noun="accounts past cap" />
      </Card>
    </div>
  );
};

function medianTenure(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/* ------------------------------------------------------------------ */
/* §4.4 Billing management (+ §4.5 growth, §4.2 receivables)           */
/* ------------------------------------------------------------------ */

const CHANNEL_LABELS: Record<string, { label: string; colorKey: 'stripe' | 'marketplace' | 'other'; definition: string }> = {
  stripe: {
    label: 'Stripe direct',
    colorKey: 'stripe',
    definition: 'We hold the customer relationship, issue the invoice and collect the money. Full AR visibility.',
  },
  gcp_marketplace: {
    label: 'Google Cloud Marketplace',
    colorKey: 'marketplace',
    definition: 'Google bills and collects, then remits. We see the subscription but not the invoice or the AR.',
  },
};

export const BillingView: React.FC<{ ctx: ViewContext }> = ({ ctx }) => {
  const palette = usePalette();
  const channelColor = (key: 'stripe' | 'marketplace' | 'other') =>
    key === 'stripe'
      ? palette.module('meeting_time')
      : key === 'marketplace'
      ? palette.tier('enterprise')
      : palette.module('proposal');
  const revenue = ctx.summary.revenue;
  const ar = ctx.summary.accounts_receivable;
  const invoicePager = usePagination(ar.top_open_invoices, 10);
  const realMrr = revenue.real_mrr_usd ?? revenue.mrr_usd;
  const realArr = revenue.real_arr_usd ?? revenue.arr_usd;

  const channels = useMemo(() => {
    const totals = ctx.summary.billing_provider_breakdown ?? {};
    const paying = ctx.summary.paying_billing_provider_breakdown ?? {};
    return Object.entries(totals).map(([key, count]) => ({
      key,
      count,
      paying: paying[key] ?? 0,
      meta: CHANNEL_LABELS[key] ?? {
        label: key.replace(/_/g, ' '),
        colorKey: 'other' as const,
        definition: 'Undocumented billing channel — needs a definition before it ships (§4.4).',
      },
    }));
  }, [ctx.summary.billing_provider_breakdown, ctx.summary.paying_billing_provider_breakdown]);

  const growthBuckets = useMemo(
    () => bucketCounts(ctx.summary.growth?.by_day ?? {}, ctx.granularity),
    [ctx.summary.growth, ctx.granularity]
  );

  const totalSubs = channels.reduce((sum, channel) => sum + channel.count, 0);
  const warning = granularityWarning(ctx.granularity, ctx.days);

  return (
    <div className="space-y-5 stagger">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatTile
          label="Net MRR"
          value={formatCurrency(realMrr)}
          hint={`Gross list value ${formatCurrency(revenue.mrr_usd)} before coupons`}
          tone="success"
          icon={<CreditCard className="w-4 h-4" />}
          footnote={`${revenue.exempted_subscriber_count ?? 0} accounts on a 100%-off coupon`}
        />
        <StatTile label="Net ARR" value={formatCurrency(realArr)} hint="Net MRR × 12" tone="info" />
        <StatTile
          label="Unpaid renewals & overages"
          value={formatCurrency(ar.total_outstanding_usd)}
          hint={`${ar.open_invoice_count} open · ${formatCurrency(ar.overdue_usd)} overdue`}
          tone={ar.overdue_invoice_count > 0 ? 'danger' : 'neutral'}
          footnote="Renamed from “Outstanding Receivables” (§4.2). Invoiced-and-unpaid only."
        />
        <StatTile
          label="Live overage (uninvoiced)"
          value={formatCurrency(ctx.rollup.totalOverageUsd)}
          hint="Accruing this cycle — will land on the next invoice"
          tone={ctx.rollup.totalOverageUsd > 0 ? 'warning' : 'neutral'}
        />
      </div>

      <Card>
        <SectionHeading
          title="Billing Management"
          requirement="§4.4"
          subtitle="Subscriptions by billing channel — who invoices the customer and who collects the cash."
          icon={<Building2 className="w-5 h-5 text-accent" />}
          actions={<GranularityToggle value={ctx.granularity} onChange={ctx.onGranularityChange} />}
        />

        <Callout tone="warning" icon={<FileWarning className="w-4 h-4 text-caution" />} className="mb-4">
          <span className="font-semibold text-ink">What changed:</span> this panel was &quot;Billing provider
          breakdown&quot;, and the number on it was read as &quot;56 providers&quot;. There are{' '}
          <span className="font-semibold text-ink">{channels.length} billing channels</span>, not 56 providers — the
          figure was always a count of <em>subscriptions</em> ({totalSubs} today) routed through each channel.
        </Callout>

        <TableWrap>
          <table className="w-full text-left text-xs border-collapse min-w-[680px]">
            <thead>
              <tr className="text-muted font-semibold border-b border-line text-[11px] uppercase">
                <th className="pb-3 pr-3">Channel</th>
                <th className="pb-3 px-3">What it means</th>
                <th className="pb-3 px-3 text-right">Subscriptions</th>
                <th className="pb-3 px-3 text-right">Paying</th>
                <th className="pb-3 pl-3 text-right">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {channels.map((channel) => (
                <tr key={channel.key} className="hover:bg-sunken">
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: channelColor(channel.meta.colorKey) }} />
                      <span className="font-semibold text-ink">{channel.meta.label}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-muted max-w-md">{channel.meta.definition}</td>
                  <td className="py-3 px-3 text-right text-ink font-bold num">{channel.count}</td>
                  <td className="py-3 px-3 text-right text-ink-2 num">{channel.paying}</td>
                  <td className="py-3 pl-3 text-right text-muted num">
                    {totalSubs > 0 ? `${Math.round((channel.count / totalSubs) * 100)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>

        {!channels.some((c) => c.key === 'gcp_marketplace') && (
          <p className="text-[11px] text-muted mt-3">
            No GCP Marketplace subscriptions in this window. The Enterprise contract with Google is billed outside
            Stripe, so it does not appear as a channel row here (§3).
          </p>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <SectionHeading
            title="Unpaid renewals & overages"
            requirement="§4.2"
            subtitle="Issued invoices still unpaid. Live in-cycle overage is deliberately excluded."
            icon={<Receipt className="w-5 h-5 text-caution" />}
          />
          {ar.top_open_invoices.length === 0 ? (
            <EmptyState
              title="Nothing outstanding"
              description="No open or overdue Stripe invoices. Note this covers Stripe only — Google collects Marketplace invoices directly."
            />
          ) : (
            <TableWrap>
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="text-muted font-semibold border-b border-line text-[11px] uppercase">
                    <th className="pb-3 pr-3">Invoice</th>
                    <th className="pb-3 px-3">Customer</th>
                    <th className="pb-3 px-3 text-right">Outstanding</th>
                    <th className="pb-3 px-3">Created</th>
                    <th className="pb-3 pl-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {invoicePager.pageItems.map((invoice) => (
                    <tr key={invoice.invoice_id} className={invoice.overdue ? 'bg-critical-tint' : ''}>
                      <td className="py-3 pr-3 font-mono text-ink-2">{invoice.invoice_id}</td>
                      <td className="py-3 px-3 font-mono text-muted">{invoice.customer_id}</td>
                      <td className="py-3 px-3 text-right font-bold text-ink num">
                        {formatCurrency(invoice.amount_remaining_usd)}
                      </td>
                      <td className="py-3 px-3 text-muted">{formatDate(invoice.created)}</td>
                      <td className="py-3 pl-3 text-right">
                        <Badge tone={invoice.overdue ? 'danger' : 'warning'}>{invoice.overdue ? 'Overdue' : 'Open'}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
          <Pagination state={invoicePager} noun="open invoices" />
          {ar.note && <p className="text-[11px] text-muted mt-4 pt-3 border-t border-line italic">{ar.note}</p>}
        </Card>

        <Card>
          <SectionHeading
            title="Subscription growth"
            requirement="§4.5"
            subtitle="New activations — flagged as already working well, kept as-is and given the granularity toggle."
            icon={<TrendingUp className="w-5 h-5 text-positive" />}
          />
          {warning && (
            <Callout tone="neutral" className="mb-3">
              {warning}
            </Callout>
          )}
          {growthBuckets.length === 0 ? (
            <EmptyState title="No new activations in this window" />
          ) : (
            <CountsAreaChart data={growthBuckets.map((b) => ({ label: b.label, count: b.count }))} />
          )}
          <p className="text-[11px] text-muted mt-2">
            {ctx.summary.growth?.total ?? 0} new subscriptions across the {ctx.days}-day window.
          </p>
        </Card>
      </div>

      {revenue.note && (
        <Callout tone="neutral" icon={<Info className="w-4 h-4 text-muted" />} title="Revenue caveats from the API">
          {revenue.note}
        </Callout>
      )}
    </div>
  );
};

/** Exported for the tier badge legend used on the overview. */
export const TierLegend: React.FC<{ counts: Record<TierId, number> }> = ({ counts }) => (
  <div className="flex flex-wrap items-center gap-2">
    {TIER_ORDER.map((tier) => (
      <span key={tier} className="flex items-center gap-1.5 text-[11px] text-muted">
        <TierBadge tier={tier} />
        <span className="num text-ink-2 font-semibold">{counts[tier] ?? 0}</span>
      </span>
    ))}
  </div>
);
