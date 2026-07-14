'use client';

import React from 'react';
import Link from 'next/link';
import { Video, ArrowLeft, Sparkles } from 'lucide-react';

// Workflow library — first page. A single flagship workflow video ("Write an
// entire book in minutes"), produced by IdiamPro itself, matched to the homepage
// intro-video style (dark, blue/violet accent, app-window framed screenshot).
// Additive page: does not touch the homepage or any existing route.
export default function WorkflowsPage() {
  return (
    <main className="min-h-screen bg-[#0a0f1c] text-white">
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

        {/* heading */}
        <div className="mt-14 text-center">
          <h1 className="bg-gradient-to-b from-white to-white/70 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">
            Write an entire book — and make it your own
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-white/60 sm:text-lg">
            Watch one idea become a complete, deeply structured book you fully control — a rich
            content canvas with diagrams, an outline you can reshape with a single plain-English
            instruction, and finished work you can export more than 30 ways. Your creative work,
            amplified — never automated.
          </p>
        </div>

        {/* video */}
        <div className="mt-10">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-2xl shadow-violet-500/10 backdrop-blur-sm">
            <video
              className="block h-auto w-full"
              src="/book-workflow.mp4"
              poster="/book-workflow-poster.jpg"
              controls
              playsInline
              preload="metadata"
              aria-label="Write an entire book — and make it your own — a workflow produced by IdiamPro"
            />
          </div>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-white/50">
            <Video className="h-3.5 w-3.5 text-violet-400" />
            Produced by IdiamPro
          </p>
        </div>

        {/* library framing */}
        <div className="mt-16 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
          <p className="text-sm text-white/50">
            This is the first in a growing library of IdiamPro workflows — real, end-to-end
            ways to turn an idea into finished work. More coming soon.
          </p>
        </div>
      </div>
    </main>
  );
}
