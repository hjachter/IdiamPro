# Siri & App Intents Plan for IdeaM on iOS 27

*Investigation report — 2026-09-06. Research + architecture audit only; no code was changed. Written in plain English for Howard's review; this document will drive the implementation task.*

---

## 1. The headline answers

- **Yes, a Capacitor app can absolutely do this.** App Intents are plain Swift code that lives inside the iOS app target alongside the webview. Apple does not care that our screens are web-based; Siri talks to the Swift layer, not the screens. We already have a working pattern for custom Swift in this project (our native text-to-speech plugin), so there is a proven place to put the new code.
- **The one make-or-break architectural fact:** on iPhone/iPad today, the user's outlines live *inside the webview's browser storage* — a place native Swift code cannot read. Worse, the shipping iOS app loads its screens live from our website (the Vercel deployment), so that storage is tied to the web address, and Siri intents would have no data to answer from when the app isn't open. **The fix is a "native mirror": every time the web layer saves an outline, it also writes a plain JSON copy to the app's own Documents folder** using the file-writing plugin we already ship. The Siri intents then read those files directly — fast, offline, no server call needed. This mirror is the foundation of every phase below, and it doubles as a durability upgrade (browser storage can be evicted by the system; real files cannot).
- **The free Apple AI ("Private Cloud Compute") offer is real**, announced at WWDC 2026, and IdeaM/SecondBrainWare almost certainly qualifies. Details in section 4.

## 2. What the iOS project contains today (audit)

- A minimal, stock Capacitor shell: one app target, a plain AppDelegate, no extensions, no intents, no entitlements file, no App Groups.
- Custom native code already exists (the text-to-speech plugin), proving the "add Swift alongside the webview" pattern works here.
- Native plugins installed: Filesystem and Share — Filesystem is exactly what the web layer will use to write the native mirror. No new plugin purchase or dependency is needed for Phase 1's data path.
- Production iOS loads the live website rather than a bundled copy. (Separate observation: this means the iOS app is currently dead without internet. The native mirror partially heals that for Siri, but bundling the web app locally is worth a future task of its own.)
- Deployment target is iOS 15; Info.plist already declares microphone and speech-recognition usage. The web layer already has a "pending imports" pattern (built for Electron) that we can mirror for Siri capture — captured ideas land in an inbox the app absorbs on next open.

## 3. What Apple requires for the new Siri (iOS 27)

- iOS/iPadOS 27 shipped September 2026. Siri is rebuilt on **App Intents** — now the *only* door into third-party apps (the old SiriKit is deprecated). Siri gains personal context, onscreen awareness, and cross-app actions, all through App Intents.
- To surface in Siri, an app defines: **entities** (our outlines and nodes, described so Siri understands them), **queries** (how Siri finds "my outline about marketing"), **intents** (the actions: capture, open, search), and **App Shortcut phrases** ("add this to IdeaM"). Optionally, entities can be indexed for Siri's semantic search — that indexing stays on the device.
- **App Schemas** are pre-built categories that make Siri understand an app with much less work. There is no dedicated "outliner" schema, but the **Documents** domain is the natural fit for outlines, and the notes-style pattern Apple demos (search / summarize / create) maps almost one-to-one onto our planned actions. We adopt the closest schemas and add custom intents for the rest — Apple explicitly supports mixing both.
- Intents run **inside our own app's process** — no separate extension target is required for our use cases, which keeps the native surface area small.
- The basic App Intents layer works on any iOS 27 device (iPhone 11 and newer); the AI-powered Siri experience requires an Apple Intelligence device (iPhone 15 Pro or later). We build once; users get whichever tier their phone supports.

## 4. The free Apple AI opportunity (Private Cloud Compute)

