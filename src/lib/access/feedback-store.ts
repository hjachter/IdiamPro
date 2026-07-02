/**
 * Feedback store — durable record of every beta-feedback submission.
 *
 * The beta-feedback form (/feedback) collects NPS, per-feature ratings,
 * open-ended responses, workflow context, testimonial consent, and friction
 * questions. Submitting unlocks a 1-year Pro entitlement for the user.
 *
 * Storage routes through `src/lib/storage/adapter.ts`. In production
 * (Vercel) that's Vercel KV / Upstash Redis when `KV_REST_API_URL` +
 * `KV_REST_API_TOKEN` are set. In Electron / dev / test it's atomic-write
 * JSON files under `.idiampro/`. Same public API either way.
 *
 * Key layout:
 *   - `feedback:<id>`              one FeedbackRecord per id
 *   - `feedback:all`               set/index of all feedback ids
 *   - `feedback-user:<userId>`     reverse-lookup id by user id (one
 *                                  submission per user — idempotent)
 */

import { randomUUID } from 'crypto';
import { getStorage } from '../storage/adapter';
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

const KEY_FEEDBACK = (id: string) => `feedback:${id}`;
const KEY_INDEX = 'feedback:all';
const KEY_USER_LOOKUP = (userId: string) => `feedback-user:${userId}`;

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
  if (!Number.isFinite(args.nps) || args.nps < 0 || args.nps > 10) {
    throw new Error('NPS must be between 0 and 10.');
  }
  if (
    !Number.isFinite(args.overallStars) ||
    args.overallStars < 1 ||
    args.overallStars > 5
  ) {
    throw new Error('Overall stars must be between 1 and 5.');
  }

  const storage = getStorage();

  // Idempotent on userId — re-submitting the form returns the original record.
  const existingId = await storage.get<string>(KEY_USER_LOOKUP(args.userId));
  if (existingId) {
    const existing = await storage.get<FeedbackRecord>(KEY_FEEDBACK(existingId));
    if (existing) return existing;
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

  await storage.set(KEY_FEEDBACK(record.id), record);
  await storage.set(KEY_USER_LOOKUP(args.userId), record.id);
  await storage.setAdd(KEY_INDEX, record.id);
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
  const storage = getStorage();
  const id = await storage.get<string>(KEY_USER_LOOKUP(userId));
  if (!id) return null;
  return storage.get<FeedbackRecord>(KEY_FEEDBACK(id));
}

/** Get a feedback record by id, or null. */
export async function getFeedbackById(
  id: string,
): Promise<FeedbackRecord | null> {
  if (!id) return null;
  return getStorage().get<FeedbackRecord>(KEY_FEEDBACK(id));
}

/** Return every feedback record, newest first. */
export async function listFeedback(): Promise<FeedbackRecord[]> {
  const storage = getStorage();
  const ids = await storage.setMembers(KEY_INDEX);
  if (ids.length === 0) return [];
  const records: FeedbackRecord[] = [];
  for (const id of ids) {
    const r = await storage.get<FeedbackRecord>(KEY_FEEDBACK(id));
    if (r) records.push(r);
  }
  return records.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

/** Set of user ids that have submitted feedback. */
export async function getFeedbackUserIds(): Promise<Set<string>> {
  const records = await listFeedback();
  const out = new Set<string>();
  for (const r of records) out.add(r.userId);
  return out;
}

/**
 * Delete the feedback record tied to a Clerk user id (if any).
 *
 * Used by the in-app "Delete Account" flow to erase server-side feedback we
 * hold for the user. Best-effort and idempotent.
 */
export async function deleteFeedbackByUserId(userId: string): Promise<boolean> {
  const target = (userId ?? '').trim();
  if (!target) return false;
  const storage = getStorage();
  const id = await storage.get<string>(KEY_USER_LOOKUP(target));
  if (!id) return false;
  await storage.delete(KEY_FEEDBACK(id));
  await storage.delete(KEY_USER_LOOKUP(target));
  await storage.setRemove(KEY_INDEX, id);
  return true;
}

/** Test-only: wipe the store. */
export async function _resetFeedbackStoreForTest(): Promise<void> {
  const storage = getStorage();
  const ids = await storage.setMembers(KEY_INDEX);
  for (const id of ids) {
    const rec = await storage.get<FeedbackRecord>(KEY_FEEDBACK(id));
    if (rec) await storage.delete(KEY_USER_LOOKUP(rec.userId));
    await storage.delete(KEY_FEEDBACK(id));
    await storage.setRemove(KEY_INDEX, id);
  }
}
