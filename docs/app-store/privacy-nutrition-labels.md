# App Store Privacy Nutrition Labels — Recommended Answers

> **DRAFT — VERIFY BEFORE SUBMISSION.** App Store Connect's privacy questionnaire is legally binding. Howard should review every row against the latest build before clicking "Publish." Items marked **[HOWARD DECISION]** depend on choices not yet finalized (whether accounts are required at launch, whether Vercel Analytics is enabled, etc.). Items marked **[VERIFY]** should be re-checked against the shipping code at submission time.

_Last updated: 2026-05-13_
_App: SecondBrainWare (internal code: IdiamPro)_
_Bundle ID:_ **[VERIFY in App Store Connect]**

---

## 1. Summary for Howard

SecondBrainWare is a **privacy-light app by design.** Outlines live on the device. The server has no database of user content. Most data categories in the App Store questionnaire should be answered **"Data Not Collected."** The only data we currently touch:

- **Account email** if (and only if) the user creates an account for subscription billing. **[HOWARD DECISION: at launch, do iOS users need an account, or is the iOS app free-tier only with no login?]**
- **Purchase history** for subscribers — handled by Apple via in-app purchase or by Stripe on web.
- **Crash logs** — only if Sentry (or equivalent) is added. **[HOWARD DECISION: ship with Sentry or not?]** Currently no crash-reporting SDK is in the codebase.
- **User content sent to AI providers** when the user invokes an AI feature — this is disclosed in the consent dialog and Privacy Policy.

We do **not** track users across other apps or websites. We do **not** use data for advertising. No ATT (App Tracking Transparency) prompt is required.

---

## 2. Top-Level Questionnaire Answers

| Question | Answer | Notes |
|---|---|---|
| Does your app or third-party partners collect data from this app? | **Yes** | Triggered by the account email, payment info, and crash logs below. If at launch we ship with no account and no Sentry, this can become **No** — see decisions below. |
| Does your app use data for tracking? | **No** | We do not link user/device data to third-party data for advertising or share with data brokers. |

---

## 3. Per-Category Answers

For each Data Type, the table below shows what App Store Connect asks and the recommended answer.

### Legend

- **Not Collected** — the app and its SDKs do not transmit this category off the device.
- **Linked** — collected and tied to the user's identity (account email, user ID, payment record).
- **Not Linked** — collected but not associated with the user's identity.
- **Used for Tracking** — combined with third-party data for advertising or shared with data brokers. Always **No** for this app.

### 3.1 Contact Info

| Sub-type | Status | Linked? | Tracking? | Purpose | Notes |
|---|---|---|---|---|---|
| Name | Not Collected | — | — | — | We do not ask for the user's name. |
| **Email Address** | **Collected** | **Yes** | No | **App Functionality**, **Account Management**, **Customer Support** | Only when user creates an account for billing. **[HOWARD DECISION]** If iOS launches with no account, mark Not Collected. |
| Phone Number | Not Collected | — | — | — | |
| Physical Address | Not Collected | — | — | — | |
| Other User Contact Info | Not Collected | — | — | — | |

### 3.2 Health & Fitness

All sub-types: **Not Collected.** SecondBrainWare has no health features.

### 3.3 Financial Info

| Sub-type | Status | Linked? | Tracking? | Purpose | Notes |
|---|---|---|---|---|---|
| Payment Info | Not Collected (by us) | — | — | — | iOS uses Apple in-app purchase; we never see card data. Web uses Stripe Checkout; Stripe handles card data, not us. Apple and Stripe disclose their own collection. |
| Credit Info | Not Collected | — | — | — | |
| Other Financial Info | Not Collected | — | — | — | |

### 3.4 Location

All sub-types: **Not Collected.** No geolocation APIs are used.

### 3.5 Sensitive Info

**Not Collected.** No race, religion, sexual orientation, union membership, etc.

### 3.6 Contacts

**Not Collected.** No address-book access.

### 3.7 User Content

