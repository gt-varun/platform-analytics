import React from 'react';
import { ShieldCheck, AlertTriangle, AlertCircle } from 'lucide-react';
import { BannerSummary } from '../utils/insights';

interface ExecutiveBannerProps {
  summary: BannerSummary;
}

/**
 * The status line at the top of the Overview. Kept quiet on purpose: a status
 * rail on the left carries the state, the surface stays paper-white so it
 * doesn't shout over the numbers below it.
 */
export const ExecutiveBanner: React.FC<ExecutiveBannerProps> = ({ summary }) => {
  const styles = {
    critical: {
      rail: 'border-l-critical',
      icon: <AlertCircle className="w-[18px] h-[18px] text-critical shrink-0" />,
      headline: 'text-critical',
    },
    warning: {
      rail: 'border-l-caution',
      icon: <AlertTriangle className="w-[18px] h-[18px] text-caution shrink-0" />,
      headline: 'text-ink',
    },
    healthy: {
      rail: 'border-l-positive',
      icon: <ShieldCheck className="w-[18px] h-[18px] text-positive shrink-0" />,
      headline: 'text-ink',
    },
  }[summary.status];

  return (
    <div className={`w-full bg-surface rounded-r-card border border-l-[3px] border-line ${styles.rail} px-5 py-4`}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {styles.icon}
          <div>
            <span className="label block">Platform status</span>
            <h2 className={`text-[15px] font-semibold ${styles.headline}`}>{summary.headline}</h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {summary.pills.map((pill, idx) => {
            let pillStyle = 'bg-sunken text-ink-2 border-line';
            if (pill.type === 'success') pillStyle = 'bg-positive-tint text-positive border-positive/25';
            if (pill.type === 'warning') pillStyle = 'bg-caution-tint text-caution border-caution/25';
            if (pill.type === 'error') pillStyle = 'bg-critical-tint text-critical border-critical/25';

            return (
              <span
                key={idx}
                className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11.5px] font-semibold border ${pillStyle}`}
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
