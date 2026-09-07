// ============================================================================
// compile-core / clean-text — THE canonical HTML-strip / clean-text engine.
// ----------------------------------------------------------------------------
// Phase 0 of the content-compiler architecture (docs/content-compiler-
// architecture.md). Before this module, near-identical HTML-stripping chains
// were re-implemented privately in at least six places (AI flows, podcast,
// serializer, exporters, video slides, deck). They are now ONE engine that
// applies a preset-selected, ordered rule chain and trims the result.
//
// ZERO BEHAVIOR CHANGE: each preset reproduces its source implementation
// byte-for-byte (verified by tests/compile-core-test.js against frozen verbatim
// copies of the old code plus a pre-migration golden capture). The presets
// intentionally differ — e.g. the exporter preset renders list items as "• "
// while prompt text uses "- " — because their consumers' outputs must not
// change. Later phases may converge presets deliberately; Phase 0 never does.
// ============================================================================

type Replacement = string | ((substring: string, ...args: string[]) => string);
type Rule = readonly [RegExp, Replacement];

/** Which historical cleaning behavior to reproduce. */
export type CleanTextPreset =
  /** AI prompt text — the 5 identical copies from src/ai/flows/* and the
   *  hallucination verifier ("stripHtmlToText"). Lists become "- " bullets. */
  | 'prompt'
  /** Podcast source extraction (src/lib/podcast-generator.ts). Like
   *  'serializer' but without list-item markers. */
  | 'podcast'
  /** Second-Brain outline serialization (src/lib/outline-serializer.ts).
   *  Markdown-ish: list items become "- ". */
  | 'serializer'
  /** File exporters + website templates (BaseExporter/BaseWebsiteTemplate).
   *  Paragraphs get a blank line; list items become "• ". */
  | 'exporter'
  /** Video slide prose (src/lib/video/derive-slides.ts): tags to spaces,
   *  minimal entities, ALL whitespace collapsed to single spaces. */
  | 'video-inline'
  /** Bare inline strip (suggest-tags, multimedia proposals): tags to spaces,
   *  collapse whitespace, NO entity decoding. */
  | 'bare-inline'
  /** Deck block text (src/lib/deck/derive-deck.ts stripHtml): full entity
   *  decode (named + numeric), newline-preserving, punctuation-space fixes. */
  | 'rich-block'
  /** Deck one-line text (derive-deck cleanText): full entity decode, single
   *  line, punctuation-space fixes. */
  | 'rich-inline';

function safeCodePoint(cp: number): string {
  if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return ' ';
  try {
    return String.fromCodePoint(cp);
  } catch {
    return ' ';
  }
}

// Entity rule groups (order inside each group is load-bearing — &amp; first
// in the standard group, exactly as the historical implementations had it).
const ENTITIES_PROMPT: Rule[] = [
  [/&nbsp;/gi, ' '],
  [/&amp;/gi, '&'],
  [/&lt;/gi, '<'],
  [/&gt;/gi, '>'],
];

