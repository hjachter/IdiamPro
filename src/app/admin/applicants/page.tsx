'use client';

/**
 * /admin/applicants — the manual beta-approval dashboard.
 *
 * Three sections:
 *   1. Pending Applicants — Name | Email | Signed up | Reason | Approve | Reject
 *   2. Approved Users (running record) — Name | Email | Approved on | Email | Notes
 *   3. Rejected Applicants (collapsed by default) — for reference / undo
 *
 * Top controls: search across name + email, time-window filter chips
 * (All / This week / This month), CSV export buttons.
 *
 * Access is enforced server-side by the /admin layout (a signed-in Clerk
 * user on the ADMIN_EMAILS allowlist) AND by each applicant API route's
 * requireAdmin() guard — there is no client flag. Same-origin fetches carry
 * the Clerk session cookie automatically.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  Download,
  Mail,
  RefreshCw,
  Search,
  ShieldX,
  StickyNote,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react';

type ApplicantStatus = 'pending' | 'approved' | 'rejected';

interface ApplicantRecord {
  id: string;
  name: string;
  email: string;
  signupDate: string;
  status: ApplicantStatus;
  reason?: string;
  ip?: string;
  referrer?: string;
  approvedDate?: string;
  notes?: string;
}

type TimeFilter = 'all' | 'week' | 'month';

function adminHeaders(): HeadersInit {
  return { 'Content-Type': 'application/json' };
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

function withinTimeWindow(iso: string, filter: TimeFilter): boolean {
  if (filter === 'all') return true;
  const ts = new Date(iso).getTime();
  const now = Date.now();
  const windowMs = filter === 'week' ? 7 * 86400_000 : 30 * 86400_000;
  return now - ts <= windowMs;
}

function toCsvValue(v: string | undefined): string {
  if (!v) return '';
  const needsQuote = /[",\n]/.test(v);
  const escaped = v.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

function downloadCsv(filename: string, rows: string[][]): void {
  const body = rows.map((r) => r.map(toCsvValue).join(',')).join('\n');
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function AdminApplicantsPage() {
  const [applicants, setApplicants] = useState<ApplicantRecord[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const focus = params.get('focus');
    if (focus) setFocusedId(focus);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/applicants/list', {
        headers: adminHeaders(),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Failed to load (HTTP ${res.status}).`);
      }
      const data = (await res.json()) as { applicants?: ApplicantRecord[] };
      setApplicants(data.applicants ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load applicants.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Auto-clear the toast after a few seconds.
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 4_000);
    return () => window.clearTimeout(id);
  }, [toast]);

  const filtered = useMemo(() => {
    if (!applicants) return null;
    const q = search.trim().toLowerCase();
    return applicants.filter((a) => {
      if (q) {
        const hay = `${a.name} ${a.email}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      // Time filter applies to signup date for pending/rejected, approval
      // date for approved. We use whichever is relevant.
      const dateForFilter =
        a.status === 'approved' && a.approvedDate ? a.approvedDate : a.signupDate;
      if (!withinTimeWindow(dateForFilter, timeFilter)) return false;
      return true;
    });
  }, [applicants, search, timeFilter]);

  const pending = useMemo(
    () => (filtered ?? []).filter((a) => a.status === 'pending'),
    [filtered],
  );
  const approved = useMemo(
    () => (filtered ?? []).filter((a) => a.status === 'approved'),
    [filtered],
  );
  const rejected = useMemo(
    () => (filtered ?? []).filter((a) => a.status === 'rejected'),
    [filtered],
  );

  const approveOne = useCallback(
    async (id: string) => {
      try {
        const res = await fetch('/api/applicants/approve', {
          method: 'POST',
          headers: adminHeaders(),
          body: JSON.stringify({ id }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!data.ok) throw new Error(data.error ?? 'Approval failed.');
        setToast('Approved. Welcome email sent.');
        await reload();
      } catch (err) {
        setToast(err instanceof Error ? err.message : 'Approval failed.');
      }
    },
    [reload],
  );

  const rejectOne = useCallback(
    async (id: string) => {
      try {
        const res = await fetch('/api/applicants/reject', {
          method: 'POST',
          headers: adminHeaders(),
          body: JSON.stringify({ id }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!data.ok) throw new Error(data.error ?? 'Rejection failed.');
        setToast('Moved to rejected list. No email sent.');
        await reload();
      } catch (err) {
        setToast(err instanceof Error ? err.message : 'Rejection failed.');
      }
    },
    [reload],
  );

  const saveNotes = useCallback(
    async (id: string) => {
      const notes = draftNotes[id] ?? '';
      try {
        const res = await fetch('/api/applicants/notes', {
          method: 'POST',
          headers: adminHeaders(),
          body: JSON.stringify({ id, notes }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!data.ok) throw new Error(data.error ?? 'Save failed.');
        setToast('Notes saved.');
        await reload();
      } catch (err) {
        setToast(err instanceof Error ? err.message : 'Save failed.');
      }
    },
    [draftNotes, reload],
  );

  const exportPendingCsv = useCallback(() => {
    const rows: string[][] = [
      ['Name', 'Email', 'Signed up', 'Reason', 'IP', 'Referrer'],
      ...pending.map((a) => [
        a.name,
        a.email,
        a.signupDate,
        a.reason ?? '',
        a.ip ?? '',
        a.referrer ?? '',
      ]),
    ];
    downloadCsv('idiampro-pending-applicants.csv', rows);
  }, [pending]);

  const exportApprovedCsv = useCallback(() => {
    const rows: string[][] = [
      ['Name', 'Email', 'Approved on', 'Signed up', 'Notes'],
      ...approved.map((a) => [
        a.name,
        a.email,
        a.approvedDate ?? '',
        a.signupDate,
        a.notes ?? '',
      ]),
    ];
    downloadCsv('idiampro-approved-users.csv', rows);
  }, [approved]);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-10">
        <header className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-md shadow-violet-500/30">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                Beta applicants
              </h1>
              <p className="text-muted-foreground mt-1">
                Approve the people who get into the IDMPro beta. Every
                application lands here.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void reload()}
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`}
            />
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

        {/* Search + filter chips */}
        <div className="mb-6 flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40"
              aria-label="Search applicants"
            />
          </div>
          <div className="flex gap-2" role="group" aria-label="Time window">
            {(['all', 'week', 'month'] as TimeFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setTimeFilter(f)}
                className={`px-3 py-2 rounded-lg text-sm transition ${
                  timeFilter === f
                    ? 'bg-violet-500 text-white shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {f === 'all' ? 'All' : f === 'week' ? 'This week' : 'This month'}
              </button>
            ))}
          </div>
        </div>

        {/* Pending Applicants */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-violet-500" />
              Pending applicants
              <Badge variant="outline" className="ml-2">
                {pending.length}
              </Badge>
            </h2>
            {pending.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={exportPendingCsv}
                aria-label="Export pending applicants as CSV"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            )}
          </div>
          {pending.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <p className="text-base">No one's waiting right now.</p>
                <p className="text-sm mt-1">
                  New beta applications will show up here as soon as they
                  arrive — and Howard will get an email.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {pending.map((a) => (
                <Card
                  key={a.id}
                  className={
                    focusedId === a.id ? 'border-violet-400 shadow-md' : ''
                  }
                >
                  <CardContent className="py-5">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-3 flex-wrap min-w-0">
                          <span className="font-medium text-base">{a.name}</span>
                          <a
                            href={`mailto:${a.email}`}
                            className="text-sm text-violet-600 hover:underline break-all"
                          >
                            {a.email}
                          </a>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(a.signupDate)}
                          </span>
                        </div>
                        {a.reason && (
                          <p className="mt-2 text-sm text-muted-foreground italic border-l-2 border-violet-300 pl-3 whitespace-pre-wrap">
                            {a.reason}
                          </p>
                        )}
                        {(a.ip || a.referrer) && (
                          <p className="mt-2 text-xs text-muted-foreground/70 break-all">
                            {a.ip && <>IP: {a.ip}</>}
                            {a.ip && a.referrer && ' · '}
                            {a.referrer && <>Referrer: {a.referrer}</>}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          onClick={() => void approveOne(a.id)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void rejectOne(a.id)}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Approved Users */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Approved users
              <Badge variant="outline" className="ml-2">
                {approved.length}
              </Badge>
            </h2>
            {approved.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={exportApprovedCsv}
                aria-label="Export approved users as CSV"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            )}
          </div>
          {approved.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <p className="text-base">
                  You haven&apos;t approved anyone yet.
                </p>
                <p className="text-sm mt-1">
                  Once you do, they&apos;ll show up here as your running list
                  of beta users.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {approved.map((a) => {
                const noteDraft = draftNotes[a.id] ?? a.notes ?? '';
                const noteDirty = noteDraft !== (a.notes ?? '');
                return (
                  <Card key={a.id}>
                    <CardContent className="py-5">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-3 flex-wrap min-w-0">
                            <span className="font-medium text-base">
                              {a.name}
                            </span>
                            <a
                              href={`mailto:${a.email}`}
                              className="text-sm text-violet-600 hover:underline break-all"
                            >
                              {a.email}
                            </a>
                            {a.approvedDate && (
                              <span className="text-xs text-muted-foreground">
                                Approved {formatDate(a.approvedDate)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const subject = encodeURIComponent(
                                'Checking in from IDMPro',
                              );
                              window.location.href = `mailto:${a.email}?subject=${subject}`;
                            }}
                          >
                            <Mail className="h-4 w-4 mr-1" />
                            Email
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3">
                        <label
                          htmlFor={`notes-${a.id}`}
                          className="text-xs text-muted-foreground flex items-center gap-1 mb-1"
                        >
                          <StickyNote className="h-3 w-3" />
                          Private notes
                        </label>
                        <textarea
                          id={`notes-${a.id}`}
                          value={noteDraft}
                          onChange={(e) =>
                            setDraftNotes((d) => ({
                              ...d,
                              [a.id]: e.target.value,
                            }))
                          }
                          rows={2}
                          placeholder="What do you want to remember about this person?"
                          className="w-full text-sm rounded-md border border-input bg-background px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400/40 resize-y"
                        />
                        {noteDirty && (
                          <div className="mt-2 flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => void saveNotes(a.id)}
                            >
                              Save notes
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setDraftNotes((d) => {
                                  const next = { ...d };
                                  delete next[a.id];
                                  return next;
                                })
                              }
                            >
                              Cancel
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Rejected Applicants */}
        {rejected.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <ShieldX className="h-5 w-5 text-muted-foreground" />
                Rejected
                <Badge variant="outline" className="ml-2">
                  {rejected.length}
                </Badge>
              </h2>
            </div>
            <Card>
              <CardContent className="py-4">
                <ul className="text-sm text-muted-foreground space-y-1">
                  {rejected.map((a) => (
                    <li key={a.id} className="flex gap-3 flex-wrap min-w-0">
                      <span className="font-medium text-foreground/80">
                        {a.name}
                      </span>
                      <span className="break-all">{a.email}</span>
                      <span className="text-xs">
                        {formatDate(a.signupDate)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </section>
        )}

        <footer className="mt-12 text-xs text-muted-foreground">
          v1 admin dashboard. Approving an applicant emails them from
          howard@2ndbrainware.com and adds their email to the dynamic
          allowlist (no Vercel redeploy needed).
        </footer>
      </div>
    </div>
  );
}
