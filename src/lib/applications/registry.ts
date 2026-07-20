/**
 * Applications — one-click automated workflows ("recipes").
 *
 * Each Application is a self-contained recipe: the user picks it, gives it a
 * topic (and optional customization), presses Run once, and the whole
 * pipeline executes end-to-end — no intermediate buttons to babysit.
 *
 * PROTOTYPE STATUS: "Automatic Book" is fully live (topic -> AI outline ->
 * AI-written sections -> new standalone outline). The other three are marked
 * 'preview' and show a friendly "coming soon" toast when run.
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
  /** 'live' = actually runs; 'preview' = shows a coming-soon toast. */
  status: 'live' | 'preview';
  /** Placeholder for the optional "Customize" field. */
  configPlaceholder: string;
}

export const APPLICATIONS: ApplicationRecipe[] = [
  {
    id: 'automatic-book',
    title: 'Automatic Book',
    subtitle: 'Topic in, finished book out',
    emoji: '📘',
    accent: 'from-amber-500 to-orange-500',
    needsTopic: true,
    status: 'live',
    configPlaceholder: 'e.g. 5 chapters, formal tone, focus on beginners',
  },
  {
    id: 'podcast-anything',
    title: 'Podcast from Anything',
    subtitle: 'Turn any source into a two-host show',
    emoji: '🎙️',
    accent: 'from-rose-500 to-pink-500',
    needsTopic: true,
    status: 'preview',
    configPlaceholder: 'e.g. casual banter, 10 minutes',
  },
  {
    id: 'research-digest',
    title: 'Research Digest',
    subtitle: 'Many sources merged into one brief',
    emoji: '📚',
    accent: 'from-sky-500 to-cyan-500',
    needsTopic: true,
    status: 'preview',
    configPlaceholder: 'e.g. executive summary, cite sources',
  },
  {
    id: 'instant-study-guide',
    title: 'Instant Study Guide',
    subtitle: 'Source into outline plus key points and quiz',
    emoji: '🎓',
    accent: 'from-emerald-500 to-teal-500',
    needsTopic: true,
    status: 'preview',
    configPlaceholder: 'e.g. 10 flashcards, high-school level',
  },
];