const ENTITIES_STANDARD: Rule[] = [
  [/&amp;/g, '&'],
  [/&lt;/g, '<'],
  [/&gt;/g, '>'],
  [/&quot;/g, '"'],
  [/&#39;/g, "'"],
  [/&nbsp;/g, ' '],
];

const ENTITIES_RICH: Rule[] = [
  [/&nbsp;/g, ' '],
  [/&amp;/g, '&'],
  [/&lt;/g, '<'],
  [/&gt;/g, '>'],
  [/&middot;/g, ' · '],
  [/&bull;/g, ' · '],
  [/&mdash;/g, ' — '],
  [/&ndash;/g, '–'],
  [/&times;/g, '×'],
  [/&hellip;/g, '…'],
  [/&ldquo;|&rdquo;|&quot;/g, '"'],
  [/&lsquo;|&rsquo;|&apos;/g, "'"],
  [/&#(\d+);/g, (_m, n) => safeCodePoint(parseInt(n, 10))],
  [/&#x([0-9a-fA-F]+);/g, (_m, n) => safeCodePoint(parseInt(n, 16))],
];

// Punctuation tidy-up shared by the rich presets: drop the space a stripped
// tag left before punctuation / after an opening paren.
const PUNCTUATION_FIX: Rule[] = [
  [/\s+([,.;:!?%)])/g, '$1'],
  [/([(])\s+/g, '$1'],
];

const PRESET_RULES: Record<CleanTextPreset, Rule[]> = {
  prompt: [
    [/<br\s*\/?>/gi, '\n'],
    [/<\/(p|div|li|h[1-6])>/gi, '\n'],
    [/<li[^>]*>/gi, '- '],
    [/<[^>]+>/g, ''],
    ...ENTITIES_PROMPT,
    [/\n{3,}/g, '\n\n'],
  ],
  podcast: [
    [/<br\s*\/?>/gi, '\n'],
    [/<\/p>/gi, '\n'],
    [/<\/div>/gi, '\n'],
    [/<\/li>/gi, '\n'],
    [/<[^>]+>/g, ''],
    ...ENTITIES_STANDARD,
    [/\n{3,}/g, '\n\n'],
  ],
  serializer: [
    [/<br\s*\/?>/gi, '\n'],
    [/<\/p>/gi, '\n'],
    [/<\/div>/gi, '\n'],
    [/<\/li>/gi, '\n'],
    [/<li[^>]*>/gi, '- '],
    [/<[^>]+>/g, ''],
    ...ENTITIES_STANDARD,
    [/\n{3,}/g, '\n\n'],
  ],
  exporter: [
    [/<br\s*\/?>/gi, '\n'],
    [/<\/p>/gi, '\n\n'],
    [/<\/div>/gi, '\n'],
    [/<li[^>]*>/gi, '• '],
    [/<\/li>/gi, '\n'],
    [/<[^>]+>/g, ''],
    ...ENTITIES_STANDARD,
    [/\n{3,}/g, '\n\n'],
  ],
  'video-inline': [
    [/<[^>]+>/g, ' '],
    [/&nbsp;/g, ' '],
    [/&amp;/g, '&'],
    [/&lt;/g, '<'],
    [/&gt;/g, '>'],
    [/\s+/g, ' '],
  ],
  'bare-inline': [
    [/<[^>]+>/g, ' '],
    [/\s+/g, ' '],
  ],
  'rich-block': [
    [/<\/(p|div|li|h[1-6]|tr|ul|ol)>/gi, '\n'],
    [/<br\s*\/?>/gi, '\n'],
    [/<[^>]+>/g, ' '],
    ...ENTITIES_RICH,
    [/[^\S\n]+/g, ' '],
    [/ *\n */g, '\n'],
    [/\n{2,}/g, '\n'],
    ...PUNCTUATION_FIX,
  ],
  'rich-inline': [
    [/<[^>]+>/g, ' '],
    ...ENTITIES_RICH,
    [/\s+/g, ' '],
    ...PUNCTUATION_FIX,
  ],
};

/**
 * Strip HTML to plain text using one canonical engine.
 * The preset selects which historical behavior to reproduce (byte-identical).
 */
export function htmlToPlainText(
  html: string | null | undefined,
  preset: CleanTextPreset = 'prompt',
): string {
  let s = String(html ?? '');
  for (const [re, rep] of PRESET_RULES[preset]) {
    s = s.replace(re, rep as string);
  }
  return s.trim();
}

/**
 * Decode the HTML entities our outlines actually contain — named + numeric —
 * so real characters (not "&ldquo;") reach the output. Formerly private to
 * the deck deriver; now the one shared implementation.
 */
export function decodeEntities(s: string | null | undefined): string {
  let out = String(s ?? '');
  for (const [re, rep] of ENTITIES_RICH) {
    out = out.replace(re, rep as string);
  }
  return out;
}
