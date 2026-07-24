'use client';

// "What IdeaM Can Do" — the capabilities matrix. A clean, scannable, on-brand
// spec table (feature | what it does) grouped by the idea-development lifecycle:
// Bring it in → Research → Develop → Produce → Publish, plus Foundations and a
// clearly-marked Coming Soon group. Every shipped row carries a "Learn how →"
// deep-link to the matching /guide#anchor so a prospect can jump straight to the
// how-to. Names are the AUDITED, goal-framed labels (approved copy). Same
// IBM/Carbon look as the rest of the marketing site: flat white ground, IBM Plex
// type, blue-600 accents, shared MarketingHeader + homepage-style footer.

import React from 'react';
import Link from 'next/link';
import { MarketingHeader } from '@/components/marketing/marketing-header';
import { AmplifyMark } from '@/components/brand/amplify-mark';
import {
  ArrowLeft,
  ArrowRight,
  Import,
  Mail,
  Microscope,
  Brain,
  Zap,
  Shuffle,
  PenTool,
  Podcast,
  Video,
  Presentation,
  Languages,
  Send,
  Share2,
  Shield,
  Monitor,
  CheckCircle2,
  Inbox,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Capability data — grouped by lifecycle stage. `anchor` deep-links into the
// public guide; `soon` marks a not-yet-available capability.
// ---------------------------------------------------------------------------

type Capability = {
  name: string;
  what: string;
  anchor?: string; // /guide#<anchor>
  icon: React.ElementType;
  soon?: boolean;
};

type Group = {
  id: string;
  title: string;
  subtitle?: string;
  soon?: boolean;
  items: Capability[];
};

const GROUPS: Group[] = [
  {
    id: 'bring-it-in',
    title: 'Bring it in',
    items: [
      {
        name: 'Bring In Anything',
        what: 'Pull in YouTube videos, PDFs, web pages, audio, images, and documents; IdeaM reads them for you.',
        anchor: 'bring-in-anything',
        icon: Import,
      },
      {
        name: 'Bring In Email',
        what: 'Drop in an email or a whole thread → a clean outline of the key points, decisions, and to-dos.',
        anchor: 'bring-in-email',
        icon: Mail,
      },
    ],
  },
  {
    id: 'research',
    title: 'Research',
    items: [
      {
        name: 'Research',
        what: 'Bring in many sources at once and IdeaM does the research and the synthesis: one coherent, structured outline of what matters.',
        anchor: 'research',
        icon: Microscope,
      },
      {
        name: 'Ask Your Knowledge (Second Brain)',
        what: 'Everything you gather becomes a private, searchable library you can question in your own words.',
        anchor: 'ask-your-knowledge',
        icon: Brain,
      },
    ],
  },
  {
    id: 'develop',
    title: 'Develop the idea',
    subtitle: 'The engineering of thought',
    items: [
      {
        name: 'Get the Gist',
        what: 'One click turns a dense outline into the essentials.',
        anchor: 'get-the-gist',
        icon: Zap,
      },
      {
        name: 'Reshape Your Outline',
        what: 'Change its structure, length, or style on demand.',
        anchor: 'reshape-your-outline',
        icon: Shuffle,
      },
      {
        name: 'Your Voice',
        what: 'Teach IdeaM how you write, then every draft sounds like you.',
        anchor: 'your-voice',
        icon: PenTool,
      },
    ],
  },
  {
    id: 'produce',
    title: 'Produce finished work',
    items: [
      {
        name: 'Make a Podcast',
        what: 'Turn a chapter into a narrated audio episode in real voices.',
        anchor: 'make-a-podcast',
        icon: Podcast,
      },
      {
        name: 'Make a Video',
        what: 'Turn a chapter into a finished, branded narrated slideshow video.',
        anchor: 'make-a-video',
        icon: Video,
      },
      {
        name: 'Make a Slide Deck',
        what: 'Turn an outline into a branded slide deck that opens in PowerPoint or Keynote — with your data auto-charted.',
        anchor: 'slide-deck',
        icon: Presentation,
      },
      {
        name: 'Translate',
        what: 'Produce your work in 21 languages.',
        anchor: 'translate',
        icon: Languages,
      },
    ],
  },
  {
    id: 'publish',
    title: 'Publish it',
    items: [
      {
        name: 'Turn Into an Email',
        what: 'Turn any branch into a ready-to-send email (Gmail, your mail app, copy, or download).',
        anchor: 'turn-into-an-email',
        icon: Send,
      },
      {
        name: 'Share to Social',
        what: 'One idea → ready-to-post content for X, Instagram (branded carousels), LinkedIn, Facebook, Threads, Bluesky, and YouTube, in your voice.',
        anchor: 'share-to-social',
        icon: Share2,
      },
    ],
  },
  {
    id: 'foundations',
    title: 'Foundations',
    items: [
      {
        name: 'Privacy-First',
        what: 'On-device AI and bring-your-own-key; your thinking stays yours.',
        anchor: 'privacy-first',
        icon: Shield,
      },
      {
        name: 'Works Everywhere',
        what: 'Mac, iPhone, iPad, and web.',
        anchor: 'works-everywhere',
        icon: Monitor,
      },
      {
        name: 'Quality-Checked',
        what: 'Every AI draft runs an automatic check that flags possible errors before you send.',
        anchor: 'quality-checked',
        icon: CheckCircle2,
      },
    ],
  },
  {
    id: 'coming-soon',
    title: 'Coming soon',
    soon: true,
    items: [
      {
        name: 'One Inbox for Everything',
        what: 'Unify your email AND your physical mail into one AI-organized inbox.',
        anchor: 'one-inbox',
        icon: Inbox,
        soon: true,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// A single feature row inside a group's table.
// ---------------------------------------------------------------------------
function CapabilityRow({ cap }: { cap: Capability }) {
  const Icon = cap.icon;
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-[minmax(0,20rem)_1fr] gap-2 md:gap-6 px-5 py-5 md:px-6 md:py-5 border-t border-[#e2e8f0] ${
        cap.soon ? 'opacity-90' : ''
      }`}
    >
      {/* Feature name */}
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
            cap.soon
              ? 'bg-[#f1f5f9] border-[#cbd5e1] text-[#64748b]'
              : 'bg-blue-600/10 border-blue-600/25 text-[#1e40af]'
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <span className="text-base font-bold text-[#0b1533] leading-tight">{cap.name}</span>
          {cap.soon && (
            <span className="ml-2 inline-flex items-center rounded-full border border-amber-400/60 bg-amber-50 px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-amber-700 align-middle">
              Not yet available
            </span>
          )}
        </div>
      </div>

      {/* What it does + Learn how / Try it */}
      <div className="md:pl-0 pl-11">
        <p className="text-base font-medium text-[#2b3a5c] leading-relaxed">{cap.what}</p>
        {!cap.soon && (
          <div className="mt-2 flex items-center gap-5">
            {cap.anchor && (
              <Link
                href={`/guide#${cap.anchor}`}
                className="inline-flex items-center gap-1 text-sm font-semibold text-[#1e40af] hover:gap-2 transition-all"
              >
                Learn how <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
            <Link
              href="/app"
              className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:gap-2 transition-all"
            >
              Try it <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
        {cap.soon && (
          <p className="mt-2 text-xs font-medium text-[#94a3b8] italic">In development — not available yet.</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function CapabilitiesPage() {
  return (
    <div className="fixed inset-0 bg-white text-[#0b1533] overflow-x-hidden overflow-y-auto">
      <div className="fixed inset-0 bg-white" />
      <div className="relative z-10">
        <MarketingHeader />

        {/* Hero */}
        <section className="px-6 pt-32 pb-12 lg:px-12 lg:pt-40">
          <div className="max-w-[1100px] mx-auto">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-[#dde5f2] bg-white px-4 py-2 text-sm font-semibold text-[#475569] hover:text-[#0b1533] hover:border-blue-600/40 transition-colors mb-8"
            >
              <ArrowLeft className="h-4 w-4" /> Back to home
            </Link>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-600/12 border border-blue-600/30 mb-5">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#1e40af]">
                What IdeaM can do
              </span>
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold text-[#0b1533] tracking-tight leading-[1.05] mb-5">
              Every capability, in one place.
            </h1>
            <p className="text-lg md:text-xl font-medium text-[#2b3a5c] leading-relaxed max-w-[720px]">
              A straight, no-fluff map of what IdeaM does — grouped by how an idea travels from raw
              sources to finished, published work. Each row links to a step-by-step how-to in the guide.
            </p>
          </div>
        </section>

        {/* Capability groups */}
        <section className="px-6 pb-24 lg:px-12">
          <div className="max-w-[1100px] mx-auto space-y-8">
            {GROUPS.map((group) => (
              <div
                key={group.id}
                className={`rounded-2xl border overflow-hidden shadow-[0_1px_3px_rgba(12,34,36,0.06),0_8px_24px_rgba(12,34,36,0.05)] ${
                  group.soon
                    ? 'border-dashed border-amber-300 bg-amber-50/40'
                    : 'border-[#dde5f2] bg-white'
                }`}
              >
                {/* Group header */}
                <div
                  className={`flex items-center justify-between gap-4 px-5 py-4 md:px-6 ${
                    group.soon ? 'bg-amber-50/60' : 'bg-[#f7faff]'
                  }`}
                >
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <h2
                      className={`text-lg md:text-xl font-extrabold tracking-tight ${
                        group.soon ? 'text-amber-800' : 'text-[#0b1533]'
                      }`}
                    >
                      {group.title}
                    </h2>
                    {group.subtitle && (
                      <span className="text-sm font-medium italic text-[#5b6b85]">
                        {group.subtitle}
                      </span>
                    )}
                  </div>
                  {group.soon && (
                    <span className="inline-flex items-center rounded-full border border-amber-400 bg-amber-100 px-3 py-1 text-[11px] font-mono font-semibold uppercase tracking-wider text-amber-800 whitespace-nowrap">
                      Coming soon
                    </span>
                  )}
                </div>

                {/* Column labels (desktop) */}
                <div className="hidden md:grid grid-cols-[minmax(0,20rem)_1fr] gap-6 px-6 pt-3 pb-1 border-t border-[#e2e8f0]">
                  <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#94a3b8]">
                    Feature
                  </span>
                  <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#94a3b8]">
                    What it does
                  </span>
                </div>

                {/* Rows */}
                <div>
                  {group.items.map((cap) => (
                    <CapabilityRow key={cap.name} cap={cap} />
                  ))}
                </div>
              </div>
            ))}

            {/* Guide CTA */}
            <div className="rounded-2xl border border-[#dde5f2] bg-gradient-to-br from-blue-700/[0.08] to-blue-700/[0.03] p-8 text-center">
              <h3 className="text-2xl font-extrabold text-[#0b1533] tracking-tight mb-2">
                Want the full how-to?
              </h3>
              <p className="text-base font-medium text-[#2b3a5c] mb-5 max-w-xl mx-auto">
                The guide walks through every feature step by step — with the exact clicks, menus, and
                options.
              </p>
              <Link
                href="/guide"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-[#38bdf8] via-[#2563eb] to-[#4f46e5] hover:from-[#2563eb] hover:to-[#4338ca] px-6 py-3 text-base font-bold text-white shadow-lg shadow-blue-700/30 transition-colors"
              >
                Read the guide <ArrowRight className="h-4 w-4" />
              </Link>
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
                <Link href="/guide" className="text-[#475569] hover:text-[#0b1533] transition-colors">
                  Guide
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
