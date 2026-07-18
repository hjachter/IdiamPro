'use client';

// PODCAST example gallery — podcasts are audio, so we present the capability
// cleanly: the in-app tool that offers Podcast, plus the real narration voices
// IdiamPro uses. We do NOT fabricate a podcast; the voice clips below are the
// genuine narration-voice previews shipped with the app.

import React from 'react';
import { ExamplesShell, BrowserFrame } from '@/components/marketing/examples-shell';
import { Podcast, Mic, Users } from 'lucide-react';

const VOICES = [
  {
    src: '/voice-samples/voice-onyx.mp3',
    name: 'Onyx',
    role: 'Host voice',
    desc: 'Warm, grounded — the lead narrator.',
  },
  {
    src: '/voice-samples/voice-echo.mp3',
    name: 'Echo',
    role: 'Co-host voice',
    desc: 'Bright, conversational — the second speaker.',
  },
];

export default function PodcastsExamplePage() {
  return (
    <ExamplesShell
      eyebrow="Podcasts"
      eyebrowIcon={<Podcast className="w-4 h-4 text-[#0c5c5b]" />}
      title={<>Turn any outline into a narrated podcast.</>}
      subtitle={
        <>
          Pick a section, and IdiamPro writes and voices a natural two-host
          conversation about it — a real podcast episode, generated in a click.
        </>
      }
    >
      {/* The in-app tool that offers Podcast */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-center">
        <div className="lg:col-span-3">
          <BrowserFrame
            src="/screenshots/outputs.png"
            alt="IdiamPro's output menu showing the Podcast tool"
            label="IdiamPro — What you can make"
          />
        </div>
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-extrabold tracking-tight mb-4">One outline, a full episode.</h2>
          <ul className="space-y-4">
            <li className="flex gap-3">
              <Mic className="w-5 h-5 text-[#0c5c5b] shrink-0 mt-0.5" />
              <span className="text-[#22312f]">
                <b>Two natural voices.</b> A host and co-host trade lines like a real show — not a flat text-to-speech readout.
              </span>
            </li>
            <li className="flex gap-3">
              <Users className="w-5 h-5 text-[#0c5c5b] shrink-0 mt-0.5" />
              <span className="text-[#22312f]">
                <b>From any section.</b> Point it at a chapter or the whole outline — IdiamPro scripts the conversation for you.
              </span>
            </li>
            <li className="flex gap-3">
              <Podcast className="w-5 h-5 text-[#0c5c5b] shrink-0 mt-0.5" />
              <span className="text-[#22312f]">
                <b>Ready to share.</b> Download the audio and post it wherever your listeners are.
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* Real narration voices */}
      <div className="mt-14">
        <h2 className="text-2xl font-extrabold tracking-tight mb-2">Hear the actual voices.</h2>
        <p className="text-[#47585a] mb-6 max-w-2xl">
          These are the real narration voices your episodes are built from. Press play to listen.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {VOICES.map((v) => (
            <div
              key={v.src}
              className="rounded-2xl border border-[#dde2e5] bg-white p-6 shadow-lg shadow-teal-900/[0.05]"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-teal-600/15 border border-teal-600/30 flex items-center justify-center">
                  <Mic className="w-5 h-5 text-[#0c5c5b]" />
                </div>
                <div>
                  <div className="text-lg font-bold text-[#0c2224]">{v.name}</div>
                  <div className="text-xs font-semibold text-[#0c5c5b]">{v.role}</div>
                </div>
              </div>
              <p className="text-sm text-[#47585a] mb-4">{v.desc}</p>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio controls preload="none" className="w-full">
                <source src={v.src} type="audio/mpeg" />
              </audio>
            </div>
          ))}
        </div>
      </div>
    </ExamplesShell>
  );
}
