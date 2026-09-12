# IdeaM Homepage Hero Video — Shot List / Storyboard

**Purpose:** Pre-production plan for the home-page hero film that plays in the
"A great idea isn't a single prompt" band on the landing page. This REPLACES the
old rendered mp4 (which baked in the retired "IdiamPro" name, a British narration
voice, and a dark background — all wrong now).

> The old file's full 122-clip deep-dive tutorial inventory is preserved in
> `docs/homepage-video-deepdive-series-REFERENCE.md`. This file is now the HERO
> film only.

---

## Non-negotiable spec (what changed and must be true)

- **Product name: `IdeaM` everywhere.** On screen and in metadata. NEVER "IdiamPro".
  In the spoken script, spell it phonetically **"Idea-M"** (two beats: "idea" + "em")
  so the voice pronounces it as a word, not letters.
- **Narration voice: resonant AMERICAN.** Recommended OpenAI TTS voice = **`onyx`**
  (deep, warm, resonant, American male). This REPLACES the old British `fable`.
  Why `onyx`: it is the deepest, most authoritative American voice in the OpenAI set,
  which suits our protagonist (a physician-scientist) and reads as premium — the
  "aspirational to a student, relatable to a professional" tone the hero requires.
  IdeaM is an American company; a British accent reads as pretentious in the U.S.
  market and is harder for many viewers to follow. (Alternate American option: `echo`,
  but it is lighter/younger; use only if `onyx` feels too heavy in the final mix.)
- **WHITE / LIGHT BACKGROUND FOR THE ENTIRE VIDEO — top production requirement.**
  Every frame — title cards, screenshot slides, end card — sits on white / near-white
  to match the new light-themed site. NO dark frames anywhere. (The prior in-app render
  came out DARK; see the production plan for the exact fix — the generator supports a
  `theme: 'light'` mode; it must be forced ON for every slide, or we composite on white
  ourselves.)
- **UI: clean LIGHT theme throughout.** Every app screenshot is the light UI. Panes
  filled, never an empty "Start writing…".
- **PACING: BRISK, FAST, PUNCHY — not slow.** The old cut dragged ("like a turtle").
  The new one moves: short punchy narration lines, no filler, quick scene cuts. Bake
  speed into BOTH the script (tight lines) AND production (TTS ~1.15–1.25× speed, brisk
  slide durations). Still honor the read-time minimum so text is legible — brisk, not blurred.
