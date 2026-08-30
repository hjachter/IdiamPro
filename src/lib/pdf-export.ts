'use client';

import type { NodeMap, OutlineNode } from '@/types';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import mermaid from 'mermaid';

// Initialize pdfMake with fonts
pdfMake.vfs = pdfFonts.vfs as unknown as { [file: string]: string };

// Initialize mermaid for PDF rendering
function initMermaidForPdf() {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'neutral',
    securityLevel: 'loose',
    fontFamily: 'Helvetica, Arial, sans-serif',
  });
}

// Check if running in Capacitor native app
function isCapacitorNative(): boolean {
  return typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
}

/**
 * Sanitize Mermaid code to fix common syntax errors
 */
function sanitizeMermaidCode(code: string): string {
  let sanitized = code;

  // Fix participant names with parentheses: "participant Platform (iOS, Mac)" -> "participant Platform"
  sanitized = sanitized.replace(
    /participant\s+(\w+)\s*\([^)]+\)/g,
    'participant $1'
  );

  // Fix flowchart node labels with parentheses inside square brackets
  // e.g., B[Retention (D1, D7, D30)] -> B[Retention D1, D7, D30]
  sanitized = sanitized.replace(
    /(\w+)\[([^\]]*)\(([^)]*)\)([^\]]*)\]/g,
    (match, id, before, parens, after) => {
      return `${id}[${before}${parens}${after}]`;
    }
  );

  // Fix flowchart decision diamonds with parentheses inside curly braces
  // e.g., B{Build MVP (Minimum Viable Product)} -> B{Build MVP - Minimum Viable Product}
  sanitized = sanitized.replace(
    /(\w+)\{([^}]*)\(([^)]*)\)([^}]*)\}/g,
    (match, id, before, parens, after) => {
      return `${id}{${before}- ${parens}${after}}`;
    }
  );

  // Remove semicolons at end of lines (not needed and can cause issues)
  sanitized = sanitized.replace(/;$/gm, '');

  return sanitized;
}

/**
 * Convert mermaid code to a PNG data URL
 */
async function renderMermaidToPng(code: string, index: number): Promise<string | null> {
  try {
    initMermaidForPdf();
    const id = `mermaid-pdf-${index}-${Date.now()}`;
    const sanitizedCode = sanitizeMermaidCode(code);
    const { svg } = await mermaid.render(id, sanitizedCode);

    // Parse SVG to get dimensions
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = svg;
    const svgElement = tempDiv.querySelector('svg');

    if (!svgElement) return null;

    // Get dimensions
    let svgWidth = 400;
    let svgHeight = 300;

    const viewBox = svgElement.getAttribute('viewBox');
    if (viewBox) {
      const parts = viewBox.split(/\s+|,/).map(parseFloat);
      if (parts.length >= 4) {
        svgWidth = parts[2];
        svgHeight = parts[3];
      }
    } else {
      const widthAttr = svgElement.getAttribute('width');
      const heightAttr = svgElement.getAttribute('height');
      if (widthAttr) svgWidth = parseFloat(widthAttr.replace(/[^0-9.]/g, '')) || 400;
      if (heightAttr) svgHeight = parseFloat(heightAttr.replace(/[^0-9.]/g, '')) || 300;
    }

    // Scale to target width - use smaller size for PDF to reduce file size
    const targetWidth = 400;
    const aspectRatio = svgHeight / svgWidth;
    const targetHeight = Math.round(targetWidth * aspectRatio);

    // Set viewBox and dimensions
    if (!svgElement.getAttribute('viewBox')) {
      svgElement.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
    }
    svgElement.setAttribute('width', String(targetWidth));
    svgElement.setAttribute('height', String(targetHeight));

    // Convert to JPEG via canvas (smaller file size than PNG)
    const svgString = new XMLSerializer().serializeToString(svgElement);
    const svgBase64 = btoa(unescape(encodeURIComponent(svgString)));
    const svgDataUrl = `data:image/svg+xml;base64,${svgBase64}`;

    const canvas = document.createElement('canvas');
    const dpr = 1.5; // Reduced from 2 for smaller file size
    canvas.width = targetWidth * dpr;
    canvas.height = targetHeight * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // White background for JPEG
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve();
      };
      img.onerror = reject;
      img.src = svgDataUrl;
    });

    // Use JPEG with 80% quality for smaller file size
    return canvas.toDataURL('image/jpeg', 0.8);
  } catch (err) {
    console.error('Failed to render mermaid diagram:', err);
    return null;
  }
}

