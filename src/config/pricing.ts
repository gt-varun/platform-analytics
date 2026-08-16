/**
 * Pricing & packaging configuration — Requirements §3.
 *
 * Everything downstream (overage accrual, plan recommendations, credit display)
 * is computed from raw usage in *source units* (seconds / counts) plus this file.
 * That is the "pricing-model-agnostic" requirement: if the credit model changes,
 * only this file changes — no view, table or chart has to be rebuilt.
 *
 * Values marked ASSUMPTION are not confirmed by leadership yet (§8 open questions)
 * and are surfaced in the UI via the Assumptions panel so reviewers can challenge them.
 */

export type TierId = 'starter' | 'pro' | 'enterprise';
export type ModuleKey = 'meeting_time' | 'kyc_count' | 'simulator' | 'proposal';

export const MODULE_KEYS: ModuleKey[] = ['meeting_time', 'kyc_count', 'simulator', 'proposal'];

export interface ModuleDefinition {
  key: ModuleKey;
  label: string;
  shortLabel: string;
  /** Unit the backend reports in. meeting_time arrives as seconds; the rest are counts. */
  sourceUnit: 'seconds' | 'count';
  /** Unit that overage is priced in. */
  rateUnit: 'hour' | 'unit';
  /** How many source units make up one rate unit (3600s = 1 hour). */
  sourceUnitsPerRateUnit: number;
  /** USD billed per rate unit once the included allowance is exhausted. */
  overageRateUsd: number;
  /** Rough wall-clock minutes one unit represents (§3) — powers the time-equivalent view. */
  minutesPerUnit: number | null;
  /** Categorical series colour on the light surface. */
  color: string;
  /** The same series on the dark surface — re-picked, not lightened. */
  colorDark: string;
  helpText: string;
}

export const MODULES: Record<ModuleKey, ModuleDefinition> = {
  meeting_time: {
    key: 'meeting_time',
    label: 'Meeting Minutes',
    shortLabel: 'Meetings',
    sourceUnit: 'seconds',
    rateUnit: 'hour',
    sourceUnitsPerRateUnit: 3600,
    overageRateUsd: 1, // 9 hours ≈ $9 (§3) → $1/hour
    minutesPerUnit: null,
    color: '#3454d1',
    colorDark: '#84a9ff',
    helpText: 'Transcribed / recorded meeting time. Billed per hour beyond the plan allowance.',
  },
  kyc_count: {
    key: 'kyc_count',
    label: 'KYC Checks',
    shortLabel: 'KYC',
    sourceUnit: 'count',
    rateUnit: 'unit',
    sourceUnitsPerRateUnit: 1,
    overageRateUsd: 1,
    minutesPerUnit: 10,
    color: '#178a5b',
    colorDark: '#31a883',
    helpText: 'Identity / diligence checks. ~10 min of analyst time each (§3, rough).',
  },
  simulator: {
    key: 'simulator',
    label: 'Simulations',
    shortLabel: 'Simulator',
    sourceUnit: 'count',
    rateUnit: 'unit',
    sourceUnitsPerRateUnit: 1,
    overageRateUsd: 1,
    minutesPerUnit: 30,
    color: '#b25e09',
    colorDark: '#f7c77e',
    helpText: 'Simulator sessions. ~30 min/session (§3, rough).',
  },
  proposal: {
    key: 'proposal',
    label: 'Proposals',
    shortLabel: 'Proposal Hub',
    sourceUnit: 'count',
    rateUnit: 'unit',
    sourceUnitsPerRateUnit: 1,
    overageRateUsd: 0.12, // recently adjusted from ~$1 (§3)
    minutesPerUnit: 10,
    color: '#a93b7b',
    colorDark: '#e58ab8',
    helpText: 'Proposal Hub generations. Repriced to ~$0.12/proposal (§3).',
  },
};

export interface TierDefinition {
  id: TierId;
  label: string;
  /** Monthly list price. null = negotiated per contract (Enterprise). */
  priceUsd: number | null;
  /** Included allowance expressed as USD of value per module. null = negotiated / uncapped. */
  includedValueUsd: Record<ModuleKey, number> | null;
  /** Proposed cap on how long an account may stay on this tier (§3 — not finalized). */
  tenureCapMonths: number | null;
  tenureCapEnforced: boolean;
  upgradeTo: TierId | null;
  color: string;
  colorDark: string;
  note?: string;
}

/**
 * Starter maths straight from §3: 9h meetings ($9) + $3 each for Simulations, KYC
 * and Proposal Hub = $18 of included value at a $20 price point.
 *
 * §3 fixes the Pro price at $55 but never states the bundle. It is *derived* here
 * from the worked example in §1: "you're spending $60 in overages — the $55 plan
 * saves you $5". A Starter with $60 of overage consumed $18 + $60 = $78 of value;
 * for Pro to total $75 (a $5 saving on Starter's $80) its overage must be $20, so
 * Pro must include $58 of value. Split in Starter's proportions → 29h + $10 + $10 + $9.
 *
 * This matters more than it looks: if Pro's included value were below ~$53, the
 * price step ($35) would exceed the extra allowance and upgrading could never save
 * anyone money — the recommendation engine would only ever say "stay". Confirm the
 * real bundle (§8) before this reaches customers.
 */
