import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { MODULES, ModuleKey } from '../config/pricing';
import { TrendBucket } from '../types/platform';
import {
  durationAxisUnit,
  formatCompactNumber,
  formatCurrency,
  formatDuration,
  formatDurationAxis,
} from '../utils/formatters';
import { usePalette } from '../theme';

/**
 * Charts for the module and overage views.
 *
 * Meeting time (millions of seconds) and proposals (single digits) cannot share
 * a y-axis, and a second axis would be a lie — so per-module trends are drawn as
 * small multiples, each with its own scale and its own allowance line.
 *
 * Duration axes pick one unit for the whole scale from the domain (days, hours
 * or minutes) rather than per tick, so a scale never reads "23h, 2d, 3d".
 */

export function formatModuleQuantity(module: ModuleKey, value: number): string {
  if (MODULES[module].sourceUnit === 'seconds') return formatDuration(value);
  const rounded = Math.round(value * 100) / 100;
  return rounded === Math.round(value) ? Math.round(value).toLocaleString() : rounded.toFixed(2);
}

/** One unit for the whole axis, chosen from the domain maximum. */
function makeAxisFormatter(module: ModuleKey, domainMax: number): (value: number) => string {
  if (MODULES[module].sourceUnit !== 'seconds') return (value: number) => formatCompactNumber(value);
  const unit = durationAxisUnit(domainMax);
  return (value: number) => formatDurationAxis(value, unit);
}

const TooltipShell: React.FC<{
  title: string;
  rows: Array<{ label: string; value: string; color?: string }>;
  bg: string;
  border: string;
}> = ({ title, rows, bg, border }) => (
  <div
    className="p-3 rounded-lg shadow-lg text-[12px] min-w-[190px] border"
    style={{ backgroundColor: bg, borderColor: border }}
  >
    <p className="font-semibold text-ink mb-2 border-b border-line pb-1.5">{title}</p>
    <div className="space-y-1.5">
      {rows.map((row, index) => (
        <div key={index} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 text-muted">
            {row.color && <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: row.color }} />}
            {row.label}
          </span>
          <span className="num font-semibold text-ink">{row.value}</span>
        </div>
      ))}
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/* Per-module trend, small multiple                                    */
/* ------------------------------------------------------------------ */

interface ModuleTrendProps {
  module: ModuleKey;
  buckets: TrendBucket[];
  /** Allowance per bucket in source units — draws the overage trigger line (§4.6). */
  allowancePerBucket?: number | null;
  /** Allowance per billing cycle, used when the per-bucket figure is too small to plot. */
  allowancePerCycle?: number | null;
  height?: number;
}

