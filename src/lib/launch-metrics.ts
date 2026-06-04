/**
 * Launch Metrics — telemetry data layer for the admin metrics dashboard.
 *
 * v1: returns mock numbers so the dashboard shipped on day one.
 * Post-launch: each `fetch*` function will be re-wired to the real
 * source (Clerk for signups/retention, RevenueCat for subscriptions,
 * an internal events table for activation/AI volume, Sentry for errors).
 *
 * The shape of the metric objects (LaunchMetric) is the contract — UI
 * code reads `value`, `trend`, `source`, etc. and doesn't care whether
 * the number came from a mock, a database, or a third-party API. Wiring
 * real data later is a one-function-at-a-time swap.
 */

export type MetricSource =
  | 'mock'
  | 'sentry'
  | 'clerk'
  | 'revenuecat'
  | 'internal-events'
  | 'unavailable';

export type MetricFormat = 'number' | 'percent' | 'currency' | 'text';

export type MetricTrendDirection = 'up' | 'down' | 'flat' | 'unknown';

export interface MetricTrend {
  /** Percent change vs. the previous comparable period. */
  changePercent: number;
  direction: MetricTrendDirection;
  /** Human label for the comparison window, e.g. "vs. yesterday". */
  comparedTo: string;
}

export interface LaunchMetric {
  /** Stable id for keying in lists. */
  id: string;
  /** Short label shown above the big number. */
  label: string;
  /** One-sentence explanation shown under the number. */
  description: string;
  /** The raw numeric value (or string for `text` format). */
  value: number | string;
  /** How to render `value`. */
  format: MetricFormat;
  /** Optional trend vs. a prior period. */
  trend?: MetricTrend;
  /** Where this number came from. `'mock'` means demo data. */
  source: MetricSource;
  /** ISO timestamp of when this metric was last fetched/computed. */
  lastUpdated: string;
}

export interface LaunchMetricsSnapshot {
  /** ISO timestamp for when the snapshot was assembled. */
  generatedAt: string;
  /** True when every metric is sourced from `'mock'`. */
  allMock: boolean;
  metrics: LaunchMetric[];
}

// ---------------------------------------------------------------------------
// Individual metric fetchers. Each one is the single point of change when
// real telemetry comes online.
// ---------------------------------------------------------------------------

function nowIso(): string {
  return new Date().toISOString();
}

function mockTrend(changePercent: number, comparedTo: string): MetricTrend {
  let direction: MetricTrendDirection = 'flat';
  if (changePercent > 0.5) direction = 'up';
  else if (changePercent < -0.5) direction = 'down';
  return { changePercent, direction, comparedTo };
}

/** Total signups this week. Wire to Clerk users API post-launch. */
export async function fetchSignupsThisWeek(): Promise<LaunchMetric> {
  return {
    id: 'signups-week',
    label: 'Signups this week',
    description: 'New accounts created in the last 7 days.',
    value: 0,
    format: 'number',
    trend: mockTrend(0, 'vs. last week'),
    source: 'mock',
    lastUpdated: nowIso(),
  };
}

/** Activation rate: % of signups who created an outline in their first session. */
export async function fetchActivationRate(): Promise<LaunchMetric> {
  return {
    id: 'activation-rate',
    label: 'Activation rate',
    description: 'Share of new signups who created an outline on day one.',
    value: 0,
    format: 'percent',
    trend: mockTrend(0, 'vs. last week'),
    source: 'mock',
    lastUpdated: nowIso(),
  };
}

/** Day-1 retention: % of signups who returned the next day. */
export async function fetchDay1Retention(): Promise<LaunchMetric> {
  return {
    id: 'day1-retention',
    label: 'Day-1 retention',
    description: 'Share of new signups who came back the next day.',
    value: 0,
    format: 'percent',
    trend: mockTrend(0, 'vs. last week'),
    source: 'mock',
    lastUpdated: nowIso(),
  };
}

/** Day-7 retention: % of signups who returned within 7 days. */
export async function fetchDay7Retention(): Promise<LaunchMetric> {
  return {
    id: 'day7-retention',
    label: 'Day-7 retention',
    description: 'Share of new signups who came back within a week.',
    value: 0,
    format: 'percent',
    trend: mockTrend(0, 'vs. last week'),
    source: 'mock',
    lastUpdated: nowIso(),
  };
}

/** Free to paid conversion rate. */
export async function fetchConversionRate(): Promise<LaunchMetric> {
  return {
    id: 'conversion-rate',
    label: 'Free to paid',
    description: 'Share of free users who upgraded to Student or Pro.',
    value: 0,
    format: 'percent',
    trend: mockTrend(0, 'vs. last week'),
    source: 'mock',
    lastUpdated: nowIso(),
  };
}

/** AI generations across all tiers in the last 24h. */
export async function fetchAiVolumeToday(): Promise<LaunchMetric> {
  return {
    id: 'ai-volume-today',
    label: 'AI runs today',
    description: 'Total AI generations across every tier in the last 24 hours.',
    value: 0,
    format: 'number',
    trend: mockTrend(0, 'vs. yesterday'),
    source: 'mock',
    lastUpdated: nowIso(),
  };
}

/** Monthly recurring revenue from active subscriptions. */
export async function fetchMrr(): Promise<LaunchMetric> {
  return {
    id: 'mrr',
    label: 'MRR',
    description: 'Monthly recurring revenue from active subscriptions.',
    value: 0,
    format: 'currency',
    trend: mockTrend(0, 'vs. last week'),
    source: 'mock',
    lastUpdated: nowIso(),
  };
}

// ---------------------------------------------------------------------------
// Snapshot assembler — what the page actually calls.
// ---------------------------------------------------------------------------

export async function fetchLaunchMetrics(): Promise<LaunchMetricsSnapshot> {
  const metrics = await Promise.all([
    fetchSignupsThisWeek(),
    fetchActivationRate(),
    fetchDay1Retention(),
    fetchDay7Retention(),
    fetchConversionRate(),
    fetchAiVolumeToday(),
    fetchMrr(),
  ]);

  return {
    generatedAt: nowIso(),
    allMock: metrics.every((m) => m.source === 'mock'),
    metrics,
  };
}

// ---------------------------------------------------------------------------
// Display helpers (used by the dashboard page).
// ---------------------------------------------------------------------------

export function formatMetricValue(metric: LaunchMetric): string {
  const { value, format } = metric;
  if (format === 'text') return String(value);
  if (typeof value !== 'number') return String(value);

  switch (format) {
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'currency':
      return value.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      });
    case 'number':
    default:
      return value.toLocaleString('en-US');
  }
}

export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.round((now - then) / 1000));
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}
