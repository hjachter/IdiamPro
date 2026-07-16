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

// NOTE: Final prices are NOT set yet. The figures shown below are placeholders
// carried over from the homepage; do not treat them as final. Keep this page
// distinct from the in-app /upgrade purchase flow.

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
        <p className="text-[#22312f] text-base font-medium">{description}</p>
      </div>

      <div className="mb-6">
        <span className="text-4xl font-bold text-[#0c2224]">{price}</span>
        {period && <span className="text-[#6b7d7e] ml-1">{period}</span>}
      </div>

      <ul className="space-y-3 mb-8">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-3 text-base">
            <Check className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
            <span className="text-[#22312f]">{feature}</span>
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


export default function PricingPage() {
  return (
    <div className="fixed inset-0 bg-white text-[#0c2224] overflow-x-hidden overflow-y-auto">
      <div className="fixed inset-0 bg-gradient-to-br from-white via-white to-white" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-600/[0.10] via-transparent to-transparent" />
      <div className="relative z-10">
        <MarketingHeader />
        <main className="pt-28 lg:pt-32">
          <div className="px-6 lg:px-12 max-w-7xl mx-auto">
            <Link href="/" className="inline-flex items-center gap-1.5 rounded-full border border-teal-600/30 px-4 py-1.5 text-sm text-teal-600 hover:bg-teal-600/10 hover:border-teal-600/50 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to home
            </Link>
          </div>
          <div className="text-center px-6 pt-8 pb-6 lg:px-12">
            <div className="text-sm font-medium text-teal-600 uppercase tracking-wider mb-2">Simple and transparent</div>
            <h1 className="text-4xl md:text-5xl font-bold text-[#0c2224]">Pricing</h1>
          </div>
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
              <p className="text-[#22312f] text-lg md:text-xl font-medium max-w-2xl mx-auto mt-4">
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
                <p className="text-[#22312f] text-lg font-medium leading-relaxed">
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
                <p className="text-[#22312f] text-lg font-medium leading-relaxed">
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
                <p className="text-[#22312f] text-lg font-medium leading-relaxed">
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
                <p className="text-[#22312f] text-base sm:text-lg font-medium">
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
              <p className="text-[#22312f] text-lg md:text-xl font-medium max-w-2xl mx-auto">
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

            <p className="text-center text-[#22312f] text-base font-medium mt-8">
              All plans include a 14-day free trial. Cancel anytime.
            </p>

            {/* Comparison grid — 4-option split */}
            <div className="mt-20">
              <h3 className="text-center text-2xl lg:text-3xl font-bold mb-2">
                Compare what you get
              </h3>
              <p className="text-center text-[#22312f] text-base font-medium mb-8">
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
                    <p className="text-[#22312f] text-lg font-medium">50% off for students and educators with valid .edu email</p>
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
                    <p className="text-[#22312f] text-lg font-medium max-w-xl">
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
