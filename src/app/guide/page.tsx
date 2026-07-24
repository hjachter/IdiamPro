'use client';

// Public IdeaM User Guide — the web-facing version of the in-app guide that
// lives at src/lib/initial-guide.ts. It presents the guide's real how-to content
// as a readable docs page with a sticky table of contents and a STABLE #anchor
// per feature (e.g. #make-a-podcast, #bring-in-email) so the /capabilities page —
// and any other page — can deep-link straight to a feature's how-to.
//
// Content is mirrored from initial-guide.ts (condensed to web prose, not
// invented). Same IBM/Carbon site look: flat white ground, IBM Plex type,
// blue-600 accents, shared MarketingHeader + footer.

import React from 'react';
import Link from 'next/link';
import { MarketingHeader } from '@/components/marketing/marketing-header';
import { AmplifyMark } from '@/components/brand/amplify-mark';
import { ArrowLeft, ArrowRight, BookOpen } from 'lucide-react';

// ---------------------------------------------------------------------------
// Guide content model. Each SECTION renders an anchored <h2 id={anchor}>.
// `body` = paragraphs; `steps` = an ordered how-to list; `bullets` = an
// unordered list. `note` = the small "where it lives in the app" line.
// ---------------------------------------------------------------------------

type Section = {
  anchor: string;
  title: string;
  note?: string;
  body?: string[];
  steps?: string[];
  bullets?: string[];
  soon?: boolean;
};

type Group = {
  id: string;
  label: string;
  sections: Section[];
};

