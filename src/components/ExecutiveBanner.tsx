import React from 'react';
import { ShieldCheck, AlertTriangle, AlertCircle } from 'lucide-react';
import { BannerSummary } from '../utils/insights';

interface ExecutiveBannerProps {
  summary: BannerSummary;
}

export const ExecutiveBanner: React.FC<ExecutiveBannerProps> = ({ summary }) => {
  const getBannerStyles = () => {
    switch (summary.status) {
      case 'critical':
        return {
          bg: 'bg-red-950/40 border-red-500/30 text-red-200',
          icon: <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />,
          accent: 'text-red-400',
        };
      case 'warning':
        return {
          bg: 'bg-amber-950/40 border-amber-500/30 text-amber-200',
          icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
          accent: 'text-amber-400',
        };
      case 'healthy':
      default:
        return {
          bg: 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200',
          icon: <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />,
          accent: 'text-emerald-400',
        };
    }
  };

  const styles = getBannerStyles();

  return (
    <div className={`w-full rounded-2xl border p-4 mb-8 shadow-lg backdrop-blur-sm ${styles.bg}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          {styles.icon}
          <div>
            <span className="text-xs uppercase tracking-wider font-bold opacity-75 block">Executive Health Status</span>
            <h2 className={`text-base font-semibold ${styles.accent}`}>{summary.headline}</h2>
          </div>
        </div>

        {/* Dynamic Status Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {summary.pills.map((pill, idx) => {
            let pillStyle = 'bg-slate-800/80 text-slate-300 border-slate-700';
            if (pill.type === 'success') pillStyle = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
            if (pill.type === 'warning') pillStyle = 'bg-amber-500/10 text-amber-300 border-amber-500/20';
            if (pill.type === 'error') pillStyle = 'bg-red-500/10 text-red-300 border-red-500/20';

            return (
              <span
                key={idx}
                className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold border ${pillStyle}`}
              >
                {pill.label}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};
