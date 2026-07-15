'use client';

import React from 'react';
import Link from 'next/link';
import { Video, ArrowLeft, Sparkles, GraduationCap } from 'lucide-react';

// Workflow library. LEAD film ("Dinesh designs his future"): an adult recent
// grad — rent due, a partner, a real fear about A.I. — uses IdiamPro to build a
// LIVING career plan, reshape it when reality moves, and turn it into every form
// a job search needs. Built for the professional / capable-non-professional
// market, from REAL app captures (real Smart Tools + Transform menus, real
// dialogs, the real one-keypress Expand bloom, the real multi-format export) so
// prospects see exactly how the tool works — no staged "magic transforms".
// The earlier Sam film (an 11-year-old + the science fair) is retained below as
// the education-track video. Produced by IdiamPro, in the branded app-window
// house style. Additive page: does not touch the homepage or any route.
export default function WorkflowsPage() {
  return (
    <main className="fixed inset-0 overflow-x-hidden overflow-y-auto bg-[#0a0f1c] text-white">
      {/* ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="absolute top-1/3 right-0 h-[420px] w-[420px] rounded-full bg-blue-600/10 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-4xl px-6 py-10 lg:px-12">
        {/* top bar */}
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm text-white/70 transition hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            IdiamPro
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs text-violet-200">
            <Sparkles className="h-3.5 w-3.5" />
            Workflows
          </div>
        </div>

        {/* LEAD — Dinesh */}
        <div className="mt-14 text-center">
          <h1 className="bg-gradient-to-b from-white to-white/70 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">
            A degree — and no idea what&rsquo;s next
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-white/60 sm:text-lg">
            Dinesh is a year out of college with rent due, a future to build, and one quiet fear:
            will A.I. leave a career for him? Watch him use IdiamPro to build a <em>living</em> career
            plan — explore real paths, research how A.I. is changing each field, and when the ground
            shifts, reshape the plan instead of starting over. His answer to the fear turns out to be
            in his own hands: don&rsquo;t run from the wave — learn to surf it. One plan becomes a
            résumé, a portfolio, a website, a checklist. Amplify your thinking — and design a future
            that&rsquo;s yours.
          </p>
        </div>

        <div className="mt-10">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-2xl shadow-violet-500/10 backdrop-blur-sm">
            <video
              className="block h-auto w-full"
              src="/career-workflow.mp4"
              poster="/career-workflow-poster.jpg"
              controls
              playsInline
              preload="metadata"
              aria-label="A degree and no idea what's next — a recent grad uses IdiamPro to design an A.I.-resilient career plan, a workflow film produced by IdiamPro"
            />
          </div>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-white/50">
            <Video className="h-3.5 w-3.5 text-violet-400" />
            Produced by IdiamPro
          </p>
        </div>

        {/* SECONDARY — Sam (education track) */}
        <div className="mt-20">
          <div className="mb-5 flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-wider text-white/50">
            <GraduationCap className="h-4 w-4 text-blue-300" />
            For students &amp; educators
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight text-white/90 sm:text-3xl">
              How Sam took on the impossible — and won
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-white/55 sm:text-base">
              An 11-year-old sets out to understand one of science&rsquo;s boldest mysteries — cold
              fusion — with a science-fair scholarship on the line. A single idea grows into a deep,
              structured project he fully controls, then becomes everything he needs to win: a report,
              a poster and talk, a website, even a video. The same tool, told for the classroom.
            </p>
          </div>
          <div className="mt-6">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-xl shadow-blue-500/10 backdrop-blur-sm">
              <video
                className="block h-auto w-full"
                src="/book-workflow.mp4"
                poster="/book-workflow-poster.jpg"
                controls
                playsInline
                preload="metadata"
                aria-label="How Sam took on the impossible — an 11-year-old chases cold fusion for the science fair, a workflow film produced by IdiamPro"
              />
            </div>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-white/50">
              <Video className="h-3.5 w-3.5 text-blue-400" />
              Produced by IdiamPro
            </p>
          </div>
        </div>

        {/* library framing */}
        <div className="mt-16 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
          <p className="text-sm text-white/50">
            A growing library of IdiamPro workflows — real, end-to-end ways to turn an idea into
            finished work. More coming soon.
          </p>
        </div>
      </div>
    </main>
  );
}
