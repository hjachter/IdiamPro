/**
 * Social format templates — the lightweight, EXTENSIBLE registry that lets the
 * "Share to Social" wizard support one platform today (X) and grow to many
 * (Instagram, LinkedIn, Facebook, Threads, Bluesky, YouTube, short-form video)
 * by adding ONE new template entry each — no new plumbing.
 *
 * A "social format template" is a small, declarative description of a platform's
 * output shape:
 *   - id / label / shareLabel — identity + UI copy
 *   - iconKey                 — which glyph the dialog renders (mapped in the UI)
 *   - charLimit               — per-post character budget (a hard cap the AI flow
 *                               and a safety splitter both respect)
 *   - supportsThread / supportsSingle — which post modes the platform allows
 *   - promptRules             — the platform-specific guidance handed to the AI
 *   - buildIntentUrl          — optional web-compose "intent" URL for the FIRST
 *                               post (no OAuth, no API — just a prefilled compose
 *                               window the user reviews and posts themselves)
 *   - intentNote / intentLabel — UI copy for that hand-off
 *   - fileExtension           — download file type for the thread text
 *
 * This is deliberately NOT a giant abstraction. It is a plain data shape plus a
 * lookup. Share-to-X is simply its first instance.
 */

export type SocialPostMode = 'thread' | 'single';

export interface SocialTemplate {
  /** Stable machine id — also the AI-flow platform key and localStorage sub-key. */
  id: string;
  /** Short platform name for headers/badges (e.g. "X"). */
  label: string;
  /** Value-based action label for menus/buttons (e.g. "Share to X"). */
  shareLabel: string;
  /** One-line tooltip explaining the action. */
  tooltip: string;
  /** Icon identifier the dialog maps to a rendered glyph. */
  iconKey: 'x' | 'instagram' | 'generic';
  /**
   * Output family this platform belongs to:
   *   'text'      — text posts (thread / single). X.
   *   'instagram' — Instagram caption OR branded carousel images.
   * The dialog branches on this to show the right controls and hand-offs.
   * Defaults to 'text' when omitted (back-compat with the first template).
   */
  outputKind?: 'text' | 'instagram';
  /** Per-post character budget. Hard cap enforced end-to-end. */
  charLimit: number;
  /** Whether a multi-post thread makes sense on this platform. */
  supportsThread: boolean;
  /** Whether a single condensed post makes sense on this platform. */
  supportsSingle: boolean;
  /** Platform-specific rules injected into the AI prompt. */
  promptRules: string;
  /** Build a no-login web-compose "intent" URL prefilled with the first post.
   *  Undefined when the platform has no such hand-off. */
  buildIntentUrl?: (firstPost: string) => string;
  /** Button label for the intent hand-off (e.g. "Open in X"). */
  intentLabel?: string;
  /** Honest note that intent can only prefill the FIRST post. */
  intentNote?: string;
  /** Download file extension (without the dot). */
  fileExtension: string;
}

/**
 * X (formerly Twitter). The first social format template.
 *
 * Intent hand-off uses X's public web-compose intent, which can prefill ONLY
 * the first post's text (no thread prefill exists without the API/OAuth). The
 * UI makes that limit clear and keeps the rest on the clipboard for pasting.
 */
export const X_TEMPLATE: SocialTemplate = {
  id: 'x',
  label: 'X',
  shareLabel: 'Share to X',
  tooltip: 'Turn this branch into a ready-to-post X thread or single post — you review and post it yourself.',
  iconKey: 'x',
  charLimit: 280,
  supportsThread: true,
  supportsSingle: true,
  promptRules: [
    'Platform: X (formerly Twitter).',
    'Each post MUST be 280 characters or fewer — this is a hard limit, count carefully.',
    'The FIRST post is the hook: a punchy, scroll-stopping opener that makes people want to read on. No "1/" numbering on the hook itself.',
    'Write in a natural, human, conversational voice — not a bland summary. Short sentences. Line breaks are fine within a post.',
    'Weave in a few genuinely relevant hashtags where they fit naturally (2-3 across the thread, not on every post). Do not hashtag-stuff.',
    'Do NOT prefix posts with numbers like "1/7" — the app numbers them for the user.',
    'No markdown, no bullet characters, no code fences — just plain post text as a person would type it.',
  ].join('\n'),
  buildIntentUrl: (firstPost: string) =>
    `https://twitter.com/intent/tweet?text=${encodeURIComponent(firstPost)}`,
  intentLabel: 'Open in X',
  intentNote:
    'Opens X’s compose window prefilled with the FIRST post only (that’s all X allows without an account connection). Copy the rest and paste each as a reply to build the thread.',
  fileExtension: 'txt',
};

