import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getDefaultGeminiModel } from '@/config/gemini-models';

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
- Node multi-select (mobile): Long-press any node in the outline (~500ms, no finger movement) to enter multi-select mode; once entered, plain taps on other nodes add/remove them from the selection. Light haptic feedback on entry where supported. Press Escape (desktop) or use the toolbar Cancel button to exit.
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
- Export/Share: Select a node and click the Share button (toolbar) to export. Formats include PDF, Markdown, Plain Text, HTML (collapsible webpage), Interactive Outline (read-only IdiamPro-style viewer with sidebar navigation, search, dark/light mode), Website (8 professional templates: Marketing, Informational, Documentation, Portfolio, Event, Educational, Blog, Personal), Podcast (AI-generated audio), OPML, Obsidian (wiki-links), CSV, JSON Tree.
- Outline management: The sidebar (panel-toggle button at top-left of toolbar) is the sole path for switching, creating, renaming, deleting, and searching outlines. The toolbar shows the current outline name as a read-only title plus a wrench icon (admin menu) for Import Outline, Export Current Outline, Backup All Outlines, Restore All Outlines, and Refresh User Guide.
- Import: Multi-format import via the toolbar wrench (admin) menu > "Import Outline". Supports Markdown (.md - heading hierarchy), Plain Text (.txt - indentation), OPML (.opml - standard outline XML), JSON/IDM (native format). Drag-and-drop or browse to select. Auto-detects format.
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

KEYBOARD SHORTCUTS (macOS/Desktop):
- Enter/Return: Create new sibling node
- Tab: Indent node
- Shift+Tab: Outdent node
- Cmd+K: Command palette (also: Expand All, Collapse All)
- Cmd+E: Toggle collapse/expand all (also available as a toolbar button)
- Cmd+B: Toggle sidebar (platform convention; Second Brain is accessed via toolbar Brain button)
- Cmd+D: Duplicate node
- Delete/Backspace: Delete selected node (with confirmation if enabled)
- Cmd+Shift+F: Focus Mode (isolate subtree, Esc to exit). Also available as a Focus button in the outline toolbar — highlights when active, disabled when no node is selected.
- Ctrl+F: Search (current outline or all outlines). Collapsed nodes containing matches auto-expand to reveal results. Filter toggles let you search node names only, content only, or both.
- Up/Down arrows: Navigate between nodes
- Left/Right arrows: Collapse/expand nodes
- Double-click node: Edit node name
- Cmd+Click: Multi-select nodes
- Cmd+Click / Shift+Click in sidebar: Select multiple outlines for bulk delete
- Cmd+C: Copy subtree
- Cmd+X: Cut subtree
- Cmd+V: Paste subtree

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
- Knowledge Chat: Query your outlines with natural language. AI Features menu > Knowledge Chat, or Second Brain menu > Search Second Brain. Three modes: Current Outline, All Outlines, and Second Brain. AI answers based only on your outline content. Responses stream word-by-word.
- Second Brain: A special always-present outline (brain icon) for accumulating everything you want to remember. Save any node to it via right-click > "Save to Second Brain" or the brain menu. Open it from the Brain toolbar menu (no shortcut — Cmd+B is reserved for the sidebar). Search it via Knowledge Chat's Second Brain mode. Shortcuts: Cmd+Shift+B (save), Cmd+Shift+S (search).
- Quick Capture (Cmd+Shift+I): Opens a floating dialog from anywhere. Type or paste any thought, hit Enter, it lands in a "📥 Inbox" section at the top of Second Brain. No need to be inside any outline.
- Second Brain Dashboard: Brain menu > View Dashboard. Shows total entries, recent saves (last 7 days), a "revisit pile" of older entries, and top tags. Click any entry to jump to it.
- Smart Auto-Tagging: When you save anything to Second Brain (including via Quick Capture), AI suggests 1-3 short topical tags and applies them automatically. Tags are stored as node metadata and shown in the dashboard. You can edit tags later via the existing tag UI.
- Describe with AI: Every embedded image has a "Describe with AI" button. Uses local or cloud vision AI to generate descriptions.
- Local AI / Ollama: Settings > AI Provider. Choose Cloud, Local (Ollama on localhost:11434), or Auto. Recommended models: gemma4:e4b (multimodal, 4GB RAM), gemma4:26b (16GB+ RAM, fastest large model), gemma4:31b (24GB+ RAM, max quality). Legacy: llama3.2 (3GB RAM, low-spec systems). Requires Ollama 0.20+ for Gemma 4 support.
- AI Data Consent: On first use of any AI feature, a consent dialog appears explaining that data is sent to Google Gemini, OpenAI, and AssemblyAI. Users must agree before AI features work. If you click Decline, a warning screen lists all features that will be disabled and asks you to confirm. Consent can be revoked in Settings > Data & Privacy. Privacy policy available at /privacy.
- Privacy & Data (GDPR/CCPA): Settings > Privacy & Data has two buttons. "Export my data" generates a .zip archive containing every outline (as .idm files), localStorage preferences, all stored AI API keys, and your AI consent state — saved via native dialog on desktop, Share sheet on iOS, or browser download on web. "Delete all my data" requires a two-step confirmation (warning dialog, then type DELETE) and permanently wipes outlines, settings, API keys, and consent state from this device, then reloads the app to its fresh-install state. Both work even with AI consent revoked. Neither touches anything outside IdiamPro's data scope.
- Pending Import Recovery (Desktop): If import times out or app closes, result is saved and recovery dialog appears on next launch
- Unmerge: After merging research into an existing outline, an Unmerge button (orange circular arrow) appears in the toolbar right after the Research & Import button. Click it to restore the outline to its pre-merge state. The button persists until you click it or perform another merge. You can freely edit the outline and still unmerge later. The backup survives app restarts. Only the most recent merge can be unmerged.
- Generate Podcast: Right-click any node > "Generate Podcast". Choose a style (Two-Host, Narrator, Interview, Debate), assign voices, pick a length (Brief/Standard/Detailed), and select audio quality (Standard/HD). AI generates a script via Gemini, then synthesizes speech via OpenAI TTS. Preview the audio in-app and save as MP3. All preferences (style, voices, length, quality) are remembered across sessions. Requires OPENAI_API_KEY.