- **Real and generous:** qualifying small developers get Apple's frontier cloud AI models at **zero API cost**, running on Apple's privacy-preserving Private Cloud Compute. It works in App Store, TestFlight, *and* ad-hoc builds — so we can use it before launch.
- **Qualifying criteria (we meet all three today):**
  1. Enrolled in the **App Store Small Business Program** (for developers under $1M/year — we qualify trivially);
  2. Fewer than **2 million lifetime first-time downloads** across all apps (TestFlight downloads don't count);
  3. The **Private Cloud Compute entitlement** granted to the account (a request form, not a competition).
- If we ever outgrow it (2M downloads or leaving the Small Business Program), Apple gives a 6-month migration window — no sudden cutoff.
- **Founder actions (only Howard can do these, using his Apple Developer account):**
  1. Enroll in the App Store Small Business Program: https://developer.apple.com/app-store/small-business-program/
  2. Request the Private Cloud Compute entitlement: https://developer.apple.com/contact/request/private-cloud-compute/
- **Strategic fit:** this slots perfectly into our "never fund AI from Howard's personal key" rule. On Apple devices, summarize/rewrite-class AI can run on Apple's models at zero cost to us and with a privacy story stronger than anything we could build — a genuine marketing point, not just a cost saving.
- The companion **Foundation Models framework** gives us: a free **on-device** model (private, offline, ~4K-token window — fine for summarizing a branch) and the free **cloud** model via PCC (~32K window, stronger reasoning — fine for whole-outline work). One programming interface covers both, and Apple even allows routing the same calls to third-party providers, which matches our existing BYOK philosophy.

## 5. The phased plan

**Phase 1 — Capture, Open, Search (the safe read/create trio).** Build the native mirror (web layer writes outline JSON + a small title index to the app's Documents folder on every save). Add three intents: *"Add this idea to IdeaM"* (writes to a capture-inbox file the app absorbs on next open — creation only, touches nothing existing), *"Open my outline about X"* (finds by title, opens the app there via the deep-link handler we already have), and *"Find my outlines about X"* (searches the mirror, returns results inside Siri). Adopt the Documents schema entities so outlines appear to Siri as real things. **Effort: roughly 1–2 weeks.** Native surface: one small Swift file set in the existing app target plus a bridge plugin — no new targets, no new dependencies. Founder actions: none beyond normal TestFlight approval.

**Phase 2 — Summaries via Apple's free AI.** *"Summarize my outline about X"* — the intent reads the mirrored outline and asks the on-device Apple model (or PCC for big outlines) for a summary, spoken or shown by Siri. Read-only; nothing is modified. **Effort: days, once Phase 1's mirror exists** — but gated on the founder actions in section 4 (Small Business enrollment + PCC entitlement) and on Xcode 27. Requires a physical Apple Intelligence device to test (the Apple models don't run in the simulator).

**Phase 3 — Structural actions through Proposed Changes.** *"Reorganize / merge / restructure…"* requests from Siri never edit directly: the intent writes a proposal record to the inbox, and the app's Proposed Changes approval engine presents it for the user to accept or reject on next open. Siri gets a voice, never a pen. **Effort: 2–4 weeks** (protocol design plus wiring into the approval engine), and it should wait until Phases 1–2 have proven the pipeline.

## 6. Toolchain and deployment target

- Building any of this requires **Xcode 27** (free download; runs on Howard's M5). Our Capacitor 8 project opens in it without changes.
- The **iOS 15 deployment target can stay** — App Intents code is simply marked "iOS 16-and-up" (and the AI parts "iOS 26-and-up") inside the same app; older iPhones keep working, they just don't get Siri features. Recommendation at implementation time: raise the target modestly (iOS 16 or 17) purely to reduce annotation noise — a low-stakes, reversible call.

## 7. Risks and honest caveats

1. **Biggest risk — the data location (now mitigated by design):** without the native mirror, Siri sees nothing; with it, we're also depending on the web layer reliably writing the mirror on every save. That write path must be tested as hard as the outline-save path itself (it's outline data — the sacred category).
2. **App Review:** App Intents need no special entitlement and our intents request no new permissions, so rejection risk is low. The pre-existing wildcard risk for any thin webview app is a "minimum functionality" complaint about loading screens from the web; adding real native Siri integration actually *strengthens* our case, and bundling the web app locally later removes it entirely.
3. **Privacy declarations:** our App Store privacy label must note that outline titles/content are indexed on-device for Siri (it never leaves the device for search; summaries via PCC go to Apple's provably-private cloud, not to us). This aligns with — and arguably showcases — our data-ownership stance. Make Siri indexing an explicit user toggle (on by default is defensible, but a toggle keeps us honest).
4. **Version drift:** iOS 27 APIs are brand new; expect small breaking changes in point releases during fall 2026. Phase 1 uses the stable iOS 16-era core of App Intents, so it is low-exposure; Phase 2 rides the newest surface.
5. **Apple dependency:** the free PCC tier is Apple's program on Apple's terms. Treat it as a bonus tier in our AI routing (alongside BYOK and local), never the only path — which is already our architecture. Add it to the Dependencies outline when implemented.

## 8. Decision points for Howard

- 🟠 Approve the two applications only he can file: Small Business Program enrollment and the PCC entitlement request (both free; URLs in section 4).
- 🟠 Approve the phased plan and Phase 1 start.
- Everything else (schema choice, mirror format, deployment-target bump) is in the reversible/technical bucket and will be decided and documented in the Decisions Log during implementation.
