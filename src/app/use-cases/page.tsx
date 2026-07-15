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


export default function UseCasesPage() {
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
            <div className="text-sm font-medium text-teal-600 uppercase tracking-wider mb-2">Who it's for</div>
            <h1 className="text-4xl md:text-5xl font-bold text-[#0c2224]">Use Cases</h1>
          </div>
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
