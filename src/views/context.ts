/**
 * Everything a view needs, assembled once in App.tsx.
 * Views are pure functions of this context — no view fetches its own data.
 */

import { PeriodDays, UsageSummaryResponse } from '../types/analytics';
import { Granularity, UserBilling, UserUsageResponse } from '../types/platform';
import { OrgRollup } from '../utils/billing';
import { RoleId } from '../config/roles';
import { ViewId } from '../config/views';

export interface ViewContext {
  summary: UsageSummaryResponse;
  userLayer: UserUsageResponse;
  /** One entry per user, already priced against their tier. */
  billings: UserBilling[];
  rollup: OrgRollup;
  role: RoleId;
  days: PeriodDays;
  granularity: Granularity;
  onGranularityChange: (granularity: Granularity) => void;
  /** The "signed-in" account for the User layer. */
  currentUser: UserBilling | null;
  onCurrentUserChange: (userId: string) => void;
  /** Drill-down target for Management (§2). */
  selectedUserId: string | null;
  onSelectUser: (userId: string | null) => void;
  onNavigate: (view: ViewId) => void;
}
