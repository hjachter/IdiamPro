/**
 * Feedback store — file-based JSON record of every beta-feedback submission.
 *
 * The beta-feedback form (/feedback) collects NPS, per-feature ratings,
 * open-ended responses, workflow context, testimonial consent, and friction
 * questions. Submitting unlocks a 1-year Pro entitlement for the user.
 *
 * Same atomic-write JSON pattern as src/lib/access/applicant-store.ts and
 * src/lib/email/unsubscribe-store.ts — zero new dependencies, swappable to a
 * real DB later without touching callers (everyone talks to the exported
 * functions). Storage location:
 *   - Set IDIAMPRO_FEEDBACK_STORE_PATH to an absolute path to override.
 *   - Default: `.idiampro/feedback.json` under the process cwd.
 *
 * NOTE on persistence in serverless: on Vercel, .idiampro/* lives in the
 * function's ephemeral filesystem. The applicant store already accepts this
 * tradeoff for v1 (small launch volume, swap to KV/Postgres later). We follow
 * the same contract here.
 */

import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';
import {
  FEEDBACK_FEATURE_KEYS,
  FEEDBACK_FEATURE_LABELS,
  type FeedbackFeatureKey,
  type FeedbackFeatureRating,
  type FeedbackRecord,
  type TestimonialAttribution,
} from './feedback-types';

export {
  FEEDBACK_FEATURE_KEYS,
  FEEDBACK_FEATURE_LABELS,
};
export type {
  FeedbackFeatureKey,
  FeedbackFeatureRating,
  FeedbackRecord,
  TestimonialAttribution,
};

interface FeedbackFile {
  version: 1;
  records: Record<string, FeedbackRecord>;
}

const FILE_VERSION = 1;

function resolveStorePath(): string {
  const override = (process.env.IDIAMPRO_FEEDBACK_STORE_PATH ?? '').trim();
  if (override.length > 0) return override;
  return join(process.cwd(), '.idiampro', 'feedback.json');
}

async function readFileSafe(path: string): Promise<FeedbackFile> {
  try {
    const raw = await fs.readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as FeedbackFile;
    if (parsed && parsed.version === FILE_VERSION && parsed.records) {
      return parsed;
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      // eslint-disable-next-line no-console
      console.warn(
        '[feedback-store] could not read existing store, starting fresh:',
        err,
      );
    }
  }
  return { version: FILE_VERSION, records: {} };
}

async function writeFileAtomic(
  path: string,
  data: FeedbackFile,
): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, path);
}

export interface CreateFeedbackArgs {
  userId: string;
  name: string;
  email: string;
  nps: number;
  overallStars: number;
  featureRatings: Partial<Record<FeedbackFeatureKey, FeedbackFeatureRating>>;
  bestThing?: string;
  biggestWish?: string;
  toolsBeforeIdiampro?: string;
  workType?: string;
  usageFrequency?: string;
  testimonialConsent?: boolean;
  testimonialAttribution?: TestimonialAttribution;
  testimonialPhotoUploaded?: boolean;
  testimonialVideoUploaded?: boolean;
  frictionNotes?: string;
  followUpOk?: boolean;
}

/** Persist a new feedback submission. Each user may only submit once — a
 * duplicate from the same userId returns the existing record unchanged. */
export async function createFeedback(
  args: CreateFeedbackArgs,
): Promise<FeedbackRecord> {
  if (!args.userId) throw new Error('A user id is required.');
  if (
    !Number.isFinite(args.nps) ||
    args.nps < 0 ||
    args.nps > 10
  ) {
    throw new Error('NPS must be between 0 and 10.');
  }
  if (
    !Number.isFinite(args.overallStars) ||
    args.overallStars < 1 ||
    args.overallStars > 5
  ) {
    throw new Error('Overall stars must be between 1 and 5.');
  }

  const path = resolveStorePath();
  const file = await readFileSafe(path);

  // Idempotent on userId — re-submitting the form doesn't create a second record.
  for (const existing of Object.values(file.records)) {
    if (existing.userId === args.userId) return existing;
  }

  const record: FeedbackRecord = {
    id: randomUUID(),
    userId: args.userId,
    name: (args.name ?? '').trim() || 'Anonymous',
    email: (args.email ?? '').trim().toLowerCase(),
    submittedAt: new Date().toISOString(),
    nps: Math.round(args.nps),
    overallStars: Math.round(args.overallStars),
    featureRatings: args.featureRatings ?? {},
    bestThing: trimOrUndefined(args.bestThing),
    biggestWish: trimOrUndefined(args.biggestWish),
    toolsBeforeIdiampro: trimOrUndefined(args.toolsBeforeIdiampro),
    workType: trimOrUndefined(args.workType),
    usageFrequency: trimOrUndefined(args.usageFrequency),
    testimonialConsent: args.testimonialConsent === true,
    testimonialAttribution: args.testimonialConsent
      ? args.testimonialAttribution
      : undefined,
    testimonialPhotoUploaded: args.testimonialPhotoUploaded === true,
    testimonialVideoUploaded: args.testimonialVideoUploaded === true,
    frictionNotes: trimOrUndefined(args.frictionNotes),
    followUpOk: args.followUpOk === true,
  };

  file.records[record.id] = record;
  await writeFileAtomic(path, file);
  return record;
}

function trimOrUndefined(s?: string | null): string | undefined {
  const v = (s ?? '').trim();
  return v.length > 0 ? v : undefined;
}

/** Get a feedback record by user id, or null. */
export async function getFeedbackByUserId(
  userId: string,
): Promise<FeedbackRecord | null> {
  if (!userId) return null;
  const file = await readFileSafe(resolveStorePath());
  for (const r of Object.values(file.records)) {
    if (r.userId === userId) return r;
  }
  return null;
}

/** Get a feedback record by id, or null. */
export async function getFeedbackById(
  id: string,
): Promise<FeedbackRecord | null> {
  if (!id) return null;
  const file = await readFileSafe(resolveStorePath());
  return file.records[id] ?? null;
}

/** Return every feedback record, newest first. */
export async function listFeedback(): Promise<FeedbackRecord[]> {
  const file = await readFileSafe(resolveStorePath());
  return Object.values(file.records).sort((a, b) =>
    b.submittedAt.localeCompare(a.submittedAt),
  );
}

/** Set of user ids that have submitted feedback. */
export async function getFeedbackUserIds(): Promise<Set<string>> {
  const file = await readFileSafe(resolveStorePath());
  const out = new Set<string>();
  for (const r of Object.values(file.records)) out.add(r.userId);
  return out;
}

/** Test-only: wipe the store. */
export async function _resetFeedbackStoreForTest(): Promise<void> {
  const path = resolveStorePath();
  try {
    await fs.unlink(path);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}
