# IP Protection Prep — IdiamPro / SecondBrainWare

**Prepared:** 2026-07-15
**Owner / entity:** SecondBrainWare LLC (WA; UBI 606 260 327; EIN 42-3795148)
**Purpose:** A ready-to-hand-off packet so an IP attorney can move fast and cheap. It inventories the marks to clear, the genuinely novel mechanisms worth a provisional patent, and the copyright/trade-secret posture — with a bootstrap-budget filing sequence.

> ⚠️ **This document is preparation, NOT legal advice.** All fee figures, class picks, and strategy calls here are starting points to confirm with a qualified IP attorney. Government fees change frequently — verify current USPTO amounts before filing.

---

## 1. Trademarks

**Owner of record for all marks:** SecondBrainWare LLC.

**The "Idiam" prefix is the core asset.** "Idiam" is a coined, arbitrary term (from "IDea AMplifier") with no dictionary meaning — that makes it inherently **distinctive and strong** on the trademark spectrum (arbitrary/fanciful marks get the broadest protection and are easiest to register and enforce). The whole product family deliberately shares this prefix, which reinforces a protectable "house of marks."

**Marks to clear and file:**

| Mark | Product | Priority | Likely goods/services |
|---|---|---|---|
| **IdiamPro** | Flagship app (shipping first) | **File first** | Downloadable + cloud software |
| **SecondBrainWare** | Company / house brand | High | Software company / SaaS |
| **IdiamTeam** | Team collaboration product (next build) | Medium (intent-to-use) | Collaboration SaaS |
| **IdiamProject** | Living project manager (future) | Lower (intent-to-use) | Project-management SaaS |

**Likely Nice classification (confirm with counsel):**
- **Class 9** — downloadable software (the Mac/iOS/desktop apps).
- **Class 42** — SaaS / "software as a service," cloud-hosted features, AI processing. Most modern software brands file **both 9 and 42**; each class carries its own fee.
- IdiamTeam/IdiamProject may add **Class 42** collaboration/PM service language. Enterprise/GDSS angle stays within 42.

**Filing basis:** IdiamPro is in use (or imminently) → likely "use in commerce" (§1(a)). IdiamTeam and IdiamProject are not built → file **"intent to use" (§1(b))** now to lock in an early priority date while paying only the application fee up front.

**🟠 "IDM" is crowded — do NOT revive it.** The brand was briefly reworked to "IDMPro" and reverted on 2026-07-15 after a preliminary screen came back **medium-high risk**: "IDM"/"IDM Pro" collides with **Internet Download Manager** (well-known software, same lane) and "IDM" is a crowded three-letter term generally. This is exactly why "Idiam" was coined originally. Keep all public marks on the "Idiam" prefix. (Pronunciation "I-D-M Pro" is handled in copy/narration, never in the registered spelling.)

**DIY knockout search (do before paying an attorney to file):**
1. **USPTO trademark search** (the current trademark search tool at uspto.gov, successor to TESS) — search each exact mark, plus close variants ("Idiam," "Idiom Pro," "Idiam Team," "2nd Brainware," "Second Brain Ware"). Note any live marks in Classes 9 and 42.
2. **Common-law web search** — Google, App Store / Google Play, GitHub, domain registrars, social handles. Unregistered ("common-law") users can still block you in their territory, so look beyond the USPTO register.
3. **Domain check** — confirm the .com and key variants; secondbrainware.com is already held.
4. Record hits and hand the list to counsel; a clean knockout on your side saves attorney search hours.

**Rough trademark cost (verify current):** USPTO application fee is on the order of **~$250–$350 per class per mark** (the current base electronic filing fee). Attorney prep/filing typically adds **~$300–$700 per mark**. Registration takes roughly **8–14 months** if unopposed. An intent-to-use filing later needs a Statement of Use (extra small fee) once the product ships.

---

## 2. Patent candidates (provisional seeds)

Below, each candidate is written as a plain-language seed you can drop into a **provisional patent application** — a fast, low-cost filing that stamps a priority date and buys **12 months** to decide on the full (non-provisional) patent. Ranked by defensibility/novelty. **Prior-art note applies to all:** outliners, Gantt tools, CRDT editors, and LLM generators each exist separately — novelty lives in the *specific combination and the adaptive/generative mechanism*, so claims must be drafted narrowly around the mechanism, not the general idea.

