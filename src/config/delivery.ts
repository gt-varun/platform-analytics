/**
 * Delivery tracking — Requirements §5 (known issues), §6 (data sources),
 * §8 (open questions) and §9 (action items), rendered in the Delivery view so the
 * requirements doc and the dashboard can't drift apart.
 */

import { ActionItem, KnownIssue, OpenQuestion } from '../types/platform';

/**
 * §5.1 — KYC overage tracking is broken behind a backend/KYC-initiation dependency.
 * Every KYC overage number in the UI is badged off this flag; flip it to `true`
 * once Sai confirms the fix and the badge disappears everywhere at once.
 */
export const KYC_OVERAGE_TRACKING_RELIABLE = false;

export const KNOWN_ISSUES: KnownIssue[] = [
  {
    id: 'kyc-overage',
    title: 'KYC overage tracking is broken',
    detail:
      'Blocked by a backend dependency tied to KYC initiation — initiated-but-uncompleted checks are not counted, ' +
      'so KYC overage under-reports. Every KYC overage figure in this dashboard carries an "unverified" badge until ' +
      'the fix lands.',
    severity: 'blocker',
    owner: 'Avi / backend — confirm via Sai',
    status: 'open',
  },
  {
    id: 'avg-duration',
    title: 'Average duration values were nonsensical',
    detail:
      'The old dashboard printed raw seconds (e.g. "519,663") as an average. Durations are now formatted as ' +
      'days, hours and minutes everywhere, with the raw figure demoted to a tooltip.',
    severity: 'medium',
    owner: 'Dashboard',
    status: 'in_dashboard',
  },
  {
    id: 'provider-label',
    title: '“Billing provider breakdown” label was unclear',
    detail:
      'Renamed to Billing Management. The count is subscriptions per billing *channel* (Stripe direct vs GCP ' +
      'Marketplace) — never a count of 56 payment providers. Channel definitions are stated in the panel.',
    severity: 'medium',
    owner: 'Dashboard',
    status: 'in_dashboard',
  },
  {
    id: 'receivables-label',
    title: '“Outstanding Receivables” conflated two different things',
    detail:
      'Relabelled "Unpaid Renewals & Overages" and defined as invoiced-but-unpaid only. Live overage accrued this ' +
      'cycle is now a separate metric and never mixes into it.',
    severity: 'high',
    owner: 'Dashboard',
    status: 'in_dashboard',
  },
  {
    id: 'trend-total-mismatch',
    title: 'daily_usage_trend does not sum to features.meeting_time.total_units',
    detail:
      'On the live 30-day response the per-day meeting series sums ~11,758s (3h 16m) higher than the feature total. ' +
      'The trend returns 31 whole day-buckets while the total uses a 30-day timestamp window, so the partial first ' +
      'day is counted in one and not the other. Small in absolute terms, but any chart-vs-headline comparison will ' +
      'not tie out. This dashboard builds per-user data from the daily series and shows headline totals from the ' +
      'feature block, so both are internally consistent — the API should still align the two windows.',
    severity: 'medium',
    owner: 'Sai / backend',
    status: 'open',
  },
  {
    id: 'per-user-endpoint',
    title: 'No per-user usage endpoint exists yet',
    detail:
      'The live backend exposes aggregates only (/admin/usage-summary). The per-user layer this dashboard needs cannot be ' +
      'sourced from it, so those views run on a preview dataset derived from the real aggregates until the endpoints ' +
      'in the Data Contract tab ship.',
    severity: 'blocker',
    owner: 'Sai / Diptanshu',
    status: 'open',
  },
];

