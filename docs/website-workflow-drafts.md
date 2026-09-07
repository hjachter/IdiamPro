# Website Workflow Copy — Review Drafts (P12)

**For Howard's review. Nothing here is live. Every block below is proposed copy — approve, edit, or reject workflow-by-workflow.**

Date: 2026-09-06
Scope: landing, features, capabilities, guide, pricing, FAQ, upgrade pages.

---

## Audit summary — what the site tells today vs. what shipped

| Shipped feature | On the site today? |
|---|---|
| Proposed Changes mode (AI shows every edit before it happens) | **Missing as a story.** Only two passing bullets on Use Cases ("preview and approve each change") and one line in the Guide's Translate entry. No card, no section, no FAQ. Our flagship trust feature is invisible. |
| Premium AI models on your key (Claude / GPT / Groq / Mistral) | Present on Pricing, FAQ, Upgrade. **But** the "default model stays current" point is nowhere, and the Upgrade page still says "Unlimited AI, free forever" — which violates our no-absolute-guarantees rule. |
| Podcast export (two-host, plays immediately, near-human free voices) | Present but stale: no "two hosts," no "plays the moment it's done," no mention that the free built-in voices are surprisingly natural. |
| Agent-safe outlines / outside assistants (MCP) | **Missing entirely.** Zero mentions on any page. |
| PDF export quality (title page, contents, index) | **Missing.** FAQ just lists "PDF" among 23 formats. Nowhere does the site say our PDF is a real document, not a dump. |

---

## THE CENTERPIECE — new "You stay in control" trust section

**Recommendation: this belongs on the HOMEPAGE**, as a full band between "Seeing is believing" and "What's new." Trust is a top-three buying reason for professionals putting their life's thinking into an AI tool, and the homepage is where that decision forms. The Capabilities page then gets matching short cards under Foundations (drafted below), so the story is discoverable both places.

### Proposed section copy (in full)

**Eyebrow:** You stay in control

**Headline:**
> AI powerful enough to reshape your thinking. Polite enough to ask first.

**Intro line:**
> Your outline is your life's work. So in IdeaM, AI proposes — you decide. Every time.

**Card 1 — Proposed Changes**
> **See every change before it happens.**
> When AI wants to edit your outline, nothing just happens to you. Deletions appear struck through — before anything is deleted. Additions arrive as pending items. Rewrites show up side by side, before and after. Big operations come with per-item checkboxes, so you approve exactly what you want and discard the rest. And everything stays undoable. It's the review you'd give a trusted editor — built right into the outline.

**Card 2 — Your AI assistant, on a visitor's pass**
> **Outside assistants can look — only you can touch.**
> Connect an AI assistant like Claude Desktop, and it can read and search your outlines to help you think. But it can only *suggest* changes — every edit comes back to you for approval inside IdeaM. Until you say yes, your files stay exactly as you left them.

**Card 3 — Your data, in plain sight**
> **Your files, on your device, in open formats.**
> Outlines live as plain files on your own computer, with 23 export formats and no lock-in. Back them up, sync them, walk away with them — they're yours.

**Closing line:**
> The market is discovering that AI you can inspect beats AI you have to trust blindly. We built IdeaM that way from the start.

**Rationale:** bundles the three trust stories into one memorable band; frames "inspectable AI" as our native strength without naming competitors.

🟠 QUESTION FOR HOWARD: Is "Proposed Changes" the customer-facing name you want, or would you prefer something like "AI that asks first"? All drafts below use "Proposed Changes."

🟠 QUESTION FOR HOWARD: OK to name Claude Desktop on the public site as the example assistant?

---

## Page-by-page drafts

### 1. Homepage (`/`)

**(a) Now:** Hero + idea-development thesis + showcase gallery + "What's new" (social, email, tags, drive) + capabilities CTA. No trust story, no podcast card, no assistant story.

**(b) Proposed additions:**

**(i)** The "You stay in control" band above (placement: between "Seeing is believing" and "What's new").

