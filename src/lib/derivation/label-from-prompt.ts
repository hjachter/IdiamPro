// Derivative-outline label helper (2026-06-10).
//
// Pure string manipulation — no AI call. Given a user's instruction text for
// a transform (e.g. "rewrite for middle schoolers"), produce a short, human
// label suitable for tagging the derived outline (e.g. "Middle Schoolers
// Version"). Used by Transform / Reformat / Refresh / Translate dialogs to
// pre-fill the editable derivation-label field.

// Common filler verbs / phrases users type at the start of a transform
// instruction. These describe the ACTION, not the OUTCOME — strip them so the
// label centres on the outcome.
const FILLER_PREFIXES = [
  'rewrite',
  'rewrite as',
  'rewrite for',
  'rewrite to',
  'rewrite into',
  'make it',
  'make this',
  'make',
  'convert to',
  'convert into',
  'convert',
  'transform into',
  'transform to',
  'transform',
  'turn this into',
  'turn into',
  'turn it into',
  'turn into a',
  'turn',
  'reformat as',
  'reformat to',
  'reformat into',
  'reformat',
  'change to',
  'change into',
  'change',
  'reorganize as',
  'reorganize',
  'restructure as',
  'restructure',
];

// Tail filler — words that add no information at the end ("version", "of it",
// "of this", "of the outline", etc.). We DO append "Version" at the end of
// the cleaned phrase if it would otherwise feel naked, so strip any user-typed
// duplicates first.
const TRAILING_NOISE = /\s+(version|of (it|this|the (outline|content|text)))$/i;

const MAX_LEN = 30;

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map(w => (w.length === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

/**
 * Suggest a short, editable derivation label from the user's prompt text.
 * Pure function — safe in any runtime. Always returns a non-empty string
 * (falls back to "Modified" when nothing meaningful can be extracted).
 */
export function suggestDerivationLabel(promptText: string): string {
  if (!promptText) return 'Modified';
  let text = promptText.trim();
  if (!text) return 'Modified';

  // Strip leading filler phrases (longest match first).
  const lower = text.toLowerCase();
  for (const filler of FILLER_PREFIXES) {
    if (lower.startsWith(filler + ' ')) {
      text = text.slice(filler.length + 1).trim();
      break;
    }
    if (lower === filler) {
      text = '';
      break;
    }
  }

  // Strip a leading "for " ("rewrite for middle schoolers" → "middle schoolers"
  // after first pass already drops "rewrite", but a bare "for middle schoolers"
  // would still keep "for"). Same for "as" / "into".
  text = text.replace(/^(for|as|into|to|in)\s+/i, '').trim();

  // Drop trailing noise tokens.
  text = text.replace(TRAILING_NOISE, '').trim();

  // Drop punctuation at edges.
  text = text.replace(/^[\s.,;:!?-]+|[\s.,;:!?-]+$/g, '');

  if (!text) return 'Modified';

  // Take the first 4-6 meaningful words. Cap to ~6 to keep labels short.
  const words = text.split(/\s+/).slice(0, 6);
  let result = words.join(' ');

  // Title-case if original was all lowercase (looks more like a label).
  if (result === result.toLowerCase()) {
    result = titleCase(result);
  }

  // Append "Version" if the label is just a noun phrase that doesn't already
  // hint at being a derivative form. Skip when the label already ends with
  // a noun like "Summary" / "Outline" / "Notes" / "Edition" / "Format" that
  // stands alone.
  const standaloneEndings = /\b(summary|outline|notes?|edition|format|draft|copy|cut|brief|recap|pitch|memo|version)$/i;
  if (!standaloneEndings.test(result)) {
    if (result.length + ' Version'.length <= MAX_LEN) {
      result = `${result} Version`;
    }
  }

  // Hard cap on length.
  if (result.length > MAX_LEN) {
    result = result.slice(0, MAX_LEN).trim();
    // Avoid trailing partial word — trim back to last space if we cut mid-word.
    const lastSpace = result.lastIndexOf(' ');
    if (lastSpace > 10) result = result.slice(0, lastSpace);
  }

  return result || 'Modified';
}

/**
 * Build a default label for a Refresh-from-Web derivative — date-stamped.
 */
export function suggestRefreshLabel(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `Refreshed ${y}-${m}-${d}`;
}

/**
 * Build a default label for a Translate derivative.
 */
export function suggestTranslateLabel(targetLanguage: string): string {
  if (!targetLanguage) return 'Translated';
  return `In ${targetLanguage}`;
}
