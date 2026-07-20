'use client';

// Shared shell for the "example gallery" marketing pages (/examples/*).
// Provides the CLARITY-themed page chrome: marketing header, a hero band with
// eyebrow + title + subtitle, a back-to-home affordance, the gallery body, and
// a closing "Start free" CTA. Keeps every example page visually consistent.

import React from 'react';
import Link from 'next/link';
import { MarketingHeader } from '@/components/marketing/marketing-header';
import { Button } from '@/components/ui/button';
import { ArrowRight, ArrowLeft } from 'lucide-react';

const SIGNUP_URL = '/signup';

export function ExamplesShell({
  eyebrow,
  eyebrowIcon,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  eyebrowIcon?: React.ReactNode;
  title: React.ReactNode;
  subtitle: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-[#fbfdff] text-[#0b1533] overflow-x-hidden overflow-y-auto">
      <MarketingHeader />

      {/* Hero band */}
      <section className="px-6 pt-32 pb-12 lg:px-12">
        <div className="max-w-6xl mx-auto">
          {/* Back to home — rounded, clear affordance */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-[#cbd5e1] bg-white px-4 py-2 text-sm font-semibold text-[#1e40af] hover:bg-blue-600/10 hover:border-blue-600/50 transition-colors shadow-sm mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600/15 border border-blue-600/40 mb-6">
            {eyebrowIcon}
            <span className="text-sm font-semibold text-[#1e40af]">{eyebrow}</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.05] mb-5 max-w-3xl">
            {title}
          </h1>
          <p className="text-lg md:text-xl text-[#2b3a5c] leading-relaxed max-w-2xl">
            {subtitle}
          </p>
        </div>
      </section>

      {/* Gallery body */}
      <section className="px-6 pb-8 lg:px-12">
        <div className="max-w-6xl mx-auto">{children}</div>
      </section>

      {/* Closing CTA */}
      <section className="px-6 py-20 lg:px-12">
        <div className="max-w-4xl mx-auto text-center rounded-3xl border border-[#dde5f2] bg-gradient-to-br from-blue-700/[0.07] to-[#4f46e5]/[0.05] p-10 md:p-14 shadow-xl shadow-blue-700/10">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">
            Make something like this — free.
          </h2>
          <p className="text-lg text-[#2b3a5c] mb-8 max-w-xl mx-auto">
            Start with an outline. IdiamPro turns it into whatever you need to publish.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              onClick={() => { window.location.href = SIGNUP_URL; }}
              size="lg"
              className="bg-gradient-to-br from-[#38bdf8] via-[#2563eb] to-[#4f46e5] hover:from-[#2563eb] hover:to-[#4338ca] text-white font-bold px-8 py-6 text-base shadow-xl shadow-blue-700/35"
            >
              Start free
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Link
              href="/examples"
              className="inline-flex items-center gap-2 rounded-full border border-blue-600/40 bg-white px-6 py-3 text-sm font-semibold text-[#1e40af] hover:bg-blue-600/10 hover:border-blue-600/60 transition-colors shadow-sm"
            >
              See more examples
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

// A tasteful browser-chrome frame (matches the homepage showcase) that wraps a
// screenshot so a rendered site reads as "a real site IdiamPro built."
export function BrowserFrame({
  src,
  alt,
  label,
}: {
  src: string;
  alt: string;
  label?: string;
}) {
  return (
    <div className="rounded-2xl overflow-hidden border border-[#dde5f2] bg-white shadow-xl shadow-blue-900/[0.06]">
      {/* Chrome bar */}
      <div className="flex items-center gap-2 px-4 py-3 bg-[#f1f5f9] border-b border-[#dde5f2]">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <span className="w-3 h-3 rounded-full bg-[#28c840]" />
          <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
        </div>
        {label && (
          <div className="ml-3 flex-1 truncate rounded-md bg-white border border-[#dde5f2] px-3 py-1 text-xs text-[#5b6b85]">
            {label}
          </div>
        )}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="w-full block" loading="lazy" />
    </div>
  );
}
