import { UsageSummaryResponse, BannerHealthStatus, InsightItem } from '../types/analytics';
import { formatCurrency, formatPercent, formatMeetingTime, formatFeatureName } from './formatters';

export interface BannerSummary {
  status: BannerHealthStatus;
  headline: string;
  pills: Array<{ label: string; type: 'success' | 'warning' | 'error' | 'neutral' }>;
}

export function computeBannerSummary(data: UsageSummaryResponse): BannerSummary {
  const overdueCount = data.accounts_receivable.overdue_invoice_count;
  const overdueUsd = data.accounts_receivable.overdue_usd;
  const churnRate = data.churn.churn_rate;
  const nearLimitCount = data.near_limit_users.length;
  const growthTotal = data.growth.total;

  let status: BannerHealthStatus = 'healthy';
  let headline = 'Platform Performance Healthy';

  if (overdueCount >= 3 || churnRate > 0.15) {
    status = 'critical';
    headline = 'Attention Required — Billing & Churn Alerts';
  } else if (overdueCount > 0 || nearLimitCount >= 3 || churnRate > 0.08) {
    status = 'warning';
    headline = 'Stable Performance — Minor Action Items';
  }

  const pills: Array<{ label: string; type: 'success' | 'warning' | 'error' | 'neutral' }> = [];

  // Revenue / Growth Pill
  if (growthTotal > 0) {
    pills.push({ label: `↑ ${growthTotal} new sub${growthTotal > 1 ? 's' : ''}`, type: 'success' });
  } else {
    pills.push({ label: '↔ Growth steady', type: 'neutral' });
  }

  // Overdue Invoices Pill
  if (overdueCount > 0) {
    pills.push({
      label: `⚠ ${overdueCount} Overdue Invoice (${formatCurrency(overdueUsd)})`,
      type: overdueCount >= 3 ? 'error' : 'warning',
    });
  } else {
    pills.push({ label: '✓ Invoices current', type: 'success' });
  }

  // Near Limits Pill
  if (nearLimitCount > 0) {
    pills.push({
      label: `⚡ ${nearLimitCount} Account${nearLimitCount > 1 ? 's' : ''} near plan limit`,
      type: 'warning',
    });
  } else {
    pills.push({ label: '✓ Plan limits healthy', type: 'success' });
  }

  // Churn Pill
  const churnPct = formatPercent(churnRate);
  if (churnRate > 0.1) {
    pills.push({ label: `⚠ ${churnPct} Churn`, type: 'warning' });
  } else {
    pills.push({ label: `✓ ${churnPct} Churn`, type: 'success' });
  }

  return { status, headline, pills };
}

export function generateInsights(data: UsageSummaryResponse): InsightItem[] {
  const insights: InsightItem[] = [];

  // 1. Most Used Feature
  const featureEntries = Object.entries(data.features);
  if (featureEntries.length > 0) {
    let topFeatureKey = 'meeting_time';
    let topActive = 0;
    featureEntries.forEach(([key, f]) => {
      if (f.active_users > topActive) {
        topActive = f.active_users;
        topFeatureKey = key;
      }
    });

    const topFeatureName = formatFeatureName(topFeatureKey);
    const topMetric = data.features[topFeatureKey as keyof typeof data.features];
    const unitText =
      topFeatureKey === 'meeting_time'
        ? formatMeetingTime(topMetric.total_units)
        : `${topMetric.total_units.toLocaleString()} units`;

    insights.push({
      id: 'top-feature',
      category: 'Usage',
      title: `${topFeatureName} is the most active feature`,
      description: `${topActive} active users consumed ${unitText} during the selected ${data.period_days}-day period.`,
      impact: 'positive',
    });
  }

  // 2. Pro Tier MRR Share
  const totalMrr = data.revenue.mrr_usd || 1;
  const proMrr = data.revenue.mrr_by_tier_usd?.pro || 0;
  const proPct = Math.round((proMrr / totalMrr) * 100);
  insights.push({
    id: 'mrr-tier',
    category: 'Revenue',
    title: `Pro tier drives ${proPct}% of recurring revenue`,
    description: `Pro plans account for ${formatCurrency(proMrr)} out of ${formatCurrency(totalMrr)} total MRR.`,
    impact: 'positive',
  });

  // 3. Billing Provider Breakdown
  const totalSubs = (data.tier_breakdown.starter || 0) + (data.tier_breakdown.pro || 0);
  const gcpSubs = data.billing_provider_breakdown.gcp_marketplace || 0;
  const gcpPct = totalSubs > 0 ? Math.round((gcpSubs / totalSubs) * 100) : 0;
  insights.push({
    id: 'provider-split',
    category: 'Billing',
    title: `GCP Marketplace accounts for ${gcpPct}% of active subscriptions`,
    description: `${gcpSubs} subscription${gcpSubs !== 1 ? 's' : ''} billed via Google Marketplace; ${data.billing_provider_breakdown.stripe || 0} via direct Stripe.`,
    impact: 'neutral',
  });

  // 4. Overdue Invoices
  if (data.accounts_receivable.overdue_invoice_count > 0) {
    insights.push({
      id: 'ar-overdue',
      category: 'Billing',
      title: `${data.accounts_receivable.overdue_invoice_count} Stripe invoice overdue for collection`,
      description: `${formatCurrency(data.accounts_receivable.overdue_usd)} outstanding past due across open invoices.`,
      impact: 'attention',
    });
  } else {
    insights.push({
      id: 'ar-healthy',
      category: 'Billing',
      title: 'Accounts receivable fully current',
      description: 'Zero overdue invoices detected across all open accounts.',
      impact: 'positive',
    });
  }

  // 5. Subscription Growth
  insights.push({
    id: 'growth-signups',
    category: 'Growth',
    title: `${data.growth.total} new subscriptions activated`,
    description: `Signup velocity across the ${data.period_days}-day period with consistent account onboarding.`,
    impact: data.growth.total > 0 ? 'positive' : 'neutral',
  });

  // 6. Near Plan Limits Upsell Pipeline
  const nearLimitCount = data.near_limit_users.length;
  if (nearLimitCount > 0) {
    insights.push({
      id: 'upsell-limits',
      category: 'Usage',
      title: `${nearLimitCount} customer accounts near plan capacity`,
      description: `Target for plan upgrades before hitting strict usage caps.`,
      impact: 'attention',
    });
  }

  // 7. Trialing Pipeline MRR
  if (data.revenue.trialing_pipeline_mrr_usd > 0) {
    insights.push({
      id: 'trial-pipeline',
      category: 'Revenue',
      title: `${formatCurrency(data.revenue.trialing_pipeline_mrr_usd)} in trialing pipeline MRR`,
      description: `Potential ARR expansion as active trials transition to paid subscriptions.`,
      impact: 'positive',
    });
  }

  return insights;
}
