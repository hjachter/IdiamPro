import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

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
        const rect = svg.getBoundingClientRect();
        const targetWidth = window.innerWidth * 0.9;
        const targetHeight = window.innerHeight * 0.9;

        // Scale to fill viewport
        const scaleX = targetWidth / rect.width;
        const scaleY = targetHeight / rect.height;
        const fillScale = Math.max(scaleX, scaleY, 1.5);

        const newWidth = Math.round(rect.width * fillScale);
        const newHeight = Math.round(rect.height * fillScale);

        // Modify SVG to set new dimensions
        let modifiedSvg = svgContent
          .replace(/width="[^"]*"/, `width="${newWidth}"`)
          .replace(/height="[^"]*"/, `height="${newHeight}"`);

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
          padding: 20px;
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
          padding: 50px 20px 20px 20px;
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
      return (
        <NodeViewWrapper as="div">
          <div className="google-docs-embed my-4">
            <iframe
              src={node.attrs.src}
              className="w-full h-[600px] border rounded-md"
              frameBorder="0"
              allowFullScreen
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
      return (
        <NodeViewWrapper as="div">
          <div className="google-sheets-embed my-4">
            <iframe
              src={node.attrs.src}
              className="w-full h-[600px] border rounded-md"
              frameBorder="0"
              allowFullScreen
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
      return (
        <NodeViewWrapper as="div">
          <div className="google-slides-embed my-4">
            <iframe
              src={node.attrs.src}
              className="w-full h-[480px] border rounded-md"
              frameBorder="0"
              allowFullScreen
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
      return (
        <NodeViewWrapper as="div">
          <div className="google-maps-embed my-4">
            <iframe
              src={node.attrs.src}
              className="w-full h-[450px] border rounded-md"
              frameBorder="0"
              allowFullScreen
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
