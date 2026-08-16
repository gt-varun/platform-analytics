import React from 'react';
import { Loader2 } from 'lucide-react';

const Bar: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`rounded animate-shimmer ${className}`} />
);

export const SkeletonLoader: React.FC = () => (
  <div className="space-y-5">
    <div className="flex items-center gap-3 bg-surface rounded-card border border-line px-5 py-4">
      <Loader2 className="w-4 h-4 text-accent animate-spin shrink-0" />
      <div>
        <p className="text-[13.5px] font-semibold text-ink">Loading live usage data</p>
        <p className="text-[12px] text-muted">
          Querying production Stripe and Supabase records — this can take up to 20 seconds.
        </p>
      </div>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-surface rounded-card border border-line p-5 space-y-3">
          <Bar className="h-3 w-24" />
          <Bar className="h-7 w-32" />
          <Bar className="h-3 w-36" />
        </div>
      ))}
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-surface rounded-card border border-line p-5 space-y-3">
          <Bar className="h-3 w-28" />
          <Bar className="h-7 w-24" />
          <Bar className="h-2 w-full" />
        </div>
      ))}
    </div>

    <div className="bg-surface rounded-card border border-line p-6 space-y-4">
      <Bar className="h-4 w-44" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Bar key={i} className="h-40 w-full" />
        ))}
      </div>
    </div>
  </div>
);
