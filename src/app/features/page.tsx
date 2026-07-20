'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { SignedIn, SignedOut } from '@/lib/auth/signed-gates';
import { MarketingHeader } from '@/components/marketing/marketing-header';
import { ArrowLeft } from 'lucide-react';
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

const SIGNUP_URL = '/signup';
const launchApp = () => {
  window.location.href = SIGNUP_URL;
};

// Animated counter component
function AnimatedNumber({ value, suffix = '', prefix = '' }: { value: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          const duration = 2000;
          const steps = 60;
          const increment = value / steps;
          let current = 0;

          const timer = setInterval(() => {
            current += increment;
            if (current >= value) {
              setCount(value);
              clearInterval(timer);
            } else {
              setCount(Math.floor(current));
            }
          }, duration / steps);
        }
      },
      { threshold: 0.5 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [value, hasAnimated]);

  return <span ref={ref}>{prefix}{count.toLocaleString()}{suffix}</span>;
}

// One outline → many outputs — a hub-and-spoke visual. A central "One Outline"
// node fans out to the finished formats IdeaM actually ships. Desktop uses a
// 3×3 grid ring with an SVG spoke layer whose endpoints land on fixed cell
// centres (percentages of equal thirds, so they stay aligned at any width);
// mobile stacks the hub above a 2-column card grid. Outputs listed here are all
// shipped features — do not add anything speculative.
function OneOutlineManyOutputs() {
  const outputs = [
    { icon: Video, label: 'Video' },
    { icon: Podcast, label: 'Podcast' },
    { icon: Globe, label: 'Website' },
    { icon: FileText, label: 'Docs & PDF' },
    { icon: Presentation, label: 'Presentation' },
    { icon: Network, label: 'Mind Map' },
    { icon: BookOpen, label: 'Book / ePub' },
    { icon: Languages, label: 'Translations' },
  ];

  // Cell centres for the 8 surrounding cells of a 3×3 grid (equal thirds),
  // expressed as percentages so the SVG spokes always meet the card centres.
  const cellCenters = [
    { x: 16.67, y: 16.67 }, { x: 50, y: 16.67 }, { x: 83.33, y: 16.67 },
    { x: 16.67, y: 50 }, /* hub */ { x: 83.33, y: 50 },
    { x: 16.67, y: 83.33 }, { x: 50, y: 83.33 }, { x: 83.33, y: 83.33 },
  ];

  const OutputCard = ({ icon: Icon, label }: { icon: React.ElementType; label: string }) => (
    <div className="flex items-center justify-center gap-2 rounded-xl bg-[#f7faff] border border-[#dde5f2] px-3 py-2.5 text-center hover:bg-[#f1f5f9] hover:border-blue-600/30 transition-colors">
      <Icon className="w-4 h-4 text-blue-600 flex-shrink-0" />
      <span className="text-sm font-medium text-[#0b1533] leading-tight">{label}</span>
    </div>
  );

  const Hub = () => (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-blue-700/40 to-blue-700/30 border-2 border-blue-600/50 px-4 py-4 shadow-lg shadow-blue-600/30">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-600/40">
        <FolderTree className="w-5 h-5 text-white" />
      </div>
      <span className="text-sm font-bold text-[#0b1533] leading-tight text-center">One Outline</span>
    </div>
  );

  return (
    <section className="px-6 pb-16 lg:px-12">
      <div className="max-w-5xl mx-auto">
        <div className="rounded-3xl border border-blue-600/20 bg-gradient-to-br from-blue-600/10 via-blue-600/5 to-blue-600/10 p-8 md:p-12">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600/20 border border-blue-600/30 mb-6">
              <Rocket className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-600">One outline → many outputs</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-[#0b1533] mb-4">
              Develop it once. Publish it in every format.
            </h2>
            <p className="text-lg md:text-xl text-[#2b3a5c] font-medium leading-relaxed max-w-2xl mx-auto">
              One developed outline becomes many finished formats — no rebuilding from scratch for each one.
            </p>
          </div>

          {/* Desktop — 3×3 ring with SVG spokes */}
          <div className="hidden md:block relative w-full max-w-3xl mx-auto aspect-[16/10]">
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="spoke" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="rgb(255 176 32)" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="rgb(245 129 31)" stopOpacity="0.15" />
                </linearGradient>
              </defs>
              {cellCenters.map((c, i) => (
                <line
                  key={i}
                  x1="50"
                  y1="50"
                  x2={c.x}
                  y2={c.y}
                  stroke="url(#spoke)"
                  strokeWidth="0.4"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
            <div className="relative grid grid-cols-3 grid-rows-3 h-full gap-3">
              <div className="flex items-center justify-center"><OutputCard {...outputs[0]} /></div>
              <div className="flex items-center justify-center"><OutputCard {...outputs[1]} /></div>
              <div className="flex items-center justify-center"><OutputCard {...outputs[2]} /></div>
              <div className="flex items-center justify-center"><OutputCard {...outputs[3]} /></div>
              <div className="flex items-center justify-center"><Hub /></div>
              <div className="flex items-center justify-center"><OutputCard {...outputs[4]} /></div>
              <div className="flex items-center justify-center"><OutputCard {...outputs[5]} /></div>
              <div className="flex items-center justify-center"><OutputCard {...outputs[6]} /></div>
              <div className="flex items-center justify-center"><OutputCard {...outputs[7]} /></div>
            </div>
          </div>

          {/* Mobile — hub above a 2-column output grid */}
          <div className="md:hidden">
            <div className="flex justify-center mb-5">
              <Hub />
            </div>
            <div className="flex justify-center mb-5 text-blue-600/50">
              <ChevronDown className="w-6 h-6" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {outputs.map((o) => (
                <OutputCard key={o.label} {...o} />
              ))}
            </div>
          </div>

          <p className="text-center text-base text-[#2b3a5c] mt-10 max-w-2xl mx-auto">
            Plus Docs &amp; PDF are part of 23 export formats, and any output can ship in 21 languages.
          </p>
        </div>
      </div>
    </section>
  );
}


export default function FeaturesPage() {
  return (
    <div className="fixed inset-0 bg-white text-[#0b1533] overflow-x-hidden overflow-y-auto">
      {/* Carbon re-skin: flat, crisp white ground — no hazy blue radial wash,
          matching the homepage's engineered IBM look. */}
      <div className="fixed inset-0 bg-white" />
      <div className="relative z-10">
        <MarketingHeader />
        <main className="pt-28 lg:pt-32">
          <div className="px-6 lg:px-12 max-w-7xl mx-auto">
            <Link href="/" className="inline-flex items-center gap-1.5 rounded-full border border-blue-600/30 px-4 py-1.5 text-sm text-blue-600 hover:bg-blue-600/10 hover:border-blue-600/50 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to home
            </Link>
          </div>
          <div className="text-center px-6 pt-8 pb-6 lg:px-12">
            <div className="text-sm font-mono font-semibold text-[#1e40af] uppercase tracking-wider mb-2">What IdeaM does</div>
            <h1 className="text-4xl md:text-5xl font-bold text-[#0b1533]">Features</h1>
          </div>
        <OneOutlineManyOutputs />
        {/* Idea Incubator — lead concept section that frames the whole product */}
        <section className="px-6 pb-16 lg:px-12">
          <div className="max-w-5xl mx-auto">
            <div className="rounded-3xl border border-blue-600/20 bg-gradient-to-br from-blue-600/10 via-blue-600/5 to-blue-600/10 p-8 md:p-12">
              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600/20 border border-blue-600/30 mb-6">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-600">The Idea Incubator</span>
                </div>
                <h2 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">
                  <span className="bg-gradient-to-r from-[#0b1533] via-[#0b1533] to-[#0b1533] bg-clip-text text-transparent">
                    An Idea Incubator is where raw thoughts grow into finished work.
                  </span>
                </h2>
                <p className="text-lg md:text-xl text-[#2b3a5c] font-medium leading-relaxed max-w-3xl mx-auto">
                  Most tools store your notes. An Idea Incubator does something different — it takes the scattered raw material of your thinking (half-formed thoughts, saved videos, PDFs, web pages, meeting scraps) and actively grows them into structured, usable ideas.
                </p>
              </div>

              {/* Four stages */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
                {[
                  {
                    icon: Import,
                    label: 'Capture',
                    description: 'Drop in anything, no matter how rough. A 2am thought, a YouTube video, a dense PDF, a voice memo.',
                    gradient: 'bg-gradient-to-br from-blue-600 to-blue-600',
                  },
                  {
                    icon: FolderTree,
                    label: 'Structure',
                    description: 'Watch chaos become an outline you can shape, expand, and rearrange.',
                    gradient: 'bg-gradient-to-br from-blue-600 to-blue-600',
                  },
                  {
                    icon: Globe,
                    label: 'Enrich',
                    description: 'Refresh any part against the live web so your thinking never goes stale — then query your evolving knowledge base and get answers from everything you\'ve captured.',
                    gradient: 'bg-gradient-to-br from-blue-600 to-blue-600',
                  },
                  {
                    icon: Rocket,
                    label: 'Hatch',
                    description: 'When an idea is ready, generate the finished thing: a document, a script, a podcast, a content package.',
                    gradient: 'bg-gradient-to-br from-blue-600 to-blue-600',
                  },
                ].map((stage, i) => {
                  const StageIcon = stage.icon;
                  return (
                    <div
                      key={stage.label}
                      className="relative p-6 rounded-2xl bg-[#f7faff] backdrop-blur-sm border border-[#dde5f2] hover:bg-[#f1f5f9] hover:border-[#dde5f2] transition-all duration-300"
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-11 h-11 rounded-xl ${stage.gradient} flex items-center justify-center flex-shrink-0`}>
                          <StageIcon className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-xs font-semibold text-[#64748b]">{`0${i + 1}`}</span>
                      </div>
                      <h3 className="text-lg font-bold text-[#0b1533] mb-2">{stage.label}</h3>
                      <p className="text-base text-[#2b3a5c] leading-relaxed">{stage.description}</p>
                    </div>
                  );
                })}
              </div>

              {/* Closing emphasized line */}
              <p className="text-center text-lg md:text-2xl font-semibold text-[#0b1533] mt-10 max-w-3xl mx-auto leading-snug">
                That&apos;s the difference between a filing cabinet and an incubator.{' '}
                <span className="bg-gradient-to-r from-blue-600 to-blue-600 bg-clip-text text-transparent">
                  One stores your ideas. The other helps them grow up.
                </span>
              </p>
            </div>
          </div>
        </section>

        {/* Written AND multimedia — dual-output positioning */}
        <section className="px-6 pb-16 lg:px-12">
          <div className="max-w-4xl mx-auto">
            <div className="rounded-2xl border border-blue-600/20 bg-gradient-to-br from-blue-600/5 via-blue-600/5 to-blue-600/5 p-8 md:p-10">
              <h2 className="text-2xl md:text-3xl font-bold text-[#0b1533] mb-3">
                Written work and multimedia, from one outline.
              </h2>
              <p className="text-lg md:text-xl text-[#2b3a5c] font-medium leading-relaxed mb-4">
                IdeaM is the idea developer for both written content and multimedia. Snap a whiteboard photo and watch it become a structured outline. Pick a branch and IdeaM produces a complete YouTube content package — script, chapters, description, SEO, B-roll prompts. Multimedia in, multimedia out.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full bg-[#f7faff] border border-[#dde5f2] text-[#475569] text-xs">Books &amp; long-form</span>
                <span className="px-3 py-1 rounded-full bg-[#f7faff] border border-[#dde5f2] text-[#475569] text-xs">Articles &amp; reports</span>
                <span className="px-3 py-1 rounded-full bg-[#f7faff] border border-[#dde5f2] text-[#475569] text-xs">YouTube packages</span>
                <span className="px-3 py-1 rounded-full bg-[#f7faff] border border-[#dde5f2] text-[#475569] text-xs">Podcasts</span>
                <span className="px-3 py-1 rounded-full bg-[#f7faff] border border-[#dde5f2] text-[#475569] text-xs">Diagrams &amp; mind maps</span>
                <span className="px-3 py-1 rounded-full bg-[#f7faff] border border-[#dde5f2] text-[#475569] text-xs">Whiteboard capture</span>
              </div>
            </div>
          </div>
        </section>

        {/* COGNITIVE ENHANCEMENT - Intelligence Amplifier Section */}
        <section className="px-6 py-20 lg:px-12 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-600/5 via-transparent to-transparent" />
          <div className="max-w-7xl mx-auto relative">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600/20 border border-blue-600/30 mb-6">
                <Brain className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-600">Cognitive Enhancement Platform</span>
              </div>
              <h2 className="text-4xl lg:text-6xl font-bold mb-6">
                <span className="bg-gradient-to-r from-[#0b1533] to-[#0b1533] bg-clip-text text-transparent">
                  Your Second Brain,
                </span>
                <br />
                <span className="bg-gradient-to-r from-blue-500 via-blue-600 to-blue-600 bg-clip-text text-transparent">
                  Amplified
                </span>
              </h2>
              <p className="text-xl text-[#475569] max-w-3xl mx-auto leading-relaxed">
                IdeaM is a true intelligence amplifier—it doesn&apos;t just store information, it enhances
                your cognitive capabilities. Build a knowledge repository that grows with you, surfaces hidden
                connections, and accelerates your thinking.
              </p>
            </div>

            {/* Three pillars of intelligence amplification */}
            <div className="grid md:grid-cols-3 gap-8">
              {/* Expanded Scope */}
              <div className="relative group">
                <div className="relative p-8 rounded-2xl bg-[#f7faff] border border-[#dde5f2] hover:border-blue-600/40 transition-all duration-300 h-full">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center mb-6 shadow-lg shadow-blue-600/30">
                    <Globe className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-[#0b1533] mb-4">Expanded Knowledge Scope</h3>
                  <p className="text-lg text-[#2b3a5c] leading-relaxed mb-4">
                    Your brain can only hold so much. IdeaM becomes your external memory—capturing every source,
                    every insight, every connection you&apos;ve ever encountered. Access decades of accumulated
                    knowledge instantly.
                  </p>
                  <div className="flex items-center gap-2 text-blue-600 text-sm font-medium">
                    <span className="px-3 py-1 rounded-full bg-blue-600/20 border border-blue-600/30">
                      1,000,000+ nodes tested*
                    </span>
                  </div>
                </div>
              </div>

              {/* Speed of Access */}
              <div className="relative group">
                <div className="relative p-8 rounded-2xl bg-[#f7faff] border border-[#dde5f2] hover:border-blue-600/40 transition-all duration-300 h-full">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center mb-6 shadow-lg shadow-blue-600/30">
                    <Zap className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-[#0b1533] mb-4">Accelerated Access</h3>
                  <p className="text-lg text-[#2b3a5c] leading-relaxed mb-4">
                    Find what you need in seconds, not hours. Hierarchical outlines, AI-powered search, and smart
                    organization means your knowledge is always at your fingertips—ready when you need it.
                  </p>
                  <div className="flex items-center gap-2 text-blue-600 text-sm font-medium">
                    <span className="px-3 py-1 rounded-full bg-blue-600/20 border border-blue-600/30">
                      Instant retrieval
                    </span>
                  </div>
                </div>
              </div>

              {/* Pattern Recognition */}
              <div className="relative group">
                <div className="relative p-8 rounded-2xl bg-[#f7faff] border border-[#dde5f2] hover:border-blue-600/40 transition-all duration-300 h-full">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center mb-6 shadow-lg shadow-blue-600/30">
                    <Network className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-[#0b1533] mb-4">Hidden Connections</h3>
                  <p className="text-lg text-[#2b3a5c] leading-relaxed mb-4">
                    See what others miss. The hierarchical structure reveals complex interrelationships between ideas,
                    surfaces creative possibilities, and helps you synthesize insights that would otherwise remain hidden.
                  </p>
                  <div className="flex items-center gap-2 text-blue-600 text-sm font-medium">
                    <span className="px-3 py-1 rounded-full bg-blue-600/20 border border-blue-600/30">
                      Pattern recognition
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Cognitive Enhancement Quote */}
            <div className="mt-16 p-8 lg:p-12 rounded-3xl bg-[#f7faff] border border-[#dde5f2] text-center">
              <Quote className="w-12 h-12 text-blue-600/50 mx-auto mb-6" />
              <blockquote className="text-2xl lg:text-3xl font-light text-[#0b1533] italic max-w-4xl mx-auto leading-relaxed">
                &ldquo;The difference between experts and novices isn&apos;t just what they know—it&apos;s how quickly
                they can access and connect that knowledge. IdeaM gives everyone an expert&apos;s cognitive edge.&rdquo;
              </blockquote>
              <div className="mt-6 text-[#64748b]">
                — The Cognitive Enhancement Philosophy
              </div>
            </div>
          </div>
        </section>

        {/* WORKFLOWS - The Incredible Things You Can Do */}
        <section className="px-6 py-16 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-blue-600 font-medium mb-2">Professional Research Workflows</p>
              <h2 className="text-3xl lg:text-5xl font-bold">
                <span className="bg-gradient-to-r from-[#0b1533] to-[#0b1533] bg-clip-text text-transparent">
                  From meeting room
                </span>
                <br className="hidden sm:block" />
                <span className="bg-gradient-to-r from-blue-600 to-blue-600 bg-clip-text text-transparent">
                  {' '}to published paper
                </span>
              </h2>
              <p className="text-lg md:text-xl text-[#2b3a5c] font-medium max-w-2xl mx-auto mt-4">
                Every step of the professional research workflow, powered by AI.
              </p>
            </div>

            {/* Workflow Cards - Large, Visual */}
            <div className="space-y-6">
              {/* Hero row - the flagship synthesis workflow + two signature captures */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Research Synthesis - Hero Workflow */}
                <div className="md:col-span-2 group relative overflow-hidden rounded-2xl bg-[#f7faff] border border-blue-600/30 p-8 lg:p-12 hover:border-blue-600/50 transition-all duration-500">
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-600/30">
                        <Merge className="w-7 h-7 text-white" />
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-600/20 text-blue-600 border border-blue-600/30">
                        Core Capability
                      </span>
                    </div>
                    <h3 className="text-2xl lg:text-3xl font-bold text-[#0b1533] mb-3">
                      Literature Review in Hours, Not Months
                    </h3>
                    <p className="text-[#2b3a5c] text-xl mb-6 max-w-2xl">
                      Import research papers, conference recordings, technical reports, and field notes simultaneously.
                      AI synthesizes everything into a coherent outline organized by themes and findings—the way research should be organized.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <span className="px-3 py-1.5 rounded-lg bg-[#f7faff] text-[#475569] text-sm flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Research Papers
                      </span>
                      <span className="px-3 py-1.5 rounded-lg bg-[#f7faff] text-[#475569] text-sm flex items-center gap-2">
                        <Volume2 className="w-4 h-4" /> Conference Recordings
                      </span>
                      <span className="px-3 py-1.5 rounded-lg bg-[#f7faff] text-[#475569] text-sm flex items-center gap-2">
                        <Youtube className="w-4 h-4" /> Video Lectures
                      </span>
                      <span className="px-3 py-1.5 rounded-lg bg-[#f7faff] text-[#475569] text-sm flex items-center gap-2">
                        <Globe className="w-4 h-4" /> Technical Reports
                      </span>
                      <span className="px-3 py-1.5 rounded-lg bg-[#f7faff] text-[#475569] text-sm flex items-center gap-2">
                        <FileUp className="w-4 h-4" /> Field Notes
                      </span>
                    </div>
                  </div>
                </div>

                {/* Meeting Transcription */}
                <div className="group relative overflow-hidden rounded-2xl bg-[#f7faff] border border-[#dde5f2] p-8 hover:border-blue-600/40 transition-all duration-500">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-600/30 mb-4">
                      <Headphones className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl lg:text-2xl font-bold text-[#0b1533] mb-2">
                      Capture Physical Meetings &amp; Interviews
                    </h3>
                    <p className="text-lg text-[#2b3a5c] mb-4">
                      Record in-person meetings, focus groups, or field interviews. Upload the audio and get automatic transcription with speaker diarization—know exactly who said what.
                    </p>
                    <div className="text-blue-600 text-sm font-medium">
                      Auto speaker identification →
                    </div>
                  </div>
                </div>

                {/* Generate Podcasts */}
                <div className="group relative overflow-hidden rounded-2xl bg-[#f7faff] border border-[#dde5f2] p-8 hover:border-blue-600/40 transition-all duration-500">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-600/30 mb-4">
                      <Podcast className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl lg:text-2xl font-bold text-[#0b1533] mb-2">
                      Turn Any Outline Into a Podcast
                    </h3>
                    <p className="text-lg text-[#2b3a5c] mb-4">
                      Select any branch and generate a professional podcast. Choose voices, style, and length.
                    </p>
                    <div className="text-blue-600 text-sm font-medium">
                      Multiple voices &amp; styles →
                    </div>
                  </div>
                </div>
              </div>

              {/* Signature outputs - three more one-click workflows */}
              <div className="grid md:grid-cols-3 gap-6">
                {/* Auto Mind Maps */}
                <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600/10 to-blue-600/10 border border-blue-600/20 p-8 hover:border-blue-600/40 transition-all duration-500">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-600/30 mb-4">
                    <Network className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-[#0b1533] mb-2">
                    Auto-Generate Mind Maps &amp; Flowcharts
                  </h3>
                  <p className="text-base text-[#2b3a5c] mb-4">
                    Select any branch and instantly turn its structure into a mind map, flowchart, or org chart—export it or embed it right in your outline.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 rounded-lg bg-[#f7faff] text-[#475569] text-xs">Mind Maps</span>
                    <span className="px-3 py-1 rounded-lg bg-[#f7faff] text-[#475569] text-xs">Flowcharts</span>
                    <span className="px-3 py-1 rounded-lg bg-[#f7faff] text-[#475569] text-xs">Org Charts</span>
                  </div>
                </div>

                {/* Ask your knowledge base (formerly Knowledge Chat) */}
                <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600/10 to-blue-600/10 border border-blue-600/20 p-8 hover:border-blue-600/40 transition-all duration-500">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-600/30 mb-4">
                    <MessagesSquare className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-[#0b1533] mb-2">
                    Ask Your Knowledge Base
                  </h3>
                  <p className="text-base text-[#2b3a5c] mb-4">
                    Ask questions about one outline or across everything you’ve captured—answers come from your own sources, not a generic web guess.
                  </p>
                  <div className="text-blue-600 text-sm font-medium">
                    Single or multi-outline →
                  </div>
                </div>

                {/* From outline to YouTube - shipped multimedia workflow */}
                <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600/10 via-blue-600/5 to-blue-600/10 border border-blue-600/20 p-8 hover:border-blue-600/40 transition-all duration-500">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-600/30 mb-4">
                    <Youtube className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h3 className="text-xl font-bold text-[#0b1533]">
                      From Outline to Video Package
                    </h3>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 bg-blue-600/10 border border-blue-600/20 rounded px-2 py-0.5">
                      Shipped
                    </span>
                  </div>
                  <p className="text-base text-[#2b3a5c] mb-4">
                    Pick any branch and generate a complete YouTube package—voiceover script, chapter markers, title variants, SEO tags, thumbnail concept, and B-roll prompts.
                  </p>
                  <div className="text-blue-600 text-sm font-medium">
                    Outline first, produce second →
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* See it in action — real product screenshots */}
        <section className="px-6 py-20 lg:px-12">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600/20 border border-blue-600/30 mb-6">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-600">See it in action</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-[#0b1533] mb-4">
                Real screenshots, real product.
              </h2>
              <p className="text-lg md:text-xl text-[#2b3a5c] font-medium leading-relaxed max-w-2xl mx-auto">
                No mockups. This is IdeaM today — from the writing workspace to the finished outputs it produces.
              </p>
            </div>

            {/* Light & Dark — the product is beautiful either way */}
            <div className="mb-12">
              <p className="text-center text-base text-[#64748b] mb-5">
                Made for light lovers and dark lovers alike — the same workspace, your way.
              </p>
              <div className="grid sm:grid-cols-2 gap-6 lg:gap-8">
                {/* Light — styled placeholder until the real light-mode capture is dropped in */}
                <figure className="rounded-2xl border border-[#dde5f2] bg-white overflow-hidden shadow-[0_1px_3px_rgba(12,34,36,0.06),0_8px_24px_rgba(12,34,36,0.06)]">
                  <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-[#dde5f2] bg-[#f7faff]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#dde5f2]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#dde5f2]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#dde5f2]" />
                    <span className="ml-auto text-[11px] font-semibold uppercase tracking-wider text-blue-600">Light</span>
                  </div>
                  <div className="aspect-[16/10] flex flex-col items-center justify-center gap-3 bg-[#f7faff] text-center px-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#2563eb] to-[#1e40af] flex items-center justify-center">
                      <Monitor className="w-6 h-6 text-white" />
                    </div>
                    <p className="text-sm font-medium text-[#475569]">Light-mode capture coming here</p>
                    <p className="text-xs text-[#64748b] max-w-[240px]">The same workspace in a light theme — a real screenshot drops into this frame.</p>
                  </div>
                </figure>
                {/* Dark — real product capture */}
                <figure className="rounded-2xl border border-[#dde5f2] bg-white overflow-hidden shadow-[0_1px_3px_rgba(12,34,36,0.06),0_8px_24px_rgba(12,34,36,0.06)]">
                  <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-[#dde5f2] bg-[#f7faff]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#dde5f2]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#dde5f2]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#dde5f2]" />
                    <span className="ml-auto text-[11px] font-semibold uppercase tracking-wider text-blue-600">Dark</span>
                  </div>
                  <img
                    src="/screenshots/outline-editor.png"
                    alt="IdeaM workspace in dark mode"
                    loading="lazy"
                    className="w-full h-auto block"
                  />
                </figure>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
              {[
                {
                  src: '/screenshots/outline-editor.png',
                  label: 'Workspace',
                  title: 'The two-pane workspace',
                  desc: 'Your outline structure on the left, a rich content editor on the right.',
                },
                {
                  src: '/screenshots/mind-map.png',
                  label: 'Visualize',
                  title: 'Auto-generated mind maps',
                  desc: 'Turn any branch into a mind map, flowchart, or org chart in one click.',
                },
                {
                  src: '/screenshots/outputs.png',
                  label: 'Publish',
                  title: 'One outline, many outputs',
                  desc: 'Video, podcast, website, docs and more — all from the same outline.',
                },
                {
                  src: '/screenshots/feature.png',
                  label: 'Command',
                  title: 'Everything from one shortcut',
                  desc: 'Open the command palette to run any action or ask a question — no menu hunting.',
                },
              ].map((shot) => (
                <figure
                  key={shot.src}
                  className="group rounded-2xl border border-[#dde5f2] bg-[#f7faff] overflow-hidden hover:border-blue-600/30 transition-colors"
                >
                  <div className="bg-white/60 border-b border-[#dde5f2]">
                    <img
                      src={shot.src}
                      alt={shot.title}
                      loading="lazy"
                      className="w-full h-auto block"
                    />
                  </div>
                  <figcaption className="p-5 md:p-6">
                    <div className="text-xs text-blue-600 font-medium uppercase tracking-wider mb-1">{shot.label}</div>
                    <h3 className="text-lg font-semibold text-[#0b1533] mb-1">{shot.title}</h3>
                    <p className="text-base text-[#2b3a5c] leading-relaxed">{shot.desc}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* Social Proof Bar */}
        <section className="px-6 py-10 lg:px-12 border-y border-[#dde5f2] bg-[#f7faff]">
          <div className="max-w-7xl mx-auto">
            <p className="text-center text-[#64748b] text-sm mb-6">Built for professional researchers at leading institutions</p>
            <div className="flex flex-wrap justify-center items-center gap-6 lg:gap-12">
              <div className="text-center">
                <div className="text-2xl font-bold text-[#475569]">Universities</div>
                <div className="text-xs text-[#64748b]">PhD & Postdoc</div>
              </div>
              <div className="w-px h-8 bg-[#f7faff] hidden sm:block" />
              <div className="text-center">
                <div className="text-2xl font-bold text-[#475569]">Research Labs</div>
                <div className="text-xs text-[#64748b]">Academic & Industrial</div>
              </div>
              <div className="w-px h-8 bg-[#f7faff] hidden sm:block" />
              <div className="text-center">
                <div className="text-2xl font-bold text-[#475569]">Consulting</div>
                <div className="text-xs text-[#64748b]">McKinsey, BCG, Bain</div>
              </div>
              <div className="w-px h-8 bg-[#f7faff] hidden sm:block" />
              <div className="text-center">
                <div className="text-2xl font-bold text-[#475569]">Legal</div>
                <div className="text-xs text-[#64748b]">Law Firms & Counsel</div>
              </div>
            </div>
          </div>
        </section>

        {/* Why SecondBrainWare - Competitive Positioning */}
        <section id="features" className="px-6 py-24 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-blue-600 font-medium mb-2">Why Professionals Choose IdeaM</p>
              <h2 className="text-3xl lg:text-5xl font-bold mb-4">
                Built for{' '}
                <span className="bg-gradient-to-r from-blue-600 to-blue-600 bg-clip-text text-transparent">
                  research-grade work
                </span>
              </h2>
              <p className="text-lg md:text-xl text-[#2b3a5c] font-medium max-w-2xl mx-auto">
                Consumer note-taking apps weren't designed for professional research. IdeaM was built from the ground up for serious knowledge synthesis.
              </p>
            </div>

            {/* Comparison Grid */}
            <div className="grid lg:grid-cols-2 gap-8 mb-16">
              {/* What Others Do */}
              <div className="p-8 rounded-3xl bg-[#f7faff] border border-[#dde5f2]">
                <h3 className="text-lg font-semibold text-[#64748b] mb-6 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#f7faff] flex items-center justify-center text-xs">✗</span>
                  What other tools do
                </h3>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3 text-[#64748b] text-base">
                    <span className="w-5 h-5 rounded bg-[#f7faff] flex items-center justify-center text-xs flex-shrink-0 mt-0.5">•</span>
                    <span>Take notes and organize them manually</span>
                  </li>
                  <li className="flex items-start gap-3 text-[#64748b] text-base">
                    <span className="w-5 h-5 rounded bg-[#f7faff] flex items-center justify-center text-xs flex-shrink-0 mt-0.5">•</span>
                    <span>Import one file at a time, if at all</span>
                  </li>
                  <li className="flex items-start gap-3 text-[#64748b] text-base">
                    <span className="w-5 h-5 rounded bg-[#f7faff] flex items-center justify-center text-xs flex-shrink-0 mt-0.5">•</span>
                    <span>AI as an afterthought—generic chat bolted on</span>
                  </li>
                  <li className="flex items-start gap-3 text-[#64748b] text-base">
                    <span className="w-5 h-5 rounded bg-[#f7faff] flex items-center justify-center text-xs flex-shrink-0 mt-0.5">•</span>
                    <span>Force you to choose: mobile OR desktop experience</span>
                  </li>
                  <li className="flex items-start gap-3 text-[#64748b] text-base">
                    <span className="w-5 h-5 rounded bg-[#f7faff] flex items-center justify-center text-xs flex-shrink-0 mt-0.5">•</span>
                    <span>Lock your data in proprietary formats</span>
                  </li>
                </ul>
              </div>

              {/* What SecondBrainWare Does */}
              <div className="p-8 rounded-3xl bg-gradient-to-br from-blue-600/10 to-blue-600/10 border border-blue-600/30">
                <h3 className="text-lg font-semibold text-[#0b1533] mb-6 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs">✓</span>
                  What IdeaM does differently
                </h3>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3 text-[#0b1533] text-base">
                    <Check className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span><strong className="text-[#0b1533]">Multi-source synthesis</strong>—import 50+ sources and let AI organize by theme</span>
                  </li>
                  <li className="flex items-start gap-3 text-[#0b1533] text-base">
                    <Check className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span><strong className="text-[#0b1533]">10+ source types</strong>—YouTube, PDFs, audio with transcription, web pages, docs</span>
                  </li>
                  <li className="flex items-start gap-3 text-[#0b1533] text-base">
                    <Check className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span><strong className="text-[#0b1533]">AI-native from day one</strong>—content generation, synthesis, diagrams, podcasts</span>
                  </li>
                  <li className="flex items-start gap-3 text-[#0b1533] text-base">
                    <Check className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span><strong className="text-[#0b1533]">True cross-platform</strong>—identical experience on Mac, iPhone, iPad, and web</span>
                  </li>
                  <li className="flex items-start gap-3 text-[#0b1533] text-base">
                    <Check className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span><strong className="text-[#0b1533]">Your data, your way</strong>—23 export formats, local-first storage, no lock-in</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Feature Comparison Table */}
            <div className="mt-12 overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[#dde5f2]">
                    <th className="text-left py-4 px-4 text-[#0b1533] font-semibold">Feature</th>
                    <th className="text-center py-4 px-4">
                      <span className="text-blue-600 font-bold">IdeaM</span>
                    </th>
                    <th className="text-center py-4 px-4 text-[#64748b]">Notion</th>
                    <th className="text-center py-4 px-4 text-[#64748b]">Obsidian</th>
                    <th className="text-center py-4 px-4 text-[#64748b]">Roam</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  <tr className="border-b border-[#dde5f2]">
                    <td className="py-3 px-4 text-[#475569]">Multi-source AI synthesis (50+ sources)</td>
                    <td className="py-3 px-4 text-center"><Check className="w-5 h-5 text-blue-600 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-[#cbd5e1] mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-[#cbd5e1] mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-[#cbd5e1] mx-auto" /></td>
                  </tr>
                  <tr className="border-b border-[#dde5f2]">
                    <td className="py-3 px-4 text-[#475569]">Speaker diarization (who said what)</td>
                    <td className="py-3 px-4 text-center"><Check className="w-5 h-5 text-blue-600 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-[#cbd5e1] mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-[#cbd5e1] mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-[#cbd5e1] mx-auto" /></td>
                  </tr>
                  <tr className="border-b border-[#dde5f2]">
                    <td className="py-3 px-4 text-[#475569]">PDF & document import with analysis</td>
                    <td className="py-3 px-4 text-center"><Check className="w-5 h-5 text-blue-600 mx-auto" /></td>
                    <td className="py-3 px-4 text-center text-[#94a3b8]">Limited</td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-[#cbd5e1] mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-[#cbd5e1] mx-auto" /></td>
                  </tr>
                  <tr className="border-b border-[#dde5f2]">
                    <td className="py-3 px-4 text-[#475569]">YouTube transcript import</td>
                    <td className="py-3 px-4 text-center"><Check className="w-5 h-5 text-blue-600 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-[#cbd5e1] mx-auto" /></td>
                    <td className="py-3 px-4 text-center text-[#94a3b8]">Plugin</td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-[#cbd5e1] mx-auto" /></td>
                  </tr>
                  <tr className="border-b border-[#dde5f2]">
                    <td className="py-3 px-4 text-[#475569]">AI content generation</td>
                    <td className="py-3 px-4 text-center"><Check className="w-5 h-5 text-blue-600 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><Check className="w-5 h-5 text-[#64748b] mx-auto" /></td>
                    <td className="py-3 px-4 text-center text-[#94a3b8]">Plugin</td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-[#cbd5e1] mx-auto" /></td>
                  </tr>
                  <tr className="border-b border-[#dde5f2]">
                    <td className="py-3 px-4 text-[#475569]">Podcast generation</td>
                    <td className="py-3 px-4 text-center"><Check className="w-5 h-5 text-blue-600 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-[#cbd5e1] mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-[#cbd5e1] mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-[#cbd5e1] mx-auto" /></td>
                  </tr>
                  <tr className="border-b border-[#dde5f2]">
                    <td className="py-3 px-4 text-[#475569]">Local-first storage</td>
                    <td className="py-3 px-4 text-center"><Check className="w-5 h-5 text-blue-600 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-[#cbd5e1] mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><Check className="w-5 h-5 text-[#64748b] mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-[#cbd5e1] mx-auto" /></td>
                  </tr>
                  <tr className="border-b border-[#dde5f2]">
                    <td className="py-3 px-4 text-[#475569]">Native iOS app</td>
                    <td className="py-3 px-4 text-center"><Check className="w-5 h-5 text-blue-600 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><Check className="w-5 h-5 text-[#64748b] mx-auto" /></td>
                    <td className="py-3 px-4 text-center text-[#94a3b8]">Basic</td>
                    <td className="py-3 px-4 text-center text-[#94a3b8]">Basic</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-[#475569]">1,000,000+ node capacity*</td>
                    <td className="py-3 px-4 text-center"><Check className="w-5 h-5 text-blue-600 mx-auto" /></td>
                    <td className="py-3 px-4 text-center text-[#94a3b8]">Slows</td>
                    <td className="py-3 px-4 text-center"><Check className="w-5 h-5 text-[#64748b] mx-auto" /></td>
                    <td className="py-3 px-4 text-center text-[#94a3b8]">Slows</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Scale Callout */}
            <div className="mt-16 p-8 lg:p-12 rounded-2xl bg-[#f7faff] border border-blue-600/20 text-center relative overflow-hidden">
              <div className="relative">
                <h3 className="text-4xl lg:text-6xl font-bold text-[#0b1533] mb-4">
                  <AnimatedNumber value={1000000} prefix="" suffix="+" />
                </h3>
                <p className="text-xl text-[#0b1533] mb-2">nodes in a single outline*</p>
                <p className="text-lg text-[#2b3a5c] max-w-xl mx-auto mb-6">
                  Stress-tested with over one million nodes. No artificial limits—scale until your hardware says stop.
                  Your biggest research projects, handled with ease.
                </p>
                <Button
                  onClick={() => window.location.href = '/stress-test'}
                  variant="outline"
                  className="border-blue-600/30 text-blue-600 hover:bg-blue-600/10 hover:border-blue-600/50"
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Test Your System
                </Button>
                <p className="text-[#94a3b8] text-xs mt-4">
                  *Tested on M4 MacBook Air with 512GB SSD. Performance varies by hardware and platform.
                </p>
              </div>
            </div>

            {/* Key Advantages */}
            <div className="mt-12 grid md:grid-cols-4 gap-6">
              <div className="text-center p-6 rounded-2xl bg-[#f7faff] border border-[#dde5f2]">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-600/25">
                  <Sparkles className="w-7 h-7 text-white" />
                </div>
                <h4 className="text-lg font-bold text-[#0b1533] mb-2">AI-First</h4>
                <p className="text-base text-[#2b3a5c]">
                  Every feature designed around AI from day one
                </p>
              </div>
              <div className="text-center p-6 rounded-2xl bg-[#f7faff] border border-[#dde5f2]">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-600/25">
                  <Shield className="w-7 h-7 text-white" />
                </div>
                <h4 className="text-lg font-bold text-[#0b1533] mb-2">Privacy-First</h4>
                <p className="text-base text-[#2b3a5c]">
                  Local storage by default. Cloud is optional.
                </p>
              </div>
              <div className="text-center p-6 rounded-2xl bg-[#f7faff] border border-[#dde5f2]">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-600/25">
                  <Zap className="w-7 h-7 text-white" />
                </div>
                <h4 className="text-lg font-bold text-[#0b1533] mb-2">Blazing Fast</h4>
                <p className="text-base text-[#2b3a5c]">
                  Instant response, even with massive outlines
                </p>
              </div>
              <div className="text-center p-6 rounded-2xl bg-[#f7faff] border border-[#dde5f2]">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-600/25">
                  <Layers className="w-7 h-7 text-white" />
                </div>
                <h4 className="text-lg font-bold text-[#0b1533] mb-2">19 Node Types</h4>
                <p className="text-base text-[#2b3a5c]">
                  Tasks, code, media, spreadsheets, and more
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Privacy & Data Security */}
        <section className="px-6 py-24 lg:px-12 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-900/10 to-transparent" />
          <div className="max-w-7xl mx-auto relative">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600/20 border border-blue-600/30 mb-6">
                  <Lock className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-blue-600">Your Data, Protected</span>
                </div>
                <h2 className="text-3xl lg:text-5xl font-bold mb-6">
                  <span className="bg-gradient-to-r from-[#0b1533] to-[#0b1533] bg-clip-text text-transparent">
                    Privacy is not
                  </span>
                  <br />
                  <span className="bg-gradient-to-r from-blue-600 to-blue-600 bg-clip-text text-transparent">
                    an afterthought
                  </span>
                </h2>
                <p className="text-lg md:text-xl text-[#2b3a5c] font-medium mb-8">
                  Unlike cloud-first apps that hold your data hostage, IdeaM is built local-first.
                  Your outlines live on your device. You're always in control.
                </p>

                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                      <Shield className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="text-[#0b1533] font-semibold mb-1">Local-First Storage</h4>
                      <p className="text-base text-[#2b3a5c]">Your data is stored on your device by default. No cloud required. No servers holding your thoughts.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                      <Lock className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="text-[#0b1533] font-semibold mb-1">Never Sold, Never Shared</h4>
                      <p className="text-base text-[#2b3a5c]">We will never sell your data. Period. Your content is yours alone.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                      <Brain className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="text-[#0b1533] font-semibold mb-1">No AI Training on Your Data</h4>
                      <p className="text-base text-[#2b3a5c]">When you use AI features, your content is processed but never used to train AI models. Contractually guaranteed.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                      <Download className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="text-[#0b1533] font-semibold mb-1">Export Anytime, Any Format</h4>
                      <p className="text-base text-[#2b3a5c]">23 export formats mean you're never locked in. Leave anytime with all your data.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="relative p-8 lg:p-12 rounded-2xl bg-[#f7faff] border border-blue-600/20">
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-600/30">
                      <Shield className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-[#0b1533] mb-4">Your Data Promise</h3>
                    <ul className="space-y-3 text-left">
                      <li className="flex items-center gap-3 text-[#0b1533]">
                        <Check className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        <span>Data stored locally on your device</span>
                      </li>
                      <li className="flex items-center gap-3 text-[#0b1533]">
                        <Check className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        <span>Optional encrypted cloud backup</span>
                      </li>
                      <li className="flex items-center gap-3 text-[#0b1533]">
                        <Check className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        <span>No data sold to third parties</span>
                      </li>
                      <li className="flex items-center gap-3 text-[#0b1533]">
                        <Check className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        <span>Content never used for AI training</span>
                      </li>
                      <li className="flex items-center gap-3 text-[#0b1533]">
                        <Check className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        <span>GDPR & CCPA compliant</span>
                      </li>
                      <li className="flex items-center gap-3 text-[#0b1533]">
                        <Check className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        <span>Full data export anytime</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Platform Section */}
        <section className="px-6 py-24 lg:px-12">
          <div className="max-w-6xl mx-auto text-center">
            <h2 className="text-3xl lg:text-5xl font-bold mb-6">
              Works everywhere you do
            </h2>
            <p className="text-lg md:text-xl text-[#2b3a5c] font-medium mb-6 max-w-2xl mx-auto">
              One subscription, all platforms. Your second brain syncs seamlessly across every device.
            </p>
            <p className="text-blue-600/80 text-sm mb-12 max-w-xl mx-auto">
              Apple prototypes available now. Windows, Linux, and Android coming at launch.
            </p>

            {/* Desktop Platforms */}
            <div className="mb-12">
              <h3 className="text-[#64748b] text-sm uppercase tracking-wider mb-6">Desktop</h3>
              <div className="flex flex-wrap justify-center items-center gap-6 lg:gap-10">
                <div className="text-center group">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600/20 to-blue-600/10 border border-blue-600/30 flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-all">
                    <Monitor className="w-10 h-10 text-blue-600" />
                  </div>
                  <div className="text-[#0b1533] font-medium">macOS</div>
                  <div className="text-blue-600 text-xs">Available Now</div>
                </div>
                <div className="text-center group">
                  <div className="w-20 h-20 rounded-2xl bg-[#f7faff] border border-[#dde5f2] flex items-center justify-center mx-auto mb-4 group-hover:bg-[#f1f5f9] transition-all">
                    <Laptop className="w-10 h-10 text-blue-600" />
                  </div>
                  <div className="text-[#0b1533] font-medium">Windows</div>
                  <div className="text-[#64748b] text-xs">Coming Soon</div>
                </div>
                <div className="text-center group">
                  <div className="w-20 h-20 rounded-2xl bg-[#f7faff] border border-[#dde5f2] flex items-center justify-center mx-auto mb-4 group-hover:bg-[#f1f5f9] transition-all">
                    <Code2 className="w-10 h-10 text-blue-600" />
                  </div>
                  <div className="text-[#0b1533] font-medium">Linux</div>
                  <div className="text-[#64748b] text-xs">Coming Soon</div>
                </div>
              </div>
            </div>

            {/* Mobile & Tablet Platforms */}
            <div className="mb-12">
              <h3 className="text-[#64748b] text-sm uppercase tracking-wider mb-6">Mobile & Tablet</h3>
              <div className="flex flex-wrap justify-center items-center gap-6 lg:gap-10">
                <div className="text-center group">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600/20 to-blue-600/10 border border-blue-600/30 flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-all">
                    <Smartphone className="w-10 h-10 text-blue-600" />
                  </div>
                  <div className="text-[#0b1533] font-medium">iOS</div>
                  <div className="text-blue-600 text-xs">Beta Available</div>
                </div>
                <div className="text-center group">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600/20 to-blue-600/10 border border-blue-600/30 flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-all">
                    <Presentation className="w-10 h-10 text-blue-600" />
                  </div>
                  <div className="text-[#0b1533] font-medium">iPad</div>
                  <div className="text-blue-600 text-xs">Beta Available</div>
                </div>
                <div className="text-center group">
                  <div className="w-20 h-20 rounded-2xl bg-[#f7faff] border border-[#dde5f2] flex items-center justify-center mx-auto mb-4 group-hover:bg-[#f1f5f9] transition-all">
                    <Smartphone className="w-10 h-10 text-blue-600" />
                  </div>
                  <div className="text-[#0b1533] font-medium">Android</div>
                  <div className="text-[#64748b] text-xs">Coming Soon</div>
                </div>
              </div>
            </div>

            {/* Web */}
            <div>
              <h3 className="text-[#64748b] text-sm uppercase tracking-wider mb-6">Web</h3>
              <div className="flex justify-center">
                <div className="text-center group">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600/20 to-blue-600/10 border border-blue-600/30 flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-all">
                    <Globe className="w-10 h-10 text-blue-600" />
                  </div>
                  <div className="text-[#0b1533] font-medium">Web App</div>
                  <div className="text-blue-600 text-xs">Available Now</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 py-20 lg:px-12">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Ready to think bigger?
            </h2>
            <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
              Start turning your ideas into structured, living outlines today. It's free to begin — no credit card required.
            </p>
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#38bdf8] via-[#2563eb] to-[#4f46e5] px-8 py-4 text-base font-semibold text-white shadow-lg shadow-blue-600/30 hover:shadow-xl hover:shadow-blue-600/40 hover:-translate-y-0.5 transition-all"
            >
              <Rocket className="w-5 h-5" /> Sign up free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <div className="mt-10">
              <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-900 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to home
              </Link>
            </div>
          </div>
        </section>
        </main>
      </div>
    </div>
  );
}
