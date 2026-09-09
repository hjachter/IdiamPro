# Google-Centric Output Integrations — Findings & Phased Plan

**Task #13 investigation — 2026-09-09. Read-only scoping doc; no code changed.**

Goal: push finished IdeaM outputs into the **user's own Google workspace** (Drive, Docs,
Sheets; evaluate Vids) so the outline stays the source of truth and Google's tools become
extra output rails. Hard money rule honored throughout: everything runs on the **user's own
Google account via OAuth** — never our keys, no company-funded API usage.

---

## 1. What exists in the repo today (audit)

**Google-facing plumbing (all read/embed-only — no OAuth anywhere yet):**

- `src/components/google-docs-picker-dialog.tsx`, `google-sheets-picker-dialog.tsx`,
  `google-slides-picker-dialog.tsx`, `google-maps-picker-dialog.tsx` — paste-a-URL embed
  dialogs (convert a share URL to a `/preview` embed). No API calls, no auth. These prove
  the UX slot ("Google" already appears in the app) but share no infrastructure with what
  we need.
- **BYOK Gemini** (`src/lib/byok-keys.ts`) — API-*key* based, not OAuth. Unrelated
  mechanically, but it establishes the exact precedent we want: user-owned credentials,
  stored client-side, "your account, your usage." Its own comments flag the follow-up we
  should ride along with: migrate key storage to **Electron `safeStorage`**
  (Keychain-backed) — Google OAuth tokens should land in that same secure store.
- **Auth layer** (`src/lib/auth/auth-config.ts`) — Clerk, fully env-gated (off unless keys
  are set). Google *sign-in* would be configured in the Clerk dashboard, not the repo;
  nothing Google-specific exists in code. Important nuance: Clerk can also act as our
  **Google OAuth token broker** on web (it stores/refreshes the Google access token and
  serves it via its backend API) — but only when auth is on. Design below works with or
  without Clerk.
- **No deep-link/custom-protocol handler in `electron/main.js`** — so the Electron OAuth
  flow must use the **loopback redirect** (temporary local `http://127.0.0.1:<port>`
  listener), which is Google's recommended desktop pattern anyway (PKCE, "Desktop app"
  client type).

**The export architecture is a perfect fit for new "Google" targets:**

- `src/lib/export/index.ts` — lazy-loaded exporter registry (`EXPORTER_LOADERS`), ~25
  formats. Each exporter extends `BaseExporter` (`src/lib/export/base-exporter.ts`):
  `convert()` produces an `ExportResult`, `save()` delivers it. A Google adapter simply
  overrides delivery: **convert exactly as today, then upload instead of save-to-disk.**
