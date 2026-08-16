import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { MODULES, ModuleKey, TIERS, TierId } from '../config/pricing';
import { ROLES, RoleId } from '../config/roles';

/**
 * Light and dark are two designed palettes, not one inverted.
 *
 * The light theme is paper: white cards, hairline rules, deep navy ink.
 * The dark theme is instrument glass: a deep blue-charcoal ground where
 * elevation is carried by lightness rather than shadow, ink warmed off pure
 * white, and series colours re-picked so they hold contrast against the dark
 * surface (a navy that reads well on paper disappears on it).
 *
 * Surfaces live in CSS custom properties (src/index.css). Series colours are
 * resolved here in JS because charts, meters and badges need concrete values —
 * SVG attributes and alpha maths can't take a `var()`.
 */

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'analytics.theme';

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'system',
  resolved: 'light',
  setMode: () => {},
});

function systemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function isMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

function readStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  // `?theme=dark` wins for the session, so a review link can pin the appearance
  // it was written against.
  const fromUrl = new URLSearchParams(window.location.search).get('theme');
  if (isMode(fromUrl)) return fromUrl;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isMode(stored) ? stored : 'system';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);
  const [systemResolved, setSystemResolved] = useState<ResolvedTheme>(systemTheme);

  // Follow the OS while the mode is "system".
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => setSystemResolved(event.matches ? 'dark' : 'light');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const resolved: ResolvedTheme = mode === 'system' ? systemResolved : mode;

  useEffect(() => {
    const root = document.documentElement;
    if (mode === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', mode);
    root.style.colorScheme = resolved;
  }, [mode, resolved]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing — the choice just won't survive a reload.
    }
  }, []);

  const value = useMemo(() => ({ mode, resolved, setMode }), [mode, resolved, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/* ------------------------------------------------------------------ */
/* Resolved palette                                                    */
/* ------------------------------------------------------------------ */

export interface ChartChrome {
  grid: string;
  axisLine: string;
  axisTick: string;
  /** Status colour for the billable segment and the allowance rule. */
  overage: string;
  tooltipBg: string;
  tooltipBorder: string;
  cursor: string;
  donutStroke: string;
  growth: string;
}

const CHART_CHROME: Record<ResolvedTheme, ChartChrome> = {
  light: {
    grid: '#e6ebf1',
    axisLine: '#c9d4de',
    axisTick: '#6b7c8e',
    overage: '#b3261e',
    tooltipBg: '#ffffff',
    tooltipBorder: '#e2e8ee',
    cursor: 'rgba(31,80,144,0.06)',
    donutStroke: '#ffffff',
    growth: '#178a5b',
  },
  dark: {
    grid: '#1e2a38',
    axisLine: '#2c3a4b',
    axisTick: '#8494a5',
    overage: '#f08279',
    tooltipBg: '#16202d',
    tooltipBorder: '#263344',
    cursor: 'rgba(132,169,255,0.10)',
    donutStroke: '#121a25',
    growth: '#31a883',
  },
};

export interface Palette {
  theme: ResolvedTheme;
  module: (key: ModuleKey) => string;
  tier: (id: TierId) => string;
  role: (id: RoleId) => string;
  chart: ChartChrome;
}

export function paletteFor(theme: ResolvedTheme): Palette {
  const pick = (light: string, dark: string) => (theme === 'dark' ? dark : light);
  return {
    theme,
    module: (key) => pick(MODULES[key].color, MODULES[key].colorDark),
    tier: (id) => pick(TIERS[id].color, TIERS[id].colorDark),
    role: (id) => pick(ROLES[id].color, ROLES[id].colorDark),
    chart: CHART_CHROME[theme],
  };
}

export function usePalette(): Palette {
  const { resolved } = useTheme();
  return useMemo(() => paletteFor(resolved), [resolved]);
}

/* ------------------------------------------------------------------ */
/* Control                                                             */
/* ------------------------------------------------------------------ */

const OPTIONS: Array<{ id: ThemeMode; label: string; icon: React.ReactNode }> = [
  { id: 'light', label: 'Light', icon: <Sun className="w-3.5 h-3.5" /> },
  { id: 'dark', label: 'Dark', icon: <Moon className="w-3.5 h-3.5" /> },
  { id: 'system', label: 'Auto', icon: <Monitor className="w-3.5 h-3.5" /> },
];

export const ThemeToggle: React.FC<{ compact?: boolean; vertical?: boolean }> = ({
  compact = false,
  vertical = false,
}) => {
  const { mode, setMode } = useTheme();

  return (
    <div
      role="group"
      aria-label="Appearance"
      className={`bg-sunken p-0.5 rounded-lg border border-line inline-flex items-center ${
        vertical ? 'flex-col' : ''
      }`}
    >
      {OPTIONS.map((option) => {
        const active = mode === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => setMode(option.id)}
            aria-pressed={active}
            title={`${option.label} appearance`}
            className={`inline-flex items-center justify-center gap-1.5 rounded-md transition-colors duration-150 ${
              compact ? 'px-2 py-1.5' : 'px-2.5 py-1.5 flex-1'
            } ${vertical ? 'w-full' : ''} text-[12px] font-semibold ${
              active
                ? 'bg-surface text-ink border border-line'
                : 'text-muted hover:text-ink border border-transparent'
            }`}
          >
            {option.icon}
            {!compact && <span>{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
};
