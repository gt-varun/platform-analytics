/**
 * Role-based access control — Requirements §2.
 *
 * Four layers (plus Super Admin) modelled explicitly as role → permission sets.
 * Views and data-shaping both read from `can()`, so there is exactly one place
 * that decides who sees what.
 *
 * NOTE ON ENFORCEMENT: this build has no auth backend, so the active role comes
 * from the "Viewing as" switcher (prototype affordance for the stakeholder
 * review). In production `resolveRole()` should read the role claim off the
 * session/JWT instead — everything below is unchanged by that swap. Client-side
 * gating is a UX contract, not a security boundary: the per-user endpoints must
 * enforce the same matrix server-side.
 */

export type RoleId = 'user' | 'admin' | 'billing' | 'management' | 'super_admin';

export type Permission =
  | 'view:own_usage'
  /** Aggregated/rolled-up usage across the org — no individual rows. */
  | 'view:org_rollup'
  /** Raw per-user detail, identified. The line §2 draws between Admin and Management. */
  | 'view:user_detail'
  | 'view:overage'
  | 'view:invoices'
  | 'view:billing_channels'
  | 'view:revenue'
  | 'view:churn'
  /** Behavioural usage analytics — explicitly withheld from Billing/Procurement (§2). */
  | 'view:usage_behavior'
  | 'view:plan_recommendations'
  | 'manage:roles'
  | 'export:report';

export interface RoleDefinition {
  id: RoleId;
  label: string;
  shortLabel: string;
  description: string;
  /** What §2 says this layer sees. Rendered in the role switcher. */
  scopeNote: string;
  permissions: Permission[];
  color: string;
  colorDark: string;
}

export const ROLES: Record<RoleId, RoleDefinition> = {
  user: {
    id: 'user',
    label: 'User',
    shortLabel: 'User',
    description: 'Individual end user',
    scopeNote: 'Own usage only — meeting minutes, KYC, simulations, proposals, overages. Never another user’s data.',
    permissions: ['view:own_usage', 'view:overage', 'view:plan_recommendations'],
    color: '#3454d1',
    colorDark: '#84a9ff',
  },
  admin: {
    id: 'admin',
    label: 'Super User / Admin',
    shortLabel: 'Admin',
    description: 'Org administrator (e.g. Avi)',
    scopeNote: 'Summarised usage across all users in their org. Cannot open an individual user’s raw detail — rollups only.',
    permissions: [
      'view:org_rollup',
      'view:overage',
      'view:usage_behavior',
      'view:plan_recommendations',
      'export:report',
    ],
    color: '#178a5b',
    colorDark: '#31a883',
  },
  billing: {
    id: 'billing',
    label: 'Billing / Procurement',
    shortLabel: 'Billing',
    description: 'Approvals gatekeeper',
    scopeNote: 'Invoices, billing-channel breakdowns and billing-cycle views. No usage-behaviour detail.',
    permissions: ['view:invoices', 'view:billing_channels', 'view:overage', 'view:revenue', 'export:report'],
    color: '#b25e09',
    colorDark: '#f7c77e',
  },
  management: {
    id: 'management',
    label: 'Management',
    shortLabel: 'Management',
    description: 'Leadership / exec view',
    scopeNote: 'Full visibility — usage trends, adoption, churn & renewal reasons, drill-down to the individual user.',
    permissions: [
      'view:org_rollup',
      'view:user_detail',
      'view:overage',
      'view:invoices',
      'view:billing_channels',
      'view:revenue',
      'view:churn',
      'view:usage_behavior',
      'view:plan_recommendations',
      'export:report',
    ],
    color: '#6d45b8',
    colorDark: '#b39af0',
  },
  super_admin: {
    id: 'super_admin',
    label: 'Super Admin',
    shortLabel: 'Super Admin',
    description: 'Platform owner',
    scopeNote: 'Manages Admins, Billing and Users. Full read access across every layer.',
    permissions: [
      'view:own_usage',
      'view:org_rollup',
      'view:user_detail',
      'view:overage',
      'view:invoices',
      'view:billing_channels',
      'view:revenue',
      'view:churn',
      'view:usage_behavior',
      'view:plan_recommendations',
      'manage:roles',
      'export:report',
    ],
    color: '#a93b7b',
    colorDark: '#e58ab8',
  },
};

export const ROLE_ORDER: RoleId[] = ['user', 'admin', 'billing', 'management', 'super_admin'];

export function can(role: RoleId, permission: Permission): boolean {
  return ROLES[role].permissions.includes(permission);
}

export function canAll(role: RoleId, permissions: Permission[]): boolean {
  return permissions.every((p) => can(role, p));
}

export function canAny(role: RoleId, permissions: Permission[]): boolean {
  return permissions.some((p) => can(role, p));
}

/** The permissions matrix from §2, rendered as-is in the Access Model panel. */
export const PERMISSION_MATRIX: Array<{ permission: Permission; label: string; note?: string }> = [
  { permission: 'view:own_usage', label: 'Own usage detail' },
  { permission: 'view:org_rollup', label: 'Org-wide aggregated usage' },
  { permission: 'view:user_detail', label: 'Individual user raw detail', note: 'Withheld from Admin by design (§2)' },
  { permission: 'view:overage', label: 'Live overage accrual' },
  { permission: 'view:invoices', label: 'Invoices & receivables' },
  { permission: 'view:billing_channels', label: 'Billing channel breakdown' },
  { permission: 'view:revenue', label: 'Revenue (MRR / ARR)' },
  { permission: 'view:churn', label: 'Churn & renewal reasons' },
  { permission: 'view:usage_behavior', label: 'Usage-behaviour analytics', note: 'Withheld from Billing (§2)' },
  { permission: 'view:plan_recommendations', label: 'Plan recommendations' },
  { permission: 'manage:roles', label: 'Manage roles' },
  { permission: 'export:report', label: 'Export report' },
];
