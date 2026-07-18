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
    tint: 'from-[#0ea5a4]/12 to-[#0b74c4]/8',
  },
  {
    href: '/examples/websites',
    icon: Globe,
    title: 'Websites',
    desc: 'Clean, shareable web pages built from IdiamPro’s templates.',
    tint: 'from-teal-600/12 to-teal-700/8',
  },
  {
    href: '/examples/podcasts',
    icon: Podcast,
    title: 'Podcasts',
    desc: 'A natural two-host episode voiced from any section.',
    tint: 'from-[#0b74c4]/12 to-[#0ea5a4]/8',
  },
];

export default function ExamplesHubPage() {
  return (
    <ExamplesShell
      eyebrow="Examples"
      eyebrowIcon={<Sparkles className="w-4 h-4 text-[#0c5c5b]" />}
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
              className={`group flex flex-col rounded-2xl border border-[#dde2e5] bg-gradient-to-br ${g.tint} p-7 shadow-lg shadow-teal-900/[0.05] hover:shadow-xl hover:border-teal-600/50 transition-all`}
            >
              <div className="w-12 h-12 rounded-xl bg-white border border-[#dde2e5] flex items-center justify-center mb-5 shadow-sm group-hover:scale-105 transition-transform">
                <Icon className="w-6 h-6 text-[#0c5c5b]" />
              </div>
              <div className="text-xl font-extrabold text-[#0c2224] mb-2">{g.title}</div>
              <p className="text-sm text-[#47585a] flex-1">{g.desc}</p>
              <span className="inline-flex items-center gap-1.5 mt-5 text-sm font-semibold text-[#0c5c5b]">
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
