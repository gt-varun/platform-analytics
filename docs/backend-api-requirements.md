# Analytics Dashboard — Backend API Requirements

**For:** Sai, Diptanshu, backend team
**From:** Varun
**Status:** Ready to build. Every endpoint below is consumed by working front-end code already merged — the views exist and render against a modelled preview until these ship.
**Source of truth for shapes:** `src/types/platform.ts` in the dashboard repo.

---

## 1. Why this exists

The dashboard today has exactly one endpoint: `GET /admin/usage-summary`, which returns **aggregates only**. The requirements document asks for a per-user layer *first* (§4.1) — "how much has each individual user consumed, what overage have they accrued this cycle, what plan should they be on" — and every other layer (Admin rollups, Billing, Management) is defined as an aggregation of that per-user layer.

None of that can be computed from the aggregate response. The dashboard currently derives a clearly-labelled preview dataset from the live aggregates so the layout and metric definitions can be reviewed now; every screen built on it shows an amber "preview data" banner. When the endpoints below ship, the front end picks them up with no other change — the fetch already tries the real endpoint first and falls back only on failure.

**Build order:** P0 unblocks the per-user and User-layer views. P1 makes overage and invoicing trustworthy. P2 answers "why are people dropping out / renewing".

---

## 2. Conventions

| | |
|---|---|
| **Base URL** | `https://stripe-backend-cowwwkwqaq-el.a.run.app` |
| **Admin auth** | `X-Internal-Secret: <secret>` on every `/admin/*` call. Missing/wrong → `403`. |
| **End-user auth** | `/me/*` uses the **end user's session token**, never the internal secret. See §8. |
| **Timestamps** | ISO 8601 with offset, UTC (`2026-08-16T15:51:56+00:00`). Day keys are `YYYY-MM-DD`. |
| **Money** | USD, JSON number, 2 decimal places. Field names end `_usd`. |
| **Content type** | `application/json; charset=utf-8` |
| **Errors** | `{ "error": { "code": "...", "message": "..." } }` with the right status: `400` bad params, `401` missing/invalid session, `403` wrong secret or out of scope, `404` unknown id, `429` rate limited, `5xx` server. Never return `200` with an error body. |
| **Latency budget** | ≤ 5s p95. `/admin/usage-summary` currently takes ~7s; the per-user endpoints must not be slower, since the dashboard calls them on every window change. |
| **Caching** | `Cache-Control: private, max-age=60` is fine on `/admin/*`. Overage and invoice data must be no more than 5 minutes stale. |

### Units — do not convert these

| Module key | Unit in the payload | Notes |
|---|---|---|
| `meeting_time` | **seconds** (integer) | Never send minutes or a preformatted string. The dashboard formats to days, hours and minutes. |
| `kyc_count` | count (integer) | |
| `simulator` | count (integer) | |
| `proposal` | count (integer) | |

Send raw consumption in these units and **nothing else** — no prices, no credits, no "percent of plan used". The dashboard owns the rate card (`src/config/pricing.ts`) so pricing can change without a backend deploy. The one exception is `/admin/overage-ledger` (P1), which exists specifically so billing-grade money is computed server-side; when it disagrees with the client-side estimate, the ledger wins.

---

## 3. P0 — `GET /admin/user-usage`

**The foundation layer (§4.1). Nothing else in this document matters as much as this one.**

```
GET /admin/user-usage?days=30&limit=200&cursor=
X-Internal-Secret: <secret>
```

### Query parameters

| Param | Type | Default | Notes |
|---|---|---|---|
| `days` | int 1–365 | 30 | Trailing window for `window_usage` and `daily`. Same semantics as `usage-summary`. |
| `limit` | int 1–500 | 200 | Page size. |
| `cursor` | string | — | Opaque; echo `next_cursor` back. Omit when there are no more pages. |
| `include_daily` | bool | `true` | Allow `false` to skip the per-day arrays for cheap list views. |

### Response

