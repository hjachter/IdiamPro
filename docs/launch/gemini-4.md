# Gemini 4 — Day-Of Launch Copy (STAGED)

**Status:** DRAFT — paste in real numbers after the 2026-05-19 Google announcement.
**Owner:** Howard
**Last updated:** 2026-05-14

---

## Placeholders to replace on launch day

Search-and-replace these tokens once the official details are public:

- `{{GEMINI4_FREE_NAME}}` — likely "Gemini 4 Flash" (unconfirmed)
- `{{GEMINI4_PRO_NAME}}` — likely "Gemini 4 Pro" (unconfirmed)
- `{{GEMINI4_CONTEXT}}` — context window (rumored 5–10M tokens; confirm)
- `{{GEMINI4_PRICING_FREE}}` — free-tier daily / RPM quota
- `{{GEMINI4_PRICING_PRO}}` — per-million-token input/output price
- `{{GEMINI4_BENCH_HEADLINE}}` — the one benchmark Google highlights (e.g., "MMLU 92%")
- `{{GEMINI4_AGENTIC_NAME}}` — branded name for the agentic mode, if any
- `{{GOOGLE_BLOG_URL}}` — link to Google's official announcement post
- `{{API_AVAILABILITY_DATE}}` — date Gemini 4 hits AI Studio's public API
- `{{BYOK_LINK}}` — settings page anchor for our BYOK guide

---

## 1. Landing-page section (secondbrainware.com)

> **Now powered by Gemini 4.**
>
> Google just released Gemini 4 — and SecondBrainWare supports it on day one.
>
> What that means for your second brain:
>
> - **{{GEMINI4_CONTEXT}}-token context window** — your entire knowledge base fits in a single prompt. No more retrieval seams, no more partial answers.
> - **Stronger multimodal ingest** — drop a PDF, a video, or a meeting recording and watch it fold into your outline with proper structure, not a flat dump.
> - **{{GEMINI4_AGENTIC_NAME}} mode** — LIVE BOOKS (coming soon) uses it to refresh any outline against the current state of the internet, with citations.
>
> Bring your own Gemini API key and SecondBrainWare picks up Gemini 4 automatically. No code change, no upgrade, no extra cost — Google's pricing applies.
>
> [Set up your Gemini key →]({{BYOK_LINK}})

---

## 2. Product Hunt — pinned update comment

(For the existing SecondBrainWare PH launch — post as a maker update.)

> 📢 **Update — Gemini 4 day-one support**
>
> Google announced Gemini 4 today. SecondBrainWare already supports it — Bring Your Own Key users get it automatically, and our paid tier will offer it as an option once we finish a brief stability test.
>
> What I'm most excited about:
> - The bigger context window means LIVE BOOKS (refresh-any-outline-against-the-internet) is finally tractable as a real feature, not a science project.
> - Multimodal upgrades make PDF / video / audio ingest substantially better — that's the workflow our research-heavy users hit hardest.
>
> Read Google's announcement: {{GOOGLE_BLOG_URL}}
>
> — Howard

---

## 3. Hacker News — separate Show HN follow-up post (optional)

**Title (under 80 chars):**
> Gemini 4 day-one support in SecondBrainWare — what changes for an outliner

**Body:**
> Quick follow-up to my earlier Show HN. Google released Gemini 4 today. I added support immediately because the rumored {{GEMINI4_CONTEXT}}-token context window unlocks something we've been waiting on:
>
> LIVE BOOKS — pick any outline and refresh its content against the latest from the internet, with citations. With Gemini 2.0's 1M context we could only do this one chapter at a time, with retrieval glue holding it together. With {{GEMINI4_CONTEXT}}, the model can hold the full outline + the new sources in a single coherent pass. Much better output quality.
>
> Implementation note that may interest other AI-app builders: our app's Gemini model id is a single config entry. Day-of update was three lines — add the new model to the registry, flip the default, deploy. No call-site changes. Anyone shipping AI apps should consider this pattern; vendor model churn is going to get worse, not better.
>
> BYOK users get Gemini 4 automatically (your Google key works for it). Paid tier rolls out after a 48-hour soak.
>
> Happy to discuss the LIVE BOOKS design or the Gemini-4-specific prompts we ended up using. — Howard

