'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { CircleHelp, Send, Sparkles, User, Loader2, Mic, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSpeechToText } from '@/hooks/use-speech-to-text';
import { useInputModePreference } from '@/lib/use-input-mode-preference';
import { getMicPermissionHelp } from '@/lib/platform-help';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import { useAIUsageGate } from '@/lib/use-ai-usage-gate';
import { getUserApiKey } from '@/lib/byok-keys';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  /** Calm inline notice (e.g. cloud unavailable — answered with local Gemma). */
  notice?: string;
}

interface HelpChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// App context for AI to understand what IdeaM does
const APP_CONTEXT = `You are a helpful assistant for IdeaM, a professional outlining application with AI-powered features.

KEY FEATURES:
- HOW CONTROLS ARE ORGANIZED (the one rule, same in both panes): a control that acts on the SELECTED item / selected text / cursor position lives in a right-click (context) menu; a control that acts on the WHOLE outline or is global lives on the TOOLBAR. So: Add / Rename / Delete / Cut-Copy-Paste / Expand this item / Compress this item / Zoom In (focus this branch) / Refresh from Web / Properties / Export this item are on the node right-click menu; New Outline, Search, AI, Bring In, Turn Into (export whole outline), Second Brain, Expand All / Compress All, and Help are on the toolbar. Open/close vocabulary: "Expand" opens one item and leaves others as-is; "Compress" closes one item; "Zoom In / Focus" opens one item and hides everything outside its branch (with a breadcrumb to exit); "Expand All / Compress All" act on the whole outline; "Search / Find" is a smart Expand All that opens only matching items.
- Settings is organized into six categories: General, AI, Privacy & Data, Account, Backups, and About.
- Settings > Appearance has a theme selector: choose Light, Dark, or Auto (Auto matches your device's system setting).
- Hierarchical outlining with drag & drop, indent/outdent
- Wizards (one-click automated workflows): open the Smart Tools menu (sparkles icon) and pick "Wizards" to run a whole recipe with a single Run press. Each Wizard is a one-click front door over an engine the app already has, and asks a few friendly questions that shape the output (or just hit Run for smart defaults). Four Wizards are LIVE today: "Automatic Book" (a short guided dialogue — topic, depth, tone, audience — produces a full outline with AI-written sections as a brand-new outline), "Website Building", "Podcast", and "YouTube Video". Five more are visible but COMING SOON (shown as previews, not yet runnable): Research Digest, Study Guide, Screenplay, Invention/Patent, and Explain Anything. Wizards run on the app's built-in AI and are free-tier friendly; premium generation packages come later.
- AI-powered outline generation from topics
- Research & Import: Merge multiple sources (YouTube, PDFs, web pages, images, docs, audio, video, outline files) into unified outlines
- Rich content editor with markdown support, clipboard image paste (Cmd+V), drag-and-drop images, link paste (URLs auto-link, rich HTML links preserved)
- Import File button (paperclip icon): import any file from your device. Auto-detects type — images embed inline, videos embed with player controls, audio files embed with native audio player, PDFs show a dialog to extract text or insert as link, other files insert as download links
- Multi-select nodes for bulk operations (delete, change color, add tags)
- Node multi-select (desktop): Cmd/Ctrl+Click toggles a node in the selection, Shift+Click selects a range
- Node multi-select (mobile): Long-press any node in the outline (~500ms, no finger movement) to enter multi-select mode; once entered, plain taps on other nodes add/remove them from the selection. Provides light haptic feedback on entry where supported. Press Escape (desktop) or use the toolbar Cancel button to exit.
- Sidebar multi-select (desktop): Cmd/Ctrl+Click or Shift+Click outlines in the sidebar to select multiple, then bulk delete — either via the "Delete" button in the top selection bar OR by right-clicking any highlighted outline and choosing "Delete N Outlines" (the row's right-click / "..." menu acts on the whole selection). A confirmation appears before deleting.
- Sidebar multi-select (mobile): Long-press any outline in the mobile sidebar sheet to enter select mode, then tap additional outlines to toggle them; a top bar provides Cancel and Delete
- Sidebar rename (mobile): Tap the ⋯ menu on the right of any outline row and choose Rename for an inline rename field (Enter saves, Escape cancels)
- Sidebar search: Type in the search field below the Outlines header to filter outlines by name (works on desktop and mobile)
- Tags and color-coding for organization
- Automatic backups (Desktop): Every save creates a timestamped backup in the backups/ folder. Throttled to one per 5 minutes per outline. Last 10 backups kept per outline. Recover by renaming a backup file in Finder.
- Backup & Restore (Desktop, 2026-06-10): The toolbar shield button opens the Backup / Restore dialog for the current outline. Backup tab takes an optional label and writes a complete snapshot. Restore tab lists every snapshot newest-first with Preview, Restore, and Delete per row. Auto-snapshots fire before every AI transform (Reformat, Translate, Transform Outline, Refresh from Web) and before every Restore, labeled "auto: before [transform name]". Settings > Outline backups has two toggles (auto-before-transform, auto-before-restore, both default ON) plus a Show backups folder button. Retention is 20 newest snapshots per outline; older ones are deleted automatically when the 21st arrives. Snapshots live at [outlines folder] > .backups > [outline-name] > [YYYY-MM-DD-HHmmss]-[label].idm.
- Backup health check (always on, 2026-07-10): IdeaM verifies its own backups. After every snapshot it reads the file straight back to confirm it genuinely saved (round-trips), not just that the save was called — this closes the exact gap where the manual backup silently died on desktop for weeks with zero symptoms. If a backup ever fails or can't be read back, a loud, persistent (non-fading) warning toast appears for the user ("Heads up — automatic backups aren't saving") with a "How to fix" action that opens the Backup & Restore dialog. It stays completely silent while backups are healthy (no nagging) and clears the warning automatically on recovery. Every user gets it (not admin-only) because it's about their data. Web builds stay silent (snapshots are intentionally off there).
- Keep your work safe / off-device backup (user's responsibility): IdeaM is local-first — your outline files live on your own device, so keeping them safe is ultimately up to you. Store your IdeaM files in a location that is automatically backed up: iCloud Drive, Dropbox, Google Drive, OneDrive, a Time Machine disk, or any backup service you trust. The method is your choice. The app's automatic local snapshots (above) are a safety net but are NOT a substitute for your own off-device backup — if the device is lost, stolen, or fails, only an off-device copy protects you. When a user asks how to back up, suggest concrete options and explain how to move or keep their outline files inside a folder that already syncs to the cloud (e.g. put the IdeaM outlines folder inside iCloud Drive / Dropbox / Google Drive so every save is copied off-device automatically). Not sure what to pick? Walk them through choosing one.
- First-run data-protection notice (2026-07): The very first time a user opens IdeaM, a one-time red-styled "Keep your work safe" notice appears immediately, before the "What you can make here" welcome panel. It is a deliberate liability disclaimer explaining that outline files live on the user's own device and backing them up is ultimately the user's responsibility — store IdeaM files in an automatically-backed-up location (iCloud Drive, Dropbox, Google Drive, OneDrive, Time Machine, or any trusted backup); the app's automatic local snapshots are a safety net but NOT a substitute for an off-device backup. On the WEB build it adds an extra warning that work is stored inside the browser on this device and can be lost by clearing browser data, using private/incognito mode, or switching browsers, so export regularly. It lists good backup habits (3-2-1 rule, versioned backups, export before big changes, test that you can restore, device encryption + 2FA on the backup account) and points to Help ("Need help choosing? Ask IdeaM Help."). It shows ONCE (a localStorage flag remembers it) and appears at least this first time even in Professional mode because it's a disclaimer. A "Got it" button dismisses it and an optional "Don't remind me again" checkbox is offered. It is re-accessible any time via Settings > Backups > "Data safety & backup".
- Delete account (2026-07): Settings > Privacy & Data has two separate destructive actions. "Delete all my data" only wipes this device (outlines, settings, API keys). "Delete account" — shown only when signed in — is the full account deletion required by the App Store: it permanently deletes the user's actual sign-in account plus every server-side record we hold for them (beta application, feedback, bug reports), THEN wipes local device data, THEN signs them out. It asks for a clear confirmation and cannot be undone; users should Export my data first if they want a copy.
- Derivative outlines (2026-06-10): Every content-altering AI transform (Transform Outline with AI, Reformat with AI, Refresh from Web) defaults to "Save as new outline" — the result becomes a NEW outline in the sidebar nested under the original, and the original is NOT modified. The transform dialog shows a "What should we do with the result?" radio with two options: "Save as new outline (recommended)" (default for Transform / Reformat / Refresh) creates a derivative with an auto-suggested label derived from the user's prompt (e.g. "Middle School Version" from "rewrite for middle schoolers"); "Replace this outline" applies in-place (auto-snapshot still fires, Cmd+Z still undoes). Translate keeps "Replace this outline" as its default — translation is content-preserving per language and the user already chose the target language — but offers "Save as new outline" as opt-in. In the sidebar, derivatives appear nested under their parent with a small purple fork badge on the icon. Inside a derivative outline, a subtle "Derived from [Parent name]" chip appears below the title with an "Open original" button. Multi-level derivation is supported (derivative of derivative renders as grandchild). If the parent is deleted, derivatives orphan gracefully — they remain in the library at top-level with a muted "(orphan derivative)" hint. This is the third protective layer in IdeaM's outline data protection model: Layer 1 = unified Cmd+Z, Layer 2 = auto-snapshot before in-place transforms, Layer 3 = derivative-by-default so in-place isn't even the default. New outline metadata fields: derivedFromOutlineId (parent ID), derivationLabel (short hint like "Refreshed 2026-06-10" or "Academic Rigorous Version").
- Automatic updates (Desktop, 2026-06-06): The desktop app checks for new versions silently a few seconds after launch and every 4 hours thereafter. New versions download in the background; when ready, a thin non-intrusive banner at the top of the app shell says "Update ready. Version X.Y.Z is ready. Restart to apply." with [Restart now] and [Later] buttons. Later snoozes for 24 hours. Users can force a check anytime via Help menu > "Check for Updates…" — a toast reports either "You're on the latest version" or kicks off the silent download. The web app updates on page refresh; iOS updates via App Store / TestFlight as usual. Auto-updater is skipped in dev mode and gracefully degrades if electron-updater isn't yet installed.
- Cross-platform: macOS Desktop (Electron), iOS (Capacitor), and Web (Vercel) are actively shipped. Windows and Linux Electron builds are configured. Android via Capacitor is on the roadmap. See the Platform Rosetta Stone for input mappings across all platforms.
- File storage: iCloud Drive, Dropbox, Google Drive, local folders
- Google Docs/Sheets/Slides/Maps embedding via Insert menu
- Speech-to-text recording in the content pane via Web Speech API
- Input mode preference (Settings > Preferences > Input mode): three options — "Type" (default, keyboard only; mic button still available for ad-hoc dictation), "Voice" (free dictation, no auto-start), and "Voice + auto-start" (the mic begins listening automatically the moment you open the Cmd+K command palette / Ask AI or the Help chat — ideal for hands-free use; falls back silently if the browser doesn't support Web Speech recognition).
- Export/Share: Select a node and use Export menu (BookUp icon in toolbar) > "Share Suboutline as…" — or right-click any node > "Share Suboutline As…" for the same dialog. Formats include PDF, Markdown, Plain Text, HTML (collapsible webpage), Interactive Outline (read-only IdeaM-style viewer with sidebar navigation, search, dark/light mode), Website (8 professional templates: Marketing, Informational, Documentation, Portfolio, Event, Educational, Blog, Personal), Podcast (AI-generated audio), OPML, Obsidian (wiki-links), CSV, JSON Tree.
- Share Link (publish to a shareable link): In the Export dialog there's a "Share Link" button. It publishes the current outline (or selected suboutline) as a VIEW-ONLY web page hosted on OUR OWN site (never Google or any third party) and gives you a link on our domain (2ndbrainware.com/s/…) you can copy and send. Anyone can open the link with NO login required to view. Pick a simple page style (Showcase, Overview, or Guide). It's a SNAPSHOT — the page reflects the outline at publish time; press "Update" to re-publish the latest version to the same link, or "Unpublish" to revoke it (the page immediately shows a clean "no longer shared" message). A "Manage shared links" list lets you view and revoke any of your published links. The shared page is read-only and safety-sandboxed (no scripts run) to protect viewers. Free accounts can keep 3 shared links at a time; Pro is unlimited (enforced on our server).
- Generate Video (desktop app, Pro): Open the Export menu (BookUp icon) > "Generate Video" to turn a chapter (a selected node + its sub-points) into a narrated slideshow MP4. Customizable Style section: upload your own logo, pick an accent color, choose dark/light theme, and pick a narrator voice. A "Slide visuals" control offers three combinable, independent checkboxes — Mind maps, Photos, and Video clips (default: Mind maps + Photos on, Video clips off) — that mix per slide: sections favor a mind map, detail slides favor a video clip if that box is ticked otherwise a photo, the cover gets a photo/clip if enabled, and unchecking all three gives clean text-only slides. Video clips is off by default because clip relevance can't be guaranteed; when it's on and no strong match is found the slide quietly uses a photo instead. Mind maps are drawn automatically from that part of your outline; photos and clips come from free public-domain sources. Photos and clips come only from license-clean, free public-domain sources (photos from Openverse CC0/Public Domain; clips from Wikimedia Commons public-domain/CC0 with no key needed, or from Pexels/Pixabay if you've set a free key) — everything is free with no per-item charge, and a small media-credits file is saved next to the video. Every fetch fails safe: if a clip can't be had it falls back to a photo, then to text, so a missing visual never breaks the video or costs anything. A "Detail" control (Overview, Standard, Deep, or Full outline) sets how deep into the outline the video goes — Standard covers sections and subsections, while Full outline turns the ENTIRE outline, at any depth, into a video. Slides render automatically, an AI voiceover (OpenAI TTS) narrates them, and everything is stitched into a YouTube-ready MP4 saved to Documents · IdeaM Videos. While it renders, the dialog shows a live progress bar (e.g. "Rendering slide 3 of 12", "Stitching video") and an approximate time remaining that updates as it goes. Rendering runs entirely on the Mac desktop app (nothing uploaded); the web and iOS builds show a "use the desktop app" notice. The video ALWAYS narrates and is never silent: with an OpenAI key it uses natural AI text-to-speech, and without one it falls back to the Mac's built-in system voice (free, offline). Everyone gets 10 free videos to try it (those free videos carry a small "Made with IdeaM" watermark); Pro unlocks unlimited videos with no watermark. (Full web/iOS rendering is planned for a future release.)
- Outline management: The sidebar (panel-toggle button at top-left of toolbar) is the sole path for switching, creating, renaming, deleting, and searching outlines. The toolbar shows the current outline name as a read-only title plus two small icon buttons: Import (BookDown) and Export (BookUp). Import menu contains: Research & Import, Import Outline, Restore All Outlines. Export menu contains: Share Suboutline as…, Export Current Outline, Backup All Outlines. (The previous Wrench / Refresh User Guide menu was retired 2026-06-07 — the User Guide is now read-only and reloads from the bundled app version on every launch, so a manual refresh is no longer needed.)
- User Guide is read-only (2026-06-07): The "IdeaM User Guide" outline that appears at the top of the sidebar is read-only. Users cannot edit its content, add or delete nodes inside it, rename it, delete the outline itself, drag-reorder its nodes, paste into it, or run AI mutations (Refresh from Web, Translate, Reformat with AI, Transform Outline with AI) against it. Reading, searching, copying text out of it, and switching to it as the active outline all still work normally. On every app launch the User Guide is replaced with the bundled version that ships with the installed app — so users always see the latest guide for their version. If a user wants to keep personal notes related to the guide, tell them to create a new outline (sidebar > New Outline) and keep their notes there. Support staff also references this guide, so its read-only status ensures support and users see the same content.
- Responsive toolbar (2026-06-06): The toolbar adapts to screen width via three tiers. Anchors (sidebar toggle on the left, account avatar on the right) are always visible. PHONE [< 640px]: only Ask AI, Plus, Delete, and Search show inline; everything else collapses into a "More tools" overflow menu (three-dot icon to the left of the avatar) — Import, Export, Zoom In, Show or hide all, Share suboutline, Command palette, Second Brain, Smart Tools, Settings, Help. TABLET [640-1023px]: adds Import, Export, Zoom In, Show or hide all, Share suboutline, Command palette, Second Brain, Smart Tools inline; the overflow keeps Settings and Help. DESKTOP [>= 1024px]: every button is inline and the overflow icon disappears. All keyboard shortcuts (Cmd+K, Cmd+F, Cmd+E, Cmd+Shift+E, Cmd+Shift+F, Cmd+Shift+I, etc.) work at every width regardless of whether the matching button is inline or in the overflow. The previous "Import as Chapter" toolbar action was retired the same day — copy/paste already covers the same intent more intuitively.
- Import: Multi-format import via the toolbar Import menu (BookDown icon) > "Import Outline". Supports Markdown (.md - heading hierarchy), Plain Text (.txt - indentation), OPML (.opml - standard outline XML), JSON/IDM (native format). Drag-and-drop or browse to select. Auto-detects format.
- Canvas/Drawing nodes (Excalidraw-based): Right-click > Set Type > Canvas
- Spreadsheet nodes (Fortune Sheet): Right-click > Set Type > Spreadsheet
- Scrollable dialogs: Any dialog that's taller than your screen can be scrolled. On touch devices (iPhone/iPad) you can drag the content up and down with your finger — handy on small windows.

CONTENT EDITOR:
- Rich text: Bold (Cmd+B), Italic (Cmd+I), Strikethrough, Headings (H1-H3)
- Lists: Ordered, unordered, and checklist lists
- Code blocks
- Undo (Cmd+Z), Redo (Cmd+Shift+Z) — unified across everything: text edits, adding/deleting/moving items, AI transforms (Reformat, Translate, Transform Outline, Refresh from Web), pastes, and imports. One shortcut undoes whatever you just did. Depth is unlimited. After big actions (AI transforms, imports, multi-delete) a persistent toast shows the name of what was undone (e.g. "Undid: Translate Outline") and stays visible until you click the X.
- Touch-accessible toolbar: The content pane toolbar has Undo/Redo buttons and Bullet List, Numbered List, and Checklist buttons at the left end — one-tap access on iPhone, iPad, and desktop without needing the right-click menu.
- Floating formatting toolbar: Select text in the editor and a small floating menu appears with Bold, Italic, Strikethrough, Inline Code, and Heading 1/2/3 buttons. Active formatting is highlighted. Works on touch and desktop.
- Google Docs/Sheets/Slides/Maps embedding via Insert menu (paste URL)
- Speech-to-text: Click microphone button, speak, text is transcribed locally

KEYBOARD SHORTCUTS:
- Enter/Return: Create new sibling node
- Tab: Indent node
- Shift+Tab: Outdent node
- (Quick Command and its Cmd+K shortcut were retired in the 2026-07-21 UI restructure. Natural-language actions on your outline now live in the AI menu on the toolbar and in the right-click menus.)
- AI menu (toolbar, sparkle icon): natural-language and AI actions that can act on your outline, not just answer questions — generate a suboutline, reformat, transform, translate, ask your outlines, and more. Plain-English requests; conversational confirmations, never CLI-speak.
- Cmd+E: Expand All — recursive open of the selected suboutline (or the whole outline if nothing is selected). Also available from the toolbar's bidirectional double-chevron button (tooltip: "Show or hide all nodes") which opens a dropdown with [Expand all] and [Collapse all] items.
- Cmd+Shift+E: Collapse All — recursive close of the selected suboutline (or the whole outline if nothing is selected). Same toolbar dropdown as above.
- Single-chevron click on a node: toggles ONLY that node and preserves each descendant's previous open/closed state. Use this when you want a node to remember how it was last left.
- Right-click a node: 'Expand All' and 'Collapse All' menu items operate on that node's suboutline.
- Cmd+B: Toggle sidebar (platform convention; Second Brain is accessed via toolbar Brain button)
- Cmd+D: Duplicate node
- Delete/Backspace: Delete selected node (with confirmation if enabled)
- Cmd+Shift+F: Zoom In (zoom into one branch, Esc to exit). Also available as a Zoom In button in the outline toolbar (target icon) — highlights when active, disabled when no node is selected.
- Ctrl+F (Cmd+F on Mac): Search the outline as a view-shaper that COMPRESSES, never hides. When the user types a search term, the tree unfolds just enough to show the matching nodes plus the chain of ancestors leading down to each one; every other suboutline is collapsed. Crucially, every node remains a row in the tree — nothing is hidden — so the user can click any chevron on any suboutline (even a non-matching one) to open it up and explore. Search reshapes by collapsing, not by removing rows. Restore the full view via Expand All (Cmd+E / Ctrl+E), Collapse All (Cmd+Shift+E / Ctrl+Shift+E), or by chevron-clicking suboutlines open one at a time. The funnel icon toggles "Search only open nodes" — when on, the next search walks only currently expanded nodes, letting you chain queries as a logical AND ("alpha" then "beta" -> nodes containing both). Filter toggles let you search node names only, content only, or both. Scope toggle picks current outline or all outlines.
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
- Generate Suboutline from Topic: AI menu > Generate Suboutline. Topic is pre-filled with the selected node's name (editable). Result is inserted as children of the selected node. (Free tier: 10/month, Premium: 100/month)
- Expand with AI: Content toolbar button (was "Ask AI"). Writes, expands, summarizes, or reformats the current node's content. (Free: 50/month, Premium: 500/month)
- Create Content for Descendants: Right-click a parent > generates content for all children at once
- Research & Import synthesis (Free: 3 sources, Premium: 50+ sources). Nodes always have short names (2-6 words) as tree labels with detailed content in the content pane, even in comprehensive mode. Merging into an existing outline integrates content under shared themes rather than appending separately.
- Knowledge Chat: Query your outlines with natural language. AI Features menu > Knowledge Chat, or Second Brain menu > Ask Second Brain. Three modes: Current Outline, All Outlines, and Second Brain. AI answers based only on your outline content, referencing specific sections. Responses stream in word-by-word.
- Second Brain: A special always-present outline (🧠 icon) for accumulating everything you want to remember. Save any node to it via right-click > "Save to Second Brain" or the brain menu. Open it from the Brain toolbar menu (no shortcut — Cmd+B is reserved for the sidebar). Keyboard shortcuts: ⌘⇧B (save selection), ⌘⇧S (Ask, the AI answer). Cannot be deleted or renamed.
- Search Second Brain (FREE, instant, local): Brain menu > "Search Second Brain" (magnifying-glass icon). Opens the Dashboard with the search box focused. Filters your saved entries live by title AND full content, case-insensitive, whitespace-tolerant — no AI, no internet, no cost. This is a plain keyword filter (like Ctrl-F over your saves). Distinct from "Ask Second Brain": Ask sends your question to the AI and costs an AI generation, whereas Search is a free word-match. The search box also lives permanently at the top of the Dashboard.
- Quick Capture (Cmd+Shift+I, or [Brain menu] > Quick Capture): Opens a floating dialog from anywhere. Type or paste any thought, hit Enter, it lands in a "📥 Inbox" section at the top of Second Brain. No need to be inside any outline. As of 2026-06-06 the standalone Inbox toolbar button is gone — Quick Capture lives inside the Brain dropdown alongside Open Second Brain and Ask Second Brain, in cognitive order [open → capture → save → search].
- Second Brain Dashboard: Brain menu > View Dashboard. Shows a free local search box at the top (filters saved entries by title+content, no AI/cost), total entries, recent saves (last 7 days), a "revisit pile" of older entries, and top tags. Click any entry to jump to it.
- Smart Auto-Tagging: When you save anything to Second Brain (including via Quick Capture), AI suggests 1-3 short topical tags and applies them automatically. Tags are stored as node metadata and shown in the dashboard. You can edit tags later via the existing tag UI.
- Describe with AI: Every embedded image has a "Describe with AI" button. Uses Gemma 4 vision (local) or Gemini (cloud) to generate a description. When local, no image data leaves your device.
- Local AI / Ollama: Settings > AI Provider. Choose Cloud, Local (Ollama on localhost:11434), or Auto. Recommended models: gemma4:e4b (multimodal, 4GB RAM), gemma4:26b (16GB+ RAM, fastest large model), gemma4:31b (24GB+ RAM, max quality). Legacy: llama3.2 (3GB RAM, low-spec systems). Requires Ollama 0.20+ for Gemma 4 support.
- Local AI auto-start & recovery (desktop): If you've chosen the "Local" provider, IdeaM automatically starts your on-device AI engine (Ollama) when the app launches — so it just works even after a reboot, no manual step. If a local AI feature is used while the engine is down, a calm "Local AI isn't running" notice appears with a one-click "Start Local AI" button (it launches the engine and retries). If Ollama isn't installed, the notice links to the installer instead; on the web (where the app can't launch programs) it points you to switch to Cloud in Settings > AI Provider.
- AI resilience / automatic fallback: The Help chat (and, over time, other AI features) honor your AI Provider setting. On "Cloud" or "Auto", if the cloud AI is unavailable — an outage, a rate limit, or a billing/quota problem — and you have a local Gemma model installed via Ollama, the Help chat automatically answers with local Gemma instead and shows a calm notice ("Gemini is unavailable right now — answered with local Gemma instead. Quality may differ."). If the failing key is your OWN key (BYOK) and the failure is a billing/quota issue, the notice also reminds you to check your AI provider's billing. If no local model is available, you'll see a brief "AI is temporarily unavailable — please try again shortly." On "Local", the Help chat answers with local Gemma directly and never calls the cloud.
- AI Data Consent: The consent toggle in Settings > Data & Privacy controls CLOUD AI only. There are three data paths: (1) On-device AI (Local / Gemma via Ollama) is fully private — your notes never leave your device, and it works whether or not consent is granted; (2) Your own key (BYOK) sends your content to your chosen provider under your own account, and IdeaM never sees it; (3) Our cloud AI (Google Gemini, OpenAI, AssemblyAI for audio) sends your content to the provider only to process your request — never stored, and on paid tiers never used for training. On first use of a cloud AI feature, a consent dialog appears explaining this. If you click Decline, a warning screen lists all cloud features that will be disabled and asks you to confirm. Consent can be revoked in Settings > Data & Privacy. Privacy policy available at /privacy.
- Privacy & Data (GDPR/CCPA): Settings > Privacy & Data has two buttons. "Export my data" generates a .zip archive containing every outline (as .idm files), localStorage preferences, all stored AI API keys, and your AI consent state — saved via native dialog on desktop, Share sheet on iOS, or browser download on web. "Delete all my data" requires a two-step confirmation (warning dialog, then type DELETE) and permanently wipes outlines, settings, API keys, and consent state from this device, then reloads the app to its fresh-install state. Both work even with AI consent revoked. Neither touches anything outside IdeaM's data scope.
- Pending Import Recovery (Desktop): If import times out or app closes, result is saved and recovery dialog appears on next launch
- Unmerge: After merging research into an existing outline, an Unmerge button (orange circular arrow) appears in the toolbar right after the Research & Import button. Click it to restore the outline to its pre-merge state. The button persists until you click it or perform another merge. You can freely edit the outline and still unmerge later. The backup survives app restarts. Only the most recent merge can be unmerged.
- Generate Podcast: Right-click any node > "Generate Podcast". Choose a style (Two-Host, Narrator, Interview, Debate), assign voices, pick a length (Brief/Standard/Detailed), and select audio quality (Standard/HD). AI generates a script via Gemini, then synthesizes speech. Preview the audio in-app and save as MP3. All preferences (style, voices, length, quality) are remembered across sessions. Voices mirror the Video feature: the podcast is NEVER silent — on desktop, if the user added an OpenAI key in Settings it uses natural AI voices on THEIR key (BYOK, same shared key as Video); with no key it falls back to the free built-in macOS voices, one distinct voice per speaker, and it auto-selects the best-quality Apple voice installed (Enhanced/Premium tier when the user has downloaded them, standard otherwise). On iPhone/iPad, a keyless user gets the same free deal: the podcast is synthesized entirely on the device with Apple's built-in voices (two distinct voices, no key, no cost, nothing sent to a paid service) via a native TTS plugin; if they've added their own OpenAI key it uses that for premium AI voices instead. On the web it uses the user's BYOK key if present, otherwise the company OPENAI_API_KEY.
- Generate Video (desktop, Pro): Export menu > "Generate Video" turns a chapter into a narrated slideshow MP4 with your own branding (logo, accent color, dark/light theme, narrator voice), a "Slide visuals" control with three combinable checkboxes (Mind maps / Photos / Video clips; default Mind maps + Photos on, Video clips off) and a "Detail" control (Overview / Standard / Deep / Full outline) for how deep into the outline the video goes — Full outline covers every level. Slides render on-device and ffmpeg stitches them into a video saved to Documents · IdeaM Videos; while rendering, a live progress bar and an estimated time remaining are shown. Videos ALWAYS narrate — OpenAI TTS if a key is set, otherwise the Mac's free built-in system voice, so it's never silent. Desktop-only rendering; everyone gets 10 free videos to try (free videos carry a small "Made with IdeaM" watermark), Pro unlocks unlimited unmarked videos.
- Refresh from Web (the web-refresh feature, internal code name LIVE BOOKS): Manually refresh a node and all its descendants against the latest information so documents don't go stale. Open it from the Import menu (BookDown icon in the toolbar) > "Refresh from Web" (moved here 2026-06-06 — it brings external web content INTO existing nodes, so it fits the Import metaphor), the Command Palette, or Cmd/Ctrl+Shift+R (select the root node to refresh the entire outline). Choose Merge & augment (default — keep accurate content, fix outdated parts, fold in new info) or Overwrite/regenerate. By default every change is shown in a side-by-side preview with per-node accept/reject and nothing is applied until you approve; "Apply automatically without previewing" is an explicit opt-in that is off by default. Nodes you edited by hand are auto-skipped to protect your writing, with a per-node "Include anyway" override. Every refreshed node stores its sources and the model used — a compact "Sources" chip on the node shows the citations and attribution (e.g. "Refreshed with Gemini 3.5 Flash"), and this travels with the outline through save/export. Cloud AI uses live web search for real citations; local AI uses the model's built-in knowledge (no internet) and says so honestly rather than inventing sources. Refresh from Web is personal/local — it only changes your own copy after approval. It is built on a reusable transform engine that the Translate feature also uses.
- Reformat with AI (single-node content reformat): Reformat the content in a node by describing the format you want in plain language ("turn into a bulleted list", "make each line a heading", "convert to a markdown table", "tighten spacing and remove empty lines", "add headings where it makes sense", "convert to clean prose"). Open from the Smart Tools menu > "Reformat with AI…", the editor context menu > "Reformat with AI…", the Command Palette, or — when text is selected in the content editor — the violet wand icon at the LEFT END of the floating formatting toolbar (bubble menu). The wand sits at the first position of the bubble menu with a violet accent and a small "Most Powerful" badge so it's the eye-magnet of the toolbar (Howard 2026-06-05). Scope: with no selection it reformats the whole node; with a selection it reformats just the selected text. Click a chip below the input to fill it in with an example instruction. The AI returns a side-by-side before/after preview; Apply commits the change, Modify lets you tweak the instruction without burning a second generation request after re-running, Cancel discards. Optional "Use local AI (Ollama)" tickbox keeps the reformat on-device. One reformat = ONE generation against the monthly cap, regardless of content length. Available on every tier (Free trial, Student, Pro).
- Transform outline with AI (whole-suboutline structural transformation, 2026-06-06): Restructure a suboutline (or the entire outline) by describing what should change in plain English. This is the structural counterpart to Reformat with AI: Reformat rewrites ONE node's content body; Transform changes the SHAPE of the outline — adding, removing, renaming, merging, splitting, or moving nodes. Open from the Smart Tools menu > "Transform outline with AI…" or from the Command Palette > "Transform outline with AI". Scope rule: if a node is selected, the transform operates on that node and everything beneath it; if nothing is selected, it operates on the whole current outline (root down). The dialog: (1) type how to transform the suboutline — example chips include "Reorganize alphabetically by name", "Merge chapters with fewer than three children into a Misc chapter", "Promote leaf nodes about [topic] to top-level chapters", "Convert each paragraph node into a heading with its body as a child", "Deduplicate near-duplicate nodes", "Extract everything tagged [tag] into its own new chapter"; (2) click Preview transform; (3) the AI returns a transformed version and the dialog shows a before/after structural tree view with color coding — green = added, red strike-through = removed, amber = renamed, blue = moved — plus a one-line summary like "I'll add 12, remove 4, rename 8, move 23 nodes."; (4) click Apply, Modify instruction, or Cancel. Large-suboutline safeguard: if the suboutline has more than 2,000 nodes, the dialog surfaces an inline warning that very large transforms can be unreliable and suggests narrowing scope — the user can still proceed. Contract enforced server-side: existing node IDs are preserved for anything kept; new nodes get fresh UUIDs (the model uses NEW_NODE_[seq] placeholders that the server action replaces); the suboutline's root parentId anchor is restored from the original outline so the suboutline stays in its place; circular parent/child relationships are rejected; the root is never deleted. Optional "Use local AI (Ollama)" tickbox keeps the transform on-device. One transform = ONE generation against the monthly cap, regardless of suboutline size. NOT a Pro-only feature.
- Capture from image (Multimedia AI: image-to-outline, 2026-06-11): Turn any image into a structured sub-outline. Use cases: whiteboard photos, hand-drawn mind maps, sticky-note brainstorms, screenshots of slides or textbook pages. Open from the Smart Tools menu > "Capture from image". On iOS/Android the dialog also offers a "Take photo" button that opens the device camera; desktop shows file picker only. The workflow follows the same preview-and-approve pattern as every other AI transform: (1) pick or capture an image, (2) optionally add a short context hint, (3) the AI returns a proposed hierarchical node structure, (4) review in the three-panel preview (source thumbnail / editable proposed tree / where it lands), (5) rename or remove individual nodes inline, (6) click "Add N nodes" to append them as children of the selected node. Data protection: an auto-snapshot is written before insertion (Layer 2), Cmd+Z undoes the whole capture as one step (Layer 1), and "Save as new outline" is offered as opt-in to keep the original untouched via the derivative flow (Layer 3). Provenance: each new node records a sourceImageId in its metadata; the source image bytes are persisted locally so the user can always see what generated the content. One image capture = ONE generation against the monthly cap.
- Generate Visual (content toolbar Image button): Insert a visual into a node. AI illustration (Google Imagen) is a paid-per-use premium feature — for now it runs ONLY on your own Gemini key (add one in Settings → AI Service Keys). Free or no-key users see the upgrade prompt instead of a paid call, so a paid image is never made by accident. Mind Map and Flowchart are ALWAYS FREE — drawn locally from the current node's outline structure with no AI, and never counted.
- Paid-per-use premium features & who pays (2026-07-11): The premium podcast voice (OpenAI TTS), audio transcription (AssemblyAI), and AI image generation (Imagen) each cost money per call. They are enforced SERVER-SIDE and NEVER run on the founder's personal key. For end users they run ONLY on the user's own API key (BYOK — OpenAI, AssemblyAI, or Gemini respectively). A free 'taste' of these features (a small lifetime number per account, counted on the server so it can't be reset from the browser, then unlimited for paid plans) is a toggle that turns on only once SecondBrainWare has its own funded company billing account — until then, non-BYOK users are cleanly asked to add their own key or upgrade. The FREE podcast/video narrator voice (your device's built-in voice) stays free and unlimited, so free users are never stuck. The free Gemini TEXT features (generate/expand/translate/reformat/refresh/ask) stay generous and are NOT capped by this lifetime limit.
- Share as YouTube package (Multimedia AI: outline-to-YouTube, 2026-06-11): Turn a chapter (selected node + descendants) into a complete YouTube content package in one click. Open from the Export menu (BookUp icon) > "Share as YouTube package". The dialog asks for target duration (60 sec / 90 sec / 2 min / 5 min), style (Tutorial / Explainer / Promo / Story), and an optional audience hint. Generate produces 8 outputs at once, each shown in its own editable tab: voiceover script with [shot N] markers and timing cues, chapter list, 200-300 word description, 5 title variants, 15-20 SEO tags, thumbnail concept, B-roll prompts (ready to paste into Runway / MagicLight / Sora), and a screen-recording shot list for in-app demo segments. Export options: download as a single markdown file, or save as a new outline (one node per output, kept as a derivative of the current outline). One YouTube package = ONE generation against the monthly cap.
- Translate this section (language translation, #52): Translate any selected node and its descendants into another language with the same preview-and-approve safety as Refresh from Web. Open from the Smart Tools menu > "Translate this section" or from the Command Palette. The language dropdown is ordered for IdeaM's globally-distributed-team users — Chinese (Simplified), Portuguese (Brazilian), Spanish, French, Japanese, Korean, German, Italian, Hindi appear first; a wider catalog follows. There is NO default language — the user must pick one before the Translate button enables. Tick "Use local AI (Ollama)" to keep the translation entirely on-device. Click Translate & preview: each node is shown side-by-side with the original. Reject any you don't want, then click Apply to commit. Formatting (headings, lists, bold, links) is preserved; proper nouns and code stay as-is. Nodes you edited by hand are auto-skipped with the same Include-anyway override. One Translate counts as ONE generation against the usage cap, regardless of how many nodes are in the suboutline.
- Discovery Hints ("Did You Know?" tips, 2026-06-05): The app surfaces sticky discovery cards in the lower-right corner the first time a new user reaches a feature worth knowing about. Examples: the first text selection in the editor surfaces a "Reformat with AI is here" tip (and, staggered 6s later, a "Smart Tools = your AI toolkit" tip); the first time you create an outline surfaces "Link one outline to another" and "Import and Export live in the toolbar"; the first time you open a BYOK key entry in Settings surfaces "Bring your own API key for unlimited use". These toasts NEVER auto-dismiss — they wait for you to click "Got it". TWO-TIER DISMISSAL (2026-06-05 refinement): each card has a "Don't show me this again" checkbox beside the "Got it" button. (a) Clicking "Got it" with the checkbox UNCHECKED is a soft dismiss — the card closes for now but the same hint is eligible to fire again the next time its trigger occurs. This is the right choice when a user wants the card out of the way but still appreciates the reminder later. (b) Checking the box and then clicking "Got it" is a hard dismiss — the hint id is added to a persistent never-show list in localStorage and that hint never appears again, even if Professional mode is later switched off. Power users can also suppress all current and future hints from Settings → Tips → "Professional mode" (off by default). Turning Professional mode ON clears anything currently visible and stops new hints from firing. Turning Professional mode OFF restores normal behavior so hints can fire again on their triggers — but it does NOT touch the hard-dismissed list, so anything the user explicitly marked "Don't show again" stays hidden forever. A brief confirmation toast titled "Welcome tips re-enabled" with body "You'll see them on next-trigger — except the ones you marked 'Don't show again.'" makes the change non-silent. Storage keys: discovery:hardDismissedHints (array of hint ids, persistent), discovery:professionalMode (boolean). The legacy discovery:dismissedHints key is migrated to hardDismissed on first read for backward compatibility. The registry lives at [src/lib/discovery/hints.ts] and the hook/provider at [src/hooks/use-discovery.tsx]. Hint copy uses the standard conversational tone, never CLI-speak.
- Onboarding welcome (2026-07-10, opt-out clarified 2026-07-16): Brand-new users see a single "What you can make here" panel the first time they open the app — a value showcase of the app's outputs (Video, Podcast, Website, Docs/Export) and inputs (Import from YouTube/PDFs/web, AI + Second Brain). It carries an obvious, persistent "Don't show this again" button plus a "Get started" button — both set localStorage flag onboarding:welcomeShowcaseSeen so the panel never returns on relaunch. Closing via the X / Escape is a "just this once" close that does NOT persist, so an accidental close can reappear next launch. Fully suppressed in Professional mode. Re-enableable any time via Settings → Tips & messages → "Bring back tips & welcome" (calls resetWelcomeShowcase(), which also re-arms the make-something nudge). Lives at [src/components/welcome-showcase.tsx].
- "Make something from this" nudge (2026-07-10): A one-time Discovery hint ("Ready to turn this into something?") that fires once, the first time an outline reaches a few nodes of real content, pointing the user at Export (video, podcast, website). Guarded by localStorage flag onboarding:makeSomethingNudgeFired so it never nags, and it honors the same two-tier opt-out + Professional mode as every other hint.
- Import/Export value tooltips (2026-07-10): The Import (book-down) and Export (book-up) toolbar icons carry outcome-based tooltips — Import: "Bring in content — YouTube, PDFs, web pages, notes"; Export: "Turn this into a video, podcast, website, or 20+ formats".
- Link to Outline (cross-outline link nodes, Phase 1+2, 2026-06-04): Insert a node that links to another outline in your library. Open the Import menu > "Link to Outline…", or right-click any node > "Insert Link to Outline…". A picker dialog lists your other outlines (the current one is excluded). Pick one; a new link node is inserted as a child of the selected node (or the root if nothing is selected), and the link's name defaults to the target outline's name (rename freely). Clicking the link node jumps directly to the linked outline. If the linked outline has been deleted, the click shows a toast and stays put. Phase 2 — sidebar nesting: once an outline contains a link to another, the target outline also appears INDENTED beneath the parent in the left sidebar. A chevron on the parent toggles the nested view; the open/closed state is persisted per outline across sessions (localStorage key "sidebarExpanded:[outlineId]"). Linked outlines also stay at the top level of the sidebar (they show in both places — discoverability matters). If the same outline is linked from multiple parents, it shows nested under each. Multiple link nodes within one parent pointing to the same target are deduped (the target shows once under that parent). Circular references (A→B→A) are auto-detected and render the second occurrence as a muted, non-clickable leaf with a circular-arrow indicator and tooltip ("Already shown above — this outline links back into the chain"). Searching the sidebar matches names regardless of nesting depth. Inline content preview of linked outlines is a future phase.

CONFIRMATION DIALOGS — TWO-TIER OPT-OUT (2026-06-10):
- Every confirmation dialog in the app (Delete item, Delete outline, Bulk delete) now offers a "Don't ask again" checkbox at the bottom of the dialog body. Check the box and click Confirm to suppress that specific prompt for all future occurrences (persisted in localStorage under a stable key like confirm.deleteOutline.suppressed).
- Professional mode (Settings → Tips & messages → Professional mode toggle) is the single master quiet switch: it silences EVERY unrequested surface at once — "Did You Know?" tips, the welcome panel, every confirmation dialog, and other pop-ups. One switch = no friction; turn it off any time to bring them back. (The first-run data-protection disclaimer still shows once even with it on, then never nags.) The same Settings section has a "Bring back tips & welcome" button that re-arms the welcome panel, the make-something nudge, and every permanently-dismissed tip, so any per-surface opt-out is reversible.
- A "Reset confirmation prompts" button in Settings → Preferences clears every per-prompt suppression so users can roll back their opt-outs without flipping Professional mode. The reset shows a toast like "Cleared 3 suppressed prompts." This mirrors the Discovery Hints two-tier dismissal pattern (2026-06-05).

TOAST NOTIFICATIONS — PERSIST UNTIL DISMISSED (2026-06-10):
- All toasts (undo confirmations, save confirmations, AI completion notices, error toasts, transform-applied notices, etc.) stay on screen until the user clicks the X to dismiss them. They never auto-fade.
- Multiple toasts stack — up to six visible at once. Users dismiss them in any order.
- This gives users (especially older users or anyone reviewing AI changes) time to read what happened and decide what to do next — a toast that disappears after 3 seconds robs them of that chance. A rare few transient toasts still auto-fade (e.g. "Nothing to undo" hint, focus-mode confirmation) because they pile up otherwise — those pass an explicit short duration.

MCP SERVER (API ACCESS):
- IdeaM includes an MCP (Model Context Protocol) server for programmatic access to outlines
- AI assistants like Claude can read, write, search, and organize outlines directly
- 16 tools: list/get/search outlines, create/update/delete/move nodes, tag operations, export as Markdown, API key management
- Setup: Build the mcp-server/ directory, add to Claude Desktop config, restart
- Ask Claude: "list my outlines", "search for nodes about X", "export outline as markdown"

MOBILE:
- Stacked View: outline + content side by side
- Content View: full-screen editor mode
- Toggle between views with the toolbar button
- Touch-accessible toolbar buttons work for iPad/iPhone: Search/Find, Expand All/Compress All (combined double-chevron icon — opens a dropdown), AI (sparkle), Bring In, Turn Into, and the Second Brain menu (which contains Quick Capture, Open Second Brain, Ask Second Brain, and more). Zoom In / Focus and Refresh from Web live on each item's long-press (right-click) menu. No iOS user is gated by a keyboard-only feature.

ADMIN DASHBOARD:
- Launch Metrics page (internal): /admin/metrics is an internal-only dashboard showing launch-week vitals on a single screen — signups this week, activation rate, day-1 and day-7 retention, free-to-paid conversion, AI runs in the last 24 hours, and monthly recurring revenue. Access is enforced server-side (a signed-in Clerk user whose email is on the ADMIN_EMAILS allowlist). Refresh is manual (button at top with "Last updated N min ago"). All numbers are currently labelled "Demo" — the data layer (src/lib/launch-metrics.ts) exposes a typed contract so each metric can be re-wired to Clerk / RevenueCat / Sentry / the events backend independently once those are connected.

ONBOARDING EMAILS:
- When a user signs up (Clerk's user.created webhook fires) IdeaM sends a four-email onboarding series, all branded from "IdeaM [welcome@2ndbrainware.com]" via Resend.
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
- The launch model uses a single unit: 1 generation = 1 user-initiated AI action (one Help chat round-trip, one Refresh from Web of any number of nodes, one Translate of any suboutline, one Quick Command). The fan-out of model calls underneath does NOT count.
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
- Sign-up flow: click "Sign up to try IdeaM free" on the homepage hero. No credit card required. New users land in /app on the Free trial tier (25 generations one-time).
- Sign-in flow: click "I already have an account" on the homepage, or visit /signin. After signing in the user lands on /app, or on whatever route they were trying to reach when the wall stopped them (the original URL rides along in a redirect_url query param).
- Sign-out: click the avatar in the top-right of the app toolbar and pick Sign out. Lands on the homepage [/].
- Stub-safe pattern: when CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY are not set, the middleware logs a single dev warning and lets everyone through. The Account avatar in the toolbar simply doesn't render. As soon as those env vars are set in Vercel the wall goes live in production with no code change.

BETA FEEDBACK FORM (earn 1 year of Pro):
- The /feedback page lets approved beta users share structured feedback. Submitting earns 1 year of Pro features at no charge — same Pro feature set as paying customers — with one catch: AI usage runs against the user's own API key (BYOK), so the cost stays with them, not Howard.
- The form has top-line scores (NPS 0-10 + overall stars 1-5, both required), per-killer-feature rows (Multi-source synthesis, 10+ source types, AI-native from day one, True cross-platform, Your data your way, AI Smart Tools, Outline Search, Second Brain — each with stars 1-5, a one-line comment, and a "Didn't try this yet" skip checkbox), open prompts ("single best thing" / "biggest wish"), workflow questions (tool used before, kind of work, usage frequency this week), a testimonial-consent block (Yes/No → attribution choice → optional photo + 30-second video upload), a friction question, and a follow-up-OK checkbox.
- Sharing a quote we can put on the IdeaM website earns the user a Founding User badge inside the app (driven by uploading a 30-second video testimonial).
- Permanent in-app entry point: Help/overflow menu > "Share feedback" opens /feedback in a new tab.
- 14-day reminder: a daily cron job (/api/cron/feedback-reminder) emails approved applicants who haven't submitted yet, ~14 days after approval. Subject: "Hey [name] — mind sharing five minutes of feedback?". Sent from Howard, reply-to Howard, low-pressure copy.
- Admin browsing: /admin/feedback (sibling of /admin/applicants) shows every submission with NPS / stars / feature-rating summary, filter chips (All / Testimonial-consented / Public-quotable / Video), search, and a CSV export button. Admin access is enforced server-side (a signed-in Clerk user whose email is on the ADMIN_EMAILS allowlist).
- The welcome email Howard sends on approval mentions the upcoming feedback ask in abstract terms ("around the two-week mark") so the reward isn't a surprise.

REPORT ISSUE (in-app bug reporting):
- "Report Issue" has TWO entry points and both open the same dialog: (1) the bug-icon button in the app toolbar next to the account avatar, and (2) the "Report Issue" item in the More tools / Help overflow menu, placed right under "Help & Support" so anyone hunting through the help menu for a place to report problems finds it there.
- The dialog asks: what's not working (required, plain English), what you were trying to do (optional context), how serious it is ("Just FYI" / "Annoying" / "Blocking me"), and lets you attach an optional screenshot (drag-drop or pick a file, max 2MB).
- Submitting sends the report to Howard's inbox and stores it in the admin dashboard. You see a confirmation toast that stays until you dismiss it. Howard reads every report.
- The app automatically captures the page URL, a clean platform label (e.g. "Mac Desktop (Electron)", "iOS (Capacitor, iPhone)", "Web (Chrome on macOS)"), the raw browser/device user-agent string, current outline name, and your signed-in email so you don't have to type any of that. Your email is pulled server-side from your session — never trust-and-asked. The platform label is parsed on the client (it knows whether it's Electron / Capacitor / browser) with a server-side fallback parse from the user-agent string for older clients.
- Howard's review surface: /admin/bugs (mirror of /admin/applicants and /admin/feedback). Admin access is enforced server-side (a signed-in Clerk user whose email is on the ADMIN_EMAILS allowlist). Sections: New, Acknowledged, In Progress, Resolved, Won't Fix. Each report can be moved through those statuses; the screenshot shows in the details panel. Howard also has a "Progress notes (internal)" textarea inside each bug's detail panel — a private free-text scratchpad for what he's looked at, next steps, and known blockers. These notes are admin-only: they are NEVER returned by any user-facing API and the reporter NEVER sees them, no matter what.

INVITE-ONLY ACCESS (beta-applicant approval flow):
- IdeaM is in invite-only beta. Every prospective user fills out a short application at /signup and Howard personally approves each one before they can use the app.
- The application form collects name, email, and an optional "What brings you to IdeaM?" textarea. Submitting POSTs to /api/applicants/apply, which persists the applicant record (file-based JSON store at .idiampro/applicants.json) and emails Howard at howard@2ndbrainware.com with the details and a deep link to /admin/applicants?focus=[id].
- The /admin/applicants dashboard lists Pending Applicants (Approve / Reject buttons) and Approved Users (with private notes, mailto, CSV export). Approving an applicant flips their record to status=approved, adds their email to the dynamic allowlist, and triggers a "You're in" email from the app's support sender (Reply-To support@2ndbrainware.com, so replies reach the support desk).
- Three enforcement points (defense in depth). [1] The /app subtree is wrapped in AppGate, which redirects signed-out users to /signup and signed-in-but-not-approved users to /waiting. [2] The Clerk user.created webhook re-runs isEmailAllowedAsync and deletes the account if the email isn't approved. [3] The pre-signup /api/invite-check endpoint still works for the fast-path "is this email already on the list?" check.
- Allowlist source: two layers. [1] INVITE_ALLOWLIST env var (comma-separated, used for pre-seeding Howard's own addresses). [2] Every applicant Howard has clicked Approve on. isEmailAllowedAsync() unions both.
- /waiting page: where signed-in-but-not-approved users land when they hit /app. Friendly "your application is in the queue" copy with a sign-out option for wrong-account cases.
- Stub-safe: with no INVITE_ALLOWLIST set AND an empty applicant store, the allowlist check is bypassed (dev mode). Admin pages (/admin/applicants, /admin/metrics, /admin/invites, etc.) are enforced server-side — a signed-in Clerk user whose email is on the ADMIN_EMAILS allowlist.

Answer user questions clearly and concisely. If they ask how to do something, provide step-by-step instructions.`;

