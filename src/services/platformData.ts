/**
 * Per-user data layer — Requirements §4.1.
 *
 * §4.1 asks for the per-user view "first", but the only endpoint that exists today
 * (/admin/usage-summary) returns aggregates. §6 assigns the per-user endpoints to
 * Sai / Diptanshu; they are specified in `config/delivery.ts` as ENDPOINT_CONTRACTS.
 *
 * So this module does two things:
 *   1. Calls the real per-user endpoint if it exists (drop-in the moment it ships).
 *   2. Otherwise derives a PREVIEW dataset from the live aggregates, so metric
 *      definitions and layout can be reviewed against realistic numbers now.
 *
 * The preview is *reconciled*, not invented: every module's per-day totals across
 * all preview users sum exactly to the live `daily_usage_trend`, per-user counts
 * match `features[*].active_users`, tier counts match `tier_breakdown`, and the
 * exempt/paying split matches `revenue.exempted_subscriber_count`. What is synthetic
 * is *which* user did what — never how much happened in total.
 *
 * Every view built on preview data renders the provenance banner. There is no path
 * where preview numbers are presented as live ones.
 */

import { MODULE_KEYS, ModuleKey, TierId } from '../config/pricing';
import {
  BillingProvider,
  DailyModuleUsage,
  ModuleQuantities,
  SubscriptionStatus,
  UserUsageRecord,
  UserUsageResponse,
} from '../types/platform';
import { UsageSummaryResponse } from '../types/analytics';
import { API_BASE_URL, adminHeaders } from './api';

/** §3 — Enterprise is already sold to Google but has no Stripe subscription row. */
const PREVIEW_ENTERPRISE_ACCOUNTS = 1;

const CHURN_REASONS = [
  'Overage bill shock — moved to annual competitor plan',
  'Champion left the account',
  'Only used Proposal Hub; not worth the bundle',
  'Procurement blocked renewal pending security review',
  'Migrated to the Enterprise contract',
];

const RENEWAL_REASONS = [
  'Meeting minutes now embedded in weekly workflow',
  'KYC volume grew after a compliance mandate',
  'Simulator adoption across a second team',
  'Upgraded to Pro after two months of overage',
];

/* ------------------------------------------------------------------ */
/* Deterministic helpers                                               */
/* ------------------------------------------------------------------ */

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Split `total` across `weights` with largest-remainder rounding so the parts sum
 * back to exactly `total`. This is what keeps the preview reconciled.
 */
function allocate(total: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0 || total <= 0) return new Array(n).fill(0);
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return new Array(n).fill(0);

  const exact = weights.map((w) => (total * w) / sum);
  const floored = exact.map(Math.floor);
  let remainder = Math.round(total - floored.reduce((a, b) => a + b, 0));

  const order = exact
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac);

  let cursor = 0;
  while (remainder > 0 && order.length > 0) {
    floored[order[cursor % order.length].index] += 1;
    remainder -= 1;
    cursor += 1;
  }
  return floored;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function emptyQuantities(): ModuleQuantities {
  return { meeting_time: 0, kyc_count: 0, simulator: 0, proposal: 0 };
}

/** Current billing cycle, anchored on the subscription's day-of-month. */
function billingCycle(subscriptionStart: string, now: Date): { start: string; end: string } {
  const anchorDay = new Date(subscriptionStart).getUTCDate();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const clampedThis = Math.min(anchorDay, daysIn(year, month));
  let start = new Date(Date.UTC(year, month, clampedThis));
  if (start.getTime() > now.getTime()) {
    const prevMonth = month - 1;
    start = new Date(Date.UTC(year, prevMonth, Math.min(anchorDay, daysIn(year, prevMonth))));
  }
  const endMonth = start.getUTCMonth() + 1;
  const end = new Date(
    Date.UTC(start.getUTCFullYear(), endMonth, Math.min(anchorDay, daysIn(start.getUTCFullYear(), endMonth)))
  );
  return { start: start.toISOString(), end: end.toISOString() };
}

/* ------------------------------------------------------------------ */
/* Preview builder                                                     */
/* ------------------------------------------------------------------ */

