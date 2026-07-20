'use client';

// VIDEO example gallery — a click-to-play showcase of REAL videos IdiamPro
// produced. Uses the page-wide single-video hook so only one plays at a time.

import React from 'react';
import { ExamplesShell } from '@/components/marketing/examples-shell';
import { useSingleVideoPlayback } from '@/hooks/use-single-video-playback';
import { Video } from 'lucide-react';

// Cache-bust so viewers always get the latest render, and seek to 0.5s via the
// media fragment so the browser paints a real first frame as the poster (not a
// black rectangle) before playback.
const V = '?v=20260717#t=0.5';

const VIDEOS = [
  {
    src: `/homepage-sizzle.mp4${V}`,
    title: 'Product Sizzle',
    desc: 'A fast, cinematic tour of what IdiamPro does end to end.',
  },
  {
    src: `/getting-started.mp4${V}`,
    title: 'Getting Started',
    desc: 'Your very first outline, taken from blank page to finished.',
  },
  {
    src: `/career-workflow.mp4${V}`,
    title: 'Career Planning',
    desc: 'Turning a big career goal into a clear, structured plan.',
  },
  {
    src: `/book-workflow.mp4${V}`,
    title: 'Writing a Book',
    desc: 'From scattered notes and sources to a full book outline.',
  },
  {
    src: `/surfer-workflow.mp4${V}`,
    title: 'Learning a New Skill',
    desc: 'Developing a new pursuit, one considered step at a time.',
  },
];

export default function VideosExamplePage() {
  useSingleVideoPlayback();

  return (
    <ExamplesShell
      eyebrow="Videos"
      eyebrowIcon={<Video className="w-4 h-4 text-[#1e40af]" />}
      title={<>Real videos, made from outlines.</>}
      subtitle={
        <>
          Every clip below was produced by IdiamPro — a narrated slideshow
          generated straight from an outline. Press play on any one to watch.
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {VIDEOS.map((v, i) => (
          <figure
            key={v.src}
            className={`rounded-2xl overflow-hidden border border-[#dde5f2] bg-white shadow-lg shadow-blue-900/[0.05] ${
              i === 0 ? 'md:col-span-2' : ''
            }`}
          >
            <div className="bg-black">
              <video
                controls
                preload="metadata"
                playsInline
                className="w-full block aspect-video bg-black"
              >
                <source src={v.src} type="video/mp4" />
              </video>
            </div>
            <figcaption className="p-5">
              <div className="text-lg font-bold text-[#0b1533]">{v.title}</div>
              <div className="text-sm text-[#475569] mt-1">{v.desc}</div>
            </figcaption>
          </figure>
        ))}
      </div>
    </ExamplesShell>
  );
}