/**
 * Strip HTML tags and get plain text
 */
function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

/**
 * Parse HTML content into pdfmake content array
 */
function parseHtmlContent(html: string): any[] {
  const content: any[] = [];
  const div = document.createElement('div');
  div.innerHTML = html;

  function processNode(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        content.push({ text, margin: [0, 2, 0, 2] });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tagName = el.tagName.toLowerCase();

      // Check for mermaid block
      if (el.hasAttribute('data-mermaid-block')) {
        const code = el.getAttribute('data-mermaid-code') || '';
        content.push({ mermaidCode: code, margin: [0, 8, 0, 8] });
        return;
      }

      switch (tagName) {
        case 'p':
          const pText = stripHtml(el.innerHTML);
          if (pText) {
            content.push({ text: pText, margin: [0, 4, 0, 4] });
          }
          break;

        case 'strong':
        case 'b':
          content.push({ text: stripHtml(el.innerHTML), bold: true });
          break;

        case 'em':
        case 'i':
          content.push({ text: stripHtml(el.innerHTML), italics: true });
          break;

        case 'ul':
          const ulItems: any[] = [];
          el.querySelectorAll(':scope > li').forEach(li => {
            ulItems.push({ text: stripHtml(li.innerHTML) });
          });
          if (ulItems.length > 0) {
            content.push({ ul: ulItems, margin: [0, 4, 0, 4] });
          }
          break;

        case 'ol':
          const olItems: any[] = [];
          el.querySelectorAll(':scope > li').forEach(li => {
            olItems.push({ text: stripHtml(li.innerHTML) });
          });
          if (olItems.length > 0) {
            content.push({ ol: olItems, margin: [0, 4, 0, 4] });
          }
          break;

        case 'blockquote':
          content.push({
            text: stripHtml(el.innerHTML),
            italics: true,
            color: '#666666',
            margin: [20, 4, 0, 4],
          });
          break;

        case 'pre':
        case 'code':
          content.push({
            text: stripHtml(el.innerHTML),
            fontSize: 9,
            color: '#374151',
            background: '#f3f4f6',
            margin: [0, 4, 0, 4],
            preserveLeadingSpaces: true,
          });
          break;

        case 'a':
          content.push({
            text: stripHtml(el.innerHTML),
            link: el.getAttribute('href') || '',
            color: '#0066cc',
            decoration: 'underline',
          });
          break;

        case 'br':
          content.push({ text: '\n' });
          break;

        default:
          // Process children
          el.childNodes.forEach(child => processNode(child));
      }
    }
  }

  div.childNodes.forEach(child => processNode(child));
  return content;
}

/**
 * Build pdfmake content from node tree
 */
