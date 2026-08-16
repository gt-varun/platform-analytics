import React from 'react';
import {
  LayoutDashboard,
  UserRound,
  Users,
  Layers,
  Gauge,
  CreditCard,
  Building2,
  KeyRound,
  ClipboardList,
  ChevronDown,
  Activity,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { ROLES, ROLE_ORDER, RoleId } from '../config/roles';
import { ViewDefinition, ViewId } from '../config/views';
import { ThemeToggle, usePalette } from '../theme';

export const VIEW_ICONS: Record<ViewId, React.ReactNode> = {
  overview: <LayoutDashboard className="w-4 h-4" />,
  'my-usage': <UserRound className="w-4 h-4" />,
  users: <Users className="w-4 h-4" />,
  rollup: <Layers className="w-4 h-4" />,
  modules: <Activity className="w-4 h-4" />,
  overage: <Gauge className="w-4 h-4" />,
  plans: <CreditCard className="w-4 h-4" />,
  billing: <Building2 className="w-4 h-4" />,
  access: <KeyRound className="w-4 h-4" />,
  delivery: <ClipboardList className="w-4 h-4" />,
};

const GROUP_LABELS: Record<ViewDefinition['group'], string> = {
  Usage: 'Usage',
  Money: 'Billing',
  Programme: 'Programme',
};

export const SIDEBAR_WIDTH = 252;
export const SIDEBAR_WIDTH_COLLAPSED = 68;
/** Below this the labels start truncating, so the rail stops shrinking. */
export const SIDEBAR_WIDTH_MIN = 196;
export const SIDEBAR_WIDTH_MAX = 420;
/** Drag past this and the rail collapses rather than becoming a useless sliver. */
const COLLAPSE_THRESHOLD = 150;

export function clampSidebarWidth(width: number): number {
  return Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, Math.round(width)));
}

interface SidebarProps {
  views: ViewDefinition[];
  activeView: ViewId;
  onViewChange: (view: ViewId) => void;
  role: RoleId;
  onRoleChange: (role: RoleId) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onCollapsedChange: (collapsed: boolean) => void;
  width: number;
  onWidthChange: (width: number) => void;
  onResizingChange: (resizing: boolean) => void;
  resizing: boolean;
}

/**
 * The drag handle for resizing the rail.
 *
 * It is a 9px hit area straddling the border — comfortably grabbable — but only
 * a 2px line ever paints, and only on hover or while dragging, so the chrome
 * stays as quiet as the rest of the rail. The whole thing is a `separator` with
 * arrow-key support, because a resize that only works by mouse is a resize half
 * the people using this cannot reach.
 */
