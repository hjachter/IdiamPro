'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { CircleHelp, Send, Sparkles, User, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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

KEYBOARD SHORTCUTS:
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
- Quick Capture (Cmd+Shift+I): Opens a floating dialog from anywhere. Type or paste any thought, hit Enter, it lands in a "📥 Inbox" section at the top of Second Brain. No need to be inside any outline.
- Second Brain Dashboard: Brain menu > View Dashboard. Shows total entries, recent saves (last 7 days), a "revisit pile" of older entries, and top tags. Click any entry to jump to it.
- Smart Auto-Tagging: When you save anything to Second Brain (including via Quick Capture), AI suggests 1-3 short topical tags and applies them automatically. Tags are stored as node metadata and shown in the dashboard. You can edit tags later via the existing tag UI.
- Describe with AI: Every embedded image has a "Describe with AI" button. Uses Gemma 4 vision (local) or Gemini (cloud) to generate a description. When local, no image data leaves your device.
- Local AI / Ollama: Settings > AI Provider. Choose Cloud, Local (Ollama on localhost:11434), or Auto. Recommended models: gemma4:e4b (multimodal, 4GB RAM), gemma4:26b (16GB+ RAM, fastest large model), gemma4:31b (24GB+ RAM, max quality). Legacy: llama3.2 (3GB RAM, low-spec systems). Requires Ollama 0.20+ for Gemma 4 support.
- AI Data Consent: On first use of any AI feature, a consent dialog appears explaining that data is sent to Google Gemini, OpenAI, and AssemblyAI. Users must agree before AI features work. If you click Decline, a warning screen lists all features that will be disabled and asks you to confirm. Consent can be revoked in Settings > Data & Privacy. Privacy policy available at /privacy.
- Privacy & Data (GDPR/CCPA): Settings > Privacy & Data has two buttons. "Export my data" generates a .zip archive containing every outline (as .idm files), localStorage preferences, all stored AI API keys, and your AI consent state — saved via native dialog on desktop, Share sheet on iOS, or browser download on web. "Delete all my data" requires a two-step confirmation (warning dialog, then type DELETE) and permanently wipes outlines, settings, API keys, and consent state from this device, then reloads the app to its fresh-install state. Both work even with AI consent revoked. Neither touches anything outside IdiamPro's data scope.
- Pending Import Recovery (Desktop): If import times out or app closes, result is saved and recovery dialog appears on next launch
- Unmerge: After merging research into an existing outline, an Unmerge button (orange circular arrow) appears in the toolbar right after the Research & Import button. Click it to restore the outline to its pre-merge state. The button persists until you click it or perform another merge. You can freely edit the outline and still unmerge later. The backup survives app restarts. Only the most recent merge can be unmerged.
- Generate Podcast: Right-click any node > "Generate Podcast". Choose a style (Two-Host, Narrator, Interview, Debate), assign voices, pick a length (Brief/Standard/Detailed), and select audio quality (Standard/HD). AI generates a script via Gemini, then synthesizes speech via OpenAI TTS. Preview the audio in-app and save as MP3. All preferences (style, voices, length, quality) are remembered across sessions. Requires OPENAI_API_KEY.
- LIVE BOOKS (Refresh from the web): Manually refresh a node and all its descendants against the latest information so documents don't go stale. Open it from the AI menu > "LIVE BOOKS: Refresh from the web", the Command Palette, or Cmd/Ctrl+Shift+R (select the root node to refresh the entire outline). Choose Merge & augment (default — keep accurate content, fix outdated parts, fold in new info) or Overwrite/regenerate. By default every change is shown in a side-by-side preview with per-node accept/reject and nothing is applied until you approve; "Apply automatically without previewing" is an explicit opt-in that is off by default. Nodes you edited by hand are auto-skipped to protect your writing, with a per-node "Include anyway" override. Every refreshed node stores its sources and the model used — a compact "Sources" chip on the node shows the citations and attribution (e.g. "Refreshed with Gemini 2.5 Flash"), and this travels with the outline through save/export. Cloud AI uses live web search for real citations; local AI uses the model's built-in knowledge (no internet) and says so honestly rather than inventing sources. LIVE BOOKS is personal/local — it only changes your own copy after approval. It is built on a reusable transform engine that a future Translation feature will also use.

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
- Touch-accessible toolbar buttons mirror every keyboard shortcut for iPad/iPhone: Focus Mode (target icon), Collapse All / Expand All (double-chevron icon), Search, Command Palette, Quick Capture, and the Second Brain Brain menu. No iOS user is gated by a keyboard-only feature.

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

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

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
            <Button
              onClick={handleSend}
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
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
