# IdiamPro - Pricing & Cost Analysis

**Status:** ✅ CONFIRMED by Howard (2026-07-16) — prices approved and going live in the
marketing site's membership cards. Real vendor dollars still get reconciled once the funded
company account is live and true usage is measured; where exact figures aren't known yet, this
uses **industry-standard costs and best practices** (per Howard's direction). The tier prices
below are the approved launch numbers; the underlying cost estimates remain to be trued-up.

## Method (from the official Pricing & Margin Policy)

- Margin is measured as a **share of the sale price** (true margin), target **20%** — a FLOOR,
  not a ceiling.
- Taken over **fully-loaded cost**: AI/vendor fee + payment processing + an allocated share of
  infrastructure/overhead.
- Solve backwards for price:  **price = base cost ÷ (1 − margin − payment-fee rate)**.
- Never below cost. Usage is **metered** (the price buys a bounded allowance), so cost can never
  run away and every sale is cash-positive from day one.

## Fully-loaded cost of a Professional member (per month, industry-standard estimates)

| Line item | Est. / mo | Basis (industry standard) |
|---|---|---|
| Premium AI outputs (metered allowance): premium podcast/video voices, image generation, cloud LLM for smart features, transcription | ~$12 | Vendors' published pay-as-you-go prices (OpenAI TTS/LLM, image gen, AssemblyAI) × a reasonable monthly allowance |
| Infrastructure + overhead share (hosting, auth, database, rate-limiting, monitoring, domain) | ~$3 | Typical lean-SaaS per-user cost at modest scale, amortized |
| **Base fully-loaded cost** | **≈ $15/user/mo** | |
| Payment fee — web/Mac | ~2.9% + $0.30 | Stripe standard card processing |
| Payment fee — iPhone/iPad | 15–30% | Apple In-App Purchase (30% standard; **15% Small-Business** rate under $1M/yr) |

## Backward calculation → price (20% margin)

- **Web / Mac** (fee ~3%):  $15 ÷ (1 − 0.20 − 0.03) = $15 ÷ 0.77 ≈ **$19.99/mo**
- **iPhone** (Apple 30%):  $15 ÷ (1 − 0.20 − 0.30) = $15 ÷ 0.50 ≈ **$29.99/mo**
  - iPhone at Apple's **15% Small-Business** rate: $15 ÷ 0.65 ≈ **$22.99/mo**

## Proposed tiers

| Tier | Web / Mac | iPhone | Includes |
|---|---|---|---|
| **Free** | $0 | $0 | Core app forever — outlines, Second Brain, on-device/Gemma AI. Cost to us ≈ $0. |
| **Professional** | **~$19.99/mo** | ~$29.99/mo | Full premium allowance: cloud AI, video + podcast, all export formats. 20% real margin. |
| **Student** | **~$9.99/mo** | ~$14.99/mo | Same tool, a **lighter premium allowance** so the discount stays cash-positive (students use less). Verified with a .edu email. |

**Student guardrail:** a true half-price student discount only stays profitable if it comes with
a **smaller premium quota** — otherwise the discounted price would dip below cost and we'd be
fronting money (violates "never front money"). So students get the same *tool*, a smaller monthly
*quota* of the expensive outputs.

## The value anchor (Howard, 2026-07-16) — this is a headline, not a footnote

Paid access to **any** serious LLM is a **$20/month floor** — ChatGPT Plus, Claude Pro, and
Gemini Advanced are all exactly $20/mo. So IdiamPro Professional at ~$19.99 means the customer
pays the price of **one bare chatbot** and gets the **entire thinking system** on top of it
(outlining, consolidation, Second Brain, and every finished output — video, podcast, docs, sites,
21 languages). Great deal for them; cash-positive for us. Use this comparison prominently in the
pricing copy.

## Assumptions to confirm (the levers that move the numbers)

1. **The premium allowance per tier** — the single biggest cost driver, and really a product call.
2. The **~$3/user overhead** estimate.
3. **Per-platform pricing** (web cheaper, iPhone higher for Apple's cut) vs. **one blended price**.

## Optional enhancements / add-on revenue lines (to fold into the model)

Each stays priced at the same 20%-margin-over-cost discipline, so every one is cash-positive:

1. **Overage top-up packs** — when a member exhausts their monthly premium allowance, they buy a
   pack (e.g. +5 videos, +10 podcasts) at the same per-unit margin rather than being cut off.
   Keeps heavy users cash-positive instead of either losing them or eating a loss.
2. **Premium-voice upgrade** — studio-grade voices (e.g. ElevenLabs-tier) as a paid step up from
   the standard cloud voices; higher cost → higher price, same margin.
3. **BYOK discount path** — a member who brings their own API key covers their own AI cost, so
   they pay a lower base price (near just the overhead + margin). Already in the monetization model.
4. **Annual billing** — offer annual at ~2 months free vs monthly; standard SaaS lever that
   improves cash flow and retention without touching the per-unit margin.
5. **(Future) Team / seat licensing** — belongs to IdiamTeam, out of scope for this launch model.

## Guardrails carried from policy / monetization model

- Core app (outlines + everyday text AI on free/on-device Gemma) is **free forever** — only the
  premium OUTPUTS are paywalled (free-tier-never-useless honored).
- **First-month free trial** of premium features on the free on-device voice (zero cost to us).
- iOS routes through **Apple IAP** (compliance-first) via RevenueCat; web/Mac may use own processor.
- Phone-verify anti-farming; server-side metered lock enforces the allowance.

---
*This is a working analysis for planning, not a final price sheet or financial advice. Lock the
real numbers once the funded company account exists and true vendor costs + Apple's exact cut are
known. See memory: project-pricing-margin-policy, project-monetization-model.*
