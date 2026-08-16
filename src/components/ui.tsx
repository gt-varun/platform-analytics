import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Presentational primitives for the "Ledger" system: white paper, hairline
 * rules, one navy accent, colour reserved for status, figures in tabular mono.
 */

export const Card: React.FC<{
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}> = ({ children, className = '', padded = true }) => (
  <div
    className={`bg-surface rounded-card border border-line ${padded ? 'p-5 sm:p-6' : ''} ${className}`}
  >
    {children}
  </div>
);

export const SectionHeading: React.FC<{
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  requirement?: string;
  actions?: React.ReactNode;
  id?: string;
}> = ({ title, subtitle, icon, requirement, actions, id }) => (
  /*
   * The actions must not shrink — a segmented control squeezed narrower than its
   * labels is unusable — but they must not crush the heading either. Wrapping the
   * row and giving the title a real flex-basis means that when the two cannot sit
   * side by side, the actions drop to their own line and the title keeps full
   * width, instead of the title collapsing to one word per line.
   */
  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 mb-5">
    <div className="min-w-0 flex-1 basis-[19rem]">
      <h2 id={id} className="text-[15px] font-semibold text-ink flex items-center gap-2 leading-6">
        {icon && <span className="text-accent shrink-0">{icon}</span>}
        <span>{title}</span>
        {requirement && (
          <span className="num text-[10px] font-medium text-subtle border border-line rounded px-1.5 py-px">
            {requirement}
          </span>
        )}
      </h2>
      {subtitle && <p className="text-[13px] text-muted mt-1 max-w-[80ch] leading-relaxed">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 shrink-0 ml-auto">{actions}</div>}
  </div>
);

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'violet';

const BADGE_TONES: Record<Tone, string> = {
  neutral: 'bg-sunken text-ink-2 border-line',
  info: 'bg-accent-tint text-accent border-accent-line',
  success: 'bg-positive-tint text-positive border-positive/25',
  warning: 'bg-caution-tint text-caution border-caution/25',
  danger: 'bg-critical-tint text-critical border-critical/25',
  violet: 'bg-accent-tint text-accent border-accent-line',
};

export const Badge: React.FC<{
  children: React.ReactNode;
  tone?: Tone;
  icon?: React.ReactNode;
  title?: string;
  className?: string;
}> = ({ children, tone = 'neutral', icon, title, className = '' }) => (
  <span
    title={title}
    className={`inline-flex items-center gap-1 px-2 py-[3px] rounded-md text-[11px] font-semibold border whitespace-nowrap leading-4 ${BADGE_TONES[tone]} ${className}`}
  >
    {icon}
    {children}
  </span>
);

const DOT_TONES: Record<Tone, string> = {
  neutral: 'bg-line-strong',
  info: 'bg-accent',
  success: 'bg-positive',
  warning: 'bg-caution',
  danger: 'bg-critical',
  violet: 'bg-accent',
};

export const StatTile: React.FC<{
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  badge?: React.ReactNode;
  footnote?: string;
  icon?: React.ReactNode;
  title?: string;
}> = ({ label, value, hint, tone = 'neutral', badge, footnote, icon, title }) => (
  <div
    title={title}
    className="bg-surface rounded-card border border-line p-4 sm:p-5 flex flex-col justify-between gap-1 card-interactive"
  >
    <div className="flex items-start justify-between gap-2">
      <span className="label flex items-center gap-1.5">
        {tone !== 'neutral' && <span className={`w-1.5 h-1.5 rounded-full ${DOT_TONES[tone]}`} />}
        {label}
      </span>
      {badge ?? (icon ? <span className="text-subtle">{icon}</span> : null)}
    </div>
    <div className="num text-[25px] sm:text-[28px] leading-9 font-semibold text-ink mt-1">{value}</div>
    {hint && <p className="text-[12.5px] text-muted leading-snug">{hint}</p>}
    {footnote && <p className="text-[11.5px] text-subtle mt-2 pt-2 border-t border-line leading-snug">{footnote}</p>}
  </div>
);

const CALLOUT_TONES: Record<Tone, string> = {
  neutral: 'border-l-line-strong bg-sunken',
  info: 'border-l-accent bg-accent-tint',
  success: 'border-l-positive bg-positive-tint',
  warning: 'border-l-caution bg-caution-tint',
  danger: 'border-l-critical bg-critical-tint',
  violet: 'border-l-accent bg-accent-tint',
};

export const Callout: React.FC<{
  tone?: Tone;
  title?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ tone = 'info', title, icon, children, className = '' }) => (
  <div
    className={`rounded-r-card border border-l-[3px] border-line px-4 py-3.5 ${CALLOUT_TONES[tone]} ${className}`}
  >
    <div className="flex items-start gap-3">
      {icon && <span className="mt-px shrink-0">{icon}</span>}
      <div className="min-w-0 text-[13px] leading-relaxed text-ink-2">
        {title && <p className="font-semibold text-ink text-[13.5px] mb-1">{title}</p>}
        {children}
      </div>
    </div>
  </div>
);

