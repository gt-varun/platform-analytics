/**
 * Navigation model. Each view declares the permissions it needs; the sidebar and
 * the router both filter through `visibleViews()`, so a role can never reach a
 * view it isn't entitled to (§2).
 */

import { Permission, RoleId, canAll, canAny } from './roles';

export type ViewId =
  | 'overview'
  | 'my-usage'
  | 'users'
  | 'rollup'
  | 'overage'
  | 'plans'
  | 'modules'
  | 'billing'
  | 'access'
  | 'delivery';

export interface ViewDefinition {
  id: ViewId;
  label: string;
  description: string;
  group: 'Usage' | 'Money' | 'Programme';
  requiresAll?: Permission[];
  requiresAny?: Permission[];
}

export const VIEWS: ViewDefinition[] = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'Executive summary across usage, revenue and billing health',
    group: 'Usage',
    // Revenue + churn live on this page, so org rollup alone is not enough — the
    // Admin layer gets Org Rollup instead (§2).
    requiresAll: ['view:org_rollup', 'view:revenue'],
  },
  {
    id: 'my-usage',
    label: 'My Usage',
    description: 'Your own consumption, overages and plan fit',
    group: 'Usage',
    requiresAll: ['view:own_usage'],
  },
  {
    id: 'users',
    label: 'Per-User Usage',
    description: 'Every user’s consumption, drill-down capable',
    group: 'Usage',
    requiresAll: ['view:user_detail'],
  },
  {
    id: 'rollup',
    label: 'Org Rollup',
    description: 'Aggregated usage across all users — no individual detail',
    group: 'Usage',
    requiresAll: ['view:org_rollup'],
  },
  {
    id: 'modules',
    label: 'Module Usage',
    description: 'KYC, Simulator, Proposal Hub and meeting minutes vs allowance',
    group: 'Usage',
    requiresAll: ['view:usage_behavior'],
  },
  {
    id: 'overage',
    label: 'Overage Tracking',
    description: 'Live accrual per user per module this billing cycle',
    group: 'Money',
    requiresAll: ['view:overage'],
    requiresAny: ['view:org_rollup', 'view:invoices'],
  },
  {
    id: 'plans',
    label: 'Plans & Tiers',
    description: 'Tier mix, tenure on tier and upgrade recommendations',
    group: 'Money',
    requiresAll: ['view:plan_recommendations'],
    requiresAny: ['view:org_rollup', 'view:invoices'],
  },
  {
    id: 'billing',
    label: 'Billing Management',
    description: 'Billing channels, invoices, unpaid renewals and growth',
    group: 'Money',
    requiresAny: ['view:invoices', 'view:billing_channels'],
  },
  {
    id: 'access',
    label: 'Access Model',
    description: 'The four layers and the RBAC permission matrix',
    group: 'Programme',
  },
  {
    id: 'delivery',
    label: 'Delivery & Gaps',
    description: 'Known issues, endpoint contracts, open questions, action items',
    group: 'Programme',
  },
];

export function isViewAllowed(view: ViewDefinition, role: RoleId): boolean {
  if (view.requiresAll && !canAll(role, view.requiresAll)) return false;
  if (view.requiresAny && !canAny(role, view.requiresAny)) return false;
  return true;
}

export function visibleViews(role: RoleId): ViewDefinition[] {
  return VIEWS.filter((view) => isViewAllowed(view, role));
}

export function defaultViewFor(role: RoleId): ViewId {
  const preferred: Record<RoleId, ViewId> = {
    user: 'my-usage',
    admin: 'rollup',
    billing: 'billing',
    management: 'overview',
    super_admin: 'overview',
  };
  const views = visibleViews(role);
  const wanted = preferred[role];
  return views.some((v) => v.id === wanted) ? wanted : views[0]?.id ?? 'delivery';
}
