'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MarketingHeader } from '@/components/marketing/marketing-header';
import { useSingleVideoPlayback } from '@/hooks/use-single-video-playback';
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
  LogIn,
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
  Languages,
  AlertTriangle
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
    <section className="px-6 pb-16 lg:px-12 border-t border-[#dde2e5] pt-16">
      <div className="max-w-[1600px] mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-4xl md:text-5xl font-extrabold text-[#0c2224] mb-4 tracking-tight">
            A great idea isn&apos;t a single prompt.
          </h2>
          <p className="text-lg md:text-xl font-medium text-[#22312f] leading-relaxed max-w-[660px] mx-auto">
            It might take a hundred sources — articles, PDFs, videos, notes, textbooks — read, weighed, and merged into one outline before the essence comes into focus. Developing an idea is iterative: many passes, not one flash. IdiamPro is built for that work.
          </p>
        </div>

        {/* Featured hero film — the demonstration of the thesis, sitting directly
            under the explanatory text: one idea, many sources, developed over many
            passes into finished formats. Full section width so the app UI/text read
            clearly (the film shows real interface, not stock footage). */}
        <div className="mb-14">
          <div className="overflow-hidden -mx-6 sm:mx-0 rounded-none sm:rounded-2xl border-y sm:border border-[#dde2e5] bg-[#f7f8fa] shadow-2xl shadow-teal-600/15 ring-1 ring-teal-600/10">
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
          <div className="flex-1 rounded-2xl border border-[#dde2e5] bg-[#f7f8fa] p-6 md:p-8">
            <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-teal-600/15 border border-teal-600/25 mb-4">
              <FileUp className="w-5 h-5 text-teal-600" />
            </div>
            <h3 className="text-lg font-bold text-[#0c2224] mb-3">Many inputs</h3>
            <ul className="space-y-2 text-base text-[#22312f]">
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
            <ul className="space-y-2 text-base text-[#22312f]">
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
          <div className="flex-1 rounded-2xl border border-[#dde2e5] bg-[#f7f8fa] p-6 md:p-8">
            <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-teal-600/15 border border-teal-600/25 mb-4">
              <Rocket className="w-5 h-5 text-teal-600" />
            </div>
            <h3 className="text-lg font-bold text-[#0c2224] mb-3">Publish everywhere</h3>
            <ul className="space-y-2 text-base text-[#22312f]">
              <li>Papers &amp; articles</li>
              <li>Podcasts &amp; videos</li>
              <li>Slides &amp; illustrations</li>
              <li className="text-[#42504f]">…and growing</li>
            </ul>
          </div>
        </div>

        <p className="text-center text-base font-medium text-[#22312f] mt-10 max-w-2xl mx-auto">
          Read widely, merge into one outline, refine the essence — then publish it in any format. That&apos;s idea development, not a one-shot answer.
        </p>
      </div>
    </section>
  );
}