export default function HelpChatDialog({ open, onOpenChange }: HelpChatDialogProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hi! I\'m here to help you with IdeaM. Ask me anything about features, keyboard shortcuts, or how to use the app!',
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
  // Track whether the user is parked at (or near) the bottom of the chat.
  // When true, new content snaps into view; when the user has scrolled UP to
  // re-read history, we leave them where they are and don't yank them down.
  const isNearBottomRef = useRef(true);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceFromBottom < 80;
  };

  const scrollToBottom = (force = false) => {
    const el = scrollRef.current;
    if (!el) return;
    if (force || isNearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  };

  // Auto-scroll to bottom when new content arrives (a new message, or the
  // Thinking indicator) — but only if the user is already near the bottom.
  useEffect(() => {
    scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, isLoading]);

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
    // The user just sent a message — always snap them to the bottom to see it
    // and the reply, even if they had scrolled up a moment ago.
    isNearBottomRef.current = true;

    try {
      // Honor the user's AI Provider setting (Cloud / Local / Auto) and tell
      // the server whether the Gemini key in play is the user's own (BYOK),
      // so any billing message can be phrased correctly.
      const aiProvider =
        (typeof localStorage !== 'undefined' &&
          (localStorage.getItem('aiProvider') as 'cloud' | 'local' | 'auto')) ||
        'auto';
      const geminiKeyIsByok = !!getUserApiKey('gemini');

      // Call help chat action
      const response = await fetch('/api/help-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content,
          })),
          aiProvider,
          geminiKeyIsByok,
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
        notice: data.notice || undefined,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Help chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Something went wrong on my end while I was thinking that through. Want to try again? If it keeps happening, you can email support@2ndbrainware.com.",
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
              <DialogTitle>IdeaM Help</DialogTitle>
              <DialogDescription>
                Ask me anything about features, shortcuts, or how to use the app
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Chat Messages */}
        <div
          className="flex-1 overflow-y-auto px-6 py-4"
          ref={scrollRef}
          onScroll={handleScroll}
        >
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
                  {message.notice && (
                    <div
                      data-testid="fallback-notice"
                      className="mb-2 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300"
                    >
                      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                      <span className="select-text">{message.notice}</span>
                    </div>
                  )}
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
        </div>

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