const GROUPS: Group[] = [
  {
    id: 'start',
    label: 'Getting started',
    sections: [
      {
        anchor: 'getting-started',
        title: 'Getting started',
        body: [
          'IdeaM helps you organize your thoughts into structured outlines. The interface has two main areas: the outline pane on the left shows your hierarchical structure, and the content pane on the right lets you edit the selected item. Everything saves automatically — just start working and your changes are preserved.',
          'One simple rule runs everywhere, so you only learn it once: actions that work on the item you selected live in the right-click menu (tap-again on iPhone/iPad); actions that work on the whole outline live in the toolbar. New Outline, Search, Smart Tools, Bring In, Turn Into, and Second Brain all sit in the toolbar.',
        ],
      },
    ],
  },
  {
    id: 'bring-it-in',
    label: 'Bring it in',
    sections: [
      {
        anchor: 'bring-in-anything',
        title: 'Bring In Anything',
        note: 'Toolbar → Bring In menu → Research & Import',
        body: [
          'Bring In Anything is the heart of IdeaM. Pull in content from many sources at once — YouTube videos, PDFs, web pages, audio, images, and documents — and IdeaM reads them and synthesizes everything into one unified, structured outline. You can merge new sources into your current outline, or create a fresh one.',
        ],
        bullets: [
          'YouTube videos — paste any URL; the transcript is extracted automatically and the video title becomes the default name.',
          'Audio & conversation — paste a transcript, upload an audio file, or record live; speaker diarization identifies who said what.',
          'Documents — PDF, Word, Excel, PowerPoint, and images with OCR text extraction.',
          'Web pages, plain text and notes, existing outline files, and video files (audio extracted).',
        ],
      },
      {
        anchor: 'bring-in-email',
        title: 'Bring In Email',
        note: 'Toolbar → Bring In menu → Import Email (turn on Email tools in Settings first)',
        body: [
          'Bring an email — a single message or a whole thread — into IdeaM as a clean, structured outline. Instead of a wall of quoted text, the AI distills it into Summary, Key Points, Decisions, and Action Items.',
          'Email tools are off by default. Turn them on in Settings → Professional Customization, then choose Import Email from the Bring In menu.',
        ],
        steps: [
          'Open the Bring In menu and choose Import Email.',
          'Paste the email or the entire thread into the box — and/or drop a .eml file.',
          'Choose where it goes: create a new outline (the default), add to the current outline, or save into your Second Brain.',
          'Click Import. Suspected junk (promos, spam, newsletters) is filed into a clearly-labeled “Filtered — likely junk” branch — never deleted — so you can rescue anything it got wrong.',
        ],
      },
    ],
  },
  {
    id: 'research',
    label: 'Research',
    sections: [
      {
        anchor: 'research',
        title: 'Research',
        note: 'Toolbar → Bring In menu → Research & Import',
        body: [
          'Import multiple sources simultaneously and IdeaM does the research and the synthesis — finding connections across everything and producing one coherent, structured outline of what matters.',
          'When you create a new outline (rather than merging), the root gets an AI-generated introduction that summarizes everything below it, and chapter nodes get short introductions that preview their children — no empty headers. Node names stay concise (2–6 words) while the detail lives in each node’s content.',
          'The merge behavior means you can keep building knowledge on a topic from many sources over time. If a merge produces bad results, the Unmerge button restores your outline to its exact pre-merge state.',
        ],
      },
      {
        anchor: 'ask-your-knowledge',
        title: 'Ask Your Knowledge (Second Brain)',
        note: 'Toolbar → 🧠 Second Brain menu, or Smart Tools → Ask Your Outlines',
        body: [
          'Your Second Brain is an always-present outline where you accumulate everything you want to remember — notes, research, ideas, articles, images, anything. It becomes a private, searchable library you can question in your own words.',
          'Save any node (and everything under it) with a right-click → “Save to Second Brain”. Then query it two ways: a free, instant, offline keyword Search that filters your saves as you type, or Ask Second Brain, which sends your question to the AI and writes an answer across your saved content.',
        ],
        bullets: [
          'Ask Your Outlines has three modes: the current outline, all your outlines at once, or just your Second Brain.',
          'Answers stream in word-by-word, and reference the specific sections they came from.',
          'Everything is based only on your own content — it never makes things up from outside your outlines.',
        ],
      },
    ],
  },
  {
    id: 'develop',
    label: 'Develop the idea',
    sections: [
      {
        anchor: 'get-the-gist',
        title: 'Get the Gist',
        note: 'Smart Tools menu → Summarize outline',
        body: [
          'Distill a whole outline down to its key points — a short, well-organized gist instead of every bullet. Perfect when a detailed capture has grown so many bullets that the main point gets buried.',
        ],
        steps: [
          'Open Smart Tools → Summarize outline.',
          'Pick how short you want it: Standard gist (key points with a little structure) or Brief (maximum compression).',
          'Choose what to do with the result — Save as a new outline (the safe default, leaving your original untouched) or replace the current outline in place.',
          'Review the preview (it shows how much it condensed), then create the summary.',
        ],
      },
      {
        anchor: 'reshape-your-outline',
        title: 'Reshape Your Outline',
        note: 'Smart Tools menu → Transform outline with AI',
        body: [
          'Change an outline’s structure, length, or style on demand by describing what should change in plain English. Where Reformat rewrites the contents of one node, Reshape changes the shape of the outline itself — adding, removing, renaming, merging, splitting, or moving nodes.',
        ],
        steps: [
          'Open Smart Tools → Transform outline with AI. With a node selected it works on that branch; with nothing selected, the whole outline.',
          'Type how you want it changed — e.g. “reorganize alphabetically,” “merge small chapters into a Misc chapter,” “promote leaf nodes about X to top-level chapters.”',
          'Click Preview. A Before/After tree shows color-coded changes (added, removed, renamed, moved) and a one-line count.',
          'Click Apply to commit, tweak your instruction, or cancel. An auto-snapshot is written first, and Cmd+Z undoes it.',
        ],
      },
      {
        anchor: 'your-voice',
        title: 'Your Voice',
        note: 'Settings → Professional Customization → Your Voice',
        body: [
          'Teach IdeaM how you write, then have it generate work that sounds like you instead of like generic AI. This is strictly your own voice — it never imitates anyone else. Your Voice is off by default; turn it on in Settings.',
        ],
        steps: [
          'Paste a few things you’ve written — posts, emails, notes. A few hundred words is plenty. Or pull a sample straight from your Second Brain.',
          'Click “Learn my voice.” The AI writes a short, plain-English voice profile describing your tone, formality, sentence rhythm, favorite words, and any emoji or hashtag habits.',
          'The profile appears in an editable box, so you can see exactly what was learned and tweak it. Add more samples and regenerate anytime.',
          'In the output wizards (Export Email, Summarize, social posts and more), tick “In my voice” and the result is written in your style.',
        ],
      },
    ],
  },
  {
    id: 'produce',
    label: 'Produce finished work',
    sections: [
      {
        anchor: 'make-a-podcast',
        title: 'Make a Podcast',
        note: 'Right-click a node → Generate Podcast',
        body: [
          'Turn a chapter into a narrated audio episode in real voices.',
        ],
        steps: [
          'Right-click any node and choose Generate Podcast.',
          'Configure it: style (Two-Host Discussion, Single Narrator, Interview, or Debate), voices, length (Brief, Standard, or Detailed), and quality.',
          'Click Generate — the AI writes the script and synthesizes the audio.',
          'Preview in the built-in player and read along with the script viewer, then save the MP3.',
        ],
        bullets: [
          'Your podcast always records and is never silent. With your own OpenAI key you get natural AI voices; without one, it still records using your Mac’s built-in voices (free, offline, no key).',
          'On iPhone and iPad, keyless users get an audible two-voice podcast synthesized right on the device.',
        ],
      },
      {
        anchor: 'make-a-video',
        title: 'Make a Video',
        note: 'Desktop app → Turn Into (Export) menu → Generate Video',
        body: [
          'Turn a chapter into a finished, branded narrated slideshow video — great for posting to YouTube, sharing in a class, or dropping into a presentation. The video is built right on your Mac, so nothing is uploaded to a server.',
        ],
        bullets: [
          'Customize the look: your own logo on every slide, an accent color, a dark or light theme, and slide visuals (auto-drawn mind maps, free public-domain photos, and moving video clips).',
          'Choose a narrator voice and how deep the video goes (Overview, Standard, Deep, or the full outline).',
          'It always narrates — with your OpenAI key you get natural AI voices; without one it uses your Mac’s built-in voice.',
          'A live progress bar shows exactly where the render is up to; the finished MP4 lands in your Documents · IdeaM Videos folder.',
        ],
      },
      {
        anchor: 'translate',
        title: 'Translate',
        note: 'Smart Tools menu → Translate this section',
        body: [
          'Produce your work in 21 languages. Translate any node and its descendants into another language, with the same preview-and-approve safety as the other AI transforms. Formatting (headings, lists, bold, links) is preserved, and proper nouns and code stay as-is.',
        ],
        steps: [
          'Select the node you want to translate (or the top of the outline for the whole thing).',
          'Open Smart Tools → Translate this section and pick a target language.',
          'Click Translate & preview — each node’s translation is shown side-by-side with the original.',
          'Reject any you don’t want, then apply. Nodes you edited by hand are auto-skipped so translation never clobbers your edits.',
        ],
      },
    ],
  },
  {
    id: 'publish',
    label: 'Publish it',
    sections: [
      {
        anchor: 'turn-into-an-email',
        title: 'Turn Into an Email',
        note: 'Right-click a branch → Export Email (turn on Email tools in Settings first)',
        body: [
          'Turn any branch of your outline into a ready-to-send email. Sketch your thoughts as an outline, then let the AI shape them into a real message with a subject line and a readable body — greeting, flowing sentences, tidy bullets where they help, and a sign-off. IdeaM never sends email for you and never touches your inbox — you always review and hit send yourself.',
        ],
        steps: [
          'Pick a tone — Friendly professional, Formal, or Casual — and optionally add a one-line instruction like “keep it short.”',
          'Click Draft email. You get an editable preview — tweak the subject and body freely.',
          'Send it four ways, no login needed: Open in Gmail, Open in Mail, Copy email, or Download a .eml file.',
        ],
      },
      {
        anchor: 'share-to-social',
        title: 'Share to Social',
        note: 'Right-click a branch → Share to Social (turn on Social export in Settings first)',
        body: [
          'Turn one idea into ready-to-post content for X, Instagram (branded square carousels), LinkedIn, Facebook, Threads, Bluesky, and YouTube — each written to fit that network, and in your voice if Your Voice is on. IdeaM never posts anything for you and never connects to your accounts; you always review and post yourself.',
        ],
        bullets: [
          'X — a thread (each post within 280 characters) or a single post.',
          'Instagram — branded 1080×1080 carousel images that match your video slides, plus a caption with hashtags.',
          'LinkedIn, Facebook, Threads, and Bluesky — each a platform-appropriate post; Threads and Bluesky offer a one-click hand-off to their compose window.',
          'YouTube — a publish package (title options, description with chapter timestamps, tags, and a thumbnail idea) that pairs with Make a Video.',
        ],
      },
    ],
  },
  {
    id: 'foundations',
    label: 'Foundations',
    sections: [
      {
        anchor: 'privacy-first',
        title: 'Privacy-First',
        note: 'Settings → AI Provider, and Settings → Data & Privacy',
        body: [
          'Your thinking stays yours. IdeaM stores all your data locally on your device — your outlines are never uploaded for storage, and data is only sent to an AI service when you explicitly invoke an AI feature.',
          'Run AI entirely on your own machine with local AI (Ollama / Google Gemma) — no API key, no cost, works offline. Or bring your own key for premium cloud models. Either way, you choose, and you can toggle AI data processing on or off anytime.',
        ],
      },
      {
        anchor: 'works-everywhere',
        title: 'Works Everywhere',
        body: [
          'IdeaM runs natively on Mac, iPhone, and iPad, and instantly in any modern web browser — nothing to install. Your work goes with you.',
          'The interface adapts to each device: full keyboard shortcuts and right-click menus on desktop, and touch-friendly tap-again, swipe, and long-press equivalents on iPhone and iPad.',
        ],
      },
      {
        anchor: 'quality-checked',
        title: 'Quality-Checked',
        body: [
          'Every AI draft of a factual output runs through an automatic quality check before you send or publish it — always on, nothing to switch on. Right after the AI writes an email draft, a social post, a summary, or an imported-email outline, a second pass re-reads it against the source it came from and looks for claims the source doesn’t actually support (invented names, numbers, dates, quotes, or facts).',
          'If it spots any, it flags them right in the preview under a “Please review these” note, and can offer a corrected version you can accept or ignore. It never rewrites your draft silently — the final review is always yours. The check runs on the free on-device AI, so it costs nothing and never uses your monthly generations.',
        ],
      },
    ],
  },
  {
    id: 'coming-soon',
    label: 'Coming soon',
    sections: [
      {
        anchor: 'one-inbox',
        title: 'One Inbox for Everything',
        soon: true,
        body: [
          'A planned capability, not yet available: unify your email and your physical mail into one AI-organized inbox — so everything that comes to you lands in a single, structured place that IdeaM helps you triage. This is in development; the rest of the guide describes what ships in IdeaM today.',
        ],
      },
    ],
  },
];

