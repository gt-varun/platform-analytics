import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PeriodDays, UsageSummaryResponse } from './types/analytics';
import { Granularity, UserUsageResponse } from './types/platform';
import { fetchUsageSummary, ApiError } from './services/api';
import { fetchUserLevelUsage } from './services/platformData';
import { computeUserBilling, rollupUsers } from './utils/billing';
import { generateInsights } from './utils/insights';
// The PDF exporter drags in jsPDF and html2canvas (~390 kB). It is one button,
// gated to one role on one view, so it is fetched at click time rather than
// taxing every first paint.
import { ROLE_ORDER, RoleId, can } from './config/roles';
import { ViewId, defaultViewFor, isViewAllowed, visibleViews, VIEWS } from './config/views';

import {
  MobileNav,
  Sidebar,
  SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_COLLAPSED,
  clampSidebarWidth,
} from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { SkeletonLoader } from './components/SkeletonLoader';
import { ErrorState } from './components/ErrorState';
import { Toast } from './components/Toast';
import { Card, EmptyState } from './components/ui';
import { ViewContext } from './views/context';
import { ModulesView, OverviewView } from './views/OverviewView';
import { MyUsageView, RollupView, UsersView } from './views/UserViews';
import { BillingView, OverageView, PlansView } from './views/MoneyViews';
import { AccessView, DeliveryView } from './views/ProgrammeViews';

/** `?preview=off` hides the modelled per-user layer entirely (§6 honesty switch). */
function previewAllowed(): boolean {
  if (typeof window === 'undefined') return true;
  return new URLSearchParams(window.location.search).get('preview') !== 'off';
}

/** Role and view live in the URL so a reviewer can link straight to what they're commenting on. */
function readUrlState(): { role: RoleId; view: ViewId | null } {
  if (typeof window === 'undefined') return { role: 'management', view: null };
  const params = new URLSearchParams(window.location.search);
  const role = params.get('role') as RoleId | null;
  const view = params.get('view') as ViewId | null;
  const validRole = role && ROLE_ORDER.includes(role) ? role : 'management';
  const validView = view && VIEWS.some((candidate) => candidate.id === view) ? view : null;
  return { role: validRole, view: validView };
}

const SIDEBAR_STORAGE_KEY = 'analytics.sidebar.collapsed';
const SIDEBAR_WIDTH_STORAGE_KEY = 'analytics.sidebar.width';

function readStoredCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function readStoredWidth(): number {
  if (typeof window === 'undefined') return SIDEBAR_WIDTH;
  try {
    const stored = Number(window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY));
    // Clamped on read as well as on write: a stale value from an older build,
    // or a hand-edited one, must not be able to render an unusable rail.
    return Number.isFinite(stored) && stored > 0 ? clampSidebarWidth(stored) : SIDEBAR_WIDTH;
  } catch {
    return SIDEBAR_WIDTH;
  }
}

function writeUrlState(role: RoleId, view: ViewId): void {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  params.set('role', role);
  params.set('view', view);
  window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
}

