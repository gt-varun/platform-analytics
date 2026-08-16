/**
 * Overage accrual, tenure and plan-recommendation maths — Requirements §4.1–§4.3.
 *
 * Everything here reads usage in *source units* and prices it through
 * `config/pricing.ts`. Swap the credit model and this file keeps working.
 */

import {
  MODULES,
  MODULE_KEYS,
  ModuleKey,
  TIERS,
  TIER_ORDER,
  TierId,
  includedSourceUnits,
  overageCostUsd,
  usdToCredits,
} from '../config/pricing';
import { KYC_OVERAGE_TRACKING_RELIABLE } from '../config/delivery';
import {
  Granularity,
  ModuleBillingLine,
  ModuleQuantities,
  PlanRecommendation,
  UserBilling,
  UserUsageRecord,
} from '../types/platform';
import { monthsBetween } from './timeBuckets';

/** Overage lines for a set of quantities priced against a tier's allowances. */
export function computeModuleLines(tier: TierId, usage: ModuleQuantities): ModuleBillingLine[] {
  return MODULE_KEYS.map((module) => {
    const included = includedSourceUnits(tier, module);
    const used = Math.max(0, usage[module] || 0);
    const overageUnits = included == null ? 0 : Math.max(0, used - included);

    return {
      module,
      included,
      used,
      remaining: included == null ? null : Math.max(0, included - used),
      percentUsed: included == null || included === 0 ? null : used / included,
      overageUnits,
      overageUsd: overageCostUsd(module, overageUnits),
      triggered: overageUnits > 0,
      // §5.1 — KYC overage under-reports until the backend/KYC-initiation fix lands.
      unreliable: module === 'kyc_count' && !KYC_OVERAGE_TRACKING_RELIABLE,
    };
  });
}

export function totalOverageUsd(lines: ModuleBillingLine[]): number {
  return lines.reduce((sum, line) => sum + line.overageUsd, 0);
}

function overageUsdForTier(tier: TierId, usage: ModuleQuantities): number {
  return totalOverageUsd(computeModuleLines(tier, usage));
}

/**
 * §4.3 — "surface users whose overages exceed the delta to the next tier".
 * Compares total monthly cost (plan price + overage that would remain on that
 * plan) across every priced tier and recommends the cheapest.
 */
export function recommendPlan(currentTier: TierId, cycleUsage: ModuleQuantities): PlanRecommendation {
  const currentPrice = TIERS[currentTier].priceUsd;

  // Enterprise is negotiated — no list price to compare against (§4.3, v2).
  if (currentPrice == null) {
    return {
      currentTier,
      recommendedTier: currentTier,
      currentMonthlyUsd: 0,
      recommendedMonthlyUsd: 0,
      savingsUsd: 0,
      action: 'stay',
      rationale: 'Enterprise contract — pricing is negotiated, so no list-tier comparison applies (v2).',
    };
  }

  const currentMonthlyUsd = currentPrice + overageUsdForTier(currentTier, cycleUsage);

  let best: { tier: TierId; cost: number } = { tier: currentTier, cost: currentMonthlyUsd };
  for (const tier of TIER_ORDER) {
    const price = TIERS[tier].priceUsd;
    if (price == null) continue;
    const cost = price + overageUsdForTier(tier, cycleUsage);
    if (cost < best.cost - 0.005) best = { tier, cost };
  }

  const savingsUsd = currentMonthlyUsd - best.cost;

  // Even the top priced tier is being blown through — that's an Enterprise conversation.
  const topTier = TIER_ORDER.filter((t) => TIERS[t].priceUsd != null).slice(-1)[0];
  const topPrice = TIERS[topTier].priceUsd ?? 0;
  if (best.tier === topTier && best.cost > topPrice * 2) {
    return {
      currentTier,
      recommendedTier: 'enterprise',
      currentMonthlyUsd,
      recommendedMonthlyUsd: best.cost,
      savingsUsd: Math.max(0, savingsUsd),
      action: 'review_enterprise',
      rationale: `Projected spend of ${money(best.cost)} is more than double the ${TIERS[topTier].label} price — route to an Enterprise negotiation.`,
    };
  }

  if (best.tier === currentTier) {
    const overage = currentMonthlyUsd - currentPrice;
    return {
      currentTier,
      recommendedTier: currentTier,
      currentMonthlyUsd,
      recommendedMonthlyUsd: currentMonthlyUsd,
      savingsUsd: 0,
      action: 'stay',
      rationale:
        overage > 0
          ? `Paying ${money(overage)} in overage, but no higher tier is cheaper at this usage mix — the extra allowance ` +
            `costs more than the overage it absorbs. That is a rate-card question, not a customer one (see the ` +
            `break-even table on Plans & Tiers).`
          : `${TIERS[currentTier].label} is already the cheapest plan for this usage.`,
    };
  }

  const movingUp = TIER_ORDER.indexOf(best.tier) > TIER_ORDER.indexOf(currentTier);

  return {
    currentTier,
    recommendedTier: best.tier,
    currentMonthlyUsd,
    recommendedMonthlyUsd: best.cost,
    savingsUsd,
    action: movingUp ? 'upgrade' : 'downgrade',
    rationale: movingUp
      ? `Spending ${money(currentMonthlyUsd - currentPrice)} in overages on ${TIERS[currentTier].label} — the ${money(
          TIERS[best.tier].priceUsd ?? 0
        )} ${TIERS[best.tier].label} plan lands at ${money(best.cost)}/mo and saves ${money(savingsUsd)}.`
      : `Using far less than the ${TIERS[currentTier].label} allowance — ${TIERS[best.tier].label} covers this usage at ${money(
          best.cost
        )}/mo, ${money(savingsUsd)} cheaper. Flag before renewal rather than letting them churn over it.`,
  };
}

