import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingHeader } from '@/components/marketing/marketing-header';
import {
  ArrowLeft,
  FolderTree,
  Unlock,
  Trash2,
  Send,
  Bot,
  ShieldCheck,
  Check,
} from 'lucide-react';

// "Your Work Is Yours" — the public data-ownership statement (/your-data).
//
// Every claim on this page was VERIFIED against the codebase before publish
// (2026-09-11): Mac deletion goes through the system Trash (electron/main.js
// delete-outline-file → shell.trashItem); automatic snapshots are Mac-only,
// 20 newest per outline (src/lib/snapshot-storage.ts); iPhone/iPad and web
// outlines live in the app's on-device storage and deletion removes them
// immediately with no Trash (src/lib/storage-manager.ts deleteOutline
// localStorage path); share links are snapshots stored on our own
// infrastructure and unpublish deletes the snapshot immediately — the /s/<id>
// page is force-dynamic, so revocation takes effect on the next load
// (src/lib/sharing/share-store.ts, src/app/api/share/unpublish/route.ts,
// src/app/s/[shareId]/page.tsx); server-side storage holds account identity,
// beta status, usage COUNTS, published snapshots, and submitted feedback/bug
// reports — no other outline content (src/lib/access/*, src/lib/billing/*);
// the MCP server is read-only with a proposal model (mcp-server/src/index.ts).
// The fidelity table condenses docs/export-fidelity.md. If behavior changes,
// CHANGE THIS PAGE in the same release — it must only claim what the code does.

export const metadata: Metadata = {
  title: 'Your Work Is Yours — IdeaM Data Ownership',
  description:
    'Where your outlines live, what every export format keeps, what deleting really does, and exactly what ever touches our servers. The IdeaM data ownership statement.',
  alternates: { canonical: '/your-data' },
  robots: { index: true, follow: true },
};

// Condensed per-format fidelity summary (full audit: docs/export-fidelity.md).
// 23 formats checked by the automated fidelity harness — 1 lossless,
// 22 documented-lossy, 0 silently lossy (last verified 2026-09-09).
const FIDELITY_ROWS: { format: string; keeps: string; limits: string }[] = [
  {
    format: 'IdeaM outline (.idm)',
    keeps:
      'Everything — hierarchy, content, tags, colors, dates, links, IDs. Export → re-import verified lossless.',
    limits: 'Nothing. This is the complete backup format.',
  },
  {
    format: 'OPML',
    keeps: 'Full hierarchy, names, content; tags, colors and completion with “Include metadata”.',
    limits: 'Rich-text formatting becomes plain text; IDs are regenerated on re-import.',
  },
  {
    format: 'Markdown',
    keeps: 'Hierarchy to 6 levels, all names and content.',
    limits: 'Markdown has no 7th heading level — deeper levels flatten; metadata is not carried.',
  },
  {
    format: 'Word (.docx)',
    keeps: 'Every node as real Word headings (9 levels) and paragraphs.',
    limits: 'Deeper levels flatten; formatting is simplified; no metadata.',
  },
  {
    format: 'PDF',
    keeps: 'A finished document — title page, table of contents, index, every node.',
    limits: 'A picture of the outline, not a data file — re-import from .idm instead.',
  },
  {
    format: 'Plain text',
    keeps: 'Every node at its indent level.',
    limits: 'The name-vs-content distinction and all formatting and metadata.',
  },
  {
    format: 'Obsidian / Notion',
    keeps: 'All nodes, in each app’s own conventions (wiki-links, toggles).',
    limits: 'Formatting flattens to the target app’s style; metadata is not carried.',
  },
  {
    format: 'Slides (Reveal.js)',
    keeps: 'Sections → sub-slides → bullets — three levels, by design.',
    limits: 'Levels deeper than three are omitted from the deck — that’s the format’s shape.',
  },
  {
    format: 'Twitter/X thread',
    keeps: 'A numbered thread of your outline.',
    limits: 'Posts stop at 280 characters — long items split or truncate with an ellipsis.',
  },
];

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-[#f7faff] rounded-2xl border border-[#dde5f2] p-6 lg:p-8">
      <div className="flex items-start gap-4 mb-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600/10 border border-blue-600/25 text-[#1e40af]">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="text-2xl md:text-3xl font-extrabold text-[#0b1533] tracking-tight leading-tight pt-1">
          {title}
        </h2>
      </div>
      <div className="space-y-4 text-base font-medium text-[#2b3a5c] leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <Check className="mt-1 h-4 w-4 shrink-0 text-[#1e40af]" />
      <span>{children}</span>
    </li>
  );
}

