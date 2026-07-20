'use client';

// Workflows — a CLARITY-teal CHARACTER-PROFILE GALLERY. Doctrine (Howard's):
// "We localize the pain and provide the remedy." Every workflow is a person a
// visitor can see themselves in — a named character tied to a market segment,
// their localized pain (the ache), and the remedy film that shows IdiamPro
// solving it end to end. Clean white background, deep-teal accent (#2563eb),
// near-black ink, the shared Clarity header. Each film is "Produced by
// IdiamPro" (baked into the video). The films themselves are a separate job;
// this page is the teal frame around them. Additive — touches no other route.

import React, { useState } from 'react';
import Link from 'next/link';
import { MarketingHeader } from '@/components/marketing/marketing-header';
import { useSingleVideoPlayback } from '@/hooks/use-single-video-playback';
import { ArrowLeft, ArrowRight, Play, Video, Film } from 'lucide-react';

// A premium click-to-play film card. Shows the poster with a play overlay until
// clicked, then swaps in the real <video> with controls. Degrades gracefully:
// if the poster image is missing it shows a soft teal placeholder, and if the
// video file isn't on disk yet the poster/placeholder simply stays put — never
// crashes, never blocks (used for the surfer film while it renders in parallel).
function ProfileFilm({
  videoSrc,
  posterSrc,
  ariaLabel,
  pending,
}: {
  videoSrc: string;
  posterSrc: string;
  ariaLabel: string;
  pending?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const [posterLoaded, setPosterLoaded] = useState(false);

  return (
    <div className="relative overflow-hidden -mx-6 sm:mx-0 rounded-none sm:rounded-3xl border-y sm:border border-[#dde5f2] bg-[#f7faff] shadow-xl shadow-blue-600/10">
      {playing ? (
        <video
          className="block h-auto w-full bg-black"
          src={videoSrc}
          poster={posterSrc}
          controls
          autoPlay
          playsInline
          preload="metadata"
          aria-label={ariaLabel}
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`Play film: ${ariaLabel}`}
          className="group relative block w-full aspect-video overflow-hidden bg-gradient-to-br from-blue-600/15 via-[#f1f5f9] to-blue-700/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/60"
        >
          {/* Base placeholder — a teal wash with a film glyph — always sits
              behind. The poster image loads on top and only fades in once it
              genuinely decodes, so a missing or half-rendered film (e.g. one
              still rendering) shows the clean placeholder, never a broken glyph. */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Film className="h-10 w-10 text-blue-600/40" />
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={posterSrc}
            alt=""
            onLoad={() => setPosterLoaded(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${posterLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
          {/* soft scrim + play control */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b1533]/35 via-transparent to-transparent transition-opacity group-hover:from-[#0b1533]/45" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-lg shadow-blue-900/20 backdrop-blur transition-transform group-hover:scale-105">
              <Play className="ml-1 h-7 w-7 text-blue-700" fill="currentColor" />
            </span>
          </div>
          {pending && (
            <span className="absolute left-4 top-4 rounded-full border border-blue-600/20 bg-white/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-blue-700 backdrop-blur">
              New film · rendering
            </span>
          )}
        </button>
      )}
    </div>
  );
}

type Profile = {
  index: string;
  segment: string;
  name: string;
  role: string;
  pain: string;
  remedy: string;
  videoSrc: string;
  posterSrc: string;
  ariaLabel: string;
  pending?: boolean;
};

const PROFILES: Profile[] = [
  {
    index: '01',
    segment: 'The New Graduate',
    name: 'Dinesh',
    role: 'Recent grad · career-changer',
    pain: 'A degree in hand — and no idea what comes next. Underneath it, a quiet fear: will A.I. even leave a career for someone like me?',
    remedy:
      'He builds a living, A.I.-resilient career plan he can reshape whenever the ground shifts — then turns that one plan into a résumé, a portfolio, a website, and a checklist. He stops running from the wave and learns to surf it.',
    videoSrc: '/career-workflow.mp4',
    posterSrc: '/career-workflow-poster.jpg',
    ariaLabel:
      "A degree and no idea what's next — a recent grad uses IdiamPro to design an A.I.-resilient career plan, a workflow film produced by IdiamPro",
  },
  {
    index: '02',
    segment: 'The Student',
    name: 'Sam',
    role: 'Eleven years old · science fair',
    pain: 'An eleven-year-old takes on one of science’s hardest ideas — cold fusion — for the school science fair, with a scholarship on the line and no one to hand him the answer.',
    remedy:
      'One idea grows into a full, structured project he completely controls — and then becomes everything he needs to win: a written report, a poster and talk, a website, even a video.',
    videoSrc: '/book-workflow.mp4',
    posterSrc: '/book-workflow-poster.jpg',
    ariaLabel:
      'How Sam took on the impossible — an eleven-year-old chases cold fusion for the science fair, a workflow film produced by IdiamPro',
  },
  {
    index: '03',
    segment: 'The Content Creator',
    name: 'The Surf-Shop Owner',
    role: 'Small business · podcaster',
    pain: 'He owes his subscribers a podcast he never has time to make. Between the shop and the tide, the episodes he promised keep slipping away.',
    remedy:
      'He types a topic, presses one button, and hears it: “Done!” Out comes a finished episode — and he gets his evenings, and his surfing, back.',
    videoSrc: '/surfer-workflow.mp4',
    posterSrc: '/surfer-workflow-poster.jpg',
    ariaLabel:
      'The surf-shop owner turns a single topic into a finished podcast episode with one press, a workflow film produced by IdiamPro',
    pending: false,
  },
];

export default function WorkflowsPage() {
  useSingleVideoPlayback();
  return (
    <div className="fixed inset-0 overflow-x-hidden overflow-y-auto bg-white text-[#0b1533]">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-600/[0.035] via-transparent to-transparent" />
      <div className="relative z-10">
        <MarketingHeader />
        <main className="pt-28 lg:pt-32">
          {/* Back link */}
          <div className="mx-auto w-full max-w-[1600px] px-6 lg:px-12">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 transition-colors hover:text-blue-700"
            >
              <ArrowLeft className="h-4 w-4" /> Back to home
            </Link>
          </div>

          {/* Intro */}
          <section className="px-6 pt-8 pb-14 text-center lg:px-12">
            <div className="mb-3 text-sm font-medium uppercase tracking-wider text-blue-600">
              Real people · real problems
            </div>
            <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-[#0b1533] md:text-5xl">
              See yourself here.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[#475569] md:text-lg">
              Every profile below is one person, one real problem, and the moment IdiamPro turned it into
              finished work — almost as fast as they could describe it. Find the one who sounds like you.
            </p>
          </section>

          {/* Gallery — each profile is a compact character band (header + ache +
              remedy) sitting ABOVE its film, which then spans the full section
              width (up to ~1600px) so it reads large and reaches the margins,
              matching the homepage. */}
          <section className="px-6 pb-8 lg:px-12">
            <div className="mx-auto flex max-w-[1600px] flex-col gap-20 md:gap-28">
              {PROFILES.map((p) => (
                <article key={p.index}>
                  {/* Character band — the header + ache + remedy, kept to a
                      readable line length above the wide film. */}
                  <div className="mb-6 md:mb-8">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-blue-600/70">{p.index}</span>
                      <span className="text-xs font-medium uppercase tracking-wider text-blue-600">
                        {p.segment}
                      </span>
                    </div>
                    <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#0b1533] md:text-4xl">
                      {p.name}
                    </h2>
                    <div className="mt-1 text-sm text-[#64748b]">{p.role}</div>

                    {/* Ache + remedy side by side on desktop, each at a readable
                        line length; stacks on mobile. */}
                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                      {/* The ache */}
                      <div className="rounded-2xl border border-[#e6d7d3] bg-[#fbf6f4] p-5">
                        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#b06a52]">
                          The ache
                        </div>
                        <p className="text-[15px] leading-relaxed text-[#4a3a34]">{p.pain}</p>
                      </div>

                      {/* The remedy */}
                      <div className="rounded-2xl border border-[#dde5f2] bg-[#f7faff] p-5">
                        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-blue-600">
                          The remedy
                        </div>
                        <p className="text-[15px] leading-relaxed text-[#475569]">{p.remedy}</p>
                      </div>
                    </div>
                  </div>

                  {/* Film — full section width, reaching the page margins. */}
                  <div>
                    <ProfileFilm
                      videoSrc={p.videoSrc}
                      posterSrc={p.posterSrc}
                      ariaLabel={p.ariaLabel}
                      pending={p.pending}
                    />
                    <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-[#64748b]">
                      <Video className="h-3.5 w-3.5 text-blue-600" />
                      Produced by IdiamPro
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* The story behind IdiamPro — the founder film, relocated here from the
              homepage. A tasteful "meet the maker" card that sits alongside the
              character films: the founder used IdiamPro to plan IdiamPro's own
              launch. Reuses the same ProfileFilm click-to-play pattern. */}
          <section className="px-6 pt-4 pb-16 lg:px-12">
            <div className="mx-auto max-w-[1600px]">
              <div className="mb-6 md:mb-8">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-blue-600/70">★</span>
                  <span className="text-xs font-medium uppercase tracking-wider text-blue-600">
                    The story behind IdiamPro
                  </span>
                </div>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#0b1533] md:text-4xl">
                  The idea was only half the battle.
                </h2>
                <div className="mt-1 text-sm text-[#64748b]">A note from the founder</div>
                <p className="mt-5 max-w-3xl text-[15px] leading-relaxed text-[#475569] md:text-base">
                  A tool I&apos;d envisioned for decades — finally possible now. So I did the most
                  honest test I could think of: I used IdiamPro to plan its own launch. The plan
                  you&apos;ll watch build itself is the real one.
                </p>
              </div>
              <div>
                <ProfileFilm
                  videoSrc="/idiampro-story.mp4?v=story6"
                  posterSrc="/idiampro-story-poster.jpg?v=story6"
                  ariaLabel="Our Story — a founder uses IdiamPro to plan IdiamPro's own launch. Produced by IdiamPro."
                />
                <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-[#64748b]">
                  <Video className="h-3.5 w-3.5 text-blue-600" />
                  Produced by IdiamPro
                </p>
              </div>
            </div>
          </section>

          {/* More profiles coming — subtle */}
          <section className="px-6 pb-16 lg:px-12">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm text-[#64748b]">
                More profiles on the way — the writer, the founder, the everyday thinker. If your work
                lives in ideas, there’s a place for you here.
              </p>
            </div>
          </section>

          {/* CTA */}
          <section className="px-6 pb-24 lg:px-12">
            <div className="mx-auto max-w-4xl text-center">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#38bdf8] via-[#2563eb] to-[#4f46e5] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-colors hover:from-[#2563eb] hover:to-[#4338ca]"
              >
                Start your own <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
