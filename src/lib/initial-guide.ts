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
  createNode(nodes, rootId, null, "Outline Pro User Guide", "Welcome to Outline Pro! This is your complete guide to all features. Click any item in the outline to see details. This guide is restored automatically and cannot be deleted. Your own outlines are saved automatically as you work.", []);

  // === GETTING STARTED ===
  const gettingStartedId = uuidv4();
  const autoSaveId = uuidv4();
  const toolbarId = uuidv4();

  createNode(nodes, gettingStartedId, rootId, "Getting Started", "Outline Pro helps you organize your thoughts into structured outlines. The interface has two main areas: the outline pane on the left shows your hierarchical structure, and the content pane on the right lets you edit the selected node's content. Everything saves automatically to your browser - just start working and your changes are preserved.", []);
  createNode(nodes, autoSaveId, gettingStartedId, "Auto-Save", "All changes are saved automatically to your browser's storage. No save button needed - your work is always preserved. Just refresh the page to confirm your outline persists.");
  createNode(nodes, toolbarId, gettingStartedId, "Toolbar Icons", "The toolbar uses icon buttons with hover tooltips:\n\n+ (Plus) - Add a new sibling node\n\nTrash (Red) - Delete selected node\n\nUpload Arrow - Import media (PDF, YouTube)\n\nSparkles (Violet) - AI features");

  // === MANAGING OUTLINES ===
  const manageId = uuidv4();
  const createNewId = uuidv4();
  const switchId = uuidv4();
  const renameOutlineId = uuidv4();
  const deleteOutlineId = uuidv4();
  const importExportId = uuidv4();

  createNode(nodes, manageId, rootId, "Managing Outlines", "Outline Pro supports multiple outlines, each stored separately. Use the dropdown menu at the top of the outline pane (showing the current outline name) to switch between outlines, create new ones, rename, delete, or import/export. The guide outline is special - it's restored automatically and cannot be deleted or renamed.", []);
  createNode(nodes, createNewId, manageId, "Creating a New Outline", "Click the dropdown menu (shows current outline name) and select 'New Outline'. A new untitled outline is created and becomes your active outline. It starts with just a root node - add children to build your structure.");
  createNode(nodes, switchId, manageId, "Switching Outlines", "Click the dropdown menu to see all your outlines. Click any outline name to switch to it. The app remembers which outline you were working on.");
  createNode(nodes, renameOutlineId, manageId, "Renaming an Outline", "Two ways to rename:\n\n1. Use the dropdown menu > 'Rename' option\n\n2. Double-click the root node name - this updates both the node and outline name");
  createNode(nodes, deleteOutlineId, manageId, "Deleting an Outline", "Use the dropdown menu > 'Delete' option. A confirmation dialog appears before deletion. You cannot delete the guide outline or your last remaining outline - the app always keeps at least one user outline.");
  createNode(nodes, importExportId, manageId, "Import/Export", "From the dropdown menu:\n\n'Export Current Outline' - Downloads as JSON file\n\n'Import Outline' - Load a previously exported JSON file");

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
  const aiSafetyId = uuidv4();

  createNode(nodes, aiId, rootId, "AI Features", "Outline Pro includes powerful AI capabilities to help you generate content and build outlines faster. All AI features are accessed through the violet sparkles icon in the toolbar.", []);

  // AI Plans
  createNode(nodes, aiPlansId, aiId, "AI Plans (FREE vs PREMIUM)", "Outline Pro offers two AI plans:\n\nFREE Plan:\n- AI content generation\n- External source ingestion\n- Standard AI processing\n\nPREMIUM Plan ($9.99/month):\n- All FREE features\n- Advanced AI model\n- Subtree summaries\n- Teach mode\n- Consistency checks\n- Priority processing\n\nTo manage your plan: Click the AI menu (sparkles icon) > 'Manage AI Plan...'");

  // AI Menu
  createNode(nodes, aiMenuId, aiId, "AI Menu & Settings", "Access all AI features from a single menu:\n\n1. Click the violet sparkles icon in the toolbar\n2. The AI menu shows:\n   - Generate Outline from Topic\n   - Ingest External Source...\n   - Manage AI Plan...\n\nYour current plan (Free or Premium) is shown in the menu header.");

  // Generate Outline from Topic
  createNode(nodes, aiGenerateOutlineId, aiId, "Generate Outline from Topic", "Create a complete structured outline from any topic:\n\n1. Click AI menu > 'Generate Outline from Topic'\n2. Enter your topic (e.g., 'The History of Space Exploration')\n3. Click 'Generate'\n4. A NEW outline is created with the topic as its name\n\nThis creates a separate outline - your current work is never modified.");

  // Generate Content for Node
  createNode(nodes, aiGenerateContentId, aiId, "Generate Content for Node", "AI can write detailed content for any node in your outline.\n\nThe AI analyzes your node's title and its position in the hierarchy to generate relevant, contextual content. You control whether to replace existing content, append to it, or cancel.\n\nThe generation considers your outline structure from root to the selected node, ensuring thematic consistency.", []);
  createNode(nodes, aiGenerateHowId, aiGenerateContentId, "How to Trigger", "1. Select any node (except root)\n2. Click the violet sparkles button in the content pane header\n3. AI generates content based on the node's title and context");
  createNode(nodes, aiGenerateContextId, aiGenerateContentId, "Context & Input", "The AI uses:\n- The node's name/title\n- The path of ancestor nodes (for context)\n- Any existing content (as a draft to consider)\n\nThis helps AI generate relevant, contextual content that fits your outline structure.");
  createNode(nodes, aiGenerateConflictId, aiGenerateContentId, "Replace vs Append", "If the node already has content, you'll see options:\n\n- Replace: Overwrite existing content with AI content\n- Append Below: Add AI content after existing content\n- Cancel: Keep existing content unchanged\n\nYour content is never changed without your explicit choice.");

  // Ingest External Source
  createNode(nodes, aiIngestId, aiId, "Ingest External Source", "Import content from external sources to create or extend your outlines.\n\nThe AI analyzes source material, extracts key concepts, and proposes a structured outline that integrates with your existing work.\n\nSupported sources:\n- Text (paste directly)\n- YouTube URLs\n- PDF URLs\n\nYou'll see a preview before any changes are applied.", []);
  createNode(nodes, aiIngestSourcesId, aiIngestId, "Supported Sources", "Currently supported:\n\n- Text: Paste any text content directly\n- YouTube: Enter a video URL (transcript extraction coming soon)\n- PDF: Enter a PDF URL (text extraction coming soon)\n\nFor YouTube and PDF, you can paste the transcript or content manually in the Text tab.");
  createNode(nodes, aiIngestPreviewId, aiIngestId, "Preview Before Apply", "When you ingest content:\n\n1. AI analyzes the source and proposes an outline structure\n2. A preview shows exactly what will be added:\n   - Nodes to be created\n   - Where each node will be placed\n3. You review and click 'Apply Changes' to confirm\n4. Or click 'Cancel' to discard\n\nNo changes are made until you explicitly approve them.");
  createNode(nodes, aiIngestMergeId, aiIngestId, "Merge Behavior", "- If your outline is empty: AI creates a new structure from scratch\n- If your outline has content: AI adds new nodes to complement existing structure\n\nThe merge is always additive - existing nodes are preserved.");

  // Safety & Control
  createNode(nodes, aiSafetyId, aiId, "Safety & Control", "You're always in control:\n\n- All AI content is fully editable - change or delete anything\n- Preview mode shows changes before they're applied\n- No automatic modifications to your content\n- Auto-save preserves all changes (including AI content)\n- Undo by using browser back or editing content\n\nAI is a tool to help you - the final decisions are always yours.");

  // === IMPORTING MEDIA ===
  const mediaId = uuidv4();
  const pdfId = uuidv4();
  const youtubeId = uuidv4();

  createNode(nodes, mediaId, rootId, "Importing Media", "Add external media to your outline using the upload button (arrow icon) in the toolbar. Currently supports PDF documents via URL and YouTube videos. Each imported item creates a new node with embedded content that displays inline when you select it.", []);
  createNode(nodes, pdfId, mediaId, "PDF Documents", "Click the upload icon > 'PDF from URL'. Enter the full URL of a publicly accessible PDF file (must end in .pdf or be a direct PDF link). A new node is created as a sibling after your selected node, displaying the PDF in an embedded viewer.");
  createNode(nodes, youtubeId, mediaId, "YouTube Videos", "Click the upload icon > 'YouTube Video'. Enter any YouTube URL (regular or shortened youtu.be links work). A new node is created as a sibling after your selected node, with an embedded video player that supports full playback controls.");

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

  createNode(nodes, advancedId, rootId, "Advanced Node Features", "Outline Pro supports specialized node types, organization tools like tags and colors, and pinning important nodes. These features help you create more structured and visually organized outlines.", []);

  createNode(nodes, nodeTypesId, advancedId, "Node Types", "Beyond standard document and chapter nodes, Outline Pro supports several specialized node types, each with unique editors and functionality. Access these by right-clicking a node and selecting 'Set Type' from the context menu.", []);

  createNode(nodes, taskNodesId, nodeTypesId, "Task/Checklist Nodes", "Task nodes display a checkbox that you can click to mark items as complete. Completed tasks show strikethrough text.\n\nFeatures:\n- Click the checkbox to toggle completion\n- Completed tasks are visually distinguished\n- Perfect for to-do lists and action items\n- Can still have full rich text content");

  createNode(nodes, linkNodesId, nodeTypesId, "Link/Bookmark Nodes", "Link nodes store URLs and provide quick access to external resources.\n\nFeatures:\n- URL input field in the content pane\n- 'Open Link' button to visit the URL\n- Click the node name to open in new tab\n- Blue underlined styling indicates it's a link\n- Store notes about the link in the content area");

  createNode(nodes, codeNodesId, nodeTypesId, "Code Snippet Nodes", "Code nodes provide syntax-highlighted code editing with support for 13+ programming languages.\n\nFeatures:\n- Language selector (JavaScript, Python, TypeScript, Java, C#, PHP, Ruby, Go, Rust, SQL, JSON, CSS, HTML)\n- Syntax highlighting with Prism.js\n- Monospace font\n- Copy button for quick code copying\n- Great for documentation and code examples");

  createNode(nodes, quoteNodesId, nodeTypesId, "Quote/Citation Nodes", "Quote nodes are designed for storing quotations with proper attribution.\n\nFeatures:\n- Dedicated quote text area with italic styling\n- Source/attribution field for crediting\n- Purple left border for visual distinction\n- Blockquote formatting\n- Perfect for research and references");

  createNode(nodes, dateNodesId, nodeTypesId, "Date/Event Nodes", "Date nodes help you track important dates and events.\n\nFeatures:\n- Date picker interface\n- Formatted date display (e.g., 'Monday, January 5, 2026')\n- Store notes about the event\n- Orange icon for visibility\n- Useful for timelines and planning");

  createNode(nodes, tagsId, advancedId, "Tags", "Organize nodes with colored tags. Tags help you categorize and filter content across your outline.\n\nFeatures:\n- Add multiple tags to any node\n- Colored badges appear next to node names\n- Click 'x' on a badge to remove a tag\n- Tag Manager dialog for managing all tags\n- Each tag automatically gets a distinct color\n- Future: Filter outline by tags");

  createNode(nodes, colorsId, advancedId, "Node Colors", "Add visual distinction to nodes with custom colors displayed as a left border.\n\nHow to use:\n- Right-click any node > 'Set Color'\n- Choose from 8 colors + default\n- 4px colored left border appears on the node\n- Great for prioritizing or categorizing\n- Works alongside chapter colors\n\nColors: Red, Orange, Yellow, Green, Blue, Purple, Pink");

  createNode(nodes, pinningId, advancedId, "Pinning Nodes", "Pin important nodes to keep them easily accessible.\n\nFeatures:\n- Star icon appears on hover\n- Click star to toggle pin status\n- Pinned nodes show filled yellow star\n- Visual highlighting for pinned items\n- Perfect for frequently accessed nodes");

  // === NODE NUMBERING ===
  const numberingId = uuidv4();

  createNode(nodes, numberingId, rootId, "Node Numbering", "Each node displays a numeric prefix (like 1.2.3) showing its position in the hierarchy. Prefixes update automatically when you reorganize nodes. The root node has no prefix.");

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
    name: 'Outline Pro User Guide',
    rootNodeId,
    nodes,
    isGuide: true,
  };
}
