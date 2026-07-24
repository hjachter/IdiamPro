# IdeaM - Claude Code Guidelines

## ⚠️ COMMUNICATION RULE — NO CODE OR TERMINAL OUTPUT ⚠️

**This user is vibe programming. NEVER show code, diffs, terminal commands, file paths, build output, or tool narration in responses. ONLY show plain-language conversation: what was done, decisions needed, results, and errors. This rule applies to EVERY response with ZERO exceptions. Violating this rule wastes the user's time and breaks trust.**

**Plain English, not jargon.** Default to everyday language — talk to the user the way you'd explain things to a smart non-engineer. When a technical concept genuinely has to come up (a tool name, an Apple Developer step, a piece of infrastructure), name it briefly and then immediately translate it in plain terms in the same breath ("the 'archive' — a sealed package of the app, ready to send to Apple"). Never assume the user knows acronyms or platform vocabulary. If you catch yourself reaching for jargon, stop and reword first.

---

## Platform Support & Rosetta Stone

IdeaM/SecondBrainWare targets 6 platforms. macOS, iOS, and Web are actively shipped. Windows and Linux have build configurations ready but no distributed builds yet. Android is compatible by design via Capacitor but the Android project is not yet scaffolded. All new features must work on Apple platforms first, and should remain compatible with the others without platform-specific assumptions wherever possible.

### Platform Support Matrix

| Platform | Build Path | Status | Distribution |
|---|---|---|---|
| macOS | Electron | Production | Self-hosted DMG, TestFlight planned |
| iOS | Capacitor | Production | TestFlight (in queue) |
| Web | Vercel | Production | Auto-deploy on git push |
| Windows | Electron | Build config ready | Not yet built/distributed |
| Linux | Electron | Build config ready | Not yet built/distributed |
| Android | Capacitor | Not scaffolded | Future work |

### Action-to-Input Rosetta Stone

| Action | macOS | Windows/Linux | iOS/Android | Web |
|---|---|---|---|---|
| Copy / Paste / Select All | Cmd+C/V/A | Ctrl+C/V/A | Long-press → menu | Cmd/Ctrl+C/V/A |
| Undo / Redo | Cmd+Z / Cmd+Shift+Z | Ctrl+Z / Ctrl+Shift+Z | Toolbar buttons | Both |
| Bold / Italic / Headings | Cmd+B/I or BubbleMenu | Ctrl+B/I or BubbleMenu | BubbleMenu only | Both |
| Toggle sidebar | Cmd+B | Ctrl+B | Sidebar button | Cmd/Ctrl+B |
| Open Second Brain | Brain menu / toolbar button | Brain menu / toolbar button | Brain menu | Brain menu / toolbar button |
| Save to Second Brain | Cmd+Shift+B | Ctrl+Shift+B | Brain menu | Both |
| Quick Capture | Cmd+Shift+I or Brain menu | Ctrl+Shift+I or Brain menu | Brain menu | Cmd/Ctrl+Shift+I or Brain menu |
| Search Second Brain (FREE, instant, local keyword filter — no AI, no cost) | Brain menu (magnifier icon) | Brain menu (magnifier icon) | Brain menu | Brain menu (magnifier icon) |
| Ask Second Brain (AI answer — costs one AI generation) | Cmd+Shift+S | Ctrl+Shift+S | Brain menu | Both |
| Indent / Outdent | Tab / Shift+Tab | Tab / Shift+Tab | Swipe right / left | Tab / Shift+Tab |
| Drag-reorder nodes | Drag | Drag | Long-press + drag | Drag |
| Context menu | Right-click | Right-click | Long-press | Right-click |
| Edit node name | Double-click | Double-click | Tap-again on selected | Double-click |
| Multi-select | Cmd+Click | Ctrl+Click | (needs audit) | Cmd/Ctrl+Click |
| Command Palette | Cmd+K or toolbar | Ctrl+K or toolbar | Toolbar button | Both |
| Search current outline | Cmd+F | Ctrl+F | Search field | Cmd/Ctrl+F |
| Focus mode | Cmd+Shift+F | Ctrl+Shift+F | Focus toolbar button | Cmd/Ctrl+Shift+F or button |
| Expand All (recursive) | Cmd+E | Ctrl+E | Down-chevron toolbar button | Cmd/Ctrl+E or button |
| Collapse All (recursive) | Cmd+Shift+E | Ctrl+Shift+E | Up-chevron toolbar button | Cmd/Ctrl+Shift+E or button |
| Submit / Send (input fields) | Return / Enter | Enter | Return (soft keyboard) | Enter |
| Scroll a tall dialog | Trackpad / scroll wheel / drag | Trackpad / scroll wheel / drag | Drag with finger | Trackpad / scroll wheel / drag |