// Flatten for the table of contents.
const TOC = GROUPS.map((g) => ({
  label: g.label,
  items: g.sections.map((s) => ({ anchor: s.anchor, title: s.title, soon: s.soon })),
}));

// ---------------------------------------------------------------------------
// Section renderer
// ---------------------------------------------------------------------------
function SectionBlock({ section }: { section: Section }) {
  return (
    <section id={section.anchor} className="scroll-mt-28 pt-10 first:pt-0">
      <div className="flex items-baseline gap-3 flex-wrap mb-3">
        <h2 className="text-2xl md:text-3xl font-extrabold text-[#0b1533] tracking-tight">
          {section.title}
        </h2>
        {section.soon && (
          <span className="inline-flex items-center rounded-full border border-amber-400 bg-amber-100 px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-amber-800">
            Coming soon
          </span>
        )}
      </div>

      {section.note && (
        <p className="mb-4 inline-flex items-center gap-2 rounded-lg bg-[#f1f5f9] border border-[#dde5f2] px-3 py-1.5 text-sm font-medium text-[#475569]">
          <BookOpen className="h-3.5 w-3.5 text-[#1e40af]" />
          {section.note}
        </p>
      )}

      {section.body?.map((p, i) => (
        <p key={i} className="text-base md:text-lg font-medium text-[#2b3a5c] leading-relaxed mb-4">
          {p}
        </p>
      ))}

      {section.steps && (
        <ol className="mb-4 space-y-2">
          {section.steps.map((s, i) => (
            <li key={i} className="flex gap-3 text-base font-medium text-[#2b3a5c] leading-relaxed">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600/12 text-xs font-bold text-[#1e40af]">
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      )}

      {section.bullets && (
        <ul className="mb-4 space-y-2">
          {section.bullets.map((b, i) => (
            <li key={i} className="flex gap-2.5 text-base font-medium text-[#2b3a5c] leading-relaxed">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function GuidePage() {
  return (
    <div className="fixed inset-0 bg-white text-[#0b1533] overflow-x-hidden overflow-y-auto">
      <div className="fixed inset-0 bg-white" />
      <div className="relative z-10">
        <MarketingHeader />

        {/* Hero */}
        <section className="px-6 pt-32 pb-8 lg:px-12 lg:pt-40">
          <div className="max-w-[1100px] mx-auto">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-[#dde5f2] bg-white px-4 py-2 text-sm font-semibold text-[#475569] hover:text-[#0b1533] hover:border-blue-600/40 transition-colors mb-8"
            >
              <ArrowLeft className="h-4 w-4" /> Back to home
            </Link>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-600/12 border border-blue-600/30 mb-5">
              <BookOpen className="h-3.5 w-3.5 text-[#1e40af]" />
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#1e40af]">
                User guide
              </span>
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold text-[#0b1533] tracking-tight leading-[1.05] mb-5">
              How to use IdeaM.
            </h1>
            <p className="text-lg md:text-xl font-medium text-[#2b3a5c] leading-relaxed max-w-[720px]">
              A step-by-step walkthrough of every feature — where it lives, and exactly how to use it.
              Looking for the big picture first?{' '}
              <Link href="/capabilities" className="text-[#1e40af] font-semibold hover:underline">
                See what IdeaM can do
              </Link>
              .
            </p>
          </div>
        </section>

        {/* Body: sticky TOC + content */}
        <section className="px-6 pb-24 lg:px-12">
          <div className="max-w-[1100px] mx-auto grid lg:grid-cols-[16rem_1fr] gap-10 lg:gap-14">
            {/* TOC */}
            <aside className="hidden lg:block">
              <nav className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto pb-8">
                {TOC.map((group) => (
                  <div key={group.label} className="mb-5">
                    <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#94a3b8] mb-2">
                      {group.label}
                    </div>
                    <ul className="space-y-1.5 border-l border-[#e2e8f0] pl-3">
                      {group.items.map((item) => (
                        <li key={item.anchor}>
                          <a
                            href={`#${item.anchor}`}
                            className="text-sm font-medium text-[#475569] hover:text-[#1e40af] transition-colors"
                          >
                            {item.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </nav>
            </aside>

            {/* Content */}
            <div className="min-w-0">
              {GROUPS.map((group, gi) => (
                <div
                  key={group.id}
                  className={gi > 0 ? 'mt-16 pt-4 border-t border-[#dde5f2]' : ''}
                >
                  <div className="text-xs font-mono font-semibold uppercase tracking-wider text-[#1e40af] mb-2">
                    {group.label}
                  </div>
                  {group.sections.map((section) => (
                    <SectionBlock key={section.anchor} section={section} />
                  ))}
                </div>
              ))}

              {/* Bottom CTA */}
              <div className="mt-16 rounded-2xl border border-[#dde5f2] bg-gradient-to-br from-blue-700/[0.08] to-blue-700/[0.03] p-8 text-center">
                <h3 className="text-2xl font-extrabold text-[#0b1533] tracking-tight mb-2">
                  Ready to try it?
                </h3>
                <p className="text-base font-medium text-[#2b3a5c] mb-5 max-w-xl mx-auto">
                  Every feature above is free to explore on your own device.
                </p>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-[#38bdf8] via-[#2563eb] to-[#4f46e5] hover:from-[#2563eb] hover:to-[#4338ca] px-6 py-3 text-base font-bold text-white shadow-lg shadow-blue-700/30 transition-colors"
                >
                  Sign up to try IdeaM free <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-6 py-12 lg:px-12 border-t border-[#dde5f2]">
          <div className="max-w-[1600px] mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <Link href="/" className="flex items-center gap-2">
                <AmplifyMark className="w-8 h-8 rounded-lg" />
                <span className="text-lg font-extrabold tracking-tight leading-none">
                  <span className="text-[#0b1533]">Idea</span>
                  <span className="text-blue-600">M</span>
                </span>
              </Link>
              <div className="flex items-center gap-6 text-sm">
                <Link href="/capabilities" className="text-[#475569] hover:text-[#0b1533] transition-colors">
                  Capabilities
                </Link>
                <Link href="/features" className="text-[#475569] hover:text-[#0b1533] transition-colors">
                  Features
                </Link>
                <Link href="/pricing" className="text-[#475569] hover:text-[#0b1533] transition-colors">
                  Pricing
                </Link>
              </div>
              <p className="text-[#5b6b85] text-sm">© 2026 SecondBrainWare. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
