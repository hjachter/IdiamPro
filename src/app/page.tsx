'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MarketingHeader } from '@/components/marketing/marketing-header';
import { Button } from '@/components/ui/button';
import { SignedIn, SignedOut } from '@/lib/auth/signed-gates';
import {
  Sparkles,
  Brain,
  Layers,
  Zap,
  FileText,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  Check,
  Star,
  BookOpen,
  Briefcase,
  GraduationCap,
  Lightbulb,
  PenTool,
  FolderTree,
  Target,
  Users,
  Scale,
  Microscope,
  BookMarked,
  Search,
  Heart,
  Kanban,
  MessagesSquare,
  Rocket,
  Calendar,
  Home,
  Utensils,
  Plane,
  Save,
  GitBranch,
  Globe,
  Import,
  Youtube,
  FileUp,
  Network,
  Newspaper,
  Building2,
  Stethoscope,
  Code2,
  Presentation,
  Video,
  Laptop,
  Smartphone,
  Monitor,
  Quote,
  Play,
  Shield,
  Lock,
  Headphones,
  Download,
  Upload,
  Merge,
  Palette,
  ExternalLink,
  Menu,
  X,
  Podcast,
  FileAudio,
  SpeakerIcon,
  Volume2,
  BarChart3,
  Languages
} from 'lucide-react';

// ============================================
// CONFIGURATION
// ============================================

// Sign-up URL — the public entry point for new users. The home page no
// longer links directly to /app: anyone who wants to try IdiamPro applies
// for the invite-only beta first, and Howard approves each one personally.
// The /app route is still reachable for already-approved users (via the
// hero CTA's SignedIn branch and via deep links once they're authed); the
// AppGate component enforces approval at the /app boundary.
const SIGNUP_URL = '/signup';

// Launch date: April 1, 2026
const LAUNCH_DATE = new Date('2026-04-01T00:00:00');

/**
 * Send the visitor to the sign-up application flow. Every previously
 * "Launch App" / "Try App" button on the marketing page now routes
 * through here so prospective users always meet the application form
 * before they can reach the outliner.
 */
const launchApp = () => {
  window.location.href = SIGNUP_URL;
};

// ============================================
// COMPONENTS
// ============================================

