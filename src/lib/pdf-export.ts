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
 * Convert mermaid code to a PNG data URL
 */
async function renderMermaidToPng(code: string, index: number): Promise<string | null> {
  try {
    initMermaidForPdf();
    const id = `mermaid-pdf-${index}-${Date.now()}`;
    const { svg } = await mermaid.render(id, code);

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

    // Scale to target width
    const targetWidth = 500;
    const aspectRatio = svgHeight / svgWidth;
    const targetHeight = Math.round(targetWidth * aspectRatio);

    // Set viewBox and dimensions
    if (!svgElement.getAttribute('viewBox')) {
      svgElement.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
    }
    svgElement.setAttribute('width', String(targetWidth));
    svgElement.setAttribute('height', String(targetHeight));

    // Convert to PNG via canvas using data URL
    const svgString = new XMLSerializer().serializeToString(svgElement);
    const svgBase64 = btoa(unescape(encodeURIComponent(svgString)));
    const svgDataUrl = `data:image/svg+xml;base64,${svgBase64}`;

    const canvas = document.createElement('canvas');
    const dpr = 2;
    canvas.width = targetWidth * dpr;
    canvas.height = targetHeight * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#fafafa';
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

    return canvas.toDataURL('image/png');
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
            font: 'Courier',
            fontSize: 9,
            background: '#f5f5f5',
            margin: [0, 4, 0, 4],
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
 * Generate and download a PDF from a subtree
 */
export async function exportSubtreeToPdf(
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

  if (isCapacitorNative()) {
    // For iOS: Generate blob and share
    await shareSubtreePdf(nodes, rootId, filename);
  } else {
    // Download PDF
    pdfMake.createPdf(docDefinition).download(pdfName);
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
