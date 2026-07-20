'use client';

// "About Our Founder" — a dedicated marketing sub-page telling Howard Jachter's
// story in the same IBM/Carbon look as the rest of the site: flat high-contrast
// white ground, IBM Plex type, blue accents, vivid blue CTA. Structure mirrors
// the other subpages (features/use-cases/pricing/faq): shared MarketingHeader,
// a "Back to home" pill, a Plex-Mono eyebrow + big headline hero, then narrative
// sections, closing with the same site footer used on the homepage.

import React from 'react';
import Link from 'next/link';
import { MarketingHeader } from '@/components/marketing/marketing-header';
import { AmplifyMark } from '@/components/brand/amplify-mark';
import { ArrowLeft, User } from 'lucide-react';

export default function FounderPage() {
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
                About Our Founder
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-[#0b1533] leading-[1.12] mb-6">
                He spent a career turning problems into solutions.{' '}
                <span className="bg-gradient-to-r from-[#38bdf8] via-[#2563eb] to-[#4f46e5] bg-clip-text text-transparent">
                  IdeaM is that craft, in your hands.
                </span>
              </h1>
              <p className="text-xl md:text-2xl text-[#2b3a5c] font-medium leading-relaxed mb-6">
                Howard Jachter built IdeaM to do, for everyone, what he spent a lifetime doing for the world&rsquo;s leading companies.
              </p>

              {/* Byline + a tasteful placeholder for a future headshot */}
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-2xl border border-dashed border-[#c3d0e8] bg-[#f7faff] flex items-center justify-center flex-shrink-0"
                  aria-hidden="true"
                >
                  <User className="w-7 h-7 text-[#9db0d0]" />
                </div>
                <div>
                  <div className="text-base font-semibold text-[#0b1533]">Howard Jachter</div>
                  <div className="text-sm text-[#5b6b85]">
                    Founder, SecondBrainWare &middot; creator of IdeaM
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* The through-line */}
          <section className="px-6 lg:px-12">
            <div className="max-w-3xl mx-auto py-10 border-t border-[#dde5f2]">
              <h2 className="text-2xl md:text-3xl font-bold text-[#0b1533] mb-5">
                The through-line
              </h2>
              <p className="text-lg text-[#2b3a5c] font-medium leading-relaxed mb-6">
                For decades, Howard&rsquo;s specialty had a name in the corporate world: technology insertion &mdash; finding the right emerging technology and using it to turn a business problem into an automated solution. He did it for some of the world&rsquo;s leading technology and industrial organizations, and along the way he literally transformed the way thousands of employees work every day &mdash; vastly improving their productivity, with real, measurable benefit to their companies.
              </p>

              {/* Pull-quote */}
              <blockquote className="my-8 border-l-4 border-blue-600 bg-gradient-to-br from-blue-600/5 to-blue-600/5 rounded-r-2xl pl-6 pr-6 py-5">
                <p className="text-xl md:text-2xl font-semibold text-[#0b1533] leading-snug">
                  IdeaM is that same craft, productized. What he once delivered to a Fortune 500 one engagement at a time, IdeaM now offers to anyone.
                </p>
              </blockquote>

              <p className="text-lg text-[#2b3a5c] font-medium leading-relaxed">
                You bring an idea, or a problem. IdeaM inserts today&rsquo;s most powerful technology &mdash; AI &mdash; and helps you turn it into something finished: a document, a plan, a course, a book, a business.
              </p>
            </div>
          </section>

          {/* A scientist who became a builder */}
          <section className="px-6 lg:px-12">
            <div className="max-w-3xl mx-auto py-10 border-t border-[#dde5f2]">
              <h2 className="text-2xl md:text-3xl font-bold text-[#0b1533] mb-5">
                A scientist who became a builder
              </h2>
              <p className="text-lg text-[#2b3a5c] font-medium leading-relaxed">
                His path was never narrow. Trained as a biophysicist, he was drawn early to a single question &mdash; how people turn scattered information into real understanding. He moved into computer science, taught it at the university level, and spent the heart of his career at the frontier: the person companies called on to find &ldquo;the tools of the future&rdquo; and put them to work.
              </p>
            </div>
          </section>

          {/* An idea in the making for decades */}
          <section className="px-6 lg:px-12">
            <div className="max-w-3xl mx-auto py-10 border-t border-[#dde5f2]">
              <h2 className="text-2xl md:text-3xl font-bold text-[#0b1533] mb-5">
                An idea in the making for decades
              </h2>
              <p className="text-lg text-[#2b3a5c] font-medium leading-relaxed mb-8">
                IdeaM was no sudden inspiration. Howard first presented the concept &mdash; then called &ldquo;Idiam&rdquo; &mdash; in a university seminar in 2005. It was received well enough that the university offered him a professorship on the strength of it. He carried the vision for years, waiting for the technology to catch up. When AI finally arrived, he seized it &mdash; and built the entire product with it.
              </p>

              {/* Emphasized closing line */}
              <div className="rounded-2xl border border-blue-600/20 bg-gradient-to-br from-blue-600/5 via-blue-600/5 to-blue-600/5 p-8 md:p-10">
                <p className="text-xl md:text-2xl font-semibold text-[#0b1533] leading-snug">
                  He didn&rsquo;t wander into building an app. He built the tool he&rsquo;d spent a lifetime imagining &mdash; one that helps you make the impossible possible.
                </p>
              </div>
            </div>
          </section>

          {/* CTA */}
          <section className="px-6 py-16 lg:px-12">
            <div className="max-w-3xl mx-auto text-center">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-[#38bdf8] via-[#2563eb] to-[#4f46e5] hover:from-[#2563eb] hover:to-[#4338ca] px-7 py-3.5 text-base font-bold text-white shadow-lg shadow-blue-700/30 transition-colors"
              >
                Start free
              </Link>
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
                    <li><a href="/founder" className="text-[#475569] hover:text-[#0b1533] text-sm transition-colors">About the Founder</a></li>
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
                  © 2026 SecondBrainWare. All rights reserved.
                </p>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