function money(usd: number): string {
  return `$${usd.toFixed(usd % 1 === 0 ? 0 : 2)}`;
}

/** Full billing picture for one user, based on *current billing cycle* usage (§4.1, §4.2). */
export function computeUserBilling(user: UserUsageRecord, now: Date = new Date()): UserBilling {
  const lines = computeModuleLines(user.tier, user.cycle_usage);
  const overage = totalOverageUsd(lines);
  const planPriceUsd = TIERS[user.tier].priceUsd;
  const tenureMonths = monthsBetween(user.tier_started_at, now.toISOString());
  const cap = TIERS[user.tier].tenureCapMonths;

  const cycleStart = new Date(user.billing_cycle_start).getTime();
  const cycleEnd = new Date(user.billing_cycle_end).getTime();
  const cycleProgress =
    cycleEnd > cycleStart ? Math.min(1, Math.max(0, (now.getTime() - cycleStart) / (cycleEnd - cycleStart))) : 0;

  return {
    user,
    lines,
    totalOverageUsd: overage,
    totalOverageCredits: usdToCredits(overage),
    planPriceUsd,
    // Exempt accounts (100%-off coupon) pay nothing on the plan line but still accrue overage.
    projectedInvoiceUsd: planPriceUsd == null ? null : (user.is_exempt ? 0 : planPriceUsd) + overage,
    recommendation: recommendPlan(user.tier, user.cycle_usage),
    tenureMonths,
    overTenureCap: cap != null && tenureMonths > cap,
    cycleProgress,
  };
}

/* ------------------------------------------------------------------ */
/* Rollups — the Admin layer sees these instead of individual rows (§2) */
/* ------------------------------------------------------------------ */

export interface ModuleRollup {
  module: ModuleKey;
  totalUsed: number;
  totalIncluded: number;
  totalOverageUnits: number;
  totalOverageUsd: number;
  usersOverLimit: number;
  usersNearLimit: number;
  activeUsers: number;
  unreliable: boolean;
}

export interface OrgRollup {
  userCount: number;
  payingUserCount: number;
  exemptUserCount: number;
  tierCounts: Record<TierId, number>;
  modules: ModuleRollup[];
  totalOverageUsd: number;
  totalUnpaidUsd: number;
  usersWithOverage: number;
  upgradeCandidates: number;
  starterPastCap: number;
}

const NEAR_LIMIT_THRESHOLD = 0.8;

