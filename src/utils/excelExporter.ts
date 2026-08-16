import { UsageSummaryResponse, InsightItem } from '../types/analytics';
import { UserBilling, UserUsageResponse } from '../types/platform';
import { MODULES, MODULE_KEYS, TIERS, TIER_ORDER, TierId } from '../config/pricing';
import { RoleId, ROLES, can } from '../config/roles';
import { OrgRollup } from './billing';
import { Column, Sheet, buildWorkbook, downloadBlob } from './xlsx';

/**
 * Excel export — Requirements §2 / §4.
 *
 * The PDF is the narrative artefact: charts, framing, an executive read. This is
 * the opposite deliverable — the underlying figures, unrounded and unformatted,
 * so finance can pivot them without retyping anything off a slide.
 *
 * Two rules hold the whole file together:
 *
 * 1. Numbers are written as numbers. No "$1,240.00" strings, no "9.1%" text —
 *    the cell carries the value and the workbook carries the format. A string
 *    that looks like money is the single most common way an export like this
 *    becomes useless the moment someone tries to sum a column.
 *
 * 2. The workbook obeys the same `can(role, …)` matrix as the screen. An export
 *    is the easiest place to leak a layer past its boundary — Billing must not
 *    receive usage-behaviour detail, Admin must not receive identified per-user
 *    rows — so every sheet is gated, and the Scope sheet records what was
 *    withheld rather than leaving a silent gap.
 */

interface WorkbookInput {
  summary: UsageSummaryResponse;
  userLayer: UserUsageResponse;
  billings: UserBilling[];
  rollup: OrgRollup;
  role: RoleId;
  days: number;
  insights: InsightItem[];
}

/** Meeting time is stored in seconds; nobody pivots on seconds. */
function displayQuantity(module: (typeof MODULE_KEYS)[number], sourceUnits: number): number {
  return MODULES[module].sourceUnit === 'seconds' ? sourceUnits / 3600 : sourceUnits;
}

function displayUnitLabel(module: (typeof MODULE_KEYS)[number]): string {
  return MODULES[module].sourceUnit === 'seconds' ? 'hours' : 'count';
}

/** ISO date only — Excel's own date type would need a serial conversion and a
 *  format per locale; a plain YYYY-MM-DD string sorts correctly and imports
 *  cleanly into every pivot tool. */
