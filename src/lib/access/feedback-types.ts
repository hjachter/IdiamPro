/**
 * Feedback types — pure-TypeScript shapes used by both the client form
 * (/feedback page, /admin/feedback dashboard) and the Node-only feedback
 * store (src/lib/access/feedback-store.ts).
 *
 * Lives in its own file so the client bundle never has to pull in `fs`
 * or other Node-only modules just to know what a FeedbackRecord looks like.
 */

/** Verbatim list of the marketing site's "killer features" — these become
 * the per-feature rating rows on the feedback form. Pulled from
 * src/app/page.tsx lines 1247-1267 ("What SecondBrainWare does differently")
 * + three supplemental items so we always have a workable set. */
export const FEEDBACK_FEATURE_KEYS = [
  'multi_source_synthesis',
  'ten_plus_source_types',
  'ai_native_from_day_one',
  'true_cross_platform',
  'your_data_your_way',
  'ai_smart_tools',
  'outline_search',
  'second_brain',
] as const;

export type FeedbackFeatureKey = (typeof FEEDBACK_FEATURE_KEYS)[number];

export interface FeedbackFeatureLabel {
  label: string;
  description: string;
}

/** Human-readable labels for the keys above. The label is the verbatim copy
 * pulled from the marketing site; the description is the short line from
 * the same card. Keep both columns in sync with src/app/page.tsx. */
export const FEEDBACK_FEATURE_LABELS: Record<FeedbackFeatureKey, FeedbackFeatureLabel> = {
  multi_source_synthesis: {
    label: 'Multi-source synthesis',
    description: 'Import 50+ sources and let AI organize by theme',
  },
  ten_plus_source_types: {
    label: '10+ source types',
    description: 'YouTube, PDFs, audio with transcription, web pages, docs',
  },
  ai_native_from_day_one: {
    label: 'AI-native from day one',
    description: 'Content generation, synthesis, diagrams, podcasts',
  },
  true_cross_platform: {
    label: 'True cross-platform',
    description: 'Identical experience on Mac, iPhone, iPad, and web',
  },
  your_data_your_way: {
    label: 'Your data, your way',
    description: '9 export formats, local-first storage, no lock-in',
  },
  ai_smart_tools: {
    label: 'AI Smart Tools',
    description: 'Reformat, transform, translate — every menu in plain English',
  },
  outline_search: {
    label: 'Outline Search',
    description: 'Compress-not-hide search across one outline or all of them',
  },
  second_brain: {
    label: 'Second Brain',
    description: 'A single always-on outline that captures everything to remember',
  },
};

export interface FeedbackFeatureRating {
  /** 1-5 stars, or null if the user marked "Didn't try this yet". */
  stars: number | null;
  /** Free-form one-liner. Limit ~120 chars enforced client-side. */
  comment?: string;
}

export type TestimonialAttribution =
  | 'full_name_title'
  | 'first_name_role'
  | 'initials_only'
  | 'anonymous';

export interface FeedbackRecord {
  id: string;
  userId: string;
  name: string;
  email: string;
  submittedAt: string;

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
  testimonialVideoUploaded?: boolean;
  testimonialPhotoUploaded?: boolean;

  frictionNotes?: string;
  followUpOk?: boolean;
}
