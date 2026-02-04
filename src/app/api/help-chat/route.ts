import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';

// App context for AI to understand what IdiamPro does
const APP_CONTEXT = `You are a helpful assistant for IdiamPro, a professional outlining application with AI-powered features.

KEY FEATURES:
- Hierarchical outlining with drag & drop, indent/outdent
- AI-powered outline generation from topics
- Research & Import: Merge multiple sources (YouTube, PDFs, web pages, images, docs, audio, video, outline files) into unified outlines
- Rich content editor with markdown support, clipboard image paste (Cmd+V), drag-and-drop images, link paste (URLs auto-link, rich HTML links preserved)
- Multi-select nodes for bulk operations (delete, change color, add tags)
- Sidebar multi-select: Cmd/Ctrl+Click or Shift+Click outlines in the sidebar to select multiple, then bulk delete
- Sidebar search: Type in the search field below the Outlines header to filter outlines by name (works on desktop and mobile)
- Tags and color-coding for organization
- Automatic backups (Desktop): Every save creates a timestamped backup in the backups/ folder. Throttled to one per 5 minutes per outline. Last 10 backups kept per outline. Recover by renaming a backup file in Finder.
- Cross-platform: Web, macOS Desktop (Electron), iOS (Capacitor)
- File storage: iCloud Drive, Dropbox, Google Drive, local folders
- Google Docs/Sheets/Slides/Maps embedding via Insert menu
- Speech-to-text recording in the content pane via Web Speech API
- Export subtree to PDF: Right-click any node > "Export to PDF"
- Canvas/Drawing nodes (Excalidraw-based): Right-click > Set Type > Canvas
- Spreadsheet nodes (Fortune Sheet): Right-click > Set Type > Spreadsheet

CONTENT EDITOR:
- Rich text: Bold (Cmd+B), Italic (Cmd+I), Strikethrough, Headings (H1-H3)
- Lists: Ordered, unordered, and checklist lists
- Code blocks
- Undo (Cmd+Z), Redo (Cmd+Shift+Z)
- Google Docs/Sheets/Slides/Maps embedding via Insert menu (paste URL)
- Speech-to-text: Click microphone button, speak, text is transcribed locally

KEYBOARD SHORTCUTS (macOS/Desktop):
- Cmd+N: New outline
- Enter/Return: Create new sibling node
- Tab: Indent node
- Shift+Tab: Outdent node
- Cmd+K: Command palette (also: Expand All, Collapse All)
- Cmd+/: Toggle collapse
- Cmd+D: Duplicate node
- Cmd+Backspace: Delete node
- Cmd+Shift+F: Focus Mode (isolate subtree, Esc to exit)
- Ctrl+F: Search (current outline or all outlines)
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
- Long-press: Context menu

AI FEATURES:
- Generate outline from topic (Free tier: 10/month, Premium: 100/month)
- Expand node content with AI (Free: 50/month, Premium: 500/month)
- Create Content for Descendants: Right-click a parent > generates content for all children at once
- Research & Import synthesis (Free: 3 sources, Premium: 50+ sources). Nodes always have short names (2-6 words) as tree labels with detailed content in the content pane, even in comprehensive mode. Merging into an existing outline integrates content under shared themes rather than appending separately.
- Knowledge Chat: Query your outlines with natural language. Click the brain icon (blue) in the toolbar. Two modes: Current Outline (queries active outline) or All Outlines / Second Brain (queries all outlines at once). AI answers based only on your outline content, referencing specific sections. Responses stream in word-by-word for immediate feedback.
- Local AI / Ollama: Settings > AI Provider. Choose Cloud, Local (Ollama on localhost:11434), or Auto. Recommended models: llama3.2, phi3, llama3.1
- Pending Import Recovery (Desktop): If import times out or app closes, result is saved and recovery dialog appears on next launch
- Unmerge: After merging research into an existing outline, reopen the Research & Import dialog to find an "Unmerge" button at the bottom left. Click it to restore the outline to its pre-merge state. The backup persists across app restarts. Only the most recent merge can be unmerged.
- Generate Podcast: Right-click any node > "Generate Podcast". Choose a style (Two-Host, Narrator, Interview, Debate), assign voices, pick a length (Brief/Standard/Detailed), and select audio quality (Standard/HD). AI generates a script via Gemini, then synthesizes speech via OpenAI TTS. Preview the audio in-app and save as MP3. All preferences (style, voices, length, quality) are remembered across sessions. Requires OPENAI_API_KEY.

TOOLBAR BUTTONS:
- Plus icon: Create new node
- Library icon (red): Research & Import (merge multiple sources)
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

MOBILE:
- Stacked View: outline + content side by side
- Content View: full-screen editor mode
- Toggle between views with the toolbar button

Answer user questions clearly and concisely. If they ask how to do something, provide step-by-step instructions. Be friendly and encouraging.`;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(request: NextRequest) {
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
      model: 'googleai/gemini-2.0-flash',
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
