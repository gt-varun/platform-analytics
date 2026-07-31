import React from 'react';

interface MetricCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon?: React.ReactNode;
  badge?: {
    text: string;
    variant?: 'warning' | 'danger' | 'info' | 'success';
  };
  details?: Array<{ label: string; value: string }>;
  accentColor?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  badge,
  details,
  accentColor = 'border-slate-800',
}) => {
  return (
    <div
      className={`bg-slate-900/90 rounded-2xl border ${accentColor} p-5 hover:border-slate-700 transition-all duration-200 shadow-xl flex flex-col justify-between group`}
    >
      <div>
        {/* Header: Title & Icon/Badge */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {title}
          </span>
          <div className="flex items-center space-x-2">
            {badge && (
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  badge.variant === 'danger'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse'
                    : badge.variant === 'warning'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                }`}
              >
                {badge.text}
              </span>
            )}
            {icon && <div className="text-slate-400 group-hover:text-indigo-400 transition-colors">{icon}</div>}
          </div>
        </div>

        {/* Main Value */}
        <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight my-1">
          {value}
        </div>

        {/* Subtitle */}
        <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
      </div>

      {/* Optional Details Footer */}
      {details && details.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-xs">
          {details.map((d, i) => (
            <div key={i}>
              <span className="text-slate-400 block text-[11px] font-medium">{d.label}</span>
              <span className="text-slate-200 font-semibold">{d.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