### Candidate A — Living outline as single source of truth with generated, auto-readapting project views *(strongest)*
**Problem:** Every project-management tool stores the plan as a rigid Gantt/PERT artifact. When something changes, updating dates, dependencies, the critical path, and downstream resources is manual, slow, and the *impact* of a proposed change is opaque — the dreaded "if this slips two weeks, what happens to the launch?" question is agony.
**What's novel:** Treating a **structured outline as the canonical model** and rendering Gantt, PERT, and timeline representations as **disposable generated VIEWS** — then, on any single edit to the outline, **automatically recomputing every view** (dates, dependencies, critical path, resource leveling) in real time, enabling **what-if / change-impact analysis** where the user sees the ripple *before* committing.
**How it works:** A scheduling/dependency engine (CPM-style) is bound to the outline model; edits propagate through a dependency graph; views subscribe and re-render. The inventive step is the one-way "model → many live views" binding plus the pre-commit impact simulation. This is the seed for the future **IdiamProject** product; file the provisional early because the concept is disclosed in planning docs and is the sharpest, most defensible mechanism.
**Prior-art risk:** Medium. Scheduling engines and Gantt generators exist; frame claims around the *outline-as-source-of-truth + instantaneous multi-view readaptation + pre-commit impact preview* as a unit.

### Candidate B — Multilingual collaboration board: contribute-in-any-language, auto-woven shared outline *(strong)*
**Problem:** Group decision / brainstorming tools (the GroupSystems / GDSS lineage) are effectively monolingual. Multinational teams can't truly think together when everyone must converge on one language, and foreign-language source documents sit outside the shared record.
**What's novel:** A **single shared structured outline** in which each participant **brainstorms, comments, reads, and votes in their own language**, contributions and foreign-language source documents are **auto-translated and woven in place into the same node tree**, and every participant sees the whole shared body of knowledge rendered in *their* language — over a real-time collaborative substrate.
**How it works:** Combines a translation engine + a live CRDT-synced shared outline + a "transform/weave" step that inserts translated contributions as first-class nodes with language metadata, so the group owns one structured artifact regardless of languages spoken. Seed for **IdiamTeam**.
**Prior-art risk:** Medium. Real-time co-editing (CRDT) and machine translation each exist; novelty is the *per-participant-language shared structured outline with in-place weaving and structured GDSS operations (anonymous parallel input, voting) on top*.

### Candidate C — Capture → reorganize → consolidate "second brain" pipeline across many heterogeneous inputs *(moderate–strong)*
**Problem:** Knowledge tools store what you capture but don't help you *understand* it. Understanding comes from **restructuring** scattered inputs into a coherent hierarchy — a step today's note apps leave entirely manual.
**What's novel:** A pipeline that ingests **many heterogeneous sources** (typed notes, web pages, PDFs, YouTube transcripts, audio/video transcription, image OCR, Office docs, outline files, live-web refresh) and drives a **capture → reorganize → merge/consolidate** flow where AI *assists* restructuring into one developed outline while the human retains authorship and control — with an explicit **merge/consolidation** operation as the core act.
**How it works:** Normalizers convert each input type into outline nodes; a consolidation engine proposes structure/merges; the user edits. The inventive framing is the AI-assisted *consolidation/merge as the central operation* over a many-source ingest funnel.
**Prior-art risk:** Higher — "second brain" apps, import pipelines, and AI summarizers are crowded. Narrow claims to the specific merge/consolidation mechanism and multi-source normalization-into-one-adaptive-outline; treat as a secondary filing.

### Candidate D — One outline → many finished formats (multilingual · multilevel · multimedia) generation *(moderate)*
**Problem:** Turning one body of ideas into a video, a podcast, a website, slides, and documents means re-authoring for each format and each audience — hugely labor-intensive.
**What's novel:** A **single structured outline that generates multiple finished output formats** (video slideshow + AI voiceover, podcast, presentation, illustrations, translated editions across ~21 languages, ~25 export formats) **and adapts the same content across audience sophistication levels** (e.g., a grade-6 and a professional edition of the same idea) from one source.
**How it works:** The outline model feeds format-specific renderers (slide/voiceover pipeline, TTS podcast, deck generator, translation, diagram generation) plus an audience-level adaptation pass. Inventive framing: outline-driven multi-format, multi-level, multilingual publishing from one canonical structure.
**Prior-art risk:** Higher — AI content/video generators are a fast-moving crowded field. Best positioned as a defensive/secondary filing or folded into A/C claims; hardest to defend standalone.