**(ii)** New card in the "What's new" grid, badge **New**:
> **AI edits you can see coming**
> Ask AI to reorganize, trim, or rewrite — and watch every proposed change appear in your outline before it happens: deletions struck through, additions pending, rewrites shown before-and-after. Approve, adjust, or discard. Nothing changes without your say-so, and everything stays undoable.

**(iii)** New card in the "What's new" grid, badge **New**:
> **Turn any outline into a podcast**
> Pick a branch and get a natural two-host conversation about your ideas — playing the moment it's done. Free voices built into your Mac sound surprisingly close to human; plug in your own key when you want studio-quality narration, pay-as-you-go.

**(c) Where:** trust band as a new section; two cards appended to the existing What's-new grid (grid grows 4 → 6).

**(d) Rationale:** the homepage currently leads with power; these add the trust counterweight and our most delightful new output.

---

### 2. Capabilities page (`/capabilities`)

**(a) Now:** Import / Research / Develop / Produce / Publish / Foundations / Coming soon. Podcast card reads "narrated audio episode in real voices." No Proposed Changes, no assistant/MCP, no PDF card.

**(b) Proposed copy:**

**(i)** New card under **Develop the idea** (or Foundations — your call):
> **Proposed Changes** — AI shows you every edit before it happens; you approve, adjust, or discard.

**(ii)** New card under **Foundations**:
> **Agent-Safe Outlines** — Outside AI assistants can read and search your outlines, but only suggest changes. You approve everything, in IdeaM.

**(iii)** Updated **Make a Podcast** card (replaces current line):
> **Make a Podcast** — Turn a chapter into a two-host conversation that plays the moment it's done.

**(iv)** New card under **Publish it (Export)**:
> **Export a Real Book-Quality PDF** — Not a text dump: a title page, a table of contents, and an index, generated from your outline and ready to share.

**(c) Where:** as listed; each card anchors to a matching new Guide section (drafted next).

**(d) Rationale:** Capabilities is the "everything on one page" surface — a shipped capability that isn't listed here effectively doesn't exist to a prospect.

🟠 QUESTION FOR HOWARD: Is the assistant connection (MCP) something a user can actually set up today, or should its card carry an "At launch" badge until setup instructions ship?

---

### 3. Guide page (`/guide`)

**(a) Now:** Detailed how-to per capability. Podcast entry covers voices honestly; Translate mentions "preview-and-approve safety" in passing. No Proposed Changes or assistant sections; no PDF export entry.

**(b) Proposed copy:**

**(i)** New section **"Proposed Changes — approve every AI edit"**:
> When you ask AI to change your outline — trim it, reorganize it, rewrite a section — IdeaM never just does it. Instead you see the proposal in place: deletions struck through, additions as pending items, rewrites shown before-and-after. Bulk operations list every affected item with its own checkbox. Approve it all, cherry-pick, or discard — and even after approving, Undo brings everything back.

**(ii)** New section **"Connect your AI assistant"**:
> Connect an assistant like Claude Desktop and it can read and search your outlines to answer questions and do research with your own material. It cannot edit your files — it can only propose changes, which appear in IdeaM for your approval like any other Proposed Change. Your outlines stay untouched until you say otherwise.

**(iii)** New section **"Export as PDF"**:
> Export any outline as a polished PDF with a title page, a table of contents, and an index — built automatically from your structure. Big outlines export fast, you can cancel anytime, and the finished PDF opens for you immediately.

**(iv)** Podcast section, add one line:
> Your podcast is a two-host conversation, not a monotone read-through — and it starts playing the moment it's ready.

**(c) Where:** (i) and (ii) under a new or existing trust-adjacent grouping; (iii) under Publish/Export; (iv) appended to the existing podcast entry.

**(d) Rationale:** guide anchors are what the capability cards link to; each new card needs its landing section.

---

### 4. Pricing page (`/pricing`)

**(a) Now:** Honest, on-message BYOK framing ("everyday use is typically free… never a surprise from us"). Good. Missing only the model-freshness point.

