import React from 'react';
import { Loader2 } from 'lucide-react';

export const SkeletonLoader: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Loading Status Banner */}
      <div className="flex flex-col items-center justify-center py-8 px-6 bg-slate-900/90 rounded-2xl border border-indigo-500/30 shadow-2xl space-y-3 text-center transition-all">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        <div>
          <h3 className="text-base font-bold text-white">Fetching Business Analytics...</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md">
            This live report is querying real production data and may take up to <strong className="text-indigo-300 font-medium">20 seconds</strong> to generate.
          </p>
        </div>
      </div>

      <div className="space-y-6 animate-pulse">
        {/* Top Banner Skeleton */}
        <div className="w-full h-20 bg-slate-900/60 rounded-2xl border border-slate-800 animate-shimmer" />

        {/* 4 Executive KPI Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-slate-900/60 rounded-2xl border border-slate-800 p-4 space-y-3 animate-shimmer">
              <div className="h-4 w-24 bg-slate-800 rounded" />
              <div className="h-8 w-32 bg-slate-800 rounded" />
              <div className="h-3 w-40 bg-slate-800 rounded" />
            </div>
          ))}
        </div>

        {/* 4 Feature Usage Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-44 bg-slate-900/60 rounded-2xl border border-slate-800 p-4 space-y-3 animate-shimmer">
              <div className="h-4 w-28 bg-slate-800 rounded" />
              <div className="h-8 w-24 bg-slate-800 rounded" />
              <div className="h-3 w-36 bg-slate-800 rounded" />
              <div className="h-10 w-full bg-slate-800/50 rounded mt-4" />
            </div>
          ))}
        </div>

        {/* Trend Chart Skeleton */}
        <div className="h-80 bg-slate-900/60 rounded-2xl border border-slate-800 p-6 space-y-4 animate-shimmer">
          <div className="h-6 w-48 bg-slate-800 rounded" />
          <div className="h-56 w-full bg-slate-800/40 rounded" />
        </div>

        {/* 2 Column Section Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-72 bg-slate-900/60 rounded-2xl border border-slate-800 p-6 animate-shimmer" />
          <div className="h-72 bg-slate-900/60 rounded-2xl border border-slate-800 p-6 animate-shimmer" />
        </div>
      </div>
    </div>
  );
};