async function buildPdfContent(
  nodes: NodeMap,
  nodeId: string,
  depth: number = 0
): Promise<any[]> {
  const node = nodes[nodeId];
  if (!node) return [];

  const content: any[] = [];

  // Determine heading style based on depth
  let style = 'h1';
  if (depth === 0) style = 'h1';
  else if (depth === 1) style = 'h2';
  else if (depth === 2) style = 'h3';
  else if (depth === 3) style = 'h4';
  else style = 'h5';

  // Add heading. `tocItem: true` registers this heading in the clickable
  // Table of Contents; `tocMargin` indents deeper headings in the TOC so the
  // outline hierarchy is visible. `tocStyle` keeps TOC entries readable.
  const headingText = node.prefix ? `${node.prefix} ${node.name}` : node.name;
  content.push({
    text: headingText,
    style,
    // `id` makes this heading a page-reference target so the Index at the end
    // can print the page number where each section lands.
    id: `sec-${nodeId}`,
    tocItem: true,
    tocMargin: [Math.min(depth, 5) * 12, 0, 0, 0],
    tocStyle: { fontSize: 11, bold: depth <= 1 },
    margin: [0, depth === 0 ? 0 : 12, 0, 6],
  });

  // Add content
  if (node.content && node.content.trim()) {
    const parsedContent = parseHtmlContent(node.content);

    // Process any mermaid blocks
    for (let i = 0; i < parsedContent.length; i++) {
      const item = parsedContent[i];
      if (item.mermaidCode) {
        const pngDataUrl = await renderMermaidToPng(item.mermaidCode, i);
        if (pngDataUrl) {
          content.push({
            image: pngDataUrl,
            width: 450,
            alignment: 'center',
            margin: [0, 8, 0, 8],
          });
        } else {
          content.push({
            text: '[Diagram could not be rendered]',
            color: '#cc0000',
            margin: [0, 4, 0, 4],
          });
        }
      } else {
        content.push(item);
      }
    }
  }

  // Process children
  if (node.childrenIds && node.childrenIds.length > 0) {
    for (const childId of node.childrenIds) {
      const childContent = await buildPdfContent(nodes, childId, depth + 1);
      content.push(...childContent);
    }
  }

  return content;
}

/**
 * Build HTML content for native print-to-PDF
 */