**Suggested patent priority:** A first (sharpest, most defensible, future flagship), then B (strong differentiator, category-claiming), then C and D as budget allows or as defensive provisionals.

---

## 3. Copyright & trade secret

**Copyright (automatic on creation; registration adds enforcement teeth):**
- **Source code** — the app codebase. Copyright exists automatically; consider registering key releases if litigation risk warrants (registration is a prerequisite to suing and unlocks statutory damages).
- **Marketing content** — website copy, the founder/origin narrative, taglines' expression (note: short taglines/names are *not* copyrightable — those are trademark territory), and the outline documents.
- **Produced media** — the generated marketing videos, podcasts, and imagery you author. Watch third-party inputs: AI-generated components, stock assets, and voices each carry their own license terms; keep a rights ledger so every produced asset is clean.
- Add a **© SecondBrainWare LLC [year]** notice to the site, app, and videos. Ownership sits with the LLC — ensure any contractor work is assigned to the company in writing (work-made-for-hire / IP assignment clauses).

**Trade secret (protect the unfiled, the roadmap, and the internals):**
- The **unfiled patent concepts** (especially IdiamProject and IdiamTeam mechanisms) are trade secrets *until* a provisional is filed — limit disclosure until then.
- **🟠 Keep in-development work private — including NOT letting the site get indexed yet.** Public disclosure can start patent clocks and hand competitors the roadmap. Keep pre-launch pages behind noindex/robots exclusion or auth until you're deliberately public.
- **NDAs** for beta creators, evaluators, and prospective partners *before* showing them non-public mechanisms — particularly anyone seeing the Team/Project concepts or internal architecture. The OpenAI / AI-video partnership conversations especially warrant an NDA before sharing specifics.
- Standard hygiene: confidentiality clauses in contractor agreements, access controls on the repo and internal outlines, and a clear internal "what's public vs. confidential" line.

---

## 4. Filing plan, rough costs & recommended sequence

**Provisional patent (the cheap priority stamp):**
- A **provisional application** establishes a priority date and gives **12 months** to file the full non-provisional (or let it lapse). It's never examined and never becomes a patent by itself — it's a placeholder that lets you say "patent pending."
- **USPTO fee (verify current):** roughly **~$130 small-entity / ~$65 micro-entity** for the provisional filing fee. SecondBrainWare likely qualifies as a **micro-entity** (very low gross income, few prior filings) or at least **small entity** — confirm eligibility; it roughly halves/quarters fees.
- **DIY vs. attorney:** you *can* self-file a provisional cheaply, but a mechanism this nuanced benefits from an attorney shaping the written description so it actually supports strong claims later. Attorney-drafted provisional: **~$2,000–$5,000+ each**. The full non-provisional at the 12-month mark is the big spend (**~$8,000–$15,000+ with attorney**, plus USPTO fees) — budget for that decision, don't sleepwalk into the deadline.
- **Timeline:** provisional filed in days; non-provisional due within 12 months; patents take **2–4+ years** to grant.

**Trademark (see §1 for per-mark detail):** ~$250–$350/class USPTO + ~$300–$700 attorney per mark; ~8–14 months to registration; intent-to-use available for the unbuilt products.

**🟠 Recommended priority order for a bootstrap budget:**
1. **File the IdiamPro + SecondBrainWare trademarks first.** Cheapest, protects the names you're about to market publicly, and the brand is the asset customers will actually recognize. Do the DIY knockout search first to keep attorney cost down.
2. **File a provisional patent on Candidate A** (living outline → auto-readapting project views). It's the sharpest, most defensible mechanism, it's already partially disclosed in planning docs, and the provisional is cheap insurance that starts the clock on your terms.
3. **File a provisional on Candidate B** (multilingual collaboration board) — the category-claiming differentiator for IdiamTeam — as budget allows.
4. **Intent-to-use trademarks for IdiamTeam and IdiamProject** to lock the family's priority dates cheaply, well before those products ship.
5. Candidates C and D as defensive provisionals if/when budget permits.

**Before the attorney meeting, have ready:** this document, the entity details (LLC/UBI/EIN above), the DIY knockout-search results, a one-paragraph description of each product, and a list of anything already publicly disclosed (site pages, videos, demos) with dates — disclosure dates drive patent deadlines.

---

> ⚠️ **Reminder: this is preparation, not legal advice.** Confirm every classification, strategy, deadline, and fee with a qualified IP attorney before filing. Government fees and rules change — verify current USPTO amounts at filing time.
