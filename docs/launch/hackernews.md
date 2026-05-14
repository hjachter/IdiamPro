# Hacker News — Show HN

**Launch date:** {{LAUNCH_DATE}}
**Submitter:** Howard Jachter
**URLs:** Web — {{WEB_URL}} · iOS — {{APP_STORE_URL}} · macOS — {{DMG_URL}}

---

## Title (under 80 chars)

**Primary (77 chars):**
> Show HN: SecondBrainWare – An AI-native outliner with BYOK, no tracking

**Alternates:**

(72 chars)
> Show HN: SecondBrainWare – Outliner where AI synthesizes, not just chats

(78 chars)
> Show HN: SecondBrainWare – Cross-platform second brain, bring your own key

(70 chars)
> Show HN: SecondBrainWare – Outliner + AI synthesis, Mac/iOS/web

---

## Body (300-400 words)

Hi HN — I'm Howard, solo founder. SecondBrainWare is an outliner with AI built into every node, shipping on macOS, iOS, and web today.

The honest pitch: most "AI note apps" are a note app with a chat sidebar bolted on. I wanted the opposite — a tool where AI is structural, not conversational. You hit one keystroke from anywhere to capture a thought. The system silently tags it. When you import a PDF, a YouTube transcript, or an exported Claude/ChatGPT/Gemini conversation, AI doesn't dump it at the bottom — it folds it into your existing outline hierarchy with source tracking. Outlines can collapse and expand like DNA: the whole knowledge base is there, but you only see what's relevant right now. I've tested it on outlines with 66,000+ nodes without obvious slowdown.

**What's real today:**
- Outliner with unlimited depth, 20 node types, rich text, Mermaid diagrams
- Quick Capture (Cmd+Shift+I) and a Second Brain Dashboard so capture doesn't go write-only
- AI auto-tagging on save
- Multi-source import: PDF, YouTube, web, audio (AssemblyAI), images (OCR), Google Docs
- Mind-map and flowchart generation from any subtree
- Local AI via Ollama (defaults to Gemma 4) — fully offline, no cloud round-trip
- PDF export and outline-to-website generation (the marketing site is generated from an outline)
- Mac (Electron DMG), iOS (App Store), web (Vercel) — one subscription across all three

**What's not done yet, in order of honesty:**
- Windows and Linux: Electron build configs are in place but I haven't shipped distributable builds
- Android: not scaffolded yet; the Capacitor architecture should make it tractable
- LIVE BOOKS (refresh any outline against the latest internet content): designed, BYOK pricing decided, not yet built. This is the next major feature.
- Real-time collaboration: not in scope for v1
- Testimonials: I'm a solo founder shipping his first version; there aren't any yet

**Stack:** Next.js, Genkit, Tiptap editor, Capacitor for iOS, Electron for desktop, Ollama for local AI. BYOK supported for Anthropic, OpenAI, Google.

**On privacy:** no tracking pixels, no data monetization, AI consent is opt-in with a two-step decline flow. If you bring your own API key, IdiamPro never touches your vendor billing.

**Direct comparisons I expect:**
- vs. Notion AI — Notion is a database/page tool; this is an outliner first, with AI as a synthesis primitive instead of a chat box
- vs. Obsidian — Obsidian is local-first markdown with a plugin ecosystem; this is opinionated about outline structure and ships AI in the box rather than as plugins
- vs. Roam/Logseq — bidirectional links are not a focus here; hierarchical synthesis and multi-source import are

Pricing is on the site. Free tier is real (no card, no trial clock). Paid is a flat monthly fee; BYOK is supported on paid so you control vendor costs directly.

I'd love brutal feedback — especially on the value prop vs. existing tools, what would make you actually switch, and where the UX feels off. AMA on architecture, the AI consent flow, or the LIVE BOOKS design.

— Howard
