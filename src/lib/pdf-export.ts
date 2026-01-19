'use client';

import type { NodeMap, OutlineNode } from '@/types';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import mermaid from 'mermaid';

// Initialize pdfMake with fonts
pdfMake.vfs = pdfFonts.vfs;

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

  // Add heading
  const headingText = node.prefix ? `${node.prefix} ${node.name}` : node.name;
  content.push({ text: headingText, style, margin: [0, depth === 0 ? 0 : 12, 0, 6] });

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
 * Generate and download a PDF from a subtree
 */
export async function exportSubtreeToPdf(
  nodes: NodeMap,
  rootId: string,
  filename: string
): Promise<void> {
  console.log('PDF Export starting for node:', rootId);
  console.log('Nodes available:', Object.keys(nodes).length);

  const content = await buildPdfContent(nodes, rootId);

  console.log('PDF content items:', content.length);
  console.log('First 3 content items:', JSON.stringify(content.slice(0, 3), null, 2));

  if (content.length === 0) {
    alert('PDF Export Error: No content generated!');
    console.warn('No content generated for PDF!');
    console.log('Root node:', nodes[rootId]);
    throw new Error('No content generated for PDF export');
  }

  const docDefinition: any = {
    content,
    styles: {
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

  const pdfName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

  // Check if running in Electron (which may not fully support File System Access API)
  const isElectron = typeof window !== 'undefined' && (window as any).electronAPI?.isElectron === true;

  if (isCapacitorNative()) {
    // For iOS: Generate blob and share
    await shareSubtreePdf(nodes, rootId, filename);
  } else if (!isElectron && 'showSaveFilePicker' in window) {
    // Try File System Access API (only in browser, not Electron)
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: pdfName,
        types: [{
          description: 'PDF Document',
          accept: { 'application/pdf': ['.pdf'] },
        }],
      });

      // Get blob from pdfMake
      const pdfDocGenerator = pdfMake.createPdf(docDefinition);
      const blob = await new Promise<Blob>((resolve) => {
        pdfDocGenerator.getBlob((blob: Blob) => resolve(blob));
      });

      console.log('PDF blob size:', blob.size, 'bytes');

      // Write to the chosen file
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      console.log('PDF written successfully');
    } catch (err: any) {
      // User cancelled the save dialog - that's OK, just don't do anything
      if (err.name === 'AbortError') {
        return;
      }
      // For other errors, fall back to download
      console.warn('File System Access failed, falling back to download:', err);
      pdfMake.createPdf(docDefinition).download(pdfName);
    }
  } else {
    // Electron: use native print-to-PDF (handles large documents well)
    if (isElectron) {
      const electronAPI = (window as any).electronAPI;
      const filePath = await electronAPI.saveFileDialog({
        title: 'Save PDF',
        defaultPath: pdfName,
        filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
      });

      if (!filePath) {
        // User cancelled
        return;
      }

      try {
        console.log('Generating HTML for native print-to-PDF...');

        // Build HTML content
        const htmlContent = await generatePrintHtml(nodes, rootId);
        console.log('HTML generated, length:', htmlContent.length);

        // Use Electron's native print-to-PDF
        console.log('Calling printToPdf...');
        const result = await electronAPI.printToPdf(htmlContent, filePath);

        if (!result.success) {
          console.error('printToPdf failed:', result.error);
          alert('Failed to generate PDF: ' + result.error);
          return;
        }

        console.log('PDF saved and opened successfully');
      } catch (err: any) {
        console.error('PDF generation failed:', err);
        alert('PDF generation failed: ' + (err.message || err));
      }
    } else {
      // Browser without File System Access API: use regular download
      console.log('Using pdfMake download for:', pdfName);
      pdfMake.createPdf(docDefinition).download(pdfName);
    }
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
  const content = await buildPdfContent(nodes, rootId);

  const docDefinition: any = {
    content,
    styles: {
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

  const pdfName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

  // Generate PDF as base64
  pdfMake.createPdf(docDefinition).getBase64(async (base64Data: string) => {
    const Capacitor = (window as any).Capacitor;
    if (Capacitor?.Plugins?.Filesystem && Capacitor?.Plugins?.Share) {
      try {
        const Filesystem = Capacitor.Plugins.Filesystem;
        const Share = Capacitor.Plugins.Share;

        // Write to cache directory
        const result = await Filesystem.writeFile({
          path: pdfName,
          data: base64Data,
          directory: 'CACHE',
        });

        // Share the file
        await Share.share({
          title: pdfName,
          url: result.uri,
        });
      } catch (error) {
        console.error('Failed to share PDF:', error);
        // Fallback to download
        pdfMake.createPdf(docDefinition).download(pdfName);
      }
    } else {
      // Fallback: download directly
      pdfMake.createPdf(docDefinition).download(pdfName);
    }
  });
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
