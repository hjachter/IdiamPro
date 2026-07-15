'use client';

/**
 * /feedback — Beta-user feedback form.
 *
 * Submission grants the user 1 year of Pro features at no charge (BYOK for
 * AI). Sharing a video testimonial also earns a Founding User badge.
 *
 * Auth gating: in stub mode (no Clerk keys) anyone can land here and submit
 * — same v1 trust contract as the rest of the beta surface. With Clerk
 * enabled the page would be wrapped in an AppGate-style guard; we keep the
 * server-side userId resolution honest in /api/feedback/submit either way.
 *
 * Per-feature rows pull their labels verbatim from the marketing site (see
 * src/lib/access/feedback-store.ts → FEEDBACK_FEATURE_LABELS) so this form
 * stays the single source of truth for what counts as a killer feature.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Star, Sparkles, CheckCircle2, MessageSquare, Camera, Video, Loader2 } from 'lucide-react';
import {
  FEEDBACK_FEATURE_KEYS,
  FEEDBACK_FEATURE_LABELS,
  type FeedbackFeatureKey,
  type TestimonialAttribution,
} from '@/lib/access/feedback-types';

interface FeatureRatingState {
  stars: number | null;
  skipped: boolean;
  comment: string;
}

interface FormState {
  name: string;
  email: string;
  nps: number;
  overallStars: number;
  features: Record<FeedbackFeatureKey, FeatureRatingState>;
  bestThing: string;
  biggestWish: string;
  toolsBeforeIdiampro: string;
  workType: string;
  usageFrequency: string;
  testimonialConsent: boolean | null;
  testimonialAttribution: TestimonialAttribution | '';
  photoUploaded: boolean;
  videoUploaded: boolean;
  frictionNotes: string;
  followUpOk: boolean;
}

function defaultFeatures(): Record<FeedbackFeatureKey, FeatureRatingState> {
  const out = {} as Record<FeedbackFeatureKey, FeatureRatingState>;
  for (const key of FEEDBACK_FEATURE_KEYS) {
    out[key] = { stars: null, skipped: false, comment: '' };
  }
  return out;
}

const USAGE_OPTIONS = [
  { value: 'every_day', label: 'Every day' },
  { value: 'most_days', label: 'Most days' },
  { value: 'few_times', label: 'A few times' },
  { value: 'once_or_twice', label: 'Once or twice' },
  { value: 'havent_opened', label: "Haven't opened it" },
];

const ATTR_OPTIONS: { value: TestimonialAttribution; label: string }[] = [
  { value: 'full_name_title', label: 'Full name + title' },
  { value: 'first_name_role', label: 'First name + role only' },
  { value: 'initials_only', label: 'Initials only' },
  { value: 'anonymous', label: 'Anonymous (no quote, just keep it internal)' },
];

function StarsInput({
  value,
  onChange,
  ariaLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          aria-checked={value === n}
          role="radio"
          onClick={() => onChange(n)}
          className="rounded p-1 hover:bg-violet-50 focus:outline-none focus:ring-2 focus:ring-violet-400/50"
        >
          <Star
            className={`h-6 w-6 transition ${
              n <= value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function FeedbackPageInner() {
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    nps: 8,
    overallStars: 0,
    features: defaultFeatures(),
    bestThing: '',
    biggestWish: '',
    toolsBeforeIdiampro: '',
    workType: '',
    usageFrequency: '',
    testimonialConsent: null,
    testimonialAttribution: '',
    photoUploaded: false,
    videoUploaded: false,
    frictionNotes: '',
    followUpOk: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ proUntil: string; foundingUser: boolean } | null>(null);

  const requiredOk = useMemo(
    () =>
      form.overallStars >= 1 &&
      form.overallStars <= 5 &&
      Number.isFinite(form.nps) &&
      form.nps >= 0 &&
      form.nps <= 10,
    [form.overallStars, form.nps],
  );

  const updateFeature = useCallback(
    (key: FeedbackFeatureKey, patch: Partial<FeatureRatingState>) => {
      setForm((s) => ({
        ...s,
        features: {
          ...s.features,
          [key]: { ...s.features[key], ...patch },
        },
      }));
    },
    [],
  );

  const onSubmit = useCallback(async () => {
    setError(null);
    if (!requiredOk) {
      setError('Please give an NPS score and pick an overall star rating before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      const featureRatings: Record<string, { stars: number | null; comment?: string }> = {};
      for (const key of FEEDBACK_FEATURE_KEYS) {
        const f = form.features[key];
        if (f.skipped) {
          featureRatings[key] = { stars: null, comment: f.comment.trim() || undefined };
        } else if (f.stars && f.stars >= 1 && f.stars <= 5) {
          featureRatings[key] = { stars: f.stars, comment: f.comment.trim() || undefined };
        }
      }

      // Stub-mode: when Clerk isn't configured, the server route still needs
      // a stable userId so the grant + dedupe work. Use the email as a
      // deterministic fallback. (In prod with Clerk on, the server uses
      // auth() instead of trusting this value.)
      const fallbackId = `email:${form.email.trim().toLowerCase() || 'anon'}`;

      const res = await fetch('/api/feedback/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: fallbackId,
          name: form.name,
          email: form.email,
          nps: form.nps,
          overallStars: form.overallStars,
          featureRatings,
          bestThing: form.bestThing,
          biggestWish: form.biggestWish,
          toolsBeforeIdiampro: form.toolsBeforeIdiampro,
          workType: form.workType,
          usageFrequency: form.usageFrequency,
          testimonialConsent: form.testimonialConsent === true,
          testimonialAttribution: form.testimonialAttribution || undefined,
          testimonialPhotoUploaded: form.photoUploaded,
          testimonialVideoUploaded: form.videoUploaded,
          frictionNotes: form.frictionNotes,
          followUpOk: form.followUpOk,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        grant?: { proUntil: string; foundingUser?: boolean };
      };
      if (!data.ok) throw new Error(data.error ?? 'Could not save your feedback.');
      setSuccess({
        proUntil: data.grant?.proUntil ?? '',
        foundingUser: data.grant?.foundingUser === true,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your feedback.');
    } finally {
      setSubmitting(false);
    }
  }, [form, requiredOk]);

  if (success) {
    return (
      <div className="min-h-screen bg-background py-16 px-6">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
              <CardTitle className="text-2xl">
                Thanks — you've earned 1 year of Pro features.
              </CardTitle>
              <CardDescription className="text-base mt-2">
                Enjoy. (Reminder: bring your own AI key for unlimited AI use; we don't charge for the
                features but you cover the API.)
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              {success.foundingUser && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 mb-4">
                  Your video testimonial unlocked the Founding User badge inside the app.
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Pro is active through{' '}
                <strong>
                  {success.proUntil
                    ? new Date(success.proUntil).toLocaleDateString(undefined, {
                        dateStyle: 'long',
                      })
                    : 'one year from today'}
                </strong>
                .
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <header className="mb-8 text-center">
          <div className="inline-flex h-12 w-12 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 items-center justify-center mb-4">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Share your beta feedback</h1>
          <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
            Five minutes of your time earns a year of Pro features at no charge. Bring your own AI
            API key for unlimited AI use. A short video quote also earns a Founding User badge
            inside the app.
          </p>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        {/* Identity (optional but helpful) */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Who's writing this?</CardTitle>
            <CardDescription>So we know who to thank and where to send the Pro grant.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1" htmlFor="fb-name">
                Your name
              </label>
              <input
                id="fb-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/50"
                placeholder="Howard Jachter"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1" htmlFor="fb-email">
                Email
              </label>
              <input
                id="fb-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/50"
                placeholder="you@example.com"
              />
            </div>
          </CardContent>
        </Card>

        {/* Top-line scores */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Top-line scores</CardTitle>
            <CardDescription>Both required.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="text-sm font-medium block mb-2">
                How likely are you to recommend IDMPro to a friend or colleague?
              </label>
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={form.nps}
                onChange={(e) => setForm((s) => ({ ...s, nps: Number(e.target.value) }))}
                aria-label="Net promoter score"
                className="w-full accent-violet-500"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Not at all likely</span>
                <span className="font-medium text-base text-foreground">{form.nps}</span>
                <span>Extremely likely</span>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium block mb-2">Overall satisfaction</label>
              <StarsInput
                value={form.overallStars}
                onChange={(n) => setForm((s) => ({ ...s, overallStars: n }))}
                ariaLabel="Overall satisfaction"
              />
            </div>
          </CardContent>
        </Card>

        {/* Per-feature ratings */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">How does each killer feature land?</CardTitle>
            <CardDescription>
              All optional. Tick the box if you haven't tried something yet — that's useful too.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {FEEDBACK_FEATURE_KEYS.map((key) => {
              const meta = FEEDBACK_FEATURE_LABELS[key];
              const state = form.features[key];
              return (
                <div key={key} className="border-b border-border last:border-0 pb-4 last:pb-0">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-base">{meta.label}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
                    </div>
                    <div className="flex-shrink-0">
                      <StarsInput
                        value={state.skipped ? 0 : state.stars ?? 0}
                        onChange={(n) =>
                          updateFeature(key, { stars: n, skipped: false })
                        }
                        ariaLabel={`${meta.label} rating`}
                      />
                    </div>
                  </div>
                  <div className="mt-2 flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                    <input
                      type="text"
                      placeholder="One quick thought (optional)"
                      maxLength={120}
                      value={state.comment}
                      onChange={(e) => updateFeature(key, { comment: e.target.value })}
                      className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40"
                    />
                    <label className="text-xs text-muted-foreground flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={state.skipped}
                        onChange={(e) =>
                          updateFeature(key, {
                            skipped: e.target.checked,
                            stars: e.target.checked ? null : state.stars,
                          })
                        }
                        className="rounded accent-violet-500"
                      />
                      Didn't try this yet
                    </label>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Open prompts */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">In your own words</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1" htmlFor="fb-best">
                What's the single best thing about IDMPro for you?
              </label>
              <textarea
                id="fb-best"
                rows={3}
                maxLength={500}
                value={form.bestThing}
                onChange={(e) => setForm((s) => ({ ...s, bestThing: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40"
                placeholder="The thing you'd hate to lose."
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1" htmlFor="fb-wish">
                What's the single biggest thing you wish were different?
              </label>
              <textarea
                id="fb-wish"
                rows={3}
                maxLength={500}
                value={form.biggestWish}
                onChange={(e) => setForm((s) => ({ ...s, biggestWish: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40"
                placeholder="Where IDMPro got in your way, or didn't show up."
              />
            </div>
          </CardContent>
        </Card>

        {/* Workflow */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Your workflow</CardTitle>
            <CardDescription>All optional.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1" htmlFor="fb-before">
                What were you using for outlining or note-taking before IDMPro?
              </label>
              <input
                id="fb-before"
                type="text"
                value={form.toolsBeforeIdiampro}
                onChange={(e) =>
                  setForm((s) => ({ ...s, toolsBeforeIdiampro: e.target.value }))
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40"
                placeholder="Notion, Obsidian, Word, paper, etc."
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1" htmlFor="fb-work">
                What kind of work do you do?
              </label>
              <input
                id="fb-work"
                type="text"
                value={form.workType}
                onChange={(e) => setForm((s) => ({ ...s, workType: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40"
                placeholder="Lawyer, PhD student, journalist, consultant, etc."
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1" htmlFor="fb-usage">
                How often have you opened IDMPro this week?
              </label>
              <select
                id="fb-usage"
                value={form.usageFrequency}
                onChange={(e) => setForm((s) => ({ ...s, usageFrequency: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40"
              >
                <option value="">— pick one —</option>
                {USAGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Testimonial */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-violet-500" />
              Testimonial consent
            </CardTitle>
            <CardDescription>
              Sharing a quote we can put on the website helps the beta land. A short video earns a
              Founding User badge inside the app.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-2">
                Can we quote you on the IDMPro website?
              </label>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant={form.testimonialConsent === true ? 'default' : 'outline'}
                  size="sm"
                  onClick={() =>
                    setForm((s) => ({
                      ...s,
                      testimonialConsent: true,
                      testimonialAttribution: s.testimonialAttribution || 'first_name_role',
                    }))
                  }
                >
                  Yes
                </Button>
                <Button
                  type="button"
                  variant={form.testimonialConsent === false ? 'default' : 'outline'}
                  size="sm"
                  onClick={() =>
                    setForm((s) => ({
                      ...s,
                      testimonialConsent: false,
                      testimonialAttribution: '',
                      photoUploaded: false,
                      videoUploaded: false,
                    }))
                  }
                >
                  No
                </Button>
              </div>
            </div>

            {form.testimonialConsent === true && (
              <>
                <div>
                  <label className="text-sm font-medium block mb-2">
                    How would you like to be attributed?
                  </label>
                  <div className="space-y-2">
                    {ATTR_OPTIONS.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name="attribution"
                          value={opt.value}
                          checked={form.testimonialAttribution === opt.value}
                          onChange={() =>
                            setForm((s) => ({ ...s, testimonialAttribution: opt.value }))
                          }
                          className="accent-violet-500"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-dashed border-violet-300 bg-violet-50/40 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium mb-1">
                    <Camera className="h-4 w-4 text-violet-500" />
                    Photo upload (optional)
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Only used if you allowed full-name attribution.
                  </p>
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    aria-label="Photo upload"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) {
                        setForm((s) => ({ ...s, photoUploaded: false }));
                        return;
                      }
                      if (f.size > 5 * 1024 * 1024) {
                        setError('Photo must be 5 MB or less.');
                        return;
                      }
                      setForm((s) => ({ ...s, photoUploaded: true }));
                    }}
                    className="text-xs"
                  />
                </div>

                <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/40 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium mb-1">
                    <Video className="h-4 w-4 text-amber-500" />
                    30-second video testimonial (optional)
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Video testimonials unlock a Founding User badge inside the app.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                    <input
                      type="file"
                      accept="video/*"
                      aria-label="Video upload"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        setForm((s) => ({ ...s, videoUploaded: Boolean(f) }));
                      }}
                      className="text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setForm((s) => ({ ...s, videoUploaded: true }))}
                      className="text-xs text-violet-600 hover:underline"
                    >
                      I'll record this later
                    </button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Friction */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Anything confusing or broken?</CardTitle>
            <CardDescription>Bug reports help. Optional.</CardDescription>
          </CardHeader>
          <CardContent>
            <textarea
              rows={3}
              maxLength={500}
              value={form.frictionNotes}
              onChange={(e) => setForm((s) => ({ ...s, frictionNotes: e.target.value }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40"
              placeholder="Something that surprised you, an error you saw, a place you got stuck."
            />
          </CardContent>
        </Card>

        {/* Follow-up consent */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <label className="flex items-start gap-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.followUpOk}
                onChange={(e) => setForm((s) => ({ ...s, followUpOk: e.target.checked }))}
                className="mt-1 accent-violet-500"
              />
              <span>
                OK to email me if Howard wants to ask a follow-up question about my response.
              </span>
            </label>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            type="button"
            size="lg"
            disabled={!requiredOk || submitting}
            onClick={() => void onSubmit()}
            className="bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              <>Submit and earn 1 year of Pro</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function FeedbackPage() {
  return <FeedbackPageInner />;
}