TOOLBAR BUTTONS:
- Plus icon: Create new node
- Library icon: Research & Import (merge multiple sources)
- Unmerge icon (orange circular arrow): Appears after a merge, restores pre-merge state
- Sparkles icon: AI menu (generate outline from topic)
- Command icon: Command palette
- Brain icon (blue): Knowledge Chat — query your outlines with AI
- Settings icon: Settings & storage options

HOW TO USE RESEARCH & IMPORT:
1. Click the Library icon button in the toolbar
2. Click "Add Source" to add multiple sources
3. Choose source type (YouTube, PDF, web page, image, document, audio, video, text, or outline file)
4. For each source, provide the URL or upload the file
5. Click "Synthesize X Sources" to merge them into a unified outline
6. The AI will analyze all sources, find connections, and create a hierarchical structure

COMMON WORKFLOWS:
- Quick outline building: Press Enter to create sibling nodes, double-click to rename
- Research synthesis: Use Research & Import with 20+ YouTube videos and 50+ PDFs
- Content expansion: Select a node, right-click, choose "Generate Content with AI"
- Bulk operations: Cmd+Click to select multiple nodes, then use Multi-Select toolbar

MCP SERVER (API ACCESS):
- IdiamPro includes an MCP (Model Context Protocol) server for programmatic access to outlines
- AI assistants like Claude can read, write, search, and organize outlines directly
- 16 tools: list/get/search outlines, create/update/delete/move nodes, tag operations, export as Markdown, API key management
- Setup: Build the mcp-server/ directory (npm install && npm run build), add to Claude Desktop config JSON, restart Claude Desktop
- Example commands: "list my outlines", "search for nodes about marketing", "create a new outline called Meeting Notes", "export my Business Plan as markdown"
- API keys: Generate keys for rate-limited access. Free tier: 1,000 calls/month. Premium: 10,000 calls/month with AI features.
- Works with Claude Desktop, Claude Code, and any MCP-compatible AI client

MOBILE:
- Stacked View: outline + content side by side
- Content View: full-screen editor mode
- Toggle between views with the toolbar button
- Touch-accessible toolbar buttons mirror every keyboard shortcut for iPad/iPhone: Focus Mode (target icon), Collapse All / Expand All (double-chevron icon), Search, Command Palette, Quick Capture, and the Second Brain Brain menu. No iOS user is gated by a keyboard-only feature.

Answer user questions clearly and concisely. If they ask how to do something, provide step-by-step instructions. Be friendly and encouraging.`;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(request: NextRequest) {
  // Per-IP rate limit: 30 requests per minute (chat tier).
  const limited = enforceRateLimit(request, { limit: 30, namespace: 'help-chat' });
  if (limited) return limited;

  try {
    const { messages } = await request.json() as { messages: Message[] };

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: 'No messages provided' },
        { status: 400 }
      );
    }

    // Build conversation history
    const conversationHistory = messages.map(m =>
      `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
    ).join('\n\n');

    const userQuestion = messages[messages.length - 1].content;

    // Generate response using Gemini
    const { text } = await ai.generate({
      model: getDefaultGeminiModel('genkit'),
      prompt: `${APP_CONTEXT}

Conversation history:
${conversationHistory}

Provide a helpful, clear, and concise response to the user's question. If explaining a feature, be specific about where to find it and how to use it. Keep your response under 200 words unless more detail is genuinely needed.`,
    });

    return NextResponse.json({ response: text });
  } catch (error) {
    console.error('Help chat error:', error);
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    );
  }
}
