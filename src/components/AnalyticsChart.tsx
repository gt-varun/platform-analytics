import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { formatCompactNumber, formatDate, formatMeetingTime } from '../utils/formatters';

// Custom Tooltip component for Recharts
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  isTimeChart?: boolean;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label, isTimeChart }) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-slate-900/95 border border-slate-700/80 p-3 rounded-xl shadow-2xl backdrop-blur-md text-xs">
      {label && <p className="font-semibold text-slate-300 mb-2 border-b border-slate-800 pb-1">{formatDate(label)}</p>}
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between space-x-4">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-slate-400 capitalize">{entry.name.replace('_', ' ')}</span>
            </div>
            <span className="font-bold text-white">
              {entry.name === 'meeting_time' || (isTimeChart && entry.name === 'Meeting Time')
                ? formatMeetingTime(entry.value)
                : entry.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Line Chart props
interface UsageTrendChartProps {
  type: 'usage-trend';
  data: Array<{ day: string; meeting_time: number; kyc_count: number; simulator: number; proposal: number }>;
}

// Donut Chart props
interface DonutChartProps {
  type: 'donut';
  data: Array<{ name: string; value: number; color: string }>;
  centerLabel?: string;
}

// Area Chart props
interface GrowthChartProps {
  type: 'growth';
  data: Array<{ day: string; count: number }>;
}

export type ChartProps = UsageTrendChartProps | DonutChartProps | GrowthChartProps;

export const AnalyticsChart: React.FC<ChartProps> = (props) => {
  // Toggle states for daily usage trend features
  const [activeSeries, setActiveSeries] = useState<Record<string, boolean>>({
    meeting_time: true,
    kyc_count: true,
    simulator: true,
    proposal: true,
  });

  const toggleSeries = (key: string) => {
    setActiveSeries((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (props.type === 'usage-trend') {
    const seriesConfig = [
      { key: 'meeting_time', name: 'Meeting Time', color: '#6366f1' }, // Indigo
      { key: 'kyc_count', name: 'KYC Checks', color: '#10b981' },     // Emerald
      { key: 'simulator', name: 'Simulator', color: '#f59e0b' },      // Amber
      { key: 'proposal', name: 'Proposal', color: '#ec4899' },        // Pink
    ];

    return (
      <div className="w-full">
        {/* Dataset Toggles */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-xs text-slate-400 font-medium mr-1">Datasets:</span>
          {seriesConfig.map((s) => (
            <button
              key={s.key}
              onClick={() => toggleSeries(s.key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center space-x-1.5 ${
                activeSeries[s.key]
                  ? 'bg-slate-800 text-white border-slate-600'
                  : 'bg-slate-900/50 text-slate-400 border-slate-800 opacity-60'
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
              <span>{s.name}</span>
            </button>
          ))}
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={props.data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="day"
                tickFormatter={(val) => formatDate(val).split(',')[0]}
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickFormatter={(val) => formatCompactNumber(val)}
              />
              <Tooltip content={<CustomTooltip />} />
              {seriesConfig.map(
                (s) =>
                  activeSeries[s.key] && (
                    <Line
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      name={s.name}
                      stroke={s.color}
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                    />
                  )
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  if (props.type === 'donut') {
    const total = props.data.reduce((acc, curr) => acc + curr.value, 0);

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 h-64">
        <div className="h-full w-full sm:w-1/2 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={props.data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
              >
                {props.data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke="#090d16" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip
                formatter={(val: number) => [
                  `${val} (${total > 0 ? ((val / total) * 100).toFixed(1) : 0}%)`,
                  'Count',
                ]}
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem' }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Center Label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xl font-bold text-white">{total}</span>
            <span className="text-[10px] text-slate-400 font-medium uppercase">{props.centerLabel || 'Total'}</span>
          </div>
        </div>

        {/* Legend Details */}
        <div className="w-full sm:w-1/2 space-y-2.5 text-xs">
          {props.data.map((item, idx) => {
            const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
            return (
              <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="font-medium text-slate-300 capitalize">{item.name}</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-white mr-1.5">{item.value}</span>
                  <span className="text-slate-400 text-[11px]">({pct}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (props.type === 'growth') {
    return (
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={props.data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="day"
              tickFormatter={(val) => formatDate(val).split(',')[0]}
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
            />
            <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="count"
              name="New Subscriptions"
              stroke="#10b981"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#growthGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return null;
};
