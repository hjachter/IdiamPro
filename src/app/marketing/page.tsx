'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  Brain,
  Layers,
  Zap,
  FileText,
  Image as ImageIcon,
  Table,
  Mic,
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
  RotateCcw,
  Tags,
  Palette,
  Focus,
  ListOrdered,
  ExternalLink,
  Menu,
  X,
  Podcast,
  FileAudio,
  SpeakerIcon,
  Volume2,
  BarChart3
} from 'lucide-react';
import WebsitePreviewCarousel from '@/components/website-preview-carousel';

// ============================================
// CONFIGURATION
// ============================================

// Launch date: April 1, 2026
const LAUNCH_DATE = new Date('2026-04-01T00:00:00');

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
      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center mb-2">
        <span className="text-2xl sm:text-3xl font-bold text-white">{value.toString().padStart(2, '0')}</span>
      </div>
      <span className="text-xs sm:text-sm text-white/50 uppercase tracking-wider">{label}</span>
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
      className="group relative p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10
        hover:bg-white/10 hover:border-white/20 transition-all duration-500 hover:scale-[1.02] hover:-translate-y-1"
    >
      <div className={`w-12 h-12 rounded-xl ${gradient} flex items-center justify-center mb-4
        group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-white/60 text-sm leading-relaxed">{description}</p>
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
        ? 'bg-gradient-to-b from-violet-500/20 to-indigo-500/20 border-violet-500/40 shadow-xl shadow-violet-500/10'
        : 'bg-white/5 border-white/10 hover:border-white/20'
      }`}
    >
      {badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="px-4 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-violet-500 to-indigo-500 text-white">
            {badge}
          </span>
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-xl font-bold text-white mb-2">{name}</h3>
        <p className="text-white/50 text-sm">{description}</p>
      </div>

      <div className="mb-6">
        <span className="text-4xl font-bold text-white">{price}</span>
        {period && <span className="text-white/50 ml-1">{period}</span>}
      </div>

      <ul className="space-y-3 mb-8">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-3 text-sm">
            <Check className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5" />
            <span className="text-white/70">{feature}</span>
          </li>
        ))}
      </ul>

      <Button
        onClick={() => {
          console.log('PricingCard button clicked');
          window.location.href = '/app';
        }}
        className={`w-full ${highlighted
          ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg'
          : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
        }`}
      >
        {cta}
      </Button>
    </div>
  );
}