function isoDay(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Sheets                                                              */
/* ------------------------------------------------------------------ */

function scopeSheet(input: WorkbookInput, included: string[], withheld: string[], empty: string[]): Sheet {
  const { summary, userLayer, role, days } = input;
  const rows: Array<[string, string]> = [
    ['Report', 'Platform usage & billing analytics'],
    ['Generated at', new Date().toISOString()],
    ['Backend snapshot', summary.generated_at],
    ['Reporting window', `${days} days (${isoDay(summary.period_start)} → ${isoDay(summary.period_end)})`],
    ['Exported as role', ROLES[role].label],
    ['Role scope', ROLES[role].scopeNote],
    ['Per-user data source', userLayer.source === 'live' ? 'Live endpoint' : 'Modelled preview (not live)'],
    ['Provenance', userLayer.provenance],
    ['', ''],
    ['Sheets included', included.join(', ')],
    ['Withheld by role (§2)', withheld.length > 0 ? withheld.join(', ') : 'Nothing — this role sees every sheet'],
    // A sheet that is permitted but has no rows is dropped rather than shipped
    // empty. Saying so matters: an absent sheet otherwise reads as a permission
    // boundary, which is a very different claim from "there was no data".
    [
      'Omitted — no data',
      empty.length > 0 ? empty.join(', ') : 'None — every permitted sheet had rows',
    ],
  ];

  if (userLayer.source === 'preview') {
    rows.push(
      ['', ''],
      [
        'WARNING',
        'The per-user layer is modelled, not measured. Account-level rows reconcile to the live org ' +
          'totals but are not real individual records — do not quote them as such.',
      ]
    );
  }

  return {
    name: 'Scope',
    columns: [
      { header: 'Field', width: 26 },
      { header: 'Value', width: 96 },
    ],
    rows,
  };
}

function summarySheet(input: WorkbookInput): Sheet {
  const { summary, rollup, role } = input;
  const rows: Array<[string, number | string, string]> = [];

  if (can(role, 'view:revenue')) {
    rows.push(
      ['Net MRR (USD)', summary.revenue.real_mrr_usd ?? summary.revenue.mrr_usd, 'Net of active Stripe coupons'],
      ['Net ARR (USD)', summary.revenue.real_arr_usd ?? summary.revenue.arr_usd, 'Net MRR × 12'],
      ['Gross MRR (USD)', summary.revenue.mrr_usd, 'List price × count — blind to discounts'],
      ['Trialing pipeline MRR (USD)', summary.revenue.trialing_pipeline_mrr_usd, 'Not yet converted'],
      ['Paying subscribers', summary.revenue.paying_subscriber_count ?? '', ''],
      ['Exempt subscribers', summary.revenue.exempted_subscriber_count ?? '', '100%-off migration coupon']
    );
  }

  if (can(role, 'view:overage')) {
    rows.push(
      ['Live overage this cycle (USD)', rollup.totalOverageUsd, 'Accruing, not yet invoiced (§4.2)'],
      ['Accounts accruing overage', rollup.usersWithOverage, `of ${rollup.userCount} in scope`]
    );
  }

  if (can(role, 'view:invoices')) {
    const ar = summary.accounts_receivable;
    rows.push(
      ['Unpaid renewals & overages (USD)', ar.total_outstanding_usd, 'Invoiced and unpaid only (§4.2)'],
      ['Open invoices', ar.open_invoice_count, ''],
      ['Overdue (USD)', ar.overdue_usd, ''],
      ['Overdue invoices', ar.overdue_invoice_count, '']
    );
  }

  if (can(role, 'view:churn')) {
    rows.push(
      // Written as a percentage number rather than a fraction: this column
      // carries one shared format, and 0.0909 in a "Value" column next to a
      // dollar figure reads as an error.
      [
        'Churn rate (%)',
        (summary.churn.churn_rate <= 1 ? summary.churn.churn_rate * 100 : summary.churn.churn_rate),
        'Approximate — no subscription history table yet',
      ],
      ['Cancelled in period', summary.churn.canceled_in_period, ''],
      ['Active now', summary.churn.active_now, '']
    );
  }

  rows.push(['New activations in period', summary.growth?.total ?? 0, '']);

  return {
    name: 'Summary',
    columns: [
      { header: 'Metric', width: 34 },
      { header: 'Value', width: 18, format: 'decimal' },
      { header: 'Note', width: 52 },
    ],
    rows,
  };
}

function modulesSheet(input: WorkbookInput): Sheet {
  const { summary, rollup } = input;
  return {
    name: 'Modules',
    columns: [
      { header: 'Module', width: 20 },
      { header: 'Unit', width: 10 },
      { header: 'Total used', width: 15, format: 'decimal' },
      { header: 'Included allowance', width: 18, format: 'decimal' },
      { header: 'Active users', width: 13, format: 'integer' },
      { header: 'Avg per active user', width: 18, format: 'decimal' },
      { header: 'Accounts over allowance', width: 21, format: 'integer' },
      { header: 'Overage (USD)', width: 15, format: 'currency' },
      { header: 'Overage rate (USD)', width: 17, format: 'currency' },
      { header: 'Rate unit', width: 11 },
      { header: 'Data reliable', width: 13 },
    ],
    rows: MODULE_KEYS.map((module) => {
      const def = MODULES[module];
      const feature = summary.features[module];
      const line = rollup.modules.find((m) => m.module === module);
      return [
        def.label,
        displayUnitLabel(module),
        displayQuantity(module, feature.total_units),
        displayQuantity(module, line?.totalIncluded ?? 0),
        feature.active_users,
        displayQuantity(module, feature.avg_per_active_user),
        line?.usersOverLimit ?? 0,
        line?.totalOverageUsd ?? 0,
        def.overageRateUsd,
        `per ${def.rateUnit}`,
        line?.unreliable ? 'NO — under-reports (§5.1)' : 'yes',
      ];
    }),
  };
}

function usageTrendSheet(input: WorkbookInput): Sheet {
  return {
    name: 'Usage trend (daily)',
    columns: [
      { header: 'Day', width: 12 },
      ...MODULE_KEYS.map((module) => ({
        header: `${MODULES[module].label} (${displayUnitLabel(module)})`,
        width: 22,
        format: 'decimal' as const,
      })),
    ],
    rows: input.summary.daily_usage_trend.map((point) => [
      isoDay(point.day),
      ...MODULE_KEYS.map((module) => displayQuantity(module, point[module] ?? 0)),
    ]),
  };
}

/** Identified per-account rows — Management and Super Admin only (§2). */
function accountsSheet(input: WorkbookInput): Sheet {
  const { billings, role } = input;
  const showInvoices = can(role, 'view:invoices');

  const columns: Column[] = [
    { header: 'Account', width: 24 },
    { header: 'Email', width: 30 },
    { header: 'Organisation', width: 24 },
    { header: 'Tier', width: 12 },
    { header: 'Billing channel', width: 16 },
    { header: 'Status', width: 11 },
    { header: 'Exempt', width: 9 },
    { header: 'Tenure (months)', width: 15, format: 'decimal' as const },
    { header: 'Cycle start', width: 12 },
    { header: 'Cycle end', width: 12 },
    ...MODULE_KEYS.flatMap((module) => [
      { header: `${MODULES[module].label} used (${displayUnitLabel(module)})`, width: 24, format: 'decimal' as const },
      { header: `${MODULES[module].label} over (${displayUnitLabel(module)})`, width: 24, format: 'decimal' as const },
    ]),
    { header: 'Overage (USD)', width: 15, format: 'currency' as const },
    { header: 'Plan price (USD)', width: 16, format: 'currency' as const },
    { header: 'Projected invoice (USD)', width: 20, format: 'currency' as const },
    { header: 'Recommendation', width: 16 },
    { header: 'Recommended tier', width: 17 },
    { header: 'Monthly saving (USD)', width: 18, format: 'currency' as const },
  ];

  if (showInvoices) {
    columns.push(
      { header: 'Unpaid (USD)', width: 14, format: 'currency' as const },
      { header: 'Open invoices', width: 13, format: 'integer' as const }
    );
  }

  const rows = [...billings]
    .sort((a, b) => b.totalOverageUsd - a.totalOverageUsd)
    .map((billing) => {
      const { user, lines, recommendation } = billing;
      const line = (module: (typeof MODULE_KEYS)[number]) => lines.find((l) => l.module === module);
      const row: Array<string | number | null> = [
        user.display_name,
        user.email,
        user.org_name,
        TIERS[user.tier].label,
        user.billing_provider === 'stripe' ? 'Stripe direct' : 'GCP Marketplace',
        user.status,
        user.is_exempt ? 'yes' : 'no',
        billing.tenureMonths,
        isoDay(user.billing_cycle_start),
        isoDay(user.billing_cycle_end),
        ...MODULE_KEYS.flatMap((module) => [
          displayQuantity(module, line(module)?.used ?? 0),
          displayQuantity(module, line(module)?.overageUnits ?? 0),
        ]),
        billing.totalOverageUsd,
        billing.planPriceUsd,
        billing.projectedInvoiceUsd,
        recommendation.action,
        TIERS[recommendation.recommendedTier].label,
        recommendation.savingsUsd,
      ];
      if (showInvoices) row.push(user.unpaid_usd, user.open_invoice_count);
      return row;
    });

  return { name: 'Accounts', columns, rows };
}

/**
 * The Admin fallback. Admin sees org-wide usage but is explicitly denied
 * individual raw detail (§2), so the same figures are rolled to tier level with
 * no identity attached.
 */
function tierRollupSheet(input: WorkbookInput): Sheet {
  const { billings } = input;

  const rows = TIER_ORDER.map((tier: TierId) => {
    const inTier = billings.filter((billing) => billing.user.tier === tier);
    if (inTier.length === 0) return null;
    const overage = inTier.reduce((total, billing) => total + billing.totalOverageUsd, 0);
    return [
      TIERS[tier].label,
      inTier.length,
      inTier.filter((billing) => billing.totalOverageUsd > 0).length,
      overage,
      overage / inTier.length,
      ...MODULE_KEYS.map((module) =>
        displayQuantity(
          module,
          inTier.reduce((total, billing) => total + (billing.lines.find((l) => l.module === module)?.used ?? 0), 0)
        )
      ),
    ];
  }).filter((row): row is Array<string | number> => row !== null);

  return {
    name: 'Tier rollup',
    columns: [
      { header: 'Tier', width: 16 },
      { header: 'Accounts', width: 11, format: 'integer' },
      { header: 'Accounts over allowance', width: 21, format: 'integer' },
      { header: 'Overage (USD)', width: 15, format: 'currency' },
      { header: 'Overage per account (USD)', width: 23, format: 'currency' },
      ...MODULE_KEYS.map((module) => ({
        header: `${MODULES[module].label} (${displayUnitLabel(module)})`,
        width: 22,
        format: 'decimal' as const,
      })),
    ],
    rows,
  };
}

function channelsSheet(input: WorkbookInput): Sheet {
  const { summary } = input;
  const paying = summary.paying_billing_provider_breakdown ?? {};
  const payingTiers = summary.paying_tier_breakdown ?? {};

  const rows: Array<Array<string | number>> = [
    ...Object.entries(summary.billing_provider_breakdown ?? {}).map(([key, count]) => [
      'Billing channel',
      key === 'stripe' ? 'Stripe direct' : key === 'gcp_marketplace' ? 'Google Marketplace' : key.replace(/_/g, ' '),
      count,
      paying[key] ?? 0,
    ]),
    ...Object.entries(summary.tier_breakdown ?? {}).map(([key, count]) => [
      'Tier',
      TIERS[key as TierId]?.label ?? key,
      count,
      payingTiers[key] ?? 0,
    ]),
  ];

  return {
    name: 'Tiers & channels',
    columns: [
      { header: 'Breakdown', width: 16 },
      { header: 'Segment', width: 24 },
      { header: 'Subscriptions', width: 14, format: 'integer' },
      { header: 'Excluding exempt', width: 17, format: 'integer' },
    ],
    rows,
  };
}

function invoicesSheet(input: WorkbookInput): Sheet {
  return {
    name: 'Open invoices',
    columns: [
      { header: 'Invoice ID', width: 30 },
      { header: 'Customer ID', width: 30 },
      { header: 'Amount remaining (USD)', width: 21, format: 'currency' },
      { header: 'Created', width: 12 },
      { header: 'Overdue', width: 10 },
    ],
    rows: input.summary.accounts_receivable.top_open_invoices.map((invoice) => [
      invoice.invoice_id,
      invoice.customer_id,
      invoice.amount_remaining_usd,
      isoDay(invoice.created),
      invoice.overdue ? 'yes' : 'no',
    ]),
  };
}

function insightsSheet(input: WorkbookInput): Sheet {
  return {
    name: 'Insights',
    columns: [
      { header: 'Category', width: 14 },
      { header: 'Impact', width: 12 },
      { header: 'Headline', width: 46 },
      { header: 'Detail', width: 90 },
    ],
    rows: input.insights.map((insight) => [
      insight.category,
      insight.impact,
      insight.title,
      insight.description,
    ]),
  };
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export function buildWorkbookFilename(days: number, role: RoleId): string {
  const date = new Date().toISOString().slice(0, 10);
  return `platform-analytics_${days}d_${ROLES[role].shortLabel.toLowerCase().replace(/\s+/g, '-')}_${date}.xlsx`;
}

export function exportWorkbook(input: WorkbookInput): void {
  const { role } = input;
  const sheets: Sheet[] = [];
  const included: string[] = [];
  const withheld: string[] = [];
  const empty: string[] = [];

  const add = (sheet: Sheet | null, label: string, allowed: boolean, reason: string) => {
    if (!allowed) {
      withheld.push(`${label} (${reason})`);
      return;
    }
    if (!sheet || sheet.rows.length === 0) {
      empty.push(label);
      return;
    }
    sheets.push(sheet);
    included.push(label);
  };

  add(summarySheet(input), 'Summary', true, '');

  // Usage behaviour is withheld from Billing / Procurement by §2, and that
  // covers the module and trend detail as much as it covers the screens.
  const seesUsage = can(role, 'view:usage_behavior');
  add(modulesSheet(input), 'Modules', seesUsage, 'usage-behaviour analytics not in this role');
  add(usageTrendSheet(input), 'Usage trend', seesUsage, 'usage-behaviour analytics not in this role');

  if (can(role, 'view:user_detail')) {
    add(accountsSheet(input), 'Accounts', true, '');
  } else if (can(role, 'view:org_rollup')) {
    add(tierRollupSheet(input), 'Tier rollup', true, '');
    withheld.push('Accounts (individual raw detail withheld from this role)');
  } else {
    withheld.push('Accounts (individual raw detail withheld from this role)');
  }

  add(channelsSheet(input), 'Tiers & channels', can(role, 'view:billing_channels'), 'billing channels not in this role');
  add(invoicesSheet(input), 'Open invoices', can(role, 'view:invoices'), 'invoices not in this role');
  add(insightsSheet(input), 'Insights', true, '');

  // The scope sheet is written last so it can name what landed, but sits first
  // in the workbook — a reader should meet the caveats before the figures.
  sheets.unshift(scopeSheet(input, included, withheld, empty));

  downloadBlob(buildWorkbook(sheets), buildWorkbookFilename(input.days, role));
}
