import React from 'react';
import { NearLimitUser } from '../types/analytics';
import { formatFeatureName } from '../utils/formatters';
import { Zap, CheckCircle2 } from 'lucide-react';

interface NearLimitUsersTableProps {
  users: NearLimitUser[];
}

export const NearLimitUsersTable: React.FC<NearLimitUsersTableProps> = ({ users }) => {
  const hasUsers = users && users.length > 0;

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-xl flex flex-col justify-between h-full">
      <div>
        {/* Table Header */}
        <div className="pb-4 border-b border-slate-800 mb-4">
          <h3 className="text-base font-bold text-white flex items-center">
            <Zap className="w-4 h-4 mr-2 text-amber-400" />
            Near Plan Limits
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Top customer accounts at 80%+ limit capacity (upsell targets)</p>
        </div>

        {/* Table */}
        {!hasUsers ? (
          <div className="py-12 text-center flex flex-col items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
            <p className="text-sm font-semibold text-slate-200">No users near plan limits</p>
            <p className="text-xs text-slate-400 mt-1">🎉 All user accounts have comfortable feature headroom.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="text-slate-400 font-semibold border-b border-slate-800 text-[11px] uppercase">
                  <th className="pb-3 pr-3">User ID</th>
                  <th className="pb-3 px-3">Tier</th>
                  <th className="pb-3 px-3">Feature</th>
                  <th className="pb-3 px-3">Used / Limit</th>
                  <th className="pb-3 pl-3 text-right">Capacity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {users.map((item, idx) => {
                  const pct = Math.min(Math.round(item.percent_used * 100), 100);

                  // Color coding rules: <90% Yellow, 90-99% Orange, 100% Red
                  let barColor = 'bg-amber-400';
                  let textColor = 'text-amber-400';

                  if (pct >= 100) {
                    barColor = 'bg-red-500';
                    textColor = 'text-red-400';
                  } else if (pct >= 90) {
                    barColor = 'bg-orange-400';
                    textColor = 'text-orange-400';
                  }

                  return (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 pr-3 font-mono font-medium text-slate-300 truncate max-w-[120px]">
                        {item.user_id}
                      </td>
                      <td className="py-3 px-3">
                        <span className="capitalize px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                          {item.tier}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-300 font-medium">
                        {formatFeatureName(item.feature)}
                      </td>
                      <td className="py-3 px-3 text-slate-400 font-mono">
                        {item.used.toLocaleString()} / {item.limit.toLocaleString()}
                      </td>
                      <td className="py-3 pl-3 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <div className="w-20 bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
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
      </div>
    </div>
  );
};
