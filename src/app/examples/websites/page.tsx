'use client';

// WEBSITE example gallery — real sites IdiamPro generated from its own built-in
// templates, each shown in a browser frame. Screenshots live in
// /public/screenshots/examples and were rendered from the actual templates.

import React from 'react';
import { ExamplesShell, BrowserFrame } from '@/components/marketing/examples-shell';
import { Globe } from 'lucide-react';

const SITES = [
  {
    src: '/screenshots/examples/website-marketing.png',
    title: 'Product Landing',
    template: 'Marketing template',
    url: 'trailhead.example.com',
    desc: 'A bold launch page with a hero, benefits, and a clear call to action.',
  },
  {
    src: '/screenshots/examples/website-blog.png',
    title: 'Blog',
    template: 'Blog template',
    url: 'fieldnotes.example.com',
    desc: 'A clean editorial home with a featured post and full articles below.',
  },
  {
    src: '/screenshots/examples/website-portfolio.png',
    title: 'Portfolio',
    template: 'Portfolio template',
    url: 'avalindqvist.example.com',
    desc: 'A dark, confident showcase of selected work — great for creatives.',
  },
  {
    src: '/screenshots/examples/website-educational.png',
    title: 'Online Course',
    template: 'Educational template',
    url: 'acurioussky.example.com',
    desc: 'A course landing page with modules, lessons, and a progress card.',
  },
];

export default function WebsitesExamplePage() {
  return (
    <ExamplesShell
      eyebrow="Websites"
      eyebrowIcon={<Globe className="w-4 h-4 text-[#1e40af]" />}
      title={<>Real websites, built from an outline.</>}
      subtitle={
        <>
          Publish any outline as a clean, shareable web page. These four were
          generated from IdiamPro&apos;s built-in templates — eight in all, from
          marketing pages to blogs, portfolios, docs, and event sites.
        </>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {SITES.map((s) => (
          <div key={s.src}>
            <BrowserFrame src={s.src} alt={`${s.title} website built by IdiamPro`} label={s.url} />
            <div className="mt-4 px-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg font-bold text-[#0b1533]">{s.title}</span>
                <span className="text-xs font-semibold text-[#1e40af] bg-blue-600/12 border border-blue-600/30 rounded-full px-2.5 py-0.5">
                  {s.template}
                </span>
              </div>
              <div className="text-sm text-[#475569] mt-1.5">{s.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </ExamplesShell>
  );
}