- **Feel:** premium, confident, energetic. Aspirational to a student ("I want to work like
  that"), relatable to a pro ("that's my day").

---

## Protagonist & story — Marcus, the physician-scientist health coach

**Marcus is an MD + DrPH** — a research-driven health coach (equally a chiropractor
or naturopath would fit). He is **a creator, not a curator**: most of the outline is
**his own analysis, data, and conclusions**; published studies are supporting evidence,
not the point. He compares multiple studies, weighs them, and reaches his own expert
conclusions — which is why spreadsheets and medical graphics belong in his work.

**The arc = "one idea, developed over many passes, retargeted to two audiences."**
From a single outline Marcus produces, live, four real IdeaM outputs:
- **Emails** to his peers (rigorous, citation-backed),
- a **blog post** for the public (accessible, plain-language),
- a **spreadsheet with graphics** (his results, charted),
- a **PowerPoint** to present to peers.

Same knowledge, two audiences (peers = rigor; clients/public = accessible). That
retargeting IS the payoff, and every output is a genuine IdeaM export — demonstrable,
not staged.

---

## The content pane must stay ALIVE — cycle the real outputs

The single biggest fix from the old cut: the content pane showed **one boring
spreadsheet**. In the new film, as Marcus clicks node to node, the content pane
**cycles through a spread of varied, real, on-brand IdeaM outputs** so viewers feel
"anything can live in a node, and one outline becomes everything."

**Verified clean assets already on disk (LIGHT UI, current `IdeaM` brand — use these):**

| Output type | Asset | What it shows |
|---|---|---|
| Spreadsheet **with graphics** | `/public/showcase/spreadsheet.jpg` | Color-coded financial results grid (green/amber/red highlights) |
| Data chart / graphic | `/public/showcase/data-chart.jpg` | A pie chart of study outcomes (HbA1c across TRE studies) — health-topic, fits Marcus |
| Diagrams (three-in-one) | `/public/screenshots/diagrams-all-three.png` | Mind map + flowchart + Gantt timeline on one page, no name |
| The thesis flow | `/public/showcase/process-diagram.jpg` | Sources → Capture/Develop/Deliver → blog post, slide deck, podcast, spreadsheet, email |
| Live source embed | `/public/showcase/live-embed.jpg` | A research video (NutritionFacts.org) playing inside a node — health-topic |
| Imported doc → structure | `/public/showcase/imported-document.jpg` | A plain doc turned into a color-coded process diagram |
| Website output | `/public/screenshots/wizards-website-live.png` | Generate-Website wizard, `IdeaM` brand |

**GAPS — capture fresh before final render (no clean `IdeaM`-brand screenshot exists yet):**
- a **finished EMAIL to a colleague** (the peer-facing output),
- a **finished BLOG POST** rendered for the public,
- a **finished POWERPOINT / slide deck**.

Do NOT reuse the old `IdiamPro`-branded or dark screenshots
(`01-hero-strategy-mindmap.png`, `02-ai-spreadsheet.png`, `outputs.png`,
`content-spreadsheet.png`, `app-desktop-hero.png`, `home-hero-poster.jpg`,
`homepage-sizzle-poster.jpg`) — they all still carry the retired name and/or a dark theme.

---

## Feature the RECENT additions — proof the product is actively growing

Alongside Marcus's core outputs, the content-pane sequence must showcase the FIVE
headline powers from the last ~2 weeks, so the film reads as a living, fast-moving
product. All stay on the `IdeaM` name, light theme, honest framing.

**THE FIVE HEADLINE FEATURES to feature in the content pane:**
1. **Project-management + email system** — Task items with **status** (Not started /
   In progress / Done / Blocked), **"Depends on"** prerequisites, Blocked-by signals, and
   **Email tools** that turn an outline into an email (or an email into an outline + a
   drafted reply) that you **review and send yourself**. (Homepage badges: PM tags = "At
   launch"; email = "At launch". Email tools are opt-in, OFF by default — IdeaM never
   touches your inbox on its own.)
2. **Organize menu** — the tag + status organization system: tag anything, then
   **Filter** to just what matters in one click. (Homepage: "Organize your work with tags",
   "At launch".) NOTE: no menu literally named "Organize" exists in the code today; the
   real surfaces are the **tag/status system** and **Smart Tools ▸ "Transform outline with
   AI…"** (auto-organize a whole outline). Confirm which the owner means, then capture clean.
3. **Post to social — in your own voice** — turn any branch into **ready-to-post content
   tailored to each platform (X, LinkedIn, Instagram, …), written in your own voice.**
   (Homepage badge: "New" = shipped.) **ACCURACY (must not be violated): you review every
   word and post it yourself; IdeaM NEVER posts for you and never connects to your real
   accounts.** Never imply auto-posting.
4. **Write in your own voice (Your Voice)** — teach IdeaM your writing style from your own
   samples, then generate emails/posts/drafts that sound like you (your own voice only,
   never imitating anyone else; opt-in, OFF by default). This is the engine behind #3's
   "in your voice."
5. **File organization system ("Understand your drive")** — point IdeaM at a folder and it
   sorts files by **meaning, not filename**, turning a messy drive into a navigable outline.
   **HONESTY FLAG: this is badged "Coming soon" (roadmap, arriving after launch) — it is NOT
   shipped.** If featured, present it as clearly forthcoming (e.g. a "coming soon" beat),
   never as a live capability. Recommend leading the film with the four shipped powers and
   giving file-organization a brief, honestly-labeled "and next…" moment.

**Supporting detail on the shipped capabilities (from the changelog / commit history):**
- **Project Management (opt-in, OFF by default):** dedicated **Task** items (with a
  checkbox), a fixed **status** set — Not started / In progress / Done / Blocked —
  assigned from an item's **Project** submenu, **prerequisites / "Depends on"** chips
  that turn green when the blocker is Done, an automatic **"⚠ Blocked by"** signal,
  **Filter-by-status/tag**, and **pure-logic PM report wizards** (no AI, no cost).
- **Capabilities framework:** power features (Project Management, **Email tools**,
  **Your Voice**, **Social export**) live in **Settings → Professional Customization →
  Capabilities**, each OFF by default with an honest on-enable explanation — the app
  never touches email/accounts on its own.
- **Email tools (opt-in):** turn an outline branch into an email you always **review and
  send yourself** — IdeaM never sends automatically. (Doubles as Marcus's peer emails.)
- **Social posts (opt-in "Social export"):** turn a branch into **ready-to-post content
  tailored to each platform, optionally in your own voice** — you then review and copy it,
  open the platform's composer, or download it. **ACCURACY (must not be violated): IdeaM
  does NOT auto-publish and never connects to your real accounts — it produces the copy
  and hands it to you.** Never imply auto-posting.
- **Your Voice:** teach IdeaM your own writing style from samples, then generate outputs
  that sound like you (your own voice only). Powers the "in your voice" social/email copy.
- **Filter outline by tag** view control; **honest "What's new" capabilities spotlight**
  on the homepage; long-podcast robustness; unified content-pane AI button.

**Screenshot status for the recent features:**

| Recent feature | Clean LIGHT `IdeaM` shot on hand? | Where / action needed |
|---|---|---|
| Project Management (tasks, status badges, "Depends on", Blocked-by) | YES | `scratchpad/pm-wizards.png` — clean & on-brand; **move into `/public` (or re-capture) for the render** |
| Capabilities / opt-in consent (Email tools · Your Voice · Social export toggles + honest copy) | YES | `scratchpad/.../share-to-x/04-social-enabled.png` — the Settings panel with the "never posts automatically / never connects to your accounts" copy; **relocate/re-capture** |
| Filter-by-tag view | LIKELY | `scratchpad/filter-by-tag.png` — verify brand, then relocate |
| A finished **social post** preview (compose/copy view) | NO — **capture fresh** | Show the generated post tailored to a platform, with the review/copy affordance (NOT auto-post) |
| A finished **email to a peer** | NO — **capture fresh** | The review-before-send email (also covers Marcus's peer emails) |
| A finished **blog post** (public-facing render) | NO — **capture fresh** | |
| A finished **PowerPoint / slide deck** | NO — **capture fresh** | |
| A finished **social post** in the composer/"in your voice" view | NO — **capture fresh** | |
| A finished **email draft** ready to open in Gmail/Mail | NO — **capture fresh** | (Doubles as Marcus's peer emails) |
| **Your Voice** style-profile setup | PARTIAL | Visible as a toggle in the Settings capture above; a dedicated "teach your style" panel would be **captured fresh** |
| The **"Organize" menu** / tag+status organization | PARTIAL / **flag** | Tag+status visible in `pm-wizards.png`; no menu literally named "Organize" exists — nearest is **Smart Tools ▸ "Transform outline with AI…"**. Confirm intent, capture clean. |
| **File organization ("Understand your drive")** | NO — and **NOT shipped** | Roadmap / "Coming soon". If shown, label it forthcoming; do not fake a live capability. |

Fold these in as a short, brisk "and it keeps growing" movement (see the recent-features
beat), staged AFTER Marcus's four core outputs so the story leads and the feature-proof follows.

---

## Production rules (carried from the prior spec, still in force)

- **SYNC:** every on-screen action lands exactly as the narration names it. Render each
  line, measure its audio length, time the motion to it.
- **PROGRESSIVE DISCLOSURE:** outlines start compressed to top-level headings, then
  expand section by section as the narration reaches them.
- **READ TIME / DWELL:** hold every revealed node/pane long enough to read comfortably
  (~0.3s per word, ~1.5–2s minimum, longer for filled panes). When unsure, hold longer.
- **TRUE FIDELITY:** film the real app doing the real thing; batch AI generation so it
  lands fast / all-at-once, never a slow per-item crawl.
- **PANE-WIDTH:** size the split so content fills the panes — no empty voids.
- **BACKGROUND:** white / near-white on EVERY frame (title cards, slides, end card).
- **PACING:** brisk cuts; TTS ~1.15–1.25× (see production plan); no dead air.
- **End card:** light card, teal accents — "IdeaM · Your partner in thinking · Start free"
  + "Produced by IdeaM." (Teal on WHITE, not on dark.)

---

## Timed beats (narration = the `onyx` American script, ~1.2× speed; "Idea-M" phonetic)

Script is deliberately short and punchy — every line earns its place. White background
throughout. Target ~70s, brisk.

| Time | On-screen (WHITE bg, LIGHT UI, synced) | Narration (tight/fast) |
|---|---|---|
| 0:00–0:05 | White. Cursor types the title: **"Time-Restricted Eating — What the Evidence Says."** | "One idea. Watch it grow up." |
| 0:05–0:15 | Outline snaps open heading by heading — Marcus's own thesis first, studies nested as evidence. Pane fills with his analysis. | "Marcus is a physician. He doesn't just collect studies — he weighs them, and draws his own conclusions. It all lives in one place." |
| 0:15–0:26 | Quick cycle: analysis text → **color-coded spreadsheet** → **pie chart**. | "His results — a spreadsheet. A chart. The evidence, at a glance." |
| 0:26–0:36 | **Three-in-one diagram** page draws (mind map, flowchart, timeline); **research video** plays inside a node. | "A mind map. A flowchart. A source, playing right in his notes. One outline holds all of it." |
| 0:36–0:50 | Outline fans into finished outputs, one quick reveal each: **peer emails**, **blog post**, **spreadsheet + charts**, **PowerPoint**. | "Now it retargets. Emails for his peers — rigorous. A blog post for everyone else — plain. A deck to present. One idea, every audience." |
| 0:50–1:02 | **RECENT-FEATURES burst** — fast montage: **task statuses + "Depends on"** chips; the **tag/Organize filter**; a **social post in his voice** (with the review/copy affordance, NOT auto-post); a brief **"Coming soon" tag** on file-organization. | "And it keeps growing. Track the work. Organize it. Turn it into social posts — in your voice, posted only when you say so. Point it at your whole drive — soon." |
| 1:02–1:10 | Pull back to the clean light app on white; wordmark settles: **IdeaM**. Light end card, teal accents. | "Idea-M. Your partner in thinking. Start free." |

**Runtime:** ~75s target, but no hard cap — give each wow beat its full, readable moment;
trim only genuine dead air (per the "impact over brevity" rule).

---

## Production plan — how the new mp4 actually gets made

**Two viable paths; recommend the composite path for full control of the white look.**

1. **Narration** — OpenAI TTS, voice **`onyx`**, **speed ~1.15–1.25** (the API `speed`
   parameter; default 1.0 is what made the old cut drag). One audio file per beat so each
   line's duration can be measured and the visuals synced to it. Needs an **OpenAI API key**
   (small cost — cents per render).
2. **The WHITE-BACKGROUND problem (the main thing to solve).** The in-app generator
   (`electron/video-generator.js`) already supports a light theme — it branches on
   `theme === 'light'` and paints a white gradient with dark text — but it **defaults to
   dark**, which is why the recent sample (`idiampro-video-…978.mp4`) came out dark. Fix =
   force `theme: 'light'` on **every** slide object we feed it (title, screenshot, end
   card), and verify no slide falls back to the dark default. If any slide type ignores the
   flag, the safer path is to **composite ourselves**: lay each screenshot/title on a solid
   white canvas via ffmpeg, so white is guaranteed frame-to-frame.
3. **Capture the missing stills first** (all on white/light, IdeaM brand): finished email,
   blog post, slide deck, social-post-in-your-voice, the Your Voice panel, and a clean
   "Organize"/Transform capture; relocate the good scratchpad shots (`pm-wizards.png`,
   the Settings social/consent panel) into `/public`.
4. **Assemble** — lock the visual cut to the beat table; composite stills + gentle
   Ken-Burns motion to the measured audio durations (ffmpeg); keep scene durations brisk;
   end on the light "Produced by IdeaM" card.
5. **Ship** — export `home-hero.mp4` + a clean **light** `home-hero-poster.jpg`, replacing
   the old dark files, and revert the stopgap `<img>` on the homepage back to a `<video>`.

**Honest effort/quality read:** the pieces all exist (TTS, the light-capable generator,
ffmpeg, most screenshots), so this is very achievable — the real work is (a) forcing white
on every frame and verifying it, (b) capturing ~5 missing output stills cleanly, and
(c) tight sync + brisk pacing. Budget a focused half-day to a day for a polished result;
the biggest quality risks are the white-background consistency and keeping the pace fast
without flashing text by. A key (OpenAI, for TTS) is the only external dependency.
</content>