async function buildHtmlContent(
  nodes: NodeMap,
  nodeId: string,
  depth: number = 0
): Promise<string> {
  const node = nodes[nodeId];
  if (!node) return '';

  const parts: string[] = [];

  // Determine heading tag based on depth
  const headingTag = depth === 0 ? 'h1' : depth === 1 ? 'h2' : depth === 2 ? 'h3' : depth === 3 ? 'h4' : 'h5';
  const headingText = node.prefix ? `${node.prefix} ${node.name}` : node.name;

  // Add heading
  parts.push(`<${headingTag}>${escapeHtml(headingText)}</${headingTag}>`);

  // Add content (already HTML from TipTap)
  if (node.content && node.content.trim()) {
    // Process mermaid blocks - render them as SVG
    let processedContent = node.content;
    const mermaidRegex = /<div[^>]*data-mermaid-block[^>]*data-mermaid-code="([^"]*)"[^>]*>[\s\S]*?<\/div>/gi;
    const matches = [...processedContent.matchAll(mermaidRegex)];

    for (const match of matches) {
      const mermaidCode = match[1]
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');

      try {
        initMermaidForPdf();
        const sanitizedCode = sanitizeMermaidCode(mermaidCode);
        const id = `mermaid-html-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const { svg } = await mermaid.render(id, sanitizedCode);
        // Replace the mermaid div with the SVG
        processedContent = processedContent.replace(match[0], `<div style="text-align: center; margin: 16px 0;">${svg}</div>`);
      } catch (err) {
        console.error('Failed to render mermaid for HTML:', err);
        processedContent = processedContent.replace(match[0], '<p style="color: #cc0000;">[Diagram could not be rendered]</p>');
      }
    }

    parts.push(`<div class="content">${processedContent}</div>`);
  }

  // Process children
  if (node.childrenIds && node.childrenIds.length > 0) {
    for (const childId of node.childrenIds) {
      const childContent = await buildHtmlContent(nodes, childId, depth + 1);
      parts.push(childContent);
    }
  }

  return parts.join('\n');
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate a full HTML document for printing
 */
async function generatePrintHtml(nodes: NodeMap, rootId: string): Promise<string> {
  const bodyContent = await buildHtmlContent(nodes, rootId);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #1a1a1a;
      max-width: 100%;
      padding: 0;
      margin: 0;
    }
    h1 {
      font-size: 22pt;
      font-weight: bold;
      margin: 0 0 12px 0;
      page-break-after: avoid;
    }
    h2 {
      font-size: 18pt;
      font-weight: bold;
      margin: 20px 0 10px 0;
      page-break-after: avoid;
    }
    h3 {
      font-size: 14pt;
      font-weight: bold;
      margin: 16px 0 8px 0;
      page-break-after: avoid;
    }
    h4 {
      font-size: 12pt;
      font-weight: bold;
      margin: 14px 0 6px 0;
      page-break-after: avoid;
    }
    h5 {
      font-size: 11pt;
      font-weight: bold;
      margin: 12px 0 4px 0;
      page-break-after: avoid;
    }
    p {
      margin: 8px 0;
    }
    ul, ol {
      margin: 8px 0;
      padding-left: 24px;
    }
    li {
      margin: 4px 0;
    }
    blockquote {
      margin: 8px 0;
      padding-left: 16px;
      border-left: 3px solid #ccc;
      color: #666;
      font-style: italic;
    }
    pre, code {
      font-family: 'SF Mono', Monaco, 'Courier New', monospace;
      font-size: 10pt;
      background: #f4f4f4;
      padding: 2px 4px;
      border-radius: 3px;
    }
    pre {
      padding: 12px;
      overflow-x: auto;
      white-space: pre-wrap;
    }
    .content {
      margin-bottom: 8px;
    }
    svg {
      max-width: 100%;
      height: auto;
    }
    img {
      max-width: 100%;
      height: auto;
    }
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
${bodyContent}
</body>
</html>`;
}

/**
 * Collect every section heading (title + its page-reference id) for the
 * alphabetical Index at the end of the document.
 */
function collectIndexEntries(
  nodes: NodeMap,
  nodeId: string,
  out: { name: string; display: string; id: string }[]
): void {
  const node = nodes[nodeId];
  if (!node) return;
  const display = node.prefix ? `${node.prefix} ${node.name}` : node.name;
  out.push({ name: (node.name || '').trim(), display, id: `sec-${nodeId}` });
  if (node.childrenIds && node.childrenIds.length > 0) {
    for (const childId of node.childrenIds) {
      collectIndexEntries(nodes, childId, out);
    }
  }
}

/**
 * Assemble the pdfMake document definition — a proper book:
 *   1. A TITLE PAGE (document title + date) on its own page.
 *   2. A TABLE OF CONTENTS with page numbers, built natively from the
 *      `tocItem: true` headings (clickable/linked).
 *   3. The full body content.
 *   4. An alphabetical INDEX of every section, each with its page number
 *      (via pdfMake `pageReference` against the heading `id`s).
 */
function buildDocDefinition(nodes: NodeMap, rootId: string, content: any[]): any {
  const rootNode = nodes[rootId];
  const title = rootNode?.name?.trim() || 'Outline';
  const dateStr = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Alphabetical index entries (case-insensitive by section name).
  const indexRaw: { name: string; display: string; id: string }[] = [];
  collectIndexEntries(nodes, rootId, indexRaw);
  const indexEntries = indexRaw
    .filter((e) => e.display && e.display.trim())
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
    .map((e) => ({
      columns: [
        { text: e.display, width: '*', fontSize: 10 },
        { text: '', pageReference: e.id, width: 28, alignment: 'right', fontSize: 10 },
      ],
      columnGap: 8,
      margin: [0, 1.5, 0, 1.5],
    }));

  return {
    content: [
      // 1. TITLE PAGE — its own page.
      {
        stack: [
          { text: title, style: 'docTitle', alignment: 'center' },
          {
            canvas: [
              { type: 'line', x1: 180, y1: 12, x2: 335, y2: 12, lineWidth: 2, lineColor: '#1a1a1a' },
            ],
          },
          { text: dateStr, style: 'docSubtitle', alignment: 'center', margin: [0, 18, 0, 0] },
        ],
        margin: [0, 220, 0, 0],
        pageBreak: 'after',
      },
      // 2. TABLE OF CONTENTS (with page numbers) — its own page.
      {
        toc: {
          title: { text: 'Table of Contents', style: 'tocTitle', margin: [0, 0, 0, 12] },
        },
      },
      { text: '', pageBreak: 'after' },
      // 3. BODY.
      ...content,
      // 4. INDEX — alphabetical, with page numbers.
      { text: 'Index', style: 'indexTitle', pageBreak: 'before', margin: [0, 0, 0, 12] },
      ...indexEntries,
    ],
    styles: {
      docTitle: { fontSize: 30, bold: true },
      docSubtitle: { fontSize: 13, color: '#555555' },
      tocTitle: { fontSize: 20, bold: true },
      indexTitle: { fontSize: 22, bold: true },
      h1: { fontSize: 22, bold: true, margin: [0, 0, 0, 10] },
      h2: { fontSize: 18, bold: true, margin: [0, 16, 0, 8] },
      h3: { fontSize: 14, bold: true, margin: [0, 12, 0, 6] },
      h4: { fontSize: 12, bold: true, margin: [0, 10, 0, 4] },
      h5: { fontSize: 11, bold: true, margin: [0, 8, 0, 4] },
    },
    defaultStyle: {
      fontSize: 11,
      lineHeight: 1.4,
    },
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
  };
}

/**
 * Render a pdfMake document definition to a Blob using a Web Worker so the
 * heavy, synchronous layout/render pass never blocks the UI thread. This is
 * what keeps the app responsive (no freeze) and the export cancelable — on
 * Safari/WebKit, other browsers, iOS (WKWebView) and Electron alike.
 *
 * If a worker can't be created or fails to run (very old engine), it falls
 * back to a main-thread render so a PDF is still produced.
 */
function renderDocToBlob(docDefinition: any, signal?: AbortSignal): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Export canceled', 'AbortError'));
      return;
    }

    let worker: Worker | null = null;
    let settled = false;

    const cleanup = () => {
      if (signal) signal.removeEventListener('abort', onAbort);
      if (worker) {
        try { worker.terminate(); } catch { /* ignore */ }
        worker = null;
      }
    };

    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new DOMException('Export canceled', 'AbortError'));
    };

    const fallbackMainThread = () => {
      // Last resort: render on the main thread. Can briefly block, but
      // guarantees a PDF is still produced if the worker is unavailable.
      // pdfMake 0.3.x is Promise-based.
      console.log('[pdf] rendering on MAIN thread (worker unavailable)');
      (pdfMake as any).createPdf(docDefinition).getBlob()
        .then((blob: Blob) => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(blob);
        })
        .catch((err: any) => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(err);
        });
    };

    try {
      worker = new Worker(new URL('./pdf-render.worker.ts', import.meta.url));
      console.log('[pdf] worker created');
    } catch (err) {
      console.warn('[pdf] worker unavailable, rendering on main thread:', err);
      fallbackMainThread();
      return;
    }

    if (signal) signal.addEventListener('abort', onAbort, { once: true });

    worker.onmessage = (e: MessageEvent) => {
      if (settled) return;
      const msg = e.data || {};
      if (msg.type !== 'done') return;
      console.log('[pdf] worker done, ok:', msg.ok);
      settled = true;
      const buf = msg.buffer;
      cleanup();
      if (msg.ok && buf) {
        resolve(new Blob([buf], { type: 'application/pdf' }));
      } else {
        reject(new Error(msg.error || 'PDF worker failed'));
      }
    };

    worker.onerror = (err) => {
      if (settled) return;
      console.warn('[pdf] worker error, falling back to main thread:', err.message);
      try { worker?.terminate(); } catch { /* ignore */ }
      worker = null;
      fallbackMainThread();
    };

    console.log('[pdf] posting docDefinition to worker');
    worker.postMessage({ type: 'render', docDefinition });
  });
}

