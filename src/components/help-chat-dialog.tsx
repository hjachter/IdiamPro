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
- Sidebar multi-select: Cmd/Ctrl+Click or Shift+Click outlines in the sidebar to select multiple, then bulk delete
- Sidebar search: Type in the search field below the Outlines header to filter outlines by name (works on desktop and mobile)
- Tags and color-coding for organization
- Automatic backups (Desktop): Every save creates a timestamped backup in the backups/ folder. Throttled to one per 5 minutes per outline. Last 10 backups kept per outline. Recover by renaming a backup file in Finder.
- Cross-platform: Web, macOS Desktop (Electron), iOS (Capacitor)
- File storage: iCloud Drive, Dropbox, Google Drive, local folders
- Google Docs/Sheets/Slides/Maps embedding via Insert menu
- Speech-to-text recording in the content pane via Web Speech API
- Export: Multi-format export system. Right-click any node > "Export Subtree..." or use dropdown menu > "Export Current Outline". Formats include PDF, Markdown, Plain Text, HTML Website (collapsible), OPML, Obsidian (wiki-links), CSV, JSON Tree.
- Import: Multi-format import. Dropdown menu > "Import Outline". Supports Markdown (.md - heading hierarchy), Plain Text (.txt - indentation), OPML (.opml - standard outline XML), JSON/IDM (native format). Drag-and-drop or browse to select. Auto-detects format.
- Canvas/Drawing nodes (Excalidraw-based): Right-click > Set Type > Canvas
- Spreadsheet nodes (Fortune Sheet): Right-click > Set Type > Spreadsheet

CONTENT EDITOR:
- Rich text: Bold (Cmd+B), Italic (Cmd+I), Strikethrough, Headings (H1-H3)
- Lists: Ordered, unordered, and checklist lists
- Code blocks
- Undo (Cmd+Z), Redo (Cmd+Shift+Z)
- Google Docs/Sheets/Slides/Maps embedding via Insert menu (paste URL)
- Speech-to-text: Click microphone button, speak, text is transcribed locally

KEYBOARD SHORTCUTS:
- Cmd+N: New outline
- Enter/Return: Create new sibling node
- Tab: Indent node
- Shift+Tab: Outdent node
- Cmd+K: Command palette (also: Expand All, Collapse All)
- Cmd+/: Toggle collapse
- Cmd+D: Duplicate node
- Delete/Backspace: Delete selected node (with confirmation if enabled)
- Cmd+Backspace: Delete node
- Cmd+Shift+F: Focus Mode (isolate subtree, Esc to exit)
- Ctrl+F: Search (current outline or all outlines). Collapsed nodes containing matches auto-expand to reveal results.
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
- Long-press: Context menu

AI FEATURES:
- Generate outline from topic (Free tier: 10/month, Premium: 100/month)
- Expand node content with AI (Free: 50/month, Premium: 500/month)
- Create Content for Descendants: Right-click a parent > generates content for all children at once
- Research & Import synthesis (Free: 3 sources, Premium: 50+ sources). Nodes always have short names (2-6 words) as tree labels with detailed content in the content pane, even in comprehensive mode. Merging into an existing outline integrates content under shared themes rather than appending separately.
- Knowledge Chat: Query your outlines with natural language. Click the brain icon (blue) in the toolbar. Two modes: Current Outline (queries active outline) or All Outlines / Second Brain (queries all outlines at once). AI answers based only on your outline content, referencing specific sections. Responses stream in word-by-word for immediate feedback.
- Local AI / Ollama: Settings > AI Provider. Choose Cloud, Local (Ollama on localhost:11434), or Auto. Recommended models: llama3.2, phi3, llama3.1
- Pending Import Recovery (Desktop): If import times out or app closes, result is saved and recovery dialog appears on next launch
- Unmerge: After merging research into an existing outline, an Unmerge button (orange circular arrow) appears in the toolbar right after the Research & Import button. Click it to restore the outline to its pre-merge state. The button persists until you click it or perform another merge. You can freely edit the outline and still unmerge later. The backup survives app restarts. Only the most recent merge can be unmerged.
- Generate Podcast: Right-click any node > "Generate Podcast". Choose a style (Two-Host, Narrator, Interview, Debate), assign voices, pick a length (Brief/Standard/Detailed), and select audio quality (Standard/HD). AI generates a script via Gemini, then synthesizes speech via OpenAI TTS. Preview the audio in-app and save as MP3. All preferences (style, voices, length, quality) are remembered across sessions. Requires OPENAI_API_KEY.

MOBILE:
- Stacked View: outline + content side by side
- Content View: full-screen editor mode
- Toggle between views with the toolbar button

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
            <div className="p-2 bg-red-500/10 rounded-lg">
              <CircleHelp className="h-6 w-6 text-red-500" />
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
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-500/10 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-violet-500" />
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
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-500/10 flex items-center justify-center">
                  <Loader2 className="h-4 w-4 text-violet-500 animate-spin" />
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
