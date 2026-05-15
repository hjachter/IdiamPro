# May 19, 2026 — Google I/O / Gemini Launch Day

**Keynote:** May 19, 10am PT / 1pm ET (Shoreline Amphitheatre).
**Your job:** Watch the keynote, decide which copy variant to use, run one command.

---

## Pre-keynote (morning of May 19)

- [ ] Coffee.
- [ ] Pull latest main: `git pull origin main`
- [ ] Confirm `.env.local` still has a working `GEMINI_API_KEY`
- [ ] Open the staged copy at `docs/launch/gemini-4.md` in a second window so you can edit placeholders as you watch.

## During the keynote (10am–11:30am PT)

Watch for these specific signals — they determine which copy variant to ship:

| Signal | If you hear this | Use variant |
|---|---|---|
| "We're announcing **Gemini 4**, available today on the API" | confident | `--variant confident` |
| "Today we're previewing the next generation of Gemini, **shipping later this year**" | preview-only | `--variant cautious` |
| "Gemini 3.5 with **Agent Mode**" / no major version bump | soft | `--variant soft` |

Also note:
- The exact name(s) used (e.g., "Gemini 4 Ultra," "Gemini 4 Flash," "Gemini Agent")
- The headline context-window number ("now with 2 million tokens")
- Any specific benchmark Google emphasizes (MMLU, HumanEval, etc.)
- Pricing announcement (per-million-token rates)

## Right after the keynote (11:30am–12pm PT)

Run the launch script in dry-run first to inspect:

```bash
scripts/launch-gemini.sh --dry-run --variant <variant>
```

It will:
1. Query Google's API to find any new `gemini-4-*` identifiers
2. Show you the proposed registry diff
3. Show you the marketing-copy diff

If the diff looks right, run for real:

```bash
scripts/launch-gemini.sh --variant <variant>
```

Or to commit + push automatically:

```bash
scripts/launch-gemini.sh --variant <variant> --auto-commit
```

## Manual edits you still need to do

The script handles the registry and triggers your commit, but **these are on you**:

- [ ] Open `docs/launch/gemini-4.md` and fill in the remaining `{{...}}` placeholders with values from Google's official blog post. Particularly:
  - `{{GEMINI4_CONTEXT}}` — the headline context window number
  - `{{GEMINI4_PRICING_FREE}}` / `{{GEMINI4_PRICING_PRO}}` — per-million-token costs
  - `{{GOOGLE_BLOG_URL}}` — direct link to Google's announcement post
  - `{{GEMINI4_BENCH_HEADLINE}}` — the one benchmark Google highlights
- [ ] Post the Product Hunt maker-update comment (use copy from `gemini-4.md` section 2)
- [ ] Schedule the LinkedIn post (use copy from section 5)
- [ ] Send the Twitter/X tweet (use copy from section 4)
- [ ] (Optional) Submit Hacker News follow-up post (section 3)
- [ ] Update `IdiamPro - Launch Progress.idm` — mark task #49 complete

## If something goes wrong

- **Script errors out querying Google API:** Check your `GEMINI_API_KEY` is valid. The script needs to list models.
- **No `gemini-4-*` models found:** The announcement may have used a different naming convention (e.g., "Gemini 3.5"). Run `scripts/launch-gemini.sh --dry-run` first; it prints every discovered model so you can spot the actual identifier.
- **Typecheck fails after registry update:** Roll back with `git checkout src/config/gemini-models.ts`. The legacy entry (`gemini-2.0-flash`) is still in the registry as a manual fallback.
- **Rate limit on Google API:** BYOK users hit Google's quota, not ours — they're fine. If our default model rate-limits, the existing Ollama fallback kicks in (`aiProvider = 'auto'`).

## After it's all live (afternoon of May 19)

- [ ] Run the full Playwright suite ("TEST EVERYTHING" in chat)
- [ ] Monitor Sentry for any new errors in the first hour
- [ ] Reply to anyone who tweets/posts about Gemini 4 — use the one-liner from `gemini-4.md` section 7
- [ ] Add a note to the BYOK setup guide that Gemini 4 is now supported

## What I'll do on my end (Claude, when you start the session that morning)

If you open a Claude Code session in this repo on May 19, I'll fire a scheduled prompt that reminds you of this checklist. I can also offer to run the launch script for you and walk you through each step. Just say "let's do the launch" and I'll take it from there.
