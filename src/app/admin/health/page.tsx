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
import { RefreshCw, ShieldAlert } from 'lucide-react';

const ADMIN_FLAG_KEY = 'isAdmin';

type HealthStatus = 'ok' | 'degraded' | 'down' | 'not_configured';

interface DependencyHealth {
  name: string;
  category: string;
  status: HealthStatus;
  latencyMs: number;
  detail: string;
  checkedAt: string;
}

interface HealthResponse {
  generatedAt: string;
  results: DependencyHealth[];
}

/**
 * Dependency Health Monitor — the admin-only board showing whether each of the
 * app's own third-party dependencies is reachable/healthy.
 *
 * Gate: localStorage `isAdmin === 'true'` (same v1 stopgap as /admin/metrics,
 * until Clerk admin roles land). The actual probes run server-side via
 * /api/admin/dependency-health — no secret ever reaches the browser.
 */
export default function AdminHealthPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const resp = await fetch('/api/admin/dependency-health', { cache: 'no-store' });
      if (!resp.ok) {
        throw new Error(`Health check failed (HTTP ${resp.status}).`);
      }
      const json = (await resp.json()) as HealthResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run health check.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      void reload();
    }
  }, [isAdmin, reload]);

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

  const results = data?.results ?? [];
  const counts = summarize(results);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Dependency Health
            </h1>
            <p className="text-muted-foreground mt-1">
              Live reachability of our own third-party services. Private to
              admins — never shown to users.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {data && (
              <span className="text-xs text-muted-foreground" aria-live="polite">
                Checked {formatTime(data.generatedAt)}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={reload}
              disabled={loading}
              aria-label="Run health check now"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Run check now
            </Button>
          </div>
        </header>

        {results.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2 text-xs">
            <SummaryPill label="OK" count={counts.ok} status="ok" />
            <SummaryPill label="Degraded" count={counts.degraded} status="degraded" />
            <SummaryPill label="Down" count={counts.down} status="down" />
            <SummaryPill label="Not configured" count={counts.not_configured} status="not_configured" />
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

        {!data && loading ? (
          <div className="text-muted-foreground">Running checks...</div>
        ) : results.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {results.map((r) => (
              <HealthCard key={r.name} row={r} />
            ))}
          </div>
        ) : (
          !error && <div className="text-muted-foreground">No results yet.</div>
        )}

        <footer className="mt-12 text-xs text-muted-foreground leading-relaxed">
          Each probe is a cheap reachability/auth ping — never an AI generation
          or anything that spends money. Unconfigured services show as grey and
          are skipped. An hourly background sweep privately emails Howard if
          anything goes amber or red.
        </footer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Presentation helpers
// ---------------------------------------------------------------------------

const STATUS_META: Record<
  HealthStatus,
  { label: string; dot: string; text: string; ring: string }
> = {
  ok: {
    label: 'OK',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-400',
    ring: 'border-emerald-500/30',
  },
  degraded: {
    label: 'Degraded',
    dot: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-400',
    ring: 'border-amber-500/40',
  },
  down: {
    label: 'Down',
    dot: 'bg-rose-500',
    text: 'text-rose-700 dark:text-rose-400',
    ring: 'border-rose-500/40',
  },
  not_configured: {
    label: 'Not configured',
    dot: 'bg-muted-foreground/40',
    text: 'text-muted-foreground',
    ring: 'border-border',
  },
};

function HealthCard({ row }: { row: DependencyHealth }) {
  const meta = STATUS_META[row.status];
  return (
    <Card className={`border ${meta.ring}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold truncate">
              {row.name}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{row.category}</p>
          </div>
          <div className={`flex items-center gap-1.5 flex-shrink-0 ${meta.text}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} aria-hidden />
            <span className="text-xs font-medium whitespace-nowrap">{meta.label}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-foreground/80 break-words">{row.detail}</p>
        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          {row.status !== 'not_configured' && <span>{row.latencyMs} ms</span>}
          <span>checked {formatTime(row.checkedAt)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryPill({
  label,
  count,
  status,
}: {
  label: string;
  count: number;
  status: HealthStatus;
}) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 ${meta.ring} ${meta.text}`}
    >
      <span className={`h-2 w-2 rounded-full ${meta.dot}`} aria-hidden />
      {count} {label}
    </span>
  );
}

function summarize(rows: DependencyHealth[]): Record<HealthStatus, number> {
  const counts: Record<HealthStatus, number> = {
    ok: 0,
    degraded: 0,
    down: 0,
    not_configured: 0,
  };
  for (const r of rows) counts[r.status] += 1;
  return counts;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}
