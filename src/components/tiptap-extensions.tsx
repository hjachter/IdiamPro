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
    signalTextColor: '#15803d', // Slightly darker green for labels
    actorLineColor: '#9ca3af', // Medium gray for actor lifelines
    // Flowchart specific
    edgeLabelBackground: 'transparent',
    // General text - using colors that work in both modes
    textColor: '#374151', // Gray-700 for light mode readability
    primaryTextColor: '#1f2937',
    secondaryTextColor: '#4b5563',
    // Node colors - subtle backgrounds
    primaryColor: '#f0fdf4', // Green-50 - very light green
    primaryBorderColor: '#16a34a', // Green-600
    secondaryColor: '#f9fafb', // Gray-50
    tertiaryColor: '#f3f4f6', // Gray-100
    // Note background
    noteBkgColor: '#fefce8', // Yellow-50
    noteBorderColor: '#ca8a04', // Yellow-600
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
  return sanitized;
};

// Mermaid diagram renderer component
const MermaidRenderer = ({ code }: { code: string }) => {
  const [error, setError] = useState<string | null>(null);
  const [svgContent, setSvgContent] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    const renderDiagram = async () => {
      if (!code) return;

      try {
        setError(null);
        const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`;
        const sanitizedCode = sanitizeMermaidCode(code);

        // Just call render without a container - mermaid will handle it
        const { svg } = await mermaid.render(id, sanitizedCode);

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
    <div
      className="mermaid-diagram my-4 flex justify-center"
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
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
