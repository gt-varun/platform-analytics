import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { MODULES } from '../config/pricing';
import { ModuleBillingLine } from '../types/platform';
import { formatCurrency, formatDurationLong } from '../utils/formatters';
import { formatModuleQuantity } from './charts';
import { Badge, Meter } from './ui';
import { timeEquivalentMinutes } from '../config/pricing';
import { usePalette } from '../theme';

/**
 * One module's allowance vs consumption — the shared building block behind the
 * User view (§4.1), the drill-down panel and the overage board (§4.2).
 */
export const ModuleAllowanceRow: React.FC<{ line: ModuleBillingLine; showTimeEquivalent?: boolean }> = ({
  line,
  showTimeEquivalent = true,
}) => {
  const palette = usePalette();
  const color = palette.module(line.module);
  const def = MODULES[line.module];
  const percent = line.percentUsed;
  const minutes = timeEquivalentMinutes(line.module, line.used);

  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className="text-sm font-semibold text-ink truncate">{def.label}</span>
          {line.unreliable && (
            <Badge tone="warning" icon={<AlertTriangle className="w-3 h-3" />} title="KYC overage tracking is blocked by a backend dependency (§5.1)">
              unverified
            </Badge>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-bold text-ink num">
            {formatModuleQuantity(line.module, line.used)}
            <span className="text-muted font-medium">
              {' / '}
              {line.included == null ? 'contract' : formatModuleQuantity(line.module, line.included)}
            </span>
          </div>
          {percent != null && (
            <div className={`text-[11px] font-semibold num ${line.triggered ? 'text-critical' : 'text-muted'}`}>
              {Math.round(percent * 100)}% of allowance
            </div>
          )}
        </div>
      </div>

      <Meter percent={percent} color={color} />

      <div className="flex items-center justify-between gap-3 mt-2">
        <p className="text-[11px] text-muted truncate">
          {showTimeEquivalent && minutes != null && minutes > 0
            ? `≈ ${formatDurationLong(minutes * 60)} of work`
            : def.helpText}
        </p>
        {line.overageUnits > 0 ? (
          <Badge tone="danger">
            +{formatModuleQuantity(line.module, line.overageUnits)} over · {formatCurrency(line.overageUsd)}
          </Badge>
        ) : line.included == null ? (
          <Badge tone="violet">negotiated</Badge>
        ) : (
          <Badge tone="success">
            {formatModuleQuantity(line.module, line.remaining ?? 0)} left
          </Badge>
        )}
      </div>
    </div>
  );
};

export const ModuleAllowanceList: React.FC<{ lines: ModuleBillingLine[]; showTimeEquivalent?: boolean }> = ({
  lines,
  showTimeEquivalent = true,
}) => (
  <div className="divide-y divide-line">
    {lines.map((line) => (
      <ModuleAllowanceRow key={line.module} line={line} showTimeEquivalent={showTimeEquivalent} />
    ))}
  </div>
);
