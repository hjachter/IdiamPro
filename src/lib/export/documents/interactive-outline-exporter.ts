'use client';

import type { Outline, OutlineNode } from '@/types';
import type { ExportOptions, ExportResult } from '../types';
import { BaseExporter, isElectron } from '../base-exporter';

interface ExportedNode {
  id: string;
  name: string;
  content: string;
  type: string;
  prefix: string;
  childrenIds: string[];
  color?: string;
  tags?: string[];
  isCompleted?: boolean;
  url?: string;
}

/**
 * Export outline as an interactive read-only viewer
 * Produces a self-contained HTML file with sidebar tree navigation and content pane
 */
export class InteractiveOutlineExporter extends BaseExporter {
  formatId = 'interactive-outline';
  mimeType = 'text/html';
  extension = '.html';

  async convert(
    outline: Outline,
    rootNodeId?: string,
    options?: ExportOptions
  ): Promise<ExportResult> {
    const root = rootNodeId || outline.rootNodeId;
    const nodes = outline.nodes;
    const rootNode = nodes[root];
    const title = options?.title || rootNode?.name || outline.name;
    const includeContent = options?.includeContent ?? true;
    const includeMetadata = options?.includeMetadata ?? false;

    // Build the exported node map
    const exportedNodes: Record<string, ExportedNode> = {};
    this.traverseDepthFirst(nodes, root, (node) => {
      exportedNodes[node.id] = {
        id: node.id,
        name: node.name,
        content: includeContent ? (node.content || '') : '',
        type: node.type || 'chapter',
        prefix: node.prefix || '',
        childrenIds: node.childrenIds || [],
        ...(includeMetadata && node.metadata?.color && node.metadata.color !== 'default'
          ? { color: node.metadata.color } : {}),
        ...(includeMetadata && node.metadata?.tags?.length
          ? { tags: node.metadata.tags } : {}),
        ...(node.metadata?.isCompleted !== undefined
          ? { isCompleted: node.metadata.isCompleted } : {}),
        ...(node.metadata?.url ? { url: node.metadata.url } : {}),
      };
    });

    const dataJson = JSON.stringify({
      title,
      rootId: root,
      nodes: exportedNodes,
    });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(title)}</title>
  <style>
${this.getStyles()}
  </style>
</head>
<body>
  <header class="mobile-header">
    <button id="menu-toggle" aria-label="Toggle sidebar">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
        <line x1="3" y1="5" x2="17" y2="5"/><line x1="3" y1="10" x2="17" y2="10"/><line x1="3" y1="15" x2="17" y2="15"/>
      </svg>
    </button>
    <span id="mobile-title"></span>
    <button id="mobile-theme-toggle" aria-label="Toggle theme">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
      </svg>
    </button>
  </header>

  <div class="app-container">
    <aside id="sidebar" class="sidebar">
      <div class="sidebar-header">
        <h1 id="sidebar-title" class="sidebar-title"></h1>
        <div class="sidebar-search">
          <input type="text" id="search-input" placeholder="Search nodes..." autocomplete="off" />
        </div>
        <div class="sidebar-controls">
          <button onclick="expandAll()" title="Expand all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            Expand
          </button>
          <button onclick="collapseAll()" title="Collapse all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
            Collapse
          </button>
          <button id="theme-toggle" onclick="toggleTheme()" title="Toggle dark/light mode">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
          </button>
        </div>
      </div>
      <nav id="tree-container" class="tree-container"></nav>
      <div class="sidebar-footer">
        <span>Exported from <strong>IdiamPro</strong></span>
      </div>
    </aside>

    <div id="resize-handle" class="resize-handle"></div>

    <main id="content-pane" class="content-pane">
      <div id="breadcrumbs" class="breadcrumbs"></div>
      <div class="content-header">
        <span id="content-icon" class="content-icon"></span>
        <h2 id="content-title" class="content-title"></h2>
      </div>
      <div id="content-tags" class="content-tags"></div>
      <div id="content-body" class="content-body"></div>
      <div id="children-nav" class="children-nav"></div>
    </main>
  </div>

