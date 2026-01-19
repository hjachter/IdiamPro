'use client';

import React, { useEffect, useState } from 'react';
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
  Play
} from 'lucide-react';

// Animated counter component
function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
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

    return () => clearInterval(timer);
  }, [value]);

  return <span>{count.toLocaleString()}{suffix}</span>;
}

// Feature card component
function FeatureCard({
  icon: Icon,
  title,
  description,
  gradient,
  delay
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  gradient: string;
  delay: number;
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={`group relative p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10
        hover:bg-white/10 hover:border-white/20 transition-all duration-500 hover:scale-105 hover:-translate-y-1
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className={`w-12 h-12 rounded-xl ${gradient} flex items-center justify-center mb-4
        group-hover:scale-110 transition-transform duration-300`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-white/60 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

// Role card for "Who It's For" section
function RoleCard({
  icon: Icon,
  role,
  useCase,
  gradient
}: {
  icon: React.ElementType;
  role: string;
  useCase: string;
  gradient: string;
}) {
  return (
    <div className="group flex items-start gap-3 p-3 rounded-xl hover:bg-white/5 transition-all duration-300">
      <div className={`w-10 h-10 rounded-lg ${gradient} flex items-center justify-center flex-shrink-0
        group-hover:scale-110 transition-transform duration-300`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <div className="font-medium text-white text-sm">{role}</div>
        <div className="text-white/40 text-xs">{useCase}</div>
      </div>
    </div>
  );
}

// Animated outline preview
function OutlinePreview() {
  const [activeNode, setActiveNode] = useState(0);
  const nodes = [
    { name: 'Research Synthesis', level: 0, hasContent: true },
    { name: 'Literature Review', level: 1, hasContent: true },
    { name: 'Source Analysis', level: 2, hasContent: false },
    { name: 'Key Findings', level: 2, hasContent: true },
    { name: 'AI-Generated Summary', level: 1, hasContent: true },
    { name: 'Export to Document', level: 1, hasContent: false },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveNode((prev) => (prev + 1) % nodes.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [nodes.length]);

  return (
    <div className="relative w-full max-w-md mx-auto">
      <div className="absolute inset-0 bg-gradient-to-r from-violet-500/20 via-purple-500/20 to-indigo-500/20 blur-3xl" />

      <div className="relative bg-gray-900/90 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/5">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <div className="flex-1 text-center">
            <span className="text-xs text-white/40 font-medium">IdiamPro</span>
          </div>
        </div>

        <div className="flex h-64">
          <div className="w-1/2 border-r border-white/10 p-3 space-y-1">
            {nodes.map((node, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all duration-300
                  ${activeNode === i ? 'bg-violet-500/30 text-white' : 'text-white/50 hover:text-white/70'}`}
                style={{ paddingLeft: `${8 + node.level * 16}px` }}
              >
                <ChevronRight className={`w-3 h-3 transition-transform ${activeNode === i ? 'rotate-90' : ''}`} />
                <span className="text-xs truncate">{node.name}</span>
                {node.hasContent && (
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 ml-auto" />
                )}
              </div>
            ))}
          </div>

          <div className="w-1/2 p-3">
            <div className="space-y-2">
              <div className="h-4 bg-white/20 rounded w-3/4 animate-pulse" />
              <div className="h-3 bg-white/10 rounded w-full" />
              <div className="h-3 bg-white/10 rounded w-5/6" />
              <div className="h-3 bg-white/10 rounded w-4/5" />
              <div className="mt-4 flex gap-2">
                <div className="px-2 py-1 bg-violet-500/30 rounded text-[10px] text-violet-300 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  AI Generated
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Floating particles background
function ParticlesBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 bg-white/20 rounded-full animate-float"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${5 + Math.random() * 10}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function SplashPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Target roles data from document
  const targetRoles = [
    { icon: BookMarked, role: 'Author / Novelist', useCase: 'Book outlines, characters, story arcs', gradient: 'bg-gradient-to-br from-amber-500 to-orange-600' },
    { icon: Microscope, role: 'Researcher / Scientist', useCase: 'Literature reviews, research gaps', gradient: 'bg-gradient-to-br from-blue-500 to-cyan-600' },
    { icon: GraduationCap, role: 'PhD Student', useCase: 'Thesis structure, exam prep', gradient: 'bg-gradient-to-br from-indigo-500 to-violet-600' },
    { icon: Scale, role: 'Attorney', useCase: 'Case briefs, legal research', gradient: 'bg-gradient-to-br from-slate-500 to-gray-600' },
    { icon: Target, role: 'Product Manager', useCase: 'PRDs, roadmaps, user stories', gradient: 'bg-gradient-to-br from-green-500 to-emerald-600' },
    { icon: Newspaper, role: 'Journalist', useCase: 'Source organization, story angles', gradient: 'bg-gradient-to-br from-red-500 to-rose-600' },
    { icon: Building2, role: 'Executive / CEO', useCase: 'Strategic plans, board decks', gradient: 'bg-gradient-to-br from-purple-500 to-violet-600' },
    { icon: BookOpen, role: 'Teacher / Professor', useCase: 'Curricula, lecture outlines', gradient: 'bg-gradient-to-br from-teal-500 to-cyan-600' },
    { icon: Video, role: 'YouTuber / Creator', useCase: 'Scripts, content calendars', gradient: 'bg-gradient-to-br from-pink-500 to-rose-600' },
    { icon: Lightbulb, role: 'Consultant', useCase: 'Client deliverables, frameworks', gradient: 'bg-gradient-to-br from-yellow-500 to-amber-600' },
    { icon: Code2, role: 'Software Developer', useCase: 'Architecture docs, tech specs', gradient: 'bg-gradient-to-br from-sky-500 to-blue-600' },
    { icon: Stethoscope, role: 'Medical Professional', useCase: 'CME notes, patient education', gradient: 'bg-gradient-to-br from-emerald-500 to-green-600' },
    { icon: Rocket, role: 'Entrepreneur', useCase: 'Business plans, pitch prep', gradient: 'bg-gradient-to-br from-orange-500 to-red-600' },
    { icon: Kanban, role: 'Project Manager', useCase: 'WBS diagrams, risk tracking', gradient: 'bg-gradient-to-br from-violet-500 to-purple-600' },
    { icon: Brain, role: 'Knowledge Worker', useCase: 'Second brain, book summaries', gradient: 'bg-gradient-to-br from-fuchsia-500 to-pink-600' },
  ];

  // Template data
  const templates = [
    { icon: BookMarked, label: 'Write a Book', desc: 'Chapters, scenes, characters', gradient: 'from-amber-500 to-orange-600', bgGlow: 'group-hover:shadow-amber-500/20' },
    { icon: Search, label: 'Research', desc: 'Sources, notes, synthesis', gradient: 'from-blue-500 to-cyan-600', bgGlow: 'group-hover:shadow-blue-500/20' },
    { icon: Heart, label: 'Wellness', desc: 'Goals, habits, reflections', gradient: 'from-pink-500 to-rose-600', bgGlow: 'group-hover:shadow-pink-500/20' },
    { icon: Kanban, label: 'Projects', desc: 'Tasks, milestones, docs', gradient: 'from-emerald-500 to-teal-600', bgGlow: 'group-hover:shadow-emerald-500/20' },
    { icon: MessagesSquare, label: 'Brainstorm', desc: 'Ideas, voting, decisions', gradient: 'from-violet-500 to-purple-600', bgGlow: 'group-hover:shadow-violet-500/20' },
    { icon: Rocket, label: 'Startup', desc: 'Pitch, business model', gradient: 'from-red-500 to-orange-600', bgGlow: 'group-hover:shadow-red-500/20' },
    { icon: GraduationCap, label: 'Thesis', desc: 'Literature, methodology', gradient: 'from-indigo-500 to-blue-600', bgGlow: 'group-hover:shadow-indigo-500/20' },
    { icon: Calendar, label: 'Event Planning', desc: 'Timeline, vendors, guests', gradient: 'from-fuchsia-500 to-pink-600', bgGlow: 'group-hover:shadow-fuchsia-500/20' },
    { icon: Home, label: 'Home Projects', desc: 'Renovations, contractors', gradient: 'from-lime-500 to-green-600', bgGlow: 'group-hover:shadow-lime-500/20' },
    { icon: Plane, label: 'Travel Planning', desc: 'Itinerary, bookings', gradient: 'from-sky-500 to-blue-600', bgGlow: 'group-hover:shadow-sky-500/20' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-hidden">
      {/* Animated gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-violet-950 via-gray-950 to-indigo-950" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/20 via-transparent to-transparent" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent" />

      <ParticlesBackground />

      {/* Content */}
      <div className="relative z-10">
        {/* Navigation */}
        <nav className="flex items-center justify-between px-6 py-4 lg:px-12">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
              IdiamPro
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              className="text-white/70 hover:text-white hidden md:inline-flex"
            >
              Features
            </Button>
            <Button
              variant="ghost"
              className="text-white/70 hover:text-white hidden md:inline-flex"
            >
              Pricing
            </Button>
            <Button
              onClick={() => router.push('/')}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20"
            >
              Launch App
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="px-6 pt-16 pb-24 lg:px-12 lg:pt-24">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className={`space-y-8 ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/20 border border-violet-500/30">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                  <span className="text-sm text-violet-300">AI-Powered Research & Writing</span>
                </div>

                <h1 className="text-4xl lg:text-6xl font-bold leading-tight">
                  <span className="bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
                    Synthesize Knowledge.
                  </span>
                  <br />
                  <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
                    Create Faster.
                  </span>
                </h1>

                <p className="text-lg text-white/60 max-w-lg leading-relaxed">
                  The AI-powered outlining platform that transforms how researchers, authors, and professionals
                  synthesize information and create content. Import sources, generate structured outlines, and
                  export publication-ready documents.
                </p>

                <div className="flex flex-wrap gap-4">
                  <Button
                    onClick={() => router.push('/')}
                    size="lg"
                    className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all duration-300"
                  >
                    Start Free
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="border-white/20 text-white hover:bg-white/10"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Watch Demo
                  </Button>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-8 pt-4">
                  <div>
                    <div className="text-2xl font-bold text-white"><AnimatedNumber value={50} suffix="+" /></div>
                    <div className="text-xs text-white/40">Features</div>
                  </div>
                  <div className="w-px h-8 bg-white/20" />
                  <div>
                    <div className="text-2xl font-bold text-white"><AnimatedNumber value={15} suffix="+" /></div>
                    <div className="text-xs text-white/40">Use Cases</div>
                  </div>
                  <div className="w-px h-8 bg-white/20" />
                  <div>
                    <div className="text-2xl font-bold text-white">
                      <AnimatedNumber value={10} suffix="x" />
                    </div>
                    <div className="text-xs text-white/40">Faster</div>
                  </div>
                </div>
              </div>

              <div className={`${mounted ? 'animate-fade-in-up animation-delay-300' : 'opacity-0'}`}>
                <OutlinePreview />
              </div>
            </div>
          </div>
        </section>

        {/* Killer Features Section */}
        <section className="px-6 py-24 lg:px-12 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-950/30 to-transparent" />
          <div className="max-w-6xl mx-auto relative">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold mb-4">
                What makes IdiamPro{' '}
                <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                  different
                </span>
              </h2>
              <p className="text-white/50 max-w-2xl mx-auto">
                Purpose-built for knowledge workers who need to synthesize, organize, and create.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Killer Feature 1 */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/20">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <Save className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-2">Ask AI: Save Great Answers Forever</h3>
                    <p className="text-white/50 text-sm leading-relaxed">
                      Traditional chat apps lose your AI answers in chat history. IdiamPro lets you save responses
                      directly to your outline—permanently searchable and organized.
                    </p>
                  </div>
                </div>
              </div>

              {/* Killer Feature 2 */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                    <GitBranch className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-2">Visual Diagrams from Any Subtree</h3>
                    <p className="text-white/50 text-sm leading-relaxed">
                      One-click Mind Map or Flowchart generation for any branch of your outline.
                      Auto-generated when creating content from children.
                    </p>
                  </div>
                </div>
              </div>

              {/* Killer Feature 3 */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
                    <Import className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-2">Research Mode: Any Source, Organized</h3>
                    <p className="text-white/50 text-sm leading-relaxed">
                      Import YouTube transcripts, PDFs, web pages, and documents. AI analyzes and organizes
                      into your outline structure with full source tracking.
                    </p>
                  </div>
                </div>
              </div>

              {/* Killer Feature 4 */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-orange-500/10 to-amber-500/10 border border-orange-500/20">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center flex-shrink-0">
                    <Globe className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-2">Cross-Platform, One Subscription</h3>
                    <p className="text-white/50 text-sm leading-relaxed">
                      Subscribe once, use on Mac, iPhone, iPad, and web. Your outlines sync seamlessly
                      everywhere you work.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Who It's For Section */}
        <section className="px-6 py-24 lg:px-12">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl lg:text-4xl font-bold mb-4">
                Built for{' '}
                <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                  every knowledge worker
                </span>
              </h2>
              <p className="text-white/50 max-w-2xl mx-auto">
                From PhD students to CEOs, IdiamPro adapts to your workflow.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
              {targetRoles.map((item, i) => (
                <RoleCard key={i} {...item} />
              ))}
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="px-6 py-24 lg:px-12 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-950/20 to-transparent" />
          <div className="max-w-6xl mx-auto relative">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold mb-4">
                Powerful features that{' '}
                <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                  amplify your work
                </span>
              </h2>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FeatureCard
                icon={Brain}
                title="AI Content Generation"
                description="Generate rich content from your outline structure with a single click. Context-aware AI that understands your document."
                gradient="bg-gradient-to-br from-violet-500 to-purple-600"
                delay={100}
              />
              <FeatureCard
                icon={ImageIcon}
                title="AI Image Creation"
                description="Create custom illustrations with Google Imagen 3. Describe what you need and insert instantly."
                gradient="bg-gradient-to-br from-pink-500 to-rose-600"
                delay={200}
              />
              <FeatureCard
                icon={Table}
                title="Inline Spreadsheets"
                description="Full Excel-like spreadsheets embedded in your outline. Formulas, formatting, multiple sheets—all saved locally."
                gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
                delay={300}
              />
              <FeatureCard
                icon={Mic}
                title="Voice Dictation"
                description="Speak your thoughts and watch them appear. Perfect for capturing ideas on the go."
                gradient="bg-gradient-to-br from-amber-500 to-orange-600"
                delay={400}
              />
              <FeatureCard
                icon={FileText}
                title="Rich Media Embeds"
                description="Embed YouTube videos, Google Docs, Sheets, Slides, Maps, and more. Your outline becomes a multimedia hub."
                gradient="bg-gradient-to-br from-blue-500 to-cyan-600"
                delay={500}
              />
              <FeatureCard
                icon={Network}
                title="Auto-Generated Diagrams"
                description="Transform any subtree into beautiful mind maps or flowcharts with one click."
                gradient="bg-gradient-to-br from-indigo-500 to-violet-600"
                delay={600}
              />
            </div>
          </div>
        </section>

        {/* Templates Section */}
        <section className="px-6 py-24 lg:px-12">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl lg:text-4xl font-bold mb-4">
                Start with a{' '}
                <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                  template
                </span>
              </h2>
              <p className="text-white/50 max-w-2xl mx-auto">
                Jump right in with pre-built structures. Click any template to begin.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-6">
              {templates.map((template, i) => (
                <button
                  key={i}
                  onClick={() => router.push('/?template=' + template.label.toLowerCase().replace(/\s+/g, '-'))}
                  className={`group relative p-5 rounded-2xl bg-white/5 border border-white/10
                    hover:bg-white/10 hover:border-white/20 hover:scale-105 hover:-translate-y-1
                    transition-all duration-300 text-left shadow-lg ${template.bgGlow}`}
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${template.gradient}
                    flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                    <template.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-white mb-1 group-hover:text-white transition-colors">
                    {template.label}
                  </h3>
                  <p className="text-white/40 text-xs leading-relaxed group-hover:text-white/60 transition-colors">
                    {template.desc}
                  </p>
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="w-4 h-4 text-white/60" />
                  </div>
                </button>
              ))}
            </div>

            <div className="text-center mt-8">
              <p className="text-white/40 text-sm">
                ...or start with a blank outline and build your own structure
              </p>
            </div>
          </div>
        </section>

        {/* Platform Section */}
        <section className="px-6 py-24 lg:px-12 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-950/20 to-transparent" />
          <div className="max-w-4xl mx-auto relative text-center">
            <h2 className="text-3xl lg:text-4xl font-bold mb-6">
              Works everywhere you do
            </h2>
            <p className="text-white/50 mb-12 max-w-2xl mx-auto">
              Start on your Mac, continue on your iPhone, finish on your iPad. Your outlines sync seamlessly.
            </p>

            <div className="flex justify-center items-center gap-8 mb-12">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
                  <Monitor className="w-8 h-8 text-violet-400" />
                </div>
                <div className="text-sm text-white/60">Mac</div>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
                  <Laptop className="w-8 h-8 text-violet-400" />
                </div>
                <div className="text-sm text-white/60">Web</div>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
                  <Smartphone className="w-8 h-8 text-violet-400" />
                </div>
                <div className="text-sm text-white/60">iPhone</div>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
                  <Presentation className="w-8 h-8 text-violet-400" />
                </div>
                <div className="text-sm text-white/60">iPad</div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonial / Quote Section */}
        <section className="px-6 py-24 lg:px-12">
          <div className="max-w-4xl mx-auto">
            <div className="relative p-8 lg:p-12 rounded-3xl bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-white/10">
              <Quote className="w-12 h-12 text-violet-400/50 mb-6" />
              <blockquote className="text-2xl lg:text-3xl font-medium text-white leading-relaxed mb-6">
                "Democratize knowledge synthesis and accelerate human creativity with AI."
              </blockquote>
              <p className="text-white/50">
                Our vision: A world where anyone can synthesize complex information from hundreds of sources
                and transform it into publication-ready work in hours instead of months.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-6 py-24 lg:px-12">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl lg:text-5xl font-bold mb-6">
              Ready to transform how you{' '}
              <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                think and create?
              </span>
            </h2>
            <p className="text-white/50 mb-8 text-lg">
              Join researchers, authors, and professionals who've upgraded their workflow with IdiamPro.
            </p>
            <Button
              onClick={() => router.push('/')}
              size="lg"
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-lg px-8 py-6 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all duration-300"
            >
              Start Creating Free
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <p className="text-white/30 text-sm mt-4">
              No credit card required. Free tier forever.
            </p>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-6 py-8 lg:px-12 border-t border-white/10">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-violet-400" />
              <span className="text-white/60">IdiamPro</span>
            </div>
            <p className="text-white/40 text-sm">
              Built for thinkers, writers, and creators.
            </p>
          </div>
        </footer>
      </div>

      {/* Custom animations */}
      <style jsx global>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
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

        .animation-delay-300 {
          animation-delay: 300ms;
        }

        .animate-float {
          animation: float ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
