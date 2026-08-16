# Platform Usage & Business Analytics API — Handoff

One endpoint, one call, everything needed for the internal usage/business dashboard. No direct database access is granted for this — this endpoint is the intended integration surface.

## Endpoint

```
GET https://stripe-backend-cowwwkwqaq-el.a.run.app/admin/usage-summary?days=30
```

**Auth header** (required on every call):

```
X-Internal-Secret: 72537ce6094b43d88c6d6958b9a101a0f6de7a9bd848e07bfa71b503cf442fa8
```

Missing or wrong secret → `403 Forbidden`.

**Query params**

| Param | Type | Default | Notes |
|---|---|---|---|
| `days` | integer | `30` | Trailing window size, 1–365. Controls `features` and `growth`; does **not** control `accounts_receivable`, `revenue`, or `near_limit_users`, which are always live/current-snapshot (see notes below) |

Example:

```bash
curl -H "X-Internal-Secret: <secret>" \
  "https://stripe-backend-cowwwkwqaq-el.a.run.app/admin/usage-summary?days=30"
```

---

## Response shape

```jsonc
{
  "period_days": 30,
  "period_start": "2026-07-01T12:00:00+00:00",
  "period_end": "2026-07-31T12:00:00+00:00",
  "generated_at": "2026-07-31T12:00:00+00:00",

  "features": {
    "meeting_time": {
      "total_units": 1981113,          // seconds, summed across all users, in the `days` window
      "active_users": 21,              // distinct users with >0 usage in the window
      "avg_per_active_user": 94338.7,
      "total_overage_units": 0,        // see note below - NOT scoped to `days`
      "estimated_overage_revenue_usd": 0.0
    },
    "kyc_count": { "total_units": 29, "active_users": 9, "avg_per_active_user": 3.22, "total_overage_units": 0, "estimated_overage_revenue_usd": 0.0 },
    "simulator":  { "total_units": 2,  "active_users": 2, "avg_per_active_user": 1.0,  "total_overage_units": 0, "estimated_overage_revenue_usd": 0.0 },
    "proposal":   { "total_units": 36, "active_users": 4, "avg_per_active_user": 9.0,  "total_overage_units": 0, "estimated_overage_revenue_usd": 0.0 }
  },

  "tier_breakdown": { "starter": 14, "pro": 6 },
  "billing_provider_breakdown": { "stripe": 18, "gcp_marketplace": 2 },

  "accounts_receivable": {
    "total_outstanding_usd": 240.00,
    "open_invoice_count": 3,
    "overdue_usd": 80.00,
    "overdue_invoice_count": 1,
    "top_open_invoices": [
      { "invoice_id": "in_xxx", "customer_id": "cus_xxx", "amount_remaining_usd": 80.0, "created": "2026-07-20T10:00:00+00:00", "overdue": true }
    ],
    "note": "Stripe only - GCP Marketplace customers are billed and collected by Google directly, we have no visibility into their AR."
  },

  "revenue": {
    "mrr_usd": 1240.00,
    "arr_usd": 14880.00,
    "trialing_pipeline_mrr_usd": 90.00,
    "mrr_by_tier_usd": { "starter": 420.00, "pro": 820.00 },
    "note": "GCP Marketplace subscriptions are assumed to bill at the same tier/interval price as Stripe - unverified against Google's actual listed price."
  },

  "churn": {
    "canceled_in_period": 2,
    "active_now": 20,
    "active_at_period_start_estimate": 22,
    "churn_rate": 0.0909,
    "note": "Approximate - reconstructed from current status + updated_at, no history table exists."
  },

  "growth": {
    "total": 5,
    "by_day": { "2026-07-24": 1, "2026-07-27": 2, "2026-07-30": 2 }
  },

  "near_limit_users": [
    { "user_id": "uuid", "tier": "starter", "feature": "kyc_count", "used": 3, "limit": 3, "percent_used": 1.0 }
  ],

  "daily_usage_trend": [
    { "day": "2026-07-24", "meeting_time": 213635, "kyc_count": 0, "simulator": 0, "proposal": 3 },
    { "day": "2026-07-25", "meeting_time": 16808,  "kyc_count": 2, "simulator": 0, "proposal": 1 }
  ],

  "note": "estimated_overage_revenue_usd/total_overage_units under `features` are a current-period snapshot on live subscriptions, not scoped to period_days. `revenue`, `churn`, and `near_limit_users` are best-effort estimates - see each section's own `note` field. Nothing here includes infra/LLM/vendor spend (accounts payable) - this system does not track that."
}
```

