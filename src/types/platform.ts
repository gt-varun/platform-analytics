/**
 * Per-user domain model — Requirements §4.1 (the lowest-level view, "required first").
 *
 * This is also the API contract for the endpoints §6 says still need to be built
 * by Sai / Diptanshu. `UserUsageResponse` is exactly what
 * `GET /admin/user-usage?days=N` should return; until it exists the dashboard
 * derives a clearly-labelled preview dataset from the live aggregate endpoint.
 */

import { ModuleKey, TierId } from '../config/pricing';

export type BillingProvider = 'stripe' | 'gcp_marketplace';
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled';

/** Quantities are always in the module's *source* unit: seconds for meeting_time, counts elsewhere. */
export type ModuleQuantities = Record<ModuleKey, number>;

export interface DailyModuleUsage extends ModuleQuantities {
  day: string; // YYYY-MM-DD
}

export interface UserUsageRecord {
  user_id: string;
  display_name: string;
  email: string;
  org_id: string;
  org_name: string;
  tier: TierId;
  billing_provider: BillingProvider;
  status: SubscriptionStatus;
  /** When this user landed on their *current* tier — powers tenure-on-tier (§3, §4.1). */
  tier_started_at: string;
  subscription_started_at: string;
  billing_cycle_start: string;
  billing_cycle_end: string;
  /** 100%-off coupon (the live endpoint reports 52 of these as `exempted_subscriber_count`). */
  is_exempt: boolean;
  /** Usage inside the selected reporting window. */
  window_usage: ModuleQuantities;
  /** Usage inside the *current billing cycle* — the basis for live overage (§4.2). */
  cycle_usage: ModuleQuantities;
  daily: DailyModuleUsage[];
  /** Unpaid renewals + unpaid overages already invoiced (≠ live overage — §4.2). */
  unpaid_usd: number;
  open_invoice_count: number;
  /** Management-only drill-down (§2). */
  churn_reason: string | null;
  renewal_reason: string | null;
  last_active_at: string | null;
}

export type DataSource = 'live' | 'preview';

export interface UserUsageResponse {
  source: DataSource;
  period_days: number;
  period_start: string;
  period_end: string;
  generated_at: string;
  users: UserUsageRecord[];
  /** Why the data is what it is — rendered in the provenance banner. */
  provenance: string;
}

/* ------------------------------------------------------------------ */
/* Derived billing shapes (computed client-side from usage + pricing)  */
/* ------------------------------------------------------------------ */

export interface ModuleBillingLine {
  module: ModuleKey;
  /** Included allowance in source units. null = negotiated (Enterprise). */
  included: number | null;
  used: number;
  remaining: number | null;
  percentUsed: number | null;
  overageUnits: number;
  overageUsd: number;
  /** true once usage crosses the included allowance — drives the overage trigger marker (§4.6). */
  triggered: boolean;
  /** Set when the number cannot be trusted (KYC backend bug, §5.1). */
  unreliable: boolean;
}

export interface PlanRecommendation {
  currentTier: TierId;
  recommendedTier: TierId;
  /** Current tier price + accrued overage. */
  currentMonthlyUsd: number;
  /** Recommended tier price + overage that would remain on that tier. */
  recommendedMonthlyUsd: number;
  savingsUsd: number;
  action: 'stay' | 'upgrade' | 'downgrade' | 'review_enterprise';
  rationale: string;
}

export interface UserBilling {
  user: UserUsageRecord;
  lines: ModuleBillingLine[];
  totalOverageUsd: number;
  totalOverageCredits: number;
  planPriceUsd: number | null;
  projectedInvoiceUsd: number | null;
  recommendation: PlanRecommendation;
  tenureMonths: number;
  /** Starter past the proposed 3-month cap (§3) — tracked, not enforced. */
  overTenureCap: boolean;
  cycleProgress: number; // 0..1 through the current billing cycle
}

/* ------------------------------------------------------------------ */
/* Time granularity (§4.1, §4.4, §4.6)                                 */
/* ------------------------------------------------------------------ */

export type Granularity = 'day' | 'week' | 'month' | 'year';

export interface TrendBucket extends ModuleQuantities {
  /** Bucket key, e.g. 2026-08-11 (week starting) or 2026-08 (month). */
  bucket: string;
  label: string;
  start: string;
  end: string;
}

/* ------------------------------------------------------------------ */
/* Delivery tracking (§5, §8, §9)                                      */
/* ------------------------------------------------------------------ */

export interface KnownIssue {
  id: string;
  title: string;
  detail: string;
  severity: 'blocker' | 'high' | 'medium';
  owner: string;
  status: 'open' | 'in_dashboard' | 'fixed';
  section: string;
}

export interface OpenQuestion {
  id: string;
  question: string;
  context: string;
  owner: string;
}

export interface ActionItem {
  owner: string;
  action: string;
  status: 'done' | 'in_progress' | 'blocked' | 'not_started';
}