// Floating particles background - uses deterministic positions to avoid hydration mismatch
function ParticlesBackground() {
  // Pre-computed positions to avoid Math.random() hydration issues
  const particles = [
    { left: 15, top: 23, delay: 0.2, duration: 8 },
    { left: 82, top: 45, delay: 1.5, duration: 12 },
    { left: 34, top: 78, delay: 2.8, duration: 7 },
    { left: 67, top: 12, delay: 0.8, duration: 14 },
    { left: 91, top: 67, delay: 3.2, duration: 9 },
    { left: 8, top: 89, delay: 4.1, duration: 11 },
    { left: 45, top: 34, delay: 1.2, duration: 13 },
    { left: 73, top: 91, delay: 2.4, duration: 6 },
    { left: 28, top: 56, delay: 3.8, duration: 10 },
    { left: 56, top: 8, delay: 0.5, duration: 15 },
    { left: 19, top: 42, delay: 2.1, duration: 8 },
    { left: 88, top: 28, delay: 4.5, duration: 12 },
    { left: 41, top: 95, delay: 1.8, duration: 7 },
    { left: 62, top: 51, delay: 3.5, duration: 14 },
    { left: 5, top: 15, delay: 0.9, duration: 9 },
    { left: 95, top: 82, delay: 2.7, duration: 11 },
    { left: 37, top: 19, delay: 4.2, duration: 13 },
    { left: 78, top: 63, delay: 1.1, duration: 6 },
    { left: 22, top: 71, delay: 3.1, duration: 10 },
    { left: 51, top: 38, delay: 0.3, duration: 15 },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 bg-teal-600/40 rounded-full animate-float"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

// Idea development band — the page's thesis: "a great idea isn't a single
// prompt." Extracted to a component so it can lead the page (rendered right
// under the hero) without duplicating markup.
function IdeaDevelopmentBand() {
  return (
    <section className="px-6 pb-16 lg:px-12 border-t border-[#c2dbd9] pt-16">
      <div className="max-w-[1600px] mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-4xl md:text-5xl font-extrabold text-[#0c2224] mb-4 tracking-tight">
            A great idea isn&apos;t a single prompt.
          </h2>
          <p className="text-lg md:text-xl text-[#22312f] leading-relaxed max-w-[660px] mx-auto">
            It might take a hundred sources — articles, PDFs, YouTube videos, meeting notes, textbooks, even what you type yourself — read, weighed, and merged into one outline before the essence comes into focus. Developing an idea is iterative: many passes, not one flash of insight. IdiamPro is built for that work.
          </p>
        </div>

        {/* Featured hero film — the demonstration of the thesis, sitting directly
            under the explanatory text: one idea, many sources, developed over many
            passes into finished formats. Full section width so the app UI/text read
            clearly (the film shows real interface, not stock footage). */}
        <div className="mb-14">
          <div className="overflow-hidden rounded-2xl border border-[#c2dbd9] bg-[#f4faf9] shadow-2xl shadow-teal-600/15 ring-1 ring-teal-600/10">
            <video
              className="block h-auto w-full"
              src="/home-hero.mp4"
              poster="/home-hero-poster.jpg"
              controls
              playsInline
              preload="metadata"
              aria-label="Watch IdiamPro turn one idea into finished work — produced by IdiamPro"
            />
          </div>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-sm font-semibold text-[#0c5c5b]">
            <Video className="h-3.5 w-3.5" />
            Watch IdiamPro turn one idea into finished work
          </p>
        </div>

        {/* Three-step flow */}
        <div className="flex flex-col lg:flex-row items-stretch justify-center gap-4 lg:gap-2">
          {/* Card 1 — Many inputs */}
          <div className="flex-1 rounded-2xl border border-[#c2dbd9] bg-[#f4faf9] p-6 md:p-8">
            <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-teal-600/15 border border-teal-600/25 mb-4">
              <FileUp className="w-5 h-5 text-teal-600" />
            </div>
            <h3 className="text-lg font-bold text-[#0c2224] mb-3">Many inputs</h3>
            <ul className="space-y-2 text-sm text-[#22312f]">
              <li>Type it in yourself</li>
              <li>Articles, web pages &amp; PDFs</li>
              <li>YouTube, audio &amp; video</li>
              <li>Notes, docs &amp; live web</li>
              <li className="text-[#42504f]">…and growing</li>
            </ul>
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center lg:px-1 text-[#5a6a69]">
            <ArrowRight className="hidden lg:block w-6 h-6" />
            <ChevronDown className="block lg:hidden w-6 h-6" />
          </div>

          {/* Card 2 — Merge & consolidate (emphasized) */}
          <div className="flex-1 rounded-2xl border-2 border-teal-600/40 bg-gradient-to-br from-teal-700/15 to-teal-700/10 p-6 md:p-8 shadow-lg shadow-teal-600/20">
            <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-teal-600/25 border border-teal-600/40 mb-4">
              <Merge className="w-5 h-5 text-teal-500" />
            </div>
            <h3 className="text-lg font-bold text-[#0c2224] mb-3">Merge &amp; consolidate</h3>
            <ul className="space-y-2 text-sm text-[#22312f]">
              <li>Merge sources into one outline</li>
              <li>Consolidate into a coherent whole</li>
              <li>Develop &amp; refine over many passes</li>
            </ul>
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center lg:px-1 text-[#5a6a69]">
            <ArrowRight className="hidden lg:block w-6 h-6" />
            <ChevronDown className="block lg:hidden w-6 h-6" />
          </div>

          {/* Card 3 — Publish everywhere */}
          <div className="flex-1 rounded-2xl border border-[#c2dbd9] bg-[#f4faf9] p-6 md:p-8">
            <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-teal-600/15 border border-teal-600/25 mb-4">
              <Rocket className="w-5 h-5 text-teal-600" />
            </div>
            <h3 className="text-lg font-bold text-[#0c2224] mb-3">Publish everywhere</h3>
            <ul className="space-y-2 text-sm text-[#22312f]">
              <li>Papers &amp; articles</li>
              <li>Podcasts &amp; videos</li>
              <li>Slides &amp; illustrations</li>
              <li className="text-[#42504f]">…and growing</li>
            </ul>
          </div>
        </div>

        <p className="text-center text-sm text-[#42504f] mt-10 max-w-2xl mx-auto">
          Read widely, merge the sources into one outline, refine the essence — then publish it in any format. That&apos;s idea development, not a one-shot answer.
        </p>
      </div>
    </section>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function MarketingPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);


  return (
    <div className="fixed inset-0 bg-white text-[#0c2224] overflow-x-hidden overflow-y-auto">
      {/* Background gradients */}
      <div className="fixed inset-0 bg-gradient-to-br from-white via-white to-white" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-600/[0.10] via-transparent to-transparent" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-teal-600/[0.08] via-transparent to-transparent" />

      <ParticlesBackground />

      {/* Content */}
      <div className="relative z-10">
        <MarketingHeader />

        {/* Hero Section */}
        <section className="px-6 pt-32 pb-16 lg:px-12 lg:pt-40">
          <div className="max-w-[1600px] mx-auto">
            <div className="text-center max-w-4xl mx-auto">
              <div className={`${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-600/15 border border-teal-600/40 mb-6">
                  <Brain className="w-4 h-4 text-[#0c5c5b]" />
                  <span className="text-sm font-semibold text-[#0c5c5b]">Develop it. Publish everywhere.</span>
                </div>
                <h1 className="text-5xl md:text-8xl font-extrabold mb-6 leading-[1.05] tracking-tight">
                  <span className="block text-[#0c2224]">The Premier</span>
                  <span className="block bg-gradient-to-r from-teal-500 via-teal-600 to-teal-600 bg-clip-text text-transparent">Idea Developer.</span>
                </h1>
                <p className="text-xl md:text-2xl font-semibold text-[#0c2224] mb-4 max-w-3xl mx-auto">
                  Capture, consolidate, and develop your ideas with AI — then turn them into articles, podcasts, videos, websites, and more, in a click.
                </p>
                <p className="text-lg md:text-xl text-[#22312f] mb-8 max-w-3xl mx-auto leading-relaxed">
                  Not a chat that forgets — a thinking machine that helps you{' '}
                  <span className="text-[#0c5c5b] font-semibold">consolidate many sources into coherent, developed thinking</span>{' '}
                  — a single idea, a complex concept, or a whole narrative — refined over many passes, then published in whatever format you need.
                </p>

                {/* Output strip — provable formats IdiamPro produces */}
                <div className="flex flex-wrap justify-center gap-2 mb-8 max-w-2xl mx-auto">
                  {['Research papers', 'Podcasts', 'Videos', 'Websites', 'Presentations', 'Illustrations', '21 languages', '…and more'].map((label) => (
                    <span
                      key={label}
                      className={`px-3 py-1.5 rounded-full bg-[#eef6f5] border border-[#b3d3d0] text-sm font-medium ${label === '…and more' ? 'text-[#42504f] italic' : 'text-[#0f2b29]'}`}
                    >
                      {label}
                    </span>
                  ))}
                </div>

                {/* Hero CTA — signed-out shows sign-up; signed-in opens the app. */}
                <div className="mb-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                  <SignedOut>
                    <Button
                      onClick={() => { window.location.href = '/signup'; }}
                      size="lg"
                      className="bg-gradient-to-br from-[#0E7C7B] to-[#0c5c5b] hover:from-[#0c5c5b] hover:to-[#093f3e] text-white font-bold px-8 py-6 text-base shadow-xl shadow-teal-700/35"
                    >
                      Sign up to try IdiamPro free
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <button
                      type="button"
                      onClick={() => { window.location.href = '/signin'; }}
                      className="text-sm text-[#22312f] hover:text-[#0c2224] underline-offset-4 hover:underline"
                    >
                      I already have an account
                    </button>
                  </SignedOut>
                  <SignedIn>
                    <Button
                      onClick={launchApp}
                      size="lg"
                      className="bg-gradient-to-br from-[#0E7C7B] to-[#0c5c5b] hover:from-[#0c5c5b] hover:to-[#093f3e] text-white font-bold px-8 py-6 text-base shadow-xl shadow-teal-700/35"
                    >
                      Open IdiamPro
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </SignedIn>
                </div>


              {/* Decorative elements */}
              <div className="absolute top-4 left-4 flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-teal-600/60" />
                <div className="w-3 h-3 rounded-full bg-teal-600/60" />
                <div className="w-3 h-3 rounded-full bg-teal-600/60" />
              </div>
            </div>
          </div>
        </div>
        </section>

        {/* FIRST video — the conceptual film + the "Who IdiamPro Is For" segments,
            leading the page (audience first). Founder's story follows below. */}
        <IdeaDevelopmentBand />

        {/* SECOND video — Our Story, the self-referential founder film. Placed AFTER
            the conceptual film on purpose: hook the visitor with what it does and who
            it's for, THEN earn trust with who's behind it. */}
        <section className="px-6 pb-16 lg:px-12">
          <div className="mx-auto w-full max-w-[1600px]">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-600/15 border border-teal-600/40 mb-6">
                <Sparkles className="w-4 h-4 text-[#0c5c5b]" />
                <span className="text-sm font-semibold text-[#0c5c5b]">Our Story · Why IdiamPro</span>
              </div>
              <h2 className="text-4xl md:text-6xl font-extrabold mb-5 leading-[1.08] tracking-tight text-[#0c2224]">
                The idea was only half the battle.
              </h2>
              <p className="text-lg md:text-xl text-[#22312f] leading-relaxed max-w-3xl mx-auto">
                A tool I&apos;d envisioned for decades — finally possible now. So I did the most honest test I could think of: I used IdiamPro to plan its own launch. The plan you&apos;ll watch build itself is the real one.
              </p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-[#c2dbd9] bg-[#f4faf9] shadow-2xl shadow-teal-600/10 backdrop-blur-sm">
              <video
                className="block h-auto w-full"
                src="/idiampro-story.mp4"
                poster="/idiampro-story-poster.jpg"
                controls
                playsInline
                preload="metadata"
                aria-label="Our Story — a founder uses IdiamPro to plan IdiamPro's own launch. Produced by IdiamPro."
              />
            </div>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-[#42504f]">
              <Video className="h-3.5 w-3.5 text-teal-600" />
              Produced by IdiamPro
            </p>
          </div>
        </section>

        {/* A different kind of tool — competitor contrast grid, on a dramatic
            full-bleed dark-ink/teal band to break the white wash */}
        <section className="px-6 py-24 lg:px-12 bg-gradient-to-br from-[#0a3d3c] via-[#0c2224] to-[#0c2224]">
          <div className="max-w-[1600px] mx-auto">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-400/15 border border-teal-300/30 mb-6">
                <Zap className="w-4 h-4 text-teal-300" />
                <span className="text-sm font-semibold text-teal-300">A different kind of tool</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-tight">
                Not a filing cabinet. Not a vending machine.
              </h2>
              <p className="text-lg md:text-xl text-white/80 leading-relaxed max-w-[720px] mx-auto">
                Everyone else either stores the thinking you already did, or vends you a one-shot output. We&apos;re the only one that does the thinking <span className="text-teal-300 font-bold">with</span> you — and hands back finished work, iteratively, in your voice.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {[
                {
                  name: 'Obsidian / Logseq',
                  they: 'A beautiful filing cabinet; you write every note and link by hand, and it never thinks with you.',
                  we: 'An active AI partner that generates, expands, merges, and produces the finished thing.',
                },
                {
                  name: 'Notion',
                  they: 'A blank container you must architect and babysit; AI is a bolt-on inside boxes you built.',
                  we: 'Start from one idea; the structure and the output grow for you.',
                },
                {
                  name: 'Roam / Tana',
                  they: 'Brilliant, steep, cult-ish; great at connecting notes for people who live in it.',
                  we: 'Outline-native too, but built for doers who want a book, site, or plan out the door.',
                },
                {
                  name: 'Gamma / Napkin / Mem',
                  they: 'Ask, get a one-shot output, done; you can’t deeply steer or grow it.',
                  we: 'Iterative and author-controlled at every level, in your voice — a living document.',
                },
                {
                  name: 'ChatGPT / Claude (raw chat)',
                  they: 'A brilliant conversation that scrolls away; no structure, no home for your work.',
                  we: 'The same intelligence anchored to a structure that persists, grows, and becomes real deliverables you own.',
                },
                {
                  name: 'Workflowy / classic outliners',
                  they: 'Clean bullets and nothing more; no partner, no production.',
                  we: 'True outlining plus an AI partner plus multilingual, multimedia output.',
                },
              ].map((c) => (
                <div
                  key={c.name}
                  className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.05] p-6 hover:border-teal-300/40 hover:bg-white/[0.08] transition-colors"
                >
                  <h3 className="text-base font-bold text-white mb-4">{c.name}</h3>
                  <div className="mb-4">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-1.5">They</div>
                    <p className="text-sm text-white/75 leading-relaxed">{c.they}</p>
                  </div>
                  <div className="mt-auto pt-4 border-t border-white/10">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-teal-300 mb-1.5">We</div>
                    <p className="text-sm text-teal-100/90 leading-relaxed">{c.we}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Workflows showcase — previews that link out to /workflows (no inline video) */}
        <section className="px-6 py-24 lg:px-12 bg-[#eef6f5] border-y border-[#c2dbd9]">
          <div className="max-w-[1600px] mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-600/15 border border-teal-600/40 mb-6">
                <Play className="w-4 h-4 text-[#0c5c5b]" />
                <span className="text-sm font-semibold text-[#0c5c5b]">Workflows</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-extrabold text-[#0c2224] mb-4 tracking-tight">
                Real stories, start to finish.
              </h2>
              <p className="text-lg md:text-xl text-[#22312f] leading-relaxed max-w-2xl mx-auto">
                Watch a single idea grow into finished work — real end-to-end journeys, captured from the first capture to the last export.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
              {[
                {
                  poster: '/career-workflow-poster.jpg',
                  label: 'Living plan',
                  title: 'Dinesh — a living career plan',
                  desc: 'One outline becomes a plan that keeps up with a real career as it changes.',
                },
                {
                  poster: '/book-workflow-poster.jpg',
                  label: 'From idea to output',
                  title: 'Sam — a science project',
                  desc: 'A curious question grows into a structured, finished project — step by step.',
                },
              ].map((wf) => (
                <a
                  key={wf.title}
                  href="/workflows"
                  className="group block rounded-2xl border border-[#c2dbd9] bg-white overflow-hidden shadow-[0_1px_3px_rgba(12,34,36,0.06),0_8px_24px_rgba(12,34,36,0.05)] hover:border-teal-600/40 hover:shadow-[0_2px_6px_rgba(12,34,36,0.08),0_16px_40px_rgba(12,34,36,0.10)] transition-all"
                >
                  <div className="relative aspect-video overflow-hidden bg-[#f4faf9] border-b border-[#c2dbd9]">
                    <img
                      src={wf.poster}
                      alt={wf.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="w-14 h-14 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg group-hover:bg-white transition-colors">
                        <Play className="w-6 h-6 text-teal-600 ml-0.5" />
                      </span>
                    </div>
                  </div>
                  <div className="p-5 md:p-6">
                    <div className="text-xs text-[#0c5c5b] font-bold uppercase tracking-wider mb-1">{wf.label}</div>
                    <h3 className="text-lg font-semibold text-[#0c2224] mb-1">{wf.title}</h3>
                    <p className="text-[#42504f] text-sm leading-relaxed mb-3">{wf.desc}</p>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#0c5c5b] group-hover:gap-2 transition-all">
                      Watch <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </a>
              ))}
            </div>

            <div className="text-center mt-8">
              <a
                href="/workflows"
                className="inline-flex items-center gap-2 rounded-full border border-teal-600/40 px-6 py-3 text-sm font-semibold text-[#0c5c5b] hover:bg-teal-600/10 transition-colors"
              >
                See all workflows
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </section>

        {/* Explore — short teasers that link out to the dedicated pages. The
            depth lives on /features, /use-cases, /pricing and /faq; the homepage
            stays lean. */}
        <section className="px-6 py-20 lg:px-12">
          <div className="max-w-[1600px] mx-auto">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <h2 className="text-4xl md:text-5xl font-extrabold text-[#0c2224] mb-4 tracking-tight">Explore IdiamPro</h2>
              <p className="text-lg md:text-xl text-[#22312f] leading-relaxed">
                Go deeper into what IdiamPro does, who it&apos;s for, and how it&apos;s priced.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {[
                { href: '/features', icon: Sparkles, title: 'Features', blurb: 'Multi-source synthesis, one outline to many outputs, privacy-first \u2014 the full capability tour.', cta: 'See all features' },
                { href: '/use-cases', icon: Users, title: 'Use Cases', blurb: 'From trial prep to literature reviews to investigative reporting \u2014 pick the work you do.', cta: 'See use cases' },
                { href: '/pricing', icon: Star, title: 'Pricing', blurb: 'Bring your own key free forever, own it once, or Pro cloud superpowers.', cta: 'See pricing' },
                { href: '/faq', icon: MessagesSquare, title: 'FAQ', blurb: 'How it compares, importing notes, privacy, offline use, exports, and more.', cta: 'Read the FAQ' },
              ].map((t) => {
                const TIcon = t.icon;
                return (
                  <Link key={t.href} href={t.href} className="group flex flex-col rounded-2xl border border-[#c2dbd9] bg-[#f4faf9] p-6 hover:border-teal-600/40 hover:bg-[#eef6f5] transition-all">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center mb-4 shadow-lg shadow-teal-600/20">
                      <TIcon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-[#0c2224] mb-2">{t.title}</h3>
                    <p className="text-sm text-[#22312f] leading-relaxed mb-4 flex-1">{t.blurb}</p>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#0c5c5b] group-hover:gap-2 transition-all">
                      {t.cta} <ArrowRight className="w-4 h-4" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
        {/* Final CTA — dramatic deep-teal contrast band */}
        <section className="px-6 py-28 lg:px-12 bg-gradient-to-br from-[#0E7C7B] via-[#0c5c5b] to-[#0a3d3c]">
          <div className="max-w-[1600px] mx-auto text-center">
            <h2 className="text-4xl lg:text-6xl font-extrabold mb-6 tracking-tight text-white leading-[1.08] max-w-4xl mx-auto">
              Ready to transform how you{' '}
              <span className="text-teal-200">
                think and create?
              </span>
            </h2>
            <p className="text-white/80 text-lg md:text-xl mb-10 max-w-2xl mx-auto">
              Join researchers, authors, and professionals who've upgraded their workflow with IdiamPro.
            </p>
            <SignedOut>
              <Button
                onClick={() => { window.location.href = '/signup'; }}
                size="lg"
                className="bg-white hover:bg-teal-50 text-[#0c5c5b] font-bold text-lg px-10 py-6 shadow-2xl shadow-black/25 transition-all duration-300"
              >
                Sign up to try IdiamPro
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </SignedOut>
            <SignedIn>
              <Button
                onClick={launchApp}
                size="lg"
                className="bg-white hover:bg-teal-50 text-[#0c5c5b] font-bold text-lg px-10 py-6 shadow-2xl shadow-black/25 transition-all duration-300"
              >
                Open IdiamPro
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </SignedIn>
            <p className="text-white/60 text-sm mt-4">
              No credit card required. Free tier forever.
            </p>
          </div>
        </section>

        {/* Footnotes */}
        <section className="px-6 py-8 lg:px-12">
          <div className="max-w-4xl mx-auto">
            <div className="border-t border-[#c2dbd9] pt-8">
              <h4 className="text-[#42504f] text-xs uppercase tracking-wider mb-4">Performance Notes</h4>
              <div className="text-[#5a6a69] text-xs space-y-2">
                <p>
                  <strong className="text-[#42504f]">*Node Capacity Testing:</strong> 1,000,000+ nodes tested on Apple M4 MacBook Air
                  (16GB RAM, 512GB SSD) running macOS. Generation time: 4.2s, save time: 1.8s, load time: 1.3s,
                  file size: 98MB. Performance varies by hardware configuration.
                </p>
                <p>
                  <strong className="text-[#42504f]">Platform Considerations:</strong>
                </p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li><strong>Desktop (macOS/Windows/Linux):</strong> Full system RAM available. Recommended for outlines exceeding 100,000 nodes.</li>
                  <li><strong>Web Browser:</strong> Limited to browser memory allocation (typically 2-4GB). Chrome/Edge perform best. Recommended limit: 200,000 nodes.</li>
                  <li><strong>Mobile (iOS/Android):</strong> More constrained memory. For optimal performance, keep outlines under 50,000 nodes.</li>
                </ul>
                <p>
                  <strong className="text-[#42504f]">Storage:</strong> Outline files (.idm) are JSON-based. A 100,000-node outline is approximately 20MB.
                  Local storage has no practical limit; web browser IndexedDB supports gigabytes of storage.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-6 py-12 lg:px-12 border-t border-[#c2dbd9]">
          <div className="max-w-[1600px] mx-auto">
            <div className="grid md:grid-cols-3 gap-8 mb-12">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center">
                    <Brain className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-bold text-[#0c2224]">IdiamPro</span>
                </div>
                <p className="text-[#42504f] text-sm mb-2">
                  Your Intelligence Amplifier.
                </p>
                <p className="text-[#5a6a69] text-xs">
                  Build your second brain. Expand your knowledge. See what others miss.
                </p>
              </div>

              <div>
                <h4 className="text-[#0c2224] font-semibold mb-4">Product</h4>
                <ul className="space-y-2">
                  <li><a href="/features" className="text-[#42504f] hover:text-[#0c2224] text-sm transition-colors">Features</a></li>
                  <li><a href="/pricing" className="text-[#42504f] hover:text-[#0c2224] text-sm transition-colors">Pricing</a></li>
                  <li><a href="/use-cases" className="text-[#42504f] hover:text-[#0c2224] text-sm transition-colors">Use Cases</a></li>
                  <li><a href="/faq" className="text-[#42504f] hover:text-[#0c2224] text-sm transition-colors">FAQ</a></li>
                </ul>
              </div>

              <div>
                <h4 className="text-[#0c2224] font-semibold mb-4">Legal</h4>
                <ul className="space-y-2">
                  <li><a href="/privacy" className="text-[#42504f] hover:text-[#0c2224] text-sm transition-colors">Privacy</a></li>
                </ul>
              </div>
            </div>

            <div className="pt-8 border-t border-[#c2dbd9]">
              <p className="text-[#5a6a69] text-sm">
                © 2026 SecondBrainWare. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </div>

      {/* Custom animations */}
      <style jsx global>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0) translateX(0);
            opacity: 0.2;
          }
          50% {
            transform: translateY(-20px) translateX(10px);
            opacity: 0.5;
          }
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.8s ease-out forwards;
        }

        .animate-float {
          animation: float ease-in-out infinite;
        }

        html {
          scroll-behavior: smooth;
        }
      `}</style>
    </div>
  );
}
