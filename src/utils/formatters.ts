/**
 * Utility functions for consistent data formatting across the dashboard.
 */

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPercent(rate: number): string {
  // If rate is given as a fraction e.g. 0.0909 -> 9.1%
  const percentValue = rate <= 1 && rate > 0 ? rate * 100 : rate;
  return `${percentValue.toFixed(1)}%`;
}

export function formatCompactNumber(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toLocaleString('en-US');
}

/**
 * @deprecated Use `formatDuration`. Kept as an alias so every remaining call
 * site (the PDF export, the legacy donut tooltip) picks up the days/hours/
 * minutes format rather than quietly staying on hours-only.
 */
export function formatMeetingTime(seconds: number): string {
  return formatDuration(seconds);
}

export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  } catch {
    return dateString;
  }
}

export function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 10) return 'Just now';
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    return `${diffInHours}h ago`;
  } catch {
    return 'Recently';
  }
}

const MINUTE = 60;
const HOUR = 3600;
const DAY = 86_400;

/**
 * §5.2 — average duration values were rendered as raw seconds (e.g. "519,663"),
 * which reads as nonsense.
 *
 * Durations step down through days, hours and minutes, and only ever show the
 * units that carry information: 2,700 hours of meetings is "114d 6h 20m", not a
 * four-digit hour count nobody can picture. Trailing zero units are kept when a
 * larger unit is present so columns stay the same shape down a table.
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0m';
  if (seconds < MINUTE) return `${Math.round(seconds)}s`;

  const totalMinutes = Math.round(seconds / MINUTE);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days.toLocaleString()}d ${hours}h ${minutes.toString().padStart(2, '0')}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  }
  return `${minutes}m`;
}

/** Long form for tooltips and prose that need the units spelled out. */
export function formatDurationLong(seconds: number): string {
  if (!seconds || seconds <= 0) return '0 minutes';

  const totalMinutes = Math.round(seconds / MINUTE);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days.toLocaleString()} day${days === 1 ? '' : 's'}`);
  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  // Once we're into days, minutes are noise.
  if (minutes > 0 && days === 0) parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
  return parts.join(' ') || '0 minutes';
}

export type DurationUnit = 'day' | 'hour' | 'minute';

/**
 * Axis ticks have to share one unit across the whole scale — a scale reading
 * "23h, 2d, 3d" is unreadable. Pick the unit once from the domain, then format
 * every tick in it.
 */
export function durationAxisUnit(maxSeconds: number): DurationUnit {
  if (maxSeconds >= 2 * DAY) return 'day';
  if (maxSeconds >= 2 * HOUR) return 'hour';
  return 'minute';
}

export function formatDurationAxis(seconds: number, unit: DurationUnit): string {
  if (unit === 'day') {
    const days = seconds / DAY;
    return `${days < 10 ? Math.round(days * 10) / 10 : Math.round(days)}d`;
  }
  if (unit === 'hour') {
    const hours = seconds / HOUR;
    return `${hours < 10 ? Math.round(hours * 10) / 10 : Math.round(hours)}h`;
  }
  return `${Math.round(seconds / MINUTE)}m`;
}

/** Render a quantity in a module's own units: duration for meetings, counts elsewhere. */
export function formatModuleValue(value: number, sourceUnit: 'seconds' | 'count'): string {
  if (sourceUnit === 'seconds') return formatDuration(value);
  const rounded = Math.round(value * 100) / 100;
  return rounded.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function formatCredits(usd: number): string {
  const credits = Math.round(usd * 10) / 10;
  return `${credits.toLocaleString('en-US', { maximumFractionDigits: 1 })} cr`;
}

export function formatMonths(months: number): string {
  if (months < 1) {
    const days = Math.max(0, Math.round(months * 30.437));
    return `${days}d`;
  }
  return `${months.toFixed(months < 10 ? 1 : 0)} mo`;
}

export function formatFeatureName(key: string): string {
  switch (key) {
    case 'meeting_time':
      return 'Meeting Time';
    case 'kyc_count':
      return 'KYC Checks';
    case 'simulator':
      return 'Simulator';
    case 'proposal':
      return 'Proposal';
    default:
      return key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  }
}
