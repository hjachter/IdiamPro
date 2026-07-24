'use client';

// "About IdeaM" — a dedicated marketing sub-page introducing the product and the
// company (SecondBrainWare LLC) in the same IBM/Carbon look as the rest of the
// site: flat high-contrast white ground, IBM Plex type, blue accents, vivid blue
// CTA. Structure mirrors the other subpages (features/use-cases/pricing/faq/founder):
// shared MarketingHeader, a "Back to home" pill, a Plex-Mono eyebrow + big headline
// hero, then narrative sections, closing with the same site footer used on the
// homepage.
//
// NOTE: The company's physical mailing address is DEFERRED — it will be added to the
// Contact section once Howard has it (needed for CAN-SPAM / privacy policy / app stores).
// Until then this page shows only the real support email, so it carries NO placeholders
// and is safe to publish live.

import React from 'react';
import Link from 'next/link';
import { MarketingHeader } from '@/components/marketing/marketing-header';
import { AmplifyMark } from '@/components/brand/amplify-mark';
import { ArrowLeft, Mail, Shield, Wrench } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="fixed inset-0 bg-white text-[#0b1533] overflow-x-hidden overflow-y-auto">
      {/* Flat, crisp white ground — matching the engineered IBM/Carbon homepage. */}
      <div className="fixed inset-0 bg-white" />
      <div className="relative z-10">
        <MarketingHeader />
        <main className="pt-28 lg:pt-32">
          <div className="px-6 lg:px-12 max-w-3xl mx-auto">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full border border-blue-600/30 px-4 py-1.5 text-sm text-blue-600 hover:bg-blue-600/10 hover:border-blue-600/50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to home
            </Link>
          </div>

          {/* Hero */}
          <section className="px-6 lg:px-12">
            <div className="max-w-3xl mx-auto pt-10 pb-8">
              <div className="text-sm font-mono font-semibold text-[#1e40af] uppercase tracking-wider mb-4">
                About IdeaM
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-[#0b1533] leading-[1.12] mb-6">
                The Idea Workbench —{' '}
                <span className="bg-gradient-to-r from-[#38bdf8] via-[#2563eb] to-[#4f46e5] bg-clip-text text-transparent">
                  the engineering of thought.
                </span>
              </h1>
              <p className="text-xl md:text-2xl text-[#2b3a5c] font-medium leading-relaxed mb-2">
                IdeaM is where a raw thought becomes a real idea — and a real idea becomes finished work you can share with the world.
              </p>
              <p className="text-base text-[#5b6b85]">
                A product of SecondBrainWare LLC. Privacy-first. Local-first.
              </p>
            </div>
          </section>

          {/* Mission / Story — DRAFT founder-voice narrative */}
          <section className="px-6 lg:px-12">
            <div className="max-w-3xl mx-auto py-10 border-t border-[#dde5f2]">
              <h2 className="text-2xl md:text-3xl font-bold text-[#0b1533] mb-5">
                Why we built IdeaM
              </h2>
              <div className="space-y-5 text-lg text-[#2b3a5c] font-medium leading-relaxed">
                <p>
                  Good ideas rarely arrive finished. They show up as a half-formed thought in the shower, a sentence scribbled on a napkin, a hunch you can&rsquo;t quite explain yet. The hard part was never having ideas — it was the long, lonely distance between a spark and something real enough to put in front of other people.
                </p>
                <p>
                  We built IdeaM to close that distance. We call it the Idea Workbench: the engineering of thought. It takes a raw thought and helps you develop it into a genuine idea — questioning it, structuring it, connecting it to what you already know. Then it helps you produce the finished work: the writing, the podcast, the video. And when the work is ready, it helps you get it out to every major platform in your own voice, and even handle your email at a level you didn&rsquo;t think was possible.
                </p>
                <p>
                  We&rsquo;re privacy-first and local-first by conviction, not as a marketing line. Your thinking lives on your device, under your control. Your ideas are yours — we don&rsquo;t mine them, sell them, or train on them.
                </p>
                <p>
                  IdeaM is built for professional thinkers and for students — anyone whose real work is thinking, and who wants a serious tool to do it with. We&rsquo;re a small company with a large ambition: to give everyone the workbench that turns thought into finished, published work.
                </p>
              </div>

              {/* Three pillars */}
              <div className="grid sm:grid-cols-3 gap-4 mt-10">
                <div className="rounded-xl border border-[#dde5f2] bg-[#f7faff] p-5">
                  <Wrench className="w-5 h-5 text-blue-600 mb-3" />
                  <div className="text-base font-semibold text-[#0b1533] mb-1">Thought to finished work</div>
                  <p className="text-sm text-[#5b6b85] leading-relaxed">Develop a raw idea into writing, podcasts, and video — without rebuilding it each time.</p>
                </div>
                <div className="rounded-xl border border-[#dde5f2] bg-[#f7faff] p-5">
                  <Shield className="w-5 h-5 text-blue-600 mb-3" />
                  <div className="text-base font-semibold text-[#0b1533] mb-1">Privacy-first, local-first</div>
                  <p className="text-sm text-[#5b6b85] leading-relaxed">Your ideas stay on your device, under your control. We don&rsquo;t sell or train on your data.</p>
                </div>
                <div className="rounded-xl border border-[#dde5f2] bg-[#f7faff] p-5">
                  <Mail className="w-5 h-5 text-blue-600 mb-3" />
                  <div className="text-base font-semibold text-[#0b1533] mb-1">Out into the world</div>
                  <p className="text-sm text-[#5b6b85] leading-relaxed">Publish to every major platform in your own voice — and handle email at a new level.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Founder — real content, folded in from the retired /founder page */}
          <section className="px-6 lg:px-12">
            <div className="max-w-3xl mx-auto py-10 border-t border-[#dde5f2]">
              <div className="text-sm font-mono font-semibold text-[#1e40af] uppercase tracking-wider mb-4">
                About Our Founder
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-[#0b1533] leading-[1.15] mb-6">
                He spent a career turning problems into solutions.{' '}
                <span className="bg-gradient-to-r from-[#38bdf8] via-[#2563eb] to-[#4f46e5] bg-clip-text text-transparent">
                  IdeaM is that craft, in your hands.
                </span>
              </h2>
              <p className="text-xl text-[#2b3a5c] font-medium leading-relaxed mb-6">
                Howard Jachter built IdeaM to do, for everyone, what he spent a lifetime doing for the world&rsquo;s leading companies.
              </p>

              {/* Byline */}
              <div className="mb-8">
                <div className="text-base font-semibold text-[#0b1533]">Howard Jachter</div>
                <div className="text-sm text-[#5b6b85]">
                  Founder, SecondBrainWare &middot; creator of IdeaM
                </div>
              </div>

              {/* Lead editorial photo of the founder */}
              <figure className="overflow-hidden rounded-2xl border border-[#dde5f2] shadow-lg shadow-blue-900/10 mb-10">
                <img
                  src="/founder-howard.jpg"
                  alt="Howard Jachter, founder of IdeaM."
                  className="block w-full h-auto max-w-full object-cover"
                />
              </figure>

              {/* The through-line */}
              <h3 className="text-xl md:text-2xl font-bold text-[#0b1533] mb-4">
                The through-line
              </h3>
              <p className="text-lg text-[#2b3a5c] font-medium leading-relaxed mb-6">
                For decades, Howard&rsquo;s specialty had a name in the corporate world: technology insertion &mdash; finding the right emerging technology and using it to turn a business problem into an automated solution. He did it for some of the world&rsquo;s leading technology and industrial organizations, and along the way he literally transformed the way thousands of employees work every day &mdash; vastly improving their productivity, with real, measurable benefit to their companies.
              </p>

              {/* Pull-quote */}
              <blockquote className="my-8 border-l-4 border-blue-600 bg-gradient-to-br from-blue-600/5 to-blue-600/5 rounded-r-2xl pl-6 pr-6 py-5">
                <p className="text-xl md:text-2xl font-semibold text-[#0b1533] leading-snug">
                  IdeaM is that same craft, productized. What he once delivered to a Fortune 500 one engagement at a time, IdeaM now offers to anyone.
                </p>
              </blockquote>

              <p className="text-lg text-[#2b3a5c] font-medium leading-relaxed mb-10">
                You bring an idea, or a problem. IdeaM inserts today&rsquo;s most powerful technology &mdash; AI &mdash; and helps you turn it into something finished: a document, a plan, a course, a book, a business.
              </p>

              {/* A scientist who became a builder */}
              <h3 className="text-xl md:text-2xl font-bold text-[#0b1533] mb-4">
                A scientist who became a builder
              </h3>
              <p className="text-lg text-[#2b3a5c] font-medium leading-relaxed mb-10">
                His path was never narrow. Trained as a biophysicist, he was drawn early to a single question &mdash; how people turn scattered information into real understanding. He moved into computer science, taught it at the university level, and spent the heart of his career at the frontier: the person companies called on to find &ldquo;the tools of the future&rdquo; and put them to work.
              </p>

              {/* An idea in the making for decades */}
              <h3 className="text-xl md:text-2xl font-bold text-[#0b1533] mb-4">
                An idea in the making for decades
              </h3>
              <p className="text-lg text-[#2b3a5c] font-medium leading-relaxed mb-8">
                IdeaM was no sudden inspiration. Howard first presented the concept &mdash; then called &ldquo;Idiam&rdquo; &mdash; in a university seminar in 2005. It was received well enough that the university offered him a professorship on the strength of it. He carried the vision for years, waiting for the technology to catch up. When AI finally arrived, he seized it &mdash; and built the entire product with it.
              </p>

              {/* Emphasized closing line */}
              <div className="rounded-2xl border border-blue-600/20 bg-gradient-to-br from-blue-600/5 via-blue-600/5 to-blue-600/5 p-8 md:p-10 mb-10">
                <p className="text-xl md:text-2xl font-semibold text-[#0b1533] leading-snug">
                  He didn&rsquo;t wander into building an app. He built the tool he&rsquo;d spent a lifetime imagining &mdash; one that helps you make the impossible possible.
                </p>
              </div>

              {/* Footnote — a light personality beat to close on a smile */}
              <figure className="max-w-sm mx-auto">
                <img
                  src="/founder-client-joke.jpg"
                  alt="Howard Jachter beside a bronze prospector statue outside a cafe."
                  className="block w-full h-auto max-w-full rounded-xl border border-[#dde5f2] shadow-md shadow-blue-900/5 object-cover"
                />
                <figcaption className="mt-2.5 text-center text-sm italic text-[#8a97ad]">
                  Howard talking to a client.
                </figcaption>
              </figure>
            </div>
          </section>

          {/* Contact + Mailing Address */}
          <section className="px-6 lg:px-12">
            <div className="max-w-3xl mx-auto py-10 border-t border-[#dde5f2]">
              <h2 className="text-2xl md:text-3xl font-bold text-[#0b1533] mb-6">
                Contact
              </h2>
              <div className="max-w-md">
                {/* Support email — real */}
                <div className="rounded-xl border border-[#dde5f2] bg-[#f7faff] p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Mail className="w-5 h-5 text-blue-600" />
                    <div className="text-base font-semibold text-[#0b1533]">Support</div>
                  </div>
                  <a href="mailto:support@2ndbrainware.com" className="text-blue-600 hover:underline font-medium">
                    support@2ndbrainware.com
                  </a>
                  <p className="text-sm text-[#5b6b85] mt-2">
                    Questions, feedback, or help — we read every message.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Footer — same structure as the homepage footer */}
          <footer className="px-6 py-12 lg:px-12 border-t border-[#dde5f2]">
            <div className="max-w-[1600px] mx-auto">
              <div className="grid md:grid-cols-3 gap-8 mb-12">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <AmplifyMark className="w-8 h-8 rounded-lg" />
                    <span className="flex flex-col leading-none">
                      <span className="text-lg font-extrabold tracking-tight leading-none">
                        <span className="text-[#0b1533]">Idea</span><span className="text-blue-600">M</span>
                      </span>
                      <span className="text-[9px] text-[#5b6b85] tracking-[0.15em] uppercase mt-1">by SecondBrainWare</span>
                    </span>
                  </div>
                  <p className="text-[#475569] text-sm mb-2">
                    Your Intelligence Amplifier.
                  </p>
                  <p className="text-[#5b6b85] text-xs">
                    Build your second brain. Expand your knowledge. See what others miss.
                  </p>
                </div>

                <div>
                  <h4 className="text-[#0b1533] font-semibold mb-4">Product</h4>
                  <ul className="space-y-2">
                    <li><a href="/features" className="text-[#475569] hover:text-[#0b1533] text-sm transition-colors">Features</a></li>
                    <li><a href="/pricing" className="text-[#475569] hover:text-[#0b1533] text-sm transition-colors">Pricing</a></li>
                    <li><a href="/use-cases" className="text-[#475569] hover:text-[#0b1533] text-sm transition-colors">Use Cases</a></li>
                    <li><a href="/faq" className="text-[#475569] hover:text-[#0b1533] text-sm transition-colors">FAQ</a></li>
                    <li><a href="/about" className="text-[#475569] hover:text-[#0b1533] text-sm transition-colors">About</a></li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-[#0b1533] font-semibold mb-4">Legal</h4>
                  <ul className="space-y-2">
                    <li><a href="/privacy" className="text-[#475569] hover:text-[#0b1533] text-sm transition-colors">Privacy</a></li>
                  </ul>
                </div>
              </div>

              <div className="pt-8 border-t border-[#dde5f2]">
                <p className="text-[#5b6b85] text-sm">
                  © 2026 SecondBrainWare LLC. All rights reserved.
                </p>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
