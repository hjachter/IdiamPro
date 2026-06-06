'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { CircleHelp, Send, Sparkles, User, Loader2, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSpeechToText } from '@/hooks/use-speech-to-text';
import { useInputModePreference } from '@/lib/use-input-mode-preference';
import { getMicPermissionHelp } from '@/lib/platform-help';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import { useAIUsageGate } from '@/lib/use-ai-usage-gate';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface HelpChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// App context for AI to understand what IdiamPro does
const APP_CONTEXT = `You are a helpful assistant for IdiamPro, a professional outlining application with AI-powered features.

KEY FEATURES:
- Hierarchical outlining with drag & drop, indent/outdent
- AI-powered outline generation from topics
- Research & Import: Merge multiple sources (YouTube, PDFs, web pages, images, docs, audio, video, outline files) into unified outlines
- Rich content editor with markdown support, clipboard image paste (Cmd+V), drag-and-drop images, link paste (URLs auto-link, rich HTML links preserved)
- Import File button (paperclip icon): import any file from your device. Auto-detects type — images embed inline, videos embed with player controls, audio files embed with native audio player, PDFs show a dialog to extract text or insert as link, other files insert as download links
- Multi-select nodes for bulk operations (delete, change color, add tags)
- Node multi-select (desktop): Cmd/Ctrl+Click toggles a node in the selection, Shift+Click selects a range
- Node multi-select (mobile): Long-press any node in the outline (~500ms, no finger movement) to enter multi-select mode; once entered, plain taps on other nodes add/remove them from the selection. Provides light haptic feedback on entry where supported. Press Escape (desktop) or use the toolbar Cancel button to exit.
- Sidebar multi-select (desktop): Cmd/Ctrl+Click or Shift+Click outlines in the sidebar to select multiple, then bulk delete
- Sidebar multi-select (mobile): Long-press any outline in the mobile sidebar sheet to enter select mode, then tap additional outlines to toggle them; a top bar provides Cancel and Delete
- Sidebar rename (mobile): Tap the ⋯ menu on the right of any outline row and choose Rename for an inline rename field (Enter saves, Escape cancels)
- Sidebar search: Type in the search field below the Outlines header to filter outlines by name (works on desktop and mobile)
- Tags and color-coding for organization
- Automatic backups (Desktop): Every save creates a timestamped backup in the backups/ folder. Throttled to one per 5 minutes per outline. Last 10 backups kept per outline. Recover by renaming a backup file in Finder.
- Cross-platform: macOS Desktop (Electron), iOS (Capacitor), and Web (Vercel) are actively shipped. Windows and Linux Electron builds are configured. Android via Capacitor is on the roadmap. See the Platform Rosetta Stone for input mappings across all platforms.
- File storage: iCloud Drive, Dropbox, Google Drive, local folders
- Google Docs/Sheets/Slides/Maps embedding via Insert menu
- Speech-to-text recording in the content pane via Web Speech API
- Input mode preference (Settings > Preferences > Input mode): three options — "Type" (default, keyboard only; mic button still available for ad-hoc dictation), "Voice" (free dictation, no auto-start), and "Voice + auto-start" (the mic begins listening automatically the moment you open the Cmd+K command palette / Ask AI or the Help chat — ideal for hands-free use; falls back silently if the browser doesn't support Web Speech recognition).
- Export/Share: Select a node and use Export menu (BookUp icon in toolbar) > "Share Subtree as…" — or right-click any node > "Share Subtree As…" for the same dialog. Formats include PDF, Markdown, Plain Text, HTML (collapsible webpage), Interactive Outline (read-only IdiamPro-style viewer with sidebar navigation, search, dark/light mode), Website (8 professional templates: Marketing, Informational, Documentation, Portfolio, Event, Educational, Blog, Personal), Podcast (AI-generated audio), OPML, Obsidian (wiki-links), CSV, JSON Tree.
- Outline management: The sidebar (panel-toggle button at top-left of toolbar) is the sole path for switching, creating, renaming, deleting, and searching outlines. The toolbar shows the current outline name as a read-only title plus three small icon buttons: Import (BookDown), Export (BookUp), and a Wrench (residual admin actions). Import menu contains: Research & Import, Import Outline, Restore All Outlines. Export menu contains: Share Subtree as…, Export Current Outline, Backup All Outlines. Wrench menu contains: Refresh User Guide.
- Import: Multi-format import via the toolbar Import menu (BookDown icon) > "Import Outline". Supports Markdown (.md - heading hierarchy), Plain Text (.txt - indentation), OPML (.opml - standard outline XML), JSON/IDM (native format). Drag-and-drop or browse to select. Auto-detects format.
- Canvas/Drawing nodes (Excalidraw-based): Right-click > Set Type > Canvas
- Spreadsheet nodes (Fortune Sheet): Right-click > Set Type > Spreadsheet

CONTENT EDITOR:
- Rich text: Bold (Cmd+B), Italic (Cmd+I), Strikethrough, Headings (H1-H3)
- Lists: Ordered, unordered, and checklist lists
- Code blocks
- Undo (Cmd+Z), Redo (Cmd+Shift+Z)
- Touch-accessible toolbar: The content pane toolbar has Undo/Redo buttons and Bullet List, Numbered List, and Checklist buttons at the left end — one-tap access on iPhone, iPad, and desktop without needing the right-click menu.
- Floating formatting toolbar: Select text in the editor and a small floating menu appears with Bold, Italic, Strikethrough, Inline Code, and Heading 1/2/3 buttons. Active formatting is highlighted. Works on touch and desktop.
- Google Docs/Sheets/Slides/Maps embedding via Insert menu (paste URL)
- Speech-to-text: Click microphone button, speak, text is transcribed locally

KEYBOARD SHORTCUTS:
- Enter/Return: Create new sibling node
- Tab: Indent node
- Shift+Tab: Outdent node
- Cmd+K: Command palette (also: Expand All, Collapse All)
- Cmd+E: Expand All — recursive open of the selected subtree (or the whole outline if nothing is selected). Also a toolbar button (down-chevron icon).
- Cmd+Shift+E: Collapse All — recursive close of the selected subtree (or the whole outline if nothing is selected). Also a toolbar button (up-chevron icon).
- Single-chevron click on a node: toggles ONLY that node and preserves each descendant's previous open/closed state. Use this when you want a node to remember how it was last left.
- Right-click a node: 'Expand All' and 'Collapse All' menu items operate on that node's subtree.
- Cmd+B: Toggle sidebar (platform convention; Second Brain is accessed via toolbar Brain button)
- Cmd+D: Duplicate node
- Delete/Backspace: Delete selected node (with confirmation if enabled)
- Cmd+Shift+F: Focus Mode (isolate subtree, Esc to exit). Also available as a Focus button in the outline toolbar — highlights when active, disabled when no node is selected.
- Ctrl+F (Cmd+F on Mac): Search the outline as a view-shaper. Search reshapes the tree so only matches plus the chain of ancestors leading to them stay expanded; every other branch is automatically collapsed. The reshaped state persists after the search input closes (Escape leaves the tree as the last search left it) and only changes again on the next search, a chevron click, Expand/Collapse All, or an edit. The funnel icon toggles "Search only open nodes" — when on, the next search walks only currently visible nodes, letting you chain queries as a logical AND ("alpha" then "beta" -> nodes containing both). Filter toggles let you search node names only, content only, or both. Scope toggle picks current outline or all outlines.
- Up/Down arrows: Navigate between nodes
- Left/Right arrows: Collapse/expand nodes
- Double-click: Edit node name
- Cmd+Click: Multi-select nodes
- Cmd+Click / Shift+Click in sidebar: Select multiple outlines for bulk delete

GESTURES (iOS):
- Tap: Select node
- Tap again (on selected): Edit name
- Double-tap: Create sibling node
- Swipe right: Indent
- Swipe left: Outdent
- Long-press (still finger, ~500ms): Enter multi-select mode (this node becomes the first selection). Subsequent plain taps toggle other nodes in/out of selection.
- Long-press + drag: Move node (drag and drop)
- Long-press (browser default): System context menu may also appear for long-press gestures

NODE CONTEXT MENU (right-click / long-press):
- Trimmed to essentials: Add Sibling, Rename, Collapse/Expand, AI actions, Share, Save to Second Brain, Copy/Cut/Paste/Duplicate, Delete, and Properties...
- Type, Color, and Tags now live in a single Properties... dialog (one item at the bottom of the context menu) instead of three separate submenus.
- Pin/star functionality has been removed. There is no longer a star icon on node rows.

AI FEATURES:
- Generate Subtree from Topic: AI menu > Generate Subtree. Topic is pre-filled with the selected node's name (editable). Result is inserted as children of the selected node. (Free tier: 10/month, Premium: 100/month)
- Expand with AI: Content toolbar button (was "Ask AI"). Writes, expands, summarizes, or reformats the current node's content. (Free: 50/month, Premium: 500/month)
- Create Content for Descendants: Right-click a parent > generates content for all children at once
- Research & Import synthesis (Free: 3 sources, Premium: 50+ sources). Nodes always have short names (2-6 words) as tree labels with detailed content in the content pane, even in comprehensive mode. Merging into an existing outline integrates content under shared themes rather than appending separately.
- Knowledge Chat: Query your outlines with natural language. AI Features menu > Knowledge Chat, or Second Brain menu > Search Second Brain. Three modes: Current Outline, All Outlines, and Second Brain. AI answers based only on your outline content, referencing specific sections. Responses stream in word-by-word.
- Second Brain: A special always-present outline (🧠 icon) for accumulating everything you want to remember. Save any node to it via right-click > "Save to Second Brain" or the brain menu. Open it from the Brain toolbar menu (no shortcut — Cmd+B is reserved for the sidebar). Search it via Knowledge Chat's Second Brain mode. Keyboard shortcuts: ⌘⇧B (save selection), ⌘⇧S (search). Cannot be deleted or renamed.
- Quick Capture (Cmd+Shift+I, or [Brain menu] > Quick Capture): Opens a floating dialog from anywhere. Type or paste any thought, hit Enter, it lands in a "📥 Inbox" section at the top of Second Brain. No need to be inside any outline. As of 2026-06-06 the standalone Inbox toolbar button is gone — Quick Capture lives inside the Brain dropdown alongside Open Second Brain and Search Second Brain, in cognitive order [open → capture → save → search].
- Second Brain Dashboard: Brain menu > View Dashboard. Shows total entries, recent saves (last 7 days), a "revisit pile" of older entries, and top tags. Click any entry to jump to it.
- Smart Auto-Tagging: When you save anything to Second Brain (including via Quick Capture), AI suggests 1-3 short topical tags and applies them automatically. Tags are stored as node metadata and shown in the dashboard. You can edit tags later via the existing tag UI.
- Describe with AI: Every embedded image has a "Describe with AI" button. Uses Gemma 4 vision (local) or Gemini (cloud) to generate a description. When local, no image data leaves your device.
- Local AI / Ollama: Settings > AI Provider. Choose Cloud, Local (Ollama on localhost:11434), or Auto. Recommended models: gemma4:e4b (multimodal, 4GB RAM), gemma4:26b (16GB+ RAM, fastest large model), gemma4:31b (24GB+ RAM, max quality). Legacy: llama3.2 (3GB RAM, low-spec systems). Requires Ollama 0.20+ for Gemma 4 support.
- AI Data Consent: On first use of any AI feature, a consent dialog appears explaining that data is sent to Google Gemini, OpenAI, and AssemblyAI. Users must agree before AI features work. If you click Decline, a warning screen lists all features that will be disabled and asks you to confirm. Consent can be revoked in Settings > Data & Privacy. Privacy policy available at /privacy.
- Privacy & Data (GDPR/CCPA): Settings > Privacy & Data has two buttons. "Export my data" generates a .zip archive containing every outline (as .idm files), localStorage preferences, all stored AI API keys, and your AI consent state — saved via native dialog on desktop, Share sheet on iOS, or browser download on web. "Delete all my data" requires a two-step confirmation (warning dialog, then type DELETE) and permanently wipes outlines, settings, API keys, and consent state from this device, then reloads the app to its fresh-install state. Both work even with AI consent revoked. Neither touches anything outside IdiamPro's data scope.
- Pending Import Recovery (Desktop): If import times out or app closes, result is saved and recovery dialog appears on next launch
- Unmerge: After merging research into an existing outline, an Unmerge button (orange circular arrow) appears in the toolbar right after the Research & Import button. Click it to restore the outline to its pre-merge state. The button persists until you click it or perform another merge. You can freely edit the outline and still unmerge later. The backup survives app restarts. Only the most recent merge can be unmerged.
- Generate Podcast: Right-click any node > "Generate Podcast". Choose a style (Two-Host, Narrator, Interview, Debate), assign voices, pick a length (Brief/Standard/Detailed), and select audio quality (Standard/HD). AI generates a script via Gemini, then synthesizes speech via OpenAI TTS. Preview the audio in-app and save as MP3. All preferences (style, voices, length, quality) are remembered across sessions. Requires OPENAI_API_KEY.
- Refresh from Web (the web-refresh feature, internal code name LIVE BOOKS): Manually refresh a node and all its descendants against the latest information so documents don't go stale. Open it from the Import menu (BookDown icon in the toolbar) > "Refresh from Web" (moved here 2026-06-06 — it brings external web content INTO existing nodes, so it fits the Import metaphor), the Command Palette, or Cmd/Ctrl+Shift+R (select the root node to refresh the entire outline). Choose Merge & augment (default — keep accurate content, fix outdated parts, fold in new info) or Overwrite/regenerate. By default every change is shown in a side-by-side preview with per-node accept/reject and nothing is applied until you approve; "Apply automatically without previewing" is an explicit opt-in that is off by default. Nodes you edited by hand are auto-skipped to protect your writing, with a per-node "Include anyway" override. Every refreshed node stores its sources and the model used — a compact "Sources" chip on the node shows the citations and attribution (e.g. "Refreshed with Gemini 3.5 Flash"), and this travels with the outline through save/export. Cloud AI uses live web search for real citations; local AI uses the model's built-in knowledge (no internet) and says so honestly rather than inventing sources. Refresh from Web is personal/local — it only changes your own copy after approval. It is built on a reusable transform engine that the Translate feature also uses.
- Reformat with AI (single-node content reformat): Reformat the content in a node by describing the format you want in plain language ("turn into a bulleted list", "make each line a heading", "convert to a markdown table", "tighten spacing and remove empty lines", "add headings where it makes sense", "convert to clean prose"). Open from the Smart Tools menu > "Reformat with AI…", the editor context menu > "Reformat with AI…", the Command Palette, or — when text is selected in the content editor — the violet wand icon at the LEFT END of the floating formatting toolbar (bubble menu). The wand sits at the first position of the bubble menu with a violet accent and a small "Most Powerful" badge so it's the eye-magnet of the toolbar (Howard 2026-06-05). Scope: with no selection it reformats the whole node; with a selection it reformats just the selected text. Click a chip below the input to fill it in with an example instruction. The AI returns a side-by-side before/after preview; Apply commits the change, Modify lets you tweak the instruction without burning a second generation request after re-running, Cancel discards. Optional "Use local AI (Ollama)" tickbox keeps the reformat on-device. One reformat = ONE generation against the monthly cap, regardless of content length. Available on every tier (Free trial, Student, Pro).
- Translate this section (language translation, #52): Translate any selected node and its descendants into another language with the same preview-and-approve safety as Refresh from Web. Open from the Smart Tools menu > "Translate this section" or from the Command Palette. The language dropdown is ordered for IdiamPro's globally-distributed-team users — Chinese (Simplified), Portuguese (Brazilian), Spanish, French, Japanese, Korean, German, Italian, Hindi appear first; a wider catalog follows. There is NO default language — the user must pick one before the Translate button enables. Tick "Use local AI (Ollama)" to keep the translation entirely on-device. Click Translate & preview: each node is shown side-by-side with the original. Reject any you don't want, then click Apply to commit. Formatting (headings, lists, bold, links) is preserved; proper nouns and code stay as-is. Nodes you edited by hand are auto-skipped with the same Include-anyway override. One Translate counts as ONE generation against the usage cap, regardless of how many nodes are in the subtree.
- Discovery Hints ("Did You Know?" tips, 2026-06-05): The app surfaces sticky discovery cards in the lower-right corner the first time a new user reaches a feature worth knowing about. Examples: the first text selection in the editor surfaces a "Reformat with AI is here" tip (and, staggered 6s later, a "Smart Tools = your AI toolkit" tip); the first time you create an outline surfaces "Link one outline to another" and "Import and Export live in the toolbar"; the first time you open a BYOK key entry in Settings surfaces "Bring your own API key for unlimited use". These toasts NEVER auto-dismiss — they wait for you to click "Got it". TWO-TIER DISMISSAL (2026-06-05 refinement): each card has a "Don't show me this again" checkbox beside the "Got it" button. (a) Clicking "Got it" with the checkbox UNCHECKED is a soft dismiss — the card closes for now but the same hint is eligible to fire again the next time its trigger occurs. This is the right choice when a user wants the card out of the way but still appreciates the reminder later. (b) Checking the box and then clicking "Got it" is a hard dismiss — the hint id is added to a persistent never-show list in localStorage and that hint never appears again, even if Professional mode is later switched off. Power users can also suppress all current and future hints from Settings → Tips → "Professional mode" (off by default). Turning Professional mode ON clears anything currently visible and stops new hints from firing. Turning Professional mode OFF restores normal behavior so hints can fire again on their triggers — but it does NOT touch the hard-dismissed list, so anything the user explicitly marked "Don't show again" stays hidden forever. A brief confirmation toast titled "Welcome tips re-enabled" with body "You'll see them on next-trigger — except the ones you marked 'Don't show again.'" makes the change non-silent. Storage keys: discovery:hardDismissedHints (array of hint ids, persistent), discovery:professionalMode (boolean). The legacy discovery:dismissedHints key is migrated to hardDismissed on first read for backward compatibility. The registry lives at [src/lib/discovery/hints.ts] and the hook/provider at [src/hooks/use-discovery.tsx]; v1 ships 5 hints. Hint copy uses the standard conversational tone, never CLI-speak.
- Link to Outline (cross-outline link nodes, Phase 1+2, 2026-06-04): Insert a node that links to another outline in your library. Open the Import menu > "Link to Outline…", or right-click any node > "Insert Link to Outline…". A picker dialog lists your other outlines (the current one is excluded). Pick one; a new link node is inserted as a child of the selected node (or the root if nothing is selected), and the link's name defaults to the target outline's name (rename freely). Clicking the link node jumps directly to the linked outline. If the linked outline has been deleted, the click shows a toast and stays put. Phase 2 — sidebar nesting: once an outline contains a link to another, the target outline also appears INDENTED beneath the parent in the left sidebar. A chevron on the parent toggles the nested view; the open/closed state is persisted per outline across sessions (localStorage key "sidebarExpanded:[outlineId]"). Linked outlines also stay at the top level of the sidebar (they show in both places — discoverability matters). If the same outline is linked from multiple parents, it shows nested under each. Multiple link nodes within one parent pointing to the same target are deduped (the target shows once under that parent). Circular references (A→B→A) are auto-detected and render the second occurrence as a muted, non-clickable leaf with a circular-arrow indicator and tooltip ("Already shown above — this outline links back into the chain"). Searching the sidebar matches names regardless of nesting depth. Inline content preview of linked outlines is a future phase.

MCP SERVER (API ACCESS):
- IdiamPro includes an MCP (Model Context Protocol) server for programmatic access to outlines
- AI assistants like Claude can read, write, search, and organize outlines directly
- 16 tools: list/get/search outlines, create/update/delete/move nodes, tag operations, export as Markdown, API key management
- Setup: Build the mcp-server/ directory, add to Claude Desktop config, restart
- Ask Claude: "list my outlines", "search for nodes about X", "export outline as markdown"

MOBILE:
- Stacked View: outline + content side by side
- Content View: full-screen editor mode
- Toggle between views with the toolbar button
- Touch-accessible toolbar buttons mirror every keyboard shortcut for iPad/iPhone: Focus Mode (target icon), Collapse All / Expand All (double-chevron icon), Search, Command Palette, and the Second Brain Brain menu (which contains Quick Capture, Open Second Brain, Search Second Brain, and more). No iOS user is gated by a keyboard-only feature.

ADMIN DASHBOARD:
- Launch Metrics page (internal): /admin/metrics is an internal-only dashboard showing launch-week vitals on a single screen — signups this week, activation rate, day-1 and day-7 retention, free-to-paid conversion, AI runs in the last 24 hours, and monthly recurring revenue. Gated by a localStorage flag (isAdmin=true) for v1; real Clerk-backed admin roles come post-launch. Refresh is manual (button at top with "Last updated N min ago"). All numbers are currently labelled "Demo" — the data layer (src/lib/launch-metrics.ts) exposes a typed contract so each metric can be re-wired to Clerk / RevenueCat / Sentry / the events backend independently once those are connected.

ONBOARDING EMAILS:
- When a user signs up (Clerk's user.created webhook fires) IdiamPro sends a four-email onboarding series, all branded from "IdiamPro [welcome@2ndbrainware.com]" via Resend.
- Welcome email — sent immediately. Three quick-start actions: create your first outline, try Smart Tools, watch the 2-minute intro video.
- Day 3 — "Stop maintaining documents by hand": one-feature highlight on Refresh from Web.
- Day 7 — "Three power-user tips": Quick Capture (Cmd+Shift+I), Research & Import (combine many sources), Ask Your Outlines.
- Day 14 — "Two weeks in — a quick note on Pro": soft upgrade pitch ($9.99/mo, podcast generation, image generation, priority support, plus the always-free BYOK alternative).
- Every email has a one-click Unsubscribe link in the footer that takes effect immediately. Unsubscribing only stops the onboarding series — the app itself keeps working the same as before. CAN-SPAM compliant.
- Unsubscribe URL shape: /unsubscribe?u=[userId]&t=[hmacToken]. The token is an HMAC of the userId so unsubscribe links can't be guessed.
- The whole layer is env-gated: with RESEND_API_KEY unset every send is a no-op log line and the app behaves exactly as before (no email goes out). With CLERK_WEBHOOK_SECRET unset the webhook still works in dev/stub mode without signature verification (logs a warning).
- Drips are scheduled by Vercel Cron post-launch (config lives in src/app/api/cron/drip/route.ts comments); welcome email is the only one that's live on launch day.
- The Free trial (25 generations, no sign-in) does NOT trigger any emails since there's no email address. Only signed-in Student / Pro users get the series.

LAUNCH PLANS & TIERS (counter is LIVE; auth + checkout still pending):
- The launch model uses a single unit: 1 generation = 1 user-initiated AI action (one Help chat round-trip, one Refresh from Web of any number of nodes, one Translate of any subtree, one Quick Command). The fan-out of model calls underneath does NOT count.
- Four tiers visible to users:
  • Free trial — 25 generations TOTAL (one-time, not monthly). Once exhausted, add a free API key or upgrade.
  • Free + your own key (BYOK) — Unlimited. Adding any provider key in Settings → AI Service Keys instantly bypasses the counter.
  • Student ($4.99/mo) — 200 generations per month. Requires .edu email + honor checkbox.
  • Pro ($9.99/mo) — 1,000 generations per month + Pro-only features (podcast generation, image generation) + priority support. Pro+BYOK also bypasses the counter.
- Counter resets on the 1st of each calendar month at midnight in the user's LOCAL timezone (Student / Pro). Free-trial is one-time, no reset.
- Local Ollama AI is exempt — picks "Local" in Settings and the counter never applies.
- UX: soft-warn toast at 80%, friendly hard-block upgrade dialog at 100%. Pro-only features (podcast / image gen) show a Pro badge on lower tiers and open the upgrade dialog when clicked instead of hiding.
- Where to see usage: Settings → AI Usage shows tier, X of Y used, reset date, and progress bar (emerald / amber at 80% / red at cap). BYOK users see "Unlimited — using your own API key."
- Auth + checkout aren't wired yet, so today everyone is treated as "Free trial" by default, BYOK works fully, and the "Upgrade" button is a polite "coming soon" placeholder.

BILLING & SUBSCRIPTIONS:
- Architecture: RevenueCat is the single source of truth for "which tier does this user have?", regardless of how they paid. Stripe handles web/desktop payments; Apple In-App Purchase handles iOS payments (App Store guideline 3.1.1 — iOS apps must use Apple IAP). RevenueCat keeps entitlements in sync so a subscription bought on web also unlocks iOS, and vice versa.
- Upgrade page: /upgrade shows three plans side-by-side — Free (BYOK), Student ($4.99/mo), and Pro ($9.99/mo or $89/year — save 25%). Each paid plan has a button that POSTs to /api/billing/checkout and redirects to Stripe Checkout (a secure hosted page with cards, Apple Pay, Google Pay).
- Success / Cancel pages: After Stripe Checkout, the user lands on /upgrade/success (which calls refreshTier so the new tier is live immediately) or /upgrade/cancel (gentle "no charge made" message with a soft re-pitch).
- Manage Subscription: Settings → Account → "Manage Subscription" opens Stripe's hosted Customer Portal for paid users (cancel, change plan, update card). Free / trial users see "See plans" which goes to /upgrade.
- iOS path: on iPhone/iPad the upgrade buttons skip Stripe entirely and open Apple's In-App Purchase sheet via the RevenueCat Capacitor plugin. Manage Subscription on iOS routes to Apple's Subscriptions settings.
- Stub mode: when STRIPE_SECRET_KEY or REVENUECAT_API_KEY env vars are unset, every billing endpoint logs a clear "not configured — stubbing response" message and returns a mock success. The whole upgrade UX is still navigable end-to-end in dev/test before real keys are wired.
- Tier sync: src/lib/tier-detection.ts exposes refreshTier() which re-fetches the entitlement (with a 5-minute cache) — call it after returning from Checkout. For v1 it reads from a localStorage shim keyed by [userId]; once the RevenueCat REST endpoint is wired client-side, the call sites stay unchanged.

AUTHENTICATION & ACCOUNTS:
- The outliner itself is gated behind a sign-in. Marketing pages stay public: homepage [/], /marketing, /privacy, /upgrade and its success/cancel pages, /stress-test, /unsubscribe, plus /signin and /signup.
- Protected (sign-in required): /app and everything under it, /admin and everything under it, and AI endpoints that touch user content (help chat, knowledge chat, synthesize-podcast, generate-podcast, extract-pdf, billing checkout, billing portal).
- Public webhooks: /api/webhooks/[provider] and /api/billing/webhook stay public — they're machine-to-machine calls from Clerk and Stripe, verified by signing secrets rather than user auth.
- Sign-up flow: click "Sign up to try IdiamPro free" on the homepage hero. No credit card required. New users land in /app on the Free trial tier (25 generations one-time).
- Sign-in flow: click "I already have an account" on the homepage, or visit /signin. After signing in the user lands on /app, or on whatever route they were trying to reach when the wall stopped them (the original URL rides along in a redirect_url query param).
- Sign-out: click the avatar in the top-right of the app toolbar and pick Sign out. Lands on the homepage [/].
- Stub-safe pattern: when CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY are not set, the middleware logs a single dev warning and lets everyone through. The Account avatar in the toolbar simply doesn't render. As soon as those env vars are set in Vercel the wall goes live in production with no code change.

INVITE-ONLY ACCESS (beta gating):
- IdiamPro is in invite-only beta. Even users who can reach /signup must have an email on Howard's curated allowlist before they can create an account.
- Two enforcement points. [1] Pre-signup UX: the /signup page asks for an email first and POSTs it to /api/invite-check; if the email isn't on the list, the page shows a conversational gate message ("IdiamPro is in invite-only beta right now. Your email isn't on the invite list yet — drop us a note at hello@2ndbrainware.com and we'll get you in.") and never hands off to Clerk. [2] Defense in depth: the Clerk user.created webhook re-runs the same check and immediately calls Clerk's REST API to delete the account if the email isn't on the list. Welcome email only fires after the allowlist check passes.
- Storage v1: comma-separated emails in the INVITE_ALLOWLIST env var. Matching is exact + case-insensitive (no wildcards, no domain-level matching). To approve a new tester Howard edits the env var in Vercel and redeploys.
- Extension point v1.1: /admin/invites is a stub page today; a self-service dashboard for adding/removing emails (database-backed) lands without changing any call site — every consumer talks to isEmailAllowed() / getAllowedEmails() in src/lib/access/allowlist.ts.
- Stub-safe: with INVITE_ALLOWLIST unset OR empty, the allowlist check is bypassed (everyone is allowed) — same env-gated philosophy as Clerk / Stripe / Sentry / Resend. The signup flow behaves like a normal Clerk sign-up until the env var is set.

Answer user questions clearly and concisely. If they ask how to do something, provide step-by-step instructions.`;

