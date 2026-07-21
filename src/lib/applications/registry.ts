/**
 * Applications — one-click automated workflows ("recipes").
 *
 * A wizard is a friendly guided front-door over an engine that already exists
 * in the app. Two kinds:
 *   1. Generator wizards (Automatic Book): topic in -> a brand-new outline out.
 *      They run their own guided config view inside the Wizards dialog.
 *   2. Engine-launcher wizards (Website Building, Podcast, YouTube Video): they
 *      open an existing, fully-built dialog on the CURRENT outline via the
 *      `launches` field. These reuse the dialogues already shipped in the app.
 *
 * Recipes with no backing engine yet stay `status: 'coming-soon'` — their card
 * is shown (to preview the roadmap) but is inert: tapping never opens a flow
 * and never triggers any AI or cost.
 */

export interface ApplicationRecipe {
  /** Stable id used as the run key + registry lookup. */
  id: string;
  /** Human-facing title shown on the gallery card. */
  title: string;
  /** One-line value proposition. */
  subtitle: string;
  /** Card emoji. */
  emoji: string;
  /** Tailwind gradient classes, e.g. 'from-violet-500 to-fuchsia-500'. */
  accent: string;
  /** Whether this recipe requires a topic before it can run. */
  needsTopic: boolean;
  /** 'live' = actually runs; 'coming-soon' = shown but inert (no AI, no cost). */
  status: 'live' | 'coming-soon';
  /**
   * When set, the card is an engine-launcher: clicking it closes the Wizards
   * gallery and opens the existing dialog for that engine on the current
   * outline (rather than running the wizard's own topic->outline generator).
   */
  launches?: 'website' | 'podcast' | 'video';
  /** Placeholder for the optional "Customize" field. */
  configPlaceholder: string;
}

export const APPLICATIONS: ApplicationRecipe[] = [
  // ── LIVE ────────────────────────────────────────────────────────────────
  {
    id: 'automatic-book',
    title: 'Automatic Book',
    subtitle: 'Turn an outline into a complete, structured book.',
    emoji: '📘',
    accent: 'from-amber-500 to-orange-500',
    needsTopic: true,
    status: 'live',
    configPlaceholder: 'e.g. 5 chapters, formal tone, focus on beginners',
  },
  {
    id: 'website-building',
    title: 'Website Building',
    subtitle: 'Turn your outline into a ready-to-publish website.',
    emoji: '🌐',
    accent: 'from-blue-500 to-indigo-500',
    needsTopic: false,
    status: 'live',
    launches: 'website',
    configPlaceholder: '',
  },
  {
    id: 'podcast',
    title: 'Podcast',
    subtitle: 'Turn your ideas into a scripted, narrated podcast episode.',
    emoji: '🎙️',
    accent: 'from-rose-500 to-pink-500',
    needsTopic: false,
    status: 'live',
    launches: 'podcast',
    configPlaceholder: '',
  },
  {
    id: 'youtube-video',
    title: 'YouTube Video',
    subtitle: 'A narrated video from your outline, ready to post.',
    emoji: '🎬',
    accent: 'from-red-500 to-orange-500',
    needsTopic: false,
    status: 'live',
    launches: 'video',
    configPlaceholder: '',
  },
  // ── COMING SOON (no backing engine yet) ─────────────────────────────────
  {
    id: 'research-digest',
    title: 'Research Digest',
    subtitle: 'Distill many sources into a clean, cited digest.',
    emoji: '📚',
    accent: 'from-sky-500 to-cyan-500',
    needsTopic: true,
    status: 'coming-soon',
    configPlaceholder: 'e.g. executive summary, cite sources',
  },
  {
    id: 'study-guide',
    title: 'Study Guide',
    subtitle: 'Summaries, key terms, and quiz questions from your material.',
    emoji: '🎓',
    accent: 'from-emerald-500 to-teal-500',
    needsTopic: true,
    status: 'coming-soon',
    configPlaceholder: 'e.g. 10 flashcards, high-school level',
  },
  {
    id: 'screenplay',
    title: 'Screenplay',
    subtitle: 'Develop a story into a properly formatted screenplay.',
    emoji: '🎭',
    accent: 'from-indigo-500 to-violet-500',
    needsTopic: true,
    status: 'coming-soon',
    configPlaceholder: 'e.g. 30-page short, three acts',
  },
  {
    id: 'invention-patent',
    title: 'Invention / Patent',
    subtitle: 'Turn an idea into a described invention with a patent-style draft.',
    emoji: '💡',
    accent: 'from-yellow-500 to-amber-500',
    needsTopic: true,
    status: 'coming-soon',
    configPlaceholder: 'e.g. claims, prior-art notes',
  },
  {
    id: 'explain-anything',
    title: 'Explain Anything',
    subtitle: 'Re-explain any topic for any audience, expert to 11-year-old.',
    emoji: '🧠',
    accent: 'from-fuchsia-500 to-purple-500',
    needsTopic: true,
    status: 'coming-soon',
    configPlaceholder: 'e.g. explain like I am 11',
  },
];