export default function YourDataPage() {
  return (
    <div className="fixed inset-0 bg-white text-[#0b1533] overflow-x-hidden overflow-y-auto">
      {/* Carbon-flat white ground, matching the rest of the marketing site. */}
      <div className="fixed inset-0 bg-white" />
      <div className="relative z-10">
        <MarketingHeader />
        <main className="pt-28 lg:pt-32 pb-24">
          <div className="px-6 lg:px-12 max-w-7xl mx-auto">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full border border-blue-600/30 px-4 py-1.5 text-sm text-blue-600 hover:bg-blue-600/10 hover:border-blue-600/50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to home
            </Link>
          </div>

          {/* Hero */}
          <div className="text-center px-6 pt-8 pb-4 lg:px-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600/15 border border-blue-600/40 mb-6">
              <ShieldCheck className="w-4 h-4 text-[#1e40af]" />
              <span className="text-sm font-semibold text-[#1e40af]">Data ownership statement</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-[#0b1533] tracking-tight mb-4">
              Your Work Is Yours
            </h1>
            <p className="text-lg md:text-xl font-medium text-[#2b3a5c] leading-relaxed max-w-[760px] mx-auto">
              Your outlines are your thinking. We believe a thinking tool earns trust by making one
              thing unmistakable: <strong className="text-[#0b1533]">your work belongs to you</strong>{' '}
              — not to us, and not to our file format.
            </p>
          </div>

          <div className="px-6 lg:px-12 max-w-3xl mx-auto mt-10 space-y-8">
            <SectionCard icon={FolderTree} title="Your outlines live on your device, in files you can read">
              <p>
                On your Mac, every outline is a plain, human-readable file in your own Documents
                folder. No vault, no proprietary blob, no database only we can open. You can look at
                your files, copy them, back them up, and take them anywhere — with or without IdeaM.
              </p>
              <p>
                In the web version, your outlines are stored in your browser, on your device. On
                iPhone and iPad, they live in the app&apos;s own storage on the device. Either way:
                your content stays with you — we run no background sync of your outlines to our
                servers.
              </p>
            </SectionCard>

            <SectionCard icon={Unlock} title="No lock-in — and we prove it">
              <p>
                IdeaM exports to 23 formats: Word, PDF, Markdown, OPML, plain text, ePub, LaTeX,
                Obsidian, Notion, Evernote, mind maps, CSV, slides, websites, and more. Two promises
                come with that:
              </p>
              <ul className="space-y-2.5">
                <Bullet>
                  <strong className="text-[#0b1533]">A complete export always exists.</strong> The
                  native IdeaM format is a structured file that carries <em>everything</em> — your
                  hierarchy, content, tags, colors, links, all of it — and it round-trips back in
                  without loss. We test this automatically.
                </Bullet>
                <Bullet>
                  <strong className="text-[#0b1533]">No format pretends to keep more than it does.</strong>{' '}
                  Markdown can&apos;t hold seven levels of headings; a tweet stops at 280 characters.
                  Where a format has limits, we say so plainly — see the table below. What we will
                  never do is quietly drop your work and call the export a success. Our automated
                  test suite treats silent loss as a bug that blocks a release.
                </Bullet>
              </ul>

              <div className="overflow-x-auto rounded-xl border border-[#dde5f2] bg-white">
                <table className="w-full min-w-[560px] table-fixed text-sm">
                  <caption className="sr-only">
                    What each popular export format keeps and where it has limits
                  </caption>
                  <thead>
                    <tr className="border-b border-[#dde5f2] bg-[#f7faff] text-left">
                      <th scope="col" className="w-[26%] px-4 py-3 font-semibold text-[#0b1533]">Format</th>
                      <th scope="col" className="px-4 py-3 font-semibold text-[#0b1533]">What it keeps</th>
                      <th scope="col" className="px-4 py-3 font-semibold text-[#0b1533]">Where it has limits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FIDELITY_ROWS.map((row) => (
                      <tr key={row.format} className="border-b border-[#eef2fa] last:border-0 align-top">
                        <td className="px-4 py-3 font-semibold text-[#0b1533]">
                          {row.format}
                        </td>
                        <td className="px-4 py-3 text-[#2b3a5c]">{row.keeps}</td>
                        <td className="px-4 py-3 text-[#5b6b85]">{row.limits}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-[#5b6b85]">
                Condensed from our full fidelity audit of all 23 formats: 1 verified lossless, 22
                with their limits documented, 0 silently lossy — checked by an automated harness on
                every release.
              </p>
            </SectionCard>

            <SectionCard icon={Trash2} title="Deleting means deleting — with a safety net first">
              <p>
                Your outline data is sacred, so deletion is designed to protect you from accidents{' '}
                <em>and</em> respect your decision:
              </p>
              <ul className="space-y-2.5">
                <Bullet>
                  <strong className="text-[#0b1533]">On the Mac,</strong> deleting an outline moves
                  its file to your system Trash — recoverable until you empty it, gone when you say
                  so.
                </Bullet>
                <Bullet>
                  <strong className="text-[#0b1533]">The Mac app also keeps a short trail of automatic
                  local snapshots</strong> (the 20 most recent per outline) so a slip is never a
                  catastrophe. These live on your device and are pruned automatically.
                </Bullet>
                <Bullet>
                  <strong className="text-[#0b1533]">On iPhone, iPad, and the web,</strong> outlines
                  live in the app&apos;s on-device storage, and deleting one — after you confirm —
                  removes it from that storage immediately. There is no Trash to fish it back out of
                  on those platforms, so if you might want an outline later, export a copy first.
                  Deleting really deletes.
                </Bullet>
              </ul>
            </SectionCard>

            <SectionCard icon={Send} title="What leaves your device — only what you send, when you send it">
              <p>
                IdeaM has no background sync of your outlines to our servers. Content leaves your
                device only when <em>you</em> invoke something that needs it:
              </p>
              <ul className="space-y-2.5">
                <Bullet>
                  <strong className="text-[#0b1533]">AI features</strong> send the relevant text to
                  the AI provider you chose — including your own key (BYOK) or a local on-device
                  model, in which case it goes exactly where you pointed it. We don&apos;t keep a
                  server-side copy of what you send.
                </Bullet>
                <Bullet>
                  <strong className="text-[#0b1533]">Share links</strong> publish a snapshot of your
                  outline, rendered as a read-only page, only when you click Publish — hosted on our
                  own infrastructure, never a third party. Unpublish deletes that snapshot from our
                  servers immediately, and the link stops working right away.
                </Bullet>
                <Bullet>
                  <strong className="text-[#0b1533]">Your account</strong> (if you create one) stores
                  your sign-in identity, your beta or plan status, your AI usage <em>counts</em> —
                  numbers, not content — any pages you&apos;ve published, and feedback or bug reports
                  you choose to send us. That&apos;s the whole list. Your outlines themselves are
                  never part of it.
                </Bullet>
              </ul>
            </SectionCard>

            <SectionCard icon={Bot} title="External AI agents can read and suggest — never change">
              <p>
                If you connect outside AI assistants to your outlines (through our assistant
                connection), they get a strict deal:{' '}
                <strong className="text-[#0b1533]">
                  read-only access, and every change they want becomes a proposal you approve or
                  reject inside IdeaM.
                </strong>{' '}
                No agent — ours or anyone&apos;s — silently edits your work.
              </p>
            </SectionCard>

            {/* Plain-English summary */}
            <section className="rounded-2xl border-2 border-blue-600/40 bg-blue-600/5 p-6 lg:p-8">
              <h2 className="text-2xl md:text-3xl font-extrabold text-[#0b1533] tracking-tight mb-3">
                The plain-English summary
              </h2>
              <p className="text-base md:text-lg font-medium text-[#2b3a5c] leading-relaxed">
                Your outlines: readable files, on your device. Your exports: complete and honest.
                Your deletions: real, with a safety net on the Mac. Your data on our servers: only
                what you chose to share. Your approval: required for any outside change.{' '}
                <strong className="text-[#0b1533]">
                  That&apos;s the deal, and our automated tests hold us to it.
                </strong>
              </p>
            </section>

            <div className="text-center pt-4">
              <p className="text-sm text-[#5b6b85]">
                Related: <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>
                {' · '}
                <Link href="/faq" className="text-blue-600 hover:underline">FAQ</Link>
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
