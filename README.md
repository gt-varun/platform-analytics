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

- **Executive KPI Dashboard**: Instant visibility into Monthly Recurring Revenue (MRR), Annual Recurring Revenue (ARR), Outstanding Receivables, and Churn Rate.
- **Live Production Analytics**: Real-time integration with backend usage summary APIs without relying on stale mock datasets.
- **Feature Usage Analytics**: Detailed metrics across core feature modules including Meeting Time, KYC Checks, Simulator runs, and Proposal generations.
- **Revenue & Billing Health**: Comprehensive tracking of Accounts Receivable open invoices, overdue collection alerts, and near-limit accounts (>80% plan capacity).
- **Subscription Growth & Tier Insights**: Visual distributions for Starter vs Pro plan breakdown, Stripe vs GCP Marketplace billing providers, and daily activation trends.
- **Derived Executive Insights**: Automatically generated business intelligence alerts highlighting key revenue drivers and action items.
- **Executive PDF Export**: Single-click generation of 4-page, high-resolution executive PDF reports with cover page, KPI summaries, visual charts, and branded footers (`Internal Use Only`, timestamps, and page numbers).
- **Responsive & Dark-Themed UI**: Modern dark-mode aesthetic styled with custom HSL palette, subtle glow effects, and responsive grid layouts.

---

## Screenshots

### Dashboard

(Add screenshot)

### Executive PDF

(Add screenshot)

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