- Directly reusable conversions: **Markdown exporter → Google Doc** (Drive converts
  Markdown to a native Doc with real headings — see §2), **CSV exporter → Google Sheet**
  (Drive's oldest conversion), **DOCX exporter → Google Doc** (also auto-converts),
  **website/HTML/PDF/podcast/video outputs → plain Drive file uploads**.
- `src/lib/format-registry.ts` — declarative format metadata with `platformSupport`
  per shell; Google targets slot in as new entries (category could stay per-output-type,
  with a "sends to your Google Drive" description).
- `src/lib/compile-core/` (Phase 0 of the content compiler) — clean-text, traversal,
  structure mapper, compile tree + content fingerprints, with **manifests/adapters as the
  planned later phases** (`docs/content-compiler-architecture.md`). A `google-docs`
  adapter conforms naturally: the manifest records the Drive **file ID** + content
  fingerprint per compile, giving traceability ("this Doc was produced from outline X,
  node Y, at fingerprint Z") and enabling re-export-in-place (update the same Doc rather
  than minting duplicates).
- The earlier **"NL → Google Workspace"** idea in project memory (describe a sheet/doc →
  AI builds a real editable Google Sheet/Doc) is exactly Phase C below — same OAuth
  foundation, plus AI structuring on top.

---

## 2. Web research findings

### a) API capabilities & scopes (the good news)

- **Drive API**: upload any file; **converts on upload** when you ask for a Google-native
  target — `text/markdown` → Google Doc (shipped July 2024; headings, lists, links, bold
  all survive), CSV → Google Sheet, DOCX → Google Doc. So we get *native, editable* Docs
  and Sheets **without ever touching the Docs/Sheets APIs** for the core flow.
- **Docs API / Sheets API**: full programmatic create/edit (batchUpdate) when we want
  finer control later (e.g. surgical updates, formatting beyond Markdown).
- **The scope that changes everything: `drive.file`** — "create new Drive files, or
  modify files the user opened with the app." It is classified **non-sensitive**, is
  Google's explicitly recommended scope for apps that only create/edit their own files,
  and — critically — **the Docs and Sheets APIs both accept `drive.file`** for documents
  the app itself created. We never need the restricted full-`drive` scope or the
  sensitive `documents`/`spreadsheets` scopes for anything in Phases A–C.
- **Incremental auth**: request no Google scope at install; request `drive.file` only the
  first time the user clicks a "Send to Google…" action (`include_granted_scopes=true`).
  We ask only for what's used, exactly per Google best practice and our own
  user-in-control principle.

### b) Verification — the make-or-break item (verdict: NOT a blocker)

- Apps using **only non-sensitive scopes (like `drive.file`) do NOT require OAuth app
  verification** — no security assessment, no 100-user cap, no annual re-assessment.
  The dreaded **restricted-scope security assessment** (third-party assessor, typically
  $10K–$75K+/year, months of lead time) applies only to restricted scopes (full `drive`,
  full Gmail) — which we don't need and must architecturally refuse to ever request.
- What we *should* do: **brand verification** (free, days-not-months) so the consent
  screen shows "IdeaM by SecondBrainWare" with our logo instead of an unverified-app
  look. Needs: production publishing status, verified domain (2ndbrainware.com), privacy
  policy URL, app homepage. This is founder-account work (see §5).
- If we ever added a *sensitive* scope, verification is a review (~days to weeks), still
  no paid assessment. Keep us out of restricted territory forever.

### c) Google Vids — verdict: **no public API today; UI-only**

- Vids is a Workspace end-user product. There is **no public REST API** to create or
  populate a Vids project programmatically (no Vids entry in the Workspace API family;
  third-party API directories confirm none). The free Veo-powered generation inside Vids
  (the "free gens/month" angle from the brainstorm) is **manual-only in the Vids UI** —
  not automatable on the user's account.
- Programmatic Veo video generation exists only via the **Gemini API / Vertex AI** —
  which is *paid per second of video* and would ride the user's Gemini BYOK key, i.e. a
  different feature (our existing video pipeline could optionally add a BYOK-Veo clip
  generator someday), **not** a Vids integration.
- Best honest Vids play today: a **"Prepare for Google Vids" hand-off** — export the
  script/storyboard (we already build these for the video wizard) as a Google Doc into
  the user's Drive, upload generated slide images/audio alongside, then open
  `https://docs.google.com/videos/` for the user. Vids can import Drive assets and Docs
  content; the human does the last mile. Re-evaluate quarterly for an API.

### d) Apps Script / alternatives if direct APIs were gated (they aren't)

- Not needed given the `drive.file` verdict. For the record: Apps Script Execution API
  requires the same OAuth consent and *worse* scopes; Drive "shortcuts" don't help
  authoring. One genuinely useful lightweight alternative for a zero-OAuth taste:
  **"Open in Google Docs" via download + drive.google.com drag-drop instructions** —
  but that's a worse UX than Phase A and not worth building. Direct API is the path.

### e) Quotas / cost on the user's account — **zero dollars**

- Drive, Docs, and Sheets APIs are **free**; there is no billing meter for these calls
  on either side. Limits are per-project *rate* quotas (order of thousands of requests
  per minute — far above our one-upload-per-export usage). Uploaded files consume the
  user's own Drive **storage** quota (15 GB free tier), which is the user's normal
  Google relationship. No company cost, no user surprise cost. Google Cloud project
  itself: free (no billing account required for these APIs).

---

## 3. Phased design

**Common foundation (built once, in Phase A):** a small `google-auth` module —
Electron: OAuth 2.0 + PKCE with loopback redirect ("Desktop app" client), refresh token
encrypted via `safeStorage` (Keychain); Web: Google Identity Services token client
(access token held in memory / short-lived — no server-side token storage, preserving our
data-ownership stance; if/when Clerk auth is live in production, optionally let Clerk
broker the Google token instead). Scope: `drive.file` only, requested incrementally on
first use. A "Google account" row in Settings shows connected state + one-click
disconnect (token revoke) — user-in-control, off by default, honest consent copy.

### Phase A — "Save to Google Drive" (cheapest honest slice)
- New delivery option on existing exports: after `convert()`, upload the `ExportResult`
  to the user's Drive (`files.create`, multipart), then **open the file's
  `webViewLink` in the browser** — satisfying our "show the finished product
  immediately" rule.
- Because Drive converts on upload, this *already yields native Google files*:
  Markdown → **editable Google Doc with real headings**, CSV → **Google Sheet**,
  DOCX → Google Doc; PDF/HTML/audio/video land as viewable Drive files.
- Scope: `drive.file`. Verification: none required (do brand verification in parallel).
- Effort class: **Small-Medium** (~the OAuth foundation is most of it; the upload itself
  is one function). Fully test-drivable with a Playwright + test-Google-account loop.

### Phase B — first-class "Google Docs" / "Google Sheets" export formats
- Register `google-docs` and `google-sheets` entries in `FORMAT_REGISTRY` +
  `EXPORTER_LOADERS`, reusing the Markdown/CSV converters internally, plus:
  export options (destination folder picker via `drive.file`-compatible Google Picker,
  title, "update existing" vs "new file"), and **manifest traceability** — store the
  Drive file ID + content fingerprint in the compile manifest so re-export updates the
  same Doc/Sheet in place (`files.update` with conversion) instead of duplicating.
- Optional polish via Docs API batchUpdate (still `drive.file` on our own files):
  title page, footer "Produced with IdeaM," images.
- Scope: unchanged (`drive.file`). Effort: **Medium**.

### Phase C — NL → structured Sheet/Doc (the memory'd Pro idea) + Vids watch
- "Describe the spreadsheet you want" → AI (user's BYOK/metered path, existing rules)
  designs the structure → Sheets API `batchUpdate` builds a real formatted Sheet
  (headers, formulas, formatting) in the user's Drive; same pattern for Docs. Pro-tier
  feature. Scope: still `drive.file` (we created the file). Effort: **Medium-Large**
  (mostly AI-prompt + schema work; the Google side is already built by then).
- **Vids**: ship the "Prepare for Google Vids" hand-off (assets + script Doc into Drive
  + open Vids) as a Phase C garnish; upgrade to a real integration if Google ever ships
  a Vids API.

---

## 4. Risks & mitigations

| Risk | Assessment | Mitigation |
|---|---|---|
| OAuth verification delay | **Low** — `drive.file` is non-sensitive; no verification gate. Brand verification is fast and cosmetic. | Submit brand verification early; never request sensitive/restricted scopes (code-review rule). |
| Scope creep vs privacy promises | Real temptation later ("import from Drive!" → full `drive`). Full Drive is a *restricted* scope = paid annual security assessment + contradicts our data-ownership stance. | Hard rule in this doc + CLAUDE.md when built: **`drive.file` only, forever**; Drive *import* uses the Google Picker (user hand-picks files, still `drive.file`-compatible). |
| Token storage in Electron | localStorage is not acceptable for refresh tokens. | `safeStorage` (Keychain-encrypted) from day one; piggyback the already-planned BYOK-key migration. Web keeps tokens in memory only. |
| User cost / quotas | APIs are free; files use the user's Drive storage. | State it plainly in the consent copy ("files count against your Google storage"); no absolute "free" guarantees per the no-guarantees rule — "no charge from us; Drive storage is your normal Google plan." |
| Vids expectations | No API; anything we market must not promise automated Vids creation. | Market the hand-off honestly ("one click gets your script and assets into Drive, ready for Vids"). |
| Unverified-app consent screen pre-brand-verification | Shows a plainer screen; works fine, just less polished. | Do brand verification before public launch of the feature. |

---

## 5. Founder-only actions (Google Cloud console — his account, his hands)

All under the **Google Auth Platform** in the Cloud console:

1. **Create a Google Cloud project** (e.g. "IdeaM"):
   https://console.cloud.google.com/projectcreate
2. **Enable the three APIs** (one click each):
   - Drive: https://console.cloud.google.com/apis/library/drive.googleapis.com
   - Docs: https://console.cloud.google.com/apis/library/docs.googleapis.com
   - Sheets: https://console.cloud.google.com/apis/library/sheets.googleapis.com
3. **Configure the consent screen / branding** (app name "IdeaM", logo, homepage,
   privacy-policy URL, verified domain 2ndbrainware.com):
   https://console.cloud.google.com/auth/branding
4. **Create two OAuth clients** — one "Web application" (for the web app) and one
   "Desktop app" (for Electron loopback):
   https://console.cloud.google.com/auth/clients
   (Client IDs go in env vars; the desktop client's "secret" is not actually secret and
   ships in the app per Google's desktop-app model.)
5. **Set publishing status to "In production"** and, when ready, **submit brand
   verification** (free): https://console.cloud.google.com/auth/verification
6. Domain verification for the brand review happens in Search Console:
   https://search.google.com/search-console

Everything else (code, token handling, exporters, tests) is Claude-side work.

---

## 6. Recommendation

Build the **common OAuth foundation + Phase A** first: it's a small-medium effort, needs
zero Google verification, costs nobody anything, and — thanks to Drive's upload
conversion — already delivers the headline demo: *outline → editable Google Doc with
real headings, or a real Google Sheet, in the user's own Drive, opened instantly in the
browser.* Phase B is then mostly registry/options/traceability polish, and Phase C
inherits a finished pipeline.

*Sources: Google Drive API scope guide (developers.google.com/workspace/drive/api/guides/api-specific-auth),
Google OAuth verification docs (developers.google.com/identity/protocols/oauth2/production-readiness —
sensitive-scope-verification & restricted-scope-verification), Google Workspace Updates
blog "Import and export Markdown in Google Docs" (July 2024), Google Vids product
coverage confirming no public API (2026).*
