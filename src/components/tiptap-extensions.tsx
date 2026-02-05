import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { isAllowedEmbedUrl } from '@/lib/security';

// Initialize mermaid with configuration that avoids canvas issues
// Using bright green (#16a34a) for arrows - visible in both light and dark modes
mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  securityLevel: 'loose',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  themeVariables: {
    // Make arrows and lines highly visible - bright green
    lineColor: '#16a34a', // Green-600 - visible in light & dark
    arrowheadColor: '#16a34a',
    // Sequence diagram specific
    signalColor: '#16a34a', // Bright green for sequence arrows
    signalTextColor: '#374151', // Gray-700 for labels
    actorLineColor: '#9ca3af', // Medium gray for actor lifelines
    // Flowchart specific
    edgeLabelBackground: 'transparent',
    // General text
    textColor: '#374151', // Gray-700
    primaryTextColor: '#1f2937', // Gray-800
    secondaryTextColor: '#4b5563', // Gray-600
    // Node colors - neutral grays (NO PINK)
    primaryColor: '#f1f5f9', // Slate-100 - light neutral gray
    primaryBorderColor: '#16a34a', // Green-600
    secondaryColor: '#e2e8f0', // Slate-200
    tertiaryColor: '#cbd5e1', // Slate-300
    // Note background
    noteBkgColor: '#fefce8', // Yellow-50
    noteBorderColor: '#ca8a04', // Yellow-600
    // Explicitly set node colors
    nodeBkg: '#f1f5f9', // Slate-100
    mainBkg: '#f1f5f9', // Slate-100
    nodeBorder: '#16a34a', // Green-600
  },
  flowchart: {
    useMaxWidth: true,
    htmlLabels: false, // Use SVG text instead of foreignObject/HTML
    curve: 'basis',
  },
  sequence: {
    useMaxWidth: true,
    actorMargin: 80,
    messageMargin: 40,
  },
});

// Sanitize Mermaid code to fix common syntax errors
const sanitizeMermaidCode = (code: string): string => {
  let sanitized = code;

  // Fix participant names with parentheses: "participant Platform (iOS, Mac)" -> "participant Platform"
  sanitized = sanitized.replace(
    /participant\s+(\w+)\s*\([^)]+\)/g,
    'participant $1'
  );

  // Fix flowchart node labels with parentheses inside square brackets
  // e.g., B[Retention (D1, D7, D30)] -> B[Retention - D1, D7, D30]
  // This regex matches: ID[label with (stuff) inside]
  sanitized = sanitized.replace(
    /(\w+)\[([^\]]*)\(([^)]*)\)([^\]]*)\]/g,
    (match, id, before, parens, after) => {
      // Replace parentheses content with dash-separated
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
};