export function rollupUsers(billings: UserBilling[]): OrgRollup {
  const tierCounts: Record<TierId, number> = { starter: 0, pro: 0, enterprise: 0 };
  const modules: ModuleRollup[] = MODULE_KEYS.map((module) => ({
    module,
    totalUsed: 0,
    totalIncluded: 0,
    totalOverageUnits: 0,
    totalOverageUsd: 0,
    usersOverLimit: 0,
    usersNearLimit: 0,
    activeUsers: 0,
    unreliable: module === 'kyc_count' && !KYC_OVERAGE_TRACKING_RELIABLE,
  }));

  let totalOverage = 0;
  let totalUnpaid = 0;
  let usersWithOverage = 0;
  let upgradeCandidates = 0;
  let starterPastCap = 0;
  let exemptUserCount = 0;

  for (const billing of billings) {
    tierCounts[billing.user.tier] += 1;
    totalOverage += billing.totalOverageUsd;
    totalUnpaid += billing.user.unpaid_usd;
    if (billing.totalOverageUsd > 0) usersWithOverage += 1;
    if (billing.recommendation.action !== 'stay') upgradeCandidates += 1;
    if (billing.overTenureCap && billing.user.tier === 'starter') starterPastCap += 1;
    if (billing.user.is_exempt) exemptUserCount += 1;

    billing.lines.forEach((line, index) => {
      const target = modules[index];
      target.totalUsed += line.used;
      target.totalIncluded += line.included ?? 0;
      target.totalOverageUnits += line.overageUnits;
      target.totalOverageUsd += line.overageUsd;
      if (line.used > 0) target.activeUsers += 1;
      if (line.overageUnits > 0) target.usersOverLimit += 1;
      else if (line.percentUsed != null && line.percentUsed >= NEAR_LIMIT_THRESHOLD) target.usersNearLimit += 1;
    });
  }

  return {
    userCount: billings.length,
    payingUserCount: billings.filter((b) => !b.user.is_exempt).length,
    exemptUserCount,
    tierCounts,
    modules,
    totalOverageUsd: totalOverage,
    totalUnpaidUsd: totalUnpaid,
    usersWithOverage,
    upgradeCandidates,
    starterPastCap,
  };
}

export interface BreakEvenRow {
  module: ModuleKey;
  includedFrom: number;
  includedTo: number;
  /** Allowance the upper tier would need for the upgrade to pay when overage sits in this module alone. */
  requiredIncludedTo: number;
  shortfall: number;
  viable: boolean;
}

/**
 * §8 sensitivity check. An upgrade only saves money if the extra allowance is worth
 * more than the price step. For a user whose overage is concentrated in one module,
 * the upper tier must include at least `lower allowance + priceDelta / rate` of it.
 * Where the real bundle falls short, no amount of overage will ever trigger an
 * upgrade recommendation — which is a pricing decision, not a dashboard bug.
 */
export function upgradeBreakEven(from: TierId, to: TierId): BreakEvenRow[] | null {
  const fromPrice = TIERS[from].priceUsd;
  const toPrice = TIERS[to].priceUsd;
  if (fromPrice == null || toPrice == null) return null;
  const priceDelta = toPrice - fromPrice;

  return MODULE_KEYS.map((module) => {
    const includedFrom = includedSourceUnits(from, module) ?? 0;
    const includedTo = includedSourceUnits(to, module) ?? 0;
    const def = MODULES[module];
    const requiredIncludedTo = includedFrom + (priceDelta / def.overageRateUsd) * def.sourceUnitsPerRateUnit;
    return {
      module,
      includedFrom,
      includedTo,
      requiredIncludedTo,
      shortfall: Math.max(0, requiredIncludedTo - includedTo),
      viable: includedTo >= requiredIncludedTo,
    };
  });
}

/**
 * Allowances are granted per billing cycle (≈1 month). To draw the overage
 * trigger line on a daily/weekly/annual chart it has to be rescaled to the bucket.
 */
const GRANULARITY_MONTHS: Record<Granularity, number> = {
  day: 1 / 30.437,
  week: 7 / 30.437,
  month: 1,
  year: 12,
};

export function allowanceForGranularity(includedPerCycle: number | null, granularity: Granularity): number | null {
  if (includedPerCycle == null) return null;
  return includedPerCycle * GRANULARITY_MONTHS[granularity];
}

/** Tenure bands for the §3 "cap Starter at 3 months" policy evaluation. */
export function tenureBand(months: number): '0-1' | '1-3' | '3-6' | '6-12' | '12+' {
  if (months < 1) return '0-1';
  if (months < 3) return '1-3';
  if (months < 6) return '3-6';
  if (months < 12) return '6-12';
  return '12+';
}

export const TENURE_BANDS: Array<'0-1' | '1-3' | '3-6' | '6-12' | '12+'> = ['0-1', '1-3', '3-6', '6-12', '12+'];
