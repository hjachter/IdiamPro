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
  Languages,
  AlertTriangle
} from 'lucide-react';

const SIGNUP_URL = '/signup';
const launchApp = () => {
  window.location.href = SIGNUP_URL;
};

// FAQ Item
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-[#dde5f2] last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-5 flex items-center justify-between text-left"
      >
        <span className="text-[#0b1533] font-medium pr-8">{question}</span>
        <ChevronDown className={`w-5 h-5 text-[#64748b] transition-transform duration-300 flex-shrink-0
          ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-96 pb-5' : 'max-h-0'}`}>
        <p className="text-[#2b3a5c] text-base font-medium leading-relaxed">{answer}</p>
      </div>
    </div>
  );
}


export default function FaqPage() {
  const faqs = [
    {
      question: 'How is IdeaM different from Notion or Obsidian?',
      answer: 'IdeaM is purpose-built for research synthesis and content creation. Unlike general note-taking apps, we focus on importing multiple sources (YouTube, PDFs, audio) and using AI to synthesize them into structured outlines. Our multi-source analysis and speaker diarization features are unique to IdeaM.'
    },
    {
      question: 'Can I import my existing notes?',
      answer: 'Yes! IdeaM supports importing from Markdown, OPML, plain text, and JSON formats. You can also import content from PDFs, Word documents, web pages, and even YouTube videos with automatic transcription.'
    },
    {
      question: 'Is my data private and secure?',
      answer: 'Absolutely. IdeaM uses a local-first architecture—your outlines are stored on your device by default. When you use AI features, your content is sent securely to process but is never used to train AI models. We never sell your data.'
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
      answer: 'IdeaM offers 23 export formats: PDF, Markdown, HTML (collapsible website), Word, LaTeX, EPUB, Plain Text, OPML, Obsidian (with wiki-links), Notion, CSV, JSON Tree, and more. Your data is never locked in.'
    }
  ];

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
            <div className="text-sm font-mono font-semibold text-[#1e40af] uppercase tracking-wider mb-2">Frequently asked questions</div>
            <h1 className="text-4xl md:text-5xl font-bold text-[#0b1533]">FAQ</h1>
          </div>
        {/* FAQ */}
        <section id="faq" className="px-6 py-24 lg:px-12">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-5xl font-bold mb-4">
                Frequently asked{' '}
                <span className="bg-gradient-to-r from-blue-600 to-blue-600 bg-clip-text text-transparent">
                  questions
                </span>
              </h2>
            </div>

            <div className="bg-[#f7faff] rounded-2xl border border-[#dde5f2] p-6 lg:p-8">
              {faqs.map((faq, i) => (
                <FAQItem key={i} {...faq} />
              ))}
            </div>

            {/* Keep your work safe — DELIBERATE RED LIABILITY-DISCLAIMER treatment.
                Relocated here from the homepage (reviewer feedback 2026-07-20): a
                heavy warning belongs where someone is setting up, not on the front
                door. Local-first: files live on the user's device (desktop) or in
                the browser's storage (web), so off-device backup is the user's
                responsibility. Content preserved verbatim. Carbon-flat red notice —
                high contrast on white, no flashing. */}
            <div className="mt-12">
              <div className="relative overflow-hidden rounded-2xl border-2 border-red-500 bg-red-50 p-7 sm:p-9 shadow-lg shadow-red-500/15">
                <div className="flex flex-col sm:flex-row sm:items-start gap-5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-red-700 text-white shadow-md shadow-red-600/25">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="inline-flex items-center rounded-full bg-red-600 px-3 py-1 text-xs font-mono font-semibold uppercase tracking-wider text-white">
                        Important — please read
                      </span>
                    </div>
                    <h3 className="text-2xl md:text-3xl font-extrabold text-red-700 tracking-tight mb-3">
                      Keep your work safe — back it up
                    </h3>
                    <p className="text-lg leading-relaxed mb-3">
                      <span className="font-bold text-red-700">Your work lives on your own device, and keeping it safe is ultimately your responsibility. Store your IdeaM files in a location that&apos;s automatically backed up.</span>
                      <span className="text-[#2b3a5c]"> The method is your choice — iCloud Drive, Dropbox, Google Drive, OneDrive, a Time Machine disk, or any backup you trust. IdeaM keeps automatic local snapshots as a safety net, but they are </span>
                      <span className="font-bold text-red-700">not a substitute for your own off-device backup.</span>
                    </p>
                    <p className="text-lg leading-relaxed mb-4">
                      <span className="font-bold text-red-700">Using the free web version in a browser? Your work is saved inside that browser, on that device — and it can be lost if you clear your browser data, use private/incognito mode, or switch browsers.</span>
                      <span className="text-[#2b3a5c]"> Export your outlines regularly and keep the copies in a backed-up location.</span>
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
                      <div className="mb-2 text-xs font-mono font-semibold uppercase tracking-wider text-red-700">
                        More ways to protect your work
                      </div>
                      <ul className="grid gap-2 text-base text-[#2b3a5c] sm:grid-cols-2">
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
                      <span className="text-sm font-medium text-[#0b1533]">
                        Not sure what to pick? Ask <span className="font-bold">IdeaM Help</span> and we&apos;ll walk you through it.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 py-20 lg:px-12">
          <div className="max-w-4xl mx-auto text-center">
            <Link href="/" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#38bdf8] via-[#2563eb] to-[#4f46e5] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 hover:from-[#2563eb] hover:to-[#4338ca] transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to home
            </Link>
          </div>
        </section>
        </main>
      </div>
    </div>
  );
}