export const ModuleTrend: React.FC<ModuleTrendProps> = ({
  module,
  buckets,
  allowancePerBucket = null,
  allowancePerCycle = null,
  height = 150,
}) => {
  const palette = usePalette();
  const chrome = palette.chart;
  const color = palette.module(module);
  const def = MODULES[module];

  const total = buckets.reduce((sum, b) => sum + (b[module] || 0), 0);
  const peak = buckets.reduce((max, b) => Math.max(max, b[module] || 0), 0);
  const triggered = allowancePerBucket != null && peak > allowancePerBucket;

  // A monthly allowance of 3 checks is 0.1 checks/day — a line there is noise,
  // not information. Only plot it once one bucket's share is a whole unit.
  const minPlottable = def.sourceUnit === 'seconds' ? 60 : 1;
  const plotAllowance = allowancePerBucket != null && allowancePerBucket >= minPlottable;
  const axisFormatter = makeAxisFormatter(module, Math.max(peak, plotAllowance && allowancePerBucket ? allowancePerBucket : 0));
  const axisTick = { fill: chrome.axisTick, fontSize: 10 };

  return (
    <div className="bg-sunken rounded-lg border border-line p-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className="text-[12.5px] font-semibold text-ink truncate">{def.label}</span>
        </div>
        <span
          className="num text-[12.5px] font-semibold text-ink shrink-0"
          title="Sum of the plotted series. The API's daily series and its feature total use slightly different window edges — see Delivery & Gaps."
        >
          {formatModuleQuantity(module, total)}
        </span>
      </div>

      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={buckets} margin={{ top: 4, right: 6, left: -14, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${module}-${palette.theme}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={chrome.grid} vertical={false} />
            <XAxis dataKey="label" stroke={chrome.axisLine} tick={axisTick} interval="preserveStartEnd" />
            <YAxis stroke={chrome.axisLine} tick={axisTick} tickFormatter={axisFormatter} width={56} />
            {plotAllowance && allowancePerBucket != null && (
              // No inline label: on a series with a big spike the line sits near
              // the axis and the text collides with the ticks. The caption below
              // the chart carries the meaning instead.
              <ReferenceLine y={allowancePerBucket} stroke={chrome.overage} strokeDasharray="4 4" strokeWidth={1.5} />
            )}
            <Tooltip
              cursor={{ stroke: chrome.axisLine, strokeWidth: 1 }}
              content={({ active, payload, label }) => {
                if (!active || !payload || payload.length === 0) return null;
                const value = Number(payload[0].value) || 0;
                const rows = [{ label: def.label, value: formatModuleQuantity(module, value), color }];
                if (plotAllowance && allowancePerBucket != null) {
                  rows.push({
                    label: 'Allowance',
                    value: formatModuleQuantity(module, allowancePerBucket),
                    color: chrome.overage,
                  });
                }
                return (
                  <TooltipShell title={String(label)} rows={rows} bg={chrome.tooltipBg} border={chrome.tooltipBorder} />
                );
              }}
            />
            <Area
              isAnimationActive={false}
              type="monotone"
              dataKey={module}
              stroke={color}
              strokeWidth={2}
              fill={`url(#grad-${module}-${palette.theme})`}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {plotAllowance && allowancePerBucket != null ? (
        <p className="text-[11.5px] mt-1.5 flex items-center gap-1.5 text-muted">
          <span className="w-4 border-t-2 border-dashed shrink-0" style={{ borderColor: chrome.overage }} />
          <span className={triggered ? 'text-critical' : undefined}>
            {triggered
              ? `Allowance (${formatModuleQuantity(module, allowancePerBucket)} per bucket) crossed in this window`
              : `Allowance ${formatModuleQuantity(module, allowancePerBucket)} per bucket`}
          </span>
        </p>
      ) : allowancePerCycle != null && allowancePerCycle > 0 ? (
        <p className="text-[11.5px] mt-1.5 text-muted">
          Allowance is {formatModuleQuantity(module, allowancePerCycle)} per billing cycle — less than one unit per
          bucket here, so the trigger line only means anything on the Monthly view.
        </p>
      ) : null}
    </div>
  );
};

export const ModuleTrendGrid: React.FC<{
  buckets: TrendBucket[];
  modules?: ModuleKey[];
  allowances?: Partial<Record<ModuleKey, number | null>>;
  allowancesPerCycle?: Partial<Record<ModuleKey, number | null>>;
  height?: number;
}> = ({
  buckets,
  modules = ['meeting_time', 'kyc_count', 'simulator', 'proposal'],
  allowances = {},
  allowancesPerCycle = {},
  height = 150,
}) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
    {modules.map((module) => (
      <ModuleTrend
        key={module}
        module={module}
        buckets={buckets}
        allowancePerBucket={allowances[module] ?? null}
        allowancePerCycle={allowancesPerCycle[module] ?? null}
        height={height}
      />
    ))}
  </div>
);

/* ------------------------------------------------------------------ */
/* Included vs overage, stacked                                        */
/* ------------------------------------------------------------------ */

export const UsageVsAllowanceBars: React.FC<{
  module: ModuleKey;
  data: Array<{ label: string; included: number; overage: number }>;
  allowance: number | null;
  height?: number;
}> = ({ module, data, allowance, height = 220 }) => {
  const palette = usePalette();
  const chrome = palette.chart;
  const color = palette.module(module);
  const axisTick = { fill: chrome.axisTick, fontSize: 11 };
  const domainMax = data.reduce((max, row) => Math.max(max, row.included + row.overage), allowance ?? 0);
  const axisFormatter = makeAxisFormatter(module, domainMax);

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chrome.grid} vertical={false} />
          <XAxis dataKey="label" stroke={chrome.axisLine} tick={{ ...axisTick, fontSize: 10 }} />
          <YAxis stroke={chrome.axisLine} tick={axisTick} tickFormatter={axisFormatter} width={58} />
          {allowance != null && allowance > 0 && (
            <ReferenceLine y={allowance} stroke={chrome.overage} strokeDasharray="4 4" strokeWidth={1.5} />
          )}
          <Tooltip
            cursor={{ fill: chrome.cursor }}
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) return null;
              const included = Number(payload.find((p) => p.dataKey === 'included')?.value) || 0;
              const overage = Number(payload.find((p) => p.dataKey === 'overage')?.value) || 0;
              return (
                <TooltipShell
                  title={String(label)}
                  bg={chrome.tooltipBg}
                  border={chrome.tooltipBorder}
                  rows={[
                    { label: 'Within allowance', value: formatModuleQuantity(module, included), color },
                    { label: 'Overage', value: formatModuleQuantity(module, overage), color: chrome.overage },
                  ]}
                />
              );
            }}
          />
          <Bar
            isAnimationActive={false}
            dataKey="included"
            stackId="usage"
            fill={color}
            radius={[0, 0, 2, 2]}
            maxBarSize={38}
          />
          <Bar
            isAnimationActive={false}
            dataKey="overage"
            stackId="usage"
            fill={chrome.overage}
            radius={[4, 4, 0, 0]}
            maxBarSize={38}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Counts over time (signups)                                          */