| Sub-type | Status | Linked? | Tracking? | Purpose | Notes |
|---|---|---|---|---|---|
| Emails or Text Messages | Not Collected | — | — | — | |
| **Photos or Videos** | Conditional | n/a | No | App Functionality | Only if the user uses the image-attach / OCR feature and chooses to send the image to an AI provider. **[VERIFY: is image upload shipping in v1 on iOS?]** If yes, mark as Collected (Linked No), purpose **App Functionality**. |
| **Audio Data** | Conditional | n/a | No | App Functionality | Only if the user records audio for transcription. Audio is sent to AssemblyAI when the user taps Transcribe. Mark Collected, Linked No, purpose **App Functionality**. **[VERIFY: is transcription shipping in v1 on iOS?]** |
| Gameplay Content | Not Collected | — | — | — | |
| **Customer Support** | **Collected** | **Yes** | No | **Customer Support** | If the user emails support@2ndbrainware.com, the message and email are stored in our inbox. Required disclosure. |
| **Other User Content** | **Collected** | No | No | **App Functionality** | When the user invokes an AI feature, the relevant outline text/selection is sent to the configured AI provider (Google, Anthropic, OpenAI, AssemblyAI, or local Ollama). Apple considers this collection by the app's third parties. Mark as Not Linked (we don't tie it to user identity on our side; provider terms govern their side). Disclose in the Privacy Policy with provider names. |

### 3.8 Browsing History

**Not Collected.** We don't track URLs visited inside or outside the app.

### 3.9 Search History

**Not Collected.** In-app search runs locally over the user's own outlines and is not transmitted.

### 3.10 Identifiers

| Sub-type | Status | Linked? | Tracking? | Purpose | Notes |
|---|---|---|---|---|---|
| **User ID** | **Collected** | **Yes** | No | **App Functionality**, **Account Management** | Only if accounts are enabled. The user ID is our internal account identifier, not Apple's IDFA. **[HOWARD DECISION]** |
| Device ID | Not Collected | — | — | — | We do not read IDFA or IDFV. Confirm Sentry, if added, is configured to anonymize. |

### 3.11 Purchases

| Sub-type | Status | Linked? | Tracking? | Purpose | Notes |
|---|---|---|---|---|---|
| **Purchase History** | **Collected** | **Yes** | No | **App Functionality**, **Account Management** | For subscribers we keep a record of tier, start date, and renewal status so the app knows what features to unlock. Apple's IAP and Stripe each collect their own copy under their own policies. |

### 3.12 Usage Data

| Sub-type | Status | Linked? | Tracking? | Purpose | Notes |
|---|---|---|---|---|---|
| **Product Interaction** | **[HOWARD DECISION]** | — | No | Analytics | Currently no analytics SDK ships in the codebase. If Vercel Analytics is enabled for the web build or PostHog/Mixpanel is added later for the iOS build, switch this to **Collected, Linked No, purpose Analytics**. As of today: **Not Collected**. |
| Advertising Data | Not Collected | — | — | — | We have no ads. |
| Other Usage Data | Not Collected | — | — | — | |

### 3.13 Diagnostics

