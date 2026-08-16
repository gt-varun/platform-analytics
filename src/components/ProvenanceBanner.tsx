import React from 'react';
import { FlaskConical, Radio } from 'lucide-react';
import { UserUsageResponse } from '../types/platform';
import { Badge, Callout } from './ui';

/**
 * Preview data is never allowed to masquerade as live data. Any view that reads
 * the per-user layer renders this first (§6 — the per-user endpoints don't exist yet).
 */
export const ProvenanceBanner: React.FC<{ layer: UserUsageResponse; compact?: boolean }> = ({
  layer,
  compact = false,
}) => {
  if (layer.source === 'live') {
    if (compact) return null;
    return (
      <Callout tone="success" icon={<Radio className="w-4 h-4 text-positive" />}>
        <span className="font-semibold text-positive">Live per-user data.</span> {layer.provenance}
      </Callout>
    );
  }

  return (
    <Callout
      tone="warning"
      icon={<FlaskConical className="w-4 h-4 text-caution" />}
      title="Preview data — per-user endpoints not built yet"
    >
      <p>{layer.provenance}</p>
      {!compact && (
        <p className="mt-2 text-muted">
          Totals, tier counts, receivables and the exempt/paying split on this page are live. The split
          <em> across accounts</em> is modelled. Wire up <code className="text-ink-2">/admin/user-usage</code> (see
          Delivery &amp; Gaps → Data Contract) and this banner turns green with no other change.
        </p>
      )}
    </Callout>
  );
};

export const SourceBadge: React.FC<{ source: 'live' | 'preview'; className?: string }> = ({ source, className }) => (
  <Badge tone={source === 'live' ? 'success' : 'warning'} className={className}>
    {source === 'live' ? 'live' : 'preview data'}
  </Badge>
);