export function App() {
  const [days, setDays] = useState<PeriodDays>(30);
  const [data, setData] = useState<UsageSummaryResponse | null>(null);
  const [userLayer, setUserLayer] = useState<UserUsageResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetching, setFetching] = useState<boolean>(false);
  const [error, setError] = useState<ApiError | null>(null);

  const initialUrlState = useMemo(readUrlState, []);
  const [role, setRole] = useState<RoleId>(initialUrlState.role);
  const [activeView, setActiveView] = useState<ViewId>(() => {
    const requested = initialUrlState.view;
    const view = requested ? VIEWS.find((candidate) => candidate.id === requested) : undefined;
    return view && isViewAllowed(view, initialUrlState.role) ? view.id : defaultViewFor(initialUrlState.role);
  });
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(readStoredCollapsed);
  const [sidebarWidth, setSidebarWidth] = useState<number>(readStoredWidth);
  const [sidebarResizing, setSidebarResizing] = useState<boolean>(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const [exportingPdf, setExportingPdf] = useState<boolean>(false);
  const [exportingExcel, setExportingExcel] = useState<boolean>(false);
  const [exportStatusText, setExportStatusText] = useState<string>('Generating Executive Report...');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<'error' | 'success'>('error');

  const usageTrendRef = useRef<HTMLDivElement | null>(null);
  const tierBreakdownRef = useRef<HTMLDivElement | null>(null);
  const providerBreakdownRef = useRef<HTMLDivElement | null>(null);
  const growthRef = useRef<HTMLDivElement | null>(null);

  const loadData = useCallback(async (selectedDays: PeriodDays, isManualRefresh = false) => {
    if (isManualRefresh) setFetching(true);
    else setLoading(true);
    setError(null);

    try {
      const summary = await fetchUsageSummary(selectedDays);
      setData(summary);
      // Per-user layer: real endpoint when it exists, reconciled preview until then.
      const layer = await fetchUserLevelUsage(selectedDays, summary, { allowPreview: previewAllowed() });
      setUserLayer(layer);
    } catch (err: unknown) {
      setError(err as ApiError);
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    loadData(days);
  }, [days, loadData]);

  useEffect(() => {
    writeUrlState(role, activeView);
  }, [role, activeView]);

  /**
   * Idempotent on purpose. The resize handler fires on every pointermove with a
   * `collapsed` value captured when the drag began, so a toggle would flip the
   * rail open and shut on every frame once it crossed the threshold. Setting an
   * explicit target state makes repeated calls harmless.
   */
  const setSidebarCollapsedPersisted = useCallback((next: boolean) => {
    setSidebarCollapsed((current) => {
      if (current === next) return current;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? '1' : '0');
      } catch {
        // Private browsing — the preference just won't survive a reload.
      }
      return next;
    });
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? '1' : '0');
      } catch {
        // Private browsing — the preference just won't survive a reload.
      }
      return next;
    });
  }, []);

  const handleSidebarWidth = useCallback((next: number) => {
    setSidebarWidth(next);
    try {
      window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(next));
    } catch {
      // Private browsing — the width just won't survive a reload.
    }
  }, []);

  // `[` toggles the rail, the way it does in most consoles with one. Guarded on
  // the focus target so it never fires while someone is typing in the account
  // search box — a shortcut that eats a keystroke mid-word is worse than none.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '[' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      event.preventDefault();
      toggleSidebar();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleSidebar]);

  const billings = useMemo(
    () => (userLayer ? userLayer.users.map((user) => computeUserBilling(user)) : []),
    [userLayer]
  );
  const rollup = useMemo(() => rollupUsers(billings), [billings]);

  const currentUser = useMemo(() => {
    if (billings.length === 0) return null;
    if (currentUserId) {
      const match = billings.find((billing) => billing.user.user_id === currentUserId);
      if (match) return match;
    }
    // Default to the account with the most to look at, so the layer is reviewable.
    return [...billings].sort((a, b) => b.totalOverageUsd - a.totalOverageUsd)[0];
  }, [billings, currentUserId]);

  const allowedViews = useMemo(() => visibleViews(role), [role]);

  const handleRoleChange = useCallback((nextRole: RoleId) => {
    setRole(nextRole);
    setSelectedUserId(null);
    setActiveView((current) => {
      const view = VIEWS.find((candidate) => candidate.id === current);
      return view && isViewAllowed(view, nextRole) ? current : defaultViewFor(nextRole);
    });
  }, []);

  const insights = useMemo(() => (data ? generateInsights(data) : []), [data]);

  const handleExportPdf = useCallback(async () => {
    if (!data) return;
    setExportingPdf(true);
    setExportStatusText('Preparing export…');
    try {
      const { generateExecutivePdfReport } = await import('./utils/pdfReportExporter');
      await generateExecutivePdfReport(
        data,
        insights,
        {
          usageTrend: usageTrendRef.current,
          tierBreakdown: tierBreakdownRef.current,
          providerBreakdown: providerBreakdownRef.current,
          growth: growthRef.current,
        },
        (status) => setExportStatusText(status)
      );
    } catch (err) {
      console.error('PDF export error:', err);
      setToastTone('error');
      setToastMessage('Unable to generate the PDF. Please try again.');
    } finally {
      setExportingPdf(false);
      // Reset, or the next export opens on the previous run's last status line.
      setExportStatusText('Generating Executive Report...');
    }
  }, [data, insights]);

  /**
   * The workbook counterpart to the PDF: same data, no narrative, every figure
   * left as a number so finance can pivot it. Role-gated inside the exporter —
   * see utils/excelExporter.ts.
   */
  const handleExportExcel = useCallback(async () => {
    if (!data || !userLayer) return;
    setExportingExcel(true);
    try {
      const { exportWorkbook } = await import('./utils/excelExporter');
      exportWorkbook({ summary: data, userLayer, billings, rollup, role, days, insights });
      setToastTone('success');
      setToastMessage('Workbook downloaded.');
    } catch (err) {
      console.error('Excel export error:', err);
      setToastTone('error');
      setToastMessage('Unable to build the workbook. Please try again.');
    } finally {
      setExportingExcel(false);
    }
  }, [data, userLayer, billings, rollup, role, days, insights]);

  const ctx: ViewContext | null = useMemo(() => {
    if (!data || !userLayer) return null;
    return {
      summary: data,
      userLayer,
      billings,
      rollup,
      role,
      days,
      granularity,
      onGranularityChange: setGranularity,
      currentUser,
      onCurrentUserChange: setCurrentUserId,
      selectedUserId,
      onSelectUser: setSelectedUserId,
      onNavigate: setActiveView,
    };
  }, [data, userLayer, billings, rollup, role, days, granularity, currentUser, selectedUserId]);

  const renderView = () => {
    if (!ctx) return null;
    const view = VIEWS.find((candidate) => candidate.id === activeView);
    if (!view || !isViewAllowed(view, role)) {
      return (
        <Card>
          <EmptyState
            title="Not available in this layer"
            description="The active role does not have permission for this view (§2). Pick another section above."
          />
        </Card>
      );
    }

    switch (activeView) {
      case 'overview':
        return (
          <OverviewView
            ctx={ctx}
            refs={{
              usageTrend: usageTrendRef,
              tierBreakdown: tierBreakdownRef,
              providerBreakdown: providerBreakdownRef,
              growth: growthRef,
            }}
          />
        );
      case 'my-usage':
        return <MyUsageView ctx={ctx} />;
      case 'users':
        return <UsersView ctx={ctx} />;
      case 'rollup':
        return <RollupView ctx={ctx} />;
      case 'modules':
        return <ModulesView ctx={ctx} />;
      case 'overage':
        return <OverageView ctx={ctx} />;
      case 'plans':
        return <PlansView ctx={ctx} />;
      case 'billing':
        return <BillingView ctx={ctx} />;
      case 'access':
        return <AccessView ctx={ctx} />;
      case 'delivery':
        return <DeliveryView ctx={ctx} />;
      default:
        return null;
    }
  };

  const activeViewDef = VIEWS.find((candidate) => candidate.id === activeView);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      {/* Keyboard users land on ten nav items before the figures otherwise. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-3 focus:py-2 focus:rounded-lg focus:bg-accent focus:text-on-accent focus:text-[12.5px] focus:font-semibold"
      >
        Skip to content
      </a>

      <Sidebar
        views={allowedViews}
        activeView={activeView}
        onViewChange={setActiveView}
        role={role}
        onRoleChange={handleRoleChange}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebar}
        onCollapsedChange={setSidebarCollapsedPersisted}
        width={sidebarWidth}
        onWidthChange={handleSidebarWidth}
        resizing={sidebarResizing}
        onResizingChange={setSidebarResizing}
      />

      {/*
        The offset is applied as a CSS variable rather than a Tailwind class so
        it can animate in step with the rail's own width transition, and so it
        stays zero below `lg` where the rail is replaced by the top nav.
      */}
      <div
        className={`lg:pl-(--rail) ${sidebarResizing ? '' : 'transition-[padding] duration-200 ease-out'}`}
        style={
          {
            '--rail': `${sidebarCollapsed ? SIDEBAR_WIDTH_COLLAPSED : sidebarWidth}px`,
          } as React.CSSProperties
        }
      >
        <MobileNav
          views={allowedViews}
          activeView={activeView}
          onViewChange={setActiveView}
          role={role}
          onRoleChange={handleRoleChange}
        />

        <Toolbar
          view={activeViewDef}
          days={days}
          onDaysChange={setDays}
          onRefresh={() => loadData(days, true)}
          onExportPdf={handleExportPdf}
          onExportExcel={handleExportExcel}
          isFetching={fetching}
          isExportingPdf={exportingPdf}
          isExportingExcel={exportingExcel}
          exportStatusText={exportStatusText}
          generatedAt={data?.generated_at}
          canExportPdf={can(role, 'export:report') && activeView === 'overview' && !!data}
          canExportExcel={can(role, 'export:report') && !!data && !!userLayer}
        />

        <main
          id="main"
          tabIndex={-1}
          aria-busy={loading || fetching}
          className="max-w-[1440px] mx-auto px-5 sm:px-8 py-6 pb-20 focus:outline-none"
        >
          {/* Keying on the view remounts the subtree, which is what re-triggers
              the entrance animation on every section change. */}
          {loading ? (
            <div className="animate-fade">
              <SkeletonLoader />
            </div>
          ) : error ? (
            <div className="animate-fade">
              <ErrorState error={error} onRetry={() => loadData(days)} />
            </div>
          ) : (
            <div key={activeView}>{renderView()}</div>
          )}
        </main>

        {/* Section changes are silent to a screen reader without this. */}
        <div aria-live="polite" className="sr-only">
          {loading ? 'Loading usage data' : `${activeViewDef?.label ?? 'Analytics'} ready`}
        </div>
      </div>

      {toastMessage && (
        <Toast message={toastMessage} type={toastTone} onClose={() => setToastMessage(null)} />
      )}
    </div>
  );
}

export default App;