---

## 4. Twitter / X — single tweet (under 280 chars)

**Variant A — feature-focused (251 chars):**
> Gemini 4 dropped today. SecondBrainWare supports it on day one.
>
> What changes: outlines with thousands of nodes can now be reasoned over in one pass. LIVE BOOKS (refresh any outline against the live internet) just became feasible.
>
> BYOK users: it's already on.

**Variant B — builder-focused (268 chars):**
> Building AI-native apps in 2026 means model churn is constant.
>
> Our Gemini 4 day-one support shipped in 3 lines: add to registry, flip default, deploy. Zero call-site changes.
>
> Architecture is everything. If you're shipping AI, abstract your model picker now.

---

## 5. LinkedIn — short post (200–250 words)

> Google released Gemini 4 today, and SecondBrainWare supports it from minute one.
>
> The technical why is interesting and worth sharing: when I built SecondBrainWare, I made the Gemini model identifier a single config entry — every AI call site reads from one registry. Adding Gemini 4 was three lines of code and a deploy. No regression risk, no scramble.
>
> The product why matters more. A bigger context window doesn't just mean "the model can read more." For an AI-native outliner, it changes what the AI is *for*. With a {{GEMINI4_CONTEXT}}-token window, the model holds your entire knowledge base in a single prompt — no retrieval seams, no chunking artifacts, coherent reasoning across the whole thing. That's what makes LIVE BOOKS (refresh any outline against the latest internet content) tractable.
>
> Bring-your-own-key users on SecondBrainWare get Gemini 4 instantly. Subscription users get it as an option after a stability soak. No price increase from us — Google's API pricing flows through directly.
>
> If you're shipping an AI product right now, the meta-lesson: build for model churn. Vendors will release new models every 4–8 weeks for the next year, and the apps that can absorb each one in an afternoon will compound the advantage.
>
> — Howard Jachter, founder

---

## 6. BYOK docs update (add to in-app help + settings setup guide)

> **Gemini 4 (added 2026-05-19)**
>
> Your existing Gemini API key from `aistudio.google.com/apikey` works for Gemini 4 — no new key needed.
>
> To use Gemini 4 for AI features in SecondBrainWare:
>
> 1. Settings → AI Service Keys → confirm your Gemini key is saved.
> 2. Settings → AI Mode → set to "Cloud AI (Gemini)".
> 3. Settings → Gemini Model → pick "{{GEMINI4_PRO_NAME}}" or "{{GEMINI4_FREE_NAME}}".
>
> Note on cost: Google charges {{GEMINI4_PRICING_PRO}} for Gemini 4 Pro vs. their previous Gemini 2.0 pricing. SecondBrainWare never marks up your API costs — what Google charges is what you pay.
>
> If you want to stay on Gemini 2.0 Flash (still free, still fast, still good enough for most outline work), keep the default. We're not deprecating it.

---

## 7. Press / outreach one-liner

For replying to anyone who tweets or posts about Gemini 4:

> SecondBrainWare added Gemini 4 support today. Bring your own Google key and it's already on. https://secondbrainware.com

---

## Distribution checklist for May 19

In execution order on launch day:

- [ ] Web-search Google's official Gemini 4 announcement
- [ ] Fill in all `{{...}}` placeholders above
- [ ] Add the new Gemini model entry to the registry, flip the default if appropriate
- [ ] Deploy to web (Vercel auto-deploys on git push)
- [ ] Restart Electron, smoke-test one AI feature end to end
- [ ] Publish: landing page update, BYOK docs update, Twitter post, LinkedIn post
- [ ] Pin Product Hunt maker update comment
- [ ] Maybe: Hacker News follow-up post (decide based on Gemini 4 reception)
- [ ] Update IdiamPro - Launch Progress outline with completed task #49