```jsonc
{
  "period_days": 30,
  "period_start": "2026-07-17T15:51:56+00:00",
  "period_end": "2026-08-16T15:51:56+00:00",
  "generated_at": "2026-08-16T15:51:56+00:00",
  "next_cursor": null,
  "users": [
    {
      "user_id": "3f1c...",                       // stable internal id
      "display_name": "Jane Okafor",
      "email": "jane@acme.com",
      "org_id": "org_8812",
      "org_name": "Acme Capital",

      "tier": "starter",                          // "starter" | "pro" | "enterprise"
      "billing_provider": "stripe",               // "stripe" | "gcp_marketplace"
      "status": "active",                         // "active" | "trialing" | "past_due" | "canceled"

      "subscription_started_at": "2025-06-18T09:12:00+00:00",
      "tier_started_at":         "2026-05-02T11:40:00+00:00",  // when they landed on the CURRENT tier
      "billing_cycle_start":     "2026-08-02T11:40:00+00:00",
      "billing_cycle_end":       "2026-09-02T11:40:00+00:00",

      "is_exempt": false,                         // 100%-off coupon applied

      "window_usage": { "meeting_time": 573240, "kyc_count": 6, "simulator": 0, "proposal": 12 },
      "cycle_usage":  { "meeting_time": 402180, "kyc_count": 4, "simulator": 0, "proposal": 9 },

      "daily": [
        { "day": "2026-07-17", "meeting_time": 20175, "kyc_count": 1, "simulator": 0, "proposal": 0 }
      ],

      "unpaid_usd": 0.0,
      "open_invoice_count": 0,

      "churn_reason": null,
      "renewal_reason": null,
      "last_active_at": "2026-08-15"
    }
  ]
}
```

### Field notes — the ones that will get built wrong

