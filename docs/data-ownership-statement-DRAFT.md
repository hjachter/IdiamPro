# Your Work Is Yours — IdeaM Data Ownership Statement

**PUBLISHED 2026-09-11 as the live site page `/your-data`
(`src/app/your-data/page.tsx`) after all three VERIFY-BEFORE-PUBLISH items were
checked against the code. The live page is now the canonical copy; verification
verdicts are recorded in a comment at the top of that file. This draft is kept
for history. Verified: (1) Mac delete → system Trash; snapshots are Mac-only,
20 newest per outline; iPhone/iPad/web delete = immediate removal from
on-device storage, no Trash — page scopes each platform. (2) Share links exist;
snapshot HTML on our own KV storage; unpublish deletes immediately and the link
stops resolving right away. (3) Server stores identity, beta/plan status, usage
counts (numbers only), published snapshots, and submitted feedback/bugs — never
outline content otherwise.**

---

Your outlines are your thinking. We believe a thinking tool earns trust by making
one thing unmistakable: **your work belongs to you — not to us, and not to our
file format.**

## Your outlines live on your device, in files you can read

On your Mac, every outline is a plain, human-readable file in your own Documents
folder. No vault, no proprietary blob, no database only we can open. You can look
at your files, copy them, back them up, and take them anywhere — with or without
IdeaM. In the web version, your outlines are stored in your browser, on your
device.

## No lock-in — and we prove it

IdeaM exports to more than twenty formats: Word, PDF, Markdown, OPML, plain text,
ePub, LaTeX, Obsidian, Notion, Evernote, mind maps, CSV, slides, websites, and
more. Two promises come with that:

- **A complete export always exists.** The native IdeaM format is a structured
  file that carries *everything* — your hierarchy, content, tags, colors, links,
  all of it — and it round-trips back in without loss. We test this automatically.
- **No format pretends to keep more than it does.** Markdown can't hold seven
  levels of headings; a tweet stops at 280 characters. Where a format has limits,
  we say so plainly — the full per-format truth table is published in our
  [export fidelity guide]. What we will never do is quietly drop your work and
  call the export a success. Our test suite treats silent loss as a bug that
  blocks a release.

## Deleting means deleting — with a safety net first

Your outline data is sacred, so deletion is designed to protect you from
accidents *and* respect your decision:

- On the Mac, deleting an outline moves its file to your Trash — recoverable
  until you empty it, gone when you say so.
- IdeaM keeps a short trail of automatic local snapshots (the most recent ones
  per outline) so a slip is never a catastrophe. These live on your device,
  and they are pruned automatically.
- VERIFY-BEFORE-PUBLISH: describe iPhone/iPad deletion behavior once confirmed
  on device.

## What leaves your device — only what you send, when you send it

IdeaM has no background sync of your outlines to our servers. Content leaves your
device only when *you* invoke something that needs it:

- **AI features** send the relevant text to the AI provider you chose — including
  your own key (BYOK) or a local on-device model, in which case it goes exactly
  where you pointed it.
- **Share links** publish an outline to the web only when you click Publish, and
  you can unpublish. (VERIFY-BEFORE-PUBLISH: confirm and state how quickly
  unpublished content is removed from the server.)

## External AI agents can read and suggest — never change

If you connect outside AI assistants to your outlines (through our MCP server),
they get a strict deal: **read-only access, and every change they want becomes a
proposal you approve or reject inside IdeaM.** No agent — ours or anyone's —
silently edits your work.

## The plain-English summary

Your outlines: readable files, on your device. Your exports: complete and honest.
Your deletions: real, with a safety net. Your data on our servers: only what you
chose to share. Your approval: required for any outside change. That's the deal,
and our automated tests hold us to it.

---

*Draft notes for Howard (not part of the public copy):*

- *Tone check: written to the "super upbeat, honest, control + transparency"
  bar; no absolute guarantees ("never lose data", "100% private") — every claim
  is either verified behavior or scoped ("what we will never do is…" is backed
  by the release-blocking test).*
- *"[export fidelity guide]" should link to a public rendering of
  docs/export-fidelity.md (or a condensed page) when published.*
- *VERIFY-BEFORE-PUBLISH items: (1) iOS deletion behavior; (2) share-link
  unpublish server retention; (3) if beta accounts (Clerk) store any outline
  content server-side, disclose it here — current understanding is they store
  account identity only.*