export const OPEN_QUESTIONS: OpenQuestion[] = [
  {
    id: 'migration',
    question: 'Finalise the $20 → $55 forced migration (3-month cap) before or after the dashboard is built?',
    context:
      'The dashboard tracks tier tenure either way — the Plans view flags every Starter past 3 months today, so the ' +
      'policy can be evaluated against real data before it is enforced.',
    owner: 'Leadership',
  },
  {
    id: 'terminology',
    question: 'Final terminology for the “Billing provider breakdown” replacement.',
    context: 'Shipped as "Billing Management" with channel-level definitions. Rename is a one-line change.',
    owner: 'Leadership',
  },
  {
    id: 'overage-pricing',
    question: 'Confirm per-module overage pricing (KYC, Simulation, Proposal Hub).',
    context:
      'Currently $1 / $1 / $0.12 as rough estimates, pending the pricing worksheet vs Higgsfield and other ' +
      'competitors. All rates live in one config file.',
    owner: 'Sai / Varun / Diptanshu',
  },
  {
    id: 'pro-bundle',
    question: 'What is actually included in the $55 Pro tier?',
    context:
      'The pricing model fixes the price but not the bundle. Modelled at ~$50 of included value so recommendations can be computed ' +
      '— every Pro allowance number depends on this answer.',
    owner: 'Leadership',
  },
  {
    id: 'design-ref',
    question: 'Which external dashboard is the design reference?',
    context: 'The Google/AWS analytics UI leadership admired — to be shared separately.',
    owner: 'Leadership',
  },
];

export const ACTION_ITEMS: ActionItem[] = [
  { owner: 'Varun', action: 'Deliver the requirements document as the discussion starting point', status: 'done' },
  { owner: 'Varun', action: 'Host the dashboard live (Vercel) and share the link', status: 'in_progress' },
  { owner: 'Sai', action: 'Confirm status of the KYC overage-tracking bug fix; check Proposal Hub & Simulator endpoints', status: 'blocked' },
  { owner: 'Sai / Diptanshu / team', action: 'Build the API endpoints needed for the new analytics (see Data Contract)', status: 'not_started' },
  { owner: 'Team', action: 'Prototype the dashboard structure in Google Sheets before the live build', status: 'in_progress' },
  { owner: 'Leadership', action: 'Share reference dashboard example and Google’s pricing/overage module screenshot', status: 'not_started' },
  { owner: 'Sai / Varun / Diptanshu', action: 'Build the pricing/credit comparison worksheet vs Higgsfield and competitors', status: 'not_started' },
];

export interface EndpointContract {
  method: string;
  path: string;
  status: 'live' | 'required';
  purpose: string;
  owner: string;
  shape: string;
}

/**
 * §6 — what the dashboard needs from the backend. The "required" rows are the
 * whole reason the per-user layer runs on preview data today.
 */
export const ENDPOINT_CONTRACTS: EndpointContract[] = [
  {
    method: 'GET',
    path: '/admin/usage-summary?days=N',
    status: 'live',
    purpose: 'Aggregate usage, revenue, tier/channel splits, receivables, growth, churn.',
    owner: 'Shipped',
    shape: 'UsageSummaryResponse',
  },
  {
    method: 'GET',
    path: '/admin/user-usage?days=N',
    status: 'required',
    purpose:
      'Per-user usage in source units (meeting seconds, KYC/simulation/proposal counts), current billing cycle ' +
      'window, tier + tier_started_at, billing provider, exemption flag, per-day series.',
    owner: 'Sai / Diptanshu',
    shape: 'UserUsageResponse (see src/types/platform.ts)',
  },
  {
    method: 'GET',
    path: '/me/usage',
    status: 'required',
    purpose: 'Same shape as one row of /admin/user-usage, scoped to the caller. Powers the User layer without exposing anyone else.',
    owner: 'Sai',
    shape: 'UserUsageRecord',
  },
  {
    method: 'GET',
    path: '/admin/overage-ledger?cycle=current',
    status: 'required',
    purpose:
      'Overage accrued this billing cycle per user per module, computed server-side from the same rate card. Needed ' +
      'so overage is not a client-side estimate at invoice time.',
    owner: 'Sai',
    shape: '{ user_id, module, units, usd, as_of }[]',
  },
  {
    method: 'GET',
    path: '/admin/invoices?status=open&provider=all',
    status: 'required',
    purpose: 'Unpaid renewals and unpaid overages split by reason, with the billing channel attached.',
    owner: 'Sai',
    shape: '{ invoice_id, user_id, reason: "renewal"|"overage", amount_usd, channel, due_date }[]',
  },
  {
    method: 'GET',
    path: '/admin/subscription-events?days=N',
    status: 'required',
    purpose:
      'Tier changes, cancellations and renewals with reason codes. Removes the "no history table" caveat from churn ' +
      'and is the only way to answer "why are people dropping out / renewing".',
    owner: 'Diptanshu',
    shape: '{ user_id, event, from_tier, to_tier, reason, occurred_at }[]',
  },
];
