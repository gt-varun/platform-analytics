import React from 'react';
import { NearLimitUser } from '../types/analytics';
import { formatFeatureName } from '../utils/formatters';
import { Zap, CheckCircle2 } from 'lucide-react';
import { Pagination, usePagination } from './ui';

interface NearLimitUsersTableProps {
  users: NearLimitUser[];
}

export const NearLimitUsersTable: React.FC<NearLimitUsersTableProps> = ({ users }) => {
  const hasUsers = users && users.length > 0;
  const pager = usePagination(users ?? [], 8);

  return (
    <div className="bg-surface rounded-2xl border border-line p-5 flex flex-col justify-between h-full">
      <div>
        {/* Table Header */}
        <div className="pb-4 border-b border-line mb-4">
          <h3 className="text-base font-bold text-ink flex items-center">
            <Zap className="w-4 h-4 mr-2 text-caution" />
            Near Plan Limits
          </h3>
          <p className="text-xs text-muted mt-0.5">Top customer accounts at 80%+ limit capacity (upsell targets)</p>
        </div>

        {/* Table */}
        {!hasUsers ? (
          <div className="py-12 text-center flex flex-col items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-positive mb-2" />
            <p className="text-sm font-semibold text-ink">No users near plan limits</p>
            <p className="text-xs text-muted mt-1">🎉 All user accounts have comfortable feature headroom.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="text-muted font-semibold border-b border-line text-[11px] uppercase">
                  <th className="pb-3 pr-3">User ID</th>
                  <th className="pb-3 px-3">Tier</th>
                  <th className="pb-3 px-3">Feature</th>
                  <th className="pb-3 px-3">Used / Limit</th>
                  <th className="pb-3 pl-3 text-right">Capacity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pager.pageItems.map((item) => {
                  const pct = Math.min(Math.round(item.percent_used * 100), 100);

                  // Color coding rules: <90% Yellow, 90-99% Orange, 100% Red
                  let barColor = 'bg-caution';
                  let textColor = 'text-caution';

                  if (pct >= 100) {
                    barColor = 'bg-critical';
                    textColor = 'text-critical';
                  } else if (pct >= 90) {
                    barColor = 'bg-caution';
                    textColor = 'text-caution';
                  }

                  return (
                    <tr key={`${item.user_id}-${item.feature}`} className="hover:bg-sunken transition-colors">
                      <td className="py-3 pr-3 font-mono font-medium text-ink-2 truncate max-w-[120px]">
                        {item.user_id}
                      </td>
                      <td className="py-3 px-3">
                        <span className="capitalize px-2 py-0.5 rounded-md text-[10px] font-bold bg-sunken text-ink-2 border border-line">
                          {item.tier}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-ink-2 font-medium">
                        {formatFeatureName(item.feature)}
                      </td>
                      <td className="py-3 px-3 text-muted font-mono">
                        {item.used.toLocaleString()} / {item.limit.toLocaleString()}
                      </td>
                      <td className="py-3 pl-3 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <div className="w-20 bg-canvas rounded-full h-2 overflow-hidden border border-line">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className={`font-bold font-mono text-[11px] min-w-[36px] ${textColor}`}>
                            {pct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Pagination state={pager} noun="accounts near a limit" />
      </div>
    </div>
  );
};
