'use client';

/**
 * /admin/feedback — internal dashboard for browsing beta-feedback
 * submissions.
 *
 * Mirrors /admin/applicants in layout: search, filter chips, CSV export,
 * one card per submission. Access is enforced server-side by the /admin
 * layout (a signed-in Clerk user on the ADMIN_EMAILS allowlist) AND by the
 * /api/feedback/list requireAdmin() guard — there is no client flag.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Download,
  MessageSquare,
  RefreshCw,
  Search,
  Star,
  ThumbsUp,
  Quote,
  Video,
} from 'lucide-react';
import {
  FEEDBACK_FEATURE_KEYS,
  FEEDBACK_FEATURE_LABELS,
  type FeedbackRecord,
} from '@/lib/access/feedback-types';

type FilterMode = 'all' | 'testimonial' | 'public_quotable' | 'video';

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

function toCsvValue(v: string | number | undefined): string {
  if (v === undefined || v === null) return '';
  const s = String(v);
  const needsQuote = /[",\n]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

function downloadCsv(filename: string, rows: (string | number | undefined)[][]) {
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

function ratingSummary(r: FeedbackRecord): string {
  const counts: number[] = [];
  for (const k of FEEDBACK_FEATURE_KEYS) {
    const fr = r.featureRatings[k];
    if (fr?.stars != null) counts.push(fr.stars);
  }
  if (counts.length === 0) return '—';
  const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
  return `${avg.toFixed(1)} avg over ${counts.length}`;
}

function recordMatchesQuery(r: FeedbackRecord, q: string): boolean {
  if (!q) return true;
  const hay = [
    r.name,
    r.email,
    r.bestThing,
    r.biggestWish,
    r.frictionNotes,
    r.toolsBeforeIdiampro,
    r.workType,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q.toLowerCase());
}

function recordMatchesFilter(r: FeedbackRecord, f: FilterMode): boolean {
  switch (f) {
    case 'all':
      return true;
    case 'testimonial':
      return r.testimonialConsent === true;
    case 'public_quotable':
      return (
        r.testimonialConsent === true &&
        r.testimonialAttribution !== 'anonymous'
      );
    case 'video':
      return r.testimonialVideoUploaded === true;
    default:
      return true;
  }
}

export default function AdminFeedbackPage() {
  const [records, setRecords] = useState<FeedbackRecord[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [focusedId, setFocusedId] = useState<string | null>(null);

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
      const res = await fetch('/api/feedback/list', { headers: adminHeaders() });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Failed to load (HTTP ${res.status}).`);
      }
      const data = (await res.json()) as { feedback?: FeedbackRecord[] };
      setRecords(data.feedback ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feedback.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    if (!records) return null;
    return records.filter(
      (r) => recordMatchesQuery(r, search) && recordMatchesFilter(r, filter),
    );
  }, [records, search, filter]);

  const exportCsv = useCallback(() => {
    if (!filtered) return;
    const header = [
      'Name',
      'Email',
      'Submitted',
      'NPS',
      'Overall',
      'Avg feature',
      'Best thing',
      'Biggest wish',
      'Friction',
      'Testimonial',
      'Attribution',
      'Photo',
      'Video',
      'Follow-up OK',
    ];
    const rows: (string | number | undefined)[][] = [header];
    for (const r of filtered) {
      rows.push([
        r.name,
        r.email,
        r.submittedAt,
        r.nps,
        r.overallStars,
        ratingSummary(r),
        r.bestThing,
        r.biggestWish,
        r.frictionNotes,
        r.testimonialConsent ? 'yes' : 'no',
        r.testimonialAttribution ?? '',
        r.testimonialPhotoUploaded ? 'yes' : 'no',
        r.testimonialVideoUploaded ? 'yes' : 'no',
        r.followUpOk ? 'yes' : 'no',
      ]);
    }
    downloadCsv('idiampro-feedback.csv', rows);
  }, [filtered]);


  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <header className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-md shadow-violet-500/30">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Beta feedback</h1>
              <p className="text-muted-foreground mt-1">
                Every feedback submission lands here, newest first.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void reload()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered?.length}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </header>

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
              placeholder="Search name, email, comment, wish…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40"
              aria-label="Search feedback"
            />
          </div>
          <div className="flex gap-2 flex-wrap" role="group" aria-label="Filter">
            {(
              [
                { value: 'all', label: 'All' },
                { value: 'testimonial', label: 'Testimonial-consented' },
                { value: 'public_quotable', label: 'Public-quotable' },
                { value: 'video', label: 'Video' },
              ] as { value: FilterMode; label: string }[]
            ).map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={`px-3 py-2 rounded-lg text-sm transition ${
                  filter === f.value
                    ? 'bg-violet-500 text-white shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <section>
          {filtered === null ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <p className="text-base">No feedback yet.</p>
                <p className="text-sm mt-1">
                  Submissions from the /feedback form will appear here as they arrive.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((r) => (
                <Card
                  key={r.id}
                  className={focusedId === r.id ? 'border-violet-400 shadow-md' : ''}
                >
                  <CardContent className="py-5">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-3 flex-wrap">
                          <span className="font-medium text-base">{r.name}</span>
                          <a
                            href={`mailto:${r.email}`}
                            className="text-sm text-violet-600 hover:underline truncate"
                          >
                            {r.email}
                          </a>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(r.submittedAt)}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <Badge variant="outline" className="gap-1">
                            <ThumbsUp className="h-3 w-3" /> NPS {r.nps}/10
                          </Badge>
                          <Badge variant="outline" className="gap-1">
                            <Star className="h-3 w-3" /> {r.overallStars}/5
                          </Badge>
                          <Badge variant="outline">
                            Features: {ratingSummary(r)}
                          </Badge>
                          {r.testimonialConsent && (
                            <Badge variant="outline" className="gap-1 border-violet-300 text-violet-700">
                              <Quote className="h-3 w-3" /> Testimonial OK
                            </Badge>
                          )}
                          {r.testimonialVideoUploaded && (
                            <Badge variant="outline" className="gap-1 border-amber-300 text-amber-700">
                              <Video className="h-3 w-3" /> Founding User
                            </Badge>
                          )}
                        </div>
                        {r.bestThing && (
                          <p className="mt-3 text-sm italic border-l-2 border-emerald-300 pl-3 whitespace-pre-wrap">
                            <span className="text-emerald-600 font-medium not-italic mr-1">
                              Best:
                            </span>
                            {r.bestThing}
                          </p>
                        )}
                        {r.biggestWish && (
                          <p className="mt-2 text-sm italic border-l-2 border-amber-300 pl-3 whitespace-pre-wrap">
                            <span className="text-amber-600 font-medium not-italic mr-1">
                              Wish:
                            </span>
                            {r.biggestWish}
                          </p>
                        )}
                        {r.frictionNotes && (
                          <p className="mt-2 text-sm italic border-l-2 border-rose-300 pl-3 whitespace-pre-wrap">
                            <span className="text-rose-600 font-medium not-italic mr-1">
                              Friction:
                            </span>
                            {r.frictionNotes}
                          </p>
                        )}
                        {(r.toolsBeforeIdiampro || r.workType) && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            {r.workType && <>Work: {r.workType}</>}
                            {r.workType && r.toolsBeforeIdiampro && ' · '}
                            {r.toolsBeforeIdiampro && (
                              <>Was using: {r.toolsBeforeIdiampro}</>
                            )}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const subject = encodeURIComponent('Re: your IDMPro feedback');
                            window.location.href = `mailto:${r.email}?subject=${subject}`;
                          }}
                        >
                          Reply
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