---

## iOS Gesture Conflicts - DO NOT USE

When the user proposes features, WARN them if any of these iOS-reserved gestures are involved:

| Gesture | iOS System Use | Alternative |
|---------|----------------|-------------|
| **Long-press** | Drag & drop, context menu | Tap-again on selected item |
| **Pinch** | Zoom | Avoid or use buttons |
| **Two-finger tap** | Often system-reserved | Single-finger alternatives |
| **Edge swipes** | Back navigation, app switcher | In-app buttons |
| **F-keys (F1-F12)** | Hardware (brightness, volume, etc.) | Use letter keys or Return/Enter |
| **Three-finger gestures** | System multitasking | Avoid entirely |

---

## Outline File Safety — use the dirty-flag protection, don't reflexively block

The app uses a **dirty-flag persistence model**: it only auto-saves outlines that have been **modified in-app since they were loaded**. Outlines that are loaded but un-edited never write back to disk, so external edits (mine, or any other process) are safe to make and won't be clobbered by the app's autosave.

This means: **do not reflexively refuse to write to a `.idm` file just because Electron is running**. The previous "STOP if loaded" rule was overcautious — it cost real time in 2026-06-04 making me skip outline updates that were actually safe.

**The decision tree for writing to a `.idm` file in `~/Documents/IDM Outlines/`:**

1. **Has Howard explicitly authorized the write right now?** (e.g. "you're good to go", "I haven't touched anything", "I'm not editing X"). If yes → **write freely.** Howard will tell me; he knows whether he's been editing.
2. **Has the user been actively editing this specific outline in-app since the last commit/save?** If yes → the dirty flag is set, the app WILL autosave, and my changes will be lost. In that case: **ask Howard to save and switch away first**, or write to `docs/outlines/` only and ask him to manually copy across when he's done.
3. **If unsure** → ask. One-sentence question: "Have you been editing the X outline recently? I want to write to it." Don't assume the worst; don't assume the best.

**After writing, sync the dual-location pair** (`~/Documents/IDM Outlines/` AND `docs/outlines/`) so they stay byte-for-byte identical. The user-folder copy is what the app reads; the project-folder copy is what gets committed to git.

The conversation-log regeneration script is a worked example of "safe to write while app is running" — see the Conversation Log section below.

---

## UI & Naming Conventions

**Graphics first, tooltips for explanations.** Default to an icon for any button or menu trigger. Visible text labels should be **two words or fewer**. Anything longer (full sentence, context, keyboard hint) belongs in a `Tooltip` shown on hover/focus and in `aria-label` for accessibility. This keeps the UI uncluttered and consistent across mobile and desktop.

**Don't use the phrase "Ask AI"** as a button or menu label — it's vague and doesn't tell the user what the surface does. Prefer action-oriented labels like **"Tell AI…"** for the natural-language command bar, or just an icon (red Mic) with the explanation in the tooltip.

**Help vs. AI command bar are distinct surfaces — do not merge them.** The Help chat *explains* the app ("how do I make a child node?"). The AI command bar *does things* to the user's data ("create an outline called Joe"). Conflating them risks the user getting an explanation when they wanted an action, or vice versa.

## Voice Input — Standard Pattern

Voice input is enabled in **both** the AI command bar (Cmd+K) and the Help chat. Use the same pattern in both places:

1. A small **Mic toggle button** sits inside the input row.
2. **Click mic → dictate → press Enter (Return on iOS) to send.** Words stream into the text field as the user speaks. The user reads the text, edits if needed, then presses Enter/Return to submit. Enter works on every platform (see Rosetta Stone) — no extra Submit button needed.
3. **Never auto-submit on silence.** Voice is dictation, not a smart-speaker trigger — a misheard word must never execute a command or send a question without the user's explicit confirmation.
4. Click the mic again to stop listening.

