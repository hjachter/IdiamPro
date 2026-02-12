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
  Pin,
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

// ============================================
// CONFIGURATION
// ============================================

// App URL - points to the app route
const APP_URL = '/app';

// Launch date: April 1, 2026
const LAUNCH_DATE = new Date('2026-04-01T00:00:00');

// Navigate to the app
const launchApp = () => {
  window.location.href = APP_URL;
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
        onClick={launchApp}
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
  gradient
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  description: string;
  gradient: string;
}) {
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

  // Data
  const allFeatures = [
    { icon: Brain, title: 'AI Content Generation', description: 'Generate content for any node with one click' },
    { icon: ImageIcon, title: 'AI Image Creation', description: 'Create custom illustrations with Google Imagen 3' },
    { icon: Table, title: 'Inline Spreadsheets', description: 'Full Excel-like spreadsheets embedded in your outline' },
    { icon: Mic, title: 'Voice Dictation', description: 'Speak your thoughts with speech-to-text' },
    { icon: Network, title: 'Auto Diagrams', description: 'Generate mind maps and flowcharts from any subtree' },
    { icon: Youtube, title: 'Video Embedding', description: 'Embed YouTube, Vimeo, and other video players' },
    { icon: Tags, title: 'Tags & Colors', description: '8 colors and unlimited tags for organization' },
    { icon: Pin, title: 'Pin Important Nodes', description: 'Star-marked pinning for quick access' },
    { icon: Focus, title: 'Focus Mode', description: 'Isolate a subtree for distraction-free work' },
    { icon: ListOrdered, title: 'Auto Numbering', description: 'Hierarchical prefixes (1.2.3 style)' },
    { icon: Search, title: 'Full-Text Search', description: 'Search across all outlines and content' },
    { icon: Download, title: 'Multi-Format Export', description: 'PDF, Markdown, HTML, OPML, Obsidian, and more' }
  ];

  const useCases = [
    {
      icon: Microscope,
      title: 'Research Aggregation',
      subtitle: 'Researchers & PhD Students',
      description: 'Synthesize 50+ papers into a unified literature review. AI finds connections you might miss.',
      gradient: 'bg-gradient-to-br from-blue-500 to-cyan-600'
    },
    {
      icon: BookMarked,
      title: 'Book Writing',
      subtitle: 'Authors & Writers',
      description: 'Import research, generate outlines, auto-create chapter content. Write books 10x faster.',
      gradient: 'bg-gradient-to-br from-amber-500 to-orange-600'
    },
    {
      icon: Video,
      title: 'Video Course Notes',
      subtitle: 'Students & Learners',
      description: 'Import YouTube lectures, get auto-transcripts, create structured study guides.',
      gradient: 'bg-gradient-to-br from-red-500 to-rose-600'
    },
    {
      icon: Scale,
      title: 'Legal Case Prep',
      subtitle: 'Attorneys & Paralegals',
      description: 'Organize discovery documents, depositions, and case law into structured briefs.',
      gradient: 'bg-gradient-to-br from-slate-500 to-gray-600'
    },
    {
      icon: Newspaper,
      title: 'Investigative Journalism',
      subtitle: 'Journalists & Reporters',
      description: 'Synthesize sources, track leads, organize investigations with full attribution.',
      gradient: 'bg-gradient-to-br from-violet-500 to-purple-600'
    },
    {
      icon: Lightbulb,
      title: 'Client Deliverables',
      subtitle: 'Consultants & Analysts',
      description: 'Combine client emails, calls, and research into comprehensive project briefs.',
      gradient: 'bg-gradient-to-br from-emerald-500 to-teal-600'
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
      answer: 'IdiamPro offers 9 export formats: PDF, Markdown, HTML (collapsible website), Plain Text, OPML, Obsidian (with wiki-links), CSV, JSON Tree, and more. Your data is never locked in.'
    }
  ];

  const testimonials = [
    {
      quote: 'I imported 47 research papers and IdiamPro synthesized them into a coherent literature review in minutes. What used to take months now takes an afternoon.',
      author: 'Dr. Sarah Chen',
      role: 'Postdoctoral Researcher, Computational Biology'
    },
    {
      quote: 'We recorded 12 hours of stakeholder interviews in the field. IdiamPro transcribed everything with perfect speaker identification and organized it by theme. Game changer for qualitative research.',
      author: 'Dr. Michael Torres',
      role: 'Principal Research Scientist, Industrial R&D'
    },
    {
      quote: 'For legal discovery, we process thousands of documents. IdiamPro synthesizes deposition transcripts, case files, and expert reports into structured briefs. It\'s become essential to our workflow.',
      author: 'Jennifer Walsh, JD',
      role: 'Senior Associate, Litigation Practice'
    }
  ];

  return (
    <div className="min-h-screen h-full bg-gray-950 text-white overflow-x-hidden overflow-y-auto">
      {/* Background gradients */}
      <div className="fixed inset-0 bg-gradient-to-br from-violet-950 via-gray-950 to-indigo-950" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/20 via-transparent to-transparent" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent" />

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
                IdiamPro
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
                  <span className="text-sm text-violet-300">Your Intelligence Amplifier</span>
                </div>

                <h1 className="text-5xl lg:text-7xl font-bold leading-tight mb-6">
                  <span className="bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
                    Build Your
                  </span>
                  <br />
                  <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
                    Second Brain
                  </span>
                </h1>

                <p className="text-xl text-white/60 max-w-3xl mx-auto leading-relaxed mb-6">
                  IdiamPro is a <span className="text-white font-semibold">cognitive enhancement platform</span>—an
                  intelligence amplifier that expands your knowledge scope, accelerates information access, and reveals
                  complex interrelationships and creative possibilities that others miss. The premium AI-powered
                  platform for PhD-level research and professional knowledge synthesis.
                </p>

                {/* Professional Audience Badges */}
                <div className="flex flex-wrap justify-center gap-3 mb-8">
                  <span className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/70 text-sm flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-violet-400" />
                    PhD Researchers
                  </span>
                  <span className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/70 text-sm flex items-center gap-2">
                    <Microscope className="w-4 h-4 text-blue-400" />
                    Scientists
                  </span>
                  <span className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/70 text-sm flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-emerald-400" />
                    Industry R&D
                  </span>
                  <span className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/70 text-sm flex items-center gap-2">
                    <Scale className="w-4 h-4 text-amber-400" />
                    Legal Professionals
                  </span>
                  <span className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/70 text-sm flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-pink-400" />
                    Consultants
                  </span>
                </div>

                {/* Launch Countdown */}
                <div className="mb-10">
                  <p className="text-white/50 text-sm mb-4 uppercase tracking-wider">Full Launch: March 2026</p>
                  <div className="flex justify-center">
                    <CountdownTimer targetDate={LAUNCH_DATE} />
                  </div>
                  <p className="text-emerald-400 text-sm mt-4 font-medium">
                    Web version available now for beta testers
                  </p>
                </div>

                <div className="flex flex-wrap gap-4 justify-center">
                  <Button
                    onClick={launchApp}
                    size="lg"
                    className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-lg px-8 shadow-xl shadow-violet-500/25 hover:shadow-violet-500/40 transition-all duration-300"
                  >
                    Try Beta Now
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 text-lg px-8"
                    onClick={() => window.location.href = '/beta'}
                  >
                    <Rocket className="w-5 h-5 mr-2" />
                    Join Beta Program
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Demo Video Section */}
        <section id="demo-video" className="px-6 py-16 lg:px-12">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl lg:text-3xl font-bold text-white mb-2">See IdiamPro in Action</h2>
              <p className="text-white/50">Watch how researchers synthesize 50+ sources in minutes</p>
            </div>
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-gray-900 border border-white/10 group cursor-pointer hover:border-violet-500/50 transition-all duration-300">
              {/* Placeholder - replace with actual video embed */}
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 group-hover:bg-violet-500/30 group-hover:scale-110 transition-all duration-300">
                    <Play className="w-8 h-8 text-white ml-1" />
                  </div>
                  <p className="text-white/60 text-sm">Demo video coming soon</p>
                  <p className="text-white/40 text-xs mt-1">See research synthesis, meeting transcription, and more</p>
                </div>
              </div>
              {/* Decorative elements */}
              <div className="absolute top-4 left-4 flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
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
                IdiamPro is a true intelligence amplifier—it doesn&apos;t just store information, it enhances
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
                    Your brain can only hold so much. IdiamPro becomes your external memory—capturing every source,
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
                they can access and connect that knowledge. IdiamPro gives everyone an expert&apos;s cognitive edge.&rdquo;
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
                      Select any subtree and generate a professional podcast. Choose voices, style, and length.
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
                        Select any subtree and instantly create beautiful visual diagrams. Export or embed directly in your outline.
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

              {/* Row 4 - Export */}
              <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2 group relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-500/10 to-gray-500/10 border border-slate-500/20 p-8 hover:border-slate-500/40 transition-all duration-500">
                  <div className="flex items-start gap-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-500 to-gray-600 flex items-center justify-center shadow-lg shadow-slate-500/30 flex-shrink-0">
                      <Download className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">
                        Export Anywhere in 9 Formats
                      </h3>
                      <p className="text-white/60 text-sm mb-4">
                        Your data is never locked in. Export to PDF, Markdown, HTML (collapsible website), OPML, Obsidian with wiki-links, CSV, and more.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-2 py-1 rounded bg-white/10 text-white/60 text-xs">PDF</span>
                        <span className="px-2 py-1 rounded bg-white/10 text-white/60 text-xs">Markdown</span>
                        <span className="px-2 py-1 rounded bg-white/10 text-white/60 text-xs">HTML</span>
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

        {/* Why IdiamPro - Competitive Positioning */}
        <section id="features" className="px-6 py-24 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-violet-400 font-medium mb-2">Why Professionals Choose IdiamPro</p>
              <h2 className="text-3xl lg:text-5xl font-bold mb-4">
                Built for{' '}
                <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                  research-grade work
                </span>
              </h2>
              <p className="text-white/50 text-lg max-w-2xl mx-auto">
                Consumer note-taking apps weren't designed for professional research. IdiamPro was built from the ground up for serious knowledge synthesis.
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

              {/* What IdiamPro Does */}
              <div className="p-8 rounded-3xl bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-violet-500/30">
                <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center text-xs">✓</span>
                  What IdiamPro does differently
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
                <p className="text-violet-400 text-sm font-medium">IdiamPro: Fast, focused, AI-powered research</p>
              </div>
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                <h4 className="text-white font-semibold mb-2">vs. Obsidian</h4>
                <p className="text-white/40 text-sm mb-3">Steep learning curve, clunky mobile, no AI</p>
                <p className="text-violet-400 text-sm font-medium">IdiamPro: Intuitive, great mobile, AI-native</p>
              </div>
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                <h4 className="text-white font-semibold mb-2">vs. WorkFlowy</h4>
                <p className="text-white/40 text-sm mb-3">Dated UI, limited features, no source import</p>
                <p className="text-violet-400 text-sm font-medium">IdiamPro: Modern, 19 node types, AI synthesis</p>
              </div>
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                <h4 className="text-white font-semibold mb-2">vs. Roam</h4>
                <p className="text-white/40 text-sm mb-3">Expensive, cloud-only, performance issues</p>
                <p className="text-violet-400 text-sm font-medium">IdiamPro: Affordable, local-first, fast</p>
              </div>
            </div>

            {/* Feature Comparison Table */}
            <div className="mt-12 overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-4 px-4 text-white font-semibold">Feature</th>
                    <th className="text-center py-4 px-4">
                      <span className="text-violet-400 font-bold">IdiamPro</span>
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
                  Unlike cloud-first apps that hold your data hostage, IdiamPro is built local-first.
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
                From PhD dissertations to investigative journalism, IdiamPro powers knowledge work that matters.
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
                    A PhD candidate imported 47 research papers on computational biology. IdiamPro synthesized them into a coherent literature review organized by methodology, findings, and gaps.
                  </p>
                  <div className="text-blue-400 text-xs font-medium">Computational Biology • Stanford</div>
                </div>

                <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                  <div className="text-3xl font-bold text-amber-400 mb-2">12 hrs → 30 min</div>
                  <h4 className="text-white font-semibold mb-2">Field Interview Analysis</h4>
                  <p className="text-white/50 text-sm mb-4">
                    An industrial R&D team recorded 12 hours of stakeholder interviews across 3 sites. IdiamPro transcribed with speaker diarization and organized insights by theme.
                  </p>
                  <div className="text-amber-400 text-xs font-medium">Industrial Research • Fortune 500</div>
                </div>

                <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
                  <div className="text-3xl font-bold text-emerald-400 mb-2">2,400 docs</div>
                  <h4 className="text-white font-semibold mb-2">Legal Discovery</h4>
                  <p className="text-white/50 text-sm mb-4">
                    A litigation team processed 2,400 discovery documents including depositions, contracts, and communications. IdiamPro organized evidence by timeline and relevance.
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
                  <div className="text-white/40 text-xs">March 2026</div>
                </div>
                <div className="text-center group">
                  <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-white/10 transition-all">
                    <Code2 className="w-10 h-10 text-orange-400" />
                  </div>
                  <div className="text-white font-medium">Linux</div>
                  <div className="text-white/40 text-xs">March 2026</div>
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
                  <div className="text-white/40 text-xs">March 2026</div>
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
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
              <PricingCard
                name="Free"
                price="$0"
                description="For personal use and exploration"
                features={[
                  '3 outlines',
                  'All core features',
                  '10 AI generations/month',
                  '3-source research imports',
                  'Basic export formats'
                ]}
                cta="Get Started"
              />
              <PricingCard
                name="Basic"
                price="$9.99"
                period="/month"
                description="For regular knowledge workers"
                features={[
                  'Unlimited outlines',
                  '50 AI generations/month',
                  '20-source research imports',
                  'All export formats',
                  'Email support'
                ]}
                cta="Start Free Trial"
              />
              <PricingCard
                name="Premium"
                price="$29.99"
                period="/month"
                description="For power users and professionals"
                features={[
                  'Everything in Basic',
                  '100 AI generations/month',
                  '50+ source research imports',
                  'Claude & GPT-4 access',
                  'AI image generation',
                  'Podcast generation',
                  'Priority support'
                ]}
                cta="Start Free Trial"
                highlighted={true}
                badge="Most Popular"
              />
              <PricingCard
                name="Academic"
                price="$49.99"
                period="/month"
                description="For researchers and PhD students"
                features={[
                  'Everything in Premium',
                  'Unlimited AI operations',
                  'Claude Opus access',
                  'Advanced reasoning',
                  'Citation management',
                  'Dedicated support'
                ]}
                cta="Start Free Trial"
              />
            </div>

            <p className="text-center text-white/40 text-sm mt-8">
              All plans include a 14-day free trial. Cancel anytime.
            </p>

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
                      Be among the first to experience IdiamPro. Beta testers get <span className="text-emerald-400 font-semibold">free lifetime access to Pro features</span>,
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
              Join thousands of researchers, authors, and professionals who've upgraded their workflow with IdiamPro.
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
                  <span className="font-bold text-white">IdiamPro</span>
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
                © 2026 IdiamPro. All rights reserved.
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
