'use client';

// /examples — the hub that links out to each output-format gallery.

import React from 'react';
import Link from 'next/link';
import { ExamplesShell } from '@/components/marketing/examples-shell';
import { Sparkles, Video, Globe, Podcast, ArrowRight } from 'lucide-react';

const GALLERIES = [
  {
    href: '/examples/videos',
    icon: Video,
    title: 'Videos',
    desc: 'Narrated slideshow videos, generated straight from an outline.',
    tint: 'from-[#3b82f6]/12 to-[#4f46e5]/8',
  },
  {
    href: '/examples/websites',
    icon: Globe,
    title: 'Websites',
    desc: 'Clean, shareable web pages built from IdiamPro’s templates.',
    tint: 'from-blue-600/12 to-blue-700/8',
  },
  {
    href: '/examples/podcasts',
    icon: Podcast,
    title: 'Podcasts',
    desc: 'A natural two-host episode voiced from any section.',
    tint: 'from-[#4f46e5]/12 to-[#3b82f6]/8',
  },
];

export default function ExamplesHubPage() {
  return (
    <ExamplesShell
      eyebrow="Examples"
      eyebrowIcon={<Sparkles className="w-4 h-4 text-[#1e40af]" />}
      title={<>See what IdiamPro can make.</>}
      subtitle={
        <>
          One outline becomes many finished formats. Browse real examples of each
          — every one produced by IdiamPro itself.
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {GALLERIES.map((g) => {
          const Icon = g.icon;
          return (
            <Link
              key={g.href}
              href={g.href}
              className={`group flex flex-col rounded-2xl border border-[#dde5f2] bg-gradient-to-br ${g.tint} p-7 shadow-lg shadow-blue-900/[0.05] hover:shadow-xl hover:border-blue-600/50 transition-all`}
            >
              <div className="w-12 h-12 rounded-xl bg-white border border-[#dde5f2] flex items-center justify-center mb-5 shadow-sm group-hover:scale-105 transition-transform">
                <Icon className="w-6 h-6 text-[#1e40af]" />
              </div>
              <div className="text-xl font-extrabold text-[#0b1533] mb-2">{g.title}</div>
              <p className="text-sm text-[#475569] flex-1">{g.desc}</p>
              <span className="inline-flex items-center gap-1.5 mt-5 text-sm font-semibold text-[#1e40af]">
                View gallery
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
          );
        })}
      </div>
    </ExamplesShell>
  );
}
