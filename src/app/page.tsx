'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
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

// Countdown timer component
function CountdownTimer({ targetDate }: { targetDate: Date }) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const difference = targetDate.getTime() - now.getTime();

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60)
        });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  const TimeBlock = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center">
      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-[#f4faf9] backdrop-blur-sm border border-[#d3e6e4] flex items-center justify-center mb-2">
        <span className="text-2xl sm:text-3xl font-bold text-[#0c2224]">{value.toString().padStart(2, '0')}</span>
      </div>
      <span className="text-xs sm:text-sm text-[#6b7d7e] uppercase tracking-wider">{label}</span>
    </div>
  );

  return (
    <div className="flex gap-3 sm:gap-4">
      <TimeBlock value={timeLeft.days} label="Days" />
      <TimeBlock value={timeLeft.hours} label="Hours" />
      <TimeBlock value={timeLeft.minutes} label="Min" />
      <TimeBlock value={timeLeft.seconds} label="Sec" />
    </div>
  );
}

// Feature card component
function FeatureCard({
  icon: Icon,
  title,
  description,
  gradient,
  delay = 0
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  gradient: string;
  delay?: number;
}) {
  return (
    <div
      className="group relative p-6 rounded-2xl bg-[#f4faf9] backdrop-blur-sm border border-[#d3e6e4]
        hover:bg-[#eef6f5] hover:border-[#d3e6e4] transition-all duration-500 hover:scale-[1.02] hover:-tranteal-y-1"
    >
      <div className={`w-12 h-12 rounded-xl ${gradient} flex items-center justify-center mb-4
        group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="text-lg font-semibold text-[#0c2224] mb-2">{title}</h3>
      <p className="text-[#47585a] text-sm leading-relaxed">{description}</p>
    </div>
  );
}

// Pricing card component
function PricingCard({
  name,
  price,
  period,
  description,
  features,
  cta,
  highlighted = false,
  badge
}: {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
  badge?: string;
}) {
  const router = useRouter();

  return (
    <div className={`relative p-8 rounded-3xl border transition-all duration-300 hover:scale-[1.02]
      ${highlighted
        ? 'bg-gradient-to-b from-teal-600/20 to-teal-600/20 border-teal-600/40 shadow-xl shadow-teal-600/10'
        : 'bg-[#f4faf9] border-[#d3e6e4] hover:border-[#d3e6e4]'
      }`}
    >
      {badge && (
        <div className="absolute -top-3 left-1/2 -tranteal-x-1/2">
          <span className="px-4 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-[#0E7C7B] to-[#0E7C7B] text-white font-semibold">
            {badge}
          </span>
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-xl font-bold text-[#0c2224] mb-2">{name}</h3>
        <p className="text-[#6b7d7e] text-sm">{description}</p>
      </div>

      <div className="mb-6">
        <span className="text-4xl font-bold text-[#0c2224]">{price}</span>
        {period && <span className="text-[#6b7d7e] ml-1">{period}</span>}
      </div>

      <ul className="space-y-3 mb-8">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-3 text-sm">
            <Check className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
            <span className="text-[#47585a]">{feature}</span>
          </li>
        ))}
      </ul>

      <Button
        onClick={launchApp}
        className={`w-full ${highlighted
          ? 'bg-gradient-to-r from-[#0E7C7B] to-[#0E7C7B] hover:from-[#0c5c5b] hover:to-[#0c5c5b] text-white font-semibold shadow-lg'
          : 'bg-white hover:bg-teal-600/5 text-teal-600 border border-teal-600/40 font-medium'
        }`}
      >
        {cta}
      </Button>
    </div>
  );
}

// FAQ Item
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-[#d3e6e4] last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-5 flex items-center justify-between text-left"
      >
        <span className="text-[#0c2224] font-medium pr-8">{question}</span>
        <ChevronDown className={`w-5 h-5 text-[#6b7d7e] transition-transform duration-300 flex-shrink-0
          ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-96 pb-5' : 'max-h-0'}`}>
        <p className="text-[#47585a] text-sm leading-relaxed">{answer}</p>
      </div>
    </div>
  );
}

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
          className="absolute w-1 h-1 bg-teal-500/30 rounded-full animate-float"
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
    <section className="px-6 pb-16 lg:px-12 border-t border-[#d3e6e4] pt-16">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-[#0c2224] mb-4">
            A great idea isn&apos;t a single prompt.
          </h2>
          <p className="text-base md:text-lg text-[#47585a] leading-relaxed max-w-[660px] mx-auto">
            It might take a hundred sources — articles, PDFs, YouTube videos, meeting notes, textbooks, even what you type yourself — read, weighed, and merged into one outline before the essence comes into focus. Developing an idea is iterative: many passes, not one flash of insight. IdiamPro is built for that work.
          </p>
        </div>

        {/* Three-step flow */}
        <div className="flex flex-col lg:flex-row items-stretch justify-center gap-4 lg:gap-2">
          {/* Card 1 — Many inputs */}
          <div className="flex-1 rounded-2xl border border-[#d3e6e4] bg-[#f4faf9] p-6 md:p-8">
            <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-teal-600/15 border border-teal-600/25 mb-4">
              <FileUp className="w-5 h-5 text-teal-600" />
            </div>
            <h3 className="text-lg font-bold text-[#0c2224] mb-3">Many inputs</h3>
            <ul className="space-y-2 text-sm text-[#47585a]">
              <li>Type it in yourself</li>
              <li>Articles, web pages &amp; PDFs</li>
              <li>YouTube, audio &amp; video</li>
              <li>Notes, docs &amp; live web</li>
              <li className="text-[#6b7d7e]">…and growing</li>
            </ul>
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center lg:px-1 text-[#8b9a9b]">
            <ArrowRight className="hidden lg:block w-6 h-6" />
            <ChevronDown className="block lg:hidden w-6 h-6" />
          </div>

          {/* Card 2 — Merge & consolidate (emphasized) */}
          <div className="flex-1 rounded-2xl border-2 border-teal-600/40 bg-gradient-to-br from-teal-700/15 to-teal-700/10 p-6 md:p-8 shadow-lg shadow-teal-600/20">
            <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-teal-600/25 border border-teal-600/40 mb-4">
              <Merge className="w-5 h-5 text-teal-500" />
            </div>
            <h3 className="text-lg font-bold text-[#0c2224] mb-3">Merge &amp; consolidate</h3>
            <ul className="space-y-2 text-sm text-[#47585a]">
              <li>Merge sources into one outline</li>
              <li>Consolidate into a coherent whole</li>
              <li>Develop &amp; refine over many passes</li>
            </ul>
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center lg:px-1 text-[#8b9a9b]">
            <ArrowRight className="hidden lg:block w-6 h-6" />
            <ChevronDown className="block lg:hidden w-6 h-6" />
          </div>

          {/* Card 3 — Publish everywhere */}
          <div className="flex-1 rounded-2xl border border-[#d3e6e4] bg-[#f4faf9] p-6 md:p-8">
            <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-teal-600/15 border border-teal-600/25 mb-4">
              <Rocket className="w-5 h-5 text-teal-600" />
            </div>
            <h3 className="text-lg font-bold text-[#0c2224] mb-3">Publish everywhere</h3>
            <ul className="space-y-2 text-sm text-[#47585a]">
              <li>Papers &amp; articles</li>
              <li>Podcasts &amp; videos</li>
              <li>Slides &amp; illustrations</li>
              <li className="text-[#6b7d7e]">…and growing</li>
            </ul>
          </div>
        </div>

        <p className="text-center text-sm text-[#6b7d7e] mt-10 max-w-2xl mx-auto">
          Read widely, merge the sources into one outline, refine the essence — then publish it in any format. That&apos;s idea development, not a one-shot answer.
        </p>
      </div>
    </section>
  );
}

// One outline → many outputs — a hub-and-spoke visual. A central "One Outline"
// node fans out to the finished formats IdiamPro actually ships. Desktop uses a
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
    <div className="flex items-center justify-center gap-2 rounded-xl bg-[#f4faf9] border border-[#d3e6e4] px-3 py-2.5 text-center hover:bg-[#eef6f5] hover:border-teal-600/30 transition-colors">
      <Icon className="w-4 h-4 text-teal-600 flex-shrink-0" />
      <span className="text-sm font-medium text-[#0c2224] leading-tight">{label}</span>
    </div>
  );

  const Hub = () => (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-teal-700/40 to-teal-700/30 border-2 border-teal-600/50 px-4 py-4 shadow-lg shadow-teal-600/30">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center shadow-lg shadow-teal-600/40">
        <FolderTree className="w-5 h-5 text-white" />
      </div>
      <span className="text-sm font-bold text-[#0c2224] leading-tight text-center">One Outline</span>
    </div>
  );

  return (
    <section className="px-6 pb-16 lg:px-12">
      <div className="max-w-5xl mx-auto">
        <div className="rounded-3xl border border-teal-600/20 bg-gradient-to-br from-teal-600/10 via-teal-600/5 to-teal-600/10 p-8 md:p-12">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-600/20 border border-teal-600/30 mb-6">
              <Rocket className="w-4 h-4 text-teal-600" />
              <span className="text-sm font-medium text-teal-600">One outline → many outputs</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-[#0c2224] mb-4">
              Develop it once. Publish it in every format.
            </h2>
            <p className="text-base md:text-lg text-[#47585a] leading-relaxed max-w-2xl mx-auto">
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
            <div className="flex justify-center mb-5 text-teal-600/50">
              <ChevronDown className="w-6 h-6" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {outputs.map((o) => (
                <OutputCard key={o.label} {...o} />
              ))}
            </div>
          </div>

          <p className="text-center text-sm text-[#6b7d7e] mt-10 max-w-2xl mx-auto">
            Plus Docs &amp; PDF are part of 23 export formats, and any output can ship in 21 languages.
          </p>
        </div>
      </div>
    </section>
  );
}

// Who it's for — a compact persona selector. Instead of stacking all six
// use-case cards, the visitor picks the role that matches them (pill tabs)
// and sees that one deep panel: the outcome-focused description plus the
// concrete "how it works" steps. All the original copy is preserved — it's
// just selectable now, not dumped all at once.
type UseCase = {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  description: string;
  gradient: string;
  examples?: { text: string; comingSoon?: boolean }[];
};

function WhoItsFor({ useCases }: { useCases: UseCase[] }) {
  const [active, setActive] = useState(0);
  const current = useCases[active];
  const Icon = current.icon;

  return (
    <div>
      {/* Persona pills */}
      <div role="tablist" aria-label="Who IdiamPro is for" className="flex flex-wrap justify-center gap-2 md:gap-3 mb-10">
        {useCases.map((uc, i) => {
          const selected = i === active;
          const PillIcon = uc.icon;
          return (
            <button
              key={i}
              role="tab"
              type="button"
              aria-selected={selected}
              onClick={() => setActive(i)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200
                focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/60
                ${selected
                  ? 'bg-[#0E7C7B] border-[#0E7C7B] text-white font-semibold shadow-lg shadow-teal-600/25'
                  : 'bg-[#f4faf9] border-[#d3e6e4] text-[#47585a] hover:bg-[#eef6f5] hover:text-teal-600'}`}
            >
              <PillIcon className="w-4 h-4 flex-shrink-0" />
              <span>{uc.title}</span>
            </button>
          );
        })}
      </div>

      {/* Selected persona panel */}
      <div className="rounded-3xl border border-[#d3e6e4] bg-[#f4faf9] p-8 md:p-10">
        <div className="flex flex-col md:flex-row md:items-start gap-6 md:gap-8">
          <div className="md:w-2/5">
            <div className={`w-14 h-14 rounded-2xl ${current.gradient} flex items-center justify-center mb-4 shadow-lg`}>
              <Icon className="w-7 h-7 text-white" />
            </div>
            <div className="text-xs text-teal-600 font-medium uppercase tracking-wider mb-1">{current.subtitle}</div>
            <h3 className="text-2xl font-bold text-[#0c2224] mb-3">{current.title}</h3>
            <p className="text-[#47585a] leading-relaxed">{current.description}</p>
          </div>

          {current.examples && current.examples.length > 0 && (
            <div className="md:w-3/5 md:border-l md:border-[#d3e6e4] md:pl-8">
              <div className="text-sm font-medium text-teal-600 mb-4">How it works</div>
              <ul className="space-y-3">
                {current.examples.map((ex, idx) => (
                  <li key={idx} className="flex gap-3 text-[#47585a] text-sm leading-relaxed">
                    <span className="text-teal-600 mt-0.5 flex-shrink-0">›</span>
                    <span>
                      {ex.text}
                      {ex.comingSoon && (
                        <span className="ml-2 inline-block align-middle text-[10px] font-semibold
                          uppercase tracking-wider text-teal-600 bg-teal-600/10 border border-teal-600/20
                          rounded px-1.5 py-0.5">
                          Coming soon
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
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

  // Data
  const useCases = [
    {
      icon: Scale,
      title: 'Trial Prep',
      subtitle: 'Attorneys & Paralegals',
      description: 'Upload 200 pages of medical records, expert reports, and prior testimony. IdiamPro builds a chronological timeline, flags contradictions between sources, and produces a one-page list of questions to ask the witness. Three days of paralegal work — done in twenty minutes.',
      gradient: 'bg-gradient-to-br from-teal-600 to-teal-700',
      examples: [
        { text: 'Drop in a 90-minute deposition recording — it transcribes the whole thing and labels who said what, so you can read the exchange instead of scrubbing audio.' },
        { text: 'Import the PDF discovery dump, opposing expert reports, and the police bodycam video transcript into one outline that builds itself.' },
        { text: 'Ask the file plain questions — "where does the witness contradict the ER notes?" — and get the answer pulled from your own records, not the open web.' },
        { text: 'Run LIVE BOOKS to refresh your case-law section against the latest rulings, then preview and approve each change before it lands.' },
        { text: 'Export the finished argument to a clean Word brief or PDF in one click — no reformatting before it goes to the partner.' }
      ]
    },
    {
      icon: Microscope,
      title: 'Literature Reviews',
      subtitle: 'Researchers & PhD Students',
      description: 'Drop fifty research papers into one outline. IdiamPro groups them by methodology, summarizes each finding in plain English, and shows where the field agrees and where it\'s still fighting. You arrive at the writing stage already knowing the structure of your argument.',
      gradient: 'bg-gradient-to-br from-teal-600 to-teal-700',
      examples: [
        { text: 'Import 50 PDFs at once and get each paper summarized in plain English, grouped by method — no more reading abstracts one tab at a time.' },
        { text: 'Ask the whole corpus a question — "which studies used a control group over 200?" — and it answers from your imported papers, with sources.' },
        { text: 'Run LIVE BOOKS to catch papers published since you started, with a preview of exactly what would change before you accept it.' },
        { text: 'Generate a structured review outline from a one-line prompt, then expand each section with AI drafting to beat the blank page.' },
        { text: 'Pull in key foreign-language sources with built-in translation so non-English work makes it into your review.', comingSoon: true }
      ]
    },
    {
      icon: BookMarked,
      title: 'Writing Non-Fiction',
      subtitle: 'Authors & Writers',
      description: 'Import interview transcripts, archival research, and your own notes. IdiamPro drafts chapter outlines from your source material, suggests where each anecdote fits the narrative, and flags chapters where you\'re thin on evidence — so you know what to research next.',
      gradient: 'bg-gradient-to-br from-teal-600 to-teal-700',
      examples: [
        { text: 'Give it your premise in one sentence and get a full chapter-by-chapter book outline to react to instead of staring at page one.' },
        { text: 'Record your subject interviews and get a clean transcript with speakers named — quotes ready to drop into the manuscript.' },
        { text: 'Expand a thin section with AI drafting in your structure, then rewrite it in your own voice — the scaffolding is already there.' },
        { text: 'Capture stray ideas and clippings to your Second Brain; smart auto-tagging files them so the right note resurfaces at the right chapter.' },
        { text: 'Export the finished draft to a manuscript-ready Word doc or an EPUB ebook — one of 23 formats, no copy-paste cleanup.' }
      ]
    },
    {
      icon: Lightbulb,
      title: 'Client Engagements',
      subtitle: 'Consultants & Analysts',
      description: 'Combine client emails, stakeholder interviews, and competitive research into one outline. IdiamPro produces a slide-deck outline organized by client priority, with every claim traceable back to the email, transcript, or report that supports it.',
      gradient: 'bg-gradient-to-br from-teal-600 to-teal-700',
      examples: [
        { text: 'Import the client\'s data room — PDFs, spreadsheets, Google Docs and Slides — and have it organized into one working outline by lunch.' },
        { text: 'Generate the deliverable outline from a prompt — "board readout on market entry" — structured by client priority and ready to fill.' },
        { text: 'Record the stakeholder kickoff and get a speaker-labeled transcript, so requirements are quotable instead of half-remembered.' },
        { text: 'Run LIVE BOOKS on your market-sizing section the morning of the meeting so the numbers reflect this week, not last quarter.' },
        { text: 'Publish a polished client microsite from the outline with a built-in template, or export straight to a branded deck or PDF.' }
      ]
    },
    {
      icon: Video,
      title: 'Learning from Video',
      subtitle: 'Students & Learners',
      description: 'Paste a link to a 90-minute lecture. IdiamPro transcribes it, organizes the content by topic with timestamps, and turns it into a study guide. Then ask follow-up questions and get answers from the lecture itself — not generic web search.',
      gradient: 'bg-gradient-to-br from-teal-600 to-teal-700',
      examples: [
        { text: 'Paste a YouTube lecture link and get a topic-organized study guide with timestamps — go straight to the five minutes you actually missed.' },
        { text: 'Drop in the assigned reading PDFs alongside the lecture so everything for the exam lives in one outline.' },
        { text: 'Quiz yourself by asking the outline questions and grading your answer against what the lecture actually said — not a web guess.' },
        { text: 'Turn your notes into a generated podcast and revise on the walk to class instead of re-reading.' },
        { text: 'Record your own study group and get a transcript with each person labeled, so the explanation that finally clicked is searchable.' }
      ]
    },
    {
      icon: Newspaper,
      title: 'Investigative Reporting',
      subtitle: 'Journalists & Reporters',
      description: 'Import court records, leaked documents, and source interviews into a single secure outline. IdiamPro cross-references names, dates, and locations across sources to surface a coherent timeline. Every claim in your final story carries a click-through to the exact page that supports it.',
      gradient: 'bg-gradient-to-br from-teal-600 to-teal-700',
      examples: [
        { text: 'Record a source interview and get it transcribed with each speaker identified — the exact quote, attributed, without a second listen.' },
        { text: 'Import the FOIA PDFs, the leaked spreadsheet, and the hearing video transcript into one outline that ties names and dates together.' },
        { text: 'Ask the file "who knew about the contract before the vote?" and get an answer drawn only from your documents, with the source attached.' },
        { text: 'Run LIVE BOOKS on a developing story so your backgrounder reflects today\'s filings, with every change shown before you approve it.' },
        { text: 'Export the verified draft to your CMS format from 23 options, every claim still traceable to the page that proves it.' }
      ]
    }
  ];

  const faqs = [
    {
      question: 'How is IdiamPro different from Notion or Obsidian?',
      answer: 'IdiamPro is purpose-built for research synthesis and content creation. Unlike general note-taking apps, we focus on importing multiple sources (YouTube, PDFs, audio) and using AI to synthesize them into structured outlines. Our multi-source analysis and speaker diarization features are unique to IdiamPro.'
    },
    {
      question: 'Can I import my existing notes?',
      answer: 'Yes! IdiamPro supports importing from Markdown, OPML, plain text, and JSON formats. You can also import content from PDFs, Word documents, web pages, and even YouTube videos with automatic transcription.'
    },
    {
      question: 'Is my data private and secure?',
      answer: 'Absolutely. IdiamPro uses a local-first architecture—your outlines are stored on your device by default. When you use AI features, your content is sent securely to process but is never used to train AI models. We never sell your data.'
    },
    {
      question: 'What AI models do you use?',
      answer: 'We integrate with Google Gemini, OpenAI GPT-4, and Anthropic Claude. You can choose your preferred model, or let the system auto-select based on the task. Premium tiers unlock access to the most powerful models like Claude Opus.'
    },
    {
      question: 'Does it work offline?',
      answer: 'Yes! All core outlining features work completely offline. Your outlines are stored locally and sync when you reconnect. AI features require an internet connection, but you can continue editing without it.'
    },
    {
      question: 'Can I export my work?',
      answer: 'IdiamPro offers 23 export formats: PDF, Markdown, HTML (collapsible website), Word, LaTeX, EPUB, Plain Text, OPML, Obsidian (with wiki-links), Notion, CSV, JSON Tree, and more. Your data is never locked in.'
    }
  ];

  return (
    <div className="fixed inset-0 bg-white text-[#0c2224] overflow-x-hidden overflow-y-auto">
      {/* Background gradients */}
      <div className="fixed inset-0 bg-gradient-to-br from-white via-white to-white" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-600/[0.10] via-transparent to-transparent" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-teal-600/[0.08] via-transparent to-transparent" />

      <ParticlesBackground />

      {/* Content */}
      <div className="relative z-10">
        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 lg:px-12 backdrop-blur-xl bg-white/80 border-b border-[#d3e6e4]">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center shadow-lg shadow-teal-600/20">
                <Layers className="w-5 h-5 text-white" />
              </div>
              <span className="flex flex-col leading-none">
                <span className="text-xl font-bold bg-gradient-to-r from-[#0c2224] to-[#0c2224] bg-clip-text text-transparent">
                  IdiamPro
                </span>
                <span className="text-[10px] text-[#6b7d7e] tracking-wide mt-0.5">say it &ldquo;I-D-M Pro&rdquo;</span>
              </span>
            </div>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-[#47585a] hover:text-[#0c2224] transition-colors text-sm">Features</a>
              <a href="#use-cases" className="text-[#47585a] hover:text-[#0c2224] transition-colors text-sm">Use Cases</a>
              <a href="#pricing" className="text-[#47585a] hover:text-[#0c2224] transition-colors text-sm">Pricing</a>
              <a href="#faq" className="text-[#47585a] hover:text-[#0c2224] transition-colors text-sm">FAQ</a>
            </div>

            <div className="flex items-center gap-4">
              <SignedOut>
                <Button
                  onClick={launchApp}
                  className="hidden md:inline-flex bg-gradient-to-r from-[#0E7C7B] to-[#0E7C7B] hover:from-[#0c5c5b] hover:to-[#0c5c5b] text-white font-semibold shadow-lg shadow-teal-600/25"
                >
                  Sign up free
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </SignedOut>
              <SignedIn>
                <Button
                  onClick={() => { window.location.href = '/app'; }}
                  className="hidden md:inline-flex bg-gradient-to-r from-[#0E7C7B] to-[#0E7C7B] hover:from-[#0c5c5b] hover:to-[#0c5c5b] text-white font-semibold shadow-lg shadow-teal-600/25"
                >
                  Open IdiamPro
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </SignedIn>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div className="md:hidden absolute top-full left-0 right-0 bg-white/95 backdrop-blur-xl border-b border-[#d3e6e4] p-6">
              <div className="flex flex-col gap-4">
                <a href="#features" onClick={() => setMobileMenuOpen(false)} className="text-[#0c2224] py-2">Features</a>
                <a href="#use-cases" onClick={() => setMobileMenuOpen(false)} className="text-[#0c2224] py-2">Use Cases</a>
                <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="text-[#0c2224] py-2">Pricing</a>
                <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="text-[#0c2224] py-2">FAQ</a>
                <SignedOut>
                  <Button
                    onClick={launchApp}
                    className="bg-gradient-to-r from-[#0E7C7B] to-[#0E7C7B] text-white font-semibold w-full mt-2"
                  >
                    Sign up free
                  </Button>
                </SignedOut>
                <SignedIn>
                  <Button
                    onClick={() => { window.location.href = '/app'; }}
                    className="bg-gradient-to-r from-[#0E7C7B] to-[#0E7C7B] text-white font-semibold w-full mt-2"
                  >
                    Open IdiamPro
                  </Button>
                </SignedIn>
              </div>
            </div>
          )}
        </nav>

        {/* Hero Section */}
        <section className="px-6 pt-32 pb-16 lg:px-12 lg:pt-40">
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-4xl mx-auto">
              <div className={`${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-600/20 border border-teal-600/30 mb-6">
                  <Brain className="w-4 h-4 text-teal-600" />
                  <span className="text-sm text-teal-600">Develop it. Publish everywhere.</span>
                </div>
                <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
                  <span className="block text-[#0c2224]">The Premier</span>
                  <span className="block bg-gradient-to-r from-teal-500 via-teal-600 to-teal-600 bg-clip-text text-transparent">Idea Developer.</span>
                </h1>
                <p className="text-xl md:text-2xl text-[#0c2224] mb-4 max-w-3xl mx-auto">
                  Capture, consolidate, and develop your ideas with AI — then turn them into articles, podcasts, videos, websites, and more, in a click.
                </p>
                <p className="text-base md:text-lg text-[#47585a] mb-8 max-w-3xl mx-auto leading-relaxed">
                  Not a chat that forgets — a thinking machine that helps you{' '}
                  <span className="text-teal-600">consolidate many sources into coherent, developed thinking</span>{' '}
                  — a single idea, a complex concept, or a whole narrative — refined over many passes, then published in whatever format you need.
                </p>

                {/* Output strip — provable formats IdiamPro produces */}
                <div className="flex flex-wrap justify-center gap-2 mb-8 max-w-2xl mx-auto">
                  {['Research papers', 'Podcasts', 'Videos', 'Websites', 'Presentations', 'Illustrations', '21 languages', '…and more'].map((label) => (
                    <span
                      key={label}
                      className={`px-3 py-1.5 rounded-full bg-[#f4faf9] border border-[#d3e6e4] text-sm ${label === '…and more' ? 'text-[#6b7d7e] italic' : 'text-[#47585a]'}`}
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
                      className="bg-gradient-to-r from-[#0E7C7B] to-[#0E7C7B] hover:from-[#0c5c5b] hover:to-[#0c5c5b] text-white font-semibold px-8 py-6 text-base shadow-lg shadow-teal-600/30"
                    >
                      Sign up to try IdiamPro free
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <button
                      type="button"
                      onClick={() => { window.location.href = '/signin'; }}
                      className="text-sm text-[#47585a] hover:text-[#0c2224] underline-offset-4 hover:underline"
                    >
                      I already have an account
                    </button>
                  </SignedOut>
                  <SignedIn>
                    <Button
                      onClick={launchApp}
                      size="lg"
                      className="bg-gradient-to-r from-[#0E7C7B] to-[#0E7C7B] hover:from-[#0c5c5b] hover:to-[#0c5c5b] text-white font-semibold px-8 py-6 text-base shadow-lg shadow-teal-600/30"
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

        {/* Our Story — the self-referential founder film. The founder uses IdiamPro
            to plan IdiamPro's own launch: it proves the tool on the hardest founder
            problem AND tells the audience who we are. Additive to the existing intro
            video below (Howard decides later whether this becomes the main hero). */}
        <section className="px-6 pb-16 lg:px-12">
          <div className="mx-auto w-full max-w-4xl">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-600/20 border border-teal-600/30 mb-6">
                <Sparkles className="w-4 h-4 text-teal-600" />
                <span className="text-sm font-medium text-teal-600">Our Story · Why IdiamPro</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-bold mb-5 leading-tight">
                <span className="bg-gradient-to-r from-[#0c2224] via-[#0c2224] to-[#0c2224] bg-clip-text text-transparent">
                  The idea was only half the battle.
                </span>
              </h2>
              <p className="text-base md:text-lg text-[#47585a] leading-relaxed max-w-3xl mx-auto">
                A tool I&apos;d envisioned for decades — finally possible now. So I did the most honest test I could think of: I used IdiamPro to plan its own launch. The plan you&apos;ll watch build itself is the real one.
              </p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-[#d3e6e4] bg-[#f4faf9] shadow-2xl shadow-teal-600/10 backdrop-blur-sm">
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
            <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-[#6b7d7e]">
              <Video className="h-3.5 w-3.5 text-teal-600" />
              Produced by IdiamPro
            </p>
          </div>
        </section>

        {/* Intro video — itself generated by IdiamPro's own Generate Video feature.
            The "Produced by IdiamPro" caption is the point: the demo IS proof the
            product made it (outline → narrated slideshow → MP4). */}
        <section className="px-6 pb-16 lg:px-12">
          <div className="mx-auto w-full max-w-4xl">
            <div className="overflow-hidden rounded-2xl border border-[#d3e6e4] bg-[#f4faf9] shadow-2xl shadow-teal-600/10 backdrop-blur-sm">
              <video
                className="block h-auto w-full"
                src="/idiampro-intro.mp4"
                poster="/idiampro-intro-poster.jpg"
                controls
                playsInline
                preload="metadata"
                aria-label="IdiamPro introduction video, produced by IdiamPro"
              />
            </div>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-[#6b7d7e]">
              <Video className="h-3.5 w-3.5 text-teal-600" />
              Produced by IdiamPro
            </p>
          </div>
        </section>

        {/* Thesis — moved up to lead the page: idea development is iterative */}
        <IdeaDevelopmentBand />

        {/* One outline → many outputs — hub-and-spoke visual of shipped formats */}
        <OneOutlineManyOutputs />

        {/* A different kind of tool — competitor contrast grid (Amplifier palette) */}
        <section className="px-6 pb-16 lg:px-12">
          <div className="max-w-6xl mx-auto">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-600/10 border border-teal-600/20 mb-6">
                <Zap className="w-4 h-4 text-teal-600" />
                <span className="text-sm font-medium text-teal-600">A different kind of tool</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-[#0c2224] mb-4">
                Not a filing cabinet. Not a vending machine.
              </h2>
              <p className="text-base md:text-lg text-[#47585a] leading-relaxed max-w-[720px] mx-auto">
                Everyone else either stores the thinking you already did, or vends you a one-shot output. We&apos;re the only one that does the thinking <span className="text-teal-600 font-semibold">with</span> you — and hands back finished work, iteratively, in your voice.
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
                  className="flex flex-col rounded-2xl border border-[#d3e6e4] bg-white p-6 hover:border-teal-600/30 transition-colors"
                >
                  <h3 className="text-base font-bold text-[#0c2224] mb-4">{c.name}</h3>
                  <div className="mb-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8b9a9b] mb-1.5">They</div>
                    <p className="text-sm text-[#6b7d7e] leading-relaxed">{c.they}</p>
                  </div>
                  <div className="mt-auto pt-4 border-t border-[#d3e6e4]">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-teal-600 mb-1.5">We</div>
                    <p className="text-sm text-teal-700/90 leading-relaxed">{c.we}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Idea Incubator — lead concept section that frames the whole product */}
        <section className="px-6 pb-16 lg:px-12">
          <div className="max-w-5xl mx-auto">
            <div className="rounded-3xl border border-teal-600/20 bg-gradient-to-br from-teal-600/10 via-teal-600/5 to-teal-600/10 p-8 md:p-12">
              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-600/20 border border-teal-600/30 mb-6">
                  <Sparkles className="w-4 h-4 text-teal-600" />
                  <span className="text-sm font-medium text-teal-600">The Idea Incubator</span>
                </div>
                <h2 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">
                  <span className="bg-gradient-to-r from-[#0c2224] via-[#0c2224] to-[#0c2224] bg-clip-text text-transparent">
                    An Idea Incubator is where raw thoughts grow into finished work.
                  </span>
                </h2>
                <p className="text-base md:text-lg text-[#47585a] leading-relaxed max-w-3xl mx-auto">
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
                    gradient: 'bg-gradient-to-br from-teal-600 to-teal-600',
                  },
                  {
                    icon: FolderTree,
                    label: 'Structure',
                    description: 'Watch chaos become an outline you can shape, expand, and rearrange.',
                    gradient: 'bg-gradient-to-br from-teal-600 to-teal-600',
                  },
                  {
                    icon: Globe,
                    label: 'Enrich',
                    description: 'Refresh any part against the live web so your thinking never goes stale — then query your evolving knowledge base and get answers from everything you\'ve captured.',
                    gradient: 'bg-gradient-to-br from-teal-600 to-teal-600',
                  },
                  {
                    icon: Rocket,
                    label: 'Hatch',
                    description: 'When an idea is ready, generate the finished thing: a document, a script, a podcast, a content package.',
                    gradient: 'bg-gradient-to-br from-teal-600 to-teal-600',
                  },
                ].map((stage, i) => {
                  const StageIcon = stage.icon;
                  return (
                    <div
                      key={stage.label}
                      className="relative p-6 rounded-2xl bg-[#f4faf9] backdrop-blur-sm border border-[#d3e6e4] hover:bg-[#eef6f5] hover:border-[#d3e6e4] transition-all duration-300"
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-11 h-11 rounded-xl ${stage.gradient} flex items-center justify-center flex-shrink-0`}>
                          <StageIcon className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-xs font-semibold text-[#6b7d7e]">{`0${i + 1}`}</span>
                      </div>
                      <h3 className="text-lg font-bold text-[#0c2224] mb-2">{stage.label}</h3>
                      <p className="text-[#47585a] text-sm leading-relaxed">{stage.description}</p>
                    </div>
                  );
                })}
              </div>

              {/* Closing emphasized line */}
              <p className="text-center text-lg md:text-2xl font-semibold text-[#0c2224] mt-10 max-w-3xl mx-auto leading-snug">
                That&apos;s the difference between a filing cabinet and an incubator.{' '}
                <span className="bg-gradient-to-r from-teal-600 to-teal-600 bg-clip-text text-transparent">
                  One stores your ideas. The other helps them grow up.
                </span>
              </p>
            </div>
          </div>
        </section>

        {/* Thinkers — primary target segment (writers are one example) */}
        <section className="px-6 pb-16 lg:px-12">
          <div className="max-w-4xl mx-auto">
            <div className="rounded-2xl border border-[#d3e6e4] bg-gradient-to-br from-teal-600/5 to-teal-600/5 p-8 md:p-10">
              <h2 className="text-2xl md:text-3xl font-bold text-[#0c2224] mb-3">
                Built for people who think for a living.
              </h2>
              <p className="text-base md:text-lg text-[#47585a] leading-relaxed mb-5">
                However you earn your living, you earn it by thinking — researching, structuring, connecting ideas, and turning them into something real. IdiamPro is where that thinking takes shape: it pulls in your research, organizes it the way you reason, and helps you ship the result — a report, a strategy, a manuscript, a talk, a video.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full bg-teal-600/10 border border-teal-600/20 text-teal-500 text-xs">Researchers</span>
                <span className="px-3 py-1 rounded-full bg-teal-600/10 border border-teal-600/20 text-teal-500 text-xs">Strategists &amp; consultants</span>
                <span className="px-3 py-1 rounded-full bg-teal-600/10 border border-teal-600/20 text-teal-500 text-xs">Analysts</span>
                <span className="px-3 py-1 rounded-full bg-teal-600/10 border border-teal-600/20 text-teal-500 text-xs">Founders &amp; product leaders</span>
                <span className="px-3 py-1 rounded-full bg-teal-600/10 border border-teal-600/20 text-teal-500 text-xs">Educators &amp; students</span>
                <span className="px-3 py-1 rounded-full bg-teal-600/10 border border-teal-600/20 text-teal-500 text-xs">Writers &amp; authors</span>
              </div>
            </div>
          </div>
        </section>

        {/* A plan that's alive — differentiator vs. traditional project management */}
        <section className="px-6 pb-16 lg:px-12">
          <div className="max-w-4xl mx-auto">
            <div className="rounded-2xl border border-teal-600/20 bg-gradient-to-br from-teal-600/5 via-teal-600/5 to-teal-600/5 p-8 md:p-10">
              <h2 className="text-2xl md:text-3xl font-bold text-[#0c2224] mb-4">
                A plan that&rsquo;s <span className="text-teal-600">alive</span>.
              </h2>
              <p className="text-base md:text-lg text-[#47585a] leading-relaxed mb-4">
                Most plans die the moment reality moves. Traditional project management builds a beautiful, rigid structure &mdash; the chart, the fixed timeline &mdash; and then life shifts, the plan shatters, and it ends up stale in a drawer. It assumes a world that holds still. <span className="text-[#0c2224] font-semibold">The world never holds still.</span>
              </p>
              <p className="text-base md:text-lg text-[#47585a] leading-relaxed mb-4">
                IdiamPro&rsquo;s plan is <span className="text-teal-600 font-semibold">alive</span>. Because it&rsquo;s completely yours to shape, it bends and re-forms as your life unfolds &mdash; new information reshapes a branch, a closed door becomes a new route, an opening becomes your next move. It doesn&rsquo;t just plan your life; it keeps up with it.
              </p>
              <p className="text-base md:text-lg text-[#47585a] leading-relaxed">
                That&rsquo;s the difference between a plan and a <span className="text-teal-600 font-semibold">living</span> plan: one is a snapshot of a moment already gone &mdash; the other grows with you. IdiamPro is the living kind.
              </p>
            </div>
          </div>
        </section>

        {/* Written AND multimedia — dual-output positioning */}
        <section className="px-6 pb-16 lg:px-12">
          <div className="max-w-4xl mx-auto">
            <div className="rounded-2xl border border-teal-600/20 bg-gradient-to-br from-teal-600/5 via-teal-600/5 to-teal-600/5 p-8 md:p-10">
              <h2 className="text-2xl md:text-3xl font-bold text-[#0c2224] mb-3">
                Written work and multimedia, from one outline.
              </h2>
              <p className="text-base md:text-lg text-[#47585a] leading-relaxed mb-4">
                IdiamPro is the idea developer for both written content and multimedia. Snap a whiteboard photo and watch it become a structured outline. Pick a branch and IdiamPro produces a complete YouTube content package — script, chapters, description, SEO, B-roll prompts. Multimedia in, multimedia out.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full bg-[#f4faf9] border border-[#d3e6e4] text-[#47585a] text-xs">Books &amp; long-form</span>
                <span className="px-3 py-1 rounded-full bg-[#f4faf9] border border-[#d3e6e4] text-[#47585a] text-xs">Articles &amp; reports</span>
                <span className="px-3 py-1 rounded-full bg-[#f4faf9] border border-[#d3e6e4] text-[#47585a] text-xs">YouTube packages</span>
                <span className="px-3 py-1 rounded-full bg-[#f4faf9] border border-[#d3e6e4] text-[#47585a] text-xs">Podcasts</span>
                <span className="px-3 py-1 rounded-full bg-[#f4faf9] border border-[#d3e6e4] text-[#47585a] text-xs">Diagrams &amp; mind maps</span>
                <span className="px-3 py-1 rounded-full bg-[#f4faf9] border border-[#d3e6e4] text-[#47585a] text-xs">Whiteboard capture</span>
              </div>
            </div>
          </div>
        </section>

        {/* Globally distributed teams — concrete-example block */}
        <section className="px-6 pb-16 lg:px-12">
          <div className="max-w-4xl mx-auto">
            <div className="rounded-2xl border border-[#d3e6e4] bg-gradient-to-br from-teal-600/5 to-teal-600/5 p-8 md:p-10">
              <h2 className="text-2xl md:text-3xl font-bold text-[#0c2224] mb-3">
                Built for globally distributed teams.
              </h2>
              <p className="text-base md:text-lg text-[#47585a] leading-relaxed">
                A research team in Boston, a partner lab in Shanghai, and a graduate student in São Paulo — all working in the same outline, each contributing in their native language. The structure stays in sync; the translations stay current; the conversation never stops.
              </p>
            </div>
          </div>
        </section>


        {/* COGNITIVE ENHANCEMENT - Intelligence Amplifier Section */}
        <section className="px-6 py-20 lg:px-12 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-teal-600/5 via-transparent to-transparent" />
          <div className="max-w-7xl mx-auto relative">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-600/20 border border-teal-600/30 mb-6">
                <Brain className="w-5 h-5 text-teal-600" />
                <span className="text-sm font-medium text-teal-600">Cognitive Enhancement Platform</span>
              </div>
              <h2 className="text-4xl lg:text-6xl font-bold mb-6">
                <span className="bg-gradient-to-r from-[#0c2224] to-[#0c2224] bg-clip-text text-transparent">
                  Your Second Brain,
                </span>
                <br />
                <span className="bg-gradient-to-r from-teal-500 via-teal-600 to-teal-600 bg-clip-text text-transparent">
                  Amplified
                </span>
              </h2>
              <p className="text-xl text-[#47585a] max-w-3xl mx-auto leading-relaxed">
                IdiamPro is a true intelligence amplifier—it doesn&apos;t just store information, it enhances
                your cognitive capabilities. Build a knowledge repository that grows with you, surfaces hidden
                connections, and accelerates your thinking.
              </p>
            </div>

            {/* Three pillars of intelligence amplification */}
            <div className="grid md:grid-cols-3 gap-8">
              {/* Expanded Scope */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-teal-600/20 to-teal-600/10 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative p-8 rounded-3xl bg-[#f4faf9] border border-[#d3e6e4] hover:border-teal-600/30 transition-all duration-300 h-full">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center mb-6 shadow-lg shadow-teal-600/30">
                    <Globe className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-[#0c2224] mb-4">Expanded Knowledge Scope</h3>
                  <p className="text-[#47585a] leading-relaxed mb-4">
                    Your brain can only hold so much. IdiamPro becomes your external memory—capturing every source,
                    every insight, every connection you&apos;ve ever encountered. Access decades of accumulated
                    knowledge instantly.
                  </p>
                  <div className="flex items-center gap-2 text-teal-600 text-sm font-medium">
                    <span className="px-3 py-1 rounded-full bg-teal-600/20 border border-teal-600/30">
                      1,000,000+ nodes tested*
                    </span>
                  </div>
                </div>
              </div>

              {/* Speed of Access */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-teal-600/20 to-teal-600/10 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative p-8 rounded-3xl bg-[#f4faf9] border border-[#d3e6e4] hover:border-teal-600/30 transition-all duration-300 h-full">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center mb-6 shadow-lg shadow-teal-600/30">
                    <Zap className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-[#0c2224] mb-4">Accelerated Access</h3>
                  <p className="text-[#47585a] leading-relaxed mb-4">
                    Find what you need in seconds, not hours. Hierarchical outlines, AI-powered search, and smart
                    organization means your knowledge is always at your fingertips—ready when you need it.
                  </p>
                  <div className="flex items-center gap-2 text-teal-600 text-sm font-medium">
                    <span className="px-3 py-1 rounded-full bg-teal-600/20 border border-teal-600/30">
                      Instant retrieval
                    </span>
                  </div>
                </div>
              </div>

              {/* Pattern Recognition */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-teal-600/20 to-teal-600/10 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative p-8 rounded-3xl bg-[#f4faf9] border border-[#d3e6e4] hover:border-teal-600/30 transition-all duration-300 h-full">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center mb-6 shadow-lg shadow-teal-600/30">
                    <Network className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-[#0c2224] mb-4">Hidden Connections</h3>
                  <p className="text-[#47585a] leading-relaxed mb-4">
                    See what others miss. The hierarchical structure reveals complex interrelationships between ideas,
                    surfaces creative possibilities, and helps you synthesize insights that would otherwise remain hidden.
                  </p>
                  <div className="flex items-center gap-2 text-teal-600 text-sm font-medium">
                    <span className="px-3 py-1 rounded-full bg-teal-600/20 border border-teal-600/30">
                      Pattern recognition
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Cognitive Enhancement Quote */}
            <div className="mt-16 p-8 lg:p-12 rounded-3xl bg-[#f4faf9] border border-[#d3e6e4] text-center">
              <Quote className="w-12 h-12 text-teal-600/50 mx-auto mb-6" />
              <blockquote className="text-2xl lg:text-3xl font-light text-[#0c2224] italic max-w-4xl mx-auto leading-relaxed">
                &ldquo;The difference between experts and novices isn&apos;t just what they know—it&apos;s how quickly
                they can access and connect that knowledge. IdiamPro gives everyone an expert&apos;s cognitive edge.&rdquo;
              </blockquote>
              <div className="mt-6 text-[#6b7d7e]">
                — The Cognitive Enhancement Philosophy
              </div>
            </div>
          </div>
        </section>

        {/* WORKFLOWS - The Incredible Things You Can Do */}
        <section className="px-6 py-16 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-teal-600 font-medium mb-2">Professional Research Workflows</p>
              <h2 className="text-3xl lg:text-5xl font-bold">
                <span className="bg-gradient-to-r from-[#0c2224] to-[#0c2224] bg-clip-text text-transparent">
                  From meeting room
                </span>
                <br className="hidden sm:block" />
                <span className="bg-gradient-to-r from-teal-600 to-teal-600 bg-clip-text text-transparent">
                  {' '}to published paper
                </span>
              </h2>
              <p className="text-[#6b7d7e] text-lg max-w-2xl mx-auto mt-4">
                Every step of the professional research workflow, powered by AI.
              </p>
            </div>

            {/* Workflow Cards - Large, Visual */}
            <div className="space-y-6">
              {/* Hero row - the flagship synthesis workflow + two signature captures */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Research Synthesis - Hero Workflow */}
                <div className="md:col-span-2 group relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-600/20 via-teal-600/10 to-teal-600/20 border border-teal-600/30 p-8 lg:p-12 hover:border-teal-600/50 transition-all duration-500">
                  <div className="absolute top-0 right-0 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl -tranteal-y-1/2 tranteal-x-1/2" />
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center shadow-lg shadow-teal-600/30">
                        <Merge className="w-7 h-7 text-white" />
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-teal-600/20 text-teal-600 border border-teal-600/30">
                        Core Capability
                      </span>
                    </div>
                    <h3 className="text-2xl lg:text-3xl font-bold text-[#0c2224] mb-3">
                      Literature Review in Hours, Not Months
                    </h3>
                    <p className="text-[#47585a] text-lg mb-6 max-w-2xl">
                      Import research papers, conference recordings, technical reports, and field notes simultaneously.
                      AI synthesizes everything into a coherent outline organized by themes and findings—the way research should be organized.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <span className="px-3 py-1.5 rounded-lg bg-[#f4faf9] text-[#47585a] text-sm flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Research Papers
                      </span>
                      <span className="px-3 py-1.5 rounded-lg bg-[#f4faf9] text-[#47585a] text-sm flex items-center gap-2">
                        <Volume2 className="w-4 h-4" /> Conference Recordings
                      </span>
                      <span className="px-3 py-1.5 rounded-lg bg-[#f4faf9] text-[#47585a] text-sm flex items-center gap-2">
                        <Youtube className="w-4 h-4" /> Video Lectures
                      </span>
                      <span className="px-3 py-1.5 rounded-lg bg-[#f4faf9] text-[#47585a] text-sm flex items-center gap-2">
                        <Globe className="w-4 h-4" /> Technical Reports
                      </span>
                      <span className="px-3 py-1.5 rounded-lg bg-[#f4faf9] text-[#47585a] text-sm flex items-center gap-2">
                        <FileUp className="w-4 h-4" /> Field Notes
                      </span>
                    </div>
                  </div>
                </div>

                {/* Meeting Transcription */}
                <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-600/10 to-teal-600/10 border border-teal-600/20 p-8 hover:border-teal-600/40 transition-all duration-500">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-teal-600/10 rounded-full blur-3xl -tranteal-y-1/2 tranteal-x-1/2" />
                  <div className="relative">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center shadow-lg shadow-teal-600/30 mb-4">
                      <Headphones className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl lg:text-2xl font-bold text-[#0c2224] mb-2">
                      Capture Physical Meetings &amp; Interviews
                    </h3>
                    <p className="text-[#47585a] mb-4">
                      Record in-person meetings, focus groups, or field interviews. Upload the audio and get automatic transcription with speaker diarization—know exactly who said what.
                    </p>
                    <div className="text-teal-600 text-sm font-medium">
                      Auto speaker identification →
                    </div>
                  </div>
                </div>

                {/* Generate Podcasts */}
                <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-600/10 to-teal-600/10 border border-teal-600/20 p-8 hover:border-teal-600/40 transition-all duration-500">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-teal-600/10 rounded-full blur-3xl -tranteal-y-1/2 tranteal-x-1/2" />
                  <div className="relative">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center shadow-lg shadow-teal-600/30 mb-4">
                      <Podcast className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl lg:text-2xl font-bold text-[#0c2224] mb-2">
                      Turn Any Outline Into a Podcast
                    </h3>
                    <p className="text-[#47585a] mb-4">
                      Select any branch and generate a professional podcast. Choose voices, style, and length.
                    </p>
                    <div className="text-teal-600 text-sm font-medium">
                      Multiple voices &amp; styles →
                    </div>
                  </div>
                </div>
              </div>

              {/* Signature outputs - three more one-click workflows */}
              <div className="grid md:grid-cols-3 gap-6">
                {/* Auto Mind Maps */}
                <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-600/10 to-teal-600/10 border border-teal-600/20 p-8 hover:border-teal-600/40 transition-all duration-500">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center shadow-lg shadow-teal-600/30 mb-4">
                    <Network className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-[#0c2224] mb-2">
                    Auto-Generate Mind Maps &amp; Flowcharts
                  </h3>
                  <p className="text-[#47585a] text-sm mb-4">
                    Select any branch and instantly turn its structure into a mind map, flowchart, or org chart—export it or embed it right in your outline.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 rounded-lg bg-[#f4faf9] text-[#47585a] text-xs">Mind Maps</span>
                    <span className="px-3 py-1 rounded-lg bg-[#f4faf9] text-[#47585a] text-xs">Flowcharts</span>
                    <span className="px-3 py-1 rounded-lg bg-[#f4faf9] text-[#47585a] text-xs">Org Charts</span>
                  </div>
                </div>

                {/* Ask your knowledge base (formerly Knowledge Chat) */}
                <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-600/10 to-teal-600/10 border border-teal-600/20 p-8 hover:border-teal-600/40 transition-all duration-500">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center shadow-lg shadow-teal-600/30 mb-4">
                    <MessagesSquare className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-[#0c2224] mb-2">
                    Ask Your Knowledge Base
                  </h3>
                  <p className="text-[#47585a] text-sm mb-4">
                    Ask questions about one outline or across everything you’ve captured—answers come from your own sources, not a generic web guess.
                  </p>
                  <div className="text-teal-600 text-sm font-medium">
                    Single or multi-outline →
                  </div>
                </div>

                {/* From outline to YouTube - shipped multimedia workflow */}
                <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-600/10 via-teal-600/5 to-teal-600/10 border border-teal-600/20 p-8 hover:border-teal-600/40 transition-all duration-500">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center shadow-lg shadow-teal-600/30 mb-4">
                    <Youtube className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h3 className="text-xl font-bold text-[#0c2224]">
                      From Outline to Video Package
                    </h3>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-600 bg-teal-600/10 border border-teal-600/20 rounded px-2 py-0.5">
                      Shipped
                    </span>
                  </div>
                  <p className="text-[#47585a] text-sm mb-4">
                    Pick any branch and generate a complete YouTube package—voiceover script, chapter markers, title variants, SEO tags, thumbnail concept, and B-roll prompts.
                  </p>
                  <div className="text-teal-600 text-sm font-medium">
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
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-600/20 border border-teal-600/30 mb-6">
                <Sparkles className="w-4 h-4 text-teal-600" />
                <span className="text-sm font-medium text-teal-600">See it in action</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-[#0c2224] mb-4">
                Real screenshots, real product.
              </h2>
              <p className="text-base md:text-lg text-[#47585a] leading-relaxed max-w-2xl mx-auto">
                No mockups. This is IdiamPro today — from the writing workspace to the finished outputs it produces.
              </p>
            </div>

            {/* Light & Dark — the product is beautiful either way */}
            <div className="mb-12">
              <p className="text-center text-sm text-[#6b7d7e] mb-5">
                Made for light lovers and dark lovers alike — the same workspace, your way.
              </p>
              <div className="grid sm:grid-cols-2 gap-6 lg:gap-8">
                {/* Light — styled placeholder until the real light-mode capture is dropped in */}
                <figure className="rounded-2xl border border-[#d3e6e4] bg-white overflow-hidden shadow-[0_1px_3px_rgba(12,34,36,0.06),0_8px_24px_rgba(12,34,36,0.06)]">
                  <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-[#d3e6e4] bg-[#f4faf9]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#d3e6e4]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#d3e6e4]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#d3e6e4]" />
                    <span className="ml-auto text-[11px] font-semibold uppercase tracking-wider text-teal-600">Light</span>
                  </div>
                  <div className="aspect-[16/10] flex flex-col items-center justify-center gap-3 bg-[#f4faf9] text-center px-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0E7C7B] to-[#0c5c5b] flex items-center justify-center">
                      <Monitor className="w-6 h-6 text-white" />
                    </div>
                    <p className="text-sm font-medium text-[#47585a]">Light-mode capture coming here</p>
                    <p className="text-xs text-[#6b7d7e] max-w-[240px]">The same workspace in a light theme — a real screenshot drops into this frame.</p>
                  </div>
                </figure>
                {/* Dark — real product capture */}
                <figure className="rounded-2xl border border-[#d3e6e4] bg-white overflow-hidden shadow-[0_1px_3px_rgba(12,34,36,0.06),0_8px_24px_rgba(12,34,36,0.06)]">
                  <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-[#d3e6e4] bg-[#f4faf9]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#d3e6e4]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#d3e6e4]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#d3e6e4]" />
                    <span className="ml-auto text-[11px] font-semibold uppercase tracking-wider text-teal-600">Dark</span>
                  </div>
                  <img
                    src="/screenshots/outline-editor.png"
                    alt="IdiamPro workspace in dark mode"
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
                  className="group rounded-2xl border border-[#d3e6e4] bg-[#f4faf9] overflow-hidden hover:border-teal-600/30 transition-colors"
                >
                  <div className="bg-white/60 border-b border-[#d3e6e4]">
                    <img
                      src={shot.src}
                      alt={shot.title}
                      loading="lazy"
                      className="w-full h-auto block"
                    />
                  </div>
                  <figcaption className="p-5 md:p-6">
                    <div className="text-xs text-teal-600 font-medium uppercase tracking-wider mb-1">{shot.label}</div>
                    <h3 className="text-lg font-semibold text-[#0c2224] mb-1">{shot.title}</h3>
                    <p className="text-[#6b7d7e] text-sm leading-relaxed">{shot.desc}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* Workflows showcase — previews that link out to /workflows (no inline video) */}
        <section className="px-6 py-20 lg:px-12">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-600/20 border border-teal-600/30 mb-6">
                <Play className="w-4 h-4 text-teal-600" />
                <span className="text-sm font-medium text-teal-600">Workflows</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-[#0c2224] mb-4">
                Real stories, start to finish.
              </h2>
              <p className="text-base md:text-lg text-[#47585a] leading-relaxed max-w-2xl mx-auto">
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
                  className="group block rounded-2xl border border-[#d3e6e4] bg-white overflow-hidden shadow-[0_1px_3px_rgba(12,34,36,0.06),0_8px_24px_rgba(12,34,36,0.05)] hover:border-teal-600/40 hover:shadow-[0_2px_6px_rgba(12,34,36,0.08),0_16px_40px_rgba(12,34,36,0.10)] transition-all"
                >
                  <div className="relative aspect-video overflow-hidden bg-[#f4faf9] border-b border-[#d3e6e4]">
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
                    <div className="text-xs text-teal-600 font-medium uppercase tracking-wider mb-1">{wf.label}</div>
                    <h3 className="text-lg font-semibold text-[#0c2224] mb-1">{wf.title}</h3>
                    <p className="text-[#6b7d7e] text-sm leading-relaxed mb-3">{wf.desc}</p>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-teal-600 group-hover:gap-2 transition-all">
                      Watch <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </a>
              ))}
            </div>

            <div className="text-center mt-8">
              <a
                href="/workflows"
                className="inline-flex items-center gap-2 rounded-full border border-teal-600/40 px-6 py-3 text-sm font-medium text-teal-600 hover:bg-teal-600/10 transition-colors"
              >
                See all workflows
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </section>

        {/* Social Proof Bar */}
        <section className="px-6 py-10 lg:px-12 border-y border-[#d3e6e4] bg-[#f4faf9]">
          <div className="max-w-7xl mx-auto">
            <p className="text-center text-[#6b7d7e] text-sm mb-6">Built for professional researchers at leading institutions</p>
            <div className="flex flex-wrap justify-center items-center gap-6 lg:gap-12">
              <div className="text-center">
                <div className="text-2xl font-bold text-[#47585a]">Universities</div>
                <div className="text-xs text-[#6b7d7e]">PhD & Postdoc</div>
              </div>
              <div className="w-px h-8 bg-[#f4faf9] hidden sm:block" />
              <div className="text-center">
                <div className="text-2xl font-bold text-[#47585a]">Research Labs</div>
                <div className="text-xs text-[#6b7d7e]">Academic & Industrial</div>
              </div>
              <div className="w-px h-8 bg-[#f4faf9] hidden sm:block" />
              <div className="text-center">
                <div className="text-2xl font-bold text-[#47585a]">Consulting</div>
                <div className="text-xs text-[#6b7d7e]">McKinsey, BCG, Bain</div>
              </div>
              <div className="w-px h-8 bg-[#f4faf9] hidden sm:block" />
              <div className="text-center">
                <div className="text-2xl font-bold text-[#47585a]">Legal</div>
                <div className="text-xs text-[#6b7d7e]">Law Firms & Counsel</div>
              </div>
            </div>
          </div>
        </section>

        {/* Why SecondBrainWare - Competitive Positioning */}
        <section id="features" className="px-6 py-24 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-teal-600 font-medium mb-2">Why Professionals Choose IdiamPro</p>
              <h2 className="text-3xl lg:text-5xl font-bold mb-4">
                Built for{' '}
                <span className="bg-gradient-to-r from-teal-600 to-teal-600 bg-clip-text text-transparent">
                  research-grade work
                </span>
              </h2>
              <p className="text-[#6b7d7e] text-lg max-w-2xl mx-auto">
                Consumer note-taking apps weren't designed for professional research. IdiamPro was built from the ground up for serious knowledge synthesis.
              </p>
            </div>

            {/* Comparison Grid */}
            <div className="grid lg:grid-cols-2 gap-8 mb-16">
              {/* What Others Do */}
              <div className="p-8 rounded-3xl bg-[#f4faf9] border border-[#d3e6e4]">
                <h3 className="text-lg font-semibold text-[#6b7d7e] mb-6 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#f4faf9] flex items-center justify-center text-xs">✗</span>
                  What other tools do
                </h3>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3 text-[#6b7d7e]">
                    <span className="w-5 h-5 rounded bg-[#f4faf9] flex items-center justify-center text-xs flex-shrink-0 mt-0.5">•</span>
                    <span>Take notes and organize them manually</span>
                  </li>
                  <li className="flex items-start gap-3 text-[#6b7d7e]">
                    <span className="w-5 h-5 rounded bg-[#f4faf9] flex items-center justify-center text-xs flex-shrink-0 mt-0.5">•</span>
                    <span>Import one file at a time, if at all</span>
                  </li>
                  <li className="flex items-start gap-3 text-[#6b7d7e]">
                    <span className="w-5 h-5 rounded bg-[#f4faf9] flex items-center justify-center text-xs flex-shrink-0 mt-0.5">•</span>
                    <span>AI as an afterthought—generic chat bolted on</span>
                  </li>
                  <li className="flex items-start gap-3 text-[#6b7d7e]">
                    <span className="w-5 h-5 rounded bg-[#f4faf9] flex items-center justify-center text-xs flex-shrink-0 mt-0.5">•</span>
                    <span>Force you to choose: mobile OR desktop experience</span>
                  </li>
                  <li className="flex items-start gap-3 text-[#6b7d7e]">
                    <span className="w-5 h-5 rounded bg-[#f4faf9] flex items-center justify-center text-xs flex-shrink-0 mt-0.5">•</span>
                    <span>Lock your data in proprietary formats</span>
                  </li>
                </ul>
              </div>

              {/* What SecondBrainWare Does */}
              <div className="p-8 rounded-3xl bg-gradient-to-br from-teal-600/10 to-teal-600/10 border border-teal-600/30">
                <h3 className="text-lg font-semibold text-[#0c2224] mb-6 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-teal-600 flex items-center justify-center text-xs">✓</span>
                  What IdiamPro does differently
                </h3>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3 text-[#0c2224]">
                    <Check className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                    <span><strong className="text-[#0c2224]">Multi-source synthesis</strong>—import 50+ sources and let AI organize by theme</span>
                  </li>
                  <li className="flex items-start gap-3 text-[#0c2224]">
                    <Check className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                    <span><strong className="text-[#0c2224]">10+ source types</strong>—YouTube, PDFs, audio with transcription, web pages, docs</span>
                  </li>
                  <li className="flex items-start gap-3 text-[#0c2224]">
                    <Check className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                    <span><strong className="text-[#0c2224]">AI-native from day one</strong>—content generation, synthesis, diagrams, podcasts</span>
                  </li>
                  <li className="flex items-start gap-3 text-[#0c2224]">
                    <Check className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                    <span><strong className="text-[#0c2224]">True cross-platform</strong>—identical experience on Mac, iPhone, iPad, and web</span>
                  </li>
                  <li className="flex items-start gap-3 text-[#0c2224]">
                    <Check className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                    <span><strong className="text-[#0c2224]">Your data, your way</strong>—23 export formats, local-first storage, no lock-in</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Feature Comparison Table */}
            <div className="mt-12 overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[#d3e6e4]">
                    <th className="text-left py-4 px-4 text-[#0c2224] font-semibold">Feature</th>
                    <th className="text-center py-4 px-4">
                      <span className="text-teal-600 font-bold">IdiamPro</span>
                    </th>
                    <th className="text-center py-4 px-4 text-[#6b7d7e]">Notion</th>
                    <th className="text-center py-4 px-4 text-[#6b7d7e]">Obsidian</th>
                    <th className="text-center py-4 px-4 text-[#6b7d7e]">Roam</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  <tr className="border-b border-[#d3e6e4]">
                    <td className="py-3 px-4 text-[#47585a]">Multi-source AI synthesis (50+ sources)</td>
                    <td className="py-3 px-4 text-center"><Check className="w-5 h-5 text-teal-600 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-[#b9c6c6] mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-[#b9c6c6] mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-[#b9c6c6] mx-auto" /></td>
                  </tr>
                  <tr className="border-b border-[#d3e6e4]">
                    <td className="py-3 px-4 text-[#47585a]">Speaker diarization (who said what)</td>
                    <td className="py-3 px-4 text-center"><Check className="w-5 h-5 text-teal-600 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-[#b9c6c6] mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-[#b9c6c6] mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-[#b9c6c6] mx-auto" /></td>
                  </tr>
                  <tr className="border-b border-[#d3e6e4]">
                    <td className="py-3 px-4 text-[#47585a]">PDF & document import with analysis</td>
                    <td className="py-3 px-4 text-center"><Check className="w-5 h-5 text-teal-600 mx-auto" /></td>
                    <td className="py-3 px-4 text-center text-[#8b9a9b]">Limited</td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-[#b9c6c6] mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-[#b9c6c6] mx-auto" /></td>
                  </tr>
                  <tr className="border-b border-[#d3e6e4]">
                    <td className="py-3 px-4 text-[#47585a]">YouTube transcript import</td>
                    <td className="py-3 px-4 text-center"><Check className="w-5 h-5 text-teal-600 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-[#b9c6c6] mx-auto" /></td>
                    <td className="py-3 px-4 text-center text-[#8b9a9b]">Plugin</td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-[#b9c6c6] mx-auto" /></td>
                  </tr>
                  <tr className="border-b border-[#d3e6e4]">
                    <td className="py-3 px-4 text-[#47585a]">AI content generation</td>
                    <td className="py-3 px-4 text-center"><Check className="w-5 h-5 text-teal-600 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><Check className="w-5 h-5 text-[#6b7d7e] mx-auto" /></td>
                    <td className="py-3 px-4 text-center text-[#8b9a9b]">Plugin</td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-[#b9c6c6] mx-auto" /></td>
                  </tr>
                  <tr className="border-b border-[#d3e6e4]">
                    <td className="py-3 px-4 text-[#47585a]">Podcast generation</td>
                    <td className="py-3 px-4 text-center"><Check className="w-5 h-5 text-teal-600 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-[#b9c6c6] mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-[#b9c6c6] mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-[#b9c6c6] mx-auto" /></td>
                  </tr>
                  <tr className="border-b border-[#d3e6e4]">
                    <td className="py-3 px-4 text-[#47585a]">Local-first storage</td>
                    <td className="py-3 px-4 text-center"><Check className="w-5 h-5 text-teal-600 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-[#b9c6c6] mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><Check className="w-5 h-5 text-[#6b7d7e] mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-[#b9c6c6] mx-auto" /></td>
                  </tr>
                  <tr className="border-b border-[#d3e6e4]">
                    <td className="py-3 px-4 text-[#47585a]">Native iOS app</td>
                    <td className="py-3 px-4 text-center"><Check className="w-5 h-5 text-teal-600 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><Check className="w-5 h-5 text-[#6b7d7e] mx-auto" /></td>
                    <td className="py-3 px-4 text-center text-[#8b9a9b]">Basic</td>
                    <td className="py-3 px-4 text-center text-[#8b9a9b]">Basic</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-[#47585a]">1,000,000+ node capacity*</td>
                    <td className="py-3 px-4 text-center"><Check className="w-5 h-5 text-teal-600 mx-auto" /></td>
                    <td className="py-3 px-4 text-center text-[#8b9a9b]">Slows</td>
                    <td className="py-3 px-4 text-center"><Check className="w-5 h-5 text-[#6b7d7e] mx-auto" /></td>
                    <td className="py-3 px-4 text-center text-[#8b9a9b]">Slows</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Scale Callout */}
            <div className="mt-16 p-8 lg:p-12 rounded-3xl bg-gradient-to-r from-teal-600/10 via-teal-600/10 to-teal-600/10 border border-teal-600/20 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-teal-600/10 via-transparent to-transparent" />
              <div className="relative">
                <h3 className="text-4xl lg:text-6xl font-bold text-[#0c2224] mb-4">
                  <AnimatedNumber value={1000000} prefix="" suffix="+" />
                </h3>
                <p className="text-xl text-[#0c2224] mb-2">nodes in a single outline*</p>
                <p className="text-[#6b7d7e] max-w-xl mx-auto mb-6">
                  Stress-tested with over one million nodes. No artificial limits—scale until your hardware says stop.
                  Your biggest research projects, handled with ease.
                </p>
                <Button
                  onClick={() => window.location.href = '/stress-test'}
                  variant="outline"
                  className="border-teal-600/30 text-teal-600 hover:bg-teal-600/10 hover:border-teal-600/50"
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Test Your System
                </Button>
                <p className="text-[#8b9a9b] text-xs mt-4">
                  *Tested on M4 MacBook Air with 512GB SSD. Performance varies by hardware and platform.
                </p>
              </div>
            </div>

            {/* Key Advantages */}
            <div className="mt-12 grid md:grid-cols-4 gap-6">
              <div className="text-center p-6 rounded-2xl bg-[#f4faf9] border border-[#d3e6e4]">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-teal-600/25">
                  <Sparkles className="w-7 h-7 text-white" />
                </div>
                <h4 className="text-lg font-bold text-[#0c2224] mb-2">AI-First</h4>
                <p className="text-[#6b7d7e] text-sm">
                  Every feature designed around AI from day one
                </p>
              </div>
              <div className="text-center p-6 rounded-2xl bg-[#f4faf9] border border-[#d3e6e4]">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-teal-600/25">
                  <Shield className="w-7 h-7 text-white" />
                </div>
                <h4 className="text-lg font-bold text-[#0c2224] mb-2">Privacy-First</h4>
                <p className="text-[#6b7d7e] text-sm">
                  Local storage by default. Cloud is optional.
                </p>
              </div>
              <div className="text-center p-6 rounded-2xl bg-[#f4faf9] border border-[#d3e6e4]">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-teal-600/25">
                  <Zap className="w-7 h-7 text-white" />
                </div>
                <h4 className="text-lg font-bold text-[#0c2224] mb-2">Blazing Fast</h4>
                <p className="text-[#6b7d7e] text-sm">
                  Instant response, even with massive outlines
                </p>
              </div>
              <div className="text-center p-6 rounded-2xl bg-[#f4faf9] border border-[#d3e6e4]">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-teal-600/25">
                  <Layers className="w-7 h-7 text-white" />
                </div>
                <h4 className="text-lg font-bold text-[#0c2224] mb-2">19 Node Types</h4>
                <p className="text-[#6b7d7e] text-sm">
                  Tasks, code, media, spreadsheets, and more
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Privacy & Data Security */}
        <section className="px-6 py-24 lg:px-12 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-teal-900/10 to-transparent" />
          <div className="max-w-7xl mx-auto relative">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-600/20 border border-teal-600/30 mb-6">
                  <Lock className="w-4 h-4 text-teal-600" />
                  <span className="text-sm text-teal-600">Your Data, Protected</span>
                </div>
                <h2 className="text-3xl lg:text-5xl font-bold mb-6">
                  <span className="bg-gradient-to-r from-[#0c2224] to-[#0c2224] bg-clip-text text-transparent">
                    Privacy is not
                  </span>
                  <br />
                  <span className="bg-gradient-to-r from-teal-600 to-teal-600 bg-clip-text text-transparent">
                    an afterthought
                  </span>
                </h2>
                <p className="text-[#47585a] text-lg mb-8">
                  Unlike cloud-first apps that hold your data hostage, IdiamPro is built local-first.
                  Your outlines live on your device. You're always in control.
                </p>

                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-teal-600/20 flex items-center justify-center flex-shrink-0">
                      <Shield className="w-5 h-5 text-teal-600" />
                    </div>
                    <div>
                      <h4 className="text-[#0c2224] font-semibold mb-1">Local-First Storage</h4>
                      <p className="text-[#6b7d7e] text-sm">Your data is stored on your device by default. No cloud required. No servers holding your thoughts.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-teal-600/20 flex items-center justify-center flex-shrink-0">
                      <Lock className="w-5 h-5 text-teal-600" />
                    </div>
                    <div>
                      <h4 className="text-[#0c2224] font-semibold mb-1">Never Sold, Never Shared</h4>
                      <p className="text-[#6b7d7e] text-sm">We will never sell your data. Period. Your content is yours alone.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-teal-600/20 flex items-center justify-center flex-shrink-0">
                      <Brain className="w-5 h-5 text-teal-600" />
                    </div>
                    <div>
                      <h4 className="text-[#0c2224] font-semibold mb-1">No AI Training on Your Data</h4>
                      <p className="text-[#6b7d7e] text-sm">When you use AI features, your content is processed but never used to train AI models. Contractually guaranteed.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-teal-600/20 flex items-center justify-center flex-shrink-0">
                      <Download className="w-5 h-5 text-teal-600" />
                    </div>
                    <div>
                      <h4 className="text-[#0c2224] font-semibold mb-1">Export Anytime, Any Format</h4>
                      <p className="text-[#6b7d7e] text-sm">23 export formats mean you're never locked in. Leave anytime with all your data.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-teal-600/20 to-teal-600/20 rounded-3xl blur-3xl" />
                <div className="relative p-8 lg:p-12 rounded-3xl bg-white/80 border border-teal-600/20">
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-teal-600/30">
                      <Shield className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-[#0c2224] mb-4">Your Data Promise</h3>
                    <ul className="space-y-3 text-left">
                      <li className="flex items-center gap-3 text-[#0c2224]">
                        <Check className="w-5 h-5 text-teal-600 flex-shrink-0" />
                        <span>Data stored locally on your device</span>
                      </li>
                      <li className="flex items-center gap-3 text-[#0c2224]">
                        <Check className="w-5 h-5 text-teal-600 flex-shrink-0" />
                        <span>Optional encrypted cloud backup</span>
                      </li>
                      <li className="flex items-center gap-3 text-[#0c2224]">
                        <Check className="w-5 h-5 text-teal-600 flex-shrink-0" />
                        <span>No data sold to third parties</span>
                      </li>
                      <li className="flex items-center gap-3 text-[#0c2224]">
                        <Check className="w-5 h-5 text-teal-600 flex-shrink-0" />
                        <span>Content never used for AI training</span>
                      </li>
                      <li className="flex items-center gap-3 text-[#0c2224]">
                        <Check className="w-5 h-5 text-teal-600 flex-shrink-0" />
                        <span>GDPR & CCPA compliant</span>
                      </li>
                      <li className="flex items-center gap-3 text-[#0c2224]">
                        <Check className="w-5 h-5 text-teal-600 flex-shrink-0" />
                        <span>Full data export anytime</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section id="use-cases" className="px-6 py-24 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl lg:text-5xl font-bold mb-4">
                Who it&apos;s{' '}
                <span className="bg-gradient-to-r from-teal-600 to-teal-600 bg-clip-text text-transparent">
                  for
                </span>
              </h2>
              <p className="text-[#6b7d7e] text-lg max-w-2xl mx-auto">
                Pick the work you do and see exactly how IdiamPro fits it — from PhD dissertations to investigative journalism.
              </p>
            </div>

            <WhoItsFor useCases={useCases} />

            {/* Case Studies */}
            <div className="mt-16">
              <h3 className="text-2xl font-bold text-[#0c2224] text-center mb-8">What you could do</h3>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="p-6 rounded-2xl bg-gradient-to-br from-teal-600/10 to-teal-600/10 border border-teal-600/20">
                  <div className="text-3xl font-bold text-teal-600 mb-2">47 → 1</div>
                  <h4 className="text-[#0c2224] font-semibold mb-2">Literature Review Synthesis</h4>
                  <p className="text-[#6b7d7e] text-sm mb-4">
                    Imagine importing 47 research papers on computational biology — IdiamPro synthesizes them into a coherent literature review organized by methodology, findings, and gaps.
                  </p>
                  <div className="text-teal-600 text-xs font-medium">Example scenario • Computational Biology</div>
                </div>

                <div className="p-6 rounded-2xl bg-gradient-to-br from-teal-600/10 to-teal-600/10 border border-teal-600/20">
                  <div className="text-3xl font-bold text-teal-600 mb-2">12 hrs → 30 min</div>
                  <h4 className="text-[#0c2224] font-semibold mb-2">Field Interview Analysis</h4>
                  <p className="text-[#6b7d7e] text-sm mb-4">
                    Imagine an R&D team recording 12 hours of stakeholder interviews across 3 sites — IdiamPro transcribes with speaker diarization and organizes insights by theme.
                  </p>
                  <div className="text-teal-600 text-xs font-medium">Example scenario • Industrial R&D</div>
                </div>

                <div className="p-6 rounded-2xl bg-gradient-to-br from-teal-600/10 to-teal-600/10 border border-teal-600/20">
                  <div className="text-3xl font-bold text-teal-600 mb-2">2,400 docs</div>
                  <h4 className="text-[#0c2224] font-semibold mb-2">Legal Discovery</h4>
                  <p className="text-[#6b7d7e] text-sm mb-4">
                    Imagine a litigation team processing 2,400 discovery documents including depositions, contracts, and communications — IdiamPro organizes evidence by timeline and relevance.
                  </p>
                  <div className="text-teal-600 text-xs font-medium">Example scenario • Legal Discovery</div>
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
            <p className="text-[#6b7d7e] text-lg mb-6 max-w-2xl mx-auto">
              One subscription, all platforms. Your second brain syncs seamlessly across every device.
            </p>
            <p className="text-teal-600/80 text-sm mb-12 max-w-xl mx-auto">
              Apple prototypes available now. Windows, Linux, and Android coming at launch.
            </p>

            {/* Desktop Platforms */}
            <div className="mb-12">
              <h3 className="text-[#6b7d7e] text-sm uppercase tracking-wider mb-6">Desktop</h3>
              <div className="flex flex-wrap justify-center items-center gap-6 lg:gap-10">
                <div className="text-center group">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-600/20 to-teal-600/10 border border-teal-600/30 flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-all">
                    <Monitor className="w-10 h-10 text-teal-600" />
                  </div>
                  <div className="text-[#0c2224] font-medium">macOS</div>
                  <div className="text-teal-600 text-xs">Available Now</div>
                </div>
                <div className="text-center group">
                  <div className="w-20 h-20 rounded-2xl bg-[#f4faf9] border border-[#d3e6e4] flex items-center justify-center mx-auto mb-4 group-hover:bg-[#eef6f5] transition-all">
                    <Laptop className="w-10 h-10 text-teal-600" />
                  </div>
                  <div className="text-[#0c2224] font-medium">Windows</div>
                  <div className="text-[#6b7d7e] text-xs">Coming Soon</div>
                </div>
                <div className="text-center group">
                  <div className="w-20 h-20 rounded-2xl bg-[#f4faf9] border border-[#d3e6e4] flex items-center justify-center mx-auto mb-4 group-hover:bg-[#eef6f5] transition-all">
                    <Code2 className="w-10 h-10 text-teal-600" />
                  </div>
                  <div className="text-[#0c2224] font-medium">Linux</div>
                  <div className="text-[#6b7d7e] text-xs">Coming Soon</div>
                </div>
              </div>
            </div>

            {/* Mobile & Tablet Platforms */}
            <div className="mb-12">
              <h3 className="text-[#6b7d7e] text-sm uppercase tracking-wider mb-6">Mobile & Tablet</h3>
              <div className="flex flex-wrap justify-center items-center gap-6 lg:gap-10">
                <div className="text-center group">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-600/20 to-teal-600/10 border border-teal-600/30 flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-all">
                    <Smartphone className="w-10 h-10 text-teal-600" />
                  </div>
                  <div className="text-[#0c2224] font-medium">iOS</div>
                  <div className="text-teal-600 text-xs">Beta Available</div>
                </div>
                <div className="text-center group">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-600/20 to-teal-600/10 border border-teal-600/30 flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-all">
                    <Presentation className="w-10 h-10 text-teal-600" />
                  </div>
                  <div className="text-[#0c2224] font-medium">iPad</div>
                  <div className="text-teal-600 text-xs">Beta Available</div>
                </div>
                <div className="text-center group">
                  <div className="w-20 h-20 rounded-2xl bg-[#f4faf9] border border-[#d3e6e4] flex items-center justify-center mx-auto mb-4 group-hover:bg-[#eef6f5] transition-all">
                    <Smartphone className="w-10 h-10 text-teal-600" />
                  </div>
                  <div className="text-[#0c2224] font-medium">Android</div>
                  <div className="text-[#6b7d7e] text-xs">Coming Soon</div>
                </div>
              </div>
            </div>

            {/* Web */}
            <div>
              <h3 className="text-[#6b7d7e] text-sm uppercase tracking-wider mb-6">Web</h3>
              <div className="flex justify-center">
                <div className="text-center group">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-600/20 to-teal-600/10 border border-teal-600/30 flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-all">
                    <Globe className="w-10 h-10 text-teal-600" />
                  </div>
                  <div className="text-[#0c2224] font-medium">Web App</div>
                  <div className="text-teal-600 text-xs">Available Now</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Plan Benefits — the "why" behind each plan (complements the comparison grid's "what") */}
        <section className="px-6 pt-24 pb-8 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-14">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-600/20 border border-teal-600/30 mb-6">
                <Star className="w-4 h-4 text-teal-600" />
                <span className="text-sm font-medium text-teal-600">Why each plan wins</span>
              </div>
              <h2 className="text-3xl lg:text-5xl font-bold mb-4">
                <span className="bg-gradient-to-r from-[#0c2224] to-[#0c2224] bg-clip-text text-transparent">
                  Pick the advantage that{' '}
                </span>
                <span className="bg-gradient-to-r from-teal-600 to-teal-600 bg-clip-text text-transparent">
                  matters most to you
                </span>
              </h2>
              <p className="text-[#6b7d7e] text-lg max-w-2xl mx-auto mt-4">
                Every plan leads with a standout benefit. Here&apos;s the one reason each is worth it.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Own it — privacy + no subscription */}
              <div className="relative group flex flex-col p-8 rounded-3xl bg-gradient-to-br from-teal-600/15 via-teal-600/10 to-teal-600/10 border border-teal-600/30 hover:border-teal-600/50 transition-all duration-300">
                <div className="flex items-center justify-between mb-5">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center shadow-lg shadow-teal-600/30">
                    <Lock className="w-7 h-7 text-white" />
                  </div>
                  <span className="inline-flex items-center rounded-full border border-[#d3e6e4] bg-[#f4faf9] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#47585a]">
                    Coming soon
                  </span>
                </div>
                <div className="text-xs font-semibold uppercase tracking-wider text-teal-600 mb-1">
                  Own it
                </div>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-2xl font-bold text-[#0c2224]">$29.99</span>
                  <span className="text-[#6b7d7e] text-sm">once</span>
                  <span className="inline-flex items-center rounded-full border border-teal-600/40 bg-teal-600/10 px-2 py-0.5 text-[10px] font-medium text-teal-600">
                    $19.99 founder launch
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-[#0c2224] mb-3 leading-tight">
                  Buy once. Own it forever.
                </h3>
                <p className="text-[#47585a] leading-relaxed">
                  No subscription — ever. The AI runs on your own device, so{' '}
                  <span className="text-[#0c2224] font-semibold">your notes never leave it</span>. Total privacy, works fully offline, everyday AI included.
                </p>
              </div>

              {/* Bring your own key — unlimited, free */}
              <div className="relative group flex flex-col p-8 rounded-3xl bg-gradient-to-br from-teal-600/20 via-teal-600/10 to-teal-600/20 border border-teal-600/40 shadow-xl shadow-teal-600/10 hover:border-teal-600/60 transition-all duration-300">
                <div className="flex items-center justify-between mb-5">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center shadow-lg shadow-teal-600/30">
                    <Zap className="w-7 h-7 text-white" />
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-[#0E7C7B] to-[#0E7C7B] text-white font-semibold">
                    Most popular
                  </span>
                </div>
                <div className="text-xs font-semibold uppercase tracking-wider text-teal-600 mb-1">
                  Bring your own key
                </div>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-2xl font-bold text-[#0c2224]">Free</span>
                  <span className="text-[#6b7d7e] text-sm">forever</span>
                </div>
                <h3 className="text-2xl font-bold text-[#0c2224] mb-3 leading-tight">
                  Unlimited AI, free forever.
                </h3>
                <p className="text-[#47585a] leading-relaxed">
                  Plug in your own Gemini or OpenAI key and use AI without limits — at zero cost to you.{' '}
                  <span className="text-[#0c2224] font-semibold">Your provider, your account — we never see your data.</span>
                </p>
              </div>

              {/* Pro — cloud superpowers */}
              <div className="relative group flex flex-col p-8 rounded-3xl bg-gradient-to-br from-teal-600/15 via-teal-600/10 to-teal-600/10 border border-teal-600/30 hover:border-teal-600/50 transition-all duration-300">
                <div className="mb-5">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center shadow-lg shadow-teal-600/30">
                    <Rocket className="w-7 h-7 text-white" />
                  </div>
                </div>
                <div className="text-xs font-semibold uppercase tracking-wider text-teal-600 mb-1">
                  Pro
                </div>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-2xl font-bold text-[#0c2224]">$9.99</span>
                  <span className="text-[#6b7d7e] text-sm">/ month</span>
                </div>
                <h3 className="text-2xl font-bold text-[#0c2224] mb-3 leading-tight">
                  Cloud superpowers.
                </h3>
                <p className="text-[#47585a] leading-relaxed">
                  The heavy features that need premium cloud AI: Refresh from Web with citations, multi-source Research &amp; Import, AI outline Transform, podcast and image generation, and answers drawn from your whole knowledge base — on frontier models with higher limits and priority.
                </p>
                <p className="text-[#6b7d7e] text-xs mt-3">
                  Video generation coming in v1.1.
                </p>
              </div>
            </div>

            {/* Free trial callout */}
            <div className="mt-6 flex justify-center">
              <div className="inline-flex items-center gap-3 rounded-2xl border border-[#d3e6e4] bg-[#f4faf9] px-6 py-4 text-center">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center flex-shrink-0">
                  <Play className="w-5 h-5 text-white" />
                </div>
                <p className="text-[#47585a] text-sm sm:text-base">
                  <span className="text-[#0c2224] font-semibold">Try it free</span> — the full app with a taste of AI. No card required.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="px-6 py-24 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-5xl font-bold mb-4">
                Simple, transparent{' '}
                <span className="bg-gradient-to-r from-teal-600 to-teal-600 bg-clip-text text-transparent">
                  pricing
                </span>
              </h2>
              <p className="text-[#6b7d7e] text-lg max-w-2xl mx-auto">
                Start free, upgrade when you need more. No hidden fees.
              </p>
              <div className="mt-6 flex justify-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-teal-600/30 bg-gradient-to-r from-teal-600/10 to-teal-600/10 px-5 py-2.5 text-sm font-medium text-[#0c2224]">
                  <Check className="w-4 h-4 text-teal-600 flex-shrink-0" />
                  Bring your own AI key and get unlimited AI, free forever — you
                  pay your provider directly, we take nothing.
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
              <PricingCard
                name="Free"
                price="$0"
                highlighted={true}
                badge="Free forever"
                description="Unlimited AI, free forever — bring your own key. You pay your provider directly; we take nothing."
                features={[
                  'Unlimited outlines',
                  'All core outliner features',
                  'Bring your own AI key (Gemini, OpenAI, Anthropic, Mistral, Groq, or local Ollama)',
                  'Unlimited AI generations (your key, your cost)',
                  'All export formats',
                  'Multi-platform (Mac, iPhone, web)'
                ]}
                cta="Get Started"
              />
              <PricingCard
                name="Student"
                price="$4.99"
                description="For students — 50% off. Requires student verification."
                features={[
                  'Everything in Free',
                  'AI included — no API key needed',
                  '200 AI generations / month',
                  'Live web refresh (citations)',
                  '20-language translation',
                  'Email support'
                ]}
                cta="Get Started"
              />
              <PricingCard
                name="Pro"
                price="$9.99"
                description="$89/year (save 25%). For knowledge workers and teams getting started."
                features={[
                  'Everything in Student',
                  '1,000 AI generations / month',
                  'Podcast generation',
                  'Image generation & description',
                  'Priority support',
                  'Team collaboration (coming soon)'
                ]}
                cta="Get Started"
              />
            </div>

            <p className="text-center text-[#6b7d7e] text-sm mt-8">
              All plans include a 14-day free trial. Cancel anytime.
            </p>

            {/* Comparison grid — 4-option split */}
            <div className="mt-20">
              <h3 className="text-center text-2xl lg:text-3xl font-bold mb-2">
                Compare what you get
              </h3>
              <p className="text-center text-[#6b7d7e] text-sm mb-8">
                Four ways to use IdiamPro. Pick the one that fits how you work.
              </p>
              <div className="overflow-x-auto rounded-3xl border border-[#d3e6e4] bg-[#f4faf9]">
                <table className="w-full min-w-[820px] text-sm text-[#0c2224] border-collapse">
                  <thead>
                    <tr className="align-top">
                      <th className="p-4 text-left font-medium text-[#6b7d7e] w-[26%]">
                        <span className="text-xs uppercase tracking-wide">Feature</span>
                      </th>
                      <th className="p-4 text-left align-top border-l border-[#d3e6e4]">
                        <div className="text-[#0c2224] font-semibold text-base">Free trial</div>
                        <div className="text-[#6b7d7e] text-xs mt-1">Try it, 25 AI uses</div>
                        <div className="mt-2 text-[#0c2224] font-bold">$0</div>
                      </th>
                      <th className="p-4 text-left align-top border-l border-[#d3e6e4] bg-[#f4faf9]">
                        <div className="text-[#0c2224] font-semibold text-base">Own it</div>
                        <div className="text-[#6b7d7e] text-xs mt-1">Runs on your device &amp; your own key</div>
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <span className="text-[#0c2224] font-bold">$29.99</span>
                          <span className="inline-flex items-center rounded-full border border-teal-600/40 bg-teal-600/10 px-2 py-0.5 text-[10px] font-medium text-teal-600">
                            $19.99 founder launch
                          </span>
                        </div>
                        <span className="mt-2 inline-flex items-center rounded-full border border-[#d3e6e4] bg-[#f4faf9] px-2.5 py-0.5 text-[10px] font-medium text-[#47585a]">
                          Coming soon
                        </span>
                      </th>
                      <th className="p-4 text-left align-top border-l border-[#d3e6e4] bg-gradient-to-b from-teal-600/15 to-teal-600/10">
                        <div className="text-[#0c2224] font-semibold text-base">Pro</div>
                        <div className="text-[#6b7d7e] text-xs mt-1">Premium cloud AI</div>
                        <div className="mt-2 text-[#0c2224] font-bold">
                          $9.99<span className="text-[#6b7d7e] font-normal text-xs">/mo</span>
                          <span className="text-[#6b7d7e] font-normal text-xs"> · $89/yr</span>
                        </div>
                      </th>
                      <th className="p-4 text-left align-top border-l border-[#d3e6e4]">
                        <div className="text-[#0c2224] font-semibold text-base">BYOK</div>
                        <div className="text-[#6b7d7e] text-xs mt-1">Your key, unlimited</div>
                        <div className="mt-2 text-[#0c2224] font-bold">Free</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#d3e6e4]">
                    {[
                      {
                        label: 'Core outlining',
                        sub: 'Unlimited outlines, drag-drop, tags & colors, search, export/share, backups, data protection',
                        cells: [<Check key="c" className="w-4 h-4 text-teal-600" />, <Check key="c" className="w-4 h-4 text-teal-600" />, <Check key="c" className="w-4 h-4 text-teal-600" />, <Check key="c" className="w-4 h-4 text-teal-600" />],
                      },
                      {
                        label: 'Everyday AI',
                        sub: 'Generate from a topic, reformat, translate, suggest tags, describe images, quick commands, Help chat',
                        cells: ['25 total', <Check key="c" className="w-4 h-4 text-teal-600" />, <Check key="c" className="w-4 h-4 text-teal-600" />, <Check key="c" className="w-4 h-4 text-teal-600" />],
                      },
                      {
                        label: 'On-device / private AI',
                        sub: 'Notes never leave your device',
                        cells: ['—', <Check key="c" className="w-4 h-4 text-teal-600" />, <Check key="c" className="w-4 h-4 text-teal-600" />, <Check key="c" className="w-4 h-4 text-teal-600" />],
                      },
                      {
                        label: 'Pro superpowers',
                        sub: 'Refresh from Web + citations, Research & Import, Transform Outline, query your evolving knowledge base at scale, Podcast, Image generation, frontier cloud models',
                        cells: ['—', '—', <Check key="c" className="w-4 h-4 text-teal-600" />, '✓ with your key'],
                      },
                      {
                        label: 'Video / YouTube package',
                        sub: 'Turn outlines into video scripts and clips',
                        cells: ['—', '—', 'Coming soon (v1.1)', 'Coming soon'],
                      },
                      {
                        label: 'Generation caps / priority',
                        sub: 'How much AI you can run',
                        cells: ['25 total', 'Local / your key', 'High / unlimited + priority', 'Unlimited (your key)'],
                      },
                      {
                        label: 'Privacy',
                        sub: 'Where your data goes',
                        cells: ['Cloud trial', 'Stays on your device', 'Premium cloud, not trained on your data', 'Your provider, we never see it'],
                      },
                    ].map((row, ri) => (
                      <tr key={ri} className="align-top">
                        <td className="p-4 min-h-[44px]">
                          <div className="text-[#0c2224] font-medium">{row.label}</div>
                          <div className="text-[#6b7d7e] text-xs mt-1 leading-relaxed">{row.sub}</div>
                        </td>
                        {row.cells.map((cell, ci) => (
                          <td
                            key={ci}
                            className={`p-4 border-l border-[#d3e6e4] align-middle ${ci === 1 ? 'bg-[#f4faf9]' : ''} ${ci === 2 ? 'bg-teal-600/[0.06]' : ''}`}
                          >
                            {typeof cell === 'string' ? (
                              <span className={cell === '—' ? 'text-[#8b9a9b]' : 'text-[#0c2224]'}>{cell}</span>
                            ) : (
                              cell
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-center text-[#6b7d7e] text-xs mt-4">
                &ldquo;Own it&rdquo; one-time purchase is coming soon — join the free trial or Pro today.
              </p>
            </div>

            {/* Academic & Student Pricing Callout */}
            <div className="mt-12 p-8 rounded-3xl bg-gradient-to-r from-teal-600/10 via-teal-600/10 to-teal-600/10 border border-teal-600/20">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center shadow-lg">
                    <GraduationCap className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#0c2224]">Academic & Student Pricing</h3>
                    <p className="text-[#47585a]">50% off for students and educators with valid .edu email</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[#0c2224]">$4.99<span className="text-[#6b7d7e] text-sm">/mo</span></div>
                    <div className="text-xs text-teal-600">Basic Plan</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[#0c2224]">$14.99<span className="text-[#6b7d7e] text-sm">/mo</span></div>
                    <div className="text-xs text-teal-600">Premium Plan</div>
                  </div>
                  <Button
                    onClick={launchApp}
                    className="bg-gradient-to-r from-[#0E7C7B] to-[#0E7C7B] hover:from-[#0c5c5b] hover:to-[#0c5c5b] text-white font-semibold"
                  >
                    Verify .edu
                  </Button>
                </div>
              </div>
            </div>

            {/* Beta Testers Callout */}
            <div className="mt-12 p-8 lg:p-10 rounded-3xl bg-gradient-to-br from-teal-600/20 via-teal-600/10 to-teal-600/20 border border-teal-600/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-teal-600/20 rounded-full blur-3xl -tranteal-y-1/2 tranteal-x-1/2" />
              <div className="relative flex flex-col lg:flex-row items-center justify-between gap-8">
                <div className="flex items-start gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center shadow-lg shadow-teal-600/30 flex-shrink-0">
                    <Rocket className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-600/20 border border-teal-600/30 text-teal-600 text-xs font-medium mb-3">
                      <Sparkles className="w-3 h-3" />
                      Limited Spots Available
                    </div>
                    <h3 className="text-2xl font-bold text-[#0c2224] mb-2">Join Our Beta Program</h3>
                    <p className="text-[#47585a] max-w-xl">
                      Be among the first to experience IdiamPro. Beta testers get <span className="text-teal-600 font-semibold">free lifetime access to Pro features</span>,
                      direct input into our roadmap, and priority support. Help us build the ultimate cognitive enhancement platform.
                    </p>
                    <div className="flex flex-wrap gap-3 mt-4">
                      <span className="px-3 py-1 rounded-full bg-[#f4faf9] text-[#47585a] text-xs">Free Pro Access</span>
                      <span className="px-3 py-1 rounded-full bg-[#f4faf9] text-[#47585a] text-xs">Shape the Product</span>
                      <span className="px-3 py-1 rounded-full bg-[#f4faf9] text-[#47585a] text-xs">Priority Support</span>
                      <span className="px-3 py-1 rounded-full bg-[#f4faf9] text-[#47585a] text-xs">Early Feature Access</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-3">
                  <Button
                    onClick={() => window.location.href = 'mailto:beta@idiampro.com?subject=Beta Tester Application'}
                    size="lg"
                    className="bg-gradient-to-r from-[#0E7C7B] to-[#0E7C7B] hover:from-[#0c5c5b] hover:to-[#0c5c5b] text-white shadow-lg shadow-teal-600/25 whitespace-nowrap"
                  >
                    Apply for Beta
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                  <span className="text-[#6b7d7e] text-xs">Web version available now</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="px-6 py-24 lg:px-12">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-5xl font-bold mb-4">
                Frequently asked{' '}
                <span className="bg-gradient-to-r from-teal-600 to-teal-600 bg-clip-text text-transparent">
                  questions
                </span>
              </h2>
            </div>

            <div className="bg-[#f4faf9] rounded-2xl border border-[#d3e6e4] p-6 lg:p-8">
              {faqs.map((faq, i) => (
                <FAQItem key={i} {...faq} />
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-6 py-24 lg:px-12">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl lg:text-5xl font-bold mb-6">
              Ready to transform how you{' '}
              <span className="bg-gradient-to-r from-teal-600 to-teal-600 bg-clip-text text-transparent">
                think and create?
              </span>
            </h2>
            <p className="text-[#6b7d7e] text-lg mb-8 max-w-2xl mx-auto">
              Join researchers, authors, and professionals who've upgraded their workflow with IdiamPro.
            </p>
            <Button
              onClick={launchApp}
              size="lg"
              className="bg-gradient-to-r from-[#0E7C7B] to-[#0E7C7B] hover:from-[#0c5c5b] hover:to-[#0c5c5b] text-white font-semibold text-lg px-10 py-6 shadow-xl shadow-teal-600/25 hover:shadow-teal-600/40 transition-all duration-300"
            >
              Sign up to try IdiamPro
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <p className="text-[#8b9a9b] text-sm mt-4">
              No credit card required. Free tier forever.
            </p>
          </div>
        </section>

        {/* Footnotes */}
        <section className="px-6 py-8 lg:px-12">
          <div className="max-w-4xl mx-auto">
            <div className="border-t border-[#d3e6e4] pt-8">
              <h4 className="text-[#6b7d7e] text-xs uppercase tracking-wider mb-4">Performance Notes</h4>
              <div className="text-[#8b9a9b] text-xs space-y-2">
                <p>
                  <strong className="text-[#6b7d7e]">*Node Capacity Testing:</strong> 1,000,000+ nodes tested on Apple M4 MacBook Air
                  (16GB RAM, 512GB SSD) running macOS. Generation time: 4.2s, save time: 1.8s, load time: 1.3s,
                  file size: 98MB. Performance varies by hardware configuration.
                </p>
                <p>
                  <strong className="text-[#6b7d7e]">Platform Considerations:</strong>
                </p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li><strong>Desktop (macOS/Windows/Linux):</strong> Full system RAM available. Recommended for outlines exceeding 100,000 nodes.</li>
                  <li><strong>Web Browser:</strong> Limited to browser memory allocation (typically 2-4GB). Chrome/Edge perform best. Recommended limit: 200,000 nodes.</li>
                  <li><strong>Mobile (iOS/Android):</strong> More constrained memory. For optimal performance, keep outlines under 50,000 nodes.</li>
                </ul>
                <p>
                  <strong className="text-[#6b7d7e]">Storage:</strong> Outline files (.idm) are JSON-based. A 100,000-node outline is approximately 20MB.
                  Local storage has no practical limit; web browser IndexedDB supports gigabytes of storage.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-6 py-12 lg:px-12 border-t border-[#d3e6e4]">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8 mb-12">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center">
                    <Brain className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-bold text-[#0c2224]">IdiamPro</span>
                </div>
                <p className="text-[#6b7d7e] text-sm mb-2">
                  Your Intelligence Amplifier.
                </p>
                <p className="text-[#8b9a9b] text-xs">
                  Build your second brain. Expand your knowledge. See what others miss.
                </p>
              </div>

              <div>
                <h4 className="text-[#0c2224] font-semibold mb-4">Product</h4>
                <ul className="space-y-2">
                  <li><a href="#features" className="text-[#6b7d7e] hover:text-[#0c2224] text-sm transition-colors">Features</a></li>
                  <li><a href="#pricing" className="text-[#6b7d7e] hover:text-[#0c2224] text-sm transition-colors">Pricing</a></li>
                  <li><a href="#use-cases" className="text-[#6b7d7e] hover:text-[#0c2224] text-sm transition-colors">Use Cases</a></li>
                  <li><a href="#faq" className="text-[#6b7d7e] hover:text-[#0c2224] text-sm transition-colors">FAQ</a></li>
                </ul>
              </div>

              <div>
                <h4 className="text-[#0c2224] font-semibold mb-4">Legal</h4>
                <ul className="space-y-2">
                  <li><a href="/privacy" className="text-[#6b7d7e] hover:text-[#0c2224] text-sm transition-colors">Privacy</a></li>
                </ul>
              </div>
            </div>

            <div className="pt-8 border-t border-[#d3e6e4]">
              <p className="text-[#8b9a9b] text-sm">
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
