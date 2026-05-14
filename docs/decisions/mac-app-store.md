# Mac App Store vs DMG-only — Decision

## 1. Mac App Store (MAS) — pros / cons for an Electron app

**Pros**
- Discoverability via the App Store search and category pages.
- Free automatic updates handled by Apple — no `electron-updater` infra to run.
- Apple-managed billing for paid apps and IAP (familiar to users, no Stripe disputes).
- Institutional trust: some enterprise / EDU buyers will only install from MAS.
- Single install path for users already on iOS via Universal Purchase (optional).

**Cons**
- **30% commission** on app price and IAP (15% under Small Business Program <$1M/yr revenue).
- **App Sandbox is mandatory.** This is the big one for Electron:
  - File access requires user-selected files or security-scoped bookmarks — `~/Documents/IDM Outlines/` cannot be freely read/written without prompts.
  - No arbitrary child processes (Ollama, MCP server) — local AI features would break or need rework.
  - No raw network listeners; some Electron native modules require entitlement workarounds.
- Review cycles: 1-3 days per submission, occasional rejections for sandboxing edge cases.
- Hardened runtime + provisioning profile + extra entitlements config.

## 2. DMG-only — pros / cons

**Pros**
- Full unsandboxed filesystem access — `~/Documents/IDM Outlines/`, Ollama spawn, MCP server, future plugin folders all work without prompts.
- No 30% fee on Stripe revenue (only Stripe's ~2.9% + 30 cents).
- Ship updates the same day you build them (electron-updater + a static host like Vercel/S3).
- No App Review gatekeeping for risky features (AI, scripting, file watchers).

**Cons**
- Users must find your website to download — zero App Store discovery.
- Must run your own auto-update infrastructure (electron-updater feed + signed builds).
- Notarization still required (free, ~5 min per build), but no full App Review.
- Less institutional trust; some IT departments block non-MAS installers.

## 3. Hybrid option (MAS sandboxed + DMG full-featured)

Feasible but **2x maintenance**: two `electron-builder` targets, two entitlements files, two feature-flagged code paths (e.g. disable Ollama spawn in the MAS build), and two QA passes per release. Several Electron apps do this (1Password historically, Hyper) but it's a meaningful tax for a solo founder. Only worth it once revenue justifies the overhead.

## 4. Recommendation

**Ship DMG-only for v1.** IdiamPro's core differentiators — local Ollama AI, free filesystem access to `~/Documents/IDM Outlines/`, MCP server child process, future plugins — fight the sandbox. Losing those features to win App Store discovery is the wrong trade for an indie launch. Notarize, ship via electron-updater, drive traffic from SECONDBRAINWARE.COM.

Revisit MAS in 6-12 months **only if**: (a) revenue plateaus and discovery is the bottleneck, or (b) an enterprise/EDU customer asks for it. At that point, build a sandboxed-feature-flagged MAS variant as a second SKU.

## 5. Effort estimate for MAS (if pursued)

- Sandbox audit + refactor (file access, child processes): **3-7 days**
- Entitlements + provisioning profile + Universal Purchase config: **1 day**
- Separate `electron-builder` MAS target + signed pkg upload: **1 day**
- First review cycle + rejection fixes (budget for one rejection): **3-7 days elapsed**

**Total: 1-3 weeks of focused work**, vs ~1 day to polish the existing DMG flow.