/* ------------------------------------------------------------------ */

export const CountsAreaChart: React.FC<{
  data: Array<{ label: string; count: number }>;
  seriesName?: string;
  height?: number;
}> = ({ data, seriesName = 'New subscriptions', height = 220 }) => {
  const palette = usePalette();
  const chrome = palette.chart;
  const color = chrome.growth;
  const axisTick = { fill: chrome.axisTick, fontSize: 11 };

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id={`countsGradient-${palette.theme}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={chrome.grid} vertical={false} />
          <XAxis dataKey="label" stroke={chrome.axisLine} tick={axisTick} interval="preserveStartEnd" />
          <YAxis stroke={chrome.axisLine} tick={axisTick} allowDecimals={false} width={40} />
          <Tooltip
            cursor={{ stroke: chrome.axisLine, strokeWidth: 1 }}
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) return null;
              return (
                <TooltipShell
                  title={String(label)}
                  bg={chrome.tooltipBg}
                  border={chrome.tooltipBorder}
                  rows={[{ label: seriesName, value: String(payload[0].value ?? 0), color }]}
                />
              );
            }}
          />
          <Area
            isAnimationActive={false}
            type="monotone"
            dataKey="count"
            stroke={color}
            strokeWidth={2}
            fill={`url(#countsGradient-${palette.theme})`}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Horizontal comparison bars                                          */
/* ------------------------------------------------------------------ */

export const HorizontalBars: React.FC<{
  data: Array<{ label: string; value: number; color: string; note?: string }>;
  valueFormatter?: (value: number) => string;
  height?: number;
}> = ({ data, valueFormatter = (v) => formatCurrency(v), height = 200 }) => {
  const palette = usePalette();
  const chrome = palette.chart;
  const axisTick = { fill: chrome.axisTick, fontSize: 11 };

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chrome.grid} horizontal={false} />
          <XAxis
            type="number"
            stroke={chrome.axisLine}
            tick={axisTick}
            tickFormatter={(v) => valueFormatter(Number(v))}
          />
          <YAxis type="category" dataKey="label" stroke={chrome.axisLine} tick={axisTick} width={112} />
          <Tooltip
            cursor={{ fill: chrome.cursor }}
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null;
              const row = payload[0].payload as { label: string; value: number; color: string; note?: string };
              return (
                <TooltipShell
                  title={row.label}
                  bg={chrome.tooltipBg}
                  border={chrome.tooltipBorder}
                  rows={[
                    { label: 'Value', value: valueFormatter(row.value), color: row.color },
                    ...(row.note ? [{ label: 'Note', value: row.note }] : []),
                  ]}
                />
              );
            }}
          />
          <Bar isAnimationActive={false} dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={26}>
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