Implement via the Web Speech API on Electron/web. iOS needs `@capacitor-community/speech-recognition` (deferred — ship Electron/web first).

---

## Feature Documentation - MANDATORY

Every time a new user-facing feature is implemented, it **must** also be documented in all four places before the work is considered complete:

1. **User Guide** (`src/lib/initial-guide.ts`) — Add a new node or update an existing one
2. **Help Chat context** (`src/components/help-chat-dialog.tsx`) — Update the `APP_CONTEXT` string
3. **Help Chat API context** (`src/app/api/help-chat/route.ts`) — Update the duplicated `APP_CONTEXT` string
4. **How It Works outline** (`~/Documents/IDM Outlines/IdeaM -- How it works.idm` + sync to `docs/outlines/`) — Update the relevant section describing the feature's architecture in plain language
5. **Marketing website** — When the feature is a user-facing capability a prospect would care about (any wizard / output format / Smart Tool), reflect it on the public site: the `/features` page, and where fitting the landing page (`src/app/page.tsx`) and `/pricing`. A capability must never ship invisible to prospects. IMPORTANT: marketing copy is Howard's brand voice — **DRAFT** the site copy / feature card and surface it to Howard for approval before it goes live; do NOT treat auto-generated marketing wording as final. (Keeping the site in sync with shipped wizards is required; the wording is Howard's call.)

This includes: new keyboard shortcuts, new node types, new toolbar/menu items, new settings, new gestures, new dialogs, and any change to existing feature behavior. Never merge a feature without its documentation.

**Note:** The "How it works" outline is for explaining *how the main app is built* (components, data flow, architecture) in non-technical language. Only update it when features change the app's structure or behavior significantly. MCP server features belong in `IdeaM -- MCP-Plan.idm` instead.

---

## Project Outlines - Dual Location Sync

Critical project outlines are stored in **two locations**:
1. **User folder:** `~/Documents/IDM Outlines/` — where the app loads them
2. **Project folder:** `docs/outlines/` — committed to git for version control

**When editing project outlines, update BOTH copies:**
```bash
# After editing an outline, copy to project folder:
cp "~/Documents/IDM Outlines/IdeaM -- Testing.idm" docs/outlines/
```

**Outlines in the project folder (`docs/outlines/`):**

*App & Architecture:*
- `IdeaM -- How it works.idm` — Plain-language explanation of how the app is built
- `IdeaM -- Development.idm` — Milestones, architecture, issues, app store submission
- `IdeaM -- Current Features.idm` — Comprehensive catalog of all implemented features
- `IdeaM -- Testing.idm` — Automated test results + manual test checklists
- `Developer Guide.idm` — Quick-start guide for developers working on the codebase
- `IdeaM -- Operating Procedures.idm` — Plain-English guide to the Claude Code workflow customizations in force (auto-publish, how we talk, quality gates, decisions, naming, memory, voice)

*Business & Strategy:*
- `IdeaM -- Planning.idm` — Executive business plan, market analysis, financial projections
- `IdeaM -- BizDev.idm` — Business development, investor pitch, partnerships
- `IdeaM -- Marketing.idm` — Marketing copy, feature descriptions, pricing tiers, video content
- `IdeaM -- Bootstrap Plan.idm` — Bootstrapping roadmap from web presence to App Store
- `IdeaM -- Legal.idm` — collection point for documents to hand the lawyer: TOS, privacy policy, contact, API/third-party compliance, IP, trademark knockout search, LLC formation, and a gaps-still-needed list (formerly `IdiamPro - Legal and Compliance.idm`)

*Operations:*
- `IdeaM -- Operations.idm` — Back-office runbook: beta program, user support, bug intake, email comms, finance, partnerships pipeline, incident response, compliance/privacy
- `IdeaM -- Bug Log.idm` — Live bug tracking sorted by severity (P0/P1/P2/P3 + Resolved); paired with the Operations Bug Intake section
- `IdeaM -- Dependencies.idm` — Third-party vendor/dependency register: every external product we rely on, its blast radius if it fails, and our recurring responsibilities (billing, key rotation, cert/domain renewal, monitoring, compliance) to keep each one honest

