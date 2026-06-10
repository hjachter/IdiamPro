# IdiamPro / SecondBrainWare — AI Consent Reviewer Notes

For Apple App Review (Guideline 5.1.2(i)).

## 1. What this app does with AI

IdiamPro is an outliner. When the user explicitly invokes an AI feature, the relevant outline text (or audio recording) is sent to a third-party AI provider, processed, and the result is returned to the device. Nothing is sent in the background. Providers used:

- **Google Gemini** — outline generation, content expansion, summarization, knowledge/help chat, source extraction.
- **OpenAI** — text-to-speech for the podcast feature.
- **AssemblyAI** — audio transcription.

Outlines remain stored locally on the device as `.idm` files. No user accounts, no server-side storage, no analytics, no ad tracking, no training of AI models on user content.

## 2. Consent flow

The first time a user triggers any AI feature (e.g. "Generate outline from topic", "Expand content", "Ingest source", "Bulk research"), the **AI Data Processing Consent** dialog appears (`AIConsentDialog`). It lists the three providers and what each receives, and links to the Privacy Policy.

The dialog offers two buttons:

- **I Agree** — consent is recorded and the AI action the user just initiated runs.
- **Decline** — opens a confirmation screen titled "AI Features Will Be Disabled" that enumerates which features become unavailable and reminds the user that all non-AI features keep working. The user must press **Decline AI Features** again to confirm, or **Go Back** to return to the consent screen.

Closing the dialog with the X or Escape is treated as a decline.

## 3. Where consent state lives

Consent is stored in browser/Electron `localStorage` under the key **`aiDataConsent`**:

- Value `granted` — AI features are enabled.
- Value `revoked` — user explicitly turned them off; AI features blocked.
- Key absent — never answered; the consent dialog will appear on next AI action.

## 4. How users revoke or re-grant

Open **Settings > Data & Privacy**. A switch labeled **"Allow AI data processing"** toggles consent. Turning it off writes `revoked`; turning it on writes `granted`. A toast confirms the change. The switch is always visible regardless of previous state.

Behavior on revoke: every AI entry point is gated by a `checkAiConsent()` call before any network request is built. Once consent is `revoked` (or absent), the gate blocks the request and re-opens the consent dialog. A request already in flight at the moment of revocation will complete (the gate is checked at action start, not mid-stream); no new requests can begin.

## 5. Test steps for reviewers

1. Install the app fresh (or clear site data / reset).
2. Open any outline and select a node.
3. From the AI menu or toolbar, choose **"Generate outline from topic"** (or any AI command). Enter a topic and submit.
4. Expected: the **AI Data Processing Consent** dialog appears listing Google Gemini, OpenAI, and AssemblyAI, with a Privacy Policy link.
5. Click **Decline** — a second screen lists the AI features that will be disabled.
   a. Click **Go Back** to return to the consent screen, or
   b. Click **Decline AI Features** to confirm. The dialog closes and the AI request does not run.
6. Re-trigger the same AI action. The consent dialog reappears.
7. Click **I Agree**. The dialog closes and the AI action proceeds.
8. Trigger another AI feature — no dialog appears (consent persists).

## 6. Disabling AI entirely

Open **Settings > Data & Privacy** and turn the **"Allow AI data processing"** switch off. Confirm via toast. Now trigger any AI feature: the consent dialog reappears and no data is sent. All non-AI functionality (outlining, editing, exporting, search, manual content creation) continues to work normally.

## 7. Privacy Policy

In-app and on the web at **`/privacy`** (e.g. `https://2ndbrainware.com/privacy`). The policy itemizes each provider, what data is sent, retention, and explicitly states that user content is not used to train models, sold, or shared.