export function buildPreviewUserLayer(summary: UsageSummaryResponse): UserUsageResponse {
  const rand = mulberry32(hashString(summary.period_start || 'seed'));
  const now = new Date(summary.generated_at || new Date().toISOString());

  const tierCounts: Array<{ tier: TierId; count: number }> = [
    { tier: 'starter', count: Math.max(0, Math.round(summary.tier_breakdown?.starter ?? 0)) },
    { tier: 'pro', count: Math.max(0, Math.round(summary.tier_breakdown?.pro ?? 0)) },
    {
      tier: 'enterprise',
      count: Math.max(0, Math.round(summary.tier_breakdown?.enterprise ?? 0)) || PREVIEW_ENTERPRISE_ACCOUNTS,
    },
  ];

  const gcpSubs = summary.billing_provider_breakdown?.gcp_marketplace ?? 0;
  const payingByTier = summary.revenue?.real_mrr_by_tier_usd ?? null;
  const totalPaying =
    summary.revenue?.paying_subscriber_count ??
    (payingByTier ? Object.values(payingByTier).filter((v) => v > 0).length : 0);

  // 1. Skeleton accounts, ordered starter → pro → enterprise.
  const users: UserUsageRecord[] = [];
  let index = 0;
  for (const { tier, count } of tierCounts) {
    for (let i = 0; i < count; i += 1) {
      index += 1;
      const isEnterprise = tier === 'enterprise';
      const label = String(index).padStart(2, '0');
      const monthsAgo = isEnterprise ? 9 + rand() * 6 : rand() * 15;
      const subscriptionStart = addDays(now.toISOString(), -Math.round(monthsAgo * 30.437));
      // Pro accounts moved tiers more recently than they signed up.
      const tierStart =
        tier === 'pro' && rand() > 0.4
          ? addDays(now.toISOString(), -Math.round(rand() * 90))
          : subscriptionStart;

      const provider: BillingProvider = isEnterprise
        ? 'gcp_marketplace'
        : index <= gcpSubs
        ? 'gcp_marketplace'
        : 'stripe';

      const status: SubscriptionStatus = 'active';
      const cycle = billingCycle(subscriptionStart, now);

      users.push({
        user_id: isEnterprise ? 'ent_google_01' : `prev_u${label}`,
        display_name: isEnterprise ? 'Google — Enterprise contract' : `Preview Account ${label}`,
        email: isEnterprise ? 'billing@enterprise.example' : `account${label}@preview.example`,
        org_id: isEnterprise ? 'org_google' : `org_${Math.ceil(index / 8)}`,
        org_name: isEnterprise ? 'Google' : `Preview Org ${Math.ceil(index / 8)}`,
        tier,
        billing_provider: provider,
        status,
        tier_started_at: tierStart,
        subscription_started_at: subscriptionStart,
        billing_cycle_start: cycle.start,
        billing_cycle_end: cycle.end,
        is_exempt: false,
        window_usage: emptyQuantities(),
        cycle_usage: emptyQuantities(),
        daily: [],
        unpaid_usd: 0,
        open_invoice_count: 0,
        churn_reason: null,
        renewal_reason: rand() > 0.75 ? RENEWAL_REASONS[Math.floor(rand() * RENEWAL_REASONS.length)] : null,
        last_active_at: null,
      });
    }
  }

  if (users.length === 0) {
    return {
      source: 'preview',
      period_days: summary.period_days,
      period_start: summary.period_start,
      period_end: summary.period_end,
      generated_at: summary.generated_at,
      users: [],
      provenance: 'No active subscriptions in the live aggregate response — nothing to model.',
    };
  }

  // 2. Exempt vs paying — matches revenue.exempted_subscriber_count / paying_subscriber_count.
  const payingIndices = new Set<number>();
  for (let i = 0; i < Math.min(totalPaying, users.length); i += 1) payingIndices.add(i);
  users.forEach((user, i) => {
    user.is_exempt = user.tier !== 'enterprise' && !payingIndices.has(i);
  });

  // 3. Per-module active cohorts + stable skewed weights (a few heavy users, a long tail).
  const activeCohorts: Record<ModuleKey, number[]> = {
    meeting_time: [],
    kyc_count: [],
    simulator: [],
    proposal: [],
  };
  const weights: Record<ModuleKey, number[]> = {
    meeting_time: [],
    kyc_count: [],
    simulator: [],
    proposal: [],
  };

  for (const module of MODULE_KEYS) {
    const activeCount = Math.min(users.length, Math.max(0, Math.round(summary.features?.[module]?.active_users ?? 0)));
    const shuffled = users.map((_, i) => i).sort(() => rand() - 0.5);
    activeCohorts[module] = shuffled.slice(0, activeCount);
    weights[module] = activeCohorts[module].map(() => Math.pow(rand(), 2.4) + 0.02);
  }

  // 4. Distribute each day's real totals across that module's active cohort.
  const dayIndex = new Map<string, number>();
  const trend = summary.daily_usage_trend ?? [];
  trend.forEach((point, i) => dayIndex.set(point.day, i));

  const perUserDaily: DailyModuleUsage[][] = users.map(() =>
    trend.map((point) => ({ day: point.day, ...emptyQuantities() }))
  );

  for (const module of MODULE_KEYS) {
    const cohort = activeCohorts[module];
    if (cohort.length === 0) continue;
    for (const point of trend) {
      const dayTotal = Math.max(0, Math.round(Number(point[module]) || 0));
      if (dayTotal === 0) continue;
      // Re-jitter weights per day so heavy users vary day to day but stay heavy overall.
      const dayWeights = weights[module].map((w) => w * (0.35 + rand()));
      const parts = allocate(dayTotal, dayWeights);
      const di = dayIndex.get(point.day) ?? 0;
      cohort.forEach((userIdx, i) => {
        perUserDaily[userIdx][di][module] += parts[i];
      });
    }
  }

  // 4b. Integer allocation concentrates small totals (32 KYC checks across 11 users)
  //     on the heaviest weights, leaving cohort members on zero. Shuffle single units
  //     sideways *within the same day* so the number of users showing activity matches
  //     `features[*].active_users` without disturbing any daily total.
  for (const module of MODULE_KEYS) {
    const cohort = activeCohorts[module];
    const target = cohort.length;
    if (target === 0) continue;

    const totalFor = (userIdx: number) => perUserDaily[userIdx].reduce((sum, row) => sum + row[module], 0);
    const zeroUsers = cohort.filter((idx) => totalFor(idx) === 0);

    for (const idleIdx of zeroUsers) {
      const donor = cohort
        .filter((idx) => totalFor(idx) >= 2)
        .sort((a, b) => totalFor(b) - totalFor(a))[0];
      if (donor === undefined) break;
      const dayIdx = perUserDaily[donor].findIndex((row) => row[module] >= 1);
      if (dayIdx === -1) break;
      perUserDaily[donor][dayIdx][module] -= 1;
      perUserDaily[idleIdx][dayIdx][module] += 1;
    }
  }

  // 5. Roll per-day rows up into window totals and current-cycle totals.
  users.forEach((user, i) => {
    const daily = perUserDaily[i];
    user.daily = daily;

    const windowUsage = emptyQuantities();
    const cycleUsage = emptyQuantities();
    const cycleStart = user.billing_cycle_start.slice(0, 10);
    let lastActive: string | null = null;

    for (const row of daily) {
      let touched = false;
      for (const module of MODULE_KEYS) {
        const value = row[module];
        windowUsage[module] += value;
        if (row.day >= cycleStart) cycleUsage[module] += value;
        if (value > 0) touched = true;
      }
      if (touched) lastActive = row.day;
    }

    user.window_usage = windowUsage;
    user.cycle_usage = cycleUsage;
    user.last_active_at = lastActive;
  });

  // 6. Unpaid invoices — distributed from the real receivables total (§4.2).
  const ar = summary.accounts_receivable;
  const outstanding = ar?.total_outstanding_usd ?? 0;
  if (outstanding > 0) {
    const invoiceCount = Math.max(1, ar?.open_invoice_count ?? 1);
    const candidates = users
      .map((_, i) => i)
      .sort(() => rand() - 0.5)
      .slice(0, Math.min(invoiceCount, users.length));
    const cents = allocate(Math.round(outstanding * 100), candidates.map(() => 0.5 + rand()));
    candidates.forEach((userIdx, i) => {
      users[userIdx].unpaid_usd = cents[i] / 100;
      users[userIdx].open_invoice_count = 1;
    });
  }

  // 7. Cancellations — count comes from the live churn block; reasons are illustrative.
  const canceled = Math.max(0, Math.round(summary.churn?.canceled_in_period ?? 0));
  if (canceled > 0) {
    users
      .map((_, i) => i)
      .sort(() => rand() - 0.5)
      .slice(0, Math.min(canceled, users.length))
      .forEach((userIdx) => {
        users[userIdx].status = 'canceled';
        users[userIdx].churn_reason = CHURN_REASONS[Math.floor(rand() * CHURN_REASONS.length)];
        users[userIdx].renewal_reason = null;
      });
  }

  const enterpriseAdded = (summary.tier_breakdown?.enterprise ?? 0) === 0;

  return {
    source: 'preview',
    period_days: summary.period_days,
    period_start: summary.period_start,
    period_end: summary.period_end,
    generated_at: summary.generated_at,
    users,
    provenance:
      `Per-user rows are modelled from the live aggregate response: each module's per-day totals are split across ` +
      `exactly the number of active users the API reports, so every column still sums to the real figure. ` +
      `Tier counts, the exempt/paying split and receivables come straight from the API. ` +
      (enterpriseAdded
        ? `The Enterprise contract (Google) has no Stripe subscription record, so it is added as ${PREVIEW_ENTERPRISE_ACCOUNTS} account to keep the tier first-class (§3). `
        : '') +
      `Which account did what — and the churn/renewal reasons — are illustrative until /admin/user-usage ships.`,
  };
}

