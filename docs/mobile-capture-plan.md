# Frictionless Mobile Capture Plan (P10) — Idea → Trusted IdeaM Inbox in Seconds

*Design investigation — 2026-09-09. Research + read-only architecture audit; no code was changed. Written in plain English for Howard. Companion to `docs/siri-app-intents-plan.md` — the two are designed as ONE native foundation and should ship as one native push.*

---

## 1. The headline answers

- **Yes — a Capacitor app can do lock-screen-fast capture.** The proof is our direct competitor: **Obsidian's mobile app is itself built on Capacitor**, and their 1.14 release (Sept 2026) ships quick capture from the Lock Screen, Control Center, and Shortcuts *without loading the vault*, staying live via a Live Activity on the Lock Screen and Dynamic Island. Everything they did is native Swift living alongside the webview — exactly the pattern we already use for our text-to-speech plugin.
- **The Siri plan and this capture plan are the same foundation.** The Siri plan already requires a "native mirror" (web layer writes outline JSON to the app's own folder so Swift can read it) plus a **capture-inbox file the app absorbs on next open**. This plan is the *write side* of that same inbox: Share Sheet, Lock Screen, Control Center, Shortcuts, and Siri all drop payloads into one inbox; the web layer ingests them through one door. Build the inbox once, and every capture surface — present and future — is just another pen writing into it.
- **The one new requirement neither plan had before: an App Group.** A Share Extension runs as a *separate mini-app* and cannot write into the main app's Documents folder. Apple's designed answer is an **App Group shared container** — a folder both the extension and the main app can read/write. The inbox must live there (not in plain Documents). This is a one-time registration on the Apple Developer account — a founder action — and it also future-proofs the Siri mirror (widgets and extensions can then read outline titles too).
- **Philosophy is enforced by design:** capture is *append-only*. Nothing at capture time ever touches an existing outline. Filing happens later, in-app, through the standard Proposed Changes review — "capture now, file with consent later." And voice at capture time is **dictation only** (codified): words become text the user sees and confirms; capture never auto-executes anything.

## 2. What exists today (audit — read-only)

- **iOS shell:** stock Capacitor 8, one app target, no extensions, no App Groups, no entitlements file. Custom Swift already proven (native TTS plugin). `@capacitor/filesystem` and `@capacitor/share` installed — Filesystem is the ingestion tool; Share is outbound-only (it *sends* content, it cannot *receive* it — receiving requires a Share Extension target).
- **Inbox precedent already in the codebase:** Electron has a working "pending imports" pattern — long-running imports write result files to a pending folder; the app scans the folder and absorbs them (`electron-storage.ts` `checkPendingImports`, `electron/main.js` "Pending Imports Recovery"). There is also the newer external-agent-proposals channel (MCP sidecars, P8) that routes outside-world writes through the Proposed Changes review. Mobile capture ingestion should be the third consumer of this same "files in a folder → absorbed on open → user in control" idiom, not a new invention.
- **Web layer file access on iOS:** the app already writes files via Capacitor Filesystem in several places (exports, privacy data), so the read-the-inbox ingestion path is routine. One nuance: the stock Filesystem plugin does not reach into App Group containers — the tiny fix is a few-line method on our existing custom Swift plugin ("list/read/delete inbox files"), or a one-time native copy of inbox files into Documents at app launch. Either is small; we already own a custom plugin to put it in.

## 3. The iOS capture mechanisms, ranked (what each needs)

| Mechanism | What the user does | Native work required | App opens? |
|---|---|---|---|
| **Share Sheet (Share Extension)** | In Safari/Mail/Notes/anywhere: Share → IdeaM | New *Share Extension target* (small SwiftUI sheet) + App Group | No — the sheet floats over the current app; done in ~3 seconds |
| **Lock Screen / Control Center control** | One tap on a button (Lock Screen bottom slots, Control Center, or the iPhone Action button — all three come free from the same code) | *Widget Extension target* with a ControlWidget + App Intent + App Group (iOS 18+) | Opens a **native capture sheet instantly** (no waiting for the webview) — the Obsidian pattern |
| **Shortcuts / Siri intent** | "Add this idea to IdeaM" / any automation | The Siri plan's Phase 1 capture intent — *already planned*; just point it at the shared inbox | No (background intent) |
| **Live Activity** | Capture stays visible on Lock Screen / Dynamic Island while jotting; tap to resume | ActivityKit in the widget extension; started when a capture begins | No |
| **Back-of-phone double-tap etc.** | Action button / Back Tap → our capture intent | Free once the App Intent exists (user assigns it) | No |

**Dictation:** inside both the Share Extension sheet and the native capture sheet, the **system keyboard's mic button** gives full dictation *for free* — no permission prompt of ours, no Speech-framework code, no memory risk, and it perfectly matches our "dictation, never command" rule (the user watches the words appear and taps Save). Running our own Speech-framework recognizer inside an extension is possible but adds mic + speech permission prompts and flirts with the extension's ~120 MB memory ceiling — not worth it for v1. (A dedicated "hold-to-talk, hands-free" capture mode in the *main app's* native sheet can come later, where memory and permissions are roomy.)

## 4. The write path — one inbox, crash-safe, offline-first

**Location:** `group.com.secondbrainware.ideam/CaptureInbox/` (App Group shared container).

**Format:** one small JSON file per capture — `capture-<timestamp>-<random>.json`:

- `text` (the idea), `title` (optional), `source` (share-sheet | control | siri | shortcut), `sourceApp`/`sourceURL` (when shared from elsewhere), `createdAt`, `schemaVersion`, and an optional `suggestedDestination` (outline + branch — see §6).

**Why one-file-per-capture:** writes are atomic (write temp, rename in), two captures can never corrupt each other, a crash mid-write loses at most the one unfinished file, and it needs **no network ever** — capture works in airplane mode, on a mountain, in seconds. This is the same idiom as Electron's pending-imports folder, deliberately.

**Ingestion (web layer, on app open/foreground):** scan the inbox → show the captures in the **Inbox** (a dedicated, trusted "📥 Captured Ideas" outline or inbox section) → delete each file only *after* its content is safely saved into outline storage (absorb-then-delete, never delete-then-absorb). Idempotent by capture id, so a crash between absorb and delete just re-absorbs harmlessly. Data-protection rule applies in full: captures are outline data — sacred — so the inbox files also ride the existing snapshot/backup paths once absorbed.

**The trusted-inbox promise (the product contract):** anything the user captures is *guaranteed* to be waiting in the app, visibly, with its source noted — never silently lost, never auto-filed without consent.

## 5. Where we beat Obsidian's bar

Obsidian's destinations are *files* (new note, daily note, bookmarked note). Our outline model goes finer:

1. **Capture toward a BRANCH, not just a file.** The Siri plan's native mirror already writes outline JSON + a title index to native storage. Extend the mirror with a *pinned destinations* list (outline + node path, e.g. "Marketing → Video ideas"). The Share Extension and capture sheet show these as one-tap chips. Obsidian can drop text at the top of a note; we can aim an idea at the exact limb of a tree — that's an outliner-native edge nobody else has.
2. **AI-proposed filing with consent (Phase 3).** Obsidian's captures just sit in the note. Ours can do better *after* capture: on open, IdeaM says "3 captures waiting — here's where I'd file them," each shown as a Proposed Change (green insertion marks at the proposed branch) that the user approves or rejects. Minimal classification at capture time; intelligent filing later, always with consent, through the P1 review engine we already have. This turns raw capture into *organized knowledge* — the founding thesis (reorganizing IS understanding) — and it's a genuinely new category move.
3. **Source-aware captures.** Shares from Safari/Mail arrive with the source URL/app attached, so the eventual filed node carries provenance automatically.
4. **Same-day parity on their headline features:** Lock Screen/Control Center/Action-button capture, Live Activity while jotting, Shortcuts — all in Phase 2, all using the same iOS surfaces they used. Location template variables ({{latitude}}) are a cheap add to the capture payload if we want checkbox parity.

## 6. Parity notes — other platforms (brief, cheap wins)

- **Android (future, when scaffolded):** Capacitor share-target plugins (e.g. Capawesome Share Target) register the app as an Android share destination with far less ceremony than iOS; Android home-screen quick-capture widgets are also routine. The inbox design carries over unchanged (app-private files folder; no App Group concept needed).
- **Web (PWA):** the Web Share Target manifest entry makes the installed PWA appear in the Android share sheet — a manifest + service-worker change, no native code. On desktop web it's a no-op; low priority but nearly free when we touch the manifest.
- **Mac (Electron):** a **global quick-capture hotkey** (system-wide shortcut → tiny always-on-top capture window → writes to the same pending-inbox idiom) plus a macOS Services/Share menu entry later. The Electron pending-imports plumbing makes this a small, satisfying slice — and it lets us dogfood the inbox UX before any App Store review cycle.

## 7. Phased plan (effort classes; founder actions called out)

**Phase 0 — the shared foundation (with Siri Phase 1; ~days on top of it).** Define the inbox contract (folder, JSON schema, absorb-then-delete ingestion, Inbox UI in-app) and implement ingestion in the web layer + the small Swift bridge for App Group file access. Point the Siri plan's capture intent at this inbox. *Founder actions:* register the **App Group** (`group.com.secondbrainware.ideam`) on the Apple Developer account and add the entitlement in Xcode — ~10 minutes, only Howard's account can do it; the same App Group then serves Siri, Share Extension, and widgets forever.

**Phase 1 — Share Sheet → inbox (the smallest real slice; ~1 week).** New Share Extension target: accepts text, URLs, and page selections; a small native sheet showing the text (editable, system-keyboard dictation included free), destination chips from the mirror's pinned list, one Save button; writes the JSON file; done — the user never leaves the app they were in. Test on device via TestFlight. *Founder actions:* none beyond normal TestFlight build approval. *Watch-outs:* keep the extension pure-Swift and tiny (no Capacitor code inside it — avoids the "App-Extension-Safe API" build trap some Capacitor share-extension recipes hit, and stays far under the ~120 MB extension memory cap).

**Phase 2 — one-tap capture everywhere (+ Live Activity; ~1–2 weeks).** Widget Extension target with: a **ControlWidget** button (Control Center + Lock Screen bottom slots + Action button, all from one App Intent), which opens a **native capture sheet instantly** — no webview, no vault load (the Obsidian pattern; the sheet is the same SwiftUI view as the Share Extension's, reused). Start a **Live Activity** while a capture is open so a half-jotted idea stays reachable from the Lock Screen / Dynamic Island. Requires iOS 18+ for controls (older iOS still has Share Sheet + Shortcuts); Live Activity styling matches iOS 26/27 conventions. *Founder actions:* none new (App Group already exists).

**Phase 3 — AI-proposed filing through Proposed Changes (~1–2 weeks, after P1 engine + Siri Phase 1 are solid).** On open with captures waiting: badge + "3 captures waiting — IdeaM suggests where they go." Each suggestion is a standard Proposed Change insertion at a specific branch; approve files it, reject leaves it safely in the Inbox. AI cost obeys the standing rules (BYOK / free-tier / on-device; suggestion is optional and lazy — captures are perfectly usable unfiled). This is the piece that leapfrogs the whole capture-app category.

**Deliberately out of scope for v1:** our own in-extension speech recognizer (system dictation covers it), photo/file capture (text + URLs first; attachments are a schema-versioned extension later), Android (not scaffolded yet).

## 8. Risks and honest caveats

1. **App Review:** low risk — Share Extensions and widgets are mainstream. The known Capacitor-specific trap is setting "Require Only App-Extension-Safe API = No" to shoehorn Capacitor pods into the extension (documented rejection risk); we avoid it entirely by keeping extensions pure Swift. The thin-webview "minimum functionality" wildcard from the Siri plan applies here too — and, as there, real native capture *strengthens* our case.
2. **Extension limits:** ~120 MB memory ceiling and no long-running work in the Share Extension — fine for a text sheet writing a 2 KB JSON file; becomes a real constraint only if we later add image/OCR capture (do that in the main app instead).
3. **Two new Xcode targets** (Share Extension, Widget Extension) mean slightly more build/signing surface: each needs its own bundle id + provisioning under the App Group. One-time setup pain, then stable. `npx cap sync ios` does not manage extension targets — they live purely in Xcode, so they're insulated from Capacitor upgrades (Capacitor 8 is current; no upgrade needed for any of this).
4. **iOS version spread:** controls need iOS 18+; Live Activities 16.1+; the Share Extension works back to our iOS 15 floor. Ship notes should say "quick-capture buttons need a recent iOS"; nobody is locked out of Share Sheet capture.
5. **The inbox is now load-bearing:** like the Siri mirror, the ingestion path must be tested as hard as outline save itself (atomic writes, absorb-then-delete, double-absorb idempotence, airplane-mode capture, kill-the-app-mid-capture). It's the sacred-data category; the test suite gets a dedicated capture-inbox script.
6. **iOS 27 drift:** controls/App Intents surfaces are evolving fast this fall; Phase 1 (Share Extension) rides decade-stable API and is near-zero exposure; Phase 2 rides the newer surface — same risk posture as the Siri plan's phases, by design.

## 9. Decision points for Howard

- 🟠 Approve the **App Group registration** (the one thing only his Apple Developer account can do; ~10 minutes, done once, unlocks capture AND the Siri mirror): https://developer.apple.com/account/resources/identifiers/list/applicationGroup
- 🟠 Approve the phased plan and the "ship capture + Siri Phase 1 as one native push" packaging.
- Everything else (inbox schema, sheet design, pinned-destinations UX, Electron hotkey choice) is reversible/technical and will be decided and documented in the Decisions Log during implementation.

---

*Sources consulted: Apple developer documentation and forums (App Intents, LiveActivityIntent, ControlWidget, extension memory limits), Capacitor/Ionic community share-extension recipes (capacitor-share-extension, Capawesome Share Target), Chrome/MDN Web Share Target docs, and the Obsidian 1.14.0 mobile changelog (obsidian.md/changelog/2026-09-02-mobile-v1.14.0).*
