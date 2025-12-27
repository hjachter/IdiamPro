import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React from 'react';

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