/** Convert an ArrayBuffer to base64 in chunks (safe for multi-MB PDFs). */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)) as unknown as number[]
    );
  }
  return btoa(binary);
}

/** Trigger a browser download of a Blob (universal fallback incl. Safari). */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Save a rendered PDF on iOS via the native cache + share sheet. */
async function saveBlobIos(blob: Blob, pdfName: string): Promise<void> {
  const base64 = arrayBufferToBase64(await blob.arrayBuffer());
  const Capacitor = (window as any).Capacitor;
  if (Capacitor?.Plugins?.Filesystem && Capacitor?.Plugins?.Share) {
    const Filesystem = Capacitor.Plugins.Filesystem;
    const Share = Capacitor.Plugins.Share;
    const result = await Filesystem.writeFile({ path: pdfName, data: base64, directory: 'CACHE' });
    await Share.share({ title: pdfName, url: result.uri });
  } else {
    downloadBlob(blob, pdfName);
  }
}

/**
 * Generate and save a PDF from a subtree.
 *
 * The layout/render pass runs in a Web Worker (see renderDocToBlob), so the
 * UI never freezes, the export is cancelable via `signal`, and progress is
 * reported via `onProgress`. Saving then routes by platform (iOS share sheet,
 * Electron save-dialog + open in Preview, File System Access picker, or a
 * plain download on Safari/other browsers). The pdfMake document keeps its
 * cover title + clickable Table of Contents (see buildDocDefinition).
 */