export default function HelpChatDialog({ open, onOpenChange }: HelpChatDialogProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hi! I\'m here to help you with IdiamPro. Ask me anything about features, keyboard shortcuts, or how to use the app!',
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const { gate } = useAIUsageGate();
  const voiceBaseRef = useRef('');
  const speech = useSpeechToText({
    onFinal: (text) => {
      voiceBaseRef.current = (voiceBaseRef.current + ' ' + text).trim();
      setInput(voiceBaseRef.current);
    },
    onError: (msg) => {
      toast({ title: 'Voice input', description: msg, variant: 'destructive' });
    },
  });
  // Track when listening started so we can surface a "we can't hear you" hint
  // if no real audio shows up within a few seconds.
  const [listenStartedAt, setListenStartedAt] = useState<number | null>(null);
  const [silenceElapsed, setSilenceElapsed] = useState(false);
  const handleMicClick = () => {
    if (!speech.listening) {
      voiceBaseRef.current = input;
      setListenStartedAt(Date.now());
      setSilenceElapsed(false);
    }
    speech.toggle();
  };
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when dialog opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Auto-start the mic when the dialog opens, if the user has chosen
  // "Voice + auto-start" in Settings and the browser supports it.
  // Stop listening cleanly when the dialog closes.
  const [inputMode] = useInputModePreference();
  useEffect(() => {
    if (!open) {
      if (speech.listening) speech.stop();
      setListenStartedAt(null);
      setSilenceElapsed(false);
      return;
    }
    if (inputMode !== 'voice-auto-start') return;
    if (!speech.supported) return;
    const t = setTimeout(() => {
      voiceBaseRef.current = input;
      setListenStartedAt(Date.now());
      setSilenceElapsed(false);
      speech.start();
    }, 50);
    return () => clearTimeout(t);
    // We intentionally don't depend on `speech` or `input` to avoid
    // re-firing the timer on every keystroke / re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, inputMode]);

  // After 3 seconds with no audio detected, surface the silence hint. The
  // hint clears immediately the moment real audio arrives.
  useEffect(() => {
    if (!speech.listening || listenStartedAt == null) {
      setSilenceElapsed(false);
      return;
    }
    if (speech.audioDetected) {
      setSilenceElapsed(false);
      return;
    }
    const remaining = Math.max(0, 3000 - (Date.now() - listenStartedAt));
    const t = setTimeout(() => setSilenceElapsed(true), remaining);
    return () => clearTimeout(t);
  }, [speech.listening, speech.audioDetected, listenStartedAt]);

  const showSilenceHint =
    speech.listening && silenceElapsed && !speech.audioDetected;

  // 5-bar live audio-level meter — same as command-palette.
  const BAR_COUNT = 5;
  const meterScale = Math.min(1, speech.level / 0.4);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    // Tier-enforcement gate (#33): one Q&A round-trip = one generation.
    // Returns false if the user hit the cap or this is a Pro-only feature
    // on a lower tier; in both cases the gate already showed the right UX.
    if (!gate({ feature: 'helpChat' })) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Call help chat action
      const response = await fetch('/api/help-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Help chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again or contact support.',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[600px] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 dark:bg-red-400/10 rounded-lg">
              <CircleHelp className="h-6 w-6 text-red-500 dark:text-red-400" />
            </div>
            <div>
              <DialogTitle>IdiamPro Help</DialogTitle>
              <DialogDescription>
                Ask me anything about features, shortcuts, or how to use the app
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Chat Messages */}
        <ScrollArea className="flex-1 px-6 py-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex gap-3',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.role === 'assistant' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[80%] rounded-lg px-4 py-2',
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap select-text cursor-text">{message.content}</p>
                </div>
                {message.role === 'user' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Loader2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400 animate-spin" />
                </div>
                <div className="bg-muted rounded-lg px-4 py-2">
                  <p className="text-sm text-muted-foreground">Thinking...</p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="px-6 py-4 border-t">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about features, shortcuts, or how to..."
              disabled={isLoading}
              className="flex-1"
            />
            {speech.supported && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleMicClick(); }}
                      variant="outline"
                      size="icon"
                      aria-label={speech.listening ? 'Stop listening' : 'Voice input'}
                    >
                      <Mic className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {speech.listening ? 'Listening — click to stop' : 'Voice input'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {speech.listening && (
              <span
                data-testid="listening-indicator"
                className="self-center flex items-end gap-[2px] h-3 shrink-0"
                aria-label="Listening"
              >
                {Array.from({ length: BAR_COUNT }).map((_, i) => {
                  const share = Math.max(0, Math.min(1, meterScale * (BAR_COUNT / (i + 1))));
                  const heightPct = 20 + share * 80;
                  return (
                    <span
                      key={i}
                      aria-hidden="true"
                      className="w-[2px] rounded-sm bg-red-500 transition-[height] duration-75"
                      style={{ height: `${heightPct}%` }}
                    />
                  );
                })}
              </span>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => { if (speech.listening) speech.stop(); handleSend(); }}
                    disabled={!input.trim() || isLoading}
                    size="icon"
                    aria-label="Send message"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Send (Enter)</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {showSilenceHint ? (
            <p
              data-testid="silence-hint"
              className="text-xs text-muted-foreground mt-2"
              aria-live="polite"
            >
              Listening but not hearing anything — {getMicPermissionHelp()}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-2">
              Press Enter to send, Shift+Enter for new line
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
