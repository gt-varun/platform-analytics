# Platform Analytics

An executive-grade business analytics dashboard for SaaS platforms, providing real-time visibility into platform usage, revenue health, customer growth, and billing metrics.

![License](https://img.shields.io/badge/license-MIT-indigo)
![React](https://img.shields.io/badge/React-18.3-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)
![Vite](https://img.shields.io/badge/Vite-6.1-purple)

---

## Overview

**Platform Analytics** is built for SaaS founders, executive teams, and advisors to track core business vitals in real time. It integrates directly with production analytics APIs to deliver actionable insights, customer health alerts, and instant multi-page Executive PDF report exports.

---

## Features

Built against the Analytics Dashboard requirements document; section references below (§) point back to it.

- **Role-based views, four layers (§2)** — User, Super User/Admin, Billing/Procurement and Management, modelled as an explicit RBAC permission matrix in `src/config/roles.ts`. Every view, table and drill-down gates on the same `can(role, permission)` check. Switch layers with the header's *Viewing as* control; `?role=…&view=…` makes any screen linkable.
- **Per-user usage (§4.1)** — the foundation layer: usage per account per module, tier and tenure-on-tier, live overage this billing cycle, day/week/month/year granularity, and a Management-only drill-down drawer.
- **Live overage tracking (§4.2)** — accrual per user per module in the *open* cycle, kept strictly separate from **Unpaid Renewals & Overages** (the renamed "Outstanding Receivables", now defined as invoiced-and-unpaid only). KYC figures carry an *unverified* badge everywhere until the §5.1 backend bug is fixed.
- **Plans & tiers (§4.3)** — Starter / Pro / **Enterprise as a first-class tier**, upgrade *and* downgrade recommendations, tenure distribution for the proposed 3-month Starter cap (tracked, never enforced), the MRR impact if it were enforced, and a break-even table showing whether an upgrade can ever save money under the current rate card.
- **Billing Management (§4.4)** — replaces "Billing provider breakdown"; states what each billing *channel* means (Stripe direct vs GCP Marketplace) and corrects the "56 providers" misreading — it was always a count of subscriptions per channel.
- **Subscription growth (§4.5)** — kept as-is, plus the granularity toggle.
- **Module usage (§4.6)** — every module against its package allowance with the overage trigger drawn in.
- **Delivery & Gaps (§5–§9)** — known issues, the API contract for the endpoints still to be built, pricing assumptions in force, open questions and action items, rendered from config so the doc and the dashboard can't drift.
- **Executive PDF Export**: multi-page executive PDF from the Overview.

## Data sources & honesty about them

| Layer | Source |
|---|---|
| Aggregates, revenue, tier/channel splits, receivables, growth, churn | **Live** — `GET /admin/usage-summary` |
| Per-user rows, tenure, per-account overage, churn/renewal reasons | **Preview** — modelled from the live aggregates until `/admin/user-usage` exists (§6) |

The per-user endpoints do not exist yet, so `src/services/platformData.ts` derives a *reconciled* preview: each module's per-day totals are split across exactly the number of active users the API reports, so every column still sums to the real figure; tier counts, receivables and the exempt/paying split are taken verbatim. Only *which* account did what is synthetic. Any view touching it shows an amber provenance banner, and `?preview=off` disables it entirely. When the real endpoint ships, `fetchUserLevelUsage` picks it up with no other change.

## Pricing model

All pricing lives in `src/config/pricing.ts` — allowances, overage rates, the credit unit and the tenure cap. Views compute from raw usage in source units (seconds / counts), so a change to the credit model is a change to that one file. Assumptions that are *not* confirmed (notably the Pro bundle, back-solved from the "$60 overage → $55 plan saves $5" example in §1) are labelled as such in the UI.

---

## Tech Stack

- **Frontend**: [React 18](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Data Visualization**: [Recharts](https://recharts.org/)
- **PDF Generation**: [jsPDF](https://github.com/parallax/jsPDF), [html-to-image](https://github.com/bubkoo/html-to-image)
- **Icons**: [Lucide React](https://lucide.dev/)

---

## Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) (v18+ recommended) and `npm` installed.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/gt-varun/platform-analytics.git
   cd platform-analytics
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

   The application will run locally at **[http://localhost:3001](http://localhost:3001)**.

---

## Development & Environment

To configure custom internal API credentials or URLs, create a `.env` file in the root directory:

```env
VITE_ADMIN_SECRET=your_x_internal_secret_key
```

Run dev server on port `3001`:
```bash
npm run dev
```

---

## Design system

Two designed themes, not one inverted. **Light** is paper: white cards on a cool neutral canvas, hairline rules, deep navy ink. **Dark** is instrument glass: a deep blue-charcoal ground where elevation is carried by lightness rather than shadow, ink warmed off pure white, and the accent lightened so it still reads. A single navy accent (`--color-accent`) carries structure and active state in both; colour is otherwise reserved for status (positive / caution / critical). Appearance follows the OS by default and can be pinned to Light or Dark from the sidebar — the choice persists, and `?theme=dark` pins it for a shared link.

Every figure is set in IBM Plex Mono with tabular figures so columns align like a statement; Instrument Sans carries the interface. Durations read in days, hours and minutes throughout (`formatDuration`), and duration axes pick one unit for the whole scale from the domain so a chart never reads "23h, 2d, 3d".

The recurring element is the **allowance meter**: the included allowance always sits at the same mark on the track (70%) no matter the module or scale, so "how far over is this account" is comparable at a glance across every row and tier. Past the mark the bar turns critical red — that segment is exactly what bills.

Surface tokens live in [src/index.css](src/index.css) — `@theme` holds the light set, with dark redefined for both an explicit choice and the OS default. Series colours are resolved in JS ([src/theme/index.tsx](src/theme/index.tsx)) because charts and meters need concrete values; each theme's set is validated independently for colour-blind separation and contrast against its own surface.

## Project layout

```
src/
  config/      pricing (tiers, allowances, rates), roles (RBAC), views (nav+gating), delivery (§5–§9)
  services/    api.ts (live aggregates) · platformData.ts (per-user layer + reconciled preview)
  utils/       billing.ts (overage, recommendations, rollups) · timeBuckets.ts (D/W/M/Y) · formatters
  views/       OverviewView · UserViews · MoneyViews · ProgrammeViews
  components/  ui.tsx (primitives) · charts.tsx · domain.tsx · ModuleAllowance · ProvenanceBanner
```

---

## Build for Production

Compile TypeScript and generate production assets:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

---

## License

This project is licensed under the [MIT License](LICENSE).
