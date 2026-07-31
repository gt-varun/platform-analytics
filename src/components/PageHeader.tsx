import React from 'react';
import { RefreshCw, Clock, Download, Loader2 } from 'lucide-react';
import { PeriodDays } from '../types/analytics';
import { formatRelativeTime, formatDate } from '../utils/formatters';

interface PageHeaderProps {
  days: PeriodDays;
  onDaysChange: (days: PeriodDays) => void;
  onRefresh: () => void;
  onExportPdf: () => void;
  isFetching: boolean;
  isExportingPdf: boolean;
  exportStatusText?: string;
  generatedAt?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  days,
  onDaysChange,
  onRefresh,
  onExportPdf,
  isFetching,
  isExportingPdf,
  exportStatusText = 'Generating PDF...',
  generatedAt,
}) => {
  const periodOptions: PeriodDays[] = [30, 90, 365];

  return (
    <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 lg:px-8 py-4 mb-6 transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Left Title & Subtitle */}
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Business Analytics
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Live Production
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Platform usage, revenue, billing health and customer growth.
          </p>
        </div>

        {/* Right Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Days Selector */}
          <div className="bg-slate-900/90 p-1 rounded-xl border border-slate-800 flex items-center shadow-inner">
            {periodOptions.map((option) => (
              <button
                key={option}
                onClick={() => onDaysChange(option)}
                disabled={isFetching || isExportingPdf}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  days === option
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                } ${isFetching || isExportingPdf ? 'opacity-50 cursor-not-allowed' : ''}`}
                aria-label={`Select ${option} days`}
              >
                {option} Days
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isFetching || isExportingPdf}
            className={`inline-flex items-center px-3.5 py-2 border border-slate-700/80 rounded-xl text-xs font-semibold text-slate-200 bg-slate-900/80 hover:bg-slate-800 hover:border-slate-600 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              isFetching || isExportingPdf ? 'opacity-60 cursor-not-allowed' : ''
            }`}
            aria-label="Refresh data"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-2 text-indigo-400 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? 'Refreshing...' : 'Refresh'}
          </button>

          {/* Export PDF Button */}
          <button
            onClick={onExportPdf}
            disabled={isFetching || isExportingPdf}
            className={`inline-flex items-center px-3.5 py-2 border border-indigo-500/30 rounded-xl text-xs font-semibold text-white bg-indigo-600/90 hover:bg-indigo-600 hover:border-indigo-400 transition-all shadow-md shadow-indigo-600/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              isFetching || isExportingPdf ? 'opacity-60 cursor-not-allowed' : ''
            }`}
            aria-label="Export executive report as PDF"
          >
            {isExportingPdf ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin text-indigo-200" />
                <span>{exportStatusText}</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 mr-2 text-indigo-200" />
                <span>Export PDF</span>
              </>
            )}
          </button>

          {/* Last Updated Timestamp */}
          {generatedAt && (
            <div className="hidden sm:flex items-center text-xs text-slate-400 bg-slate-900/50 border border-slate-800/80 px-3 py-1.5 rounded-xl">
              <Clock className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
              <span>
                Updated <strong className="text-slate-300 font-medium">{formatRelativeTime(generatedAt)}</strong>
                <span className="text-slate-400 text-[10px] ml-1">({formatDate(generatedAt)})</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};