  <div id="sidebar-overlay" class="sidebar-overlay" onclick="closeSidebar()"></div>

  <script>
    var OUTLINE_DATA = ${dataJson};
${this.getScript()}
  </script>
</body>
</html>`;

    return {
      data: html,
      filename: this.getSuggestedFilename(outline, rootNodeId),
      mimeType: this.mimeType,
    };
  }

  /**
   * Override save to auto-open the file after saving
   */
  async save(result: ExportResult): Promise<void> {
    if (isElectron()) {
      // Electron: save via dialog, then open the file
      const electronAPI = (window as any).electronAPI;
      const filePath = await electronAPI.saveFileDialog({
        title: 'Save Interactive Outline',
        defaultPath: result.filename,
        filters: [{ name: 'HTML', extensions: ['html'] }],
      });
      if (!filePath) return; // User cancelled

      const blob = result.data instanceof Blob
        ? result.data
        : new Blob([result.data], { type: result.mimeType });
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer)
          .reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      await electronAPI.writeFile(filePath, base64, { encoding: 'base64' });

      // Open in default browser
      await electronAPI.openFile(filePath);
    } else {
      // Web/Capacitor: open in new tab
      const html = result.data instanceof Blob
        ? await result.data.text()
        : result.data as string;
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    }
  }

  private getStyles(): string {
    return `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #FAFAFA;
      --sidebar-bg: #F5F5F5;
      --card-bg: #FFFFFF;
      --text: #000000;
      --text-secondary: #666666;
      --muted: #737373;
      --border: #E5E5E5;
      --primary: #007AFF;
      --primary-light: rgba(0, 122, 255, 0.08);
      --primary-selected: rgba(0, 122, 255, 0.12);
      --hover: rgba(0, 0, 0, 0.04);
      --depth-1: #007AFF;
      --depth-2: #5856D6;
      --depth-3: #AF52DE;
      --depth-4: #9F45B0;
      --depth-5: #D63384;
      --node-red: hsl(0, 70%, 60%);
      --node-orange: hsl(30, 70%, 60%);
      --node-yellow: hsl(50, 70%, 60%);
      --node-green: hsl(120, 70%, 50%);
      --node-blue: hsl(210, 70%, 60%);
      --node-purple: hsl(270, 70%, 60%);
      --node-pink: hsl(330, 70%, 60%);
      --shadow: 0 1px 3px rgba(0,0,0,0.08);
      --sidebar-width: 320px;
    }

    .dark {
      --bg: #000000;
      --sidebar-bg: #1C1C1E;
      --card-bg: #1C1C1E;
      --text: #FFFFFF;
      --text-secondary: #AAAAAA;
      --muted: #999999;
      --border: #383838;
      --primary: #0A84FF;
      --primary-light: rgba(10, 132, 255, 0.12);
      --primary-selected: rgba(10, 132, 255, 0.18);
      --hover: rgba(255, 255, 255, 0.06);
      --depth-1: #0A84FF;
      --depth-2: #7B7BF7;
      --depth-3: #BF5AF2;
      --depth-4: #A855F7;
      --depth-5: #E060A0;
      --node-red: hsl(0, 75%, 65%);
      --node-orange: hsl(30, 75%, 65%);
      --node-yellow: hsl(50, 75%, 65%);
      --node-green: hsl(120, 75%, 55%);
      --node-blue: hsl(210, 75%, 65%);
      --node-purple: hsl(270, 75%, 65%);
      --node-pink: hsl(330, 75%, 65%);
      --shadow: 0 1px 3px rgba(0,0,0,0.3);
    }

    html, body {
      height: 100%;
      overflow: hidden;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', system-ui, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    /* Mobile header */
    .mobile-header {
      display: none;
      align-items: center;
      padding: 0.5rem 1rem;
      background: var(--sidebar-bg);
      border-bottom: 1px solid var(--border);
      gap: 0.75rem;
    }
    .mobile-header button {
      background: none; border: none; color: var(--text); cursor: pointer; padding: 0.25rem;
      display: flex; align-items: center;
    }
    .mobile-header #mobile-title {
      flex: 1; font-weight: 600; font-size: 0.9375rem; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap;
    }

    /* App container */
    .app-container {
      display: flex;
      height: 100vh;
    }

    /* Sidebar */
    .sidebar {
      width: var(--sidebar-width);
      min-width: 240px;
      max-width: 50vw;
      height: 100vh;
      background: var(--sidebar-bg);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
    }

    .sidebar-header {
      padding: 1.25rem 1rem 0.75rem;
      border-bottom: 1px solid var(--border);
    }

    .sidebar-title {
      font-size: 1rem;
      font-weight: 700;
      margin-bottom: 0.75rem;
      color: var(--text);
      line-height: 1.3;
    }

    .sidebar-search {
      margin-bottom: 0.5rem;
    }
    .sidebar-search input {
      width: 100%;
      padding: 0.4375rem 0.75rem;
      border: 1px solid var(--border);
      border-radius: 0.5rem;
      background: var(--card-bg);
      color: var(--text);
      font-size: 0.8125rem;
      outline: none;
      transition: border-color 0.15s;
    }
    .sidebar-search input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 2px var(--primary-light);
    }
    .sidebar-search input::placeholder { color: var(--muted); }

    .sidebar-controls {
      display: flex;
      gap: 0.25rem;
    }
    .sidebar-controls button {
      padding: 0.25rem 0.5rem;
      border: none;
      border-radius: 0.375rem;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      font-size: 0.6875rem;
      display: flex;
      align-items: center;
      gap: 0.25rem;
      white-space: nowrap;
    }
    .sidebar-controls button:hover {
      background: var(--hover);
      color: var(--text);
    }

    /* Tree container */
    .tree-container {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 0.5rem 0;
    }
    .tree-container::-webkit-scrollbar { width: 6px; }
    .tree-container::-webkit-scrollbar-track { background: transparent; }
    .tree-container::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

    /* Tree node */
    .tree-node {
      display: flex;
      align-items: center;
      padding: 0.25rem 0.75rem 0.25rem 0;
      cursor: pointer;
      user-select: none;
      border-radius: 0.375rem;
      margin: 0 0.375rem;
      min-height: 1.75rem;
      position: relative;
      transition: background 0.1s;
    }
    .tree-node:hover {
      background: var(--hover);
    }
    .tree-node.selected {
      background: var(--primary-selected);
    }
    .tree-node.selected .node-name {
      color: var(--primary);
      font-weight: 600;
    }

    /* Depth indicator bar */
    .tree-node::before {
      content: '';
      position: absolute;
      left: 0;
      top: 4px;
      bottom: 4px;
      width: 2px;
      border-radius: 1px;
    }
    .tree-node[data-depth="1"]::before { background: var(--depth-1); }
    .tree-node[data-depth="2"]::before { background: var(--depth-2); }
    .tree-node[data-depth="3"]::before { background: var(--depth-3); }
    .tree-node[data-depth="4"]::before { background: var(--depth-4); }
    .tree-node[data-depth="5"]::before,
    .tree-node[data-depth="6"]::before,
    .tree-node[data-depth="7"]::before { background: var(--depth-5); }

    /* Color strip for colored nodes */
    .tree-node[data-color="red"] { border-left: 2.5px solid var(--node-red); }
    .tree-node[data-color="orange"] { border-left: 2.5px solid var(--node-orange); }
    .tree-node[data-color="yellow"] { border-left: 2.5px solid var(--node-yellow); }
    .tree-node[data-color="green"] { border-left: 2.5px solid var(--node-green); }
    .tree-node[data-color="blue"] { border-left: 2.5px solid var(--node-blue); }
    .tree-node[data-color="purple"] { border-left: 2.5px solid var(--node-purple); }
    .tree-node[data-color="pink"] { border-left: 2.5px solid var(--node-pink); }

    .node-chevron {
      width: 1rem;
      height: 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      color: var(--muted);
      transition: transform 0.15s ease;
      font-size: 0.625rem;
    }
    .node-chevron.expanded { transform: rotate(90deg); }
    .node-chevron.empty { visibility: hidden; }

    .node-icon {
      width: 1.125rem;
      font-size: 0.75rem;
      text-align: center;
      flex-shrink: 0;
      margin-right: 0.375rem;
    }

    .node-prefix {
      color: var(--muted);
      font-size: 0.6875rem;
      margin-right: 0.25rem;
      flex-shrink: 0;
      font-variant-numeric: tabular-nums;
    }

    .node-name {
      font-size: 0.8125rem;
      color: var(--text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    }
    .node-name mark {
      background: rgba(255, 200, 0, 0.35);
      color: inherit;
      border-radius: 2px;
      padding: 0 1px;
    }

    .node-children {
      display: block;
    }
    .node-children.collapsed {
      display: none;
    }

    /* Sidebar footer */
    .sidebar-footer {
      padding: 0.5rem 1rem;
      border-top: 1px solid var(--border);
      font-size: 0.6875rem;
      color: var(--muted);
      text-align: center;
    }

    /* Resize handle */
    .resize-handle {
      width: 4px;
      cursor: col-resize;
      background: transparent;
      transition: background 0.15s;
      flex-shrink: 0;
    }
    .resize-handle:hover, .resize-handle.active {
      background: var(--primary);
    }

    /* Content pane */
    .content-pane {
      flex: 1;
      overflow-y: auto;
      padding: 2rem 2.5rem;
      min-width: 0;
    }
    .content-pane::-webkit-scrollbar { width: 8px; }
    .content-pane::-webkit-scrollbar-track { background: transparent; }
    .content-pane::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }

    /* Breadcrumbs */
    .breadcrumbs {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.25rem;
      margin-bottom: 1rem;
      font-size: 0.75rem;
      color: var(--muted);
    }
    .breadcrumbs a {
      color: var(--muted);
      text-decoration: none;
      cursor: pointer;
    }
    .breadcrumbs a:hover {
      color: var(--primary);
      text-decoration: underline;
    }
    .breadcrumbs .separator {
      color: var(--border);
      font-size: 0.625rem;
    }

    /* Content header */
    .content-header {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      margin-bottom: 0.75rem;
    }
    .content-icon {
      font-size: 1.25rem;
    }
    .content-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text);
      line-height: 1.3;
    }

    /* Tags */
    .content-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
      margin-bottom: 1rem;
    }
    .content-tags:empty { display: none; }
    .tag {
      padding: 0.125rem 0.5rem;
      border-radius: 999px;
      font-size: 0.6875rem;
      background: var(--primary-light);
      color: var(--primary);
      font-weight: 500;
    }

    /* Content body */
    .content-body {
      font-size: 0.9375rem;
      line-height: 1.7;
      color: var(--text);
    }
    .content-body:empty::after {
      content: 'No content for this node.';
      color: var(--muted);
      font-style: italic;
    }
    .content-body p { margin-bottom: 0.75rem; }
    .content-body h1, .content-body h2, .content-body h3, .content-body h4, .content-body h5, .content-body h6 {
      font-weight: 600; margin: 1.25rem 0 0.5rem; line-height: 1.3;
    }
    .content-body h1 { font-size: 1.5rem; }
    .content-body h2 { font-size: 1.25rem; }
    .content-body h3 { font-size: 1.125rem; }
    .content-body ul, .content-body ol { margin: 0.5rem 0 0.75rem 1.5rem; }
    .content-body li { margin-bottom: 0.25rem; }
    .content-body li p { margin-bottom: 0.25rem; }
    .content-body a { color: var(--primary); text-decoration: underline; }
    .content-body code {
      background: var(--hover);
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      font-size: 0.875em;
      font-family: 'SF Mono', 'Fira Code', Menlo, Monaco, 'Courier New', monospace;
    }
    .content-body pre {
      background: var(--sidebar-bg);
      border: 1px solid var(--border);
      padding: 1rem;
      border-radius: 0.5rem;
      overflow-x: auto;
      margin: 0.75rem 0;
    }
    .content-body pre code {
      background: none; padding: 0; border-radius: 0;
    }
    .content-body blockquote {
      border-left: 3px solid var(--primary);
      padding: 0.5rem 1rem;
      margin: 0.75rem 0;
      color: var(--text-secondary);
      background: var(--primary-light);
      border-radius: 0 0.375rem 0.375rem 0;
    }
    .content-body table {
      width: 100%;
      border-collapse: collapse;
      margin: 0.75rem 0;
      font-size: 0.875rem;
    }
    .content-body th, .content-body td {
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--border);
      text-align: left;
    }
    .content-body th {
      background: var(--sidebar-bg);
      font-weight: 600;
    }
    .content-body img {
      max-width: 100%;
      height: auto;
      border-radius: 0.5rem;
      margin: 0.5rem 0;
    }
    .content-body hr {
      border: none;
      border-top: 1px solid var(--border);
      margin: 1.5rem 0;
    }

    /* Children navigation */
    .children-nav {
      margin-top: 2rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
    }
    .children-nav:empty { display: none; }
    .children-nav h3 {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.75rem;
    }
    .child-link {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      margin-bottom: 0.25rem;
      border-radius: 0.5rem;
      cursor: pointer;
      transition: background 0.1s;
      text-decoration: none;
      color: var(--text);
    }
    .child-link:hover {
      background: var(--hover);
    }
    .child-link .child-icon { font-size: 0.875rem; width: 1.25rem; text-align: center; }
    .child-link .child-prefix { color: var(--muted); font-size: 0.75rem; }
    .child-link .child-name { font-size: 0.875rem; }
    .child-link .child-count {
      margin-left: auto;
      font-size: 0.6875rem;
      color: var(--muted);
      background: var(--hover);
      padding: 0.0625rem 0.375rem;
      border-radius: 999px;
    }

    /* Sidebar overlay (mobile) */
    .sidebar-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.4);
      z-index: 99;
    }
    .sidebar-overlay.active { display: block; }

    /* Responsive */
    @media (max-width: 768px) {
      .app-container { height: calc(100vh - 44px); }
      .mobile-header { display: flex; }

      .sidebar {
        position: fixed;
        left: 0;
        top: 44px;
        bottom: 0;
        width: 85%;
        max-width: 360px;
        z-index: 100;
        transform: translateX(-100%);
        transition: transform 0.25s ease;
        box-shadow: none;
      }
      .sidebar.open {
        transform: translateX(0);
        box-shadow: 4px 0 20px rgba(0,0,0,0.15);
      }

      .resize-handle { display: none; }

      .content-pane {
        padding: 1.25rem 1rem;
      }
      .content-title { font-size: 1.25rem; }
    }

    /* Print */
    @media print {
      .mobile-header, .sidebar, .resize-handle, .sidebar-overlay { display: none !important; }
      .app-container { display: block; }
      .content-pane { overflow: visible; padding: 0; }
      .content-body { font-size: 11pt; }
      .children-nav { break-inside: avoid; }
    }
    `;
  }

  private getScript(): string {
    return `
    (function() {
      var state = {
        selectedId: OUTLINE_DATA.rootId,
        expanded: new Set(),
        searchTerm: '',
        isDark: window.matchMedia('(prefers-color-scheme: dark)').matches
      };

      // Initialize: expand root and first level
      var rootNode = OUTLINE_DATA.nodes[OUTLINE_DATA.rootId];
      if (rootNode) {
        state.expanded.add(OUTLINE_DATA.rootId);
        (rootNode.childrenIds || []).forEach(function(id) { state.expanded.add(id); });
      }

      // Apply initial theme
      if (state.isDark) document.documentElement.classList.add('dark');
      document.getElementById('sidebar-title').textContent = OUTLINE_DATA.title;
      document.getElementById('mobile-title').textContent = OUTLINE_DATA.title;

      // Node type icons
      var TYPE_ICONS = {
        root: '\\u{1F3E0}', chapter: '\\u{1F4C1}', document: '\\u{1F4C4}', note: '\\u{1F4DD}',
        task: '\\u2610', link: '\\u{1F517}', code: '\\u{2039}\\u{203A}', quote: '\\u275D',
        date: '\\u{1F4C5}', image: '\\u{1F5BC}', video: '\\u{1F3AC}', audio: '\\u{1F3B5}',
        pdf: '\\u{1F4C4}', youtube: '\\u25B6\\uFE0F', spreadsheet: '\\u{1F4CA}',
        database: '\\u{1F5C3}', app: '\\u{1F4F1}', map: '\\u{1F5FA}', canvas: '\\u{1F3A8}'
      };

      function getIcon(node) {
        if (node.type === 'task') return node.isCompleted ? '\\u2611' : '\\u2610';
        if (node.type === 'chapter' && (node.childrenIds || []).length > 0) {
          return state.expanded.has(node.id) ? '\\u{1F4C2}' : '\\u{1F4C1}';
        }
        return TYPE_ICONS[node.type] || '\\u{1F4C4}';
      }

      function getDepthColor(depth) {
        if (depth <= 0) return '';
        return Math.min(depth, 7).toString();
      }

      // Build sidebar tree
      function buildTree() {
        var container = document.getElementById('tree-container');
        container.innerHTML = '';
        var fragment = document.createDocumentFragment();
        renderNode(fragment, OUTLINE_DATA.rootId, 0);
        container.appendChild(fragment);
      }

      function matchesSearch(node) {
        if (!state.searchTerm) return true;
        return node.name.toLowerCase().indexOf(state.searchTerm) !== -1;
      }

      function subtreeMatchesSearch(nodeId) {
        var node = OUTLINE_DATA.nodes[nodeId];
        if (!node) return false;
        if (matchesSearch(node)) return true;
        return (node.childrenIds || []).some(function(cid) { return subtreeMatchesSearch(cid); });
      }

      function highlightName(name) {
        if (!state.searchTerm) return escapeHtml(name);
        var lower = name.toLowerCase();
        var idx = lower.indexOf(state.searchTerm);
        if (idx === -1) return escapeHtml(name);
        return escapeHtml(name.substring(0, idx)) +
          '<mark>' + escapeHtml(name.substring(idx, idx + state.searchTerm.length)) + '</mark>' +
          escapeHtml(name.substring(idx + state.searchTerm.length));
      }

      function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
      }

      function renderNode(parent, nodeId, depth) {
        var node = OUTLINE_DATA.nodes[nodeId];
        if (!node) return;

        // Skip if searching and this subtree doesn't match
        if (state.searchTerm && !subtreeMatchesSearch(nodeId)) return;

        var hasChildren = (node.childrenIds || []).length > 0;
        var isExpanded = state.expanded.has(nodeId);
        var isSelected = state.selectedId === nodeId;

        // Node row
        var row = document.createElement('div');
        row.className = 'tree-node' + (isSelected ? ' selected' : '');
        row.style.paddingLeft = (0.75 + depth * 1.25) + 'rem';
        row.setAttribute('data-id', nodeId);
        var depthStr = getDepthColor(depth);
        if (depthStr) row.setAttribute('data-depth', depthStr);
        if (node.color) row.setAttribute('data-color', node.color);

        // Chevron
        var chevron = document.createElement('span');
        chevron.className = 'node-chevron' + (hasChildren ? (isExpanded ? ' expanded' : '') : ' empty');
        chevron.innerHTML = hasChildren ? '\\u25B6' : '';
        if (hasChildren) {
          chevron.onclick = function(e) {
            e.stopPropagation();
            toggleExpand(nodeId);
          };
        }
        row.appendChild(chevron);

        // Icon
        var icon = document.createElement('span');
        icon.className = 'node-icon';
        icon.textContent = getIcon(node);
        row.appendChild(icon);

        // Prefix
        if (node.prefix) {
          var prefix = document.createElement('span');
          prefix.className = 'node-prefix';
          prefix.textContent = node.prefix;
          row.appendChild(prefix);
        }

        // Name
        var name = document.createElement('span');
        name.className = 'node-name';
        name.innerHTML = highlightName(node.name);
        row.appendChild(name);

        row.onclick = function() { selectNode(nodeId); };
        parent.appendChild(row);

        // Children container
        if (hasChildren) {
          var childContainer = document.createElement('div');
          childContainer.className = 'node-children' + (isExpanded ? '' : ' collapsed');
          childContainer.setAttribute('data-parent', nodeId);

          for (var i = 0; i < node.childrenIds.length; i++) {
            renderNode(childContainer, node.childrenIds[i], depth + 1);
          }
          parent.appendChild(childContainer);
        }
      }

      // Navigation
      function selectNode(id) {
        var node = OUTLINE_DATA.nodes[id];
        if (!node) return;

        state.selectedId = id;

        // Update sidebar selection
        var prev = document.querySelector('.tree-node.selected');
        if (prev) prev.classList.remove('selected');
        var curr = document.querySelector('.tree-node[data-id="' + id + '"]');
        if (curr) {
          curr.classList.add('selected');
          curr.scrollIntoView({ block: 'nearest' });
        }

        // Expand ancestors so selection is visible
        var ancestors = getAncestors(id);
        var needsRebuild = false;
        ancestors.forEach(function(aid) {
          if (!state.expanded.has(aid)) {
            state.expanded.add(aid);
            needsRebuild = true;
          }
        });
        if (needsRebuild) {
          buildTree();
        }

        updateContent(id);
        closeSidebar();

        // Update URL hash
        if (history.replaceState) {
          history.replaceState(null, '', '#' + id);
        }
      }

      function toggleExpand(id) {
        if (state.expanded.has(id)) {
          state.expanded.delete(id);
        } else {
          state.expanded.add(id);
        }
        buildTree();
      }

      function getAncestors(nodeId) {
        var ancestors = [];
        var current = OUTLINE_DATA.nodes[nodeId];
        while (current) {
          var parentId = null;
          // Find parent by checking who has this as a child
          for (var nid in OUTLINE_DATA.nodes) {
            var n = OUTLINE_DATA.nodes[nid];
            if (n.childrenIds && n.childrenIds.indexOf(current.id) !== -1) {
              parentId = nid;
              break;
            }
          }
          if (!parentId) break;
          ancestors.unshift(parentId);
          current = OUTLINE_DATA.nodes[parentId];
        }
        return ancestors;
      }

      // Content pane
      function updateContent(id) {
        var node = OUTLINE_DATA.nodes[id];
        if (!node) return;

        // Breadcrumbs
        var bc = document.getElementById('breadcrumbs');
        var ancestors = getAncestors(id);
        var bcHtml = '';
        ancestors.forEach(function(aid) {
          var an = OUTLINE_DATA.nodes[aid];
          if (an) {
            bcHtml += '<a onclick="window._selectNode(\\'' + aid + '\\')">' + escapeHtml(an.name) + '</a>';
            bcHtml += '<span class="separator">\\u203A</span>';
          }
        });
        bcHtml += '<span>' + escapeHtml(node.name) + '</span>';
        bc.innerHTML = bcHtml;

        // Icon + title
        document.getElementById('content-icon').textContent = getIcon(node);
        document.getElementById('content-title').textContent = node.name;

        // Tags
        var tagsEl = document.getElementById('content-tags');
        if (node.tags && node.tags.length) {
          tagsEl.innerHTML = node.tags.map(function(t) { return '<span class="tag">' + escapeHtml(t) + '</span>'; }).join('');
        } else {
          tagsEl.innerHTML = '';
        }

        // Content body
        var body = document.getElementById('content-body');
        body.innerHTML = node.content || '';

        // Children navigation
        var childNav = document.getElementById('children-nav');
        if (node.childrenIds && node.childrenIds.length > 0) {
          var html = '<h3>In this section</h3>';
          node.childrenIds.forEach(function(cid) {
            var child = OUTLINE_DATA.nodes[cid];
            if (!child) return;
            var childCount = (child.childrenIds || []).length;
            html += '<div class="child-link" onclick="window._selectNode(\\'' + cid + '\\')">';
            html += '<span class="child-icon">' + getIcon(child) + '</span>';
            if (child.prefix) html += '<span class="child-prefix">' + escapeHtml(child.prefix) + '</span>';
            html += '<span class="child-name">' + escapeHtml(child.name) + '</span>';
            if (childCount > 0) html += '<span class="child-count">' + childCount + '</span>';
            html += '</div>';
          });
          childNav.innerHTML = html;
        } else {
          childNav.innerHTML = '';
        }

        // Update mobile title
        document.getElementById('mobile-title').textContent = node.name;
      }

      // Global controls
      window.expandAll = function() {
        for (var id in OUTLINE_DATA.nodes) {
          if ((OUTLINE_DATA.nodes[id].childrenIds || []).length > 0) {
            state.expanded.add(id);
          }
        }
        buildTree();
      };

      window.collapseAll = function() {
        state.expanded.clear();
        state.expanded.add(OUTLINE_DATA.rootId);
        buildTree();
      };

      window.toggleTheme = function() {
        state.isDark = !state.isDark;
        document.documentElement.classList.toggle('dark', state.isDark);
      };

      window._selectNode = function(id) { selectNode(id); };

      window.closeSidebar = function() {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebar-overlay').classList.remove('active');
      };

      // Search
      var searchTimeout;
      document.getElementById('search-input').addEventListener('input', function(e) {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(function() {
          state.searchTerm = e.target.value.toLowerCase().trim();
          if (state.searchTerm) {
            // Expand all matching ancestor paths
            for (var id in OUTLINE_DATA.nodes) {
              if (subtreeMatchesSearch(id)) {
                state.expanded.add(id);
              }
            }
          }
          buildTree();
        }, 200);
      });

      // Mobile menu
      document.getElementById('menu-toggle').addEventListener('click', function() {
        document.getElementById('sidebar').classList.toggle('open');
        document.getElementById('sidebar-overlay').classList.toggle('active');
      });

      document.getElementById('mobile-theme-toggle').addEventListener('click', function() {
        window.toggleTheme();
      });

      // Resize handle
      (function() {
        var handle = document.getElementById('resize-handle');
        var sidebar = document.getElementById('sidebar');
        var dragging = false;

        handle.addEventListener('mousedown', function(e) {
          dragging = true;
          handle.classList.add('active');
          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none';
          e.preventDefault();
        });

        document.addEventListener('mousemove', function(e) {
          if (!dragging) return;
          var width = Math.max(240, Math.min(e.clientX, window.innerWidth * 0.5));
          sidebar.style.width = width + 'px';
        });

        document.addEventListener('mouseup', function() {
          if (dragging) {
            dragging = false;
            handle.classList.remove('active');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
          }
        });
      })();

      // Keyboard navigation
      document.addEventListener('keydown', function(e) {
        // Cmd/Ctrl+F focuses search
        if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
          e.preventDefault();
          document.getElementById('search-input').focus();
        }
        // Escape clears search
        if (e.key === 'Escape') {
          var input = document.getElementById('search-input');
          if (document.activeElement === input) {
            input.value = '';
            state.searchTerm = '';
            buildTree();
            input.blur();
          }
        }
      });

      // Hash navigation
      function navigateToHash() {
        var hash = window.location.hash.slice(1);
        if (hash && OUTLINE_DATA.nodes[hash]) {
          selectNode(hash);
        }
      }
      window.addEventListener('hashchange', navigateToHash);

      // Initialize
      buildTree();
      if (window.location.hash.slice(1) && OUTLINE_DATA.nodes[window.location.hash.slice(1)]) {
        navigateToHash();
      } else {
        updateContent(OUTLINE_DATA.rootId);
      }
    })();
    `;
  }
}