---

## Field-by-field notes (read before building anything on top of this)

### `features` — per-feature usage totals
Exact counts from the source event tables (meeting logs, KYC checks, simulator sessions, proposal generations), for the `days` window you asked for. `total_overage_units` / `estimated_overage_revenue_usd` inside each feature are **not** scoped to `days` — they're a snapshot of *current-period-to-date overage on live subscriptions right now*, because the underlying counters reset every billing period and there's no historical per-window overage to query. Read it as "what would overage-bill today if every period closed right now," not a trend.

### `tier_breakdown` / `billing_provider_breakdown`
Count of currently active/trialing/pending-cancellation subscriptions by plan tier and by billing provider (Stripe vs Google Cloud Marketplace).

### `accounts_receivable`
**Stripe only.** Sum of `amount_remaining` on all currently-open Stripe invoices, split into overdue vs not (based on `due_date` if Stripe set one — many automatic-charge invoices don't have one, in which case `overdue` may under-report). We have zero visibility into what Google Marketplace customers owe — Google collects and remits that themselves.

### `revenue` (MRR/ARR)
Computed by summing each active subscription's real Stripe price (fetched live from Stripe, not hardcoded), converting annual plans to a monthly-equivalent. **Assumption to flag to Ginnie**: Marketplace subscriptions are assumed to bill at the same price as the equivalent Stripe tier/interval — this is unverified against Google's actual listed price, so if Marketplace pricing diverges, this number is off by that amount.

### `churn`
**Approximate, not a real cohort calculation.** There's no subscription-state-history table in this system, so "active at start of period" is reconstructed as (currently active) + (canceled during the window) — assuming anyone who canceled during the window was active right before they did. Good enough for a rough trend line, not for anything precise.

### `growth`
New subscriptions created per day in the window — a straightforward signup count, no caveats.

### `near_limit_users`
Top 20 users currently at 80–99% of their plan's limit for any feature (not yet over — those are already captured in `features[*].total_overage_units`). Meant for upsell targeting, not billing.

### `daily_usage_trend`
Same 4 features, broken out per day across the whole window — this is what should feed a line/bar chart. Same counting rules as `features`, just with daily granularity instead of one total.

### What this endpoint does **not** and cannot answer
"Accounts payable" (what we owe vendors, infra/LLM spend, Google's revenue-share cut) is not tracked anywhere in this database or codebase — it lives in actual accounting software, not here. Don't build a dashboard section implying this endpoint covers that; it doesn't and can't.

---

## Suggested dashboard layout

Roughly matches the response's own grouping — build sections in this order of likely importance to Ginnie:

1. **Top strip**: MRR, ARR, total outstanding AR, churn rate — four big numbers.
2. **Usage overview**: one card per feature (`meeting_time`, `kyc_count`, `simulator`, `proposal`) showing total units + active users + avg/user, mirroring `app.spiked.ai/admin`'s existing usage cards.
3. **Trend chart**: `daily_usage_trend`, one line/bar per feature, exactly like the billing page's existing usage chart.
4. **Tier & provider split**: two small pie/bar charts from `tier_breakdown` / `billing_provider_breakdown`.
5. **At-risk lists**: `near_limit_users` (upsell targets) and `accounts_receivable.top_open_invoices` (collections targets) as two tables.
6. **Growth**: `growth.by_day` as a small signup trend line.

## What's intentionally not provided
No direct Supabase/database access. This endpoint is the full intended integration surface — if something's missing that the dashboard needs, ask and it gets added here rather than opening broader DB access.