// A single beautifully-framed product screenshot, Apple-product-page style:
// a subtle browser/window chrome (traffic-light dots + faux URL pill), rounded
// corners, and a soft teal-tinted shadow so the bright app screens pop off the
// page. Reused by the showcase gallery below.
function ProductFrame({
  src,
  alt,
  priority = false,
}: {
  src: string;
  alt: string;
  priority?: boolean;
}) {
  return (
    <div className="group relative rounded-2xl border border-[#dde2e5] bg-white overflow-hidden shadow-[0_2px_8px_rgba(12,34,36,0.08),0_24px_60px_rgba(12,60,60,0.16)] ring-1 ring-teal-600/10 transition-all duration-500 hover:shadow-[0_4px_12px_rgba(12,34,36,0.10),0_32px_80px_rgba(12,60,60,0.22)] hover:-translate-y-1">
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 h-9 bg-[#f1f3f5] border-b border-[#e3e7ea]">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        </div>
        <div className="mx-auto flex items-center gap-1.5 rounded-md bg-white/70 border border-[#e3e7ea] px-3 py-0.5">
          <Lock className="w-2.5 h-2.5 text-[#8a9a99]" />
          <span className="text-[10px] font-medium text-[#8a9a99] tracking-tight">2ndbrainware.com</span>
        </div>
      </div>
      <img
        src={src}
        alt={alt}
        width={2880}
        height={1800}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className="block w-full h-auto"
      />
    </div>
  );
}

// One alternating showcase row: big framed screenshot on one side, a punchy
// benefit headline + supporting line on the other. Stacks image-above-text on
// mobile. `reverse` flips image to the right on desktop.
function ShowcaseRow({
  eyebrow,
  headline,
  support,
  src,
  alt,
  reverse = false,
  icon: Icon,
}: {
  eyebrow: string;
  headline: string;
  support: string;
  src: string;
  alt: string;
  reverse?: boolean;
  icon: React.ElementType;
}) {
  return (
    <div className="grid lg:grid-cols-2 gap-8 lg:gap-14 items-center">
      {/* Text */}
      <div className={`${reverse ? 'lg:order-2' : ''} max-w-xl ${reverse ? 'lg:ml-auto' : ''}`}>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-600/12 border border-teal-600/30 mb-4">
          <Icon className="w-3.5 h-3.5 text-[#0c5c5b]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#0c5c5b]">{eyebrow}</span>
        </div>
        <h3 className="text-3xl md:text-4xl lg:text-[2.6rem] font-extrabold text-[#0c2224] tracking-tight leading-[1.08] mb-4">
          {headline}
        </h3>
        <p className="text-lg md:text-xl font-medium text-[#22312f] leading-relaxed">
          {support}
        </p>
      </div>
      {/* Screenshot */}
      <div className={`${reverse ? 'lg:order-1' : ''}`}>
        <ProductFrame src={src} alt={alt} />
      </div>
    </div>
  );
}

// The "Seeing is believing" gallery — Apple-style feature showcases that PROVE
// the product with real screens. The AI-spreadsheet moment gets a standout
// full-width treatment; the rest alternate image-left / image-right.
function SeeItShowcase() {
  return (
    <section className="px-6 py-24 lg:px-12 border-t border-[#dde2e5] bg-gradient-to-b from-white via-[#f6fafa] to-white">
      <div className="max-w-[1400px] mx-auto">
        {/* Heading */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-600/15 border border-teal-600/40 mb-6">
            <Sparkles className="w-4 h-4 text-[#0c5c5b]" />
            <span className="text-sm font-semibold text-[#0c5c5b]">See it in action</span>
          </div>
          <h2 className="text-4xl md:text-6xl font-extrabold text-[#0c2224] mb-4 tracking-tight leading-[1.05]">
            Seeing is believing.
          </h2>
          <p className="text-lg md:text-xl font-medium text-[#22312f] leading-relaxed max-w-[680px] mx-auto">
            Real screens from IdiamPro. Point it at an idea — and watch it become finished, beautiful work.
          </p>
        </div>

        {/* Lead row — the visual plan / mind-map */}
        <div className="mb-24 lg:mb-32">
          <ShowcaseRow
            icon={Network}
            eyebrow="Think visually"
            headline="Turn scattered thinking into a clear visual plan."
            support="Drop in your ideas and watch them become a structured outline — complete with an AI-generated mind-map you can actually follow."
            src="/screenshots/01-hero-strategy-mindmap.png"
            alt="A strategy plan in IdiamPro with an AI-generated mind-map of its structure"
          />
        </div>

        {/* STANDOUT — the killer AI-spreadsheet moment, full-width, centered */}
        <div className="mb-24 lg:mb-32">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-teal-600 to-[#0c5c5b] mb-5 shadow-md shadow-teal-600/25">
              <BarChart3 className="w-3.5 h-3.5 text-white" />
              <span className="text-xs font-bold uppercase tracking-wider text-white">Killer feature</span>
            </div>
            <h3 className="text-4xl md:text-5xl lg:text-[3.4rem] font-extrabold text-[#0c2224] tracking-tight leading-[1.05] mb-4">
              Ask for a spreadsheet.<br className="hidden sm:block" /> Get one — filled in.
            </h3>
            <p className="text-lg md:text-2xl font-medium text-[#22312f] leading-relaxed max-w-[720px] mx-auto">
              Describe the numbers you need. IdiamPro builds a real, editable spreadsheet — with the data already in the cells.
            </p>
          </div>
          <div className="max-w-[1200px] mx-auto">
            <ProductFrame
              src="/screenshots/02-ai-spreadsheet.png"
              alt="IdiamPro generating a real, filled-in budget spreadsheet from a request"
            />
          </div>
        </div>

        {/* Remaining alternating rows */}
        <div className="space-y-24 lg:space-y-32">
          <ShowcaseRow
            icon={Kanban}
            eyebrow="Track anything"
            headline="Organize and track anything, beautifully."
            support="Color-coded status boards keep every workstream, owner, and deadline in view — so nothing slips and progress is obvious at a glance."
            src="/screenshots/03-status-dashboard.png"
            alt="A colorful status board in IdiamPro tracking workstreams and progress"
            reverse
          />
          <ShowcaseRow
            icon={Sparkles}
            eyebrow="Smart tools"
            headline="Let AI develop, expand, and structure your ideas."
            support="One click to generate from context, expand a single thought, or build out every branch at once — the thinking grows with you."
            src="/screenshots/04-generate-smarttools.png"
            alt="IdiamPro's Generate / Smart Tools menu for developing ideas with AI"
          />
          <ShowcaseRow
            icon={GitBranch}
            eyebrow="Diagrams on demand"
            headline="Generate mind-maps, flowcharts, and diagrams on command."
            support="Turn any branch of your outline into a diagram — instantly, from what you've already written. No drawing, no dragging boxes."
            src="/screenshots/06-diagram-menu.png"
            alt="IdiamPro's diagram menu offering mind-map and flowchart generation"
            reverse
          />
          <ShowcaseRow
            icon={Layers}
            eyebrow="All in one place"
            headline="Docs, sheets, videos, and more — together."
            support="Embed Google Docs, Sheets, Slides, YouTube, maps and more. Your whole workspace lives inside one living outline."
            src="/screenshots/05-integrations-menu.png"
            alt="IdiamPro's embed menu with Google Docs, Sheets, Slides, YouTube and maps"
          />
        </div>
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

  useSingleVideoPlayback();

  useEffect(() => {
    setMounted(true);
  }, []);


  return (
    <div className="fixed inset-0 bg-white text-[#0c2224] overflow-x-hidden overflow-y-auto">
      {/* Background gradients */}
      <div className="fixed inset-0 bg-gradient-to-br from-white via-white to-white" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-600/[0.035] via-transparent to-transparent" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-teal-600/[0.02] via-transparent to-transparent" />

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
                <h1 className="text-5xl md:text-8xl font-extrabold mb-3 leading-[1.05] tracking-tight">
                  <span className="block text-[#0c2224]">From One Idea</span>
                  <span className="block bg-gradient-to-r from-teal-500 via-teal-600 to-teal-600 bg-clip-text text-transparent">to Finished Work.</span>
                </h1>
                <p className="text-xl md:text-3xl font-bold text-[#0c5c5b] mb-5">
                  The AI that develops ideas.
                </p>
                <p className="text-lg md:text-2xl font-semibold text-[#0c2224] mb-6 max-w-2xl mx-auto leading-snug">
                  One place to develop ideas — from first thought to finished work.
                </p>
                <p className="text-xl md:text-2xl font-semibold text-[#0c2224] mb-4 max-w-3xl mx-auto">
                  Capture, consolidate, and develop your ideas with AI — then turn them into articles, podcasts, videos, websites, and more, in a click.
                </p>
                <p className="text-lg md:text-xl text-[#22312f] mb-8 max-w-3xl mx-auto leading-relaxed">
                  Not a chat that forgets — a thinking machine that helps you{' '}
                  <span className="text-[#0c5c5b] font-semibold">consolidate many sources into coherent, developed thinking</span>{' '}
                  — refined over many passes, then published in whatever format you need.
                </p>

                {/* Output strip — provable formats IdiamPro produces. The
                    formats with real example galleries are clickable chips that
                    navigate to their gallery; the rest point to the examples hub. */}
                <div className="flex flex-wrap justify-center gap-2 mb-8 max-w-2xl mx-auto">
                  {[
                    { label: 'Research papers', href: '/examples' },
                    { label: 'Podcasts', href: '/examples/podcasts' },
                    { label: 'Videos', href: '/examples/videos' },
                    { label: 'Websites', href: '/examples/websites' },
                    { label: 'Presentations', href: '/examples' },
                    { label: 'Illustrations', href: '/examples' },
                    { label: '21 languages', href: '/examples' },
                    { label: '…and more', href: '/examples', muted: true },
                  ].map((chip) => (
                    <Link
                      key={chip.label}
                      href={chip.href}
                      className={`px-3 py-1.5 rounded-full bg-[#f1f3f5] border border-[#d3d9dc] text-sm font-medium transition-colors hover:bg-teal-600/10 hover:border-teal-600/50 hover:text-[#0c5c5b] ${chip.muted ? 'text-[#42504f] italic' : 'text-[#0f2b29]'}`}
                    >
                      {chip.label}
                    </Link>
                  ))}
                </div>

                {/* Hero CTA — signed-out shows sign-up; signed-in opens the app. */}
                <div className="mb-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                  <SignedOut>
                    <Button
                      onClick={() => { window.location.href = '/signup'; }}
                      size="lg"
                      className="bg-gradient-to-br from-[#0ea5a4] to-[#0b74c4] hover:from-[#0c8f8e] hover:to-[#0960a3] text-white font-bold px-8 py-6 text-base shadow-xl shadow-teal-700/35"
                    >
                      Sign up to try IdiamPro free
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <button
                      type="button"
                      onClick={() => { window.location.href = '/signin'; }}
                      className="inline-flex items-center gap-2 rounded-full border border-teal-600/40 bg-white px-5 py-3 text-sm font-semibold text-[#0c5c5b] hover:bg-teal-600/10 hover:border-teal-600/60 transition-colors shadow-sm"
                    >
                      <LogIn className="w-4 h-4" />
                      I already have an account
                    </button>
                  </SignedOut>
                  <SignedIn>
                    <Button
                      onClick={launchApp}
                      size="lg"
                      className="bg-gradient-to-br from-[#0ea5a4] to-[#0b74c4] hover:from-[#0c8f8e] hover:to-[#0960a3] text-white font-bold px-8 py-6 text-base shadow-xl shadow-teal-700/35"
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

        {/* Three categories — the crisp crystallization of IdiamPro's category:
            query box ANSWERS, outliner STORES, IdiamPro DEVELOPS. Light Clarity
            band; leads into the dark tool-by-tool grid below as the deeper dive. */}
        <section className="px-6 py-24 lg:px-12 border-t border-[#dde2e5]">
          <div className="max-w-[1600px] mx-auto">
            <div className="text-center max-w-3xl mx-auto mb-14">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-600/15 border border-teal-600/40 mb-6">
                <Layers className="w-4 h-4 text-[#0c5c5b]" />
                <span className="text-sm font-semibold text-[#0c5c5b]">Where IdiamPro fits</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-extrabold text-[#0c2224] mb-4 tracking-tight">
                Three kinds of tools. Only one thinks <span className="text-[#0c5c5b]">with</span> you.
              </h2>
              <p className="text-lg md:text-xl font-medium text-[#22312f] leading-relaxed max-w-[720px] mx-auto">
                A query box answers. A filing cabinet stores. IdiamPro develops — the difference between a moment and a process.
              </p>
            </div>

            {/* Three columns — first two muted, IdiamPro the highlighted culmination */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 items-stretch">
              {/* 1 — The query box */}
              <div className="flex flex-col rounded-2xl border border-[#dde2e5] bg-[#f7f8fa] p-7">
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-[#eceff1] border border-[#dde2e5] mb-5">
                  <MessagesSquare className="w-5 h-5 text-[#5a6a69]" />
                </div>
                <div className="text-xs font-bold uppercase tracking-wider text-[#5a6a69] mb-1">The query box</div>
                <div className="text-sm text-[#5a6a69] mb-4">ChatGPT · Gemini · Claude chat</div>
                <div className="text-5xl md:text-6xl font-black text-[#42504f] mb-4 tracking-tight leading-none">Answers.</div>
                <p className="text-base font-medium text-[#22312f] leading-relaxed">
                  You ask, it answers — then the thinking evaporates. No structure, no growing memory, no body of work. A moment, not a process.
                </p>
              </div>

              {/* 2 — The outliner / vault */}
              <div className="flex flex-col rounded-2xl border border-[#dde2e5] bg-[#f7f8fa] p-7">
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-[#eceff1] border border-[#dde2e5] mb-5">
                  <FolderTree className="w-5 h-5 text-[#5a6a69]" />
                </div>
                <div className="text-xs font-bold uppercase tracking-wider text-[#5a6a69] mb-1">The outliner / vault</div>
                <div className="text-sm text-[#5a6a69] mb-4">Obsidian · Notion · Roam</div>
                <div className="text-5xl md:text-6xl font-black text-[#42504f] mb-4 tracking-tight leading-none">Stores.</div>
                <p className="text-base font-medium text-[#22312f] leading-relaxed">
                  A place to store what you already figured out. It holds your notes, but won&apos;t help you develop them, connect them, or turn them into anything.
                </p>
              </div>

              {/* 3 — IdiamPro (highlighted culmination) */}
              <div className="relative flex flex-col rounded-2xl border-2 border-teal-600 bg-gradient-to-br from-teal-700/12 to-teal-700/[0.06] p-7 shadow-2xl shadow-teal-600/20 md:-mt-3">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-teal-600 to-[#0c5c5b] px-4 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-md whitespace-nowrap">
                  A different category
                </span>
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-teal-600/25 border border-teal-600/40 mb-5">
                  <Brain className="w-5 h-5 text-[#0c5c5b]" />
                </div>
                <div className="text-xs font-bold uppercase tracking-wider text-[#0c5c5b] mb-1">IdiamPro</div>
                <div className="text-sm text-[#0c5c5b] mb-4">The idea-development engine</div>
                <div className="text-5xl md:text-6xl font-black text-[#0c5c5b] mb-4 tracking-tight leading-none">Develops.</div>
                <p className="text-base font-medium text-[#22312f] leading-relaxed mb-4">
                  The only one that works <span className="font-bold text-[#0c5c5b]">with</span> you to develop an idea over time: capture, structure, enrich from the web and AI, <span className="font-bold text-[#0c5c5b]">consolidate</span> it into real understanding — then produce finished work.
                </p>
                <div className="mt-auto flex flex-wrap gap-1.5">
                  {['Documents', 'Videos', 'Podcasts', 'Sites', '21 languages'].map((f) => (
                    <span key={f} className="inline-flex items-center rounded-full bg-teal-600/12 border border-teal-600/25 px-2.5 py-1 text-xs font-semibold text-[#0c5c5b]">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Kicker — the consolidation → wisdom thesis */}
            <p className="text-center text-lg md:text-xl font-medium text-[#22312f] leading-relaxed mt-12 max-w-[760px] mx-auto">
              <span className="font-bold text-[#0c2224]">Reorganizing your thinking is understanding it.</span> That consolidation — everything you know, connected and reusable — is what a query box and a filing cabinet can never give you.
            </p>

            {/* Capability matrix — scannable check/✗ across the three */}
            <div className="mt-14 max-w-[900px] mx-auto rounded-2xl border border-[#dde2e5] bg-white overflow-hidden shadow-[0_1px_3px_rgba(12,34,36,0.06),0_8px_24px_rgba(12,34,36,0.05)]">
              {/* Header row */}
              <div className="grid grid-cols-[1.7fr_1fr_1fr_1fr] bg-[#f7f8fa] border-b border-[#dde2e5]">
                <div className="p-3 md:p-4" />
                <div className="p-3 md:p-4 text-center text-[11px] md:text-xs font-bold text-[#5a6a69] leading-tight">Query<br className="sm:hidden" /> box</div>
                <div className="p-3 md:p-4 text-center text-[11px] md:text-xs font-bold text-[#5a6a69] leading-tight">Outliner<br className="sm:hidden" /> / vault</div>
                <div className="p-3 md:p-4 text-center text-[11px] md:text-xs font-extrabold text-[#0c5c5b] leading-tight bg-teal-600/10">IdiamPro</div>
              </div>
              {[
                { row: 'Memory that grows over time', a: false, b: 'partial', c: true },
                { row: 'Turns thinking into finished work', a: 'partial', b: false, c: true },
                { row: 'Consolidates across everything you know', a: false, b: false, c: true },
                { row: 'Works WITH you, not one-shot', a: false, b: false, c: true },
              ].map((m, i) => {
                const cell = (v: boolean | string, highlight = false) => {
                  if (v === true) return <Check className={`h-4 w-4 md:h-5 md:w-5 ${highlight ? 'text-teal-600' : 'text-teal-600'}`} strokeWidth={3} />;
                  if (v === 'partial') return <span className="text-[#8a9a99] font-bold text-base md:text-lg leading-none">~</span>;
                  return <X className="h-4 w-4 md:h-5 md:w-5 text-[#d5dadd]" strokeWidth={2.5} />;
                };
                return (
                  <div
                    key={m.row}
                    className={`grid grid-cols-[1.7fr_1fr_1fr_1fr] items-center ${i > 0 ? 'border-t border-[#e8ebed]' : ''}`}
                  >
                    <div className="p-3 md:p-4 text-xs md:text-sm font-medium text-[#22312f] leading-snug">{m.row}</div>
                    <div className="p-3 md:p-4 flex justify-center">{cell(m.a)}</div>
                    <div className="p-3 md:p-4 flex justify-center">{cell(m.b)}</div>
                    <div className="p-3 md:p-4 flex justify-center bg-teal-600/[0.06]">{cell(m.c, true)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Sizzle reel — a 30-second "coming attractions" trailer of the three
            workflow stories, placed early as a fast emotional hook right before
            the screenshot proof. Click-to-play with poster + controls (it has
            music/dialogue, so never autoplay with sound); it flows through the
            page-wide single-video hook so it pauses the other videos. */}
        <section className="px-6 py-24 lg:px-12 border-t border-[#dde2e5] bg-gradient-to-b from-white via-[#f6fafa] to-white">
          <div className="max-w-[1400px] mx-auto">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-600/15 border border-teal-600/40 mb-6">
                <Play className="w-4 h-4 text-[#0c5c5b]" />
                <span className="text-sm font-semibold text-[#0c5c5b]">The 30-second version</span>
              </div>
              <h2 className="text-4xl md:text-6xl font-extrabold text-[#0c2224] mb-4 tracking-tight leading-[1.05]">
                See real people win with it.
              </h2>
              <p className="text-lg md:text-xl font-medium text-[#22312f] leading-relaxed max-w-[680px] mx-auto">
                A fast trailer of three real workflows — from first spark to published work. Hit play.
              </p>
            </div>

            {/* Framed player — full section width, full-bleed on mobile, premium
                rounded frame + soft teal shadow to match the other films. */}
            <div className="overflow-hidden -mx-6 sm:mx-0 rounded-none sm:rounded-2xl border-y sm:border border-[#dde2e5] bg-[#f7f8fa] shadow-2xl shadow-teal-600/15 ring-1 ring-teal-600/10">
              <video
                className="block h-auto w-full aspect-video object-cover"
                src="/homepage-sizzle.mp4?v=1"
                poster="/homepage-sizzle-poster.jpg"
                controls
                playsInline
                preload="metadata"
                aria-label="Watch the 30-second IdiamPro sizzle reel — produced by IdiamPro"
              />
            </div>

            <div className="mt-8 text-center">
              <Link
                href="/workflows"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-[#0ea5a4] to-[#0b74c4] hover:from-[#0c8f8e] hover:to-[#0960a3] px-6 py-3 text-base font-bold text-white shadow-lg shadow-teal-700/30 transition-colors"
              >
                Watch the full stories
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Seeing is believing — Apple-style feature showcases with real product
            screenshots, right after the category is established. The visual proof
            at the emotional peak: "look what it makes." */}
        <SeeItShowcase />

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
              <p className="text-lg md:text-xl font-medium text-white/80 leading-relaxed max-w-[720px] mx-auto">
                Everyone else stores the thinking you already did, or vends a one-shot output. We do the thinking <span className="text-teal-300 font-bold">with</span> you — and hand back finished work, iteratively, in your voice.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {[
                {
                  name: 'Obsidian / Logseq',
                  they: 'A beautiful filing cabinet — you write every note and link by hand.',
                  we: 'An AI partner that generates, expands, merges, and produces the finished thing.',
                },
                {
                  name: 'Notion',
                  they: 'A blank container you must architect and babysit; AI is a bolt-on.',
                  we: 'Start from one idea; the structure and the output grow for you.',
                },
                {
                  name: 'Roam / Tana',
                  they: 'Brilliant, steep, cult-ish — great for people who live in it.',
                  we: 'Outline-native too, but built for doers who want a book, site, or plan out the door.',
                },
                {
                  name: 'Gamma / Napkin / Mem',
                  they: 'Ask, get a one-shot output — you can’t deeply steer or grow it.',
                  we: 'Iterative and author-controlled, in your voice — a living document.',
                },
                {
                  name: 'ChatGPT / Claude (raw chat)',
                  they: 'A brilliant conversation that scrolls away; no structure, no home for your work.',
                  we: 'The same intelligence, anchored to a structure that persists, grows, and becomes deliverables you own.',
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
                    <p className="text-base font-medium text-white/75 leading-relaxed">{c.they}</p>
                  </div>
                  <div className="mt-auto pt-4 border-t border-white/10">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-teal-300 mb-1.5">We</div>
                    <p className="text-base font-medium text-teal-100/90 leading-relaxed">{c.we}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Workflows showcase — previews that link out to /workflows (no inline video) */}
        <section className="px-6 py-24 lg:px-12 bg-[#f1f3f5] border-y border-[#dde2e5]">
          <div className="max-w-[1600px] mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-600/15 border border-teal-600/40 mb-6">
                <Play className="w-4 h-4 text-[#0c5c5b]" />
                <span className="text-sm font-semibold text-[#0c5c5b]">Workflows</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-extrabold text-[#0c2224] mb-4 tracking-tight">
                Real stories, start to finish.
              </h2>
              <p className="text-lg md:text-xl font-medium text-[#22312f] leading-relaxed max-w-2xl mx-auto">
                Watch a single idea grow into finished work — real journeys, from first capture to final export.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
              {[
                {
                  poster: '/career-workflow-poster.jpg',
                  label: 'Living plan',
                  title: 'Dinesh — a living career plan',
                  desc: 'Dinesh finished his degree with no idea what came next — and a quiet fear that AI would leave no career for him. One outline became a living plan he could reshape as the ground shifted.',
                },
                {
                  poster: '/book-workflow-poster.jpg',
                  label: 'From idea to output',
                  title: 'Sam — a science project',
                  desc: 'Sam is eleven, taking on cold fusion for the science fair with a scholarship on the line. One question grew into a finished report, poster, talk, website, and video.',
                },
              ].map((wf) => (
                <a
                  key={wf.title}
                  href="/workflows"
                  className="group block rounded-2xl border border-[#dde2e5] bg-white overflow-hidden shadow-[0_1px_3px_rgba(12,34,36,0.06),0_8px_24px_rgba(12,34,36,0.05)] hover:border-teal-600/40 hover:shadow-[0_2px_6px_rgba(12,34,36,0.08),0_16px_40px_rgba(12,34,36,0.10)] transition-all"
                >
                  <div className="relative aspect-video overflow-hidden bg-[#f7f8fa] border-b border-[#dde2e5]">
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
                    <p className="text-[#22312f] text-base font-medium leading-relaxed mb-3">{wf.desc}</p>
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
              <p className="text-lg md:text-xl font-medium text-[#22312f] leading-relaxed">
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
                  <Link key={t.href} href={t.href} className="group flex flex-col rounded-2xl border border-[#dde2e5] bg-[#f7f8fa] p-6 hover:border-teal-600/40 hover:bg-[#f1f3f5] transition-all">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center mb-4 shadow-lg shadow-teal-600/20">
                      <TIcon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-[#0c2224] mb-2">{t.title}</h3>
                    <p className="text-base font-medium text-[#22312f] leading-relaxed mb-4 flex-1">{t.blurb}</p>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#0c5c5b] group-hover:gap-2 transition-all">
                      {t.cta} <ArrowRight className="w-4 h-4" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
        {/* Ready to get started — closing "how to start + the offer" section:
            3 steps, the getting-started film, and the membership tiers. Prices
            CONFIRMED by Howard 2026-07-16 (see docs/pricing-cost-analysis.md):
            Free $0, Professional $19.99/mo, Student $9.99/mo — web/Mac headline
            prices; iPhone/iPad billed via the App Store (Apple's cut). */}
        <section className="px-6 py-24 lg:px-12 border-t border-[#dde2e5] bg-gradient-to-b from-white to-[#f1f3f5]">
          <div className="max-w-[1600px] mx-auto">
            {/* Heading */}
            <div className="text-center max-w-3xl mx-auto mb-14">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-600/15 border border-teal-600/40 mb-6">
                <Rocket className="w-4 h-4 text-[#0c5c5b]" />
                <span className="text-sm font-semibold text-[#0c5c5b]">Ready to get started?</span>
              </div>
              <h2 className="text-4xl md:text-6xl font-extrabold mb-5 leading-[1.08] tracking-tight text-[#0c2224]">
                Ready to get started?
              </h2>
              <p className="text-lg md:text-xl font-medium text-[#22312f] leading-relaxed">
                Three quick steps from thinking bigger. Get the app, turn on free on-device AI, and start building — no credit card, no setup.
              </p>
            </div>

            {/* Getting-started steps */}
            <div className="grid md:grid-cols-3 gap-6 mb-20">
              {[
                {
                  n: '1',
                  icon: Download,
                  title: 'Download IdiamPro',
                  body: 'Get it on Mac, iPhone & iPad, or run it right in your web browser. Your work syncs with you.',
                  chips: ['Mac', 'iPhone · iPad', 'Web'],
                },
                {
                  n: '2',
                  icon: Brain,
                  title: 'Add Google Gemma',
                  body: 'Turn on free on-device AI — no API key, no cost, and your notes never leave your device. Want premium cloud AI? Bring your own key anytime.',
                  chips: ['Free', 'No API key', 'Private'],
                },
                {
                  n: '3',
                  icon: Sparkles,
                  title: 'Start creating',
                  body: 'Capture ideas, organize them, consolidate the best thinking, and publish — outlines, videos, podcasts, and more.',
                  chips: ['Capture', 'Organize', 'Consolidate', 'Publish'],
                },
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <div
                    key={s.n}
                    className="relative flex flex-col rounded-2xl border border-[#dde2e5] bg-[#f7f8fa] p-7 shadow-lg shadow-teal-600/5"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-[#0c5c5b] text-white shadow-md shadow-teal-600/25">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="text-4xl font-extrabold text-[#dde2e5]">{s.n}</span>
                    </div>
                    <h3 className="text-xl font-bold text-[#0c2224] mb-2">{s.title}</h3>
                    <p className="text-base font-medium text-[#22312f] leading-relaxed mb-5 flex-1">{s.body}</p>
                    <div className="flex flex-wrap gap-2">
                      {s.chips.map((c) => (
                        <span
                          key={c}
                          className="inline-flex items-center rounded-full bg-teal-600/10 border border-teal-600/25 px-3 py-1 text-xs font-semibold text-[#0c5c5b]"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Keep your work safe — DELIBERATE RED LIABILITY-DISCLAIMER treatment
                (Howard 2026-07-16: red, bold, bordered — a warning, not a tip).
                Local-first: files live on the user's device (desktop) or in the
                browser's storage (web), so off-device backup is the user's
                responsibility. Covers BOTH the native-file case and the more
                fragile browser-storage case. No literal flashing — a professional
                tool doesn't blink, and it breaks screen readers. */}
            <div className="mb-20">
              <div className="relative overflow-hidden rounded-2xl border-2 border-red-500 bg-red-50 p-7 sm:p-9 shadow-lg shadow-red-500/15">
                <div className="flex flex-col sm:flex-row sm:items-start gap-5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-red-700 text-white shadow-md shadow-red-600/25">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="inline-flex items-center rounded-full bg-red-600 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
                        Important — please read
                      </span>
                    </div>
                    <h3 className="text-2xl md:text-3xl font-extrabold text-red-700 tracking-tight mb-3">
                      Keep your work safe — back it up
                    </h3>
                    <p className="text-lg leading-relaxed mb-3">
                      <span className="font-bold text-red-700">Your work lives on your own device, and keeping it safe is ultimately your responsibility. Store your IdiamPro files in a location that&apos;s automatically backed up.</span>
                      <span className="text-[#22312f]"> The method is your choice — iCloud Drive, Dropbox, Google Drive, OneDrive, a Time Machine disk, or any backup you trust. IdiamPro keeps automatic local snapshots as a safety net, but they are </span>
                      <span className="font-bold text-red-700">not a substitute for your own off-device backup.</span>
                    </p>
                    <p className="text-lg leading-relaxed mb-4">
                      <span className="font-bold text-red-700">Using the free web version in a browser? Your work is saved inside that browser, on that device — and it can be lost if you clear your browser data, use private/incognito mode, or switch browsers.</span>
                      <span className="text-[#22312f]"> Export your outlines regularly and keep the copies in a backed-up location.</span>
                    </p>
                    <div className="flex flex-wrap gap-2 mb-5">
                      {['iCloud Drive', 'Dropbox', 'Google Drive', 'OneDrive', 'Time Machine', 'Your choice'].map((c) => (
                        <span
                          key={c}
                          className="inline-flex items-center rounded-full bg-white border border-red-300 px-3 py-1 text-xs font-semibold text-red-700"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                    <div className="mb-5 rounded-xl border border-red-200 bg-white/60 p-4">
                      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-red-700">
                        More ways to protect your work
                      </div>
                      <ul className="grid gap-2 text-base text-[#22312f] sm:grid-cols-2">
                        {[
                          'Keep more than one copy — the 3-2-1 rule: 3 copies, on 2 kinds of storage, 1 kept off-site.',
                          'Use a backup that keeps version history (Time Machine, iCloud, Dropbox) so you can roll back a bad change or a corrupted file.',
                          'Export important outlines before any big reorganization or deletion — an extra copy costs nothing.',
                          'Occasionally test that you can actually restore a file — an untested backup isn’t a backup.',
                          'Protect the device itself: turn on disk encryption (FileVault on Mac) and a passcode/login.',
                          'Turn on two-factor authentication for your cloud/backup account so the backup itself stays secure.',
                        ].map((m) => (
                          <li key={m} className="flex items-start gap-2">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                            <span>{m}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-xl bg-red-100 border border-red-300 px-4 py-2.5">
                      <MessagesSquare className="h-4 w-4 shrink-0 text-red-700" />
                      <span className="text-sm font-medium text-[#0c2224]">
                        Not sure what to pick? Ask <span className="font-bold">IdiamPro Help</span> and we&apos;ll walk you through it.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Platform reassurance — nobody is blocked. Apple gets native apps
                today; every other platform is fully usable right now via the web.
                Honest per real status: do NOT claim native Windows/Linux/Android. */}
            <div className="mb-20">
              <div className="text-center max-w-3xl mx-auto mb-8">
                <h3 className="text-3xl md:text-4xl font-extrabold text-[#0c2224] tracking-tight mb-3">
                  Start now, on any device
                </h3>
                <p className="text-lg md:text-xl font-medium text-[#22312f]">
                  Native apps on Apple. Everywhere else, the free web version runs instantly — nothing to install.
                </p>
              </div>
              <div className="grid sm:grid-cols-2 gap-6">
                {/* Apple native */}
                <div className="rounded-2xl border border-[#dde2e5] bg-[#f7f8fa] p-7 shadow-lg shadow-teal-600/5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-teal-600 to-[#0c5c5b] text-white">
                      <Laptop className="h-4 w-4" />
                    </div>
                    <h4 className="text-lg font-bold text-[#0c2224]">Apple — native apps</h4>
                  </div>
                  <p className="text-base font-medium text-[#22312f] leading-relaxed mb-5">
                    The full native experience, downloaded and installed on your Apple devices.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { icon: Laptop, label: 'Mac' },
                      { icon: Smartphone, label: 'iPhone' },
                      { icon: Smartphone, label: 'iPad' },
                    ].map((p, i) => {
                      const Icon = p.icon;
                      return (
                        <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-teal-600/10 border border-teal-600/25 px-3 py-1.5 text-xs font-semibold text-[#0c5c5b]">
                          <Icon className="h-3.5 w-3.5" />
                          {p.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
                {/* Web — any device */}
                <div className="rounded-2xl border border-[#dde2e5] bg-[#f7f8fa] p-7 shadow-lg shadow-teal-600/5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-teal-600 to-[#0c5c5b] text-white">
                      <Globe className="h-4 w-4" />
                    </div>
                    <h4 className="text-lg font-bold text-[#0c2224]">Web — any device</h4>
                  </div>
                  <p className="text-base font-medium text-[#22312f] leading-relaxed mb-5">
                    Nothing to install. Open it in any modern browser and start right now — the free web version runs instantly, everywhere.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {['Windows', 'Linux', 'Chromebook', 'Android', 'Any browser'].map((p) => (
                      <span key={p} className="inline-flex items-center gap-1.5 rounded-full bg-teal-600/10 border border-teal-600/25 px-3 py-1.5 text-xs font-semibold text-[#0c5c5b]">
                        <Monitor className="h-3.5 w-3.5" />
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Getting-started video — full-bleed on mobile, framed on desktop.
                The film is produced in parallel; if the mp4/poster aren't on disk
                yet, the teal gradient frame shows gracefully instead of failing. */}
            <div className="mb-20">
              <div className="text-center mb-8">
                <h3 className="text-3xl md:text-4xl font-extrabold text-[#0c2224] tracking-tight mb-3">
                  Watch it come together
                </h3>
                <p className="text-lg md:text-xl font-medium text-[#22312f] max-w-2xl mx-auto">
                  A two-minute walkthrough — from a blank page to a published idea.
                </p>
              </div>
              <div className="overflow-hidden -mx-6 sm:mx-0 rounded-none sm:rounded-2xl border-y sm:border border-[#dde2e5] bg-gradient-to-br from-[#0E7C7B] via-[#0c5c5b] to-[#0a3d3c] shadow-2xl shadow-teal-600/15 ring-1 ring-teal-600/10">
                <video
                  className="block h-auto w-full aspect-video object-cover"
                  src="/getting-started.mp4"
                  poster="/getting-started-poster.jpg"
                  controls
                  playsInline
                  preload="metadata"
                  aria-label="Getting Started with IdiamPro — a two-minute walkthrough from blank page to published idea."
                />
              </div>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-[#42504f]">
                <Video className="h-3.5 w-3.5 text-teal-600" />
                Getting Started walkthrough
              </p>
            </div>

            {/* Membership tiers */}
            <div className="text-center max-w-3xl mx-auto mb-12">
              <h3 className="text-3xl md:text-5xl font-extrabold text-[#0c2224] tracking-tight mb-4">
                Choose your plan
              </h3>
              <p className="text-lg md:text-xl font-medium text-[#22312f]">
                Start free forever. Upgrade whenever you want more power.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-6 items-stretch">
              {/* Free */}
              <div className="flex flex-col rounded-2xl border border-[#dde2e5] bg-[#f7f8fa] p-8 shadow-lg shadow-teal-600/5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600/15 text-[#0c5c5b]">
                    <Star className="h-4 w-4" />
                  </div>
                  <h4 className="text-xl font-bold text-[#0c2224]">Free</h4>
                </div>
                <div className="mb-6">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-extrabold text-[#0c2224]">$0</span>
                    <span className="text-sm font-medium text-[#5a6a69]">forever</span>
                  </div>
                  <p className="mt-2 text-xs text-[#5a6a69]">No credit card required</p>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {['On-device AI with Google Gemma', 'Full outlining & Second Brain', 'Capture, organize & consolidate', 'Your data stays on your device'].map((f) => (
                    <li key={f} className="flex items-start gap-2 text-base text-[#22312f]">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => { window.location.href = '/signup'; }}
                  variant="outline"
                  size="lg"
                  className="w-full border-[#0c5c5b] text-[#0c5c5b] hover:bg-teal-50 font-semibold"
                >
                  Get started free
                </Button>
              </div>

              {/* Professional — highlighted */}
              <div className="relative flex flex-col rounded-2xl border-2 border-teal-600 bg-white p-8 shadow-2xl shadow-teal-600/20 md:-mt-3">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-teal-600 to-[#0c5c5b] px-4 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-md">
                  Most popular
                </span>
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-teal-600 to-[#0c5c5b] text-white">
                    <Briefcase className="h-4 w-4" />
                  </div>
                  <h4 className="text-xl font-bold text-[#0c2224]">Professional</h4>
                </div>
                <div className="mb-6">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-extrabold text-[#0c2224]">$19.99</span>
                    <span className="text-sm font-medium text-[#5a6a69]">/month</span>
                  </div>
                  <p className="mt-2 text-xs text-[#5a6a69]">First month free · on web &amp; Mac. iPhone &amp; iPad via the App Store.</p>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {['Everything in Free, plus:', 'Premium cloud AI models', 'Video & podcast generation', 'All export formats', 'Priority support'].map((f) => (
                    <li key={f} className="flex items-start gap-2 text-base text-[#22312f]">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => { window.location.href = '/signup'; }}
                  size="lg"
                  className="w-full bg-gradient-to-r from-[#0ea5a4] to-[#0b74c4] hover:from-[#0c8f8e] hover:to-[#0960a3] text-white font-bold shadow-lg shadow-teal-600/25"
                >
                  Start Professional
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>

              {/* Student */}
              <div className="flex flex-col rounded-2xl border border-[#dde2e5] bg-[#f7f8fa] p-8 shadow-lg shadow-teal-600/5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600/15 text-[#0c5c5b]">
                    <GraduationCap className="h-4 w-4" />
                  </div>
                  <h4 className="text-xl font-bold text-[#0c2224]">Student</h4>
                </div>
                <div className="mb-6">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-extrabold text-[#0c2224]">$9.99</span>
                    <span className="text-sm font-medium text-[#5a6a69]">/month</span>
                  </div>
                  <p className="mt-2 text-xs text-[#5a6a69]">Half price · verify with your .edu email. iPhone &amp; iPad via the App Store.</p>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {['Everything in Professional', 'Special student discount', 'Verify with your .edu email', 'Built for coursework & research'].map((f) => (
                    <li key={f} className="flex items-start gap-2 text-base text-[#22312f]">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => { window.location.href = '/signup'; }}
                  variant="outline"
                  size="lg"
                  className="w-full border-[#0c5c5b] text-[#0c5c5b] hover:bg-teal-50 font-semibold"
                >
                  Get student pricing
                </Button>
              </div>
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
            <p className="text-white/80 text-lg md:text-xl font-medium mb-10 max-w-2xl mx-auto">
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
            <div className="border-t border-[#dde2e5] pt-8">
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
        <footer className="px-6 py-12 lg:px-12 border-t border-[#dde2e5]">
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

            <div className="pt-8 border-t border-[#dde2e5]">
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
