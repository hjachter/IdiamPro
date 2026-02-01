import { v4 as uuidv4 } from 'uuid';
import type { Outline, NodeMap, OutlineNode } from '@/types';
import { calculateNodePrefix } from './outline-utils';

function createNode(
  nodes: NodeMap,
  id: string,
  parentId: string | null,
  name: string,
  content: string,
  childrenIds: string[] = []
): void {
  const type = childrenIds.length > 0 ? 'chapter' : 'document';
  const node: OutlineNode = { id, parentId, name, type, content, childrenIds, isCollapsed: false, prefix: '' };
  nodes[id] = node;

  if (parentId) {
      nodes[parentId].childrenIds.push(id);
  }
}

function createGuideNodes(): { rootNodeId: string, nodes: NodeMap } {
  const nodes: NodeMap = {};

  const rootId = 'guide-root';
  createNode(nodes, rootId, null, "IdiamPro User Guide", `Welcome to IdiamPro - an AI-native outlining platform that transforms scattered information into structured, actionable knowledge.

**What Makes IdiamPro Different**

Unlike traditional note-taking apps, IdiamPro combines hierarchical outlining with powerful AI synthesis. Import content from multiple sources - YouTube videos, PDFs, web pages, audio recordings, documents - and let AI find connections, identify themes, and create unified outlines automatically.

**Key Workflow Applications**

HIGH IMPACT:
• Meeting & Interview Synthesis - Record conversations, transcribe with speaker identification, get structured notes. Merge multiple meetings into a unified knowledge base.
• Video Course Note-Taking - Import YouTube lectures, get structured outlines automatically. Combine multiple videos on the same topic into comprehensive study guides.
• Research Aggregation - Import multiple PDFs, articles, and videos. AI finds connections across sources and creates unified research documents.
• Competitive Intelligence - Ingest competitor websites, product videos, press releases. Synthesize into strategic overviews.

PROFESSIONAL APPLICATIONS:
• Legal Discovery & Case Prep - Import depositions, documents, evidence into structured case outlines.
• Content Repurposing - Turn podcasts and videos into written outlines for blogs, courses, or books.
• Onboarding Documentation - Merge existing docs, wikis, and recorded tribal knowledge into structured guides.
• Client Project Briefs - Combine emails, calls, and reference materials into unified project scopes.

SPECIALIZED USES:
• Investment Analysis - Earnings calls, SEC filings, news articles synthesized into investment theses.
• Book/Thesis Writing - Import research sources, interviews, prior drafts into structured outlines.
• Event Planning - Vendor proposals, venue info, stakeholder requirements unified into event plans.

**Getting Started**

Click any item in the outline pane (left) to see details in the content pane (right). Use the Research & Import button (upload icon) to bring in external content. All your work saves automatically.

This guide cannot be deleted, but you can copy it to create your own customized version.`, []);

  // === GETTING STARTED ===
  const gettingStartedId = uuidv4();
  const autoSaveId = uuidv4();
  const toolbarId = uuidv4();

  createNode(nodes, gettingStartedId, rootId, "Getting Started", "IdiamPro helps you organize your thoughts into structured outlines. The interface has two main areas: the outline pane on the left shows your hierarchical structure, and the content pane on the right lets you edit the selected node's content. Everything saves automatically to your browser - just start working and your changes are preserved.", []);
  createNode(nodes, autoSaveId, gettingStartedId, "Auto-Save", "All changes are saved automatically to your browser's storage. No save button needed - your work is always preserved. Just refresh the page to confirm your outline persists.");
  createNode(nodes, toolbarId, gettingStartedId, "Toolbar Icons", "The toolbar uses icon buttons with hover tooltips:\n\n+ (Plus) - Add a new sibling node\n\nTrash (Red) - Delete selected node\n\nUpload Arrow - Import media (photos, videos, PDFs, YouTube)\n\nSparkles (Violet) - AI features\n\nImage (Violet) - Generate AI images (Premium)");

  // === MANAGING OUTLINES ===
  const manageId = uuidv4();
  const createNewId = uuidv4();
  const switchId = uuidv4();
  const renameOutlineId = uuidv4();
  const deleteOutlineId = uuidv4();
  const importExportId = uuidv4();
  const autoBackupId = uuidv4();

  createNode(nodes, manageId, rootId, "Managing Outlines", "IdiamPro supports multiple outlines, each stored separately. Use the dropdown menu at the top of the outline pane (showing the current outline name) to switch between outlines, create new ones, rename, delete, or import/export. The guide outline is special - it's restored automatically and cannot be deleted or renamed.", []);
  createNode(nodes, createNewId, manageId, "Creating a New Outline", "Click the dropdown menu (shows current outline name) and select 'New Outline'. A new untitled outline is created and becomes your active outline. It starts with just a root node - add children to build your structure.");
  createNode(nodes, switchId, manageId, "Switching Outlines", "Click the dropdown menu to see all your outlines. Click any outline name to switch to it. The app remembers which outline you were working on.");
  createNode(nodes, renameOutlineId, manageId, "Renaming an Outline", "Two ways to rename:\n\n1. Use the dropdown menu > 'Rename' option\n\n2. Double-click the root node name - this updates both the node and outline name");
  createNode(nodes, deleteOutlineId, manageId, "Deleting an Outline", "Use the dropdown menu > 'Delete' option. A confirmation dialog appears before deletion. You cannot delete the guide outline or your last remaining outline - the app always keeps at least one user outline.");
  createNode(nodes, importExportId, manageId, "Import/Export", "From the dropdown menu:\n\n'Export Current Outline' - Downloads as JSON file\n\n'Import Outline' - Load a previously exported JSON file");
  createNode(nodes, autoBackupId, manageId, "Automatic Backups", "On the desktop (Electron) app, IdiamPro automatically creates timestamped backups every time you save an outline.\n\n**How it works:**\n- A backup copy is saved to the 'backups' folder inside your outlines directory\n- Backups are named like: MyOutline_backup_2026-01-31T04-38-12.idm\n- Backups are throttled to at most one every 5 minutes per outline, so rapid edits don't flood your disk\n- The last 10 backups per outline are kept; older ones are automatically pruned\n\n**Recovery:**\nIf you need to recover a previous version, open Finder and navigate to your outlines folder > backups. Find the backup file with the timestamp you want and rename it to replace the original .idm file (remove the _backup_timestamp part).\n\n**Note:** Automatic backups are only available in the desktop Electron app. The web version relies on browser storage.");

  // === WORKING WITH NODES ===
  const workingId = uuidv4();
  const addNodeId = uuidv4();
  const renameNodeId = uuidv4();
  const deleteNodeId = uuidv4();
  const selectNodeId = uuidv4();

  createNode(nodes, workingId, rootId, "Working with Nodes", "Nodes are the building blocks of your outline. Each node has a name (shown in the outline pane) and content (shown in the content pane when selected). Nodes can be nested to create hierarchical structures - a node with children becomes a 'chapter' while leaf nodes are 'documents'. The root node represents your entire outline and cannot be deleted.", []);
  createNode(nodes, addNodeId, workingId, "Adding Nodes", "Select a node, then click the + button. The new node appears as a sibling AFTER the selected node. If you select the root node, the new node becomes a child of root.");
  createNode(nodes, renameNodeId, workingId, "Renaming Nodes", "Double-click any node name to edit it. Press Enter to save, or Escape to cancel. You can rename the root node too - this also updates the outline name.");
  createNode(nodes, deleteNodeId, workingId, "Deleting Nodes", "Select a node, then click the red trash icon. A confirmation dialog appears. Deleting a node also deletes all its children. You cannot delete the root node.");
  createNode(nodes, selectNodeId, workingId, "Selecting Nodes", "Click any node to select it. The selected node is highlighted, and its content appears in the right pane for editing.");

  // === ORGANIZING WITH DRAG & DROP ===
  const organizeId = uuidv4();
  const dragRulesId = uuidv4();
  const dropZonesId = uuidv4();
  const keyboardId = uuidv4();
  const visualFeedbackId = uuidv4();

  createNode(nodes, organizeId, rootId, "Organizing with Drag & Drop", "Restructure your outline by dragging nodes to new positions. Click and hold any node (except root) to drag it. As you drag over other nodes, visual indicators show where the node will be placed. You can also use keyboard shortcuts (Tab/Shift+Tab) to indent and outdent nodes quickly.", []);
  createNode(nodes, dragRulesId, organizeId, "Drag Rules", "- Any node except root can be dragged\n- Cannot drop a node onto itself\n- Cannot drop a parent into its own children (prevents loops)\n- Dropping onto root always places inside root");
  createNode(nodes, dropZonesId, organizeId, "Drop Zones", "When dragging over a node, three zones determine placement:\n\nTop 30% - Drop BEFORE (becomes previous sibling)\n\nMiddle 40% - Drop INSIDE (becomes child)\n\nBottom 30% - Drop AFTER (becomes next sibling)\n\nDropping inside a leaf node converts it to a chapter.");
  createNode(nodes, keyboardId, organizeId, "Keyboard Shortcuts", "Tab - Indent node (move inside previous sibling)\n\nShift+Tab - Outdent node (move after parent)\n\nThese only work when a node is selected and the action is valid.");
  createNode(nodes, visualFeedbackId, organizeId, "Visual Feedback", "While dragging:\n\n- Blue line shows before/after position\n- Dashed border shows inside (nesting) position\n- Dragged node becomes semi-transparent\n- Cursor changes to grab hand");

  const focusModeId = uuidv4();
  const searchFeaturesId = uuidv4();
  const expandCollapseAllId = uuidv4();
  const arrowNavId = uuidv4();
  const exportPdfId = uuidv4();

  createNode(nodes, focusModeId, organizeId, "Focus Mode", "Isolate a subtree to work without distraction.\n\nHow to use:\n1. Select any node\n2. Press Cmd+Shift+F to enter Focus Mode\n3. Only the selected node and its descendants are visible\n4. Press Esc to exit Focus Mode and return to the full outline\n\nFocus Mode is useful when working on one section of a large outline. All editing features work normally while focused.");

  createNode(nodes, searchFeaturesId, organizeId, "Search", "Find nodes across your outlines.\n\nHow to use:\n1. Press Ctrl+F to open the search panel\n2. Type your search query\n3. Results appear as you type\n\n**Scope Toggle:**\n- Search the current outline only\n- Search across all outlines\n\n**What's Searched:**\n- Node names\n- Node content\n\n**Navigation:**\n- Use Prev/Next buttons to jump between results\n- Click any result to select that node");

  createNode(nodes, expandCollapseAllId, organizeId, "Expand All / Collapse All", "Quickly expand or collapse every node in your outline.\n\nHow to use:\n1. Press Cmd+K to open the Command Palette\n2. Type 'Expand All' or 'Collapse All'\n3. Select the action\n\nExpand All opens every collapsed node so you can see the full hierarchy. Collapse All folds everything to show only top-level nodes.");

  createNode(nodes, arrowNavId, organizeId, "Arrow Key Navigation", "Navigate your outline quickly with arrow keys.\n\n- Up Arrow: Move selection to the previous visible node\n- Down Arrow: Move selection to the next visible node\n- Left Arrow: Collapse the selected node (if expanded) or move to parent\n- Right Arrow: Expand the selected node (if collapsed) or move to first child\n\nCombine with other shortcuts for fast editing: navigate with arrows, then press Enter to rename, Tab to indent, or Delete to remove.");

  createNode(nodes, exportPdfId, organizeId, "Export Subtree to PDF", "Export any node and its descendants as a formatted PDF.\n\nHow to use:\n1. Right-click any node\n2. Select 'Export to PDF'\n3. A PDF file is generated and downloaded\n\nThe PDF includes the selected node and all its descendants, formatted with headings based on hierarchy depth. Useful for sharing sections of your outline as standalone documents.");

  // === AI FEATURES (Expanded) ===
  const aiId = uuidv4();
  const aiPlansId = uuidv4();
  const aiMenuId = uuidv4();
  const aiGenerateOutlineId = uuidv4();
  const aiGenerateContentId = uuidv4();
  const aiGenerateHowId = uuidv4();
  const aiGenerateContextId = uuidv4();
  const aiGenerateConflictId = uuidv4();
  const aiIngestId = uuidv4();
  const aiIngestSourcesId = uuidv4();
  const aiIngestPreviewId = uuidv4();
  const aiIngestMergeId = uuidv4();
  const aiImageGenId = uuidv4();
  const aiSafetyId = uuidv4();

  createNode(nodes, aiId, rootId, "AI Features", "IdiamPro includes powerful AI capabilities to help you generate content, create images, and build outlines faster. AI features are accessed through the violet sparkles icon and the image button in the toolbar.", []);

  // AI Plans
  createNode(nodes, aiPlansId, aiId, "AI Plans (FREE vs PREMIUM)", "IdiamPro offers two AI plans:\n\nFREE Plan:\n- AI content generation\n- External source ingestion\n- Standard AI processing\n\nPREMIUM Plan ($9.99/month):\n- All FREE features\n- AI image generation\n- Advanced AI model\n- Subtree summaries\n- Teach mode\n- Consistency checks\n- Priority processing\n- RAG-powered knowledge base (coming soon): Semantic search across all your outlines using vector embeddings for faster, more accurate cross-outline queries\n\nTo manage your plan: Click the AI menu (sparkles icon) > 'Manage AI Plan...'");

  // AI Menu
  createNode(nodes, aiMenuId, aiId, "AI Menu & Settings", "Access all AI features from a single menu:\n\n1. Click the violet sparkles icon in the toolbar\n2. The AI menu shows:\n   - Generate Outline from Topic\n   - Ingest External Source...\n   - Manage AI Plan...\n\nYour current plan (Free or Premium) is shown in the menu header.");

  // Generate Outline from Topic
  createNode(nodes, aiGenerateOutlineId, aiId, "Generate Outline from Topic", "Create a complete structured outline from any topic:\n\n1. Click AI menu > 'Generate Outline from Topic'\n2. Enter your topic (e.g., 'The History of Space Exploration')\n3. Click 'Generate'\n4. A NEW outline is created with the topic as its name\n\nThis creates a separate outline - your current work is never modified.");

  // Generate Content for Node
  createNode(nodes, aiGenerateContentId, aiId, "Generate Content for Node", "AI can write detailed content for any node in your outline.\n\nThe AI analyzes your node's title and its position in the hierarchy to generate relevant, contextual content. You control whether to replace existing content, append to it, or cancel.\n\nThe generation considers your outline structure from root to the selected node, ensuring thematic consistency.", []);
  createNode(nodes, aiGenerateHowId, aiGenerateContentId, "How to Trigger", "1. Select any node (except root)\n2. Click the violet sparkles button in the content pane header\n3. AI generates content based on the node's title and context");
  createNode(nodes, aiGenerateContextId, aiGenerateContentId, "Context & Input", "The AI uses:\n- The node's name/title\n- The path of ancestor nodes (for context)\n- Any existing content (as a draft to consider)\n\nThis helps AI generate relevant, contextual content that fits your outline structure.");
  createNode(nodes, aiGenerateConflictId, aiGenerateContentId, "Replace vs Append", "If the node already has content, you'll see options:\n\n- Replace: Overwrite existing content with AI content\n- Append Below: Add AI content after existing content\n- Cancel: Keep existing content unchanged\n\nYour content is never changed without your explicit choice.");

  // Research & Import (formerly Ingest External Source)
  createNode(nodes, aiIngestId, aiId, "Research & Import", "The Research & Import feature is the heart of IdiamPro's power. Import content from multiple sources simultaneously, and AI will synthesize them into a unified, structured outline.\n\n**Key Capabilities:**\n• Multi-source synthesis - Import multiple sources at once, AI finds connections\n• Smart defaults - YouTube titles, AI-generated names, automatic introductions\n• Merge or create new - Default merges into current outline, or create fresh\n• Speaker diarization - Audio recordings identify different speakers\n\n**Access:** Click the upload arrow icon in the toolbar, or AI menu > 'Research & Import'", []);
  createNode(nodes, aiIngestSourcesId, aiIngestId, "Supported Sources", "**YouTube Videos**\n• Paste any YouTube URL\n• Transcript extracted automatically\n• Video title becomes default outline name\n\n**Conversation/Audio**\n• Paste transcript directly\n• Upload audio file for transcription\n• Record live with microphone\n• Speaker diarization identifies who said what\n\n**Documents**\n• PDF files (URL or upload)\n• Word, Excel, PowerPoint\n• Images with OCR text extraction\n\n**Other**\n• Web pages (URL)\n• Plain text/notes\n• Existing outline files (.idm)\n• Video files (audio extracted)");
  createNode(nodes, aiIngestPreviewId, aiIngestId, "Smart Naming & Summaries", "**Automatic Outline Naming:**\n• YouTube videos → Uses video title\n• Other sources → AI generates concise title from content\n• Fallback → Date-based name\n\n**Root Node Introduction:**\nWhen creating a new outline (not merging), the root node automatically gets an AI-generated introduction that summarizes all the content below it. This helps readers quickly understand the context.\n\n**Chapter Introductions:**\nParent/chapter nodes include introductory content that previews their children - no empty headers.");
  createNode(nodes, aiIngestMergeId, aiIngestId, "Merge vs New Outline", "**Default: Merge into Current Outline**\n• New content is synthesized with your existing outline\n• AI finds connections between old and new material\n• Preserves your existing structure\n\n**Option: Create New Outline**\n• Check 'Create new outline instead'\n• Provide a name or let AI generate one\n• Your current outline is unchanged\n\nThe merge behavior ensures you can continuously build knowledge on a topic from multiple sources over time.");

  // Pending Import Recovery
  const pendingImportId = uuidv4();
  createNode(nodes, pendingImportId, aiIngestId, "Pending Import Recovery", "On the desktop (Electron) app, if a Research & Import operation times out or the app closes during an import, the result is saved automatically.\n\nOn next launch:\n1. A recovery dialog appears\n2. It shows the pending import that was interrupted\n3. You can choose to apply the import or discard it\n\nThis ensures you never lose a long-running import due to network issues or accidental app closure.");

  // Undo Merge
  const undoMergeId = uuidv4();
  createNode(nodes, undoMergeId, aiIngestId, "Unmerge", "When merging research into an existing outline, a snapshot of your outline is taken before the merge begins.\n\nIf the merge produces bad results, open the Research & Import dialog again. An **Unmerge** button appears at the bottom left (next to Cancel and Synthesize) whenever a merge can be reverted. Clicking it restores your outline to its exact pre-merge state.\n\nThe backup is persisted to disk, so the Unmerge button survives app restarts. Only the most recent merge can be unmerged — performing another merge overwrites the previous backup.");

  // AI Image Generation
  createNode(nodes, aiImageGenId, aiId, "AI Image Generation (Premium)", "Create custom illustrations with AI:\n\n1. Click the violet Image button in the content toolbar\n2. Describe the image you want (be specific about style, colors, composition)\n3. Choose an aspect ratio (square, landscape, portrait)\n4. Click 'Generate Image'\n\nThe AI-generated image is inserted directly into your content.\n\n**Tips for better results:**\n• Be specific: 'A serene mountain lake at sunset with purple sky' vs 'a lake'\n• Mention style: 'digital art', 'watercolor', 'photorealistic', 'minimalist'\n• Include composition details: 'close-up', 'wide angle', 'from above'\n\n**Note:** This feature requires a Premium plan.");

  // Create Content for Descendants
  const aiDescendantsId = uuidv4();
  createNode(nodes, aiDescendantsId, aiId, "Create Content for Descendants", "Generate AI content for all child nodes of a parent at once.\n\nHow to use:\n1. Right-click a parent node (one that has children)\n2. Select 'Create Content for Descendants'\n3. AI generates content for every child node based on its title and context\n\nThis is a fast way to flesh out an entire section of your outline. Each child node receives content tailored to its title and position in the hierarchy. Existing content in child nodes is preserved - only empty nodes get new content.");

  // Local AI / Ollama
  const aiOllamaId = uuidv4();
  createNode(nodes, aiOllamaId, aiId, "Local AI / Ollama", "Run AI features using a local model instead of cloud services.\n\nSetup:\n1. Install Ollama (ollama.ai) on your machine\n2. Pull a model: ollama pull llama3.2\n3. In IdiamPro: Settings > AI Provider\n4. Choose 'Local (Ollama)' or 'Auto'\n\n**Provider Options:**\n- Cloud: Uses cloud AI (default)\n- Local (Ollama): Uses your local Ollama instance on localhost:11434\n- Auto: Tries local first, falls back to cloud if unavailable\n\n**Recommended Models:**\n- llama3.2 — Fast, good general quality\n- phi3 — Lightweight, quick responses\n- llama3.1 — Higher quality, slower\n\nLocal AI keeps your data on your machine and works offline.");

  // Safety & Control
  createNode(nodes, aiSafetyId, aiId, "Safety & Control", "You're always in control:\n\n- All AI content is fully editable - change or delete anything\n- Preview mode shows changes before they're applied\n- No automatic modifications to your content\n- Auto-save preserves all changes (including AI content)\n- Undo by using browser back or editing content\n\nAI is a tool to help you - the final decisions are always yours.");

  // Knowledge Chat
  const knowledgeChatId = uuidv4();
  const kcQueryId = uuidv4();
  const kcCurrentModeId = uuidv4();
  const kcAllModeId = uuidv4();
  const kcTipsId = uuidv4();

  createNode(nodes, knowledgeChatId, aiId, "Knowledge Chat", "Query your outlines with natural language. Ask questions, find information, and discover connections across your content using AI.\n\n**Access:** Click the brain icon (blue) in the toolbar.\n\n**Two Modes:**\n- Current Outline — queries only the active outline\n- All Outlines (Second Brain) — queries all your outlines at once\n\nThe AI answers based only on your outline content, referencing specific sections and making cross-outline connections.\n\n**Streaming Responses:** Answers appear word-by-word as they're generated, so you see the first words within 1-2 seconds instead of waiting for the full response.", []);

  createNode(nodes, kcQueryId, knowledgeChatId, "Querying Your Outlines", "How to use Knowledge Chat:\n\n1. Click the brain icon (blue) in the toolbar\n2. The chat dialog opens with your current outline loaded\n3. Type a question in natural language\n4. The AI responds using information from your outlines\n\n**Example questions:**\n- 'What are the key findings from my research?'\n- 'Summarize the Q1 goals'\n- 'What connections exist between marketing and product?'\n- 'Find everything related to budget constraints'");

  createNode(nodes, kcCurrentModeId, knowledgeChatId, "Current Outline Mode", "Queries only the currently selected outline.\n\nBest for:\n- Focused questions about one topic\n- Finding specific details within a document\n- Working with very large outlines\n\nThe context info bar shows the outline name, node count, and estimated token usage.");

  createNode(nodes, kcAllModeId, knowledgeChatId, "Second Brain Mode (All Outlines)", "Queries all your outlines simultaneously.\n\nBest for:\n- Finding connections across different topics\n- Research synthesis — 'What do my sources say about X?'\n- Memory recall — 'Where did I write about Y?'\n- Cross-referencing information\n\n**Desktop (Electron):** Uses a pre-built knowledge base file that's automatically kept in sync when you save, rename, or delete outlines.\n\n**Web:** Serializes all in-memory outlines on the fly.\n\nThe context info bar shows how many outlines and nodes are included.");

  createNode(nodes, kcTipsId, knowledgeChatId, "Tips & Use Cases", "**Research Synthesis:**\nImport multiple sources with Research & Import, then use Knowledge Chat to ask cross-cutting questions.\n\n**Memory Recall:**\nCan't remember where you wrote something? Ask 'Where did I mention...' in All Outlines mode.\n\n**Finding Connections:**\nAsk 'What connections exist between [topic A] and [topic B]?' to discover relationships you might have missed.\n\n**Token Limits:**\n- A warning appears if context exceeds 500K tokens\n- If it exceeds 1M tokens, switch to Current Outline mode\n- Most outlines are well within limits");

  // === IMPORTING MEDIA ===
  const mediaId = uuidv4();
  const photoId = uuidv4();
  const videoId = uuidv4();
  const youtubeId = uuidv4();
  const pdfId = uuidv4();
  const drawingId = uuidv4();
  const fullscreenId = uuidv4();

  createNode(nodes, mediaId, rootId, "Importing Media", "Add photos, videos, PDFs, and other media to your content using the Insert menu (+ icon) or by dragging files directly into the content pane. Media is embedded inline and saved with your outline.", []);
  createNode(nodes, photoId, mediaId, "Photos & Images", "Insert images from your device:\n\n1. Click the + (Insert) menu in the content toolbar\n2. Select 'Import Photo'\n3. Choose an image file (JPEG, PNG, etc.)\n\nOr simply drag and drop an image file into the content pane.\n\nImages are stored directly in your outline - no external hosting needed.");
  createNode(nodes, videoId, mediaId, "Video Files", "Insert video files from your device:\n\n1. Click the + (Insert) menu in the content toolbar\n2. Select 'Import Video'\n3. Choose a video file (MP4, MOV, etc.)\n\nVideos include full playback controls (play, pause, seek, volume). Note: Large videos increase outline file size.");
  createNode(nodes, youtubeId, mediaId, "YouTube Videos", "Embed YouTube videos that stream directly:\n\n1. Click the + (Insert) menu > 'YouTube Video'\n2. Paste any YouTube URL\n3. The video embeds with full playback controls\n\nYouTube videos stream from YouTube's servers - they don't increase your outline size.");
  createNode(nodes, pdfId, mediaId, "PDF Documents", "Embed PDFs from the web:\n\n1. Click the + (Insert) menu > 'PDF from URL'\n2. Enter the full URL of a publicly accessible PDF\n3. The PDF displays in an embedded viewer\n\nNote: The PDF must be publicly accessible (direct link ending in .pdf).");
  createNode(nodes, drawingId, mediaId, "Drawings & Sketches", "Create freehand drawings:\n\n1. Click the + (Insert) menu > 'Drawing'\n2. Use the drawing canvas to sketch\n3. Click 'Insert' to add to your content\n\nDrawings are saved as images in your outline.");
  createNode(nodes, fullscreenId, mediaId, "Fullscreen Viewing", "Double-click any image, video, or diagram to view it fullscreen. This is especially useful for:\n\n- Reading details in photos\n- Viewing diagrams at full size\n- Watching videos without distraction\n\nClick outside the content or press the X button to close fullscreen view.");

  const richTextId = uuidv4();
  const googleDocsId = uuidv4();
  const googleSheetsId = uuidv4();
  const googleSlidesId = uuidv4();
  const googleMapsId = uuidv4();
  const speechToTextId = uuidv4();

  createNode(nodes, richTextId, mediaId, "Rich Text Formatting", "The content editor supports full rich text formatting:\n\n**Text Styling:**\n- Bold: Cmd+B (Ctrl+B on Windows)\n- Italic: Cmd+I (Ctrl+I on Windows)\n- Strikethrough\n\n**Headings:**\n- H1, H2, H3 heading levels\n\n**Lists:**\n- Ordered (numbered) lists\n- Unordered (bullet) lists\n- Checklist (task) lists with checkboxes\n\n**Code:**\n- Code blocks with syntax formatting\n\n**Undo/Redo:**\n- Undo: Cmd+Z (Ctrl+Z)\n- Redo: Cmd+Shift+Z (Ctrl+Shift+Z)\n\nAll formatting is preserved when you switch between nodes or close the app.");

  createNode(nodes, googleDocsId, mediaId, "Google Docs Embedding", "Embed Google Docs directly in your content:\n\n1. Click the + (Insert) menu in the content toolbar\n2. Paste a Google Docs URL\n3. The document renders as an inline preview\n\nThe embedded doc displays within your content pane. The document must be publicly shared or shared with you.");

  createNode(nodes, googleSheetsId, mediaId, "Google Sheets Embedding", "Embed Google Sheets directly in your content:\n\n1. Click the + (Insert) menu in the content toolbar\n2. Paste a Google Sheets URL\n3. The spreadsheet renders as an inline preview\n\nUseful for referencing live data, shared budgets, or tracking sheets within your outline.");

  createNode(nodes, googleSlidesId, mediaId, "Google Slides Embedding", "Embed Google Slides presentations directly in your content:\n\n1. Click the + (Insert) menu in the content toolbar\n2. Paste a Google Slides URL\n3. The presentation renders as an inline preview\n\nGreat for referencing presentations alongside your outline notes.");

  createNode(nodes, googleMapsId, mediaId, "Google Maps Embedding", "Embed Google Maps directly in your content:\n\n1. Click the + (Insert) menu in the content toolbar\n2. Paste a Google Maps URL\n3. The map renders as an inline preview\n\nUseful for event planning, travel outlines, or location-based research.");

  createNode(nodes, speechToTextId, mediaId, "Speech-to-Text", "Record audio and have it transcribed to text directly in the content pane.\n\nHow to use:\n1. Click the microphone button in the content toolbar\n2. Speak into your microphone\n3. Your speech is transcribed to text in real time via the Web Speech API\n\nNote: Requires browser microphone permission. Works best in Chrome and Edge. Transcription happens locally in your browser - no audio is sent to external servers.");

  // === ADVANCED NODE FEATURES ===
  const advancedId = uuidv4();
  const nodeTypesId = uuidv4();
  const taskNodesId = uuidv4();
  const linkNodesId = uuidv4();
  const codeNodesId = uuidv4();
  const quoteNodesId = uuidv4();
  const dateNodesId = uuidv4();
  const tagsId = uuidv4();
  const colorsId = uuidv4();
  const pinningId = uuidv4();

  createNode(nodes, advancedId, rootId, "Advanced Node Features", "IdiamPro supports specialized node types, organization tools like tags and colors, and pinning important nodes. These features help you create more structured and visually organized outlines.", []);

  createNode(nodes, nodeTypesId, advancedId, "Node Types", "Beyond standard document and chapter nodes, IdiamPro supports several specialized node types, each with unique editors and functionality. Access these by right-clicking a node and selecting 'Set Type' from the context menu.", []);

  createNode(nodes, taskNodesId, nodeTypesId, "Task/Checklist Nodes", "Task nodes display a checkbox that you can click to mark items as complete. Completed tasks show strikethrough text.\n\nFeatures:\n- Click the checkbox to toggle completion\n- Completed tasks are visually distinguished\n- Perfect for to-do lists and action items\n- Can still have full rich text content");

  createNode(nodes, linkNodesId, nodeTypesId, "Link/Bookmark Nodes", "Link nodes store URLs and provide quick access to external resources.\n\nFeatures:\n- URL input field in the content pane\n- 'Open Link' button to visit the URL\n- Click the node name to open in new tab\n- Blue underlined styling indicates it's a link\n- Store notes about the link in the content area");

  createNode(nodes, codeNodesId, nodeTypesId, "Code Snippet Nodes", "Code nodes provide syntax-highlighted code editing with support for 13+ programming languages.\n\nFeatures:\n- Language selector (JavaScript, Python, TypeScript, Java, C#, PHP, Ruby, Go, Rust, SQL, JSON, CSS, HTML)\n- Syntax highlighting with Prism.js\n- Monospace font\n- Copy button for quick code copying\n- Great for documentation and code examples");

  createNode(nodes, quoteNodesId, nodeTypesId, "Quote/Citation Nodes", "Quote nodes are designed for storing quotations with proper attribution.\n\nFeatures:\n- Dedicated quote text area with italic styling\n- Source/attribution field for crediting\n- Purple left border for visual distinction\n- Blockquote formatting\n- Perfect for research and references");

  createNode(nodes, dateNodesId, nodeTypesId, "Date/Event Nodes", "Date nodes help you track important dates and events.\n\nFeatures:\n- Date picker interface\n- Formatted date display (e.g., 'Monday, January 5, 2026')\n- Store notes about the event\n- Orange icon for visibility\n- Useful for timelines and planning");

  const canvasNodesId = uuidv4();
  const spreadsheetNodesId = uuidv4();

  createNode(nodes, canvasNodesId, nodeTypesId, "Canvas/Drawing Nodes", "Canvas nodes provide a full freeform drawing surface powered by Excalidraw.\n\nHow to use:\n1. Right-click a node > 'Set Type' > 'Canvas'\n2. The content pane becomes a drawing canvas\n3. Use the drawing tools to sketch, diagram, or annotate\n\nFeatures:\n- Full Excalidraw drawing tools (shapes, arrows, text, freehand)\n- Dark mode support\n- Saves as image data within your outline\n- Great for diagrams, flowcharts, wireframes, and visual notes");

  createNode(nodes, spreadsheetNodesId, nodeTypesId, "Spreadsheet Nodes", "Spreadsheet nodes embed a full spreadsheet editor powered by Fortune Sheet.\n\nHow to use:\n1. Right-click a node > 'Set Type' > 'Spreadsheet'\n2. The content pane becomes a spreadsheet grid\n3. Edit cells, enter formulas, and organize data\n\nFeatures:\n- 50 rows × 26 columns (A-Z)\n- Full cell editing with formulas\n- Data persists with your outline\n- Useful for budgets, tables, comparisons, and structured data");

  createNode(nodes, tagsId, advancedId, "Tags", "Organize nodes with colored tags. Tags help you categorize and filter content across your outline.\n\nFeatures:\n- Add multiple tags to any node\n- Colored badges appear next to node names\n- Click 'x' on a badge to remove a tag\n- Tag Manager dialog for managing all tags\n- Each tag automatically gets a distinct color\n- Future: Filter outline by tags");

  createNode(nodes, colorsId, advancedId, "Node Colors", "Add visual distinction to nodes with custom colors displayed as a left border.\n\nHow to use:\n- Right-click any node > 'Set Color'\n- Choose from 8 colors + default\n- 4px colored left border appears on the node\n- Great for prioritizing or categorizing\n- Works alongside chapter colors\n\nColors: Red, Orange, Yellow, Green, Blue, Purple, Pink");

  createNode(nodes, pinningId, advancedId, "Pinning Nodes", "Pin important nodes to keep them easily accessible.\n\nFeatures:\n- Star icon appears on hover\n- Click star to toggle pin status\n- Pinned nodes show filled yellow star\n- Visual highlighting for pinned items\n- Perfect for frequently accessed nodes");

  // === MULTI-SELECT & BULK OPERATIONS ===
  const multiSelectId = uuidv4();
  const selectingNodesId = uuidv4();
  const bulkOperationsId = uuidv4();

  createNode(nodes, multiSelectId, advancedId, "Multi-Select & Bulk Operations", "Select multiple nodes at once and perform bulk operations for efficient outline management.", []);

  createNode(nodes, selectingNodesId, multiSelectId, "Selecting Multiple Nodes", "Three ways to select multiple nodes:\n\n1. **Cmd/Ctrl + Click**: Toggle individual nodes in/out of selection\n   - Hold Cmd (Mac) or Ctrl (Windows/Linux)\n   - Click any node to add/remove from selection\n   - Selected nodes show blue ring and background\n\n2. **Shift + Click**: Select a range of nodes\n   - Select a node normally first\n   - Hold Shift and click another node\n   - All nodes between them are selected\n\n3. **Esc key**: Clear all selections\n   - Press Esc to deselect all nodes\n   - Returns to single-node selection mode");

  createNode(nodes, bulkOperationsId, multiSelectId, "Bulk Operations Toolbar", "When nodes are selected, a floating toolbar appears at the bottom with bulk actions:\n\n**Tag**: Add a tag to all selected nodes at once\n- Click Tag button\n- Enter tag name\n- Tag is added to all selected nodes\n\n**Color**: Change color of all selected nodes\n- Click Color button\n- Choose from 8 colors\n- All selected nodes get the new color\n\n**Delete**: Remove all selected nodes\n- Click Delete button\n- Confirmation dialog appears\n- All selected nodes and their children are deleted\n\n**Clear**: Deselect all nodes\n- Returns to normal selection mode\n\nThe toolbar shows how many nodes are selected (e.g., \"3 nodes selected\")");

  // === SIDEBAR FEATURES ===
  const sidebarMultiSelectId = uuidv4();
  const sidebarSearchId = uuidv4();

  createNode(nodes, sidebarMultiSelectId, advancedId, "Sidebar Multi-Select & Bulk Delete", "You can select multiple outlines in the sidebar and delete them in one step.\n\n**Selecting outlines:**\n- **Cmd/Ctrl + Click** an outline to toggle it in/out of selection\n- **Shift + Click** to select a range of outlines between the current and clicked outline\n\n**Bulk action bar:**\nWhen outlines are selected, a bar appears showing the count (e.g., \"3 selected\") along with Clear and Delete buttons.\n- **Clear** deselects all outlines\n- **Delete** opens a single confirmation dialog for the entire batch\n\n**Note:** The delete confirmation setting in Settings applies to both node deletion and outline deletion. If you have turned off confirmations, bulk delete will proceed immediately.");

  createNode(nodes, sidebarSearchId, advancedId, "Sidebar Search", "Quickly find outlines by name using the search field in the sidebar.\n\n**How to use:**\n1. Type in the search field below the Outlines header\n2. The list filters in real time to show only matching outlines\n3. The count updates to show matches vs total (e.g., \"5 / 42\")\n4. Click the X button or clear the text to show all outlines again\n\n**Details:**\n- Search is case-insensitive\n- The User Guide is also filtered by search\n- Available in both the desktop sidebar and the mobile sidebar sheet\n- On mobile, the search clears automatically when you select an outline");

  // === NODE NUMBERING ===
  const numberingId = uuidv4();

  createNode(nodes, numberingId, rootId, "Node Numbering", "Each node displays a numeric prefix (like 1.2.3) showing its position in the hierarchy. Prefixes update automatically when you reorganize nodes. The root node has no prefix.");

  // === MOBILE & iOS ===
  const mobileId = uuidv4();
  createNode(nodes, mobileId, rootId, "Mobile & iOS", "On mobile devices and iOS, IdiamPro adapts its interface to work well on smaller screens.\n\n**View Modes:**\nToggle between two view modes using the view switcher:\n\n- **Stacked View**: Shows both the outline pane and content pane side by side (or stacked vertically on narrow screens). Good for quick navigation between nodes.\n- **Content View**: Shows only the content editor in full-screen mode. Ideal for focused writing and editing on mobile.\n\nSwitch between views using the toggle button in the toolbar. Your selected view mode is remembered across sessions.");

  // Set types and prefixes
  Object.keys(nodes).forEach(nodeId => {
    const node = nodes[nodeId];
    if (node.childrenIds.length > 0) {
      node.type = 'chapter';
    }
    node.prefix = calculateNodePrefix(nodes, nodeId);
  });

  nodes[rootId].type = 'root';
  nodes[rootId].prefix = '';

  return { rootNodeId: rootId, nodes };
}

export function getInitialGuide(): Outline {
  const { rootNodeId, nodes } = createGuideNodes();
  return {
    id: 'guide',
    name: 'IdiamPro User Guide',
    rootNodeId,
    nodes,
    isGuide: true,
  };
}