- **`tier_started_at` is not `subscription_started_at`.** It is the timestamp of the most recent tier change (or the subscription start if they've never changed tier). The entire §3 "cap Starter at 3 months" analysis depends on it — with the signup date instead, every migrated account is mis-bucketed. If tier history isn't stored, this is the moment to start storing it (see P2).
- **`cycle_usage` is scoped to the open billing cycle**, which is anchored on each subscription's own billing day — *not* to the calendar month and *not* to `days`. Live overage (§4.2) is computed from this. `window_usage` is scoped to `days` and drives the trend charts. Both are needed; they are different numbers.
- **`daily` must cover every day in the window**, including zero days, ordered ascending. Zero days are what make a trend chart read correctly.
- **`is_exempt`** mirrors the `exempted_subscriber_count` concept already in `usage-summary.revenue` — the accounts on the 100%-off migration coupon. Exempt accounts still accrue overage; they just don't pay the plan line.
- **`unpaid_usd`** is invoiced-and-unpaid only. Do not put live in-cycle overage in it — that conflation is exactly the §4.2 bug being fixed.
- **`churn_reason` / `renewal_reason`** may be `null` until P2 lands. Don't block P0 on them.
- **Enterprise accounts have no Stripe subscription row.** They must still appear here with `tier: "enterprise"` and `billing_provider: "gcp_marketplace"` (or whatever reflects reality), sourced from wherever the contract is recorded. §3 is explicit that Enterprise must not be missing — it is already sold to Google.

### Acceptance criteria

The dashboard verifies these; a build that fails them will visibly disagree with itself.

1. For each module, `Σ users[].window_usage[m]` equals `usage-summary.features[m].total_units` for the same `days`.
2. For each module, the count of users with `window_usage[m] > 0` equals `usage-summary.features[m].active_users`.
3. For each module and each day, `Σ users[].daily[day][m]` equals `usage-summary.daily_usage_trend[day][m]`.
4. `Σ users[].window_usage[m]` over `daily` equals that user's `window_usage[m]` exactly.
5. Tier counts across all pages equal `usage-summary.tier_breakdown`, plus any Enterprise contracts that have no Stripe row.
6. `cycle_usage[m] ≤ window_usage[m]` whenever the cycle start falls inside the window.
7. `Σ users[].unpaid_usd` equals `usage-summary.accounts_receivable.total_outstanding_usd`.

---

## 4. P0 — `GET /me/usage`

The User layer (§2): a person sees **their own data and nothing else**.

```
GET /me/usage?days=30
Authorization: Bearer <end-user session token>
```

Returns **one** `UserUsageRecord` — the identical object shape as an element of `users[]` above, wrapped:

```jsonc
{ "period_days": 30, "period_start": "...", "period_end": "...", "generated_at": "...", "user": { /* UserUsageRecord */ } }
```

**Requirements**

- The user id is taken **from the session, never from a query parameter.** If a `user_id` param is accepted at all, it must be rejected with `403` unless the caller also holds an admin role.
- `churn_reason` / `renewal_reason` must be omitted or `null` here — internal commentary, not customer-facing.
- Must not require the internal secret. The dashboard's User layer will run under end-user auth.

---

## 5. P1 — `GET /admin/overage-ledger`

Billing-grade overage, computed server-side (§4.2). Today the dashboard computes overage client-side from usage + the rate card, which is right for a review prototype and wrong for anything that ends on an invoice.

```
GET /admin/overage-ledger?cycle=current
```

| Param | Type | Default | Notes |
|---|---|---|---|
| `cycle` | `current` \| `previous` \| `YYYY-MM` | `current` | Per-subscription cycle, not calendar month. |
| `user_id` | string | — | Optional filter. |

```jsonc
{
  "generated_at": "2026-08-16T15:51:56+00:00",
  "rate_card_version": "2026-08-01",
  "lines": [
    {
      "user_id": "3f1c...",
      "module": "meeting_time",
      "cycle_start": "2026-08-02T11:40:00+00:00",
      "cycle_end": "2026-09-02T11:40:00+00:00",
      "included_units": 32400,      // source units included by their plan
      "used_units": 402180,
      "overage_units": 369780,
      "rate_usd": 1.0,              // per rate unit (hour for meetings, unit otherwise)
      "rate_unit": "hour",
      "overage_usd": 102.72,
      "as_of": "2026-08-16T15:45:00+00:00",
      "confidence": "exact"         // "exact" | "under_reporting"
    }
  ]
}
```

- **`confidence: "under_reporting"`** is how the KYC bug (§5.1) is communicated until it's fixed. The dashboard already badges KYC as unverified; this field lets it stop hard-coding that assumption.
- `rate_card_version` lets us tell "the price changed" apart from "usage changed" when a number moves.
- Emit a line per user per module **even when overage is zero** — the zero is information for the meter.

---

## 6. P1 — `GET /admin/invoices`

Unpaid renewals and unpaid overages, split by reason (§4.2 / §4.4). The current `accounts_receivable` block gives a total and the top invoices, but not *what the money is for*, which is the distinction the requirements doc asks to make explicit.

```
GET /admin/invoices?status=open&provider=all&limit=200&cursor=
```

| Param | Values | Notes |
|---|---|---|
| `status` | `open` \| `overdue` \| `paid` \| `all` | Default `open`. |
| `provider` | `stripe` \| `gcp_marketplace` \| `all` | Default `all`. |

```jsonc
{
  "invoices": [
    {
      "invoice_id": "in_1P...",
      "user_id": "3f1c...",
      "customer_id": "cus_...",
      "reason": "overage",            // "renewal" | "overage" | "mixed" | "other"
      "amount_usd": 80.0,
      "amount_remaining_usd": 80.0,
      "currency": "usd",
      "channel": "stripe",            // billing channel, see §4.4 of the requirements doc
      "created": "2026-07-20T10:00:00+00:00",
      "due_date": "2026-08-03T10:00:00+00:00",   // null when Stripe set none
      "overdue": true,
      "status": "open"
    }
  ],
  "next_cursor": null,
  "coverage_note": "Stripe only — Google collects Marketplace invoices directly."
}
```

- `reason` is the point of this endpoint. `mixed` is allowed but should carry a `line_items` breakdown if it's common.
- `overdue` must not silently mean "no due date set". If Stripe set no due date, return `overdue: false` and let the dashboard say so — the current behaviour under-reports overdue invoices and we should stop guessing.
- Keep `coverage_note` accurate: we have no visibility into what Marketplace customers owe.

---

## 7. P2 — `GET /admin/subscription-events`

Answers Management's "why are people dropping out, why are people renewing" (§2), and removes the "no history table exists" caveat currently attached to churn.

```
GET /admin/subscription-events?days=365&limit=500&cursor=
```

```jsonc
{
  "events": [
    {
      "event_id": "evt_...",
      "user_id": "3f1c...",
      "event": "tier_change",     // "created" | "tier_change" | "renewed" | "canceled" | "reactivated" | "payment_failed"
      "from_tier": "starter",
      "to_tier": "pro",
      "reason_code": "usage_growth",
      "reason_note": "Meeting minutes doubled after the compliance mandate",
      "occurred_at": "2026-05-02T11:40:00+00:00",
      "mrr_delta_usd": 35.0
    }
  ],
  "next_cursor": null
}
```

- A closed `reason_code` vocabulary is worth agreeing now, even if it starts small: `price`, `usage_growth`, `usage_decline`, `champion_left`, `competitor`, `procurement`, `payment_failure`, `migrated_enterprise`, `unknown`. Free text alone is unanalysable.
- Once this exists, `tier_started_at` in P0 becomes derivable rather than stored twice, and churn stops being an estimate.

---

## 8. Server-side access control (§2)

The dashboard gates every view on a permission matrix, but **client-side gating is a UX contract, not a security boundary.** The same matrix has to hold server-side:

| Layer | Must be able to call | Must be refused |
|---|---|---|
| **User** | `/me/usage` | Any `/admin/*`; any request naming another `user_id` |
| **Admin** | Aggregated org rollups | Individual users' raw rows — §2 says rollups only |
| **Billing / Procurement** | `/admin/invoices`, `/admin/overage-ledger` | Usage-behaviour detail |
| **Management / Super Admin** | Everything, including per-user drill-down | — |

Two concrete asks:

1. **Do not serve the Admin layer by sending all rows and filtering in the browser.** If Admin is meant to see rollups only, `/admin/user-usage` must reject an Admin token and a pre-aggregated endpoint must serve them instead — otherwise the raw data is one devtools tab away.
2. **Scope by org.** `org_id` is in the payload; Admins must only ever receive their own org's accounts (§2: "no cross-org visibility").

The current shared `X-Internal-Secret` cannot express any of this — it is one key with total access. Moving `/admin/*` to per-role tokens or a signed JWT with a role claim is a prerequisite for shipping the role-based views to real users, as opposed to demoing them.

---

## 9. Fixes needed on the existing endpoint

| # | Issue | Detail | Owner |
|---|---|---|---|
| 1 | **KYC overage tracking is broken** | Blocked by the backend/KYC-initiation dependency — initiated-but-uncompleted checks aren't counted, so KYC overage under-reports. Every KYC number in the dashboard is badged "unverified" until this clears. (§5.1) | Avi / backend, confirm via Sai |
| 2 | **`daily_usage_trend` doesn't sum to `features.total_units`** | On the live 30-day response the per-day meeting series sums **11,758s (3h 16m) higher** than the feature total: the trend returns 31 whole day-buckets while the total uses a 30-day timestamp window, so the partial first day is in one and not the other. Any chart-vs-headline comparison fails to tie out. Align the two windows. | Sai |
| 3 | **`near_limit_users` returns empty while accounts are demonstrably over** | The endpoint's limit configuration isn't set to the §3 package allowances (9h meetings, 3 KYC, 3 simulations, 25 proposals on Starter), so it reports nobody near a limit while the §3 model counts a dozen accounts already past one. Either configure it to the real package values or drop the field and let the dashboard own it. | Sai |
| 4 | **Enterprise is missing from `tier_breakdown`** | Enterprise has no Stripe row, so the tier split silently omits a tier that is already sold. Add it from the contract source, even if the count is 1. (§3) | Sai / Diptanshu |
| 5 | **Average duration semantics** | Keep sending seconds — the "multi-thousand-minute average" problem (§5.2) was a formatting bug and is fixed in the dashboard. Do not switch to preformatted strings. | — |

---

## 10. Sequencing & ownership

| Priority | Endpoint | Unblocks | Owner |
|---|---|---|---|
| **P0** | `GET /admin/user-usage` | Per-user usage, Org Rollup, Overage tracking, Plans & tenure — i.e. most of the dashboard | Sai / Diptanshu |
| **P0** | `GET /me/usage` | The User layer (§2), the lowest common denominator everything else aggregates from | Sai |
| **P1** | `GET /admin/overage-ledger` | Billing-grade overage, invoice-safe numbers | Sai |
| **P1** | `GET /admin/invoices` | Renewal-vs-overage split, Billing/Procurement layer | Sai |
| **P2** | `GET /admin/subscription-events` | Churn/renewal reasons, real tier history, exact churn | Diptanshu |
| **P0 (parallel)** | Fixes 1–4 in §9 | Correctness of numbers already on screen | Avi / Sai |

**Definition of done for P0:** the dashboard's provenance banner turns from amber to green, and the seven acceptance criteria in §3 pass against production data.

---

## 11. Open questions that change the shapes above

These are leadership decisions, not engineering ones, but they alter the contract:

1. **What is actually in the $55 Pro bundle?** §3 fixes the price and not the allowance. The dashboard currently models $58 of included value, back-solved from the "$60 in overages — the $55 plan saves you $5" example. If the real bundle is smaller, upgrade recommendations can never fire — the dashboard's break-even table shows Pro would need 44h of meetings included, against the 29h currently modelled.
2. **Confirm per-module overage pricing** (KYC $1, Simulation $1, Proposal $0.12). If these move, only the dashboard's rate card changes — *unless* the overage ledger (P1) has already shipped, in which case both must move together and `rate_card_version` must be bumped.
3. **Is the 3-month Starter cap being enforced?** The dashboard tracks tenure either way. Enforcement would need a `tier_deadline` on the subscription and a migration job — neither is in scope above.
