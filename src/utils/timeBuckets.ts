/**
 * Day / week / month / year bucketing — Requirements §4.1, §4.4, §4.6
 * ("not just daily", consistent across every view that shows a trend).
 */

import { MODULE_KEYS, ModuleKey } from '../config/pricing';
import { DailyModuleUsage, Granularity, ModuleQuantities, TrendBucket } from '../types/platform';

export const GRANULARITIES: Array<{ id: Granularity; label: string; short: string }> = [
  { id: 'day', label: 'Daily', short: 'D' },
  { id: 'week', label: 'Weekly', short: 'W' },
  { id: 'month', label: 'Monthly', short: 'M' },
  { id: 'year', label: 'Annual', short: 'Y' },
];

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toUtcDate(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

function isoDay(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Monday-anchored week start, in UTC. */
function weekStart(d: Date): Date {
  const copy = new Date(d.getTime());
  const dow = (copy.getUTCDay() + 6) % 7; // Mon = 0
  copy.setUTCDate(copy.getUTCDate() - dow);
  return copy;
}

function bucketKeyFor(day: string, granularity: Granularity): { key: string; start: Date; end: Date } {
  const d = toUtcDate(day);

  if (granularity === 'day') {
    return { key: isoDay(d), start: d, end: d };
  }
  if (granularity === 'week') {
    const start = weekStart(d);
    const end = new Date(start.getTime());
    end.setUTCDate(end.getUTCDate() + 6);
    return { key: isoDay(start), start, end };
  }
  if (granularity === 'month') {
    const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    return { key: `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}`, start, end };
  }
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), 11, 31));
  return { key: String(start.getUTCFullYear()), start, end };
}

function labelFor(start: Date, end: Date, granularity: Granularity): string {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (granularity === 'day') {
    return `${monthNames[start.getUTCMonth()]} ${start.getUTCDate()}`;
  }
  if (granularity === 'week') {
    return `${monthNames[start.getUTCMonth()]} ${start.getUTCDate()}–${
      start.getUTCMonth() === end.getUTCMonth() ? end.getUTCDate() : `${monthNames[end.getUTCMonth()]} ${end.getUTCDate()}`
    }`;
  }
  if (granularity === 'month') {
    return `${monthNames[start.getUTCMonth()]} ${start.getUTCFullYear()}`;
  }
  return String(start.getUTCFullYear());
}

function emptyQuantities(): ModuleQuantities {
  return { meeting_time: 0, kyc_count: 0, simulator: 0, proposal: 0 };
}

/** Sum daily points into day/week/month/year buckets, chronologically ordered. */
export function bucketDailyUsage(points: DailyModuleUsage[], granularity: Granularity): TrendBucket[] {
  const buckets = new Map<string, TrendBucket>();

  for (const point of points) {
    if (!point?.day) continue;
    const { key, start, end } = bucketKeyFor(point.day, granularity);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        ...emptyQuantities(),
        bucket: key,
        label: labelFor(start, end, granularity),
        start: isoDay(start),
        end: isoDay(end),
      };
      buckets.set(key, bucket);
    }
    for (const module of MODULE_KEYS) {
      bucket[module] += Number(point[module]) || 0;
    }
  }

  return [...buckets.values()].sort((a, b) => a.start.localeCompare(b.start));
}

/** Bucket an arbitrary numeric series (e.g. signups per day) on the same calendar rules. */
export function bucketCounts(
  byDay: Record<string, number>,
  granularity: Granularity
): Array<{ bucket: string; label: string; start: string; end: string; count: number }> {
  const buckets = new Map<string, { bucket: string; label: string; start: string; end: string; count: number }>();

  for (const [day, value] of Object.entries(byDay)) {
    const { key, start, end } = bucketKeyFor(day, granularity);
    const existing = buckets.get(key);
    if (existing) {
      existing.count += value;
    } else {
      buckets.set(key, {
        bucket: key,
        label: labelFor(start, end, granularity),
        start: isoDay(start),
        end: isoDay(end),
        count: value,
      });
    }
  }

  return [...buckets.values()].sort((a, b) => a.start.localeCompare(b.start));
}

export function sumQuantities(points: Array<Partial<Record<ModuleKey, number>>>): ModuleQuantities {
  const total = emptyQuantities();
  for (const point of points) {
    for (const module of MODULE_KEYS) {
      total[module] += Number(point[module]) || 0;
    }
  }
  return total;
}

/**
 * A window shorter than the bucket can't fill it — a 30-day window has no annual
 * bucket worth reading. Views use this to warn instead of drawing a lie.
 */
export function granularityWarning(granularity: Granularity, periodDays: number): string | null {
  if (granularity === 'year' && periodDays < 365) {
    return `Annual view over a ${periodDays}-day window shows one partial bucket. Switch the window to 365 days for a real annual read.`;
  }
  if (granularity === 'month' && periodDays < 60) {
    return `Monthly view over a ${periodDays}-day window gives 1–2 buckets, and the edge buckets are partial months.`;
  }
  return null;
}

export function monthsBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return 0;
  const days = (to.getTime() - from.getTime()) / 86_400_000;
  return days / 30.437; // average month length — good enough for tenure banding
}