export async function exportSubtreeToPdf(
  nodes: NodeMap,
  rootId: string,
  filename: string,
  onProgress?: (stage: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const report = (stage: string) => {
    try { onProgress?.(stage); } catch { /* ignore progress callback errors */ }
  };

  const pdfName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  const isElectron = typeof window !== 'undefined' && (window as any).electronAPI?.isElectron === true;

  // Build the pdfMake document definition on the main thread (this step needs
  // the DOM to parse TipTap HTML), then hand it to the worker to render.
  report('Preparing content…');
  const content = await buildPdfContent(nodes, rootId);
  if (signal?.aborted) return;

  if (content.length === 0) {
    console.warn('No content generated for PDF!');
    throw new Error('No content generated for PDF export');
  }

  const docDefinition: any = buildDocDefinition(nodes, rootId, content);

  // Heavy layout + render — OFF the UI thread.
  report('Generating PDF…');
  const blob = await renderDocToBlob(docDefinition, signal);
  if (signal?.aborted) return;
  console.log('PDF blob size:', blob.size, 'bytes');

  report('Saving…');

  // ── iOS: cache + native share sheet ──
  if (isCapacitorNative()) {
    await saveBlobIos(blob, pdfName);
    report('Done');
    return;
  }

  // ── Electron: save dialog, write to disk, open in Preview ──
  if (isElectron && (window as any).electronAPI?.saveFileDialog) {
    const electronAPI = (window as any).electronAPI;
    const filePath = await electronAPI.saveFileDialog({
      title: 'Save PDF',
      defaultPath: pdfName,
      filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
    });
    if (!filePath) return; // user cancelled the save dialog

    const base64 = arrayBufferToBase64(await blob.arrayBuffer());
    const writeResult = await electronAPI.writeFile(filePath, base64, 'base64');
    if (writeResult && writeResult.success === false) {
      throw new Error(writeResult.error || 'Failed to save PDF');
    }
    // Open the finished PDF in the OS default viewer (Preview on macOS).
    await electronAPI.openFile(filePath);
    report('Done');
    return;
  }

  // ── Browser with File System Access API (Chrome/Edge) ──
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: pdfName,
        types: [{ description: 'PDF Document', accept: { 'application/pdf': ['.pdf'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      report('Done');
      return;
    } catch (err: any) {
      if (err.name === 'AbortError') return; // user cancelled the picker
      console.warn('File System Access failed, falling back to download:', err);
      // fall through to the universal download
    }
  }

  // ── Universal fallback (Safari/WebKit + everything else): download ──
  downloadBlob(blob, pdfName);
  report('Done');
}

/**
 * Share a PDF on iOS using the native share sheet.
 * Renders off the UI thread via the worker so the app never freezes.
 */
export async function shareSubtreePdf(
  nodes: NodeMap,
  rootId: string,
  filename: string
): Promise<void> {
  const content = await buildPdfContent(nodes, rootId);
  const docDefinition: any = buildDocDefinition(nodes, rootId, content);
  const pdfName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

  const blob = await renderDocToBlob(docDefinition);
  await saveBlobIos(blob, pdfName);
}

/**
 * Get a suggested filename for the PDF based on the node name
 */
export function getSuggestedPdfFilename(nodeName: string): string {
  return nodeName
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 100)
    .trim() || 'outline';
}