**(b) Proposed addition** — one sentence appended to the "What does bringing your own key cost?" reassurance box:
> And the built-in default never goes stale: as Google ships newer Gemini models, IdeaM keeps your default current automatically — no action from you, no change from us.

**(c) Where:** end of the BYOK cost-reassurance paragraph.

**(d) Rationale:** "your tool improves underneath you at no change from us" is a strong, honest retention message; one sentence carries it.

---

### 5. FAQ page (`/faq`)

**(a) Now:** 7 questions; nothing on AI safety-of-edits, assistants, or PDF quality.

**(b) Proposed copy:**

**(i)** New Q&A:
> **Q: Will AI ever change my outline without asking?**
> A: No. IdeaM shows you every proposed edit before it happens — deletions struck through, additions as pending items, rewrites side by side as before-and-after. Bulk changes come with per-item checkboxes. You approve, adjust, or discard, and even approved changes stay undoable. AI drafts; you decide.

**(ii)** New Q&A:
> **Q: Can other AI assistants work with my outlines?**
> A: Yes — safely. Connect an assistant like Claude Desktop and it can read and search your outlines to help you research and think. It can only suggest changes, though: every edit comes to you for approval inside IdeaM, and until you approve, your files stay exactly as they were.

**(iii)** Append to "What AI models do you use?":
> The built-in default also stays current: as newer Gemini models ship, IdeaM upgrades the default automatically, with no change in what you pay us.

**(iv)** Amend "Can I export my work?" — after the format list, add:
> PDF exports are real documents, not text dumps — each one gets a title page, a table of contents, and an index, built from your outline automatically.

**(c) Where:** as listed, new Q&As after the privacy question.

**(d) Rationale:** these are exactly the questions a cautious professional asks before trusting us with their thinking.

---

### 6. Upgrade page (`/upgrade`)

🟠 **(a) Now — needs your eyes:** the Free plan tagline reads "**Unlimited AI, free forever — bring your own key**," and the page intro repeats "Get unlimited AI, free forever." This is the exact wording our no-guarantees rule forbids (a user on a premium model can run up a real bill on their own key). The Pricing page already uses the honest framing; Upgrade lags behind it.

**(b) Proposed replacements:**

Tagline:
> Your key, your control — everyday use typically free.

Intro sentence:
> Bring your own key and you pay your provider directly, pay-as-you-go — everyday use is typically free, anything heavier is your call, and there are never surprises from us.

**(c) Where:** Free (BYOK) plan card tagline + page intro paragraph.

**(d) Rationale:** brings Upgrade in line with the codified honest-cost framing already live on Pricing. I recommend this one ship promptly once you approve wording.

---

### 7. Features page (`/features`) — light touch

**(a) Now:** Strong incubator story; comparison table; podcast row says "Choose voices, style, and length." No trust row.

**(b) Proposed:** add one bullet to the "What IdeaM does differently" checklist:
> **AI you can inspect** — every AI edit is shown before it happens; approve, adjust, or discard.

And one row to the comparison table: "Preview-and-approve AI edits" — IdeaM ✓, others ✗.

**(c) Where:** competitive-positioning section.

**(d) Rationale:** the comparison table is where head-to-head shoppers land; inspectable AI is a differentiator worth a row.

🟠 QUESTION FOR HOWARD: comparison-table claims about Notion/Obsidian/Roam should stay defensible — are you comfortable asserting none of them offers preview-and-approve AI edits, or should I soften to a checklist bullet only?

---

## Open questions for Howard (collected)

1. Customer-facing name: "Proposed Changes" — keep, or rename?
2. Trust section home: homepage (my recommendation) or features page?
3. OK to name Claude Desktop on the public site?
4. MCP/assistant connection: user-settable today, or badge it "At launch"?
5. Upgrade page "Unlimited AI, free forever": approve the replacement wording so it can ship promptly?
6. Comparison-table row for preview-and-approve edits: assert it, or soften?
7. "ElevenLabs voices coming soon" still appears on Pricing/FAQ/Upgrade — still accurate?
8. PDF title-page/contents/index: shipped on Mac — also true on iPad/iPhone/web, or should the copy scope it?