// Mermaid diagram renderer component
const MermaidRenderer = ({ code }: { code: string }) => {
  const [error, setError] = useState<string | null>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [scaledSvg, setScaledSvg] = useState<string>('');
  const diagramRef = useRef<HTMLDivElement>(null);

  // Create a scaled version of the SVG for fullscreen
  const openFullscreen = () => {
    if (diagramRef.current) {
      const svg = diagramRef.current.querySelector('svg');
      if (svg) {
        // Get the viewBox which defines the true content boundaries
        const viewBox = svg.getAttribute('viewBox');
        let contentWidth: number, contentHeight: number;

        if (viewBox) {
          const parts = viewBox.split(/\s+|,/).map(parseFloat);
          contentWidth = parts[2]; // viewBox width
          contentHeight = parts[3]; // viewBox height
        } else {
          // Fall back to rendered dimensions
          const rect = svg.getBoundingClientRect();
          contentWidth = rect.width;
          contentHeight = rect.height;
        }

        const targetWidth = window.innerWidth * 0.9;
        const targetHeight = window.innerHeight * 0.9;

        // Scale to fill viewport while preserving aspect ratio
        const scaleX = targetWidth / contentWidth;
        const scaleY = targetHeight / contentHeight;
        const fillScale = Math.max(scaleX, scaleY, 1.5);

        const newWidth = Math.round(contentWidth * fillScale);
        const newHeight = Math.round(contentHeight * fillScale);

        // Keep original viewBox intact, just scale dimensions
        // Add overflow:hidden to ensure SVG clips to viewBox boundaries
        let modifiedSvg = svgContent
          .replace(/width="[^"]*"/, `width="${newWidth}"`)
          .replace(/height="[^"]*"/, `height="${newHeight}"`)
          .replace(/<svg([^>]*)>/, '<svg$1 style="overflow:hidden">');

        setScaledSvg(modifiedSvg);
      } else {
        setScaledSvg(svgContent);
      }
    } else {
      setScaledSvg(svgContent);
    }
    setIsFullscreen(true);
  };


  useEffect(() => {
    let cancelled = false;

    const renderDiagram = async () => {
      if (!code) return;

      try {
        setError(null);
        const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`;
        const sanitizedCode = sanitizeMermaidCode(code);

        // Just call render without a container - mermaid will handle it
        let { svg } = await mermaid.render(id, sanitizedCode);

        // Post-process SVG: Add a class to node shapes so CSS can style them
        // Replace problematic fill colors with a CSS variable
        const keepColors = ['none', 'transparent', '#16a34a', '#ffffff', '#000000', '#fff', '#000'];

        // Replace fill="..." attributes with CSS variable
        svg = svg.replace(/fill="([^"]*)"/gi, (match, color) => {
          const c = color.toLowerCase().trim();
          if (keepColors.includes(c) || c === '') return match;
          // Keep greens for arrows
          if (c.startsWith('#1') && c.includes('a3')) return match;
          // Use CSS variable for node fills
          return 'fill="var(--mermaid-node-bg, #f1f5f9)"';
        });

        // Replace fill: ... in style attributes
        svg = svg.replace(/fill:\s*([^;}"'\s]+)/gi, (match, color) => {
          const c = color.toLowerCase().trim();
          if (keepColors.includes(c) || c === '') return match;
          if (c.startsWith('#1') && c.includes('a3')) return match;
          return 'fill: var(--mermaid-node-bg, #f1f5f9)';
        });

        if (!cancelled) {
          setSvgContent(svg);
        }
      } catch (err: unknown) {
        if (cancelled) return;

        // Handle various error types that mermaid might throw
        let errorMessage = 'Failed to render diagram';
        if (err instanceof Error) {
          errorMessage = err.message;
        } else if (typeof err === 'string') {
          errorMessage = err;
        } else if (err && typeof err === 'object' && 'message' in err) {
          errorMessage = String((err as { message: unknown }).message);
        }
        setError(errorMessage);
        setSvgContent('');
      }
    };

    renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    return (
      <div className="mermaid-error p-4 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
        <strong>Diagram Error:</strong> {error}
        <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-x-auto">{code}</pre>
      </div>
    );
  }

  return (
    <>
      <style>{`
        /* CSS variables for light/dark mode */
        .mermaid-diagram {
          --mermaid-node-bg: #f1f5f9;
          --mermaid-text: #1f2937;
        }
        .dark .mermaid-diagram {
          --mermaid-node-bg: #334155;
          --mermaid-text: #f1f5f9;
        }
        /* Light mode text - all text elements */
        .mermaid-diagram svg text,
        .mermaid-diagram svg .nodeLabel,
        .mermaid-diagram svg .edgeLabel,
        .mermaid-diagram svg .label,
        .mermaid-diagram svg .labelText,
        .mermaid-diagram svg .cluster-label,
        .mermaid-diagram svg foreignObject div,
        .mermaid-diagram svg foreignObject span,
        .mermaid-diagram svg foreignObject p,
        .mermaid-diagram svg tspan {
          fill: #1f2937 !important; /* Gray-800 for light mode */
          color: #1f2937 !important;
        }
        /* Dark mode text - override everything */
        .dark .mermaid-diagram svg text,
        .dark .mermaid-diagram svg .nodeLabel,
        .dark .mermaid-diagram svg .edgeLabel,
        .dark .mermaid-diagram svg .label,
        .dark .mermaid-diagram svg .labelText,
        .dark .mermaid-diagram svg .cluster-label,
        .dark .mermaid-diagram svg foreignObject div,
        .dark .mermaid-diagram svg foreignObject span,
        .dark .mermaid-diagram svg foreignObject p,
        .dark .mermaid-diagram svg tspan,
        .dark .mermaid-diagram svg g.label text,
        .dark .mermaid-diagram svg g text {
          fill: #f3f4f6 !important; /* Gray-100 for dark mode - very light */
          color: #f3f4f6 !important;
        }
        /* Node backgrounds - light mode - target ALL rect and polygon in nodes */
        .mermaid-diagram svg .node rect,
        .mermaid-diagram svg .node polygon,
        .mermaid-diagram svg .node circle,
        .mermaid-diagram svg .node path,
        .mermaid-diagram svg .flowchart-label rect,
        .mermaid-diagram svg .label-container,
        .mermaid-diagram svg rect[class*="basic"],
        .mermaid-diagram svg rect,
        .mermaid-diagram svg polygon {
          fill: #f1f5f9 !important; /* Slate-100 */
          stroke: #16a34a !important; /* Green-600 */
        }
        /* Dark mode backgrounds */
        .dark .mermaid-diagram svg .node rect,
        .dark .mermaid-diagram svg .node polygon,
        .dark .mermaid-diagram svg .node circle,
        .dark .mermaid-diagram svg .node path,
        .dark .mermaid-diagram svg .flowchart-label rect,
        .dark .mermaid-diagram svg .label-container,
        .dark .mermaid-diagram svg rect[class*="basic"],
        .dark .mermaid-diagram svg rect,
        .dark .mermaid-diagram svg polygon {
          fill: #1e293b !important; /* Slate-800 */
          stroke: #16a34a !important; /* Green-600 */
        }
        /* Override any inline styles on specific flowchart elements */
        .mermaid-diagram svg [style*="fill"] {
          fill: #f1f5f9 !important;
        }
        .dark .mermaid-diagram svg [style*="fill"] {
          fill: #1e293b !important;
        }
        /* Keep arrows green */
        .mermaid-diagram svg .edge-pattern-solid,
        .mermaid-diagram svg .flowchart-link,
        .mermaid-diagram svg path.path,
        .dark .mermaid-diagram svg .edge-pattern-solid,
        .dark .mermaid-diagram svg .flowchart-link,
        .dark .mermaid-diagram svg path.path {
          stroke: #16a34a !important;
          fill: none !important;
        }
        .mermaid-diagram svg marker path,
        .dark .mermaid-diagram svg marker path {
          fill: #16a34a !important;
          stroke: #16a34a !important;
        }
        /* Flowchart specific nodes */
        .dark .mermaid-diagram svg .flowchart-link {
          stroke: #16a34a !important;
        }
        /* Fullscreen overlay - scrollable both directions */
        .mermaid-fullscreen-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(0, 0, 0, 0.85);
          overflow-x: auto;
          overflow-y: auto;
          padding: 20px 20px 60px 20px;
          -webkit-overflow-scrolling: touch;
        }
        .mermaid-fullscreen-overlay::-webkit-scrollbar {
          width: 14px;
          height: 14px;
        }
        .mermaid-fullscreen-overlay::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.2);
        }
        .mermaid-fullscreen-overlay::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.5);
          border-radius: 7px;
        }
        .mermaid-fullscreen-overlay::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.7);
        }
        .mermaid-fullscreen-overlay::-webkit-scrollbar-corner {
          background: rgba(255, 255, 255, 0.2);
        }
        .mermaid-fullscreen-content {
          position: relative;
          background: #f8fafc;
          border-radius: 8px;
          padding: 50px 20px 40px 20px;
          margin-bottom: 60px;
          display: inline-block;
        }
        .dark .mermaid-fullscreen-content {
          background: #1e293b;
        }
        .mermaid-fullscreen-close {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #ef4444;
          color: white;
          border: none;
          cursor: pointer;
          font-size: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
        }
        .mermaid-fullscreen-close:hover {
          background: #dc2626;
        }
        .mermaid-fullscreen-hint {
          position: absolute;
          bottom: -24px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 11px;
          color: #9ca3af;
          white-space: nowrap;
        }
      `}</style>
      <div
        ref={diagramRef}
        className="mermaid-diagram my-4 flex justify-center cursor-zoom-in relative group"
        dangerouslySetInnerHTML={{ __html: svgContent }}
        onDoubleClick={openFullscreen}
        title="Double-click to enlarge"
      />
      {/* Fullscreen overlay */}
      {isFullscreen && (
        <div
          className="mermaid-fullscreen-overlay"
          onClick={() => setIsFullscreen(false)}
        >
          <div
            className="mermaid-fullscreen-content mermaid-diagram"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="mermaid-fullscreen-close"
              onClick={() => setIsFullscreen(false)}
              aria-label="Close fullscreen"
            >
              ×
            </button>
            <div dangerouslySetInnerHTML={{ __html: scaledSvg }} />
          </div>
          {/* Spacer to ensure bottom border is visible when scrolling */}
          <div style={{ height: '80px', flexShrink: 0 }} />
        </div>
      )}
    </>
  );
};

// Mermaid Block Extension for TipTap
export const MermaidBlock = Node.create({
  name: 'mermaidBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      code: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-mermaid-block]',
        getAttrs: (dom) => ({
          code: (dom as HTMLElement).getAttribute('data-mermaid-code') || '',
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-mermaid-block': '',
      'data-mermaid-code': HTMLAttributes.code,
    })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(({ node }) => {
      return (
        <NodeViewWrapper as="div">
          <MermaidRenderer code={node.attrs.code} />
        </NodeViewWrapper>
      );
    }, { as: 'div' });
  },

  addCommands() {
    return {
      setMermaidDiagram:
        (code: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { code },
          });
        },
    };
  },
});

const EmbedBlockedWarning = ({ url }: { url: string | null }) => (
  <NodeViewWrapper as="div">
    <div className="my-4 p-4 border border-yellow-400 bg-yellow-50 dark:bg-yellow-950/30 rounded-md text-sm text-yellow-800 dark:text-yellow-300">
      <strong>Blocked embed:</strong> The URL &ldquo;{url || '(none)'}&rdquo; is not a recognized Google service URL.
    </div>
  </NodeViewWrapper>
);

// Google Docs Extension
export const GoogleDocs = Node.create({
  name: 'googleDocs',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-google-docs]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-google-docs': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(({ node }) => {
      if (!isAllowedEmbedUrl(node.attrs.src, 'docs')) {
        return <EmbedBlockedWarning url={node.attrs.src} />;
      }
      return (
        <NodeViewWrapper as="div">
          <div className="google-docs-embed my-4">
            <iframe
              src={node.attrs.src}
              className="w-full h-[600px] border rounded-md"
              frameBorder="0"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          </div>
        </NodeViewWrapper>
      );
    }, { as: 'div' });
  },

  addCommands() {
    return {
      setGoogleDocs:
        (src: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { src },
          });
        },
    };
  },
});

// Google Sheets Extension
export const GoogleSheets = Node.create({
  name: 'googleSheets',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-google-sheets]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-google-sheets': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(({ node }) => {
      if (!isAllowedEmbedUrl(node.attrs.src, 'sheets')) {
        return <EmbedBlockedWarning url={node.attrs.src} />;
      }
      return (
        <NodeViewWrapper as="div">
          <div className="google-sheets-embed my-4">
            <iframe
              src={node.attrs.src}
              className="w-full h-[600px] border rounded-md"
              frameBorder="0"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          </div>
        </NodeViewWrapper>
      );
    }, { as: 'div' });
  },

  addCommands() {
    return {
      setGoogleSheets:
        (src: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { src },
          });
        },
    };
  },
});

// Google Slides Extension
export const GoogleSlides = Node.create({
  name: 'googleSlides',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-google-slides]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-google-slides': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(({ node }) => {
      if (!isAllowedEmbedUrl(node.attrs.src, 'slides')) {
        return <EmbedBlockedWarning url={node.attrs.src} />;
      }
      return (
        <NodeViewWrapper as="div">
          <div className="google-slides-embed my-4">
            <iframe
              src={node.attrs.src}
              className="w-full h-[480px] border rounded-md"
              frameBorder="0"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          </div>
        </NodeViewWrapper>
      );
    }, { as: 'div' });
  },

  addCommands() {
    return {
      setGoogleSlides:
        (src: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { src },
          });
        },
    };
  },
});

// Google Maps Extension
export const GoogleMaps = Node.create({
  name: 'googleMaps',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-google-maps]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-google-maps': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(({ node }) => {
      if (!isAllowedEmbedUrl(node.attrs.src, 'maps')) {
        return <EmbedBlockedWarning url={node.attrs.src} />;
      }
      return (
        <NodeViewWrapper as="div">
          <div className="google-maps-embed my-4">
            <iframe
              src={node.attrs.src}
              className="w-full h-[450px] border rounded-md"
              frameBorder="0"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          </div>
        </NodeViewWrapper>
      );
    }, { as: 'div' });
  },

  addCommands() {
    return {
      setGoogleMaps:
        (src: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { src },
          });
        },
    };
  },
});

// Image Block Extension - for local image files (handles large base64 better than default Image)
// Image block view component with fullscreen support
const ImageBlockView = ({ src, alt }: { src: string; alt: string }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const openFullscreen = () => {
    setIsFullscreen(true);
  };

  return (
    <>
      <style>{`
        .image-fullscreen-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(0, 0, 0, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          overflow: auto;
        }
        .image-fullscreen-content {
          position: relative;
          max-width: 95vw;
          max-height: 95vh;
        }
        .image-fullscreen-content img {
          max-width: 95vw;
          max-height: 90vh;
          object-fit: contain;
          border-radius: 8px;
        }
        .image-fullscreen-close {
          position: absolute;
          top: -40px;
          right: 0;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #ef4444;
          color: white;
          border: none;
          cursor: pointer;
          font-size: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
        }
        .image-fullscreen-close:hover {
          background: #dc2626;
        }
        .image-fullscreen-hint {
          position: absolute;
          bottom: -24px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 11px;
          color: #9ca3af;
          white-space: nowrap;
        }
      `}</style>
      <div
        className="image-embed my-4 cursor-zoom-in"
        onDoubleClick={openFullscreen}
        title="Double-click to enlarge"
      >
        <img
          src={src}
          alt={alt || ''}
          className="h-auto rounded-lg"
          style={{
            minWidth: '400px',
            maxWidth: '800px',
            width: 'auto',
          }}
        />
      </div>
      {isFullscreen && (
        <div
          className="image-fullscreen-overlay"
          onClick={() => setIsFullscreen(false)}
        >
          <div
            className="image-fullscreen-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="image-fullscreen-close"
              onClick={() => setIsFullscreen(false)}
              aria-label="Close fullscreen"
            >
              ×
            </button>
            <img src={src} alt={alt || ''} />
            <div className="image-fullscreen-hint">Click outside or press × to close</div>
          </div>
        </div>
      )}
    </>
  );
};

// Image Block Extension - for local image files (handles large base64 better than default Image)
export const ImageBlock = Node.create({
  name: 'imageBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-image-block]',
        getAttrs: (dom) => ({
          src: (dom as HTMLElement).getAttribute('data-image-src') || '',
          alt: (dom as HTMLElement).getAttribute('data-image-alt') || '',
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-image-block': '',
      'data-image-src': HTMLAttributes.src,
      'data-image-alt': HTMLAttributes.alt || '',
    })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(({ node }) => {
      return (
        <NodeViewWrapper as="div">
          <ImageBlockView src={node.attrs.src} alt={node.attrs.alt || ''} />
        </NodeViewWrapper>
      );
    }, { as: 'div' });
  },

  addCommands() {
    return {
      setImageBlock:
        (src: string, alt?: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { src, alt: alt || '' },
          });
        },
    };
  },
});

// Video block view component with fullscreen support
const VideoBlockView = ({ src, mimeType }: { src: string; mimeType: string }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const openFullscreen = () => {
    setIsFullscreen(true);
  };

  return (
    <>
      <style>{`
        .video-fullscreen-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(0, 0, 0, 0.95);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .video-fullscreen-content {
          position: relative;
          max-width: 95vw;
          max-height: 95vh;
        }
        .video-fullscreen-content video {
          max-width: 95vw;
          max-height: 85vh;
          border-radius: 8px;
        }
        .video-fullscreen-close {
          position: absolute;
          top: -40px;
          right: 0;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #ef4444;
          color: white;
          border: none;
          cursor: pointer;
          font-size: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
        }
        .video-fullscreen-close:hover {
          background: #dc2626;
        }
        .video-fullscreen-hint {
          position: absolute;
          bottom: -24px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 11px;
          color: #9ca3af;
          white-space: nowrap;
        }
      `}</style>
      <div
        className="video-embed my-4 cursor-zoom-in"
        onDoubleClick={openFullscreen}
        title="Double-click to enlarge"
      >
        <video
          src={src}
          controls
          className="rounded-md bg-black"
          style={{
            minWidth: '400px',
            maxWidth: '800px',
            width: 'auto',
            maxHeight: '500px',
          }}
          preload="metadata"
        >
          <source src={src} type={mimeType} />
          Your browser does not support the video tag.
        </video>
      </div>
      {isFullscreen && (
        <div
          className="video-fullscreen-overlay"
          onClick={() => setIsFullscreen(false)}
        >
          <div
            className="video-fullscreen-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="video-fullscreen-close"
              onClick={() => setIsFullscreen(false)}
              aria-label="Close fullscreen"
            >
              ×
            </button>
            <video
              src={src}
              controls
              autoPlay
              className="rounded-md bg-black"
            >
              <source src={src} type={mimeType} />
            </video>
            <div className="video-fullscreen-hint">Click outside or press × to close</div>
          </div>
        </div>
      )}
    </>
  );
};

// Video Block Extension - for local video files
export const VideoBlock = Node.create({
  name: 'videoBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      mimeType: {
        default: 'video/mp4',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-video-block]',
        getAttrs: (dom) => ({
          src: (dom as HTMLElement).getAttribute('data-video-src') || '',
          mimeType: (dom as HTMLElement).getAttribute('data-video-type') || 'video/mp4',
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-video-block': '',
      'data-video-src': HTMLAttributes.src,
      'data-video-type': HTMLAttributes.mimeType,
    })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(({ node }) => {
      return (
        <NodeViewWrapper as="div">
          <VideoBlockView src={node.attrs.src} mimeType={node.attrs.mimeType} />
        </NodeViewWrapper>
      );
    }, { as: 'div' });
  },

  addCommands() {
    return {
      setVideoBlock:
        (src: string, mimeType?: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { src, mimeType: mimeType || 'video/mp4' },
          });
        },
    };
  },
});

// Audio block view component with native controls
const AudioBlockView = ({ src, mimeType }: { src: string; mimeType: string }) => {
  return (
    <div className="audio-embed my-4">
      <audio
        src={src}
        controls
        className="w-full max-w-[600px] rounded-md"
        preload="metadata"
      >
        <source src={src} type={mimeType} />
        Your browser does not support the audio tag.
      </audio>
    </div>
  );
};

// Audio Block Extension - for local audio files
export const AudioBlock = Node.create({
  name: 'audioBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      mimeType: {
        default: 'audio/mpeg',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-audio-block]',
        getAttrs: (dom) => ({
          src: (dom as HTMLElement).getAttribute('data-audio-src') || '',
          mimeType: (dom as HTMLElement).getAttribute('data-audio-type') || 'audio/mpeg',
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-audio-block': '',
      'data-audio-src': HTMLAttributes.src,
      'data-audio-type': HTMLAttributes.mimeType,
    })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(({ node }) => {
      return (
        <NodeViewWrapper as="div">
          <AudioBlockView src={node.attrs.src} mimeType={node.attrs.mimeType} />
        </NodeViewWrapper>
      );
    }, { as: 'div' });
  },

  addCommands() {
    return {
      setAudioBlock:
        (src: string, mimeType?: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { src, mimeType: mimeType || 'audio/mpeg' },
          });
        },
    };
  },
});