/* ------------------------------------------------------------------ */
/* Fetch                                                               */
/* ------------------------------------------------------------------ */

function isUserUsagePayload(value: unknown): value is { users: UserUsageRecord[] } {
  return (
    !!value &&
    typeof value === 'object' &&
    Array.isArray((value as { users?: unknown }).users) &&
    (value as { users: unknown[] }).users.every(
      (u) => !!u && typeof u === 'object' && 'user_id' in (u as object) && 'cycle_usage' in (u as object)
    )
  );
}

/**
 * Tries the real per-user endpoint first; falls back to the reconciled preview.
 * When `/admin/user-usage` ships, this starts returning live data with no other
 * change anywhere in the app.
 */
export async function fetchUserLevelUsage(
  days: number,
  summary: UsageSummaryResponse,
  options: { allowPreview?: boolean } = {}
): Promise<UserUsageResponse> {
  const { allowPreview = true } = options;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const response = await fetch(`${API_BASE_URL}/admin/user-usage?days=${days}`, {
      method: 'GET',
      headers: adminHeaders(),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const payload: unknown = await response.json();
      if (isUserUsagePayload(payload)) {
        const typed = payload as Partial<UserUsageResponse> & { users: UserUsageRecord[] };
        return {
          source: 'live',
          period_days: typed.period_days ?? days,
          period_start: typed.period_start ?? summary.period_start,
          period_end: typed.period_end ?? summary.period_end,
          generated_at: typed.generated_at ?? summary.generated_at,
          users: typed.users,
          provenance: 'Live per-user data from /admin/user-usage.',
        };
      }
    }
  } catch {
    // Endpoint not built yet (§6) — expected until Sai / Diptanshu ship it.
  }

  if (!allowPreview) {
    return {
      source: 'live',
      period_days: days,
      period_start: summary.period_start,
      period_end: summary.period_end,
      generated_at: summary.generated_at,
      users: [],
      provenance: 'Preview disabled. /admin/user-usage is not available, so there is no per-user data to show.',
    };
  }

  return buildPreviewUserLayer(summary);
}