// Use case card
function UseCaseCard({
  icon: Icon,
  title,
  subtitle,
  description,
  gradient,
  examples
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  description: string;
  gradient: string;
  examples?: { text: string; comingSoon?: boolean }[];
}) {
  const [showHow, setShowHow] = useState(false);

  return (
    <div className="group p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10
      hover:border-white/20 transition-all duration-300">
      <div className={`w-14 h-14 rounded-xl ${gradient} flex items-center justify-center mb-4
        group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
        <Icon className="w-7 h-7 text-white" />
      </div>
      <div className="text-xs text-violet-400 font-medium uppercase tracking-wider mb-1">{subtitle}</div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-white/50 text-sm leading-relaxed">{description}</p>

      {examples && examples.length > 0 && (
        <div className="mt-4 border-t border-white/10 pt-3">
          <button
            type="button"
            onClick={() => setShowHow(!showHow)}
            aria-expanded={showHow}
            className="w-full flex items-center justify-between text-left rounded-lg
              -mx-1 px-1 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
          >
            <span className="text-sm font-medium text-violet-300">See how it works</span>
            <ChevronDown className={`w-4 h-4 text-white/40 transition-transform duration-300 flex-shrink-0
              ${showHow ? 'rotate-180' : ''}`}
            />
          </button>
          <div className={`overflow-hidden transition-all duration-300
            ${showHow ? 'max-h-[28rem] pt-3' : 'max-h-0'}`}>
            <ul className="space-y-2">
              {examples.map((ex, idx) => (
                <li key={idx} className="flex gap-2 text-white/60 text-sm leading-relaxed">
                  <span className="text-violet-400 mt-0.5 flex-shrink-0">›</span>
                  <span>
                    {ex.text}
                    {ex.comingSoon && (
                      <span className="ml-2 inline-block align-middle text-[10px] font-semibold
                        uppercase tracking-wider text-amber-300 bg-amber-400/10 border border-amber-400/20
                        rounded px-1.5 py-0.5">
                        Coming soon
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// FAQ Item
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-white/10 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-5 flex items-center justify-between text-left"
      >
        <span className="text-white font-medium pr-8">{question}</span>
        <ChevronDown className={`w-5 h-5 text-white/50 transition-transform duration-300 flex-shrink-0
          ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-96 pb-5' : 'max-h-0'}`}>
        <p className="text-white/60 text-sm leading-relaxed">{answer}</p>
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
          className="absolute w-1 h-1 bg-white/20 rounded-full animate-float"
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

// Testimonial card
function TestimonialCard({
  quote,
  author,
  role,
  avatar
}: {
  quote: string;
  author: string;
  role: string;
  avatar?: string;
}) {
  return (
    <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
      <div className="flex gap-1 mb-4">
        {[...Array(5)].map((_, i) => (
          <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
        ))}
      </div>
      <p className="text-white/80 text-sm leading-relaxed mb-4">"{quote}"</p>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white font-semibold">
          {author.charAt(0)}
        </div>
        <div>
          <div className="text-white font-medium text-sm">{author}</div>
          <div className="text-white/50 text-xs">{role}</div>
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

  // Navigate to the app
  const launchApp = () => {
    console.log('launchApp called');
    window.location.href = '/app';
  };

  // Data
  const allFeatures = [
    { icon: Brain, title: 'AI Content Generation', description: 'Generate content for any node with one click' },
    { icon: ImageIcon, title: 'AI Image Creation', description: 'Create custom illustrations with Google Imagen 3' },
    { icon: Table, title: 'Inline Spreadsheets', description: 'Full Excel-like spreadsheets embedded in your outline' },
    { icon: Mic, title: 'Voice Dictation', description: 'Speak your thoughts with speech-to-text' },
    { icon: Network, title: 'Auto Diagrams', description: 'Generate mind maps and flowcharts from any branch' },
    { icon: Youtube, title: 'Video Embedding', description: 'Embed YouTube, Vimeo, and other video players' },
    { icon: Tags, title: 'Tags & Colors', description: '8 colors and unlimited tags for organization' },
    { icon: Focus, title: 'Focus Mode', description: 'Isolate a branch for distraction-free work' },
    { icon: ListOrdered, title: 'Auto Numbering', description: 'Hierarchical prefixes (1.2.3 style)' },
    { icon: Search, title: 'Full-Text Search', description: 'Search across all outlines and content' },
    { icon: Download, title: 'Multi-Format Export', description: 'PDF, Markdown, HTML, OPML, Obsidian, and more' }
  ];

  const useCases = [
    {
      icon: Scale,
      title: 'Trial Prep',
      subtitle: 'Attorneys & Paralegals',
      description: 'Upload 200 pages of medical records, expert reports, and prior testimony. SecondBrainWare builds a chronological timeline, flags contradictions between sources, and produces a one-page list of questions to ask the witness. Three days of paralegal work — done in twenty minutes.',
      gradient: 'bg-gradient-to-br from-slate-500 to-gray-600',
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
      description: 'Drop fifty research papers into one outline. SecondBrainWare groups them by methodology, summarizes each finding in plain English, and shows where the field agrees and where it\'s still fighting. You arrive at the writing stage already knowing the structure of your argument.',
      gradient: 'bg-gradient-to-br from-blue-500 to-cyan-600',
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
      description: 'Import interview transcripts, archival research, and your own notes. SecondBrainWare drafts chapter outlines from your source material, suggests where each anecdote fits the narrative, and flags chapters where you\'re thin on evidence — so you know what to research next.',
      gradient: 'bg-gradient-to-br from-amber-500 to-orange-600',
      examples: [
        { text: 'Give it your premise in one sentence and get a full chapter-by-chapter book outline to react to instead of staring at page one.' },
        { text: 'Record your subject interviews and get a clean transcript with speakers named — quotes ready to drop into the manuscript.' },
        { text: 'Expand a thin section with AI drafting in your structure, then rewrite it in your own voice — the scaffolding is already there.' },
        { text: 'Capture stray ideas and clippings to your Second Brain; smart auto-tagging files them so the right note resurfaces at the right chapter.' },
        { text: 'Export the finished draft to a manuscript-ready Word doc or an EPUB ebook — one of 30+ formats, no copy-paste cleanup.' }
      ]
    },
    {
      icon: Lightbulb,
      title: 'Client Engagements',
      subtitle: 'Consultants & Analysts',
      description: 'Combine client emails, stakeholder interviews, and competitive research into one outline. SecondBrainWare produces a slide-deck outline organized by client priority, with every claim traceable back to the email, transcript, or report that supports it.',
      gradient: 'bg-gradient-to-br from-emerald-500 to-teal-600',
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
      description: 'Paste a link to a 90-minute lecture. SecondBrainWare transcribes it, organizes the content by topic with timestamps, and turns it into a study guide. Then ask follow-up questions and get answers from the lecture itself — not generic web search.',
      gradient: 'bg-gradient-to-br from-red-500 to-rose-600',
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
      description: 'Import court records, leaked documents, and source interviews into a single secure outline. SecondBrainWare cross-references names, dates, and locations across sources to surface a coherent timeline. Every claim in your final story carries a click-through to the exact page that supports it.',
      gradient: 'bg-gradient-to-br from-violet-500 to-purple-600',
      examples: [
        { text: 'Record a source interview and get it transcribed with each speaker identified — the exact quote, attributed, without a second listen.' },
        { text: 'Import the FOIA PDFs, the leaked spreadsheet, and the hearing video transcript into one outline that ties names and dates together.' },
        { text: 'Ask the file "who knew about the contract before the vote?" and get an answer drawn only from your documents, with the source attached.' },
        { text: 'Run LIVE BOOKS on a developing story so your backgrounder reflects today\'s filings, with every change shown before you approve it.' },
        { text: 'Export the verified draft to your CMS format from 30+ options, every claim still traceable to the page that proves it.' }
      ]
    }
  ];

  const faqs = [
    {
      question: 'How is SecondBrainWare different from Notion or Obsidian?',
      answer: 'SecondBrainWare is purpose-built for research synthesis and content creation. Unlike general note-taking apps, we focus on importing multiple sources (YouTube, PDFs, audio) and using AI to synthesize them into structured outlines. Our multi-source analysis and speaker diarization features are unique to SecondBrainWare.'
    },
    {
      question: 'Can I import my existing notes?',
      answer: 'Yes! SecondBrainWare supports importing from Markdown, OPML, plain text, and JSON formats. You can also import content from PDFs, Word documents, web pages, and even YouTube videos with automatic transcription.'
    },
    {
      question: 'Is my data private and secure?',
      answer: 'Absolutely. SecondBrainWare uses a local-first architecture—your outlines are stored on your device by default. When you use AI features, your content is sent securely to process but is never used to train AI models. We never sell your data.'
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
      answer: 'SecondBrainWare offers 10+ export formats including PDF, Markdown, HTML, Plain Text, OPML, Obsidian (with wiki-links), CSV, and JSON Tree. Plus, you can export any outline as a professional Marketing Website with 8 templates (Marketing, Informational, Documentation, Portfolio, Event, Educational, Blog, Personal). Your data is never locked in.'
    }
  ];

  const testimonials = [
    {
      quote: 'I imported 47 research papers and SecondBrainWare synthesized them into a coherent literature review in minutes. What used to take months now takes an afternoon.',
      author: 'Dr. Sarah Chen',
      role: 'Postdoctoral Researcher, Computational Biology'
    },
    {
      quote: 'We recorded 12 hours of stakeholder interviews in the field. SecondBrainWare transcribed everything with perfect speaker identification and organized it by theme. Game changer for qualitative research.',
      author: 'Dr. Michael Torres',
      role: 'Principal Research Scientist, Industrial R&D'
    },
    {
      quote: 'For legal discovery, we process thousands of documents. SecondBrainWare synthesizes deposition transcripts, case files, and expert reports into structured briefs. It\'s become essential to our workflow.',
      author: 'Jennifer Walsh, JD',
      role: 'Senior Associate, Litigation Practice'
    }
  ];

  return (
    <div className="min-h-screen h-full bg-gray-950 text-white overflow-x-hidden overflow-y-auto">
      {/* Background gradients - pointer-events-none to allow clicks through */}
      <div className="fixed inset-0 bg-gradient-to-br from-violet-950 via-gray-950 to-indigo-950 pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/20 via-transparent to-transparent pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent pointer-events-none" />

      <ParticlesBackground />

      {/* Content */}
      <div className="relative z-10">
        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 lg:px-12 backdrop-blur-xl bg-gray-950/80 border-b border-white/5">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                <Layers className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
                SecondBrainWare
              </span>
            </div>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-white/60 hover:text-white transition-colors text-sm">Features</a>
              <a href="#use-cases" className="text-white/60 hover:text-white transition-colors text-sm">Use Cases</a>
              <a href="#pricing" className="text-white/60 hover:text-white transition-colors text-sm">Pricing</a>
              <a href="#faq" className="text-white/60 hover:text-white transition-colors text-sm">FAQ</a>
            </div>

            <div className="flex items-center gap-4">
              <Button
                onClick={launchApp}
                className="hidden md:inline-flex bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-500/25"
              >
                Launch App
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

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
            <div className="md:hidden absolute top-full left-0 right-0 bg-gray-950/95 backdrop-blur-xl border-b border-white/10 p-6">
              <div className="flex flex-col gap-4">
                <a href="#features" onClick={() => setMobileMenuOpen(false)} className="text-white/80 py-2">Features</a>
                <a href="#use-cases" onClick={() => setMobileMenuOpen(false)} className="text-white/80 py-2">Use Cases</a>
                <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="text-white/80 py-2">Pricing</a>
                <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="text-white/80 py-2">FAQ</a>
                <Button
                  onClick={launchApp}
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white w-full mt-2"
                >
                  Launch App
                </Button>
              </div>
            </div>
          )}
        </nav>

        {/* Hero Section */}
        <section className="px-6 pt-32 pb-16 lg:px-12 lg:pt-40">
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-4xl mx-auto">
              <div className={`${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/20 border border-violet-500/30 mb-6">
                  <Brain className="w-4 h-4 text-violet-400" />
                  <span className="text-sm text-violet-300">The Premier Idea Developer</span>
                </div>
                <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
                  <span className="block text-white">The Premier</span>
                  <span className="block bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">Idea Developer.</span>
                </h1>
                <p className="text-xl md:text-2xl text-white/70 mb-4 max-w-3xl mx-auto">
                  Any idea. Any team, anywhere. Any language. AI at every step.
                </p>
                <p className="text-base md:text-lg text-white/60 mb-8 max-w-3xl mx-auto leading-relaxed">
                  An outliner for students, researchers, and professionals — developing research papers, project plans, Second Brains, product designs, or whatever you&apos;re building. AI doesn&apos;t just answer questions: it generates outlines from your sources, refreshes them against live web data, translates them into 20 languages, even produces podcasts and illustrations.
                </p>
              {/* Decorative elements */}
              <div className="absolute top-4 left-4 flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
              </div>
            </div>
          </div>
        </div>
        </section>

        {/* Idea Incubator — lead concept section that frames the whole product */}
        <section className="px-6 pb-16 lg:px-12">
          <div className="max-w-5xl mx-auto">
            <div className="rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-indigo-500/10 p-8 md:p-12">
              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/20 border border-violet-500/30 mb-6">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                  <span className="text-sm font-medium text-violet-300">The Idea Incubator</span>
                </div>
                <h2 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">
                  <span className="bg-gradient-to-r from-white via-white to-white/80 bg-clip-text text-transparent">
                    An Idea Incubator is where raw thoughts grow into finished work.
                  </span>
                </h2>
                <p className="text-base md:text-lg text-white/70 leading-relaxed max-w-3xl mx-auto">
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
                    gradient: 'bg-gradient-to-br from-violet-500 to-purple-500',
                  },
                  {
                    icon: FolderTree,
                    label: 'Structure',
                    description: 'Watch chaos become an outline you can shape, expand, and rearrange.',
                    gradient: 'bg-gradient-to-br from-purple-500 to-indigo-500',
                  },
                  {
                    icon: Globe,
                    label: 'Enrich',
                    description: 'Refresh any part against the live web so your thinking never goes stale, and ask your own outlines questions.',
                    gradient: 'bg-gradient-to-br from-indigo-500 to-blue-500',
                  },
                  {
                    icon: Rocket,
                    label: 'Hatch',
                    description: 'When an idea is ready, generate the finished thing: a document, a script, a podcast, a content package.',
                    gradient: 'bg-gradient-to-br from-blue-500 to-cyan-500',
                  },
                ].map((stage, i) => {
                  const StageIcon = stage.icon;
                  return (
                    <div
                      key={stage.label}
                      className="relative p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/[0.07] hover:border-white/20 transition-all duration-300"
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-11 h-11 rounded-xl ${stage.gradient} flex items-center justify-center flex-shrink-0`}>
                          <StageIcon className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-xs font-semibold text-white/40">{`0${i + 1}`}</span>
                      </div>
                      <h3 className="text-lg font-bold text-white mb-2">{stage.label}</h3>
                      <p className="text-white/60 text-sm leading-relaxed">{stage.description}</p>
                    </div>
                  );
                })}
              </div>

              {/* Closing emphasized line */}
              <p className="text-center text-lg md:text-2xl font-semibold text-white mt-10 max-w-3xl mx-auto leading-snug">
                That&apos;s the difference between a filing cabinet and an incubator.{' '}
                <span className="bg-gradient-to-r from-violet-300 to-indigo-300 bg-clip-text text-transparent">
                  One stores your ideas. The other helps them grow up.
                </span>
              </p>
            </div>
          </div>
        </section>

        {/* Globally distributed teams — concrete-example block */}
        <section className="px-6 pb-16 lg:px-12">
          <div className="max-w-4xl mx-auto">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/5 to-indigo-500/5 p-8 md:p-10">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
                Built for globally distributed teams.
              </h2>
              <p className="text-base md:text-lg text-white/70 leading-relaxed">
                A research team in Boston, a partner lab in Shanghai, and a graduate student in São Paulo — all working in the same outline, each contributing in their native language. The structure stays in sync; the translations stay current; the conversation never stops.
              </p>
            </div>
          </div>
        </section>

        {/* Written AND multimedia — dual-output positioning */}
        <section className="px-6 pb-16 lg:px-12">
          <div className="max-w-4xl mx-auto">
            <div className="rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-500/5 via-amber-500/5 to-violet-500/5 p-8 md:p-10">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
                Written work and multimedia, from one outline.
              </h2>
              <p className="text-base md:text-lg text-white/70 leading-relaxed mb-4">
                IdiamPro is the idea developer for both written content and multimedia. Snap a whiteboard photo and watch it become a structured outline. Pick a branch and IdiamPro produces a complete YouTube content package — script, chapters, description, SEO, B-roll prompts. Multimedia in, multimedia out.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/70 text-xs">Books &amp; long-form</span>
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/70 text-xs">Articles &amp; reports</span>
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/70 text-xs">YouTube packages</span>
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/70 text-xs">Podcasts</span>
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/70 text-xs">Diagrams &amp; mind maps</span>
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/70 text-xs">Whiteboard capture</span>
              </div>
            </div>
          </div>
        </section>

        {/* Authors — primary target customer segment */}
        <section className="px-6 pb-16 lg:px-12">
          <div className="max-w-4xl mx-auto">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-amber-500/5 to-rose-500/5 p-8 md:p-10">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
                Built for people who write for a living.
              </h2>
              <p className="text-base md:text-lg text-white/70 leading-relaxed mb-5">
                Outlining is already core to your craft. IdiamPro pulls in your research, drafts inside your structure, and ships the finished work — manuscript, screenplay, article, or YouTube companion package.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-200 text-xs">Screenwriters</span>
                <span className="px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-200 text-xs">Novelists</span>
                <span className="px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-200 text-xs">Nonfiction authors</span>
                <span className="px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-200 text-xs">Technical writers</span>
                <span className="px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-200 text-xs">Journalists</span>
                <span className="px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-200 text-xs">Content marketers</span>
              </div>
            </div>
          </div>
        </section>


        {/* COGNITIVE ENHANCEMENT - Intelligence Amplifier Section */}
        <section className="px-6 py-20 lg:px-12 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-violet-500/5 via-transparent to-transparent" />
          <div className="max-w-7xl mx-auto relative">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 border border-emerald-500/30 mb-6">
                <Brain className="w-5 h-5 text-emerald-400" />
                <span className="text-sm font-medium text-emerald-300">Cognitive Enhancement Platform</span>
              </div>
              <h2 className="text-4xl lg:text-6xl font-bold mb-6">
                <span className="bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
                  Your Second Brain,
                </span>
                <br />
                <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
                  Amplified
                </span>
              </h2>
              <p className="text-xl text-white/60 max-w-3xl mx-auto leading-relaxed">
                SecondBrainWare is a true intelligence amplifier—it doesn&apos;t just store information, it enhances
                your cognitive capabilities. Build a knowledge repository that grows with you, surfaces hidden
                connections, and accelerates your thinking.
              </p>
            </div>

            {/* Three pillars of intelligence amplification */}
            <div className="grid md:grid-cols-3 gap-8">
              {/* Expanded Scope */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 to-purple-500/10 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-violet-500/30 transition-all duration-300 h-full">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mb-6 shadow-lg shadow-violet-500/30">
                    <Globe className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4">Expanded Knowledge Scope</h3>
                  <p className="text-white/60 leading-relaxed mb-4">
                    Your brain can only hold so much. SecondBrainWare becomes your external memory—capturing every source,
                    every insight, every connection you&apos;ve ever encountered. Access decades of accumulated
                    knowledge instantly.
                  </p>
                  <div className="flex items-center gap-2 text-violet-400 text-sm font-medium">
                    <span className="px-3 py-1 rounded-full bg-violet-500/20 border border-violet-500/30">
                      1,000,000+ nodes tested*
                    </span>
                  </div>
                </div>
              </div>

              {/* Speed of Access */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-teal-500/10 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-emerald-500/30 transition-all duration-300 h-full">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/30">
                    <Zap className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4">Accelerated Access</h3>
                  <p className="text-white/60 leading-relaxed mb-4">
                    Find what you need in seconds, not hours. Hierarchical outlines, AI-powered search, and smart
                    organization means your knowledge is always at your fingertips—ready when you need it.
                  </p>
                  <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                      Instant retrieval
                    </span>
                  </div>
                </div>
              </div>

              {/* Pattern Recognition */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-orange-500/10 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-amber-500/30 transition-all duration-300 h-full">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mb-6 shadow-lg shadow-amber-500/30">
                    <Network className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4">Hidden Connections</h3>
                  <p className="text-white/60 leading-relaxed mb-4">
                    See what others miss. The hierarchical structure reveals complex interrelationships between ideas,
                    surfaces creative possibilities, and helps you synthesize insights that would otherwise remain hidden.
                  </p>
                  <div className="flex items-center gap-2 text-amber-400 text-sm font-medium">
                    <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30">
                      Pattern recognition
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Cognitive Enhancement Quote */}
            <div className="mt-16 p-8 lg:p-12 rounded-3xl bg-gradient-to-br from-white/5 to-white/0 border border-white/10 text-center">
              <Quote className="w-12 h-12 text-violet-400/50 mx-auto mb-6" />
              <blockquote className="text-2xl lg:text-3xl font-light text-white/90 italic max-w-4xl mx-auto leading-relaxed">
                &ldquo;The difference between experts and novices isn&apos;t just what they know—it&apos;s how quickly
                they can access and connect that knowledge. SecondBrainWare gives everyone an expert&apos;s cognitive edge.&rdquo;
              </blockquote>
              <div className="mt-6 text-white/40">
                — The Cognitive Enhancement Philosophy
              </div>
            </div>
          </div>
        </section>

        {/* WORKFLOWS - The Incredible Things You Can Do */}
        <section className="px-6 py-16 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-violet-400 font-medium mb-2">Professional Research Workflows</p>
              <h2 className="text-3xl lg:text-5xl font-bold">
                <span className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
                  From meeting room
                </span>
                <br className="hidden sm:block" />
                <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                  {' '}to published paper
                </span>
              </h2>
              <p className="text-white/50 text-lg max-w-2xl mx-auto mt-4">
                Every step of the professional research workflow, powered by AI.
              </p>
            </div>

            {/* Workflow Cards - Large, Visual */}
            <div className="space-y-6">
              {/* Row 1 */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Research Synthesis - Hero Workflow */}
                <div className="md:col-span-2 group relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-500/20 via-purple-500/10 to-indigo-500/20 border border-violet-500/30 p-8 lg:p-12 hover:border-violet-500/50 transition-all duration-500">
                  <div className="absolute top-0 right-0 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                        <Merge className="w-7 h-7 text-white" />
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                        Core Capability
                      </span>
                    </div>
                    <h3 className="text-2xl lg:text-3xl font-bold text-white mb-3">
                      Literature Review in Hours, Not Months
                    </h3>
                    <p className="text-white/60 text-lg mb-6 max-w-2xl">
                      Import research papers, conference recordings, technical reports, and field notes simultaneously.
                      AI synthesizes everything into a coherent outline organized by themes and findings—the way research should be organized.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <span className="px-3 py-1.5 rounded-lg bg-white/10 text-white/70 text-sm flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Research Papers
                      </span>
                      <span className="px-3 py-1.5 rounded-lg bg-white/10 text-white/70 text-sm flex items-center gap-2">
                        <Volume2 className="w-4 h-4" /> Conference Recordings
                      </span>
                      <span className="px-3 py-1.5 rounded-lg bg-white/10 text-white/70 text-sm flex items-center gap-2">
                        <Youtube className="w-4 h-4" /> Video Lectures
                      </span>
                      <span className="px-3 py-1.5 rounded-lg bg-white/10 text-white/70 text-sm flex items-center gap-2">
                        <Globe className="w-4 h-4" /> Technical Reports
                      </span>
                      <span className="px-3 py-1.5 rounded-lg bg-white/10 text-white/70 text-sm flex items-center gap-2">
                        <FileUp className="w-4 h-4" /> Field Notes
                      </span>
                    </div>
                  </div>
                </div>

                {/* Meeting Transcription */}
                <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 p-8 hover:border-amber-500/40 transition-all duration-500">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                  <div className="relative">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30 mb-4">
                      <Headphones className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl lg:text-2xl font-bold text-white mb-2">
                      Capture Physical Meetings & Interviews
                    </h3>
                    <p className="text-white/60 mb-4">
                      Record in-person meetings, focus groups, or field interviews. Upload the audio and get automatic transcription with speaker diarization—know exactly who said what.
                    </p>
                    <div className="text-amber-400 text-sm font-medium">
                      Auto speaker identification →
                    </div>
                  </div>
                </div>

                {/* Generate Podcasts */}
                <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 p-8 hover:border-emerald-500/40 transition-all duration-500">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                  <div className="relative">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 mb-4">
                      <Podcast className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl lg:text-2xl font-bold text-white mb-2">
                      Turn Any Outline Into a Podcast
                    </h3>
                    <p className="text-white/60 mb-4">
                      Select any branch and generate a professional podcast. Choose voices, style, and length.
                    </p>
                    <div className="text-emerald-400 text-sm font-medium">
                      Multiple voices & styles →
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 2 */}
              <div className="grid md:grid-cols-3 gap-6">
                {/* AI Content Generation */}
                <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-pink-500/10 to-rose-500/10 border border-pink-500/20 p-8 hover:border-pink-500/40 transition-all duration-500">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg shadow-pink-500/30 mb-4">
                    <Brain className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    Generate Rich Content
                  </h3>
                  <p className="text-white/60 text-sm mb-4">
                    One click generates content for any node. AI understands your outline's context and hierarchy.
                  </p>
                  <div className="text-pink-400 text-sm font-medium">
                    Context-aware writing →
                  </div>
                </div>

                {/* Bulk Content Generation */}
                <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 p-8 hover:border-blue-500/40 transition-all duration-500">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-500/30 mb-4">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    Bulk Generate for Children
                  </h3>
                  <p className="text-white/60 text-sm mb-4">
                    Select a parent node and generate content for all children at once. Perfect for filling out chapters.
                  </p>
                  <div className="text-blue-400 text-sm font-medium">
                    One click, many nodes →
                  </div>
                </div>

                {/* Knowledge Chat */}
                <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border border-indigo-500/20 p-8 hover:border-indigo-500/40 transition-all duration-500">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-4">
                    <MessagesSquare className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    Chat With Your Knowledge
                  </h3>
                  <p className="text-white/60 text-sm mb-4">
                    Ask questions about one outline or query all your outlines at once. Your personal Second Brain.
                  </p>
                  <div className="text-indigo-400 text-sm font-medium">
                    Single or multi-outline →
                  </div>
                </div>
              </div>

              {/* Row 3 */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Visual Diagrams */}
                <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 p-8 hover:border-cyan-500/40 transition-all duration-500">
                  <div className="flex items-start gap-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30 flex-shrink-0">
                      <Network className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">
                        Auto-Generate Mind Maps & Flowcharts
                      </h3>
                      <p className="text-white/60 text-sm mb-4">
                        Select any branch and instantly create beautiful visual diagrams. Export or embed directly in your outline.
                      </p>
                      <div className="flex gap-3">
                        <span className="px-3 py-1 rounded-lg bg-white/10 text-white/60 text-xs">Mind Maps</span>
                        <span className="px-3 py-1 rounded-lg bg-white/10 text-white/60 text-xs">Flowcharts</span>
                        <span className="px-3 py-1 rounded-lg bg-white/10 text-white/60 text-xs">Org Charts</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Images */}
                <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-fuchsia-500/10 to-pink-500/10 border border-fuchsia-500/20 p-8 hover:border-fuchsia-500/40 transition-all duration-500">
                  <div className="flex items-start gap-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center shadow-lg shadow-fuchsia-500/30 flex-shrink-0">
                      <ImageIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">
                        Create Custom Illustrations
                      </h3>
                      <p className="text-white/60 text-sm mb-4">
                        Describe what you need and AI generates it using Google Imagen 3. Insert directly into your outline.
                      </p>
                      <div className="flex gap-3">
                        <span className="px-3 py-1 rounded-lg bg-white/10 text-white/60 text-xs">Google Imagen 3</span>
                        <span className="px-3 py-1 rounded-lg bg-white/10 text-white/60 text-xs">Instant embed</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 4 - Website Generator (NEW - Highlighted) */}
              <div className="grid md:grid-cols-1 gap-6">
                <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border-2 border-emerald-500/40 p-8 hover:border-emerald-500/60 transition-all duration-500">
                  <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-semibold">
                    NEW
                  </div>
                  <div className="flex items-start gap-6">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 flex-shrink-0">
                      <Globe className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold text-white mb-2">
                        Turn Any Outline Into a Website
                      </h3>
                      <p className="text-white/70 text-base mb-4">
                        Export your outline as a professional, responsive website. Choose from 8 templates designed for different purposes. No coding required.
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        <div className="flex items-center gap-2 text-white/60 text-sm">
                          <span className="text-lg">🚀</span>
                          <span>Marketing</span>
                        </div>
                        <div className="flex items-center gap-2 text-white/60 text-sm">
                          <span className="text-lg">🏢</span>
                          <span>Informational</span>
                        </div>
                        <div className="flex items-center gap-2 text-white/60 text-sm">
                          <span className="text-lg">📚</span>
                          <span>Documentation</span>
                        </div>
                        <div className="flex items-center gap-2 text-white/60 text-sm">
                          <span className="text-lg">🎨</span>
                          <span>Portfolio</span>
                        </div>
                        <div className="flex items-center gap-2 text-white/60 text-sm">
                          <span className="text-lg">🎪</span>
                          <span>Event</span>
                        </div>
                        <div className="flex items-center gap-2 text-white/60 text-sm">
                          <span className="text-lg">🎓</span>
                          <span>Educational</span>
                        </div>
                        <div className="flex items-center gap-2 text-white/60 text-sm">
                          <span className="text-lg">📰</span>
                          <span>Blog</span>
                        </div>
                        <div className="flex items-center gap-2 text-white/60 text-sm">
                          <span className="text-lg">👤</span>
                          <span>Personal/CV</span>
                        </div>
                      </div>
                      <p className="text-emerald-400/80 text-sm">
                        Self-contained HTML files with responsive design, dark mode support, and smooth navigation. Host anywhere or share directly.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Interactive Website Preview */}
              <div className="mt-8">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-white mb-2">See It In Action</h3>
                  <p className="text-white/60">All 8 templates generated from "The Longevity Blueprint" — a real outline about biohacking and health optimization</p>
                </div>
                <WebsitePreviewCarousel />
              </div>

              {/* Row 5 - Export & Unmerge */}
              <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2 group relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-500/10 to-gray-500/10 border border-slate-500/20 p-8 hover:border-slate-500/40 transition-all duration-500">
                  <div className="flex items-start gap-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-500 to-gray-600 flex items-center justify-center shadow-lg shadow-slate-500/30 flex-shrink-0">
                      <Download className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">
                        Export Anywhere in 10+ Formats
                      </h3>
                      <p className="text-white/60 text-sm mb-4">
                        Your data is never locked in. Export to PDF, Markdown, HTML, Marketing Websites, OPML, Obsidian with wiki-links, CSV, and more.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-2 py-1 rounded bg-white/10 text-white/60 text-xs">PDF</span>
                        <span className="px-2 py-1 rounded bg-white/10 text-white/60 text-xs">Markdown</span>
                        <span className="px-2 py-1 rounded bg-white/10 text-white/60 text-xs">HTML</span>
                        <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs border border-emerald-500/30">Website</span>
                        <span className="px-2 py-1 rounded bg-white/10 text-white/60 text-xs">OPML</span>
                        <span className="px-2 py-1 rounded bg-white/10 text-white/60 text-xs">Obsidian</span>
                        <span className="px-2 py-1 rounded bg-white/10 text-white/60 text-xs">CSV</span>
                        <span className="px-2 py-1 rounded bg-white/10 text-white/60 text-xs">JSON</span>
                        <span className="px-2 py-1 rounded bg-white/10 text-white/60 text-xs">Plain Text</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Undo Merge */}
                <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/20 p-8 hover:border-red-500/40 transition-all duration-500">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shadow-lg shadow-red-500/30 mb-4">
                    <RotateCcw className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    One-Click Unmerge
                  </h3>
                  <p className="text-white/60 text-sm">
                    Changed your mind after merging research? One click restores your outline to its pre-merge state. Always recoverable.
                  </p>
                </div>
              </div>

              {/* New — Multimedia pair: YouTube package generation + Image-to-outline (shipped 2026-06-11) */}
              <div className="mt-8 grid lg:grid-cols-2 gap-6">
                {/* YouTube generation — shipped */}
                <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-red-500/10 via-rose-500/5 to-amber-500/10 border border-red-500/20 p-8 hover:border-red-500/40 transition-all duration-500">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/30 mb-4">
                    <Youtube className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="text-xl font-bold text-white">
                      From outline to YouTube in one click
                    </h3>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300 bg-emerald-400/10 border border-emerald-400/20 rounded px-2 py-0.5">
                      Shipped
                    </span>
                  </div>
                  <p className="text-white/60 text-sm mb-3">
                    Pick any outline branch and IdiamPro generates a complete YouTube content package — voiceover script with timing cues, chapter markers for the description, 5 title variants, 15+ SEO tags, a thumbnail concept, B-roll prompts for AI video tools (Runway, MagicLight, Sora), and a shot list for your screen recording.
                  </p>
                  <p className="text-white/40 text-xs">
                    Built for content creators who outline first, produce second.
                  </p>
                </div>

                {/* Image-to-outline — shipped */}
                <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-500/10 via-sky-500/5 to-violet-500/10 border border-cyan-500/20 p-8 hover:border-cyan-500/40 transition-all duration-500">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-sky-600 flex items-center justify-center shadow-lg shadow-cyan-500/30 mb-4">
                    <ImageIcon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="text-xl font-bold text-white">
                      Capture an idea, structure it instantly
                    </h3>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300 bg-emerald-400/10 border border-emerald-400/20 rounded px-2 py-0.5">
                      Shipped
                    </span>
                  </div>
                  <p className="text-white/60 text-sm mb-3">
                    Photograph a whiteboard, drop in a screenshot, snap a diagram. IdiamPro extracts the hierarchical structure as outline nodes — preserving relationships, not just text.
                  </p>
                  <p className="text-white/40 text-xs">
                    The source image stays attached so you can always trace back to where an idea came from.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Social Proof Bar */}
        <section className="px-6 py-10 lg:px-12 border-y border-white/5 bg-white/[0.02]">
          <div className="max-w-7xl mx-auto">
            <p className="text-center text-white/40 text-sm mb-6">Built for professional researchers at leading institutions</p>
            <div className="flex flex-wrap justify-center items-center gap-6 lg:gap-12">
              <div className="text-center">
                <div className="text-2xl font-bold text-white/70">Universities</div>
                <div className="text-xs text-white/40">PhD & Postdoc</div>
              </div>
              <div className="w-px h-8 bg-white/10 hidden sm:block" />
              <div className="text-center">
                <div className="text-2xl font-bold text-white/70">Research Labs</div>
                <div className="text-xs text-white/40">Academic & Industrial</div>
              </div>
              <div className="w-px h-8 bg-white/10 hidden sm:block" />
              <div className="text-center">
                <div className="text-2xl font-bold text-white/70">Consulting</div>
                <div className="text-xs text-white/40">McKinsey, BCG, Bain</div>
              </div>
              <div className="w-px h-8 bg-white/10 hidden sm:block" />
              <div className="text-center">
                <div className="text-2xl font-bold text-white/70">Legal</div>
                <div className="text-xs text-white/40">Law Firms & Counsel</div>
              </div>
            </div>
          </div>
        </section>

        {/* Why SecondBrainWare - Competitive Positioning */}
        <section id="features" className="px-6 py-24 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-violet-400 font-medium mb-2">Why Professionals Choose SecondBrainWare</p>
              <h2 className="text-3xl lg:text-5xl font-bold mb-4">
                Built for{' '}
                <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                  research-grade work
                </span>
              </h2>
              <p className="text-white/50 text-lg max-w-2xl mx-auto">
                Consumer note-taking apps weren't designed for professional research. SecondBrainWare was built from the ground up for serious knowledge synthesis.
              </p>
            </div>

            {/* Comparison Grid */}
            <div className="grid lg:grid-cols-2 gap-8 mb-16">
              {/* What Others Do */}
              <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/10">
                <h3 className="text-lg font-semibold text-white/50 mb-6 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs">✗</span>
                  What other tools do
                </h3>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3 text-white/40">
                    <span className="w-5 h-5 rounded bg-white/5 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">•</span>
                    <span>Take notes and organize them manually</span>
                  </li>
                  <li className="flex items-start gap-3 text-white/40">
                    <span className="w-5 h-5 rounded bg-white/5 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">•</span>
                    <span>Import one file at a time, if at all</span>
                  </li>
                  <li className="flex items-start gap-3 text-white/40">
                    <span className="w-5 h-5 rounded bg-white/5 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">•</span>
                    <span>AI as an afterthought—generic chat bolted on</span>
                  </li>
                  <li className="flex items-start gap-3 text-white/40">
                    <span className="w-5 h-5 rounded bg-white/5 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">•</span>
                    <span>Force you to choose: mobile OR desktop experience</span>
                  </li>
                  <li className="flex items-start gap-3 text-white/40">
                    <span className="w-5 h-5 rounded bg-white/5 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">•</span>
                    <span>Lock your data in proprietary formats</span>
                  </li>
                </ul>
              </div>

              {/* What SecondBrainWare Does */}
              <div className="p-8 rounded-3xl bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-violet-500/30">
                <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center text-xs">✓</span>
                  What SecondBrainWare does differently
                </h3>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3 text-white/80">
                    <Check className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5" />
                    <span><strong className="text-white">Multi-source synthesis</strong>—import 50+ sources and let AI organize by theme</span>
                  </li>
                  <li className="flex items-start gap-3 text-white/80">
                    <Check className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5" />
                    <span><strong className="text-white">10+ source types</strong>—YouTube, PDFs, audio with transcription, web pages, docs</span>
                  </li>
                  <li className="flex items-start gap-3 text-white/80">
                    <Check className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5" />
                    <span><strong className="text-white">AI-native from day one</strong>—content generation, synthesis, diagrams, podcasts</span>
                  </li>
                  <li className="flex items-start gap-3 text-white/80">
                    <Check className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5" />
                    <span><strong className="text-white">True cross-platform</strong>—identical experience on Mac, iPhone, iPad, and web</span>
                  </li>
                  <li className="flex items-start gap-3 text-white/80">
                    <Check className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5" />
                    <span><strong className="text-white">Your data, your way</strong>—9 export formats, local-first storage, no lock-in</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Competitor Comparison Cards */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                <h4 className="text-white font-semibold mb-2">vs. Notion</h4>
                <p className="text-white/40 text-sm mb-3">Feature-bloated, slow, not research-focused</p>
                <p className="text-violet-400 text-sm font-medium">SecondBrainWare: Fast, focused, AI-powered research</p>
              </div>
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                <h4 className="text-white font-semibold mb-2">vs. Obsidian</h4>
                <p className="text-white/40 text-sm mb-3">Steep learning curve, clunky mobile, no AI</p>
                <p className="text-violet-400 text-sm font-medium">SecondBrainWare: Intuitive, great mobile, AI-native</p>
              </div>
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                <h4 className="text-white font-semibold mb-2">vs. WorkFlowy</h4>
                <p className="text-white/40 text-sm mb-3">Dated UI, limited features, no source import</p>
                <p className="text-violet-400 text-sm font-medium">SecondBrainWare: Modern, 19 node types, AI synthesis</p>
              </div>
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                <h4 className="text-white font-semibold mb-2">vs. Roam</h4>
                <p className="text-white/40 text-sm mb-3">Expensive, cloud-only, performance issues</p>
                <p className="text-violet-400 text-sm font-medium">SecondBrainWare: Affordable, local-first, fast</p>
              </div>
            </div>

            {/* Feature Comparison Table */}
            <div className="mt-12 overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-4 px-4 text-white font-semibold">Feature</th>
                    <th className="text-center py-4 px-4">
                      <span className="text-violet-400 font-bold">SecondBrainWare</span>
                    </th>
                    <th className="text-center py-4 px-4 text-white/50">Notion</th>
                    <th className="text-center py-4 px-4 text-white/50">Obsidian</th>
                    <th className="text-center py-4 px-4 text-white/50">Roam</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  <tr className="border-b border-white/5">
                    <td className="py-3 px-4 text-white/70">Multi-source AI synthesis (50+ sources)</td>
                    <td className="py-3 px-4 text-center"><Check className="w-5 h-5 text-emerald-400 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-white/20 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-white/20 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-white/20 mx-auto" /></td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-3 px-4 text-white/70">Speaker diarization (who said what)</td>
                    <td className="py-3 px-4 text-center"><Check className="w-5 h-5 text-emerald-400 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-white/20 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-white/20 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-white/20 mx-auto" /></td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-3 px-4 text-white/70">PDF & document import with analysis</td>
                    <td className="py-3 px-4 text-center"><Check className="w-5 h-5 text-emerald-400 mx-auto" /></td>
                    <td className="py-3 px-4 text-center text-white/30">Limited</td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-white/20 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-white/20 mx-auto" /></td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-3 px-4 text-white/70">YouTube transcript import</td>
                    <td className="py-3 px-4 text-center"><Check className="w-5 h-5 text-emerald-400 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-white/20 mx-auto" /></td>
                    <td className="py-3 px-4 text-center text-white/30">Plugin</td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-white/20 mx-auto" /></td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-3 px-4 text-white/70">AI content generation</td>
                    <td className="py-3 px-4 text-center"><Check className="w-5 h-5 text-emerald-400 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><Check className="w-5 h-5 text-white/40 mx-auto" /></td>
                    <td className="py-3 px-4 text-center text-white/30">Plugin</td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-white/20 mx-auto" /></td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-3 px-4 text-white/70">Podcast generation</td>
                    <td className="py-3 px-4 text-center"><Check className="w-5 h-5 text-emerald-400 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-white/20 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-white/20 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-white/20 mx-auto" /></td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-3 px-4 text-white/70">Local-first storage</td>
                    <td className="py-3 px-4 text-center"><Check className="w-5 h-5 text-emerald-400 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-white/20 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><Check className="w-5 h-5 text-white/40 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><X className="w-5 h-5 text-white/20 mx-auto" /></td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-3 px-4 text-white/70">Native iOS app</td>
                    <td className="py-3 px-4 text-center"><Check className="w-5 h-5 text-emerald-400 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><Check className="w-5 h-5 text-white/40 mx-auto" /></td>
                    <td className="py-3 px-4 text-center text-white/30">Basic</td>
                    <td className="py-3 px-4 text-center text-white/30">Basic</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-white/70">1,000,000+ node capacity*</td>
                    <td className="py-3 px-4 text-center"><Check className="w-5 h-5 text-emerald-400 mx-auto" /></td>
                    <td className="py-3 px-4 text-center text-white/30">Slows</td>
                    <td className="py-3 px-4 text-center"><Check className="w-5 h-5 text-white/40 mx-auto" /></td>
                    <td className="py-3 px-4 text-center text-white/30">Slows</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Scale Callout */}
            <div className="mt-16 p-8 lg:p-12 rounded-3xl bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-indigo-500/10 border border-violet-500/20 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-violet-500/10 via-transparent to-transparent" />
              <div className="relative">
                <h3 className="text-4xl lg:text-6xl font-bold text-white mb-4">
                  <AnimatedNumber value={1000000} prefix="" suffix="+" />
                </h3>
                <p className="text-xl text-white/80 mb-2">nodes in a single outline*</p>
                <p className="text-white/50 max-w-xl mx-auto mb-6">
                  Stress-tested with over one million nodes. No artificial limits—scale until your hardware says stop.
                  Your biggest research projects, handled with ease.
                </p>
                <Button
                  onClick={() => window.location.href = '/stress-test'}
                  variant="outline"
                  className="border-violet-500/30 text-violet-300 hover:bg-violet-500/10 hover:border-violet-500/50"
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Test Your System
                </Button>
                <p className="text-white/30 text-xs mt-4">
                  *Tested on M4 MacBook Air with 512GB SSD. Performance varies by hardware and platform.
                </p>
              </div>
            </div>

            {/* Key Advantages */}
            <div className="mt-12 grid md:grid-cols-4 gap-6">
              <div className="text-center p-6 rounded-2xl bg-white/5 border border-white/10">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-500/25">
                  <Sparkles className="w-7 h-7 text-white" />
                </div>
                <h4 className="text-lg font-bold text-white mb-2">AI-First</h4>
                <p className="text-white/50 text-sm">
                  Every feature designed around AI from day one
                </p>
              </div>
              <div className="text-center p-6 rounded-2xl bg-white/5 border border-white/10">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/25">
                  <Shield className="w-7 h-7 text-white" />
                </div>
                <h4 className="text-lg font-bold text-white mb-2">Privacy-First</h4>
                <p className="text-white/50 text-sm">
                  Local storage by default. Cloud is optional.
                </p>
              </div>
              <div className="text-center p-6 rounded-2xl bg-white/5 border border-white/10">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/25">
                  <Zap className="w-7 h-7 text-white" />
                </div>
                <h4 className="text-lg font-bold text-white mb-2">Blazing Fast</h4>
                <p className="text-white/50 text-sm">
                  Instant response, even with massive outlines
                </p>
              </div>
              <div className="text-center p-6 rounded-2xl bg-white/5 border border-white/10">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/25">
                  <Layers className="w-7 h-7 text-white" />
                </div>
                <h4 className="text-lg font-bold text-white mb-2">19 Node Types</h4>
                <p className="text-white/50 text-sm">
                  Tasks, code, media, spreadsheets, and more
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Privacy & Data Security */}
        <section className="px-6 py-24 lg:px-12 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-950/10 to-transparent" />
          <div className="max-w-7xl mx-auto relative">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 border border-emerald-500/30 mb-6">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm text-emerald-300">Your Data, Protected</span>
                </div>
                <h2 className="text-3xl lg:text-5xl font-bold mb-6">
                  <span className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
                    Privacy is not
                  </span>
                  <br />
                  <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                    an afterthought
                  </span>
                </h2>
                <p className="text-white/60 text-lg mb-8">
                  Unlike cloud-first apps that hold your data hostage, SecondBrainWare is built local-first.
                  Your outlines live on your device. You're always in control.
                </p>

                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <Shield className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="text-white font-semibold mb-1">Local-First Storage</h4>
                      <p className="text-white/50 text-sm">Your data is stored on your device by default. No cloud required. No servers holding your thoughts.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <Lock className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="text-white font-semibold mb-1">Never Sold, Never Shared</h4>
                      <p className="text-white/50 text-sm">We will never sell your data. Period. Your content is yours alone.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <Brain className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="text-white font-semibold mb-1">No AI Training on Your Data</h4>
                      <p className="text-white/50 text-sm">When you use AI features, your content is processed but never used to train AI models. Contractually guaranteed.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <Download className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="text-white font-semibold mb-1">Export Anytime, Any Format</h4>
                      <p className="text-white/50 text-sm">9 export formats mean you're never locked in. Leave anytime with all your data.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-3xl blur-3xl" />
                <div className="relative p-8 lg:p-12 rounded-3xl bg-gray-900/80 border border-emerald-500/20">
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/30">
                      <Shield className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-4">Your Data Promise</h3>
                    <ul className="space-y-3 text-left">
                      <li className="flex items-center gap-3 text-white/80">
                        <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                        <span>Data stored locally on your device</span>
                      </li>
                      <li className="flex items-center gap-3 text-white/80">
                        <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                        <span>Optional encrypted cloud backup</span>
                      </li>
                      <li className="flex items-center gap-3 text-white/80">
                        <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                        <span>No data sold to third parties</span>
                      </li>
                      <li className="flex items-center gap-3 text-white/80">
                        <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                        <span>Content never used for AI training</span>
                      </li>
                      <li className="flex items-center gap-3 text-white/80">
                        <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                        <span>GDPR & CCPA compliant</span>
                      </li>
                      <li className="flex items-center gap-3 text-white/80">
                        <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
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
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-5xl font-bold mb-4">
                Built for{' '}
                <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                  serious work
                </span>
              </h2>
              <p className="text-white/50 text-lg max-w-2xl mx-auto">
                From PhD dissertations to investigative journalism, SecondBrainWare powers knowledge work that matters.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {useCases.map((useCase, i) => (
                <UseCaseCard key={i} {...useCase} />
              ))}
            </div>

            {/* Case Studies */}
            <div className="mt-16">
              <h3 className="text-2xl font-bold text-white text-center mb-8">Real Research, Real Results</h3>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
                  <div className="text-3xl font-bold text-blue-400 mb-2">47 → 1</div>
                  <h4 className="text-white font-semibold mb-2">Literature Review Synthesis</h4>
                  <p className="text-white/50 text-sm mb-4">
                    A PhD candidate imported 47 research papers on computational biology. SecondBrainWare synthesized them into a coherent literature review organized by methodology, findings, and gaps.
                  </p>
                  <div className="text-blue-400 text-xs font-medium">Computational Biology • Stanford</div>
                </div>

                <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                  <div className="text-3xl font-bold text-amber-400 mb-2">12 hrs → 30 min</div>
                  <h4 className="text-white font-semibold mb-2">Field Interview Analysis</h4>
                  <p className="text-white/50 text-sm mb-4">
                    An industrial R&D team recorded 12 hours of stakeholder interviews across 3 sites. SecondBrainWare transcribed with speaker diarization and organized insights by theme.
                  </p>
                  <div className="text-amber-400 text-xs font-medium">Industrial Research • Fortune 500</div>
                </div>

                <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
                  <div className="text-3xl font-bold text-emerald-400 mb-2">2,400 docs</div>
                  <h4 className="text-white font-semibold mb-2">Legal Discovery</h4>
                  <p className="text-white/50 text-sm mb-4">
                    A litigation team processed 2,400 discovery documents including depositions, contracts, and communications. SecondBrainWare organized evidence by timeline and relevance.
                  </p>
                  <div className="text-emerald-400 text-xs font-medium">Complex Litigation • AmLaw 100</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* All Features Grid */}
        <section className="px-6 py-24 lg:px-12 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-950/20 to-transparent" />
          <div className="max-w-7xl mx-auto relative">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-5xl font-bold mb-4">
                50+ features to{' '}
                <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                  amplify your work
                </span>
              </h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {allFeatures.map((feature, i) => (
                <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                  <feature.icon className="w-5 h-5 text-violet-400 mb-2" />
                  <h4 className="text-white font-medium text-sm mb-1">{feature.title}</h4>
                  <p className="text-white/40 text-xs">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Platform Section */}
        <section className="px-6 py-24 lg:px-12">
          <div className="max-w-6xl mx-auto text-center">
            <h2 className="text-3xl lg:text-5xl font-bold mb-6">
              Works everywhere you do
            </h2>
            <p className="text-white/50 text-lg mb-6 max-w-2xl mx-auto">
              One subscription, all platforms. Your second brain syncs seamlessly across every device.
            </p>
            <p className="text-emerald-400/80 text-sm mb-12 max-w-xl mx-auto">
              Apple prototypes available now. Windows, Linux, and Android coming at launch.
            </p>

            {/* Desktop Platforms */}
            <div className="mb-12">
              <h3 className="text-white/40 text-sm uppercase tracking-wider mb-6">Desktop</h3>
              <div className="flex flex-wrap justify-center items-center gap-6 lg:gap-10">
                <div className="text-center group">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/10 border border-violet-500/30 flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-all">
                    <Monitor className="w-10 h-10 text-violet-400" />
                  </div>
                  <div className="text-white font-medium">macOS</div>
                  <div className="text-emerald-400 text-xs">Available Now</div>
                </div>
                <div className="text-center group">
                  <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-white/10 transition-all">
                    <Laptop className="w-10 h-10 text-blue-400" />
                  </div>
                  <div className="text-white font-medium">Windows</div>
                  <div className="text-white/40 text-xs">Coming Soon</div>
                </div>
                <div className="text-center group">
                  <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-white/10 transition-all">
                    <Code2 className="w-10 h-10 text-orange-400" />
                  </div>
                  <div className="text-white font-medium">Linux</div>
                  <div className="text-white/40 text-xs">Coming Soon</div>
                </div>
              </div>
            </div>

            {/* Mobile & Tablet Platforms */}
            <div className="mb-12">
              <h3 className="text-white/40 text-sm uppercase tracking-wider mb-6">Mobile & Tablet</h3>
              <div className="flex flex-wrap justify-center items-center gap-6 lg:gap-10">
                <div className="text-center group">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/10 border border-violet-500/30 flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-all">
                    <Smartphone className="w-10 h-10 text-violet-400" />
                  </div>
                  <div className="text-white font-medium">iOS</div>
                  <div className="text-emerald-400 text-xs">Beta Available</div>
                </div>
                <div className="text-center group">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/10 border border-violet-500/30 flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-all">
                    <Presentation className="w-10 h-10 text-violet-400" />
                  </div>
                  <div className="text-white font-medium">iPad</div>
                  <div className="text-emerald-400 text-xs">Beta Available</div>
                </div>
                <div className="text-center group">
                  <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-white/10 transition-all">
                    <Smartphone className="w-10 h-10 text-green-400" />
                  </div>
                  <div className="text-white font-medium">Android</div>
                  <div className="text-white/40 text-xs">Coming Soon</div>
                </div>
              </div>
            </div>

            {/* Web */}
            <div>
              <h3 className="text-white/40 text-sm uppercase tracking-wider mb-6">Web</h3>
              <div className="flex justify-center">
                <div className="text-center group">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-all">
                    <Globe className="w-10 h-10 text-emerald-400" />
                  </div>
                  <div className="text-white font-medium">Web App</div>
                  <div className="text-emerald-400 text-xs">Available Now</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="px-6 py-24 lg:px-12 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-950/20 to-transparent" />
          <div className="max-w-7xl mx-auto relative">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-5xl font-bold mb-4">
                Trusted by{' '}
                <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                  professional researchers
                </span>
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {testimonials.map((testimonial, i) => (
                <TestimonialCard key={i} {...testimonial} />
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="px-6 py-24 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-5xl font-bold mb-4">
                Simple, transparent{' '}
                <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                  pricing
                </span>
              </h2>
              <p className="text-white/50 text-lg max-w-2xl mx-auto">
                Start free, upgrade when you need more. No hidden fees.
              </p>
              <div className="mt-6 flex justify-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-gradient-to-r from-violet-500/10 to-emerald-500/10 px-5 py-2.5 text-sm font-medium text-white/90">
                  <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
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

            <p className="text-center text-white/40 text-sm mt-8">
              All plans include a 14-day free trial. Cancel anytime.
            </p>

            {/* Comparison grid — 4-option split */}
            <div className="mt-20">
              <h3 className="text-center text-2xl lg:text-3xl font-bold mb-2">
                Compare what you get
              </h3>
              <p className="text-center text-white/50 text-sm mb-8">
                Four ways to use IdiamPro. Pick the one that fits how you work.
              </p>
              <div className="overflow-x-auto rounded-3xl border border-white/10 bg-white/5">
                <table className="w-full min-w-[820px] text-sm text-white/80 border-collapse">
                  <thead>
                    <tr className="align-top">
                      <th className="p-4 text-left font-medium text-white/50 w-[26%]">
                        <span className="text-xs uppercase tracking-wide">Feature</span>
                      </th>
                      <th className="p-4 text-left align-top border-l border-white/10">
                        <div className="text-white font-semibold text-base">Free trial</div>
                        <div className="text-white/50 text-xs mt-1">Try it, 25 AI uses</div>
                        <div className="mt-2 text-white/90 font-bold">$0</div>
                      </th>
                      <th className="p-4 text-left align-top border-l border-white/10 bg-white/[0.03]">
                        <div className="text-white font-semibold text-base">Own it</div>
                        <div className="text-white/50 text-xs mt-1">Runs on your device &amp; your own key</div>
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <span className="text-white/90 font-bold">$29.99</span>
                          <span className="inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                            $19.99 founder launch
                          </span>
                        </div>
                        <span className="mt-2 inline-flex items-center rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[10px] font-medium text-white/70">
                          Coming soon
                        </span>
                      </th>
                      <th className="p-4 text-left align-top border-l border-white/10 bg-gradient-to-b from-violet-500/15 to-indigo-500/10">
                        <div className="text-white font-semibold text-base">Pro</div>
                        <div className="text-white/50 text-xs mt-1">Premium cloud AI</div>
                        <div className="mt-2 text-white/90 font-bold">
                          $9.99<span className="text-white/50 font-normal text-xs">/mo</span>
                          <span className="text-white/40 font-normal text-xs"> · $89/yr</span>
                        </div>
                      </th>
                      <th className="p-4 text-left align-top border-l border-white/10">
                        <div className="text-white font-semibold text-base">BYOK</div>
                        <div className="text-white/50 text-xs mt-1">Your key, unlimited</div>
                        <div className="mt-2 text-white/90 font-bold">Free</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {[
                      {
                        label: 'Core outlining',
                        sub: 'Unlimited outlines, drag-drop, tags & colors, search, export/share, backups, data protection',
                        cells: [<Check key="c" className="w-4 h-4 text-emerald-400" />, <Check key="c" className="w-4 h-4 text-emerald-400" />, <Check key="c" className="w-4 h-4 text-emerald-400" />, <Check key="c" className="w-4 h-4 text-emerald-400" />],
                      },
                      {
                        label: 'Everyday AI',
                        sub: 'Generate from a topic, reformat, translate, suggest tags, describe images, quick commands, Help chat',
                        cells: ['25 total', <Check key="c" className="w-4 h-4 text-emerald-400" />, <Check key="c" className="w-4 h-4 text-emerald-400" />, <Check key="c" className="w-4 h-4 text-emerald-400" />],
                      },
                      {
                        label: 'On-device / private AI',
                        sub: 'Notes never leave your device',
                        cells: ['—', <Check key="c" className="w-4 h-4 text-emerald-400" />, <Check key="c" className="w-4 h-4 text-emerald-400" />, <Check key="c" className="w-4 h-4 text-emerald-400" />],
                      },
                      {
                        label: 'Pro superpowers',
                        sub: 'Refresh from Web + citations, Research & Import, Transform Outline, Ask Your Outlines at scale, Podcast, Image generation, frontier cloud models',
                        cells: ['—', '—', <Check key="c" className="w-4 h-4 text-emerald-400" />, '✓ with your key'],
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
                          <div className="text-white font-medium">{row.label}</div>
                          <div className="text-white/40 text-xs mt-1 leading-relaxed">{row.sub}</div>
                        </td>
                        {row.cells.map((cell, ci) => (
                          <td
                            key={ci}
                            className={`p-4 border-l border-white/10 align-middle ${ci === 1 ? 'bg-white/[0.03]' : ''} ${ci === 2 ? 'bg-violet-500/[0.06]' : ''}`}
                          >
                            {typeof cell === 'string' ? (
                              <span className={cell === '—' ? 'text-white/30' : 'text-white/80'}>{cell}</span>
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
              <p className="text-center text-white/40 text-xs mt-4">
                &ldquo;Own it&rdquo; one-time purchase is coming soon — join the free trial or Pro today.
              </p>
            </div>

            {/* Academic & Student Pricing Callout */}
            <div className="mt-12 p-8 rounded-3xl bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-purple-500/10 border border-indigo-500/20">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg">
                    <GraduationCap className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Academic & Student Pricing</h3>
                    <p className="text-white/60">50% off for students and educators with valid .edu email</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">$4.99<span className="text-white/50 text-sm">/mo</span></div>
                    <div className="text-xs text-indigo-400">Basic Plan</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">$14.99<span className="text-white/50 text-sm">/mo</span></div>
                    <div className="text-xs text-indigo-400">Premium Plan</div>
                  </div>
                  <Button
                    onClick={launchApp}
                    className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white"
                  >
                    Verify .edu
                  </Button>
                </div>
              </div>
            </div>

            {/* Beta Testers Callout */}
            <div className="mt-12 p-8 lg:p-10 rounded-3xl bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-cyan-500/20 border border-emerald-500/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="relative flex flex-col lg:flex-row items-center justify-between gap-8">
                <div className="flex items-start gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 flex-shrink-0">
                    <Rocket className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-medium mb-3">
                      <Sparkles className="w-3 h-3" />
                      Limited Spots Available
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">Join Our Beta Program</h3>
                    <p className="text-white/60 max-w-xl">
                      Be among the first to experience SecondBrainWare. Beta testers get <span className="text-emerald-400 font-semibold">free lifetime access to Pro features</span>,
                      direct input into our roadmap, and priority support. Help us build the ultimate cognitive enhancement platform.
                    </p>
                    <div className="flex flex-wrap gap-3 mt-4">
                      <span className="px-3 py-1 rounded-full bg-white/10 text-white/60 text-xs">Free Pro Access</span>
                      <span className="px-3 py-1 rounded-full bg-white/10 text-white/60 text-xs">Shape the Product</span>
                      <span className="px-3 py-1 rounded-full bg-white/10 text-white/60 text-xs">Priority Support</span>
                      <span className="px-3 py-1 rounded-full bg-white/10 text-white/60 text-xs">Early Feature Access</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-3">
                  <Button
                    onClick={() => window.location.href = 'mailto:beta@idiampro.com?subject=Beta Tester Application'}
                    size="lg"
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/25 whitespace-nowrap"
                  >
                    Apply for Beta
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                  <span className="text-white/40 text-xs">Web version available now</span>
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
                <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                  questions
                </span>
              </h2>
            </div>

            <div className="bg-white/5 rounded-2xl border border-white/10 p-6 lg:p-8">
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
              <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                think and create?
              </span>
            </h2>
            <p className="text-white/50 text-lg mb-8 max-w-2xl mx-auto">
              Join thousands of researchers, authors, and professionals who've upgraded their workflow with SecondBrainWare.
            </p>
            <Button
              onClick={launchApp}
              size="lg"
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-lg px-10 py-6 shadow-xl shadow-violet-500/25 hover:shadow-violet-500/40 transition-all duration-300"
            >
              Start Creating Free
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <p className="text-white/30 text-sm mt-4">
              No credit card required. Free tier forever.
            </p>
          </div>
        </section>

        {/* Footnotes */}
        <section className="px-6 py-8 lg:px-12">
          <div className="max-w-4xl mx-auto">
            <div className="border-t border-white/10 pt-8">
              <h4 className="text-white/40 text-xs uppercase tracking-wider mb-4">Performance Notes</h4>
              <div className="text-white/30 text-xs space-y-2">
                <p>
                  <strong className="text-white/50">*Node Capacity Testing:</strong> 1,000,000+ nodes tested on Apple M4 MacBook Air
                  (16GB RAM, 512GB SSD) running macOS. Generation time: 4.2s, save time: 1.8s, load time: 1.3s,
                  file size: 98MB. Performance varies by hardware configuration.
                </p>
                <p>
                  <strong className="text-white/50">Platform Considerations:</strong>
                </p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li><strong>Desktop (macOS/Windows/Linux):</strong> Full system RAM available. Recommended for outlines exceeding 100,000 nodes.</li>
                  <li><strong>Web Browser:</strong> Limited to browser memory allocation (typically 2-4GB). Chrome/Edge perform best. Recommended limit: 200,000 nodes.</li>
                  <li><strong>Mobile (iOS/Android):</strong> More constrained memory. For optimal performance, keep outlines under 50,000 nodes.</li>
                </ul>
                <p>
                  <strong className="text-white/50">Storage:</strong> Outline files (.idm) are JSON-based. A 100,000-node outline is approximately 20MB.
                  Local storage has no practical limit; web browser IndexedDB supports gigabytes of storage.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-6 py-12 lg:px-12 border-t border-white/10">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-4 gap-8 mb-12">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                    <Brain className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-bold text-white">SecondBrainWare</span>
                </div>
                <p className="text-white/40 text-sm mb-2">
                  Your Intelligence Amplifier.
                </p>
                <p className="text-white/30 text-xs">
                  Build your second brain. Expand your knowledge. See what others miss.
                </p>
              </div>

              <div>
                <h4 className="text-white font-semibold mb-4">Product</h4>
                <ul className="space-y-2">
                  <li><a href="#features" className="text-white/40 hover:text-white text-sm transition-colors">Features</a></li>
                  <li><a href="#pricing" className="text-white/40 hover:text-white text-sm transition-colors">Pricing</a></li>
                  <li><a href="#use-cases" className="text-white/40 hover:text-white text-sm transition-colors">Use Cases</a></li>
                  <li><a href="#" className="text-white/40 hover:text-white text-sm transition-colors">Roadmap</a></li>
                </ul>
              </div>

              <div>
                <h4 className="text-white font-semibold mb-4">Resources</h4>
                <ul className="space-y-2">
                  <li><a href="#" className="text-white/40 hover:text-white text-sm transition-colors">Documentation</a></li>
                  <li><a href="#" className="text-white/40 hover:text-white text-sm transition-colors">Tutorials</a></li>
                  <li><a href="#" className="text-white/40 hover:text-white text-sm transition-colors">Blog</a></li>
                  <li><a href="#faq" className="text-white/40 hover:text-white text-sm transition-colors">FAQ</a></li>
                </ul>
              </div>

              <div>
                <h4 className="text-white font-semibold mb-4">Company</h4>
                <ul className="space-y-2">
                  <li><a href="#" className="text-white/40 hover:text-white text-sm transition-colors">About</a></li>
                  <li><a href="#" className="text-white/40 hover:text-white text-sm transition-colors">Privacy</a></li>
                  <li><a href="#" className="text-white/40 hover:text-white text-sm transition-colors">Terms</a></li>
                  <li><a href="#" className="text-white/40 hover:text-white text-sm transition-colors">Contact</a></li>
                </ul>
              </div>
            </div>

            <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-white/30 text-sm">
                © 2026 SecondBrainWare. All rights reserved.
              </p>
              <div className="flex items-center gap-6">
                <a href="#" className="text-white/30 hover:text-white text-sm transition-colors">Twitter</a>
                <a href="#" className="text-white/30 hover:text-white text-sm transition-colors">LinkedIn</a>
                <a href="#" className="text-white/30 hover:text-white text-sm transition-colors">GitHub</a>
              </div>
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
