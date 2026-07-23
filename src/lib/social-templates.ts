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
  iconKey: 'x' | 'instagram' | 'linkedin' | 'facebook' | 'threads' | 'bluesky' | 'youtube' | 'generic';
  /**
   * Output family this platform belongs to:
   *   'text'      — text posts (thread / single). X.
   *   'instagram' — Instagram caption OR branded carousel images.
   *   'youtube'   — a YouTube publish package (title options + description with
   *                 chapters + tags + thumbnail idea) plus a Shorts variant.
   * The dialog branches on this to show the right controls and hand-offs.
   * Defaults to 'text' when omitted (back-compat with the first template).
   */
  outputKind?: 'text' | 'instagram' | 'youtube';
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

/**
 * LinkedIn. A professional, story-arc post — longer-form than X.
 *
 * LinkedIn has NO reliable pre-filled text compose URL (its sharer only takes a
 * link, not post text), so there is deliberately NO buildIntentUrl — we never
 * fake an "Open in LinkedIn" button. The honest hand-off is copy + download the
 * text, then paste it into LinkedIn yourself.
 */
export const LINKEDIN_TEMPLATE: SocialTemplate = {
  id: 'linkedin',
  label: 'LinkedIn',
  shareLabel: 'Share to LinkedIn',
  tooltip: 'Turn this branch into a professional, story-arc LinkedIn post — you copy or download it and post it yourself.',
  iconKey: 'linkedin',
  charLimit: 3000,
  supportsThread: false,
  supportsSingle: true,
  promptRules: [
    'Platform: LinkedIn (professional network).',
    'Write ONE post, longer-form: roughly 1 to 3 short paragraphs. Stay well within 3000 characters.',
    'Open with a STRONG first line — a hook that stands alone as the preview line and makes people click "see more". No greeting, no "I\'m excited to share".',
    'Professional but human and warm — a clear story arc or point of view, not a dry summary. Use short paragraphs with blank lines between them for readability (LinkedIn rewards white space).',
    'End with a light takeaway or a gentle question that invites discussion.',
    'Add a FEW tasteful, relevant hashtags at the very end (about 3-5) — professional, not spammy.',
    'No markdown, no bullet characters, no code fences — just plain post text with line breaks as a person would type it.',
  ].join('\n'),
  // No buildIntentUrl by design — LinkedIn has no honest pre-filled text compose.
  intentNote:
    'LinkedIn has no way to pre-fill a post from outside, so copy or download this and paste it into a new LinkedIn post yourself. IdeaM never posts for you.',
  fileExtension: 'txt',
};

/**
 * Facebook. A friendly, engaging, conversational post.
 *
 * Facebook's sharer only shares a URL — it has NO usable pre-filled TEXT compose
 * — so there is deliberately NO buildIntentUrl and no fake "Open in Facebook"
 * button. Honest hand-off: copy + download, then paste it yourself.
 */
export const FACEBOOK_TEMPLATE: SocialTemplate = {
  id: 'facebook',
  label: 'Facebook',
  shareLabel: 'Share to Facebook',
  tooltip: 'Turn this branch into a friendly, engaging Facebook post — you copy or download it and post it yourself.',
  iconKey: 'facebook',
  charLimit: 2000,
  supportsThread: false,
  supportsSingle: true,
  promptRules: [
    'Platform: Facebook.',
    'Write ONE post, friendly and conversational — a bit more casual and personal than LinkedIn, like talking to friends and followers. Stay within 2000 characters.',
    'Open with something relatable or intriguing. Warm, human, story-driven; short paragraphs with line breaks are welcome.',
    'Keep hashtags MINIMAL — zero to two at most, only if they genuinely fit (Facebook is not a hashtag platform).',
    'A gentle call to comment, react, or share at the end is fine when natural.',
    'No markdown, no bullet characters, no code fences — just plain post text with line breaks as a person would type it.',
  ].join('\n'),
  // No buildIntentUrl by design — Facebook has no honest pre-filled text compose.
  intentNote:
    'Facebook can only pre-fill a link, not post text, so copy or download this and paste it into a new Facebook post yourself. IdeaM never posts for you.',
  fileExtension: 'txt',
};

/**
 * Threads. A casual, punchy post — or a short numbered sequence if long.
 *
 * Threads DOES support a public web-compose intent that pre-fills post text, so
 * it gets an honest "Open in Threads" hand-off (first post only; the rest stay
 * on the clipboard for pasting as replies to build the sequence).
 */
