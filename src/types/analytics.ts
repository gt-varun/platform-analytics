export type PeriodDays = 30 | 90 | 365;

export interface FeatureMetric {
  total_units: number;
  active_users: number;
  avg_per_active_user: number;
  total_overage_units: number;
  estimated_overage_revenue_usd: number;
}

export interface Features {
  meeting_time: FeatureMetric;
  kyc_count: FeatureMetric;
  simulator: FeatureMetric;
  proposal: FeatureMetric;
}

export interface OpenInvoice {
  invoice_id: string;
  customer_id: string;
  amount_remaining_usd: number;
  created: string;
  overdue: boolean;
}

export interface AccountsReceivable {
  total_outstanding_usd: number;
  open_invoice_count: number;
  overdue_usd: number;
  overdue_invoice_count: number;
  top_open_invoices: OpenInvoice[];
  note?: string;
}

export interface Revenue {
  /** Gross: tier list price × count. Blind to Stripe discounts — kept for backward compatibility. */
  mrr_usd: number;
  arr_usd: number;
  /** Net of active Stripe coupons (e.g. the 100%-off migration coupon). The trustworthy number. */
  real_mrr_usd?: number;
  real_arr_usd?: number;
  real_mrr_by_tier_usd?: Record<string, number>;
  exempted_subscriber_count?: number;
  paying_subscriber_count?: number;
  trialing_pipeline_mrr_usd: number;
  mrr_by_tier_usd: Record<string, number>;
  note?: string;
}

export interface Churn {
  canceled_in_period: number;
  active_now: number;
  active_at_period_start_estimate: number;
  churn_rate: number;
  note?: string;
}

export interface Growth {
  total: number;
  by_day: Record<string, number>;
}

export interface NearLimitUser {
  user_id: string;
  tier: string;
  feature: string;
  used: number;
  limit: number;
  percent_used: number;
}

export interface DailyUsageTrendPoint {
  day: string;
  meeting_time: number;
  kyc_count: number;
  simulator: number;
  proposal: number;
}

export interface UsageSummaryResponse {
  period_days: number;
  period_start: string;
  period_end: string;
  generated_at: string;
  features: Features;
  /** Active subscriptions by tier. Enterprise contracts have no Stripe row and may be absent. */
  tier_breakdown: Record<string, number>;
  /** Subscriptions per billing *channel* (Stripe direct vs GCP Marketplace) — not "56 providers" (§4.4). */
  billing_provider_breakdown: Record<string, number>;
  /** Same splits, excluding 100%-off exempted accounts. */
  paying_tier_breakdown?: Record<string, number>;
  paying_billing_provider_breakdown?: Record<string, number>;
  accounts_receivable: AccountsReceivable;
  revenue: Revenue;
  churn: Churn;
  growth: Growth;
  near_limit_users: NearLimitUser[];
  daily_usage_trend: DailyUsageTrendPoint[];
  note?: string;
}

export type BannerHealthStatus = 'healthy' | 'warning' | 'critical';

export interface InsightItem {
  id: string;
  category: 'Revenue' | 'Usage' | 'Billing' | 'Growth' | 'Churn';
  title: string;
  description: string;
  impact: 'positive' | 'neutral' | 'attention';
}