| Sub-type | Status | Linked? | Tracking? | Purpose | Notes |
|---|---|---|---|---|---|
| **Crash Data** | **[HOWARD DECISION]** | — | No | App Functionality, Analytics | If Sentry (or Apple's standard MetricKit-based crash reporting) is shipped, mark **Collected, Linked No, purpose App Functionality**. As of today: **Not Collected** — no crash SDK is present in the codebase. Apple's automatic device-level crash reporting that users opt into in iOS Settings is **not** considered collection by the app and does not need to be declared. |
| Performance Data | **[HOWARD DECISION]** | — | No | Analytics | Same answer as Crash Data — depends on whether Sentry/equivalent is enabled. |
| Other Diagnostic Data | Not Collected | — | — | — | |

### 3.14 Surroundings

**Not Collected.**

### 3.15 Body

**Not Collected.**

### 3.16 Other Data

**Not Collected** unless something new is added before submission.

---

## 4. Tracking Section — App Tracking Transparency (ATT)

| Question | Answer |
|---|---|
| Does this app track users? | **No** |
| Does this app prompt for ATT (`AppTrackingTransparency`)? | **No prompt needed** |

Reasoning: Apple defines "tracking" narrowly — linking user/device data from this app with third-party data for advertising or sharing it with a data broker. We do neither. We do not use IDFA. AI providers process user content for service delivery only; that is not "tracking" under Apple's definition.

**Action:** Do **not** call `ATTrackingManager.requestTrackingAuthorization`. Do **not** include `NSUserTrackingUsageDescription` in `Info.plist`. Including either when not needed has caused rejections.

---

## 5. Third-Party SDKs — Quick Audit

| SDK | Used? | What it sees | App Store Connect impact |
|---|---|---|---|
| **Apple In-App Purchase (StoreKit)** | Yes (iOS subscriptions) | Purchase events, Apple-side account info | Disclosed under Purchase History → Linked. Apple's own collection is on Apple's labels, not ours. |
| **Stripe** | Web only (not iOS) | Card details on web checkout | Not exposed on the iOS build. No iOS-side label change. |
| **Google Gemini API (@genkit-ai/googleai, @google/genai)** | Yes, when user invokes AI | Outline text the user explicitly sends | Disclosed under User Content → Other User Content → Not Linked. |
| **Anthropic API** | Available via BYOK only | Whatever the user sends through Claude | BYOK key entered by user — we never route through our servers. Disclose in Privacy Policy; same Other User Content bucket. |
| **OpenAI API** | Yes, for podcast TTS | Script text the user generates | Disclosed under User Content → Other User Content → Not Linked. |
| **AssemblyAI** | Yes, for transcription | Audio the user explicitly transcribes | Disclosed under User Content → Audio Data → Not Linked. |
| **Ollama (local)** | Yes (Mac desktop only) | Stays on-device, no network call | No App Store label impact. iOS does not ship Ollama. |
| **Firebase** | **[VERIFY]** Package is in `package.json` but not used in `src/`. | None today | If removed from the build, no label needed. If kept, audit what it actually collects before submission. |
| **Sentry / crash reporter** | **[HOWARD DECISION]** Not currently present. | Crash stack traces, app version, anonymized device info | If added, mark Diagnostics → Crash Data → Collected, Not Linked, purpose App Functionality. |
| **Vercel Analytics** | **[HOWARD DECISION]** Not enabled in code today. | Pageview pings on web only | If enabled on web only, does not affect the iOS label. If added to the Capacitor build, mark Usage Data → Product Interaction → Not Linked, Analytics. |

---

## 6. Privacy Policy URL

App Store Connect requires a Privacy Policy URL on the app's product page. Use the production URL for the page rendered by `src/app/privacy/page.tsx`, e.g. `https://2ndbrainware.com/privacy`. **[VERIFY]** Confirm DNS and that the page is reachable from outside the dev environment before submission.

---

## 7. Pre-Submission Checklist for Howard

- [ ] Decide whether the v1 iOS app requires an account. If no account → drop Email, User ID, Purchase History rows from "Collected" and submit the simpler label.
- [ ] Decide whether to ship Sentry (or equivalent) in v1. Update Diagnostics rows accordingly.
- [ ] Decide whether to enable Vercel Analytics or any other usage analytics. Update Usage Data row accordingly.
- [ ] Confirm whether image and audio AI features are in the v1 iOS build. Update Photos/Videos and Audio Data rows accordingly.
- [ ] Confirm the `firebase` package is either removed from the iOS build or audited for what it touches.
- [ ] Confirm `NSUserTrackingUsageDescription` is **not** in `Info.plist`.
- [ ] Confirm production Privacy Policy URL renders before submission.
- [ ] Walk through every row in App Store Connect with this document open and click through one-by-one.
