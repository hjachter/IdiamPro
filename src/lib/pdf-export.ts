'use client';

import type { NodeMap, OutlineNode } from '@/types';

// html2pdf.js doesn't play nice with webpack, so we load it from CDN
let html2pdfPromise: Promise<any> | null = null;

async function getHtml2Pdf(): Promise<any> {
  if ((window as any).html2pdf) {
    return (window as any).html2pdf;
  }

  if (html2pdfPromise) {
    return html2pdfPromise;
  }

  html2pdfPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = () => {
      if ((window as any).html2pdf) {
        resolve((window as any).html2pdf);
      } else {
        reject(new Error('html2pdf failed to load'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load html2pdf.js'));
    document.head.appendChild(script);
  });

  return html2pdfPromise;
}

// Check if running in Capacitor native app
function isCapacitorNative(): boolean {
  return typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
}

/**
 * Convert a subtree of nodes to formatted HTML for PDF generation
 */
function subtreeToHtml(nodes: NodeMap, rootId: string, baseDepth: number = 0): string {
  const node = nodes[rootId];
  if (!node) return '';

  const htmlParts: string[] = [];

  // Add CSS styles
  htmlParts.push(`
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        font-size: 12pt;
        line-height: 1.6;
        color: #333;
        max-width: 100%;
        padding: 20px;
      }
      h1 { font-size: 24pt; margin-top: 24pt; margin-bottom: 12pt; color: #1a1a1a; }
      h2 { font-size: 20pt; margin-top: 20pt; margin-bottom: 10pt; color: #2a2a2a; }
      h3 { font-size: 16pt; margin-top: 16pt; margin-bottom: 8pt; color: #3a3a3a; }
      h4 { font-size: 14pt; margin-top: 14pt; margin-bottom: 6pt; color: #4a4a4a; }
      h5 { font-size: 12pt; margin-top: 12pt; margin-bottom: 4pt; color: #5a5a5a; }
      .prefix { color: #888; font-weight: normal; margin-right: 8px; }
      .content { margin-bottom: 16pt; }
      pre {
        background: #f5f5f5;
        padding: 12px;
        border-radius: 4px;
        overflow-x: auto;
        font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
        font-size: 10pt;
      }
      code {
        background: #f0f0f0;
        padding: 2px 4px;
        border-radius: 2px;
        font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
        font-size: 10pt;
      }
      blockquote {
        border-left: 4px solid #ddd;
        padding-left: 16px;
        margin-left: 0;
        color: #666;
        font-style: italic;
      }
      .task { margin: 8pt 0; }
      .task-checkbox { margin-right: 8px; }
      .task-completed { text-decoration: line-through; color: #888; }
      .link { color: #0066cc; text-decoration: underline; }
      .indent-1 { margin-left: 20px; }
      .indent-2 { margin-left: 40px; }
      .indent-3 { margin-left: 60px; }
      ul, ol { margin: 8pt 0; padding-left: 24px; }
      li { margin: 4pt 0; }
      p { margin: 8pt 0; }
      a { color: #0066cc; }
      img { max-width: 100%; height: auto; }
    </style>
  `);

  // Recursively build HTML for the subtree
  buildNodeHtml(nodes, rootId, 0, baseDepth, htmlParts);

  return htmlParts.join('\n');
}

/**
 * Recursively build HTML for a node and its children
 */
function buildNodeHtml(
  nodes: NodeMap,
  nodeId: string,
  depth: number,
  baseDepth: number,
  htmlParts: string[]
): void {
  const node = nodes[nodeId];
  if (!node) return;

  const effectiveDepth = depth;

  // Determine heading level based on depth (H1-H5, then H5 with indentation)
  let headingTag = 'h1';
  let indentClass = '';

  if (effectiveDepth === 0) {
    headingTag = 'h1';
  } else if (effectiveDepth === 1) {
    headingTag = 'h2';
  } else if (effectiveDepth === 2) {
    headingTag = 'h3';
  } else if (effectiveDepth === 3) {
    headingTag = 'h4';
  } else {
    headingTag = 'h5';
    const extraIndent = effectiveDepth - 4;
    if (extraIndent > 0) {
      indentClass = ` class="indent-${Math.min(extraIndent, 3)}"`;
    }
  }

  // Build the heading with optional prefix
  const prefix = node.prefix ? `<span class="prefix">${escapeHtml(node.prefix)}</span>` : '';
  htmlParts.push(`<${headingTag}${indentClass}>${prefix}${escapeHtml(node.name)}</${headingTag}>`);

  // Render node content based on type
  if (node.content && node.content.trim()) {
    const contentHtml = renderNodeContent(node);
    if (contentHtml) {
      htmlParts.push(`<div class="content">${contentHtml}</div>`);
    }
  }

  // Recursively process children
  if (node.childrenIds && node.childrenIds.length > 0) {
    for (const childId of node.childrenIds) {
      buildNodeHtml(nodes, childId, depth + 1, baseDepth, htmlParts);
    }
  }
}

/**
 * Render node content based on its type
 */
function renderNodeContent(node: OutlineNode): string {
  // TipTap content is already HTML, but we need to handle special node types
  switch (node.type) {
    case 'code':
      // Wrap in pre/code if not already wrapped
      if (!node.content.includes('<pre>') && !node.content.includes('<code>')) {
        const language = node.metadata?.codeLanguage || '';
        return `<pre><code class="language-${language}">${escapeHtml(stripHtml(node.content))}</code></pre>`;
      }
      return node.content;

    case 'quote':
      // Wrap in blockquote if not already wrapped
      if (!node.content.includes('<blockquote>')) {
        return `<blockquote>${node.content}</blockquote>`;
      }
      return node.content;

    case 'task':
      const isCompleted = node.metadata?.isCompleted;
      const checkbox = isCompleted ? '[x]' : '[ ]';
      const completedClass = isCompleted ? ' task-completed' : '';
      return `<div class="task"><span class="task-checkbox">${checkbox}</span><span class="${completedClass}">${node.content}</span></div>`;

    case 'link':
      const url = node.metadata?.url || '#';
      return `<div><a href="${escapeHtml(url)}" class="link">${node.content || escapeHtml(url)}</a></div>`;

    case 'youtube':
    case 'image':
    case 'video':
    case 'audio':
    case 'pdf':
      // For media embeds, show a link to the resource
      const mediaUrl = node.metadata?.url;
      if (mediaUrl) {
        return `<div><a href="${escapeHtml(mediaUrl)}" class="link">[${node.type}: ${escapeHtml(mediaUrl)}]</a></div>`;
      }
      return node.content || '';

    default:
      // Default: return TipTap HTML content as-is
      return node.content;
  }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Strip HTML tags from content
 */
function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

/**
 * Generate and download a PDF from a subtree
 */
export async function exportSubtreeToPdf(
  nodes: NodeMap,
  rootId: string,
  filename: string
): Promise<void> {
  // Get html2pdf library (loads on first use)
  const html2pdf = await getHtml2Pdf();

  const html = subtreeToHtml(nodes, rootId);

  // Create a container for the HTML
  const container = document.createElement('div');
  container.innerHTML = html;

  const opt = {
    margin: [10, 10, 10, 10], // mm
    filename: filename.endsWith('.pdf') ? filename : `${filename}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait' as const,
    },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
  };

  if (isCapacitorNative()) {
    // For iOS: Generate blob and share
    await shareSubtreePdf(nodes, rootId, filename);
  } else if ('showSaveFilePicker' in window) {
    // Chrome/Edge: Use native file picker
    try {
      const pdfBlob = await html2pdf().set(opt).from(container).outputPdf('blob');
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: opt.filename,
        types: [{
          description: 'PDF Document',
          accept: { 'application/pdf': ['.pdf'] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(pdfBlob);
      await writable.close();
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        // Fallback to blob download if user cancels or API fails
        await html2pdf().set(opt).from(container).save();
      }
    }
  } else {
    // Safari/Firefox: Use blob download
    await html2pdf().set(opt).from(container).save();
  }
}

/**
 * Share a PDF on iOS using the native share sheet
 */
export async function shareSubtreePdf(
  nodes: NodeMap,
  rootId: string,
  filename: string
): Promise<void> {
  const html2pdf = await getHtml2Pdf();
  const html = subtreeToHtml(nodes, rootId);

  const container = document.createElement('div');
  container.innerHTML = html;

  const opt = {
    margin: [10, 10, 10, 10],
    filename: filename.endsWith('.pdf') ? filename : `${filename}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait' as const,
    },
  };

  // Generate PDF as base64
  const pdfBase64 = await html2pdf().set(opt).from(container).outputPdf('datauristring');

  // On iOS, use Capacitor's Share or Filesystem plugin
  const Capacitor = (window as any).Capacitor;
  if (Capacitor?.Plugins?.Share) {
    try {
      // Convert base64 to blob and share
      const base64Data = pdfBase64.split(',')[1];

      // Use Filesystem to write file then share
      const Filesystem = Capacitor.Plugins.Filesystem;
      const Share = Capacitor.Plugins.Share;

      if (Filesystem && Share) {
        // Write to cache directory
        const result = await Filesystem.writeFile({
          path: opt.filename,
          data: base64Data,
          directory: 'CACHE',
        });

        // Share the file
        await Share.share({
          title: opt.filename,
          url: result.uri,
        });
      }
    } catch (error) {
      console.error('Failed to share PDF:', error);
      // Fallback to download
      const link = document.createElement('a');
      link.href = pdfBase64;
      link.download = opt.filename;
      link.click();
    }
  } else {
    // Fallback: download directly
    const link = document.createElement('a');
    link.href = pdfBase64;
    link.download = opt.filename;
    link.click();
  }
}

/**
 * Get a suggested filename for the PDF based on the node name
 */
export function getSuggestedPdfFilename(nodeName: string): string {
  // Clean up the name for use as a filename
  return nodeName
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid filename characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .substring(0, 100) // Limit length
    .trim() || 'outline';
}
