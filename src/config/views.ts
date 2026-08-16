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
  requirement?: string;
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
    requirement: '§4.1',
    group: 'Usage',
    requiresAll: ['view:own_usage'],
  },
  {
    id: 'users',
    label: 'Per-User Usage',
    description: 'Every user’s consumption, drill-down capable',
    requirement: '§4.1',
    group: 'Usage',
    requiresAll: ['view:user_detail'],
  },
  {
    id: 'rollup',
    label: 'Org Rollup',
    description: 'Aggregated usage across all users — no individual detail',
    requirement: '§2',
    group: 'Usage',
    requiresAll: ['view:org_rollup'],
  },
  {
    id: 'modules',
    label: 'Module Usage',
    description: 'KYC, Simulator, Proposal Hub and meeting minutes vs allowance',
    requirement: '§4.6',
    group: 'Usage',
    requiresAll: ['view:usage_behavior'],
  },
  {
    id: 'overage',
    label: 'Overage Tracking',
    description: 'Live accrual per user per module this billing cycle',
    requirement: '§4.2',
    group: 'Money',
    requiresAll: ['view:overage'],
    requiresAny: ['view:org_rollup', 'view:invoices'],
  },
  {
    id: 'plans',
    label: 'Plans & Tiers',
    description: 'Tier mix, tenure on tier and upgrade recommendations',
    requirement: '§4.3',
    group: 'Money',
    requiresAll: ['view:plan_recommendations'],
    requiresAny: ['view:org_rollup', 'view:invoices'],
  },
  {
    id: 'billing',
    label: 'Billing Management',
    description: 'Billing channels, invoices, unpaid renewals and growth',
    requirement: '§4.4',
    group: 'Money',
    requiresAny: ['view:invoices', 'view:billing_channels'],
  },
  {
    id: 'access',
    label: 'Access Model',
    description: 'The four layers and the RBAC permission matrix',
    requirement: '§2',
    group: 'Programme',
  },
  {
    id: 'delivery',
    label: 'Delivery & Gaps',
    description: 'Known issues, endpoint contracts, open questions, action items',
    requirement: '§5–§9',
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
