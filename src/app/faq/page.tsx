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


export default function FaqPage() {
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
      <div className="fixed inset-0 bg-gradient-to-br from-white via-white to-white" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-600/[0.10] via-transparent to-transparent" />
      <div className="relative z-10">
        <MarketingHeader />
        <main className="pt-28 lg:pt-32">
          <div className="px-6 lg:px-12 max-w-7xl mx-auto">
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to home
            </Link>
          </div>
          <div className="text-center px-6 pt-8 pb-6 lg:px-12">
            <div className="text-sm font-medium text-teal-600 uppercase tracking-wider mb-2">Frequently asked questions</div>
            <h1 className="text-4xl md:text-5xl font-bold text-[#0c2224]">FAQ</h1>
          </div>
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

        <section className="px-6 py-20 lg:px-12">
          <div className="max-w-4xl mx-auto text-center">
            <Link href="/" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#0E7C7B] to-[#0E7C7B] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-600/25 hover:from-[#0c5c5b] hover:to-[#0c5c5b] transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to home
            </Link>
          </div>
        </section>
        </main>
      </div>
    </div>
  );
}