export const EmptyState: React.FC<{
  title: string;
  description?: string;
  icon?: React.ReactNode;
}> = ({ title, description, icon }) => (
  <div className="py-12 px-4 text-center flex flex-col items-center justify-center">
    {icon && <div className="mb-3 text-subtle">{icon}</div>}
    <p className="text-[14px] font-semibold text-ink">{title}</p>
    {description && <p className="text-[12.5px] text-muted mt-1.5 max-w-md leading-relaxed">{description}</p>}
  </div>
);

/**
 * The allowance meter — the signature element.
 *
 * The included allowance always sits at the same mark on the track (70%),
 * whatever the module or the scale. Everything left of the mark is paid for;
 * everything right of it costs money. Because the threshold never moves, "how
 * far over is this account" is comparable at a glance across every row, module
 * and tier in the product — which a plain percentage-width bar cannot do.
 */
const THRESHOLD = 70; // % of track width where the allowance sits

export const Meter: React.FC<{
  percent: number | null;
  color: string;
  compact?: boolean;
  showThresholdLabel?: boolean;
}> = ({ percent, color, compact = false, showThresholdLabel = false }) => {
  const height = compact ? 'h-1.5' : 'h-2';

  if (percent == null) {
    return (
      <div className={`relative w-full ${height} rounded-sm bg-sunken border border-line`} title="Negotiated allowance" />
    );
  }

  const withinFraction = Math.min(1, percent);
  const overFraction = Math.min(1, Math.max(0, percent - 1));
  const withinWidth = withinFraction * THRESHOLD;
  const overWidth = overFraction * (100 - THRESHOLD);

  return (
    <div className="w-full">
      <div className={`relative w-full ${height} rounded-sm bg-sunken border border-line overflow-hidden`}>
        {/* The billable zone, tinted so the region past the threshold reads as costly.
            Only drawn once an account is close to the line — on a table of mostly idle
            rows, tinting every track turns the signal into wallpaper. */}
        {percent >= 0.85 && (
          <div className="absolute inset-y-0 right-0 bg-critical-tint" style={{ width: `${100 - THRESHOLD}%` }} />
        )}
        {/* Consumption within the allowance. */}
        <div
          className="absolute inset-y-0 left-0 meter-fill"
          style={{ width: `${withinWidth}%`, backgroundColor: color }}
        />
        {/* Overage, separated from the fill by a hairline gap so the two read apart. */}
        {overWidth > 0 && (
          <div
            className="absolute inset-y-0 bg-critical border-l-2 border-surface meter-fill"
            style={{ left: `${THRESHOLD}%`, width: `${overWidth}%` }}
          />
        )}
        {/* The threshold itself. */}
        <div
          className="absolute inset-y-0 w-px bg-line-strong"
          style={{ left: `${THRESHOLD}%` }}
        />
      </div>
      {showThresholdLabel && (
        <div className="relative h-3 mt-0.5">
          <span
            className="absolute label text-[9px] -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${THRESHOLD}%` }}
          >
            allowance
          </span>
        </div>
      )}
    </div>
  );
};

