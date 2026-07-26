'use client';

// WORKED-EXAMPLE gallery — a single end-to-end story: one idea becomes many
// finished formats, all inside IdeaM. The four screenshots live in
// /public/examples/workflow-*.jpg and are shown in sequence as the arc.

import React from 'react';
import { ExamplesShell } from '@/components/marketing/examples-shell';
import { Workflow, Sparkles } from 'lucide-react';

const STEPS = [
  {
    src: '/examples/workflow-outline.jpg',
    step: 'Step 1',
    title: 'A structured outline',
    desc: 'The idea, organized. A single conversation about a big topic becomes a clear, structured outline you can shape and expand.',
  },
  {
    src: '/examples/workflow-brief.jpg',
    step: 'Step 2',
    title: 'A formatted brief',
    desc: 'That outline, written up. The same material becomes a readable, formatted brief — right inside IdeaM.',
  },
  {
    src: '/examples/workflow-styled.jpg',
    step: 'Step 3',
    title: 'A designed, shareable page',
    desc: 'A polished, designed one-page version — ready to share with anyone, no extra tools needed.',
  },
  {
    src: '/examples/workflow-script.jpg',
    step: 'Step 4',
    title: 'A ready-to-shoot video script',
    desc: 'The same idea, turned into a video script and storyboard — ready to record.',
  },
];

export default function WorkflowExamplePage() {
  return (
    <ExamplesShell
      eyebrow="Worked Example"
      eyebrowIcon={<Workflow className="w-4 h-4 text-[#1e40af]" />}
      title={<>One idea, many finished formats.</>}
      subtitle={
        <>
          This one began as a single conversation about a big topic — the future
          of AI and society. Inside one tool, it became a structured outline, a
          formatted brief, a designed shareable document, and a ready-to-shoot
          video script. That is IdeaM&apos;s whole promise: start with an idea,
          finish in every format you need.
        </>
      }
    >
      {/* The arc — each stage in sequence */}
      <div className="flex flex-col gap-12">
        {STEPS.map((s) => (
          <div key={s.src}>
            <div className="flex items-center gap-2 flex-wrap mb-4 px-1">
              <span className="text-xs font-semibold text-[#1e40af] bg-blue-600/12 border border-blue-600/30 rounded-full px-2.5 py-0.5">
                {s.step}
              </span>
              <span className="text-lg md:text-xl font-bold text-[#0b1533]">
                {s.title}
              </span>
            </div>
            <div className="rounded-2xl overflow-hidden border border-[#dde5f2] bg-white shadow-xl shadow-blue-900/[0.06]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.src}
                alt={s.title}
                className="w-full block"
                loading="lazy"
              />
            </div>
            <p className="text-sm md:text-base text-[#475569] mt-4 px-1 max-w-2xl">
              {s.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Tasteful "developed with Claude" note */}
      <div className="mt-12 flex items-start gap-3 rounded-2xl border border-[#dde5f2] bg-gradient-to-br from-blue-600/[0.06] to-[#4f46e5]/[0.04] p-5 md:p-6">
        <div className="w-9 h-9 shrink-0 rounded-xl bg-white border border-[#dde5f2] flex items-center justify-center shadow-sm">
          <Sparkles className="w-5 h-5 text-[#1e40af]" />
        </div>
        <p className="text-sm md:text-base text-[#2b3a5c] leading-relaxed">
          This piece was developed with Claude. IdeaM lets you work with Claude,
          Gemini, and GPT right inside the app.
        </p>
      </div>
    </ExamplesShell>
  );
}
