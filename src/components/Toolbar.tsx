import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  RefreshCw,
  Download,
  Loader2,
  Clock,
  ChevronDown,
  FileText,
  Sheet as SheetIcon,
} from 'lucide-react';
import { PeriodDays } from '../types/analytics';
import { formatRelativeTime } from '../utils/formatters';
import { ViewDefinition } from '../config/views';
import { Segmented } from './ui';

interface ToolbarProps {
  view: ViewDefinition | undefined;
  days: PeriodDays;
  onDaysChange: (days: PeriodDays) => void;
  onRefresh: () => void;
  onExportPdf: () => void;
  onExportExcel: () => void;
  isFetching: boolean;
  isExportingPdf: boolean;
  isExportingExcel: boolean;
  exportStatusText?: string;
  generatedAt?: string;
  /** PDF is the narrative report — it captures the charts on Overview, so it is
   *  offered there only. Elsewhere the item stays visible but disabled, which
   *  explains the restriction; a vanishing menu item just looks like a bug. */
  canExportPdf: boolean;
  /** The workbook is the whole dataset, so it is offered from every view. */
  canExportExcel: boolean;
}

const buttonBase =
  'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-[12.5px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-55 disabled:cursor-not-allowed';

/* ------------------------------------------------------------------ */
/* Export menu                                                         */
/* ------------------------------------------------------------------ */

interface ExportMenuProps {
  onExportPdf: () => void;
  onExportExcel: () => void;
  canExportPdf: boolean;
  canExportExcel: boolean;
  isExportingPdf: boolean;
  isExportingExcel: boolean;
  isFetching: boolean;
  exportStatusText: string;
}

/**
 * One Export control with the two formats behind it.
 *
 * They were separate buttons, which put two competing calls to action in the
 * toolbar and implied they were unrelated. They are the same intent — take this
 * away with me — differing only in format, so they belong under one trigger with
 * the choice made after the click, and each option carries a line saying what it
 * is actually for.
 */
const ExportMenu: React.FC<ExportMenuProps> = ({
  onExportPdf,
  onExportExcel,
  canExportPdf,
  canExportExcel,
  isExportingPdf,
  isExportingExcel,
  isFetching,
  exportStatusText,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const busy = isExportingPdf || isExportingExcel;
  const close = useCallback(() => setOpen(false), []);

  // Dismissal: anywhere outside, or Escape. Escape returns focus to the trigger
  // so the keyboard is never left stranded on a closed menu.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close]);

  // Opening moves focus into the menu so it is operable without a mouse.
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
  }, [open]);

  // An export that starts closes the menu — the trigger itself becomes the
  // progress indicator, so leaving the panel open would just obscure it.
  useEffect(() => {
    if (busy) setOpen(false);
  }, [busy]);

  /** Up/Down cycle the items; Home/End jump to the ends. */
  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? []
    );
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLButtonElement);

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = event.key === 'ArrowDown' ? index + 1 : index - 1;
      items[(next + items.length) % items.length].focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      items[0].focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      items[items.length - 1].focus();
    }
  };

  const run = (action: () => void) => {
    close();
    action();
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={isFetching || busy || !canExportExcel}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Download this data as a report or a spreadsheet"
        className={`${buttonBase} bg-accent text-on-accent hover:bg-accent-hover`}
      >
        {busy ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {isExportingPdf ? exportStatusText : 'Building workbook…'}
          </>
        ) : (
          <>
            <Download className="w-3.5 h-3.5" />
            Export
            <ChevronDown
              className={`w-3.5 h-3.5 -mr-0.5 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
            />
          </>
        )}
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Export format"
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 top-full mt-1.5 z-40 w-[286px] bg-surface border border-line rounded-card shadow-[0_8px_28px_rgba(14,33,56,0.14)] p-1.5 origin-top-right animate-menu"
        >
          <p className="label px-2.5 pt-1.5 pb-1">Download as</p>

          <button
            type="button"
            role="menuitem"
            onClick={() => run(onExportPdf)}
            disabled={!canExportPdf}
            className="w-full text-left flex items-start gap-2.5 px-2.5 py-2 rounded-lg transition-colors hover:bg-sunken focus:bg-sunken focus:outline-none disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed"
          >
            <FileText className="w-4 h-4 text-accent shrink-0 mt-px" />
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-ink">PDF report</span>
              <span className="block text-[11.5px] text-muted leading-snug mt-0.5">
                {canExportPdf
                  ? 'Executive summary with the charts on this page.'
                  : 'Available on Overview, where the charts it captures live.'}
              </span>
            </span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => run(onExportExcel)}
            disabled={!canExportExcel}
            className="w-full text-left flex items-start gap-2.5 px-2.5 py-2 rounded-lg transition-colors hover:bg-sunken focus:bg-sunken focus:outline-none disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed"
          >
            <SheetIcon className="w-4 h-4 text-positive shrink-0 mt-px" />
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-ink">Excel workbook</span>
              <span className="block text-[11.5px] text-muted leading-snug mt-0.5">
                Every figure as a number, ready to pivot.
              </span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Toolbar                                                             */
/* ------------------------------------------------------------------ */

export const Toolbar: React.FC<ToolbarProps> = ({
  view,
  days,
  onDaysChange,
  onRefresh,
  onExportPdf,
  onExportExcel,
  isFetching,
  isExportingPdf,
  isExportingExcel,
  exportStatusText = 'Generating…',
  generatedAt,
  canExportPdf,
  canExportExcel,
}) => (
  <header className="sticky top-0 z-20 bg-canvas/90 backdrop-blur-sm border-b border-line">
    <div className="max-w-[1440px] mx-auto px-5 sm:px-8 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[20px] font-semibold text-ink leading-tight">{view?.label ?? 'Analytics'}</h1>
        {view?.description && <p className="text-[13px] text-muted mt-0.5">{view.description}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {generatedAt && (
          <span className="hidden xl:inline-flex items-center gap-1.5 text-[12px] text-muted mr-1">
            <Clock className="w-3.5 h-3.5 text-subtle" />
            Updated {formatRelativeTime(generatedAt)}
          </span>
        )}

        <Segmented
          ariaLabel="Reporting window"
          options={[
            { id: '30', label: '30d' },
            { id: '90', label: '90d' },
            { id: '365', label: '12m' },
          ]}
          value={String(days)}
          onChange={(next) => onDaysChange(Number(next) as PeriodDays)}
          disabled={isFetching || isExportingPdf || isExportingExcel}
        />

        <button
          onClick={onRefresh}
          disabled={isFetching || isExportingPdf || isExportingExcel}
          className={`${buttonBase} border border-line bg-surface text-ink-2 hover:bg-sunken hover:text-ink`}
        >
          <RefreshCw className={`w-3.5 h-3.5 text-muted ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? 'Refreshing' : 'Refresh'}
        </button>

        {/* The whole control disappears for roles without `export:report`. */}
        {(canExportExcel || canExportPdf) && (
          <ExportMenu
            onExportPdf={onExportPdf}
            onExportExcel={onExportExcel}
            canExportPdf={canExportPdf}
            canExportExcel={canExportExcel}
            isExportingPdf={isExportingPdf}
            isExportingExcel={isExportingExcel}
            isFetching={isFetching}
            exportStatusText={exportStatusText}
          />
        )}
      </div>
    </div>
  </header>
);
