import React from 'react';
import { ArrowDownRight, ArrowUpRight, Check, Crown, AlertTriangle } from 'lucide-react';
import { TIERS, TierId } from '../config/pricing';
import { Granularity, PlanRecommendation } from '../types/platform';
import { GRANULARITIES } from '../utils/timeBuckets';
import { Badge, Segmented } from './ui';
import { formatCurrency } from '../utils/formatters';
import { usePalette } from '../theme';

export const TierBadge: React.FC<{ tier: TierId; className?: string }> = ({ tier, className }) => {
  const palette = usePalette();
  const color = palette.tier(tier);
  const def = TIERS[tier];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border whitespace-nowrap ${className ?? ''}`}
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
      }}
      title={def.note}
    >
      {tier === 'enterprise' && <Crown className="w-3 h-3" />}
      {def.label}
      {def.priceUsd != null && <span className="text-muted font-semibold">${def.priceUsd}</span>}
    </span>
  );
};

export const RecommendationBadge: React.FC<{ recommendation: PlanRecommendation }> = ({ recommendation }) => {
  if (recommendation.action === 'stay') {
    const currentPrice = TIERS[recommendation.currentTier].priceUsd ?? 0;
    const overage = recommendation.currentMonthlyUsd - currentPrice;
    // "Right plan" with a big overage bill reads like a bug. It isn't — no higher tier
    // is cheaper at this usage, which is a statement about the rate card (see §8
    // break-even on Plans & Tiers), so say that instead.
    if (overage > 0) {
      return (
        <Badge tone="neutral" icon={<Check className="w-3 h-3" />} title={recommendation.rationale}>
          No cheaper tier
        </Badge>
      );
    }
    return (
      <Badge tone="success" icon={<Check className="w-3 h-3" />} title={recommendation.rationale}>
        Right plan
      </Badge>
    );
  }
  if (recommendation.action === 'review_enterprise') {
    return (
      <Badge tone="violet" icon={<Crown className="w-3 h-3" />} title={recommendation.rationale}>
        Enterprise review
      </Badge>
    );
  }
  return (
    <Badge
      tone={recommendation.action === 'upgrade' ? 'warning' : 'info'}
      icon={
        recommendation.action === 'upgrade' ? (
          <ArrowUpRight className="w-3 h-3" />
        ) : (
          <ArrowDownRight className="w-3 h-3" />
        )
      }
      title={recommendation.rationale}
    >
      {recommendation.action === 'upgrade' ? 'Upgrade to' : 'Downgrade to'}{' '}
      {TIERS[recommendation.recommendedTier].label} · saves {formatCurrency(recommendation.savingsUsd)}
    </Badge>
  );
};

export const UnverifiedBadge: React.FC<{ label?: string }> = ({ label = 'unverified' }) => (
  <Badge
    tone="warning"
    icon={<AlertTriangle className="w-3 h-3" />}
    title="KYC overage tracking is blocked by a backend/KYC-initiation dependency (§5.1). This number under-reports."
  >
    {label}
  </Badge>
);

export const GranularityToggle: React.FC<{
  value: Granularity;
  onChange: (next: Granularity) => void;
  size?: 'sm' | 'md';
}> = ({ value, onChange, size = 'sm' }) => (
  <Segmented
    ariaLabel="Time granularity"
    size={size}
    value={value}
    onChange={onChange}
    options={GRANULARITIES.map((g) => ({ id: g.id, label: g.label }))}
  />
);