export const THREADS_TEMPLATE: SocialTemplate = {
  id: 'threads',
  label: 'Threads',
  shareLabel: 'Share to Threads',
  tooltip: 'Turn this branch into a casual, punchy Threads post (or a short numbered sequence) — you review and post it yourself.',
  iconKey: 'threads',
  charLimit: 500,
  supportsThread: true,
  supportsSingle: true,
  promptRules: [
    'Platform: Threads (Meta).',
    'Each post MUST be 500 characters or fewer — a hard limit, count carefully.',
    'Voice: casual, punchy, conversational and human — like texting a smart friend. Short sentences. Line breaks within a post are fine.',
    'In SINGLE mode: one tight, self-contained post. In THREAD mode: a short numbered SEQUENCE where the first post is the hook and each follow-on develops one idea.',
    'A hashtag or two is fine where it fits naturally — Threads is light on hashtags, so do not stuff them.',
    'Do NOT prefix posts with numbers like "1/5" — the app numbers them for the user.',
    'No markdown, no bullet characters, no code fences — just plain post text.',
  ].join('\n'),
  buildIntentUrl: (firstPost: string) =>
    `https://www.threads.net/intent/post?text=${encodeURIComponent(firstPost)}`,
  intentLabel: 'Open in Threads',
  intentNote:
    'Opens Threads’ compose window prefilled with the FIRST post only. Copy the rest and paste each as a reply to build the sequence.',
  fileExtension: 'txt',
};

/**
 * Bluesky. A casual post within Bluesky's ~300-character limit.
 *
 * Bluesky DOES support a public web-compose intent that pre-fills post text, so
 * it gets an honest "Open in Bluesky" hand-off prefilled with the post.
 */
export const BLUESKY_TEMPLATE: SocialTemplate = {
  id: 'bluesky',
  label: 'Bluesky',
  shareLabel: 'Share to Bluesky',
  tooltip: 'Turn this branch into a casual Bluesky post within its ~300-character limit — you review and post it yourself.',
  iconKey: 'bluesky',
  charLimit: 300,
  supportsThread: false,
  supportsSingle: true,
  promptRules: [
    'Platform: Bluesky.',
    'Write ONE post of 300 characters or fewer — a hard limit, count carefully.',
    'Voice: casual, human, conversational — friendly and a little witty, not corporate. Condense the whole branch into one compelling post.',
    'Hashtags are used lightly on Bluesky — include at most one if it genuinely fits, otherwise none.',
    'No markdown, no bullet characters, no code fences — just plain post text.',
  ].join('\n'),
  buildIntentUrl: (firstPost: string) =>
    `https://bsky.app/intent/compose?text=${encodeURIComponent(firstPost)}`,
  intentLabel: 'Open in Bluesky',
  intentNote:
    'Opens Bluesky’s compose window prefilled with your post. Review it and post it yourself.',
  fileExtension: 'txt',
};

/**
 * YouTube. The final social format template and a natural fit — the app already
 * GENERATES video (Generate Video → a narrated slideshow MP4) and IMPORTS from
 * YouTube. This template's value is the AI-written PUBLISH PACKAGE that makes an
 * outline video ready to post: title options, a description with chapter
 * timestamps, tags, and a thumbnail idea — plus a Shorts variant (a punchy title
 * + a tight vertical script). Its output is handled by the dialog via
 * outputKind: 'youtube'.
 *
 * There is deliberately NO buildIntentUrl for posting: a YouTube upload requires
 * a signed-in account and cannot be pre-filled without the OAuth Data API (out of
 * scope). The honest hand-off is copy (title / description / tags / all) +
 * download the package as .txt, with an optional link that just opens the real
 * YouTube upload page for the user to fill in by pasting.
 */
export const YOUTUBE_TEMPLATE: SocialTemplate = {
  id: 'youtube',
  label: 'YouTube',
  shareLabel: 'Share to YouTube',
  tooltip: 'Turn this branch into a YouTube publish package — title, description with chapters, tags and a thumbnail idea (plus a Shorts variant). Pairs with Generate Video for the actual MP4; you upload and paste it yourself.',
  iconKey: 'youtube',
  outputKind: 'youtube',
  // Not a per-post text platform; the char cap is nominal for the shape.
  charLimit: 5000,
  supportsThread: false,
  supportsSingle: false,
  // Prompt rules live in the YouTube AI flow (generate-youtube-package.ts),
  // which needs variant-specific guidance the flat promptRules string can't carry.
  promptRules: 'Platform: YouTube. A publish package: SEO title options, a description with chapter timestamps, tags, and a thumbnail idea; plus a vertical Shorts variant.',
  // No buildIntentUrl by design — YouTube upload needs sign-in + OAuth to pre-fill.
  intentNote:
    'YouTube uploads need you to be signed in and can’t be pre-filled from outside. Generate your video, then upload it to YouTube and paste this title, description, and tags. IdeaM never posts for you.',
  fileExtension: 'txt',
};

/** The registry. Add a new template here to support a new platform. */
export const SOCIAL_TEMPLATES: SocialTemplate[] = [
  X_TEMPLATE,
  INSTAGRAM_TEMPLATE,
  LINKEDIN_TEMPLATE,
  FACEBOOK_TEMPLATE,
  THREADS_TEMPLATE,
  BLUESKY_TEMPLATE,
  YOUTUBE_TEMPLATE,
];

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
