# The Content Compiler — Architecture Blueprint

**Status:** DESIGN ONLY — no code changed. (P9, drafted 2026-09-06)
**Audience:** Howard first (concepts, decisions), implementers second (precise enough to cut tasks from).

---

## The one-sentence idea

Today every output format (PDF, podcast, video, slides, website…) walks the outline on its own and produces a one-off file that forgets where it came from; the content compiler makes **one shared "compile" step** that every format plugs into, so **every section of every output remembers which outline node produced it**, and when a node changes you **regenerate just that chapter/segment/scene — not the whole thing, and not the whole bill.**

Why this matters competitively: research tools (Google's Gemini Notebook, ~30M users) have normalized "throw sources in, get a finished artifact out." Our edge is the opposite direction of control: **the outline drives the structure**, every generated piece traces back to a node, and all formats stay in sync with one conceptual model. That is something a chat-first tool structurally cannot offer.

---

# Part 1 — Survey: what exists today

## 1.1 The pipelines, one by one

| Pipeline | Where it lives | How it gets structure | AI cost | Remembers source nodes? |
|---|---|---|---|---|
| **23 file exporters** (Markdown, Word, ePub, OPML, Obsidian, Notion, HTML, LaTeX, reveal.js, CSV, Twitter thread…) | `src/lib/export/` — a real registry (`index.ts`) with a shared base class (`base-exporter.ts`), lazy-loaded per format; catalogued in `src/lib/format-registry.ts` | Each exporter walks the tree itself via shared helpers | None (deterministic) | No — output files carry no node identity (HTML uses slugs) |
| **Website export** (9 templates) | `src/lib/export/documents/website-exporter.ts` + `website-templates/` | Builds a `WebsiteSection` tree that **does carry the node id and node object in memory** | None | In memory yes; **not written into the page** |
| **PDF** | `src/lib/pdf-export.ts` (876 lines) + `pdf-render.worker.ts` | Own traversal; builds title page, table of contents, index | None | **Closest to yes** — internal anchors are literally `sec-<nodeId>`; not exposed or persisted |
| **Podcast** | `src/lib/podcast-generator.ts` → `/api/generate-podcast-script` (BYOK/failover) → `electron/podcast-generator.js` (per-segment TTS + ffmpeg stitch) | **Flattens the whole subtree into one text blob**, sends it to the AI, gets back dialogue segments | Heavy (script + TTS) | No — segments can't be tied to nodes because the AI saw one big blob |
| **Video (slideshow)** | `src/lib/video/derive-slides.ts` → `generate-video-dialog.tsx` → `electron/video-generator.js` (per-slide PNG + TTS + per-slide MP4 → concat) | Deterministic: one slide per node in the chapter subtree — **already node-shaped** | Heavy (TTS; renderer free) | No — `VideoSlide` has title/bullets/narration but **no node id field** |
| **Slide deck (PowerPoint)** | `src/lib/deck/derive-deck.ts` + `build-pptx.ts` | Deterministic: title/section/content slides from branch levels | None | No — `DeckSlide` has no node id |
| **YouTube package** | `src/ai/flows/generate-youtube-package.ts` + dialog | Renders the branch into a prompt, one-shot text package | Heavy | No |
| **Social / email / summarize / transform** | `src/ai/flows/*`, `transforms/transform-engine.ts` | Various; transforms produce derivative outlines | Medium | Transforms: partially (derivative outlines link back via `derivedFromOutlineId`) |

## 1.2 Survey verdict

**What's duplicated (badly):**
- **HTML-stripping is re-implemented at least six times** (base exporter, PDF, podcast, video slides, deck, YouTube flow) — near-identical code.
- **Subtree traversal / "flatten to text" is re-invented per pipeline** (~6 copies).
- **The "levels → chapters/slides/sections" decision** — the heart of structure — is written from scratch three separate times (video slides, deck, website sections), each with its own caps, bullet rules, and truncation logic.
- **Nothing shares a cache**; every run recomputes (and for AI formats, re-pays for) everything.

**What's genuinely reusable (good news — more than expected):**
- The **exporter registry + base class** (`src/lib/export/`) is exactly the adapter pattern the compiler needs; it just doesn't know about node identity, caching, or AI steps.
- **Video and deck derivations are already tiny compilers**: subtree in, typed slide model out. They only need a `sourceNodeId` field and to share the structure mapper.
- **The Electron media pipelines are already per-piece**: podcast = per-segment audio clips concatenated; video = per-slide MP4s concatenated. **Selective regeneration slots into the existing stitch step** — replace only the changed clips, re-concat. This is a huge head start.
- **PDF already has per-node anchors** (`sec-<nodeId>`) for its TOC and index — traceability is one step from done there.
- The **P2 cost-approval registry** (`src/lib/ai-cost-model.ts`) already classifies podcast/video/YouTube as heavy ops with a "whose key pays" model — the compiler's cost estimates plug straight into it.
- **Proposed Changes** (`proposed-changes-review.tsx`: a marked tree + floating review card, node-id → change-kind map) is a ready-made visual vocabulary for staleness marks.
- The **derivative-outline mechanism** (`src/lib/derivation/`) shows the house style for "a thing that remembers what it came from."

---

# Part 2 — The design

## 2.1 The canonical model: the Compile Tree

The compiler's intermediate representation is deliberately simple — **a snapshot of the chosen subtree where every node becomes a Compile Unit**:

```
CompileUnit {
  nodeId          — which outline node this is
  contentHash     — fingerprint of (name + content + ordered child ids)
  role            — what this node plays in the output: chapter / section / leaf
  plainText       — the node's prose, HTML stripped ONCE, by ONE shared function
  bullets         — child names / extracted bullets (shared extraction)
  children        — nested CompileUnits
}
CompileTree = the root CompileUnit + outline metadata + an options fingerprint
```

**Where per-format structure decisions live:** a single shared **Structure Mapper** assigns roles from depth + format parameters. One place answers "level 1 = chapters, level 2 = sections, deeper = merged into parent" — and each format supplies only its parameters (PDF: chapters/sections/body; podcast: episodes segments per chapter; video: scenes per branch; deck: title/section/content slides; website: pages/sections). Today that logic exists three times with three sets of caps; the mapper unifies it, and the caps (max slides, max depth, truncation) become mapper options rather than buried constants.

**What the compiler does NOT do:** it does not invent a new storage format or change `.idm` files. The Compile Tree is computed at compile time from the live outline. Nothing about outline editing changes.

## 2.2 Traceability: every section knows its source node

Two mechanisms, both cheap:

**(a) The Compile Manifest** — every compiled artifact gets a small JSON record (sidecar file next to the output, and/or kept in the app's records) written at compile time:

```
Manifest {
  artifactId, format, options fingerprint, compiledAt
  outlineId, rootNodeId
  sections: [ { sectionRef, sourceNodeIds, contentHashes } ]
}
```

`sectionRef` is format-specific: a PDF bookmark/anchor id, a podcast segment index + timestamp range, a video scene index + timestamp range, a web page element id, a slide number.

**(b) In-artifact anchors**, format by format:
- **PDF** — the existing `sec-<nodeId>` anchors become real PDF bookmarks; TOC/index entries already point at them.
- **Podcast** — the script generation changes from "one blob in" to "per-chapter/segment units in," so each returned dialogue segment carries `sourceNodeIds`; the manifest maps segments to time ranges (and optionally MP3 chapter markers).
- **Video** — `VideoSlide` gains `sourceNodeId` (the derivation already knows it — it's dropped on the floor today); scene map in the manifest + optional MP4 chapter markers.
- **Website/HTML** — each section element gets `data-source-node="<nodeId>"` (invisible to readers).
- **Slide deck** — slide notes / manifest carry the node id per slide.
- **YouTube package** — chapter timestamps in the description map to top-level nodes via the manifest.

**UX this enables later** (not built in phase 1, but the data makes it possible): click a section in a preview → jump to its node; select a node → "this feeds chapter 3 of your PDF and scenes 4–6 of your video"; and the staleness story below.

## 2.3 Selective regeneration — the cost story

**The cache:** per-unit compiled fragments keyed by `(nodeId, contentHash, format, options-fingerprint)`. What's cached is the *expensive* per-unit product:
- podcast: the AI-written dialogue segments for that branch AND the synthesized audio clip per segment;
- video: the narration text, the TTS clip, the rendered slide/scene MP4 (later: the Veo clip — the most valuable cache of all);
- deterministic formats (PDF, deck, website): fragments are cheap to recompute, so caching is optional there — the manifest still records hashes for staleness.

**Invalidation:** a unit is stale when its current contentHash differs from the cached one, or its child list changed (structure edit), or the compile options changed (options are part of the key — a different voice or style is a different cache entry, never a wrong reuse).

**Regenerating one chapter:** recompile only the invalidated units → re-run the paid steps (script, TTS, Veo) for those units only → **re-stitch with the existing concat step**, reusing every untouched clip. The Electron pipelines already assemble from per-piece files, so this is a change to *which pieces get rebuilt*, not a new renderer.

**Why this is the cost story:** heavy media on the user's own key (P2/BYOK world) makes "re-render everything for a typo" indefensible. With the cache, the P2 approval dialog can say, honestly: *"2 of 14 scenes changed — regenerating just those; typically far cheaper than a full re-render."* Cache + selective regen is what makes Veo-class costs sane.

## 2.4 The Format Adapter interface

Each format implements one interface (an evolution of today's `BaseExporter`, which stays working underneath):

```
FormatAdapter {
  describe()                    — id, name, capabilities, cost class (links to ai-cost-model),
                                  which steps are heavy/paid
  plan(compileTree, options)    — returns the Section Plan: what sections will exist,
                                  from which nodes, and which units need (re)generation
                                  vs. come from cache  → this is exactly what the P2
                                  approval dialog needs to show BEFORE money moves
  compileUnit(unit, options)    — produce/refresh one unit's fragment (the cacheable,
                                  possibly-paid step)
  assemble(fragments, options)  — stitch fragments into the artifact + write the Manifest
  present(artifact)             — open the finished thing in its viewer (the existing
                                  "show the finished product immediately" rule)
}
```

**Migration order for existing exports** (each keeps working throughout — adapters wrap, never replace-and-pray):
1. **Podcast** — highest quality today, already per-segment, real money saved. (Phase 1 below.)
2. **PDF** — highest-quality document output, anchors nearly done, zero AI cost so lowest risk.
3. **Video** — per-slide pipeline ready; biggest future payoff (Veo).
4. **Website/HTML + deck** — trivial anchor additions, shared structure mapper.
5. **YouTube package + social** — re-based on the Section Plan so chapters/timestamps trace.
6. The other file exporters stay on `BaseExporter` indefinitely — they're deterministic and instant; adapt them opportunistically, never as a forced march.

**How Veo slots in (real-video generation, user's Google allowance):** a *capability of the video adapter*, not a new pipeline. The Structure Mapper already yields scenes-from-branches; Veo becomes an alternative `compileUnit` step — "render this scene as generated video instead of a slide," cached per scene hash (an unchanged scene **never** re-bills), with the existing graceful fallback chain (Veo → slide render → text slide) exactly like today's photo/clip/TTS fallbacks. Every Veo run goes through `plan()` → P2 heavy-op approval → user's own Google key. No company key, ever.

**How Lyria slots in (music beds):** an *assemble-stage capability* — per-chapter mood → bed track, cached by chapter hash + mood, mixed at the existing ffmpeg stitch with a ducking level under narration. Same approval gate, same BYOK rule, same "silence is a fine fallback" degradation.

## 2.5 Staleness and sync

When a node is edited, the app checks it (by contentHash) against the manifests of compiled artifacts that reference it and marks those **sections** stale — not the whole artifact.

- **Vocabulary reuse:** staleness marks use the Proposed Changes visual language (marked nodes in the tree + a quiet review surface) — a new mark kind meaning "compiled outputs behind this node are out of date," listing affected artifacts ("Podcast: 2 segments · PDF: 1 chapter") with a one-click *Regenerate stale parts* per artifact.
- **Never badger:** staleness is passive information (a subtle badge), never a popup, never auto-regeneration — regenerating costs money and is always the user's explicit, P2-approved choice.
- Manifests make this cheap: staleness checking is hash comparison, no AI involved.

## 2.6 Phased migration plan (capability-preserving; every phase ships alone)

Effort classes: **S** = days, **M** = 1–2 weeks, **L** = multi-week.

- **Phase 0 — Shared core (S).** One `compile-core` module: shared HTML-strip + traversal + Structure Mapper + CompileTree + contentHash + Manifest schema + fragment cache. Pure library, no behavior change anywhere; unit-tested deterministically.
- **Phase 1 — Podcast adapter (M). The proving slice — see 2.7.** Per-branch script units with source node ids, per-segment audio cache, selective re-synthesis + re-stitch, segment-map manifest, staleness badge for podcasts. Old whole-blob path kept as fallback until parity verified.
- **Phase 2 — PDF adapter (S/M).** Formalize `sec-<nodeId>` into bookmarks + manifest; staleness for PDFs; regeneration is free/instant so no cache needed — pure traceability win, very low risk.
- **Phase 3 — Video adapter (M).** `sourceNodeId` on slides, per-slide clip cache, regenerate-one-scene, scene-map manifest. Saves real TTS money; sets the stage for Veo.
- **Phase 4 — Website/HTML + deck adapters (S).** Shared Structure Mapper + `data-source-node` anchors + manifests.
- **Phase 5 — Veo scenes + Lyria beds (L).** As video-adapter capabilities per 2.4, behind P2 approval, on the user's keys, fully cache-aware from day one — **this is the payoff phase the whole architecture exists for**: heavy media lands inside the compiler instead of becoming two more one-offs.
- **Phase 6 — YouTube package + social on the Section Plan (S/M).** Chapter timestamps and thread segments trace to nodes.

Testing per phase follows the house rules: deterministic parts (mapper, hashing, manifests, cache invalidation) once with tight isolation; AI parts 5× against invariants (segments non-empty, every segment carries source ids, an unchanged branch NEVER re-bills — that last one is a money-guardrail test and a release blocker); output tests verify the finished artifact opens and plays, not just that a file exists.

## 2.7 Recommended Phase 1: the Podcast

Smallest real slice that proves the *whole* loop — traceability AND selective regeneration AND the cost win — on one format:
- The Electron side already stitches per-segment clips; only *which segments rebuild* changes.
- The script API already has the BYOK/failover plumbing; it changes from one blob to per-branch units.
- The payoff is immediately demonstrable and honest: edit one section of a 20-minute podcast, regenerate in seconds for pennies instead of minutes for dollars.
- PDF would be *easier* but proves nothing about cost (regeneration is free); podcast proves the economics that justify the architecture.

One real tradeoff to design for (flagged in 2.8): per-branch script generation could make the dialogue feel less continuous than one whole-blob conversation. Mitigation: generate per-branch with a short rolling summary of neighboring segments as context, plus an optional cheap "transition polish" pass — and the 5×-invariant tests compare flow quality before the old path is retired.

## 2.8 Risks and open decisions

**Risks (mine to manage):**
- *Podcast coherence* across independently generated segments (mitigation above; old path stays until parity is verified).
- *Cache correctness* — a stale-but-served fragment is worse than a re-bill; options are part of the cache key, and the money-guardrail test asserts both directions (unchanged ⇒ no bill; changed ⇒ fresh output).
- *Sidecar manifests* can get separated from files users move around; mitigation: the app also keeps manifests in its own records, keyed by artifact.
- *Cache disk growth* (video clips especially) — size-capped, oldest-first cleanup, and a visible "clear compiled cache" control.
- *Platform reach*: podcast/video assembly is desktop (Electron) today; the manifest/traceability layer is platform-neutral, so web/iOS inherit it whenever those pipelines arrive — no rework.

**🟠 Genuinely Howard's calls (nothing blocks Phases 0–1 except #1):**
1. **Staleness UX** — how loud should "this podcast is out of date" be? Recommendation: a subtle badge on the node + a line in the export dialog ("compiled 3 days ago — 2 sections have changed"), never a popup. Approve or redirect.
2. **A "Compiled Outputs" library?** Should finished artifacts (with their manifests) get a visible home in the app — per outline, "here are the podcast/PDF/video you've made from me, and whether they're current"? That's a real product surface (and a lovely demo), not just plumbing. Phase 2+ decision.
3. **User-facing vocabulary** — none of "compiler / manifest / cache" should ever reach the UI. Users see "Export," "Up to date / Needs refresh," "Regenerate changed sections." Confirm this framing (value-based naming).
4. **Regeneration default in the approval dialog** — when sections are stale, should "regenerate changed only" be the pre-selected choice (with "regenerate everything" one click away)? Recommendation: yes — cheaper by default, full rebuild always available.

---

*End of blueprint. No code was modified; the only file written is this document.*