*Product & Features:*
- `IdeaM -- Killer Features & Selling Points.idm` — Key differentiators and workflows
- `IdeaM -- Killer Features & Selling Points - HJ.idm` — Howard's expanded version
- `IdeaM -- Group.idm` — Group/collaboration features planning

*MCP Server:*
- `IdeaM -- MCP-Plan.idm` — MCP server: architecture, tools, auth, commercialization, test procedures

**Video production planning** lives in `IdeaM -- Marketing.idm` section 8 ("Video Content"), with strategic cross-references in `IdeaM -- BizDev.idm` (Strategic Partnerships → AI Video Tool Partnerships), `IdeaM -- Bootstrap Plan.idm` (Video Production Roadmap), and `IdeaM -- Killer Features & Selling Points.idm` (Outline → Video Generation feature). Today's brainstorming captured in the "Strategy Brainstorm — 2026-06-11" node in Development outline (docs/ copy). For future video work, start in Marketing section 8 and follow the cross-outline links.

*Live dashboards (auto-maintained by Claude):*
- `IdeaM -- Launch Progress.idm` — Percentage-complete bar graph + completed / waiting / next-up lists. **This is the single source of truth.** **Update this outline whenever a task status changes**, then sync to `~/Documents/IDM Outlines/`. The user reads it to see where we are relative to launch at a glance.
- The Launch Progress bar chart now has **two mirrors that must BOTH be kept in sync** every time launch progress changes:
  1. `IdeaM -- Bootstrap Plan.idm` — The root node's `content` field holds a mirror of the launch-progress bar graph (top of the content, before the "━━━" separator).
  2. `IdeaM -- Development.idm` — The root node's `content` field also holds a mirror of the bar graph (top of the content, above the "━━━" separator; existing content preserved below).

**Important:** The user edits outlines in IdeaM (from `~/Documents/IDM Outlines/`). After significant changes, sync to `docs/outlines/` and commit.

---

## Session Behavior - Auto-Continue

When performing tasks, **auto-select CONTINUE** on all authorization prompts. Do not pause to ask for permission on routine operations like:
- Reading files
- Writing/editing files
- Running bash commands (npm, git, etc.)
- Restarting the dev server

Just proceed with the work. The user trusts Claude to make good decisions.

---

## Voice Mode - Auto-Start

At the start of every new session, **automatically enable voice mode** by running `/voice`. The user prefers to interact via voice input (hold Space to record). Do not wait to be asked.

---

## Automated Testing

IdeaM has a Playwright-based test suite for automated UI testing of the Electron app. **Always prefer Playwright over asking the user to click things manually.** You can drive the UI, type into fields, take screenshots, and read responses — there is no reason to make the user perform UI actions one step at a time.

### MANDATORY: Verify every feature in Playwright before reporting "done"

