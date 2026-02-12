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

function createWelcomeNodes(): { rootNodeId: string, nodes: NodeMap } {
  const nodes: NodeMap = {};

  const rootId = 'welcome-root';
  createNode(nodes, rootId, null, "Welcome to IdiamPro!", `<p><strong>Congratulations!</strong> You've just unlocked a powerful tool for organizing your thoughts, research, and knowledge.</p>

<p>IdiamPro is your <strong>Second Brain</strong> — an intelligence amplifier that helps you capture, connect, and recall everything you learn.</p>

<p><em>This quick tour will get you started in under 5 minutes.</em></p>`);

  // Step 1: Create Your First Outline
  const step1Id = 'welcome-step1';
  createNode(nodes, step1Id, rootId, "Step 1: Create Your First Outline", `<p>Click the <strong>+ New Outline</strong> button in the sidebar to create your first outline.</p>

<p>Give it a name that describes your project — "Research Notes", "Meeting Notes", "Book Outline", etc.</p>

<p><strong>Tip:</strong> Each outline is a separate document. You can have as many as you need!</p>`);

  // Step 2: Add Nodes
  const step2Id = 'welcome-step2';
  createNode(nodes, step2Id, rootId, "Step 2: Add Nodes (Your Building Blocks)", `<p>Nodes are the building blocks of your outline. Each node has:</p>
<ul>
  <li><strong>A title</strong> — shown in the outline tree on the left</li>
  <li><strong>Content</strong> — rich text, images, tables shown on the right</li>
</ul>

<p><strong>To add a node:</strong></p>
<ul>
  <li>Press <strong>Enter</strong> to create a sibling node</li>
  <li>Press <strong>Tab</strong> to indent (make it a child)</li>
  <li>Press <strong>Shift+Tab</strong> to outdent (move it up a level)</li>
</ul>

<p><strong>Try it now:</strong> Select this node and press Enter to create a new one!</p>`);

  // Step 3: Organize with Drag & Drop
  const step3Id = 'welcome-step3';
  createNode(nodes, step3Id, rootId, "Step 3: Organize with Drag & Drop", `<p>Rearrange your outline by dragging nodes:</p>
<ul>
  <li><strong>Drag up/down</strong> to reorder</li>
  <li><strong>Drag onto another node</strong> to make it a child</li>
  <li><strong>Drag to the left edge</strong> to move it up a level</li>
</ul>

<p>Your outline can be as deep or as flat as you need. IdiamPro handles <strong>over 1 million nodes</strong> with ease!</p>`);

  // Step 4: Import Content
  const step4Id = 'welcome-step4';
  createNode(nodes, step4Id, rootId, "Step 4: Import Content from Anywhere", `<p>Don't start from scratch! Import content from:</p>
<ul>
  <li><strong>YouTube videos</strong> — Get transcripts and AI-generated outlines</li>
  <li><strong>PDFs</strong> — Extract text and structure</li>
  <li><strong>Web pages</strong> — Save articles as structured notes</li>
  <li><strong>Audio files</strong> — Transcribe recordings automatically</li>
  <li><strong>Documents</strong> — Word, Markdown, OPML, and more</li>
</ul>

<p>Click <strong>Import</strong> in the toolbar to get started.</p>`);

  // Step 5: AI Features
  const step5Id = 'welcome-step5';
  createNode(nodes, step5Id, rootId, "Step 5: Supercharge with AI", `<p>IdiamPro's AI features help you work smarter:</p>
<ul>
  <li><strong>AI Generate</strong> — Create content, expand ideas, summarize</li>
  <li><strong>Knowledge Chat</strong> — Ask questions about your outline</li>
  <li><strong>AI Synthesis</strong> — Combine multiple sources into unified notes</li>
</ul>

<p>Look for the <strong>✨ AI</strong> buttons throughout the app.</p>`);

  // What's Next
  const nextId = 'welcome-next';
  createNode(nodes, nextId, rootId, "What's Next?", `<p>You're ready to go! Here are some ideas:</p>
<ul>
  <li>📝 Create a new outline for your current project</li>
  <li>📺 Import a YouTube video you've been meaning to study</li>
  <li>📚 Check out the <strong>User Guide</strong> for advanced features</li>
</ul>

<p><strong>Need help?</strong> Click the <strong>?</strong> button for Help Chat — our AI assistant knows everything about IdiamPro.</p>

<p><em>Happy outlining!</em> 🎉</p>`);

  // Calculate prefixes
  Object.values(nodes).forEach(node => {
    node.prefix = calculateNodePrefix(nodes, node.id);
  });

  return { rootNodeId: rootId, nodes };
}

export function getWelcomeOutline(): Outline {
  const { rootNodeId, nodes } = createWelcomeNodes();

  return {
    id: 'welcome-outline-' + uuidv4(),
    name: 'Welcome to IdiamPro!',
    rootNodeId,
    nodes,
    isGuide: false, // Not a guide, just a regular outline they can delete
    lastModified: Date.now()
  };
}

// Check if user has seen the welcome
export function hasSeenWelcome(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem('idiampro-welcomed') === 'true';
}

// Mark welcome as seen
export function markWelcomeSeen(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('idiampro-welcomed', 'true');
}

// Reset welcome (for testing or "Show Welcome" button)
export function resetWelcome(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('idiampro-welcomed');
}
