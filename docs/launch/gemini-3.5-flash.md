# Gemini 3.5 Flash — Launch Copy (SOFT variant)

**Status:** READY — numbers below are from Google's I/O 2026 announcement (2026-05-19).
**Owner:** Howard
**Last updated:** 2026-05-21
**Variant:** soft — Google shipped a measured 3.5 Flash bump, not a major version. Copy is matched to that.

---

## What actually shipped at Google I/O 2026

- **Gemini 3.5 Flash** — generally available the same day (2026-05-19). This is the model SecondBrainWare now defaults to.
- **Gemini 3.5 Pro** — in development, rolling out June 2026. Not wired in yet; a one-line registry entry when it lands.
- Context window: **1M-token input**, 64K-token output.
- API pricing: **$1.50 / M input**, **$9.00 / M output**, cached input **$0.15 / M**.
- Headline benchmark Google emphasized: **83.6% on MCP Atlas**.
- New consumer tier "Google AI Ultra" at $100/month (not relevant to BYOK users).

No "Gemini 4." The honest framing is: a solid, free Flash upgrade — worth a measured note, not a fanfare.

---

## 1. Landing-page section (2ndbrainware.com)

> **Now running on Google's latest Gemini.**
>
> Google's newest fast model — Gemini 3.5 Flash — went generally available at I/O 2026, and SecondBrainWare picked it up the same day.
>
> What that means for your second brain:
>
> - **A 1M-token context window** — large outlines can be reasoned over in a single pass, fewer retrieval seams.
> - **Better quality at the same speed** — Flash stays fast and free; the answers are sharper.
> - **Still free to use** — bring your own Google API key and there's no extra cost from us. Google's free tier applies.
>
> No upgrade, no migration, no price change. If you already have a Gemini key saved in Settings, you're already on it.
>
> [Set up your Gemini key →](/#settings-ai-keys)

---

## 2. Product Hunt — pinned update comment

> 📢 **Update — now on Gemini 3.5 Flash**
>
> Google released Gemini 3.5 Flash at I/O this week. SecondBrainWare moved its default to it the same day.
>
> It's a measured upgrade rather than a headline one — same speed, same free tier, better answers, and a 1M-token context window that makes large-outline work more coherent. Bring-your-own-key users are already on it; nothing to do.
>
> — Howard

---

## 3. Hacker News — Show HN follow-up (optional — low-key, post only if it fits)

**Title (under 80 chars):**
> Switching an AI app's default model the day a new one ships

**Body:**
> Quick follow-up to my earlier Show HN about SecondBrainWare (an AI-native outliner). Google shipped Gemini 3.5 Flash at I/O this week; I moved the app's default to it the same day.
>
> The point worth sharing isn't the model — it's a modest Flash bump — it's the architecture. Our Gemini model id is a single registry entry; every AI call site reads from it. The switch was: add the new model, flip one default constant, deploy. The previous model stays registered as a one-line rollback.
>
> Vendor model churn is only going to speed up. If you're shipping an AI product, make your model picker a config table now, not later. It turns each new release from a scramble into a one-line change.
>
> BYOK users get the new model automatically — their Google key already works for it. Happy to discuss the registry pattern. — Howard

---

## 4. Twitter / X — single tweet (under 280 chars)

**Variant — measured (236 chars):**
> Google shipped Gemini 3.5 Flash at I/O this week. SecondBrainWare moved its default to it the same day.
>
> Same speed, same free tier, sharper answers, 1M-token context. If you've got a Gemini key saved, you're already on it. No upgrade needed.

---

## 5. LinkedIn — short post (180–220 words)

> Google released Gemini 3.5 Flash at I/O this week. SecondBrainWare moved its default to it the same day — and the "same day" part is the only interesting engineering story here.
>
> When I built SecondBrainWare, I made the Gemini model identifier a single registry entry; every AI call site reads from it. Switching to 3.5 Flash was adding one entry, flipping one constant, and deploying. The previous model stays registered as a one-line rollback if anything regresses.
>
> The model itself is a measured upgrade — Flash stays fast and free, the answers are a bit sharper, and the 1M-token context window helps when reasoning over large outlines. I'm not going to oversell it. It's a good, free bump.
>
> The meta-lesson is the one worth keeping: AI vendors will keep releasing models every few weeks. The apps that absorb each one in an afternoon — instead of a sprint — compound a quiet advantage. Build your model picker as a config table before you need it.
>
> Bring-your-own-key users on SecondBrainWare are already on Gemini 3.5 Flash. No price change — Google's pricing flows through directly.
>
> — Howard Jachter, founder

---

## 6. BYOK docs update (in-app help + settings setup guide)

> **Gemini 3.5 Flash (default since 2026-05-21)**
>
> Your existing Gemini API key from `aistudio.google.com/apikey` works for Gemini 3.5 Flash — no new key needed.
>
> To use it for AI features in SecondBrainWare:
>
> 1. Settings → AI Service Keys → confirm your Gemini key is saved.
> 2. Settings → AI Mode → set to "Cloud AI (Gemini)".
> 3. The default model is already Gemini 3.5 Flash — nothing else to pick.
>
> **Cost:** Gemini 3.5 Flash has a free tier (60 requests/min, no credit card). Paid usage is $1.50 per million input tokens / $9.00 per million output tokens. SecondBrainWare never marks up your API costs — what Google charges is what you pay.
>
> **Privacy note:** On Google's *free* API tier, prompts may be retained by Google for about 55 days and can be used to improve their models unless you opt out in Google AI Studio. Paid-tier keys are not used for training. If this matters to you, use a paid-tier key or the local AI option (Gemma, on-device).
>
> Prefer to stay on Gemini 2.5 Flash? It's still registered and selectable — we didn't deprecate it.

---

## 7. Press / outreach one-liner

For replying to anyone discussing Gemini 3.5 Flash:

> SecondBrainWare moved to Gemini 3.5 Flash the day it shipped. Bring your own Google key and you're already on it. https://2ndbrainware.com

---

## Distribution checklist

In execution order:

- [x] Web-search Google's official Gemini 3.5 Flash announcement
- [x] Add the new Gemini model to the registry, flip the default
- [x] Add the free-tier 55-day retention note to the BYOK setup guide
- [ ] Deploy to web (Vercel auto-deploys on git push)
- [ ] Restart Electron, smoke-test one AI feature end to end
- [ ] Publish: landing-page update, Twitter post, LinkedIn post
- [ ] Pin Product Hunt maker-update comment
- [ ] (Optional) Hacker News follow-up — only if it reads naturally
- [ ] Update IdiamPro - Launch Progress outline — mark task #49 complete