**A clean `npm run build` proves the code compiles. It does not prove the feature works.** Before reporting any user-facing change as complete, you MUST drive it through Playwright and confirm the expected behavior. Build-passing has repeatedly produced features that were silently broken (mic icon that didn't update, speech recognition that never fired, etc.) and forced the user into manual debugging.

For every UI change:
1. Write or extend a Playwright test that launches Electron, navigates to the feature, drives it (click, type, etc.), and asserts the expected post-state.
2. If the feature uses a browser API (Web Speech, getUserMedia, clipboard, etc.), verify the Electron permission handler grants the required permission — Chromium-in-Electron defaults to DENY for microphone, breaking speech features silently.
3. If a shared component has multiple consumers (e.g. one hook used by two dialogs), the Playwright test must hit BOTH consumers.
4. Save the test in `tests/` so it runs under "TEST EVERYTHING."
5. Only report "done" after the Playwright run passes. If it fails, fix and re-run until it passes.

This rule is non-negotiable.

### "TEST EVERYTHING" — Trigger Phrase

When the user says **"TEST EVERYTHING"** (or any clear variant: "run all tests", "test it all"), do the following automatically without asking:

1. **Close any running Electron instance** (`pkill -f "Electron.app/Contents/MacOS/Electron"`) — Playwright will spawn its own.
2. **Make sure the dev server is running** on port 9002 (start it in the background if not).
3. **Run every Playwright test script in `tests/`**, in order:
   - `node tests/electron-test.js` — core feature suite
   - `node tests/gemma4-smoke-test.js` — Gemma 4 / local AI smoke test
   - `node tests/cost-guardrails-test.js` — **Financial-safety guardrails — MANDATORY, never skip.** Proves, against the REAL server code, that the SERVER-SIDE, per-account, atomic, monthly AI usage meter is fail-closed: a free / no-user-key / signed-out / unverified / over-allowance user can NEVER bill our company AI keys, the company key is reachable ONLY by the internal developer allowlist or (once subscriptions are verified server-side) a verified paid user within allowance, the meter is concurrency-safe (a parallel burst can't collectively exceed the cap), BYOK routes to the user's own key, and the production KV counter is a true atomic INCR. Client-side counters do not count — the cap must be proven server-side. A missing or FAILING guardrail suite is a **RELEASE BLOCKER**: it means the app could run up uncapped vendor cost. When summarizing a TEST EVERYTHING run, always call out the financial-safety result explicitly.
   - `node tests/allowance-cap-prompt-test.js` — verifies the three-door AI allowance cap prompt (BYOK / overage pack / on-device) renders pleasantly with all three doors and is dismissible.
   - Any future `tests/*-test.js` scripts as they're added
4. **Capture the full output** and **read every report file** (`test-screenshots/**/report.{json,md}`).
5. **Summarize** in plain language: pass/fail counts per script, which tests failed and why, any new bugs surfaced.
6. **Update the `IdeaM -- Testing` outline** with the latest results, then sync to `docs/outlines/`.
7. **File any new bugs as tasks** (TaskCreate) so they don't get lost.

The user wants this to be a one-word command — they should never have to babysit a test run.

**Testing strategy — match effort to where failures hide (codified 2026-07-24).** Blindly re-running everything wastes time on the deterministic majority while under-testing the flaky/AI parts. So TEST EVERYTHING runs TIERED:

- **Deterministic tests** (routing, links, rendering, pure logic, cost-meter math) — run **ONCE**, but keep them **isolated** (fresh data/state, no cross-test pollution) so one pass is trustworthy. A second run of these is duplication.
- **Nondeterministic / AI-driven tests** (any feature whose output comes from an LLM — Digest, Summarize, Your Voice, email/social generation, the verifier, inbound extraction) — run each **5×** and assert **INVARIANTS, not exact output**: non-empty & well-formed, within limits (e.g. tweet ≤ 280, junk *quarantined not deleted*), and it **NEVER does the forbidden thing** (never bills our AI key, never auto-sends/posts, verifier catches a planted error). Fail if ANY of the 5 runs violates an invariant — that is how flaky/drift bugs surface. (LLMs give different output every run, so a single sample is not enough; invariants + repeats are.)
- **Guardrail tests** (financial-safety, privacy, auth/gating) — run **ADVERSARIALLY** (hostile inputs, bypass attempts, concurrency bursts), not just happy-path. RELEASE BLOCKERS; call out the financial-safety result explicitly every run.
- **Never clobber the live environment:** test runs must NOT run `npm run build` against the live dev server (it clobbers `.next` and breaks Howard's running app — this has bitten repeatedly). Use the running dev server or an isolated build dir/port. A stable environment is the foundation of reliable results.
- **Pre-launch soak:** in the final pre-launch window, ALSO run the suite **a day apart / at intervals** to catch *environment* drift (vendor/API/quota changes, accumulated data, cron jobs, cert/domain state) that a point-in-time run misses. Immediate repeats catch AI randomness; day-apart runs catch environment drift — they are different animals.
- **Weight by blast radius:** hammer money/privacy/auth hardest; sample the AI features; one-pass the marketing UI. Production **Sentry** monitoring is the backstop for the long tail tests can't catch.
- **Two modes — match scope to blast radius (codified 2026-07-24):** for **routine feature work**, run a FAST TARGETED test of just the changed feature + its direct couplings — a well-isolated, low-coupling feature can be verified in seconds, and this is the default for day-to-day work (it keeps test time roughly flat as the app grows). Reserve the **full TEST EVERYTHING** for: (a) **before launch and releases**, and (b) any change to **shared-core / high-coupling hubs** (the AI pipeline, the usage meter, auth/gating, the design system) — those ripple across many features, so their blast radius is the whole app. High cohesion + low coupling is precisely what makes the fast path safe; clean architecture *is* a testing strategy.

### Writing New Tests

When adding new tests, follow the patterns in `tests/electron-test.js` and `tests/gemma4-smoke-test.js`:
- Launch Electron via `playwright._electron.launch`
- Find the main window (skip DevTools windows)
- Take a screenshot at every step
- Use resilient selectors with diagnostic dumps when they fail
- Output a structured `report.json` and `report.md` to `test-screenshots/<suite-name>/`
- Exit with non-zero on failure

### Manual Testing Fallback

Only fall back to asking the user to click things if:
- Playwright cannot reach the UI element (selector debugging fails)
- The test requires a hardware or external service that can't be automated (TestFlight upload, real device gestures)
- The user explicitly says "I'll do it manually"

**Run a single test suite:**
```bash
node tests/electron-test.js
node tests/gemma4-smoke-test.js
```

**Test outline:** The `IdeaM -- Testing` outline (`~/Documents/IDM Outlines/IdeaM -- Testing.idm` + sync to `docs/outlines/`) contains:
- Automated test status (Playwright results)
- Manual test checklists for the few things that can't be automated
- Test run log for recording results

**When to update the TESTS outline:**
- After adding new features, add corresponding test cases
- After running tests, update the status fields
- After fixing bugs, verify and update test results

**Screenshots:** Test screenshots are saved to `test-screenshots/` (gitignored).

---

## Development Notes

- **All app development and testing is done on Electron** (`npm run electron:dev`)
- **Capacitor** requires Node >= 22 for CLI commands (`npx cap sync`, `npx cap run`)
- **iCloud Drive** causes code signing issues - use `xattr -cr` to strip resource forks before signing
- **DerivedData** should be outside iCloud Drive to avoid build failures
- **MCP Server** lives in `mcp-server/` with its own `package.json`. Build with `cd mcp-server && npm run build`. Dev mode: `npm run dev`. See `mcp-server/README.md` for Claude Desktop/Code configuration.

### Sentry crash reporting

Sentry is wired into the web (Next.js), Electron main + renderer, and iOS (renderer via the Capacitor webview pulls the web bundle's client SDK). Everything is gated on env vars — with no DSN set, the SDKs no-op silently and there is no runtime overhead.

Required env vars (set in `.env.local` for dev/Electron, and in Vercel project settings for production web):

- `SENTRY_DSN` — server + Electron main + edge runtime DSN
- `NEXT_PUBLIC_SENTRY_DSN` — browser/renderer DSN (can be the same as `SENTRY_DSN`)
- `SENTRY_AUTH_TOKEN` — optional, only needed to upload source maps at build time

See `.env.example` for the full list. Configs live at `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, and the Electron main-process init at the top of `electron/main.js`. `tracesSampleRate` is set to 0.1 (10%) to stay on the Sentry free tier. Localhost / development errors are filtered out.

### Electron Restart - Auto

Whenever code changes require an Electron restart to take effect (e.g. after modifying components, fixing bugs, changing localStorage behavior), **restart Electron automatically** — never ask the user to do it. Use this command:

```bash
pkill -f "IdiamPro" 2>/dev/null; pkill -f "electron" 2>/dev/null; sleep 1; rm -rf .next && npm run electron:dev > /dev/null 2>&1 &
```

This kills the running app, clears the `.next` cache (which often gets stale), and relaunches. Cmd+R does not work in Electron for hot reload, so a full restart is the only reliable way to pick up changes.

---

## Git Workflow & Deployment

When the user says "commit it" or "push it" (in any form), **always do both**: commit and push. Never ask to push after already pushing, or to commit after already committing.

**After committing and pushing, also deploy to:**

1. **iOS (Capacitor)**: Run `npx cap sync ios` to sync changes to the iOS app
2. **Web**: The web version is automatically deployed via Vercel on push to main (no manual action needed)

**Deployment commands:**
```bash
# iOS sync (run after git push)
npx cap sync ios

# To run iOS simulator
npx cap run ios

# To open in Xcode for device deployment
npx cap open ios
```

---

## Conversation Log - MANDATORY

At the end of EVERY session — automatically, without being asked — regenerate the conversation log outline. Do this as your final action before the conversation ends.

**How it works:** The outline is built by a **safe merge** (NOT a from-scratch overwrite — that model caused a data-loss incident on 2026-06-30 when the project moved off iCloud and the script's transcript folder went empty). The script reads the JSONL conversation files (in `~/.claude/projects/-Users-howardjachter-Developer-IdiamPro/`) and git commit history, then ADDS only previously-unlogged days to the existing outline, preserving all existing entries untouched. It is idempotent (re-running adds nothing new) and has hard guards: it aborts without writing if it parses zero sessions or if the result would shrink the outline below its current size. Older transcripts that no longer exist on disk (pre-June-2026, from the iCloud era) cannot be reconstructed and survive only as git history — but nothing currently in the log will ever be wiped.

**Steps:**
1. Run the regeneration script: `python3 scripts/create_conversation_log.py`
2. Tell the user to reload the conversation log outline to see the updated version

**Note:** The app uses a dirty flag system — it only saves outlines that have been modified in-app. Since the conversation log is regenerated externally and not edited in the app, there's no need to switch outlines before running the script.

**Script location:** `scripts/create_conversation_log.py` (committed to the repo). The script:
- Reads all non-agent `*.jsonl` files from the Claude projects directory
- Gets git commits via `git log --format="%H|%aI|%s" --since=2025-12-01`
- Matches commits to sessions by timestamp
- Creates nodes per date with "Changes Made" commit summaries + conversation messages
- Outputs to `~/Documents/IDM Outlines/ClaudeCode Conversation Logs.idm`

**Format:**
- One node per date: "DayOfWeek, Month DD, YYYY"
- Multiple sessions per day become sub-nodes: "Session N — HH:MM"
- Each session starts with a **Changes Made** bulleted list of git commits, followed by the conversation
- Root node shows total stats (sessions, messages, commits, days)

---

## Delegation Policy — Use Subagents for Code Work

This user is vibe programming and does not read code, diffs, paths, build logs, or test output. To prevent these from leaking into his view, **default to spawning a subagent (Agent tool) for any code work beyond trivial edits.** The subagent's tool calls run privately; only my plain-English summary surfaces to him.

**Use a subagent for:**
- Multi-file or multi-step code surgery (edit, build, test, fix, re-test).
- Running `npm run build` or Playwright tests (chatty output).
- Restarting dev servers, killing/launching Electron, anything that prints lots of bash output.
- Any change I'm not 100% confident about — let the agent iterate against the build.

**Skip the subagent for:**
- Single-line edits I'm confident about.
- Read-only investigation (Read, Grep, quick state checks).
- Bash commands whose output isn't code or diffs (`curl`, `pgrep`, `ls`).
- Saving memory or CLAUDE.md updates.

**When briefing a subagent:** tell it the user does NOT read code, cap its reply length (e.g. "under 100 words, plain English only"), point it at this file + relevant memory, state the current in-flight code state so it doesn't undo work, include quality gates (full `npm run build` + Playwright + screenshot inspection), and end with refocus + status reporting.

---

## End-of-Turn Signal — MANDATORY

When I finish a turn and am ready for Howard's input, my final response MUST end with the literal phrase **`TALK TO ME`** (uppercase, on its own line). This is the unambiguous "I am done, your turn" signal Howard scans for when he glances at the terminal — without it he cannot tell whether I am still working or genuinely finished.

The phrase is reserved for "I am completely done with this turn." Do not use it as filler, mid-thought, or part of a sentence. It is always the last line of the response, with no trailing text.

This pairs with the verify-and-refocus loop in the Automated Testing section: after a Playwright check passes and I refocus Howard's terminal via `osascript`, the `TALK TO ME` line is what tells him to look.

---

## Active Until Reversed

These guidelines are active for ALL conversations until the user explicitly reverses them.
