'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react';
import {
  fetchLaunchMetrics,
  formatMetricValue,
  formatRelativeTime,
  type LaunchMetric,
  type LaunchMetricsSnapshot,
} from '@/lib/launch-metrics';

const ADMIN_FLAG_KEY = 'isAdmin';

/**
 * Launch Metrics Dashboard — the at-a-glance launch-week vitals page.
 *
 * Gate: localStorage `isAdmin === 'true'`. This is a v1 stopgap until
 * real auth + role checks land (Clerk admin role, planned post-launch).
 * To enable on a machine: open DevTools console and run
 *   localStorage.setItem('isAdmin', 'true')
 * then reload.
 */
export default function AdminMetricsPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [snapshot, setSnapshot] = useState<LaunchMetricsSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Force the "last updated ... ago" string to recompute every minute so the
  // page never claims the data is fresher than it is.
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setIsAdmin(window.localStorage.getItem(ADMIN_FLAG_KEY) === 'true');
    } catch {
      setIsAdmin(false);
    }
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await fetchLaunchMetrics();
      setSnapshot(snap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metrics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      void reload();
    }
  }, [isAdmin, reload]);

  // Re-render every 60 seconds so "Last updated 2 min ago" stays honest.
  useEffect(() => {
    if (!isAdmin) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, [isAdmin]);

  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2 text-amber-600">
              <ShieldAlert className="h-5 w-5" />
              <CardTitle className="text-lg">Admin access required</CardTitle>
            </div>
            <CardDescription>
              This page is restricted to IdiamPro admins. If you are an admin,
              enable the admin flag on this device and reload.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Open the browser DevTools console and run{' '}
            <code className="text-xs px-1.5 py-0.5 rounded bg-muted">
              localStorage.setItem(&apos;isAdmin&apos;, &apos;true&apos;)
            </code>
            , then reload this page.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Launch Metrics
            </h1>
            <p className="text-muted-foreground mt-1">
              The launch-week vitals at a glance.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {snapshot && (
              <span
                className="text-xs text-muted-foreground"
                aria-live="polite"
              >
                Last updated {formatRelativeTime(snapshot.generatedAt)}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={reload}
              disabled={loading}
              aria-label="Refresh metrics"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
          </div>
        </header>

        {snapshot?.allMock && (
          <div
            role="status"
            className="mb-6 flex items-start gap-3 rounded-lg border border-amber-300/40 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-100"
          >
            <TriangleAlert className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <strong className="font-medium">Demo data.</strong> Real
              telemetry is not yet wired (Clerk, RevenueCat, and the events
              backend land post-launch). Every number below is a placeholder
              and will be replaced once those sources are connected.
            </div>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        {!snapshot && loading ? (
          <div className="text-muted-foreground">Loading metrics...</div>
        ) : snapshot ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {snapshot.metrics.map((metric) => (
              <MetricCard key={metric.id} metric={metric} />
            ))}
          </div>
        ) : null}

        <footer className="mt-12 text-xs text-muted-foreground">
          v1 admin dashboard. Restricted to internal use. Real data sources
          will be wired in after launch — see the &quot;launch-metrics&quot;
          module for the contract.
        </footer>
      </div>
    </div>
  );
}

function MetricCard({ metric }: { metric: LaunchMetric }) {
  const display = formatMetricValue(metric);
  const trend = metric.trend;
  const trendIcon =
    trend?.direction === 'up' ? (
      <ArrowUpRight className="h-3.5 w-3.5" />
    ) : trend?.direction === 'down' ? (
      <ArrowDownRight className="h-3.5 w-3.5" />
    ) : (
      <Minus className="h-3.5 w-3.5" />
    );

  const trendTone =
    trend?.direction === 'up'
      ? 'text-emerald-600 dark:text-emerald-400'
      : trend?.direction === 'down'
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-muted-foreground';

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {metric.label}
          </CardTitle>
          {metric.source === 'mock' && (
            <Badge
              variant="outline"
              className="text-[10px] uppercase tracking-wider font-normal"
            >
              Demo
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tracking-tight">{display}</div>
        {trend && (
          <div
            className={`mt-1 flex items-center gap-1 text-xs ${trendTone}`}
            aria-label={`Trend: ${trend.direction}, ${trend.changePercent}% ${trend.comparedTo}`}
          >
            {trendIcon}
            <span>
              {trend.changePercent === 0
                ? 'No change'
                : `${trend.changePercent > 0 ? '+' : ''}${trend.changePercent.toFixed(1)}%`}{' '}
              {trend.comparedTo}
            </span>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
          {metric.description}
        </p>
      </CardContent>
    </Card>
  );
}