const ResizeHandle: React.FC<{
  width: number;
  collapsed: boolean;
  resizing: boolean;
  onWidthChange: (width: number) => void;
  onResizingChange: (resizing: boolean) => void;
  /** Idempotent — called on every pointermove, so it must not toggle. */
  onCollapsedChange: (collapsed: boolean) => void;
  onReset: () => void;
}> = ({ width, collapsed, resizing, onWidthChange, onResizingChange, onCollapsedChange, onReset }) => {
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    onResizingChange(true);

    // Held on the body for the duration: without these the cursor flickers back
    // to a text caret whenever the pointer crosses the content, and dragging
    // selects the text it passes over.
    const previousCursor = document.body.style.cursor;
    const previousSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (moveEvent: PointerEvent) => {
      const next = moveEvent.clientX;
      if (next < COLLAPSE_THRESHOLD) {
        onCollapsedChange(true);
        return;
      }
      onCollapsedChange(false);
      onWidthChange(clampSidebarWidth(next));
    };

    const onUp = () => {
      onResizingChange(false);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousSelect;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 32 : 8;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (collapsed) return;
      if (width - step < COLLAPSE_THRESHOLD) onCollapsedChange(true);
      else onWidthChange(clampSidebarWidth(width - step));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      if (collapsed) onCollapsedChange(false);
      else onWidthChange(clampSidebarWidth(width + step));
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onReset();
    }
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuenow={collapsed ? SIDEBAR_WIDTH_COLLAPSED : width}
      aria-valuemin={SIDEBAR_WIDTH_MIN}
      aria-valuemax={SIDEBAR_WIDTH_MAX}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onDoubleClick={onReset}
      title="Drag to resize · double-click to reset"
      className="hidden lg:block absolute inset-y-0 -right-1 w-2 z-40 cursor-col-resize group"
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 transition-colors duration-150 ${
          resizing ? 'bg-accent' : 'bg-transparent group-hover:bg-accent-line'
        }`}
      />
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({
  views,
  activeView,
  onViewChange,
  role,
  onRoleChange,
  collapsed,
  onToggleCollapsed,
  onCollapsedChange,
  width,
  onWidthChange,
  onResizingChange,
  resizing,
}) => {
  const groups: Array<ViewDefinition['group']> = ['Usage', 'Money', 'Programme'];
  const activeRole = ROLES[role];
  const palette = usePalette();

  return (
    <aside
      // The width transition is suppressed while dragging — an eased width can
      // not keep up with a pointer, so the edge visibly lags behind the cursor.
      className={`hidden lg:flex fixed inset-y-0 left-0 flex-col bg-surface border-r border-line z-30 ${
        resizing ? '' : 'transition-[width] duration-200 ease-out'
      }`}
      style={{ width: collapsed ? SIDEBAR_WIDTH_COLLAPSED : width }}
    >
      <ResizeHandle
        width={width}
        collapsed={collapsed}
        resizing={resizing}
        onWidthChange={onWidthChange}
        onResizingChange={onResizingChange}
        onCollapsedChange={onCollapsedChange}
        onReset={() => {
          onCollapsedChange(false);
          onWidthChange(SIDEBAR_WIDTH);
        }}
      />
      {/*
        Brand + the rail toggle. Collapsed, the mark alone carries the brand —
        the wordmark would only truncate, and a clipped word reads as a
        rendering fault. The toggle lives up here in both states so the control
        that reopens the rail is always in the same place as the one that shut
        it; at 68px there is no room for it beside the mark, so it stacks under.
      */}
      <div className={`border-b border-line ${collapsed ? 'px-2.5 py-3' : 'px-5 py-5'}`}>
        <div className={`flex gap-2.5 ${collapsed ? 'flex-col items-center' : 'items-center'}`}>
          <span
            className="w-7 h-7 rounded-md bg-accent text-on-accent flex items-center justify-center text-[13px] font-bold shrink-0"
            aria-hidden="true"
          >
            A
          </span>
          {!collapsed && (
            <div className="leading-tight min-w-0">
              <p className="text-[14px] font-semibold text-ink truncate">Analytics</p>
              <p className="text-[11.5px] text-muted truncate">Usage &amp; billing console</p>
            </div>
          )}

          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={`${collapsed ? 'Expand' : 'Collapse'} sidebar  ( [ )`}
            className={`shrink-0 w-7 h-7 inline-flex items-center justify-center rounded-md text-muted hover:text-ink hover:bg-sunken transition-colors ${
              collapsed ? '' : 'ml-auto'
            }`}
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav
        className={`flex-1 overflow-y-auto overflow-x-hidden py-4 flex flex-col gap-5 ${collapsed ? 'px-2.5' : 'px-3'}`}
        aria-label="Sections"
      >
        {groups.map((group) => {
          const groupViews = views.filter((view) => view.group === group);
          if (groupViews.length === 0) return null;
          return (
            <div key={group} className="flex flex-col gap-0.5">
              {/* Collapsed, the group label becomes a rule: the grouping is still
                  legible, but there is no room for a word that would truncate. */}
              {collapsed ? (
                <div className="mx-2 mb-1.5 border-t border-line" aria-hidden="true" />
              ) : (
                <p className="label px-2 mb-1">{GROUP_LABELS[group]}</p>
              )}
              {groupViews.map((view) => {
                const active = activeView === view.id;
                return (
                  <button
                    key={view.id}
                    onClick={() => onViewChange(view.id)}
                    // Collapsed there is no visible label, so the tooltip has to
                    // carry the name, not just the description.
                    title={collapsed ? `${view.label} — ${view.description}` : view.description}
                    aria-label={collapsed ? view.label : undefined}
                    aria-current={active ? 'page' : undefined}
                    className={`group relative flex items-center rounded-lg text-[13.5px] font-medium text-left transition-colors duration-150 ${
                      collapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-2.5 py-2'
                    } ${
                      active
                        ? 'bg-accent-tint text-accent font-semibold'
                        : 'text-ink-2 hover:bg-sunken hover:text-ink'
                    }`}
                  >
                    {/* The active marker grows out of the rail edge rather than
                        appearing, so the eye can follow the section change. */}
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-accent origin-center animate-fade"
                      />
                    )}
                    <span className={`shrink-0 ${active ? 'text-accent' : 'text-subtle group-hover:text-muted'}`}>
                      {VIEW_ICONS[view.id]}
                    </span>
                    {!collapsed && <span className="truncate">{view.label}</span>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Layer switcher — */}
      <div className={`border-t border-line ${collapsed ? 'p-2.5' : 'p-3'}`}>
        {collapsed ? (
          <>
            {/*
              A <select> cannot shrink to 44px and stay usable, so collapsed it
              becomes a role swatch that expands the rail on click — the change
              is still one gesture away, and the current layer is still visible.
            */}
            <button
              type="button"
              onClick={onToggleCollapsed}
              title={`Viewing as ${activeRole.label} — expand to change`}
              aria-label={`Viewing as ${activeRole.label}. Expand sidebar to change.`}
              className="w-full flex items-center justify-center py-2 rounded-lg border border-line bg-sunken hover:border-line-strong transition-colors"
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: palette.role(role) }}
              />
            </button>
            <div className="mt-2.5 pt-2.5 border-t border-line flex justify-center">
              <ThemeToggle compact vertical />
            </div>
          </>
        ) : (
          <>
            <label htmlFor="role-switcher" className="label px-1">
              Viewing as
            </label>
            <div className="relative mt-1.5">
              <select
                id="role-switcher"
                value={role}
                onChange={(event) => onRoleChange(event.target.value as RoleId)}
                className="w-full appearance-none bg-sunken border border-line rounded-lg pl-8 pr-8 py-2 text-[13px] font-semibold text-ink cursor-pointer hover:border-line-strong transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30"
              >
                {ROLE_ORDER.map((id) => (
                  <option key={id} value={id}>
                    {ROLES[id].label}
                  </option>
                ))}
              </select>
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full pointer-events-none"
                style={{ backgroundColor: palette.role(role) }}
              />
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
            </div>
            <p className="text-[11.5px] text-muted leading-snug mt-2 px-1">{activeRole.scopeNote}</p>

            <div className="mt-3 pt-3 border-t border-line">
              <p className="label px-1 mb-1.5">Appearance</p>
              <ThemeToggle />
            </div>
          </>
        )}

      </div>
    </aside>
  );
};

/** Horizontal section nav for narrow screens, where the rail is hidden. */
export const MobileNav: React.FC<{
  views: ViewDefinition[];
  activeView: ViewId;
  onViewChange: (view: ViewId) => void;
  role: RoleId;
  onRoleChange: (role: RoleId) => void;
}> = ({ views, activeView, onViewChange, role, onRoleChange }) => (
  <div className="lg:hidden border-b border-line bg-surface">
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded bg-accent text-on-accent flex items-center justify-center text-[11px] font-bold">
          A
        </span>
        <span className="text-[14px] font-semibold text-ink">Analytics</span>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle compact />
        <select
          value={role}
          onChange={(event) => onRoleChange(event.target.value as RoleId)}
          aria-label="Viewing as"
          className="bg-sunken border border-line rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-ink"
        >
          {ROLE_ORDER.map((id) => (
            <option key={id} value={id}>
              {ROLES[id].label}
            </option>
          ))}
        </select>
      </div>
    </div>
    <div className="flex gap-1 overflow-x-auto px-3 pb-2">
      {views.map((view) => (
        <button
          key={view.id}
          onClick={() => onViewChange(view.id)}
          aria-current={activeView === view.id ? 'page' : undefined}
          className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-[12.5px] font-medium ${
            activeView === view.id ? 'bg-accent-tint text-accent font-semibold' : 'text-muted hover:bg-sunken'
          }`}
        >
          {view.label}
        </button>
      ))}
    </div>
  </div>
);