export interface SegmentedOption<T extends string> {
  id: T;
  label: string;
  title?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  disabled = false,
  ariaLabel,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (next: T) => void;
  size?: 'sm' | 'md';
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="bg-sunken p-0.5 rounded-lg border border-line inline-flex items-center"
    >
      {options.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            title={option.title}
            disabled={disabled}
            onClick={() => onChange(option.id)}
            aria-pressed={active}
            className={`${
              size === 'sm' ? 'px-2.5 py-1 text-[11.5px]' : 'px-3 py-1.5 text-[12.5px]'
            } font-semibold rounded-md transition-colors duration-150 whitespace-nowrap ${
              active
                ? 'bg-surface text-ink border border-line shadow-[0_1px_2px_rgba(14,33,56,0.08)]'
                : 'text-muted hover:text-ink border border-transparent'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pagination                                                          */
/* ------------------------------------------------------------------ */

export interface PaginationState<T> {
  /** The slice to render for the current page. */
  pageItems: T[];
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  /** 1-based index of the first row on this page — for "Showing 11–20 of 56". */
  from: number;
  to: number;
  setPage: (page: number) => void;
}

/**
 * Client-side pagination.
 *
 * Everything here is already in memory — the whole account layer arrives in one
 * response — so this is a windowing concern, not a fetching one. Two behaviours
 * matter more than they look:
 *
 * - The page is clamped whenever the list shrinks. Filtering a 56-row table down
 *   to 3 while sitting on page 4 otherwise leaves an empty table that reads as
 *   "no results" when there are results.
 * - `resetKey` sends the reader back to page 1 when the *meaning* of the list
 *   changes (a new search term, a different sort). Staying on page 4 of a list
 *   you just re-sorted shows an arbitrary middle slice of unfamiliar data.
 */
export function usePagination<T>(items: T[], pageSize = 10, resetKey?: unknown): PaginationState<T> {
  const [page, setPage] = useState(1);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  // `page` can be momentarily stale relative to a shrunken list, so the slice is
  // taken from a clamped value rather than waiting for the effect to land.
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;

  const pageItems = useMemo(() => items.slice(start, start + pageSize), [items, start, pageSize]);

  return {
    pageItems,
    page: safePage,
    pageCount,
    pageSize,
    total,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, total),
    setPage,
  };
}

/** First, last, and a window around the current page — with gaps marked. */
function pageWindow(page: number, pageCount: number): Array<number | 'gap'> {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);

  const pages = new Set<number>([1, pageCount, page, page - 1, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);

  const out: Array<number | 'gap'> = [];
  let previous = 0;
  for (const p of sorted) {
    if (previous && p - previous > 1) out.push('gap');
    out.push(p);
    previous = p;
  }
  return out;
}

const pageButton =
  'min-w-[30px] h-[30px] px-1.5 inline-flex items-center justify-center rounded-md text-[12px] font-semibold num ' +
  'transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

/**
 * The count line always renders; the controls only appear once there is more
 * than one page. A pager under a five-row table is noise, but "5 accounts" is
 * still worth stating — a table with no total invites the reader to assume the
 * rows shown are all the rows there are.
 */
export function Pagination<T>({
  state,
  noun = 'rows',
  className = '',
}: {
  state: PaginationState<T>;
  /** Plural noun for the count line, e.g. "accounts", "invoices". */
  noun?: string;
  className?: string;
}) {
  const { page, pageCount, total, from, to, setPage } = state;
  if (total === 0) return null;

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-line ${className}`}>
      <p className="text-[11.5px] text-muted">
        {pageCount > 1 ? (
          <>
            Showing <span className="num text-ink-2">{from}</span>–<span className="num text-ink-2">{to}</span> of{' '}
            <span className="num text-ink-2">{total}</span> {noun}
          </>
        ) : (
          <>
            <span className="num text-ink-2">{total}</span> {noun}
          </>
        )}
      </p>

      {pageCount > 1 && (
        <nav aria-label="Pagination" className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
            aria-label="Previous page"
            className={`${pageButton} border border-line text-ink-2 hover:bg-sunken hover:text-ink`}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {pageWindow(page, pageCount).map((entry, index) =>
            entry === 'gap' ? (
              <span key={`gap-${index}`} className="px-1 text-subtle text-[12px] select-none">
                …
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                onClick={() => setPage(entry)}
                aria-current={entry === page ? 'page' : undefined}
                aria-label={`Page ${entry}`}
                className={`${pageButton} ${
                  entry === page
                    ? 'bg-accent text-on-accent'
                    : 'border border-line text-ink-2 hover:bg-sunken hover:text-ink'
                }`}
              >
                {entry}
              </button>
            )
          )}

          <button
            type="button"
            onClick={() => setPage(page + 1)}
            disabled={page === pageCount}
            aria-label="Next page"
            className={`${pageButton} border border-line text-ink-2 hover:bg-sunken hover:text-ink`}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </nav>
      )}
    </div>
  );
}

export const TableWrap: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6">{children}</div>
);

/** Shared form-control look for the selects and search fields inside panels. */
export const controlClass =
  'bg-surface border border-line rounded-lg text-[12.5px] font-medium text-ink px-3 py-2 ' +
  'hover:border-line-strong transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent';
