/**
 * Discovery Hints registry — the central catalog of "Did You Know?" tips
 * the app surfaces to new users.
 *
 * Design contract:
 *
 * 1. Each hint has a stable `id`. The id is what gets persisted in the
 *    user's "dismissed" set, so renaming an id resets the dismissal state
 *    for that hint (intentional — that's how we re-surface a hint after a
 *    meaningful copy change).
 *
 * 2. Each hint declares a single `trigger` — a string event key. Call sites
 *    fire trigger events via `fireDiscovery(triggerKey)` from
 *    `use-discovery.ts`. The hook decides whether to actually surface the
 *    hint (filters out dismissed hints, hints suppressed by Professional
 *    mode, and hints already visible).
 *
 * 3. Toast UX is **sticky** — discovery hints never auto-dismiss. The
 *    "Got it" button is the only path to dismissal. This is the explicit
 *    difference from the existing transient toast system in
 *    `use-toast.ts` — both systems coexist, used for different purposes.
 *
 * 4. Storage starts in localStorage. When Clerk userId becomes available
 *    we migrate to a DB row keyed by user. The hook exposes a small
 *    persistence interface (`load` / `saveDismissed` / `saveProfessional`)
 *    so swapping out the storage backend later is a one-file change.
 *
 * Triggers — v1 set:
 *   - 'editor-first-text-selection'    First time the user selects text in the editor
 *   - 'editor-first-paste'             First time the user pastes into the editor
 *   - 'sidebar-first-load'             First time the sidebar mounts
 *   - 'first-outline-created'          First "New Outline" / "Create Outline"
 *   - 'first-byok-prompt-encountered'  First time the user opens a BYOK key entry surface
 *   - 'first-cross-link-created'       First time an outline-link node is inserted
 *   - 'smart-tools-menu-opened'        First open of the Smart Tools dropdown
 *   - 'outline-has-content'            One-time: an outline first reaches a few nodes of real content
 *
 * Adding a hint:
 *   1. Append to `DISCOVERY_HINTS` below.
 *   2. Make sure the trigger key already exists in `DiscoveryTrigger` (or add one).
 *   3. Wire a `fireDiscovery(triggerKey)` call at the right place in the UI.
 *   4. Document the hint in the User Guide + Help Chat APP_CONTEXT.
 */

export type DiscoveryTrigger =
  | 'editor-first-text-selection'
  | 'editor-first-paste'
  | 'sidebar-first-load'
  | 'first-outline-created'
  | 'first-byok-prompt-encountered'
  | 'first-cross-link-created'
  | 'smart-tools-menu-opened'
  | 'outline-has-content';

export interface DiscoveryHint {
  /** Stable id — used as the dismissal key in storage. */
  id: string;
  /** Short eye-catching title (3-7 words). */
  title: string;
  /** One-sentence plain-language explanation. */
  body: string;
  /** Event key that surfaces this hint. */
  trigger: DiscoveryTrigger;
  /**
   * Optional delay before showing after the trigger fires. Useful when
   * several hints share a trigger and we want to stagger them so the user
   * sees one at a time instead of a pile-up.
   */
  minDelayMs?: number;
  /**
   * Optional path/URL for a "Learn more" link. v1 uses tooltips and the
   * User Guide; leave undefined to omit the link.
   */
  learnMoreUrl?: string;
}

/**
 * v1 hint registry — five carefully chosen tips.
 *
 * Discovery rules of thumb (Howard 2026-06-05):
 *   - Quality over quantity. Five is enough for launch.
 *   - The Reformat hint is the headline hint; it fires the moment the
 *     user selects text in the editor for the first time. This is the
 *     single most important "did you know" we ship in v1.
 *   - Other hints stagger via `minDelayMs` so they never pile up.
 */
export const DISCOVERY_HINTS: readonly DiscoveryHint[] = [
  {
    id: 'research-import-sources',
    title: 'Turn YouTube, PDFs & the web into outlines',
    body:
      'Use the Import menu (book-down icon) → "Research & Import" to pull in videos, PDFs, web pages, and recordings — AI synthesizes them into one structured outline.',
    trigger: 'sidebar-first-load',
  },
  {
    id: 'outline-to-media',
    title: 'Turn any outline into a video, podcast, or website',
    body:
      'Open the Export menu (book-up icon) to turn a section into a narrated video, a website, or a podcast. Your outline becomes the script.',
    trigger: 'first-outline-created',
    minDelayMs: 16000,
  },
  {
    id: 'reformat-with-ai',
    title: 'Reformat with AI is here',
    body:
      "You can describe a format change in plain language and IdiamPro's AI will do it. Try the violet wand at the left end of the floating toolbar.",
    trigger: 'editor-first-text-selection',
  },
  {
    id: 'smart-tools-menu',
    title: 'Smart Tools = your AI toolkit',
    body:
      'Translate, Refresh from Web, Ask Your Outlines, and more — all under the sparkle icon in the toolbar.',
    trigger: 'editor-first-text-selection',
    // Stagger after the Reformat hint so the two don't crowd each other.
    minDelayMs: 6000,
  },
  {
    id: 'cross-outline-link',
    title: 'Link one outline to another',
    body:
      'Use Import → "Link to Outline" to insert a clickable link to another outline. Linked outlines also nest under their parents in the sidebar.',
    trigger: 'first-outline-created',
    minDelayMs: 3000,
  },
  {
    id: 'import-export-toolbar',
    title: 'Import and Export live in the toolbar',
    body:
      'The book-down (Import) and book-up (Export) icons hold Research & Import, Backup All, Share Branch, and other bulk actions.',
    trigger: 'first-outline-created',
    minDelayMs: 10000,
  },
  {
    id: 'make-something-from-this',
    title: 'Ready to turn this into something?',
    body:
      'Your outline has enough to work with. Open the Export menu (book-up icon) to turn it into a narrated video, a website, a podcast, or 20+ formats.',
    // Fires once, guarded by a localStorage flag at the call site, the first
    // time an outline reaches a few nodes of real content. One-time by design.
    trigger: 'outline-has-content',
  },
  {
    id: 'byok-unlimited',
    title: 'Bring your own API key for unlimited use',
    body:
      'Settings → AI Service Keys lets you add your own provider key. Generations are then free of any monthly cap, and no content passes through our servers.',
    trigger: 'first-byok-prompt-encountered',
  },
];

/** Lookup hints by trigger key. */
export function getHintsForTrigger(
  trigger: DiscoveryTrigger,
): readonly DiscoveryHint[] {
  return DISCOVERY_HINTS.filter((h) => h.trigger === trigger);
}

/** Lookup a hint by id (used by the toast renderer for "Learn more"). */
export function getHintById(id: string): DiscoveryHint | undefined {
  return DISCOVERY_HINTS.find((h) => h.id === id);
}