export const TIERS: Record<TierId, TierDefinition> = {
  starter: {
    id: 'starter',
    label: 'Starter',
    priceUsd: 20,
    includedValueUsd: { meeting_time: 9, kyc_count: 3, simulator: 3, proposal: 3 },
    tenureCapMonths: 3,
    tenureCapEnforced: false,
    upgradeTo: 'pro',
    color: '#3454d1',
    colorDark: '#84a9ff',
    note: '$18 of included value at $20 (§3). 3-month cap proposed but NOT enforced.',
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    priceUsd: 55,
    includedValueUsd: { meeting_time: 29, kyc_count: 10, simulator: 10, proposal: 9 },
    tenureCapMonths: null,
    tenureCapEnforced: false,
    upgradeTo: 'enterprise',
    color: '#178a5b',
    colorDark: '#31a883',
    note: 'DERIVED: $58 included value, back-solved from the "$60 overage → $55 plan saves $5" example in §1. Awaiting confirmation (§8).',
  },
  enterprise: {
    id: 'enterprise',
    label: 'Enterprise',
    priceUsd: null,
    includedValueUsd: null,
    tenureCapMonths: null,
    tenureCapEnforced: false,
    upgradeTo: null,
    color: '#6d45b8',
    colorDark: '#b39af0',
    note: 'Negotiated contract (already sold to Google). Allowances are per-contract; ' +
      'per-module Enterprise breakdown is deferred to v2 (§4.3).',
  },
};

export const TIER_ORDER: TierId[] = ['starter', 'pro', 'enterprise'];

/** §3: 1 credit ≈ $1. Isolated here so a credit repricing is a one-line change. */
export const CREDIT_USD = 1;

export function usdToCredits(usd: number): number {
  return usd / CREDIT_USD;
}

/** Included allowance for a module, expressed in the module's *source* units. */
export function includedSourceUnits(tier: TierId, module: ModuleKey): number | null {
  const included = TIERS[tier].includedValueUsd;
  if (!included) return null; // Enterprise — negotiated
  const def = MODULES[module];
  const rateUnits = included[module] / def.overageRateUsd;
  return rateUnits * def.sourceUnitsPerRateUnit;
}

/** USD price of `sourceUnits` of overage for a module. */
export function overageCostUsd(module: ModuleKey, sourceUnits: number): number {
  const def = MODULES[module];
  if (sourceUnits <= 0) return 0;
  return (sourceUnits / def.sourceUnitsPerRateUnit) * def.overageRateUsd;
}

/** Wall-clock minutes a quantity of a module represents (§3 per-unit time estimates). */
export function timeEquivalentMinutes(module: ModuleKey, sourceUnits: number): number | null {
  const def = MODULES[module];
  if (def.sourceUnit === 'seconds') return sourceUnits / 60;
  if (def.minutesPerUnit == null) return null;
  return sourceUnits * def.minutesPerUnit;
}

export function tierPriceUsd(tier: TierId): number | null {
  return TIERS[tier].priceUsd;
}

/** Assumptions surfaced in the UI so reviewers can challenge them (§8). */
export interface PricingAssumption {
  id: string;
  label: string;
  value: string;
  status: 'confirmed' | 'proposed' | 'estimate';
  source: string;
}

export const PRICING_ASSUMPTIONS: PricingAssumption[] = [
  { id: 'credit', label: 'Credit unit', value: '1 credit = $1', status: 'proposed', source: '§3 baseline, subject to change' },
  { id: 'starter', label: 'Starter bundle', value: '$20 → 9h meetings + $3 × KYC / Simulator / Proposal = $18 value', status: 'confirmed', source: '§3' },
  { id: 'pro', label: 'Pro bundle', value: '$55 → $58 of included value (29h + $10 + $10 + $9)', status: 'proposed', source: 'DERIVED from the "$60 overage saves $5 on Pro" example in §1 — not stated in §3' },
  { id: 'enterprise', label: 'Enterprise', value: 'Negotiated; per-module breakdown deferred to v2', status: 'proposed', source: '§4.3' },
  { id: 'rate-kyc', label: 'KYC overage', value: '$1.00 per check', status: 'estimate', source: '§3 — pending pricing worksheet' },
  { id: 'rate-sim', label: 'Simulation overage', value: '$1.00 per session', status: 'estimate', source: '§3 — pending pricing worksheet' },
  { id: 'rate-proposal', label: 'Proposal overage', value: '$0.12 per proposal', status: 'estimate', source: '§3 — recently adjusted' },
  { id: 'rate-meeting', label: 'Meeting overage', value: '$1.00 per hour', status: 'estimate', source: 'Derived from 9h ≈ $9 (§3)' },
  { id: 'time-sim', label: 'Time per simulation', value: '~30 min', status: 'estimate', source: '§3 rough' },
  { id: 'time-kyc', label: 'Time per KYC / proposal', value: '~10 min each', status: 'estimate', source: '§3 rough' },
  { id: 'tenure', label: 'Starter tenure cap', value: '3 months, then migrate to Pro', status: 'proposed', source: '§3 — tracked, NOT enforced' },
];
