'use client';

/**
 * /admin/bugs — review and triage in-app bug reports.
 *
 * Mirror of /admin/applicants and /admin/feedback. Sections grouped by
 * status: New (default open), Acknowledged, In Progress, Resolved,
 * Won't Fix (collapsed by default).
 *
 * Each row shows severity badge, timestamp, reporter email, and a
 * description preview. Clicking "View details" opens a modal with the
 * full description, context, screenshot (if any), metadata, and the
 * status action buttons.
 *
 * Gate: localStorage `isAdmin === 'true'`. Server-side endpoints also
 * check the `x-idiampro-admin` header, so the page passes that on every
 * fetch — same v1 pattern as the other admin pages.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  RefreshCw,
  Search,
  ShieldAlert,
  XCircle,
} from 'lucide-react';

const ADMIN_FLAG_KEY = 'isAdmin';
const ADMIN_HEADER_NAME = 'x-idiampro-admin';
const ADMIN_HEADER_VALUE = 'true';

type BugSeverity = 'fyi' | 'annoying' | 'blocking';
type BugStatus = 'new' | 'acknowledged' | 'in_progress' | 'resolved' | 'wont_fix';

interface BugMetadata {
  url: string;
  userAgent: string;
  outlineName: string | null;
  timestamp: string;
}

interface BugListItem {
  id: string;
  createdAt: string;
  description: string;
  context?: string;
  severity: BugSeverity;
  userEmail: string | null;
  userId: string | null;
  metadata: BugMetadata;
  status: BugStatus;
  hasScreenshot: boolean;
  notes?: string;
  /** Internal-only progress notes. Admin sees and edits this. */
  progressNotes?: string;
}

interface FullBug extends Omit<BugListItem, 'hasScreenshot'> {
  screenshotBase64: string | null;
}

const STATUS_SECTIONS: { key: BugStatus; label: string; defaultOpen: boolean }[] = [
  { key: 'new', label: 'New', defaultOpen: true },
  { key: 'acknowledged', label: 'Acknowledged', defaultOpen: true },
  { key: 'in_progress', label: 'In progress', defaultOpen: true },
  { key: 'resolved', label: 'Resolved', defaultOpen: false },
  { key: 'wont_fix', label: "Won't fix", defaultOpen: false },
];

const SEVERITY_META: Record<BugSeverity, { label: string; tone: string }> = {
  blocking: {
    label: 'Blocking',
    tone: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300',
  },
  annoying: {
    label: 'Annoying',
    tone: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  },
  fyi: {
    label: 'FYI',
    tone: 'bg-slate-100 text-slate-800 dark:bg-slate-800/60 dark:text-slate-200',
  },
};

function adminHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    [ADMIN_HEADER_NAME]: ADMIN_HEADER_VALUE,
  };
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function preview(text: string, max = 100): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return t.slice(0, max).trimEnd() + '...';
}

