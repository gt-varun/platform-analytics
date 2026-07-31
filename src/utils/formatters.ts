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

export function formatMeetingTime(seconds: number): string {
  if (!seconds || seconds <= 0) return '0m';
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours.toLocaleString()}h ${minutes}m`;
  }
  return `${minutes}m`;
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