/**
 * Instagram. The second social format template.
 *
 * Instagram has NO usable web "compose" intent for posting (especially on
 * desktop), so there is deliberately NO buildIntentUrl — we never fake an
 * "Open in Instagram" button. The honest hand-off is: download the images +
 * copy the caption, then post from the phone. Its two output modes (a caption
 * with hashtags, or a branded square-image carousel) are handled by the dialog
 * via outputKind: 'instagram'.
 */
export const INSTAGRAM_TEMPLATE: SocialTemplate = {
  id: 'instagram',
  label: 'Instagram',
  shareLabel: 'Share to Instagram',
  tooltip: 'Turn this branch into an Instagram caption or a branded square-image carousel — you download and post it yourself from your phone.',
  iconKey: 'instagram',
  outputKind: 'instagram',
  charLimit: 2200,
  supportsThread: false,
  supportsSingle: false,
  // Prompt rules live in the Instagram AI flow (generate-instagram-post.ts),
  // which needs mode-specific guidance the flat promptRules string can't carry.
  promptRules: 'Platform: Instagram. Warm, human voice; natural hashtags; caption or branded carousel slides.',
  // No buildIntentUrl by design — Instagram has no honest desktop compose intent.
  intentNote:
    'Instagram posts from your phone — download these and post from the Instagram app. IdeaM never posts for you.',
  fileExtension: 'txt',
};

/** The registry. Add a new template here to support a new platform. */
export const SOCIAL_TEMPLATES: SocialTemplate[] = [X_TEMPLATE, INSTAGRAM_TEMPLATE];

/** Look up a template by id. */
export function getSocialTemplate(id: string): SocialTemplate | undefined {
  return SOCIAL_TEMPLATES.find((t) => t.id === id);
}

/** Enforce a template's per-post character cap as a safety net, independent of
 *  what the model returns.
 *  - Thread mode: any over-limit post is split at word boundaries into several.
 *  - Single mode: the one post is hard-truncated with an ellipsis.
 *  This guarantees the "every post is within the limit" invariant always holds. */
export function enforceCharLimit(
  posts: string[],
  limit: number,
  mode: SocialPostMode,
): string[] {
  const clean = posts.map((p) => p.trim()).filter((p) => p.length > 0);
  if (mode === 'single') {
    const first = clean[0] || '';
    if (first.length <= limit) return [first];
    return [first.slice(0, Math.max(0, limit - 1)).trimEnd() + '…'];
  }
  const out: string[] = [];
  for (const post of clean) {
    if (post.length <= limit) {
      out.push(post);
      continue;
    }
    // Split an over-long post at word boundaries into limit-sized chunks.
    const words = post.split(/\s+/);
    let chunk = '';
    for (const word of words) {
      const candidate = chunk ? `${chunk} ${word}` : word;
      if (candidate.length <= limit) {
        chunk = candidate;
      } else {
        if (chunk) out.push(chunk);
        // A single word longer than the limit — hard-slice it.
        if (word.length > limit) {
          let rest = word;
          while (rest.length > limit) {
            out.push(rest.slice(0, limit));
            rest = rest.slice(limit);
          }
          chunk = rest;
        } else {
          chunk = word;
        }
      }
    }
    if (chunk) out.push(chunk);
  }
  return out;
}