export default function AdminBugsPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [bugs, setBugs] = useState<BugListItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [openSections, setOpenSections] = useState<Record<BugStatus, boolean>>({
    new: true,
    acknowledged: true,
    in_progress: true,
    resolved: false,
    wont_fix: false,
  });
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FullBug | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  // Progress-notes editor state. Edited locally, persisted on Save click.
  const [notesDraft, setNotesDraft] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setIsAdmin(window.localStorage.getItem(ADMIN_FLAG_KEY) === 'true');
    } catch {
      setIsAdmin(false);
    }
    const params = new URLSearchParams(window.location.search);
    const focus = params.get('focus');
    if (focus) setFocusedId(focus);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/bugs/list', { headers: adminHeaders() });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Failed to load (HTTP ${res.status}).`);
      }
      const data = (await res.json()) as { bugs?: BugListItem[] };
      setBugs(data.bugs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bug reports.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void reload();
  }, [isAdmin, reload]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 4_000);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Auto-open the bug if ?focus=<id> was supplied and we have the record now.
  useEffect(() => {
    if (!focusedId || !bugs) return;
    const target = bugs.find((b) => b.id === focusedId);
    if (target) {
      void openDetail(target.id);
      setFocusedId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedId, bugs]);

  const filtered = useMemo(() => {
    if (!bugs) return null;
    const q = search.trim().toLowerCase();
    if (!q) return bugs;
    return bugs.filter((b) => {
      const hay = `${b.description} ${b.userEmail ?? ''} ${b.context ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [bugs, search]);

  const grouped = useMemo(() => {
    const out: Record<BugStatus, BugListItem[]> = {
      new: [],
      acknowledged: [],
      in_progress: [],
      resolved: [],
      wont_fix: [],
    };
    for (const b of filtered ?? []) {
      out[b.status].push(b);
    }
    return out;
  }, [filtered]);

  const openDetail = useCallback(async (id: string) => {
    setDetail(null);
    setNotesDraft('');
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/bugs/${encodeURIComponent(id)}`, {
        headers: adminHeaders(),
      });
      const data = (await res.json()) as { ok?: boolean; bug?: FullBug; error?: string };
      if (!data.ok || !data.bug) {
        throw new Error(data.error ?? 'Could not load that bug.');
      }
      setDetail(data.bug);
      setNotesDraft(data.bug.progressNotes ?? '');
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Could not load that bug.');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const saveProgressNotes = useCallback(async () => {
    if (!detail) return;
    setNotesSaving(true);
    try {
      const res = await fetch(`/api/bugs/${encodeURIComponent(detail.id)}/notes`, {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ notes: notesDraft }),
      });
      const data = (await res.json()) as { ok?: boolean; bug?: FullBug; error?: string };
      if (!data.ok) {
        throw new Error(data.error ?? 'Could not save notes.');
      }
      setDetail((prev) => (prev ? { ...prev, progressNotes: notesDraft } : prev));
      setBugs((prev) =>
        prev
          ? prev.map((b) =>
              b.id === detail.id ? { ...b, progressNotes: notesDraft } : b,
            )
          : prev,
      );
      setToast('Progress notes saved.');
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Could not save notes.');
    } finally {
      setNotesSaving(false);
    }
  }, [detail, notesDraft]);

  const updateStatus = useCallback(
    async (id: string, status: BugStatus) => {
      setStatusBusy(true);
      try {
        const res = await fetch(`/api/bugs/${encodeURIComponent(id)}/status`, {
          method: 'POST',
          headers: adminHeaders(),
          body: JSON.stringify({ status }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!data.ok) throw new Error(data.error ?? 'Update failed.');
        setToast('Status updated.');
        if (detail && detail.id === id) {
          setDetail({ ...detail, status });
        }
        await reload();
      } catch (err) {
        setToast(err instanceof Error ? err.message : 'Update failed.');
      } finally {
        setStatusBusy(false);
      }
    },
    [detail, reload],
  );

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
        <header className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-orange-600 shadow-md shadow-rose-500/30">
              <Bug className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                Bug reports
              </h1>
              <p className="text-muted-foreground mt-1">
                Issues beta users have reported from inside the app.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void reload()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </header>

        {toast && (
          <div
            role="status"
            className="mb-4 rounded-lg border border-violet-300/40 bg-violet-50 dark:bg-violet-950/30 px-4 py-3 text-sm"
            aria-live="polite"
          >
            {toast}
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        <div className="mb-6 flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search description, email, or context..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40"
              aria-label="Search bug reports"
            />
          </div>
        </div>

        {STATUS_SECTIONS.map((section) => {
          const rows = grouped[section.key];
          const open = openSections[section.key];
          return (
            <section key={section.key} className="mb-8">
              <button
                type="button"
                onClick={() =>
                  setOpenSections((s) => ({ ...s, [section.key]: !s[section.key] }))
                }
                className="w-full flex items-center justify-between mb-3 group"
                aria-expanded={open}
              >
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  {open ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                  {section.label}
                  <Badge variant="outline" className="ml-2">
                    {rows.length}
                  </Badge>
                </h2>
              </button>
              {open && (
                rows.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-sm text-muted-foreground">
                      Nothing here yet.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {rows.map((b) => {
                      const sev = SEVERITY_META[b.severity];
                      return (
                        <Card key={b.id} data-testid="bug-row">
                          <CardContent className="py-4">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-2 flex-wrap mb-1">
                                  <span
                                    className={`text-xs font-semibold px-2 py-0.5 rounded ${sev.tone}`}
                                  >
                                    {sev.label}
                                  </span>
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatDate(b.createdAt)}
                                  </span>
                                  <span className="text-sm text-muted-foreground">
                                    {b.userEmail ?? 'unknown user'}
                                  </span>
                                  {b.hasScreenshot && (
                                    <span className="text-xs text-violet-600">
                                      screenshot
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm whitespace-pre-wrap">
                                  {preview(b.description, 160)}
                                </p>
                              </div>
                              <div className="flex-shrink-0">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void openDetail(b.id)}
                                >
                                  View details
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )
              )}
            </section>
          );
        })}

        <footer className="mt-12 text-xs text-muted-foreground">
          v1 admin dashboard. Users submit reports via the Report Issue button
          inside the app. Howard gets an email per submission.
        </footer>
      </div>

      <Dialog open={Boolean(detail) || detailLoading} onOpenChange={(o) => { if (!o) setDetail(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bug report</DialogTitle>
            <DialogDescription>
              {detail
                ? `${SEVERITY_META[detail.severity].label} • ${formatDate(detail.createdAt)}`
                : 'Loading...'}
            </DialogDescription>
          </DialogHeader>

          {detailLoading && !detail && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Loading bug...
            </div>
          )}

          {detail && (
            <div className="space-y-5">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  What's not working
                </p>
                <p className="text-sm whitespace-pre-wrap rounded border border-input bg-muted/30 p-3">
                  {detail.description}
                </p>
              </div>

              {detail.context && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                    What they were trying to do
                  </p>
                  <p className="text-sm whitespace-pre-wrap rounded border border-input bg-muted/30 p-3">
                    {detail.context}
                  </p>
                </div>
              )}

              {detail.screenshotBase64 && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                    Screenshot
                  </p>
                  <img
                    src={detail.screenshotBase64}
                    alt="Screenshot submitted with bug report"
                    className="max-w-full rounded border border-input"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-muted-foreground">
                <div>
                  <span className="font-semibold text-foreground/70">From:</span>{' '}
                  {detail.userEmail ?? 'unknown'}
                </div>
                <div>
                  <span className="font-semibold text-foreground/70">When:</span>{' '}
                  {formatDate(detail.createdAt)}
                </div>
                <div className="break-all">
                  <span className="font-semibold text-foreground/70">Page:</span>{' '}
                  {detail.metadata.url}
                </div>
                {detail.metadata.outlineName && (
                  <div>
                    <span className="font-semibold text-foreground/70">Outline:</span>{' '}
                    {detail.metadata.outlineName}
                  </div>
                )}
                <div className="break-all sm:col-span-2">
                  <span className="font-semibold text-foreground/70">Browser:</span>{' '}
                  {detail.metadata.userAgent}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                  Status — current: <span className="font-medium text-foreground/80">{detail.status.replace('_', ' ')}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={statusBusy || detail.status === 'acknowledged'}
                    onClick={() => void updateStatus(detail.id, 'acknowledged')}
                  >
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    Acknowledge
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={statusBusy || detail.status === 'in_progress'}
                    onClick={() => void updateStatus(detail.id, 'in_progress')}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    In progress
                  </Button>
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white"
                    disabled={statusBusy || detail.status === 'resolved'}
                    onClick={() => void updateStatus(detail.id, 'resolved')}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Resolved
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={statusBusy || detail.status === 'wont_fix'}
                    onClick={() => void updateStatus(detail.id, 'wont_fix')}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Won't fix
                  </Button>
                </div>
              </div>

              {/* Progress notes — internal only. Never returned by any
                  user-facing API; only visible/editable here. */}
              <div data-testid="bug-progress-notes-section">
                <div className="flex items-baseline justify-between mb-1">
                  <label
                    htmlFor="bug-progress-notes"
                    className="text-xs uppercase tracking-wide text-muted-foreground"
                  >
                    Progress notes (internal)
                  </label>
                  <span className="text-[10px] text-muted-foreground italic">
                    Visible only to admins, never shown to the user.
                  </span>
                </div>
                <textarea
                  id="bug-progress-notes"
                  data-testid="bug-progress-notes"
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  placeholder="What you've looked at, next steps, blockers, repro tries…"
                  rows={5}
                  maxLength={20000}
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-violet-400/40"
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {notesDraft.length}/20000
                  </span>
                  <Button
                    size="sm"
                    onClick={() => void saveProgressNotes()}
                    disabled={
                      notesSaving ||
                      notesDraft === (detail.progressNotes ?? '')
                    }
                    data-testid="bug-progress-notes-save"
                  >
                    {notesSaving ? 'Saving…' : 'Save notes'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
