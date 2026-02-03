'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import DOMPurify from 'dompurify';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import type { OutlineNode, NodeGenerationContext, NodeMap, NodeType } from '@/types';

// DOMPurify config for AI-generated content: allow formatting tags + mermaid data attributes
const SANITIZE_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'strong', 'em', 'code', 'pre', 'br', 'blockquote', 'del', 'a', 'div', 'span', 'img'],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'class', 'data-mermaid-block', 'data-mermaid-code'],
};

// Safe wrapper: DOMPurify requires a DOM, so pass through during SSR (server output
// is trusted and gets re-sanitized on the client after hydration).
function sanitizeHtml(html: string, config?: DOMPurify.Config): string {
  if (typeof window === 'undefined') return html;
  return DOMPurify.sanitize(html, config);
}

/**
 * Detect if text appears to be tabular/aligned data that would benefit from monospace formatting.
 * Checks for: markdown tables, multiple consecutive spaces, tab-separated values, ASCII art tables,
 * and Unicode box-drawing tables (from terminal output).
 */
function isTabularData(text: string): boolean {
  const lines = text.split('\n').filter(line => line.trim().length > 0);

  // Need at least 2 lines to be considered tabular
  if (lines.length < 2) return false;

  // Check for Unicode box-drawing characters (terminal-rendered tables)
  // Characters: ┌ ┬ ┐ ├ ┼ ┤ └ ┴ ┘ │ ─ ═ ║ ╔ ╗ ╚ ╝ ╠ ╣ ╦ ╩ ╬
  const boxDrawingPattern = /[┌┬┐├┼┤└┴┘│─═║╔╗╚╝╠╣╦╩╬]/;
  const linesWithBoxDrawing = lines.filter(line => boxDrawingPattern.test(line));
  if (linesWithBoxDrawing.length >= 2) return true;

  // Check for markdown table (pipes with consistent structure)
  const markdownTablePattern = /^\|.*\|$/;
  const markdownTableLines = lines.filter(line => markdownTablePattern.test(line.trim()));
  if (markdownTableLines.length >= 2) return true;

  // Check for separator row (common in markdown/ASCII tables)
  const separatorPattern = /^[|\-+=\s]+$/;
  const hasSeparator = lines.some(line => separatorPattern.test(line.trim()) && line.includes('-'));
  if (hasSeparator && lines.length >= 3) return true;

  // Check for multiple consecutive spaces (column alignment) in most lines
  const multiSpacePattern = /\S\s{2,}\S/;  // Non-space, 2+ spaces, non-space
  const linesWithMultiSpace = lines.filter(line => multiSpacePattern.test(line));
  if (linesWithMultiSpace.length >= Math.min(2, lines.length * 0.5)) return true;

  // Check for tab-separated values in most lines
  const linesWithTabs = lines.filter(line => line.includes('\t'));
  if (linesWithTabs.length >= Math.min(2, lines.length * 0.5)) return true;

  // Check for consistent column structure (similar positions of whitespace gaps)
  // This catches ASCII art tables and manually aligned text
  if (lines.length >= 3) {
    const getColumnPositions = (line: string): number[] => {
      const positions: number[] = [];
      const matches = line.matchAll(/\s{2,}/g);
      for (const match of matches) {
        if (match.index !== undefined) positions.push(match.index);
      }
      return positions;
    };

    const firstLinePositions = getColumnPositions(lines[0]);
    if (firstLinePositions.length >= 1) {
      const similarLines = lines.filter(line => {
        const positions = getColumnPositions(line);
        if (positions.length !== firstLinePositions.length) return false;
        // Check if positions are within 3 characters of each other
        return positions.every((pos, i) => Math.abs(pos - firstLinePositions[i]) <= 3);
      });
      if (similarLines.length >= lines.length * 0.6) return true;
    }
  }

  return false;
}

/**
 * Migrate old <img src="data:..."> tags to new ImageBlock format.
 * TipTap's HTML parser fails on large base64 data URLs, so we need to
 * convert them to <div data-image-block data-image-src="..."> format.
 */
function migrateOldImages(html: string): string {
  if (!html.includes('<img')) return html;

  let migratedCount = 0;

  // Use replace with a callback function to handle each match
  const migrated = html.replace(
    /<img\s+([^>]*?)src=["']?(data:image\/[^"'\s]+;base64,[a-zA-Z0-9+/=]+)["']?([^>]*)>/gi,
    (fullMatch, beforeSrc, src, afterSrc) => {
      // Only migrate large base64 images (over 10KB)
      if (src.length > 10000) {
        // Extract alt attribute if present
        const altMatch = (beforeSrc + afterSrc).match(/alt=["']?([^"']*?)["']?(?:\s|$|>)/i);
        const alt = altMatch ? altMatch[1] : '';

        migratedCount++;
        console.log(`[Migration] Converting image ${migratedCount}: ${src.length} chars`);

        // Create new ImageBlock format
        return `<div data-image-block="" data-image-src="${src}" data-image-alt="${alt}"></div>`;
      }
      return fullMatch;
    }
  );

  if (migratedCount > 0) {
    console.log(`[Migration] Converted ${migratedCount} old <img> tags to ImageBlock format`);
  }

  return migrated;
}

import NodeIcon from './node-icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Image from 'next/image';
import { ArrowLeft, Sparkles, Loader2, Eraser, Scissors, Copy, Clipboard, Type, Undo, Redo, List, ListOrdered, ListX, Minus, FileText, Sheet, Presentation, Video, Map, AppWindow, Plus, Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3, Mic, MicOff, ChevronRight, Home, Pencil, ALargeSmall, Check, Calendar, Brush, Network, GitBranch, MessageSquare, ImagePlus, Table, Layers, Image as ImageIcon, Film, CheckSquare } from 'lucide-react';
import { generateImageAction } from '@/app/actions';
import dynamic from 'next/dynamic';

// Dynamically import DrawingCanvas to avoid SSR issues with Excalidraw
const DrawingCanvas = dynamic(() => import('./excalidraw-drawing-canvas'), {
  ssr: false,
  loading: () => null,
});

// Dynamically import ExcalidrawEditor for canvas nodes
const ExcalidrawEditor = dynamic(() => import('./excalidraw-editor'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-[500px] text-muted-foreground">Loading canvas...</div>,
});

// Dynamically import SpreadsheetEditor for inline spreadsheets
const SpreadsheetEditor = dynamic(() => import('./spreadsheet-editor'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-[400px] text-muted-foreground">Loading spreadsheet...</div>,
});
import { Card, CardContent } from './ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Breadcrumbs } from './breadcrumbs';
import ContentConflictDialog, { type ContentConflictAction } from './content-conflict-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import EmbedUrlDialog, { type EmbedType } from './embed-url-dialog';
import YouTubePickerDialog from './youtube-picker-dialog';
import GoogleDocsPickerDialog from './google-docs-picker-dialog';
import GoogleSheetsPickerDialog from './google-sheets-picker-dialog';
import GoogleSlidesPickerDialog from './google-slides-picker-dialog';
import GoogleMapsPickerDialog from './google-maps-picker-dialog';
import { isElectron } from '@/lib/electron-storage';
import { useAIFeature } from '@/contexts/ai-context';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import ImageExt from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import Placeholder from '@tiptap/extension-placeholder';
import { GoogleDocs, GoogleSheets, GoogleSlides, GoogleMaps, MermaidBlock, VideoBlock, ImageBlock } from './tiptap-extensions';
import { TaskList } from '@tiptap/extension-list/task-list';
import { TaskItem } from '@tiptap/extension-list/task-item';
import { useSpeechRecognition } from '@/lib/use-speech-recognition';
import { Extension } from '@tiptap/core';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Plugin, PluginKey } from '@tiptap/pm/state';

// Search highlight extension
const SearchHighlight = Extension.create({
  name: 'searchHighlight',

  addProseMirrorPlugins() {
    const { editor } = this;

    return [
      new Plugin({
        key: new PluginKey('searchHighlight'),
        state: {
          init() { return DecorationSet.empty; },
          apply(tr, oldState) {
            // Get search term from transaction meta
            const searchTerm = tr.getMeta('searchHighlight');

            if (searchTerm === undefined) {
              return oldState.map(tr.mapping, tr.doc);
            }

            if (!searchTerm || searchTerm.length < 2) {
              return DecorationSet.empty;
            }

            const decorations: Decoration[] = [];
            const lowerSearch = searchTerm.toLowerCase();
            let matchCount = 0;

            // Search through document text
            tr.doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return;

              const text = node.text;
              const lowerText = text.toLowerCase();
              let index = lowerText.indexOf(lowerSearch);

              while (index !== -1) {
                const from = pos + index;
                const to = from + searchTerm.length;

                decorations.push(
                  Decoration.inline(from, to, {
                    class: 'search-highlight',
                  })
                );
                matchCount++;

                index = lowerText.indexOf(lowerSearch, index + 1);
              }
            });

            console.log('[SearchHighlight] Created decorations:', {
              searchTerm,
              matchCount,
              decorationCount: decorations.length,
              docSize: tr.doc.content.size
            });

            return DecorationSet.create(tr.doc, decorations);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});

/**
 * Convert plain text with newlines to proper HTML paragraphs.
 * Only processes content that doesn't already have block-level HTML structure.
 */
function convertToHtml(content: string): string {
  // If content already has block-level HTML structure (paragraphs, lists, divs),
  // assume it's already formatted properly
  if (/<(p|div|ul|ol|h[1-6]|blockquote|pre)[\s>]/i.test(content)) {
    return content;
  }

  // If no newlines at all, wrap in a paragraph
  if (!content.includes('\n')) {
    return `<p>${content}</p>`;
  }

  // Split by double newlines (paragraph breaks)
  const paragraphs = content.split(/\n\n+/);

  return paragraphs
    .map(para => {
      const trimmed = para.trim();
      if (!trimmed) return '';

      // Check if this looks like a list (starts with -, *, or number.)
      const lines = trimmed.split('\n');
      const isUnorderedList = lines.every(line => /^\s*[-*]\s+/.test(line) || !line.trim());
      const isOrderedList = lines.every(line => /^\s*\d+[.)]\s+/.test(line) || !line.trim());

      if (isUnorderedList) {
        const items = lines
          .filter(line => line.trim())
          .map(line => `<li>${line.replace(/^\s*[-*]\s+/, '')}</li>`)
          .join('');
        return `<ul>${items}</ul>`;
      }

      if (isOrderedList) {
        const items = lines
          .filter(line => line.trim())
          .map(line => `<li>${line.replace(/^\s*\d+[.)]\s+/, '')}</li>`)
          .join('');
        return `<ol>${items}</ol>`;
      }

      // Regular paragraph - convert single newlines to <br>
      const htmlContent = trimmed.replace(/\n/g, '<br>');
      return `<p>${htmlContent}</p>`;
    })
    .filter(p => p)
    .join('');
}

interface ContentPaneProps {
  node: OutlineNode | null;
  nodes?: NodeMap;  // Full node map for subtree diagram generation
  ancestorPath: string[];  // Names of ancestors from root to parent
  onUpdate: (nodeId: string, updates: Partial<OutlineNode>) => void;
  onBack?: () => void;
  onExpandContent: () => Promise<void>;  // Legacy callback (kept for compatibility)
  onGenerateContent?: (context: NodeGenerationContext) => Promise<string>;  // Enhanced callback
  onGenerateContentForDescendants?: (nodeId: string) => void;  // Generate content for all descendants
  isLoadingAI: boolean;
  searchTerm?: string;  // Search term for highlighting matches
  currentMatchIndex?: number;  // Which match to scroll to (for multiple matches in same content)
  currentMatchType?: 'name' | 'content' | 'both' | null;  // Type of current match
  isGuide?: boolean;  // Whether viewing the User Guide (read-only)
  onCopyOutline?: () => void;  // Callback to copy the current outline
}

const YouTubeEmbed = ({ url }: { url: string }) => {
    const videoId = url.split('v=')[1]?.split('&')[0];
    if (!videoId) return <p className="text-destructive">Invalid YouTube URL</p>;
    return (
        <div className="aspect-video w-full">
            <iframe
                className="w-full h-full rounded-md"
                src={`https://www.youtube.com/embed/${videoId}`}
                title="YouTube video player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
            ></iframe>
        </div>
    );
};

const PdfEmbed = ({ url }: { url: string }) => (
    <div className="aspect-[4/5] w-full">
        <iframe src={url} className="w-full h-full rounded-md border" title="PDF Viewer" />
    </div>
);

const isUrl = (str: string) => {
    try {
        new URL(str);
        return true;
    } catch {
        return false;
    }
};

export default function ContentPane({
  node,
  nodes,
  ancestorPath,
  onUpdate,
  onBack,
  onExpandContent,
  onGenerateContent,
  onGenerateContentForDescendants,
  isLoadingAI,
  searchTerm,
  currentMatchIndex = 0,
  currentMatchType = null,
  isGuide = false,
  onCopyOutline,
}: ContentPaneProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  // Track when we navigate to force SpreadsheetEditor remount
  const [spreadsheetKey, setSpreadsheetKey] = useState(0);
  const [pendingAIContent, setPendingAIContent] = useState('');
  const [embedDialogOpen, setEmbedDialogOpen] = useState(false);
  const [embedType, setEmbedType] = useState<EmbedType>(null);
  const [youtubePickerOpen, setYoutubePickerOpen] = useState(false);
  const [googleDocsPickerOpen, setGoogleDocsPickerOpen] = useState(false);
  const [googleSheetsPickerOpen, setGoogleSheetsPickerOpen] = useState(false);
  const [googleSlidesPickerOpen, setGoogleSlidesPickerOpen] = useState(false);
  const [googleMapsPickerOpen, setGoogleMapsPickerOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDrawingOpen, setIsDrawingOpen] = useState(false);
  const [pendingTabularPaste, setPendingTabularPaste] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState<'xs' | 'sm' | 'base' | 'lg' | 'xl'>('base');
  const [contextMenuReady, setContextMenuReady] = useState(true);

  // AI Generate preferences (sticky)
  type GenerateSource = 'context' | 'prompt';
  type GeneratePlacement = 'append' | 'prepend' | 'replace';

  const [generateSource, setGenerateSource] = useState<GenerateSource>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('idiampro-generate-source') as GenerateSource) || 'context';
    }
    return 'context';
  });

  const [generatePlacement, setGeneratePlacement] = useState<GeneratePlacement>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('idiampro-generate-placement') as GeneratePlacement) || 'append';
    }
    return 'append';
  });

  const [includeDiagram, setIncludeDiagram] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('idiampro-include-diagram') === 'true';
    }
    return false;
  });

  const [promptDialogOpen, setPromptDialogOpen] = useState(false);

  // File input refs for photo/video import
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Track previous node to save content before switching
  const prevNodeIdRef = useRef<string | null>(null);
  const editorRef = useRef<any>(null);
  // Flag to suppress onUpdate while loading content (prevents race condition)
  const isLoadingContentRef = useRef(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);

  // Image generation state
  const [imagePromptDialogOpen, setImagePromptDialogOpen] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageAspectRatio, setImageAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3' | '3:4'>('1:1');

  // Persist preferences to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('idiampro-generate-source', generateSource);
    }
  }, [generateSource]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('idiampro-generate-placement', generatePlacement);
    }
  }, [generatePlacement]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('idiampro-include-diagram', String(includeDiagram));
    }
  }, [includeDiagram]);

  // Force SpreadsheetEditor to remount when navigating to a node
  // This ensures Fortune Sheet loads fresh data from props
  useEffect(() => {
    setSpreadsheetKey(prev => prev + 1);
  }, [node?.id]);

  const aiContentEnabled = useAIFeature('enableAIContentGeneration');
  const { toast } = useToast();

  // Speech recognition
  const {
    isListening,
    transcript,
    interimTranscript,
    isSupported: speechSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition();

  // Only create editor for node types that need rich text editing
  // Also check if content looks like spreadsheet JSON data - if so, don't use rich text editor
  // Check for spreadsheet data format - must start with {"sheets": to be a valid spreadsheet JSON
  const contentLooksLikeSpreadsheet = node?.content?.trim().startsWith('{"sheets":');
  const shouldUseRichTextEditor = !['canvas', 'code', 'link', 'quote', 'date', 'spreadsheet'].includes(node?.type || '') && !contentLooksLikeSpreadsheet;

  // Ref to store pending content to set on editor creation
  const pendingContentRef = useRef<string | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    editable: shouldUseRichTextEditor && !isGuide,
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      ImageExt,
      Youtube.configure({
        width: 640,
        height: 360,
      }),
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
      GoogleDocs,
      GoogleSheets,
      GoogleSlides,
      GoogleMaps,
      MermaidBlock,
      VideoBlock,
      ImageBlock,
      SearchHighlight,
    ],
    content: '',  // Start empty, onCreate will set content
    onCreate: ({ editor }) => {
      // Set content when editor is fully created
      if (pendingContentRef.current) {
        console.log('[onCreate] Setting pending content:', {
          contentLength: pendingContentRef.current.length,
          hasImage: pendingContentRef.current.includes('<img'),
        });
        isLoadingContentRef.current = true;
        editor.commands.setContent(pendingContentRef.current, false);
        const afterContent = editor.getHTML();
        console.log('[onCreate] After setContent:', {
          editorHas: afterContent.length,
          hasImage: afterContent.includes('<img'),
        });
        setTimeout(() => {
          isLoadingContentRef.current = false;
        }, 100);
        pendingContentRef.current = null;
      }
    },
    onUpdate: ({ editor }) => {
      // Don't save updates when viewing the User Guide (read-only)
      // Also skip if we're in the middle of loading content (prevents race condition)
      if (node && shouldUseRichTextEditor && !isGuide && !isLoadingContentRef.current) {
        const html = editor.getHTML();
        // Defer update to avoid flushSync during render
        queueMicrotask(() => {
          onUpdate(node.id, { content: html });
        });
      }
    },
    editorProps: {
      attributes: {
        class: `tiptap focus:outline-none min-h-[400px] p-0 font-size-${fontSize}`,
      },
      handleDOMEvents: {
        mousedown: (view, event) => {
          // Prevent TipTap from handling right-click which clears selection
          if (event.button === 2) {
            event.preventDefault();
            return true; // Stop TipTap from processing this event
          }
          return false;
        },
        contextmenu: () => {
          // Let the event bubble up to Radix context menu
          return false;
        },
      },
      handlePaste: (_view, event) => {
        // Check for image data in clipboard (screenshots, copied images)
        const items = event.clipboardData?.items;
        if (items) {
          for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
              const file = items[i].getAsFile();
              if (file) {
                event.preventDefault();
                const reader = new FileReader();
                reader.onload = (e) => {
                  const dataUrl = e.target?.result as string;
                  if (dataUrl && editorRef.current) {
                    (editorRef.current.commands as any).setImageBlock(dataUrl, file.name || 'Pasted image');
                  }
                };
                reader.readAsDataURL(file);
                return true; // Handled — prevent default paste
              }
            }
          }
        }

        // Get plain text from clipboard
        const text = event.clipboardData?.getData('text/plain');

        if (text && isTabularData(text)) {
          // Let the paste happen normally, but show option to convert
          // Use queueMicrotask to set state after paste completes
          queueMicrotask(() => {
            setPendingTabularPaste(text);
          });
        }

        // Let Tiptap handle paste normally
        return false;
      },
    },
  });

  // Store editor reference for use in cleanup
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Save content immediately when navigating away from a node
  useEffect(() => {
    const prevNodeId = prevNodeIdRef.current;

    // If we're switching to a different node, save the previous node's content first
    if (prevNodeId && prevNodeId !== node?.id && editorRef.current && shouldUseRichTextEditor && !isGuide) {
      const html = editorRef.current.getHTML();
      console.log('[Save-on-navigate] Saving previous node:', prevNodeId, 'length:', html.length);
      // Save immediately (not deferred) to ensure content is captured before loading new node
      onUpdate(prevNodeId, { content: html });
    }

    // Update the ref to track current node
    prevNodeIdRef.current = node?.id || null;
  }, [node?.id, onUpdate, shouldUseRichTextEditor, isGuide]);

  // Track the last node ID we loaded content for
  const lastLoadedNodeIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Update editor content when node changes
    if (editor && node) {
      const nodeIdChanged = lastLoadedNodeIdRef.current !== node.id;

      // Only process when node ID actually changes (user navigated to different node)
      if (nodeIdChanged) {
        const rawContent = node.content || '';
        // Convert to HTML and migrate old image formats
        const htmlContent = convertToHtml(rawContent);
        const newContent = migrateOldImages(htmlContent);

        console.log('[Load content] Loading node:', node.name, 'length:', newContent.length);
        lastLoadedNodeIdRef.current = node.id;

        // Store content in pendingContentRef for onCreate to use if editor isn't ready
        pendingContentRef.current = newContent;

        // Set flag to suppress onUpdate during content loading
        isLoadingContentRef.current = true;

        // Use a longer delay for large content (images)
        const hasLargeContent = newContent.length > 100000;

        setTimeout(() => {
          // Check if editor is still valid (component might have unmounted)
          if (!editor || editor.isDestroyed) return;

          editor.commands.setContent(newContent, false);
          const afterContent = editor.getHTML();

          // If setContent failed (editor has less content than expected), retry with longer delay
          if (afterContent.length < newContent.length * 0.9) {
            setTimeout(() => {
              if (!editor || editor.isDestroyed) return;
              editor.commands.setContent(newContent, false);
              const retryContent = editor.getHTML();

              // If still failing, try one more time with even longer delay
              if (retryContent.length < newContent.length * 0.9) {
                setTimeout(() => {
                  if (!editor || editor.isDestroyed) return;
                  editor.commands.setContent(newContent, false);
                }, 200);
              }
            }, 100);
          }

          // Clear the flag after a short delay to ensure TipTap has processed
          setTimeout(() => {
            isLoadingContentRef.current = false;
            pendingContentRef.current = null;
          }, 150);

          // Reapply search highlighting after content update with a small delay
          setTimeout(() => {
            if (searchTerm && shouldUseRichTextEditor) {
              editor.view.dispatch(
                editor.view.state.tr.setMeta('searchHighlight', searchTerm)
              );
            }
          }, 50);
        }, hasLargeContent ? 100 : 0);
      }
    }
  }, [node?.id, editor, searchTerm, shouldUseRichTextEditor]);

  // Update editor class when font size changes
  useEffect(() => {
    if (editor && shouldUseRichTextEditor) {
      editor.setOptions({
        editorProps: {
          attributes: {
            class: `tiptap focus:outline-none min-h-[400px] p-0 font-size-${fontSize}`,
          },
        },
      });
    }
  }, [editor, fontSize, shouldUseRichTextEditor]);

  // Update editor editable state when isGuide changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(shouldUseRichTextEditor && !isGuide);
    }
  }, [editor, isGuide, shouldUseRichTextEditor]);

  // Update search highlighting when searchTerm changes
  useEffect(() => {
    if (editor && shouldUseRichTextEditor && editor.view) {
      // Dispatch transaction with search term metadata to trigger highlight plugin
      editor.view.dispatch(
        editor.view.state.tr.setMeta('searchHighlight', searchTerm || '')
      );

      // Auto-scroll to current match if search term exists and match is in content (not name)
      if (searchTerm && searchTerm.length >= 2 && (currentMatchType === 'content' || currentMatchType === 'both')) {
        // Small delay to let highlighting apply first
        setTimeout(() => {
          const doc = editor.view.state.doc;
          const lowerSearch = searchTerm.toLowerCase();
          const matchPositions: number[] = [];

          // Find ALL matches in document
          doc.descendants((node, pos) => {
            if (!node.isText || !node.text) return;

            const text = node.text;
            const lowerText = text.toLowerCase();
            let index = lowerText.indexOf(lowerSearch);

            while (index !== -1) {
              matchPositions.push(pos + index);
              index = lowerText.indexOf(lowerSearch, index + 1);
            }
          });

          // Scroll to the match at currentMatchIndex (local to this content)
          if (matchPositions.length > 0 && currentMatchIndex < matchPositions.length) {
            const targetPos = matchPositions[currentMatchIndex];
            const coords = editor.view.coordsAtPos(targetPos);
            const editorContainer = editor.view.dom.closest('.tiptap-container') as HTMLElement;

            if (editorContainer) {
              // Scroll with some padding from top
              editorContainer.scrollTo({
                top: coords.top - editorContainer.getBoundingClientRect().top - 100,
                behavior: 'smooth'
              });
            }
          }
        }, 50);
      }
    }
  }, [editor, searchTerm, currentMatchIndex, currentMatchType, shouldUseRichTextEditor, node?.id, node?.name]);

  // Insert transcript when speech recognition completes
  useEffect(() => {
    if (transcript && editor) {
      // Insert the transcribed text at cursor position
      editor.chain().focus().insertContent(transcript + ' ').run();
      resetTranscript();
    }
  }, [transcript, editor, resetTranscript]);

  // Speech recognition toggle handler
  const handleSpeechToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Handle converting last paste to code block (undo + repaste as code)
  const handleConvertToCodeBlock = useCallback((text: string) => {
    if (!editor) return;
    try {
      // Undo the plain text paste, then insert as code block
      editor.chain().focus().undo().run();
      // Use setTimeout to let the undo settle before inserting
      setTimeout(() => {
        if (editor) {
          editor.chain().focus().setCodeBlock().insertContent(text).run();
        }
      }, 10);
    } catch (e) {
      // If undo fails, just insert the code block at cursor
      console.warn('Code block conversion error, inserting at cursor:', e);
      editor.chain().focus().setCodeBlock().insertContent(text).run();
    }
    setPendingTabularPaste(null);
  }, [editor]);

  // Show toast when tabular paste was detected (after paste already happened)
  useEffect(() => {
    if (pendingTabularPaste && editor) {
      toast({
        title: "Tabular data detected",
        description: "Convert to code block to preserve alignment?",
        duration: 8000,
        action: (
          <ToastAction
            altText="Convert to code block"
            onClick={() => handleConvertToCodeBlock(pendingTabularPaste)}
          >
            Convert
          </ToastAction>
        ),
      });

      // Clear pending state after toast duration
      const timer = setTimeout(() => {
        setPendingTabularPaste(null);
      }, 8000);

      return () => clearTimeout(timer);
    }
  }, [pendingTabularPaste, editor, toast, handleConvertToCodeBlock]);

  // Sanitize Mermaid code to fix common syntax errors from AI generation
  const sanitizeMermaidCode = useCallback((code: string): string => {
    let sanitized = code;

    // Fix participant names with parentheses: "participant Platform (iOS, Mac)" -> "participant Platform"
    sanitized = sanitized.replace(
      /participant\s+(\w+)\s*\([^)]+\)/g,
      'participant $1'
    );

    // Fix node names with parentheses in flowcharts: "A(some text)" is OK, but "A (stuff, more)" is not
    // Remove parenthetical content after identifiers in arrows
    sanitized = sanitized.replace(
      /(\w+)\s*\([^)]*,[^)]*\)\s*(-->|-->>|->|-.->|==>)/g,
      '$1 $2'
    );

    // Fix labels in sequence diagrams with special chars
    // "User->>Platform: Subscribe (via any platform)" is actually OK in the label part

    return sanitized;
  }, []);

  // Generate Mermaid "mindmap" as vertical flowchart (TD layout - better for many nodes)
  const generateMindmap = useCallback((rootNode: OutlineNode, allNodes: NodeMap): string => {
    const sanitizeName = (name: string) => {
      // Remove special characters that break Mermaid syntax
      return name.replace(/[()[\]{}"`]/g, '').replace(/\n/g, ' ').trim();
    };

    const lines: string[] = ['flowchart TD']; // Top-down for better readability with many nodes
    const connections: string[] = [];
    let nodeCounter = 0;
    const nodeIds: Record<string, string> = {};

    const processNode = (nodeId: string, isRoot: boolean = false) => {
      const currentNode = allNodes[nodeId];
      if (!currentNode) return;

      const mermaidId = `N${nodeCounter++}`;
      nodeIds[nodeId] = mermaidId;

      const name = sanitizeName(currentNode.name);
      // Use rounded box for root, regular for others
      const shape = isRoot ? `((${name}))` : `["${name}"]`;
      lines.push(`  ${mermaidId}${shape}`);

      currentNode.childrenIds.forEach(childId => {
        processNode(childId, false);
        connections.push(`  ${mermaidId} --> ${nodeIds[childId]}`);
      });
    };

    processNode(rootNode.id, true);

    return [...lines, ...connections].join('\n');
  }, []);

  // Generate Mermaid flowchart from subtree
  const generateFlowchart = useCallback((rootNode: OutlineNode, allNodes: NodeMap): string => {
    const sanitizeName = (name: string) => {
      // Remove special characters that break Mermaid syntax
      return name.replace(/[()[\]{}"`]/g, '').replace(/\n/g, ' ').trim();
    };

    const lines: string[] = ['flowchart TD'];
    const connections: string[] = [];
    let nodeCounter = 0;
    const nodeIds: Record<string, string> = {};

    const processNode = (nodeId: string) => {
      const currentNode = allNodes[nodeId];
      if (!currentNode) return;

      // Create a short ID for Mermaid
      const mermaidId = `N${nodeCounter++}`;
      nodeIds[nodeId] = mermaidId;

      const name = sanitizeName(currentNode.name);
      lines.push(`  ${mermaidId}["${name}"]`);

      // Process children and create connections
      currentNode.childrenIds.forEach(childId => {
        processNode(childId);
        connections.push(`  ${mermaidId} --> ${nodeIds[childId]}`);
      });
    };

    processNode(rootNode.id);

    return [...lines, ...connections].join('\n');
  }, []);

  // Generate and insert subtree diagram
  const handleGenerateSubtreeDiagram = useCallback((type: 'mindmap' | 'flowchart') => {
    if (!node || !nodes || !editor) return;

    const mermaidCode = type === 'mindmap'
      ? generateMindmap(node, nodes)
      : generateFlowchart(node, nodes);

    // Escape for HTML attribute
    const escapedCode = mermaidCode
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const diagramHtml = `<div data-mermaid-block data-mermaid-code="${escapedCode}"></div>`;

    // Insert at the beginning of the content
    editor.commands.focus('start');
    editor.commands.insertContent(diagramHtml + '<p></p>');

    toast({
      title: `${type === 'mindmap' ? 'Mind Map' : 'Flowchart'} Generated`,
      description: `Diagram of "${node.name}" subtree added to content.`,
    });
  }, [node, nodes, editor, generateMindmap, generateFlowchart, toast]);

  // Convert mermaid code blocks to MermaidBlock nodes and format text as HTML
  const processGeneratedContent = useCallback((content: string): string => {
    // First, extract mermaid blocks and replace with placeholders
    const mermaidBlocks: string[] = [];
    const mermaidBlockRegex = /```mermaid\s*([\s\S]*?)```/g;

    let processed = content.replace(mermaidBlockRegex, (_match, code) => {
      const trimmedCode = sanitizeMermaidCode(code.trim());
      // Escape HTML entities in the code for the attribute
      const escapedCode = trimmedCode
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      const placeholder = `__MERMAID_${mermaidBlocks.length}__`;
      mermaidBlocks.push(`<div data-mermaid-block data-mermaid-code="${escapedCode}"></div>`);
      return placeholder;
    });

    // Convert text to HTML with proper paragraphs
    processed = convertToHtml(processed);

    // Restore mermaid blocks
    mermaidBlocks.forEach((block, index) => {
      processed = processed.replace(`__MERMAID_${index}__`, block);
      // Also handle case where placeholder ended up inside a <p> tag
      processed = processed.replace(`<p>__MERMAID_${index}__</p>`, block);
    });

    return sanitizeHtml(processed, SANITIZE_CONFIG);
  }, [convertToHtml, sanitizeMermaidCode]);

  // Apply generated content based on placement preference
  const applyGeneratedContent = useCallback((generatedContent: string, placement: GeneratePlacement) => {
    if (!editor) return;

    // Process content: convert to HTML and parse mermaid blocks
    const processedContent = processGeneratedContent(generatedContent);

    if (placement === 'replace') {
      editor.commands.setContent(processedContent);
    } else if (placement === 'prepend') {
      editor.commands.focus('start');
      editor.commands.insertContent(processedContent + '<p></p>');
    } else {
      // append
      editor.commands.focus('end');
      editor.commands.insertContent('<p></p>' + processedContent);
    }
  }, [editor, processGeneratedContent]);

  const handleGenerateContent = async (sourceOverride?: GenerateSource) => {
    if (!node || isGenerating || isLoadingAI || !editor) return;

    const source = sourceOverride || generateSource;

    // If source is 'prompt', open the prompt dialog
    if (source === 'prompt') {
      setPromptDialogOpen(true);
      return;
    }

    // Generate from context
    if (onGenerateContent) {
      setIsGenerating(true);
      try {
        const context: NodeGenerationContext = {
          nodeId: node.id,
          nodeName: node.name,
          ancestorPath,
          existingContent: editor.getText(),
          includeDiagram,
        };

        const generatedContent = await onGenerateContent(context);

        // Apply based on placement preference
        const currentText = editor.getText().trim();
        if (!currentText || generatePlacement === 'replace') {
          // No existing content or replace mode - apply directly
          applyGeneratedContent(generatedContent, generatePlacement);
        } else {
          // Has content and not replace - apply with placement
          applyGeneratedContent(generatedContent, generatePlacement);
        }
      } finally {
        setIsGenerating(false);
      }
    } else {
      // Fall back to legacy behavior
      await onExpandContent();
    }
  };

  const handleGenerateFromPrompt = async () => {
    if (!node || !editor || !customPrompt.trim() || !onGenerateContent) return;

    setIsGenerating(true);

    try {
      const context: NodeGenerationContext = {
        nodeId: node.id,
        nodeName: node.name,
        ancestorPath,
        existingContent: editor.getText(),
        customPrompt: customPrompt.trim(),
        includeDiagram,
      };

      const generatedContent = await onGenerateContent(context);
      setAiResponse(generatedContent);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveAiResponse = () => {
    if (!aiResponse || !editor) return;
    applyGeneratedContent(aiResponse, generatePlacement);
    setAiResponse(null);
    setCustomPrompt('');
    setPromptDialogOpen(false);
    toast({
      title: "Saved to Node",
      description: "AI response added to content.",
    });
  };

  const handleDiscardAiResponse = () => {
    setAiResponse(null);
  };

  const handleClosePromptDialog = () => {
    setPromptDialogOpen(false);
    setAiResponse(null);
    setCustomPrompt('');
  };

  // Image generation handlers
  const handleOpenImageDialog = () => {
    // Pre-fill with a suggestion based on the node name
    if (node) {
      setImagePrompt(`An illustration of ${node.name}`);
    }
    setImagePromptDialogOpen(true);
  };

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim() || !editor) return;

    setIsGeneratingImage(true);
    try {
      const result = await generateImageAction(imagePrompt.trim(), {
        aspectRatio: imageAspectRatio,
      });

      if (result.success && result.imageBase64) {
        // Insert image into editor as base64 data URL using ImageBlock for better persistence
        const dataUrl = `data:${result.mimeType};base64,${result.imageBase64}`;
        (editor.commands as any).setImageBlock(dataUrl);

        toast({
          title: "Image Generated",
          description: "AI image has been added to your content.",
        });

        setImagePromptDialogOpen(false);
        setImagePrompt('');
      } else {
        toast({
          title: "Image Generation Failed",
          description: result.error || "Could not generate image. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error generating image:', error);
      toast({
        title: "Error",
        description: "Failed to generate image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleCloseImageDialog = () => {
    setImagePromptDialogOpen(false);
    setImagePrompt('');
  };

  const handleConflictAction = (action: ContentConflictAction) => {
    if (!node || !editor) return;

    setConflictDialogOpen(false);

    if (action === 'cancel') {
      setPendingAIContent('');
      return;
    }

    if (action === 'replace') {
      editor.commands.setContent(pendingAIContent);
    } else if (action === 'prepend') {
      // Insert at beginning
      editor.commands.focus('start');
      editor.commands.insertContent('<p>' + pendingAIContent + '</p><p></p>');
    } else {
      // append - insert at end
      editor.commands.focus('end');
      editor.commands.insertContent('<p></p><p>' + pendingAIContent + '</p>');
    }

    setPendingAIContent('');
  };

  // Text editing handlers
  const handleCut = () => {
    if (!editor) return;
    document.execCommand('cut');
  };

  const handleCopy = () => {
    if (!editor) return;
    document.execCommand('copy');
  };

  const handlePaste = async () => {
    if (!editor) return;
    document.execCommand('paste');
  };

  const handleSelectAll = () => {
    if (!editor) return;
    editor.commands.selectAll();
  };

  const handleUndo = () => {
    if (!editor) return;
    const success = editor.commands.undo();
    if (success) {
      toast({
        title: "Undo",
        description: "Action undone",
        duration: 1500,
      });
    }
  };

  const handleRedo = () => {
    if (!editor) return;
    const success = editor.commands.redo();
    if (success) {
      toast({
        title: "Redo",
        description: "Action redone",
        duration: 1500,
      });
    }
  };

  const handleBulletList = () => {
    if (!editor) return;
    editor.chain().focus().toggleBulletList().run();
  };

  const handleNumberedList = () => {
    if (!editor) return;
    editor.chain().focus().toggleOrderedList().run();
  };

  const handleCheckboxList = () => {
    if (!editor) return;
    editor.chain().focus().toggleTaskList().run();
  };

  const handleHorizontalLine = () => {
    if (!editor) return;
    editor.chain().focus().setHorizontalRule().run();
  };

  const handleRemoveListFormatting = () => {
    if (!editor) return;
    // Lift list items out of lists
    editor.chain().focus().liftListItem('listItem').run();
  };

  // Text formatting handlers
  const handleBold = () => {
    if (!editor) return;
    editor.chain().focus().toggleBold().run();
  };

  const handleItalic = () => {
    if (!editor) return;
    editor.chain().focus().toggleItalic().run();
  };

  const handleStrikethrough = () => {
    if (!editor) return;
    editor.chain().focus().toggleStrike().run();
  };

  const handleCode = () => {
    if (!editor) return;
    editor.chain().focus().toggleCode().run();
  };

  const handleHeading1 = () => {
    if (!editor) return;
    editor.chain().focus().toggleHeading({ level: 1 }).run();
  };

  const handleHeading2 = () => {
    if (!editor) return;
    editor.chain().focus().toggleHeading({ level: 2 }).run();
  };

  const handleHeading3 = () => {
    if (!editor) return;
    editor.chain().focus().toggleHeading({ level: 3 }).run();
  };

  const handleInsertGoogleDoc = () => {
    setGoogleDocsPickerOpen(true);
  };

  const handleGoogleDocSelected = (url: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent({
      type: 'googleDocs',
      attrs: { src: url },
    }).run();
  };

  const handleInsertGoogleSheet = () => {
    setGoogleSheetsPickerOpen(true);
  };

  const handleGoogleSheetSelected = (url: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent({
      type: 'googleSheets',
      attrs: { src: url },
    }).run();
  };

  const handleInsertGoogleSlide = () => {
    setGoogleSlidesPickerOpen(true);
  };

  const handleGoogleSlidesSelected = (url: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent({
      type: 'googleSlides',
      attrs: { src: url },
    }).run();
  };

  const handleInsertYouTube = () => {
    setYoutubePickerOpen(true);
  };

  const handleYouTubeVideoSelected = (url: string) => {
    if (!editor) return;
    // Insert the YouTube video using the YouTube extension
    editor.commands.setYoutubeVideo({ src: url });
  };

  const handleInsertGoogleMaps = () => {
    setGoogleMapsPickerOpen(true);
  };

  const handleGoogleMapSelected = (url: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent({
      type: 'googleMaps',
      attrs: { src: url },
    }).run();
  };

  const handleImportPhoto = () => {
    photoInputRef.current?.click();
  };

  const handleImportVideo = () => {
    videoInputRef.current?.click();
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      // Use ImageBlock for better persistence with large base64 images
      (editor.commands as any).setImageBlock(dataUrl, file.name);
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      (editor.commands as any).setVideoBlock(dataUrl, file.type);
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleOpenDrawing = () => {
    setIsDrawingOpen(true);
  };

  const handleInsertDate = () => {
    if (!editor) return;
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    editor.chain().focus().insertContent(today).run();
  };

  const handleConvertToCanvas = () => {
    if (!node) return;
    // Convert this node to a canvas type with empty content
    // The ExcalidrawEditor will initialize a fresh canvas
    onUpdate(node.id, { type: 'canvas', content: '' });
    toast({
      title: "Switched to Canvas",
      description: "This node is now a freeform canvas. Draw, add text, and arrange content freely!",
      duration: 3000,
    });
  };

  const handleConvertToText = () => {
    if (!node) return;
    // Convert back to document type with empty content
    onUpdate(node.id, { type: 'document', content: '' });
    toast({
      title: "Switched to Text",
      description: "This node is now a text document.",
      duration: 2000,
    });
  };

  const handleConvertToSpreadsheet = () => {
    if (!node) return;
    // Convert this node to a spreadsheet type with empty data
    onUpdate(node.id, { type: 'spreadsheet', content: '' });
    toast({
      title: "Switched to Spreadsheet",
      description: "This node is now an inline spreadsheet. Add data, formulas, and more!",
      duration: 3000,
    });
  };

  const handleSaveDrawing = (imageDataUrl: string) => {
    if (!editor) return;

    // Insert the drawing image into the editor using ImageBlock for better persistence
    (editor.commands as any).setImageBlock(imageDataUrl, 'Drawing');
    setIsDrawingOpen(false);

    toast({
      title: "Drawing inserted",
      description: "Your drawing has been added to the content.",
      duration: 2000,
    });
  };

  const handleEmbedSubmit = (urlInput: string) => {
    if (!editor || !node) return;

    // Extract URL from iframe HTML if pasted
    const extractUrl = (input: string): string => {
      // Check if input contains iframe HTML
      const srcMatch = input.match(/src=["']([^"']+)["']/);
      return srcMatch ? srcMatch[1] : input.trim();
    };

    const url = extractUrl(urlInput);

    // Insert the embedded content
    if (embedType === 'googleDoc') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (editor.commands as any).setGoogleDocs(url);
      // Update node type after microtask queue
      queueMicrotask(() => {
        onUpdate(node.id, { type: 'document' });
      });
    } else if (embedType === 'googleSheet') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (editor.commands as any).setGoogleSheets(url);
      queueMicrotask(() => {
        onUpdate(node.id, { type: 'spreadsheet' });
      });
    } else if (embedType === 'googleSlide') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (editor.commands as any).setGoogleSlides(url);
      queueMicrotask(() => {
        onUpdate(node.id, { type: 'document' });
      });
    } else if (embedType === 'youtube') {
      editor.commands.setYoutubeVideo({ src: url });
      queueMicrotask(() => {
        onUpdate(node.id, { type: 'youtube' });
      });
    } else if (embedType === 'googleMaps') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (editor.commands as any).setGoogleMaps(url);
      queueMicrotask(() => {
        onUpdate(node.id, { type: 'map' });
      });
    }

    setEmbedDialogOpen(false);
    setEmbedType(null);
  };

  const handleEmbedCancel = () => {
    setEmbedDialogOpen(false);
    setEmbedType(null);
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (!editor || !node) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const file = files[0]; // Handle first file only for now

    // Read file as data URL
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;

      if (file.type.startsWith('image/')) {
        // Insert image using ImageBlock for better persistence with large base64
        (editor.commands as any).setImageBlock(dataUrl, file.name);
        queueMicrotask(() => {
          onUpdate(node.id, { type: 'image' });
        });
      } else if (file.type === 'application/pdf') {
        // For PDFs, we'd need to upload to a server
        // For now, just show a message
        alert('PDF files need to be uploaded to a hosting service first. Use the Insert App menu to embed a PDF URL.');
      } else if (file.type.startsWith('video/')) {
        alert('Video files need to be uploaded to a hosting service first. Use the Insert App menu to embed a YouTube video.');
      } else {
        alert(`File type ${file.type} is not supported yet.`);
      }
    };

    reader.readAsDataURL(file);
  };

  if (!node) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 text-center bg-background">
        <NodeIcon type="document" className="w-16 h-16 mb-4 text-muted-foreground" />
        <h2 className="text-xl font-semibold text-muted-foreground">Select a node</h2>
        <p className="text-muted-foreground">Choose an item from the left panel to view or edit its content.</p>
      </div>
    );
  }

  const isRoot = node.type === 'root';
  return (
    <div className="flex h-full flex-col bg-background">
      <ContentConflictDialog
        open={conflictDialogOpen}
        onAction={handleConflictAction}
        existingContentPreview={editor?.getText() || ''}
        newContentPreview={pendingAIContent}
      />

      <EmbedUrlDialog
        open={embedDialogOpen}
        embedType={embedType}
        onSubmit={handleEmbedSubmit}
        onCancel={handleEmbedCancel}
      />

      <YouTubePickerDialog
        open={youtubePickerOpen}
        onOpenChange={setYoutubePickerOpen}
        onSelectVideo={handleYouTubeVideoSelected}
      />

      <GoogleDocsPickerDialog
        open={googleDocsPickerOpen}
        onOpenChange={setGoogleDocsPickerOpen}
        onSelectDoc={handleGoogleDocSelected}
      />

      <GoogleSheetsPickerDialog
        open={googleSheetsPickerOpen}
        onOpenChange={setGoogleSheetsPickerOpen}
        onSelectSheet={handleGoogleSheetSelected}
      />

      <GoogleSlidesPickerDialog
        open={googleSlidesPickerOpen}
        onOpenChange={setGoogleSlidesPickerOpen}
        onSelectSlides={handleGoogleSlidesSelected}
      />

      <GoogleMapsPickerDialog
        open={googleMapsPickerOpen}
        onOpenChange={setGoogleMapsPickerOpen}
        onSelectMap={handleGoogleMapSelected}
      />

      <DrawingCanvas
        isOpen={isDrawingOpen}
        onClose={() => setIsDrawingOpen(false)}
        onSave={handleSaveDrawing}
      />

      {/* Ask AI Dialog */}
      <Dialog open={promptDialogOpen} onOpenChange={handleClosePromptDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-purple-600" />
              Ask AI
            </DialogTitle>
            <DialogDescription>
              Tell me what you'd like for "{node?.name}" - I can write, expand, summarize, reformat, or answer general questions.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            {/* User's question */}
            <div>
              <Textarea
                placeholder="Try: 'Write 3 bullet points summarizing this...' or 'Explain this concept simply...' or 'Add a pros and cons section...' or 'What are the key takeaways?'"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className="min-h-[100px] resize-none"
                autoFocus={!aiResponse}
                disabled={isGenerating || !!aiResponse}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !aiResponse) {
                    handleGenerateFromPrompt();
                  }
                }}
              />
              {!aiResponse && !isGenerating && (
                <p className="text-xs text-muted-foreground mt-2">
                  ⌘+Enter to send
                </p>
              )}
            </div>

            {/* AI Response */}
            {(isGenerating || aiResponse) && (
              <div className="border rounded-lg p-4 bg-purple-50 dark:bg-purple-950/30">
                <div className="flex items-center gap-2 mb-2 text-sm font-medium text-purple-700 dark:text-purple-300">
                  <Sparkles className="h-4 w-4" />
                  AI Response
                </div>
                {isGenerating ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Thinking...
                  </div>
                ) : (
                  <div className="prose prose-sm dark:prose-invert max-w-none max-h-[300px] overflow-y-auto">
                    <div dangerouslySetInnerHTML={{ __html: processGeneratedContent(aiResponse || '') }} />
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="flex-shrink-0">
            {aiResponse ? (
              <div className="flex gap-2 w-full justify-between">
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleClosePromptDialog}>
                    Cancel
                  </Button>
                  <Button variant="outline" onClick={handleDiscardAiResponse}>
                    Ask Another
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (aiResponse) {
                        // Copy plain text version
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = processGeneratedContent(aiResponse);
                        navigator.clipboard.writeText(tempDiv.textContent || tempDiv.innerText || '');
                        toast({
                          title: "Copied",
                          description: "Response copied to clipboard.",
                        });
                      }
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button className="bg-green-600 hover:bg-green-700">
                        <Check className="mr-2 h-4 w-4" />
                        Save to Node
                        <ChevronDown className="ml-2 h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {
                        if (aiResponse && editor) {
                          applyGeneratedContent(aiResponse, 'append');
                          setAiResponse(null);
                          setCustomPrompt('');
                          setPromptDialogOpen(false);
                          toast({ title: "Saved", description: "Added below existing content." });
                        }
                      }}>
                        Append (below existing)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        if (aiResponse && editor) {
                          applyGeneratedContent(aiResponse, 'prepend');
                          setAiResponse(null);
                          setCustomPrompt('');
                          setPromptDialogOpen(false);
                          toast({ title: "Saved", description: "Added above existing content." });
                        }
                      }}>
                        Prepend (above existing)
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => {
                        if (aiResponse && editor) {
                          applyGeneratedContent(aiResponse, 'replace');
                          setAiResponse(null);
                          setCustomPrompt('');
                          setPromptDialogOpen(false);
                          toast({ title: "Saved", description: "Replaced existing content." });
                        }
                      }} className="text-destructive">
                        Replace all content
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ) : (
              <>
                <Button variant="outline" onClick={handleClosePromptDialog}>
                  Cancel
                </Button>
                <Button
                  onClick={handleGenerateFromPrompt}
                  disabled={!customPrompt.trim() || isGenerating}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Thinking...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Send
                    </>
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Image Dialog */}
      <Dialog open={imagePromptDialogOpen} onOpenChange={handleCloseImageDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImagePlus className="h-5 w-5 text-violet-600" />
              Generate AI Image
            </DialogTitle>
            <DialogDescription>
              Describe the image you want to create. Be specific about style, colors, and composition.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Image Description</label>
              <Textarea
                placeholder="E.g., A serene mountain landscape at sunset with soft pastel colors, digital art style"
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                className="min-h-[100px] resize-none"
                autoFocus
                disabled={isGeneratingImage}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Aspect Ratio</label>
              <Select
                value={imageAspectRatio}
                onValueChange={(v) => setImageAspectRatio(v as typeof imageAspectRatio)}
                disabled={isGeneratingImage}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1:1">Square (1:1)</SelectItem>
                  <SelectItem value="16:9">Landscape (16:9)</SelectItem>
                  <SelectItem value="9:16">Portrait (9:16)</SelectItem>
                  <SelectItem value="4:3">Standard (4:3)</SelectItem>
                  <SelectItem value="3:4">Portrait Standard (3:4)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseImageDialog} disabled={isGeneratingImage}>
              Cancel
            </Button>
            <Button
              onClick={handleGenerateImage}
              disabled={!imagePrompt.trim() || isGeneratingImage}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {isGeneratingImage ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <ImagePlus className="mr-2 h-4 w-4" />
                  Generate Image
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Read-only banner for User Guide */}
      {isGuide && (
        <div className="flex-shrink-0 px-4 py-2 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
            <span className="text-lg">📖</span>
            <span>This is the <strong>User Guide</strong> (read-only)</span>
          </div>
          {onCopyOutline && (
            <Button
              variant="outline"
              size="sm"
              onClick={onCopyOutline}
              className="text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900"
            >
              <Copy className="w-4 h-4 mr-1" />
              Copy Outline
            </Button>
          )}
        </div>
      )}

      <header className="flex-shrink-0 p-4 border-b" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        <div className="flex items-center gap-2 min-w-0">
            {onBack && (
              <Button
                variant="outline"
                onClick={onBack}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  onBack();
                }}
                className="min-w-[44px] min-h-[44px] touch-manipulation flex-shrink-0 gap-1 px-3"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="text-sm">Outline</span>
              </Button>
            )}
            <div className="min-w-0 flex-1">
              {/* Breadcrumb navigation */}
              {ancestorPath.length > 0 && (
                <div className="flex items-center gap-1 text-xs mb-1 overflow-hidden">
                  <Home className="h-3 w-3 flex-shrink-0 text-[hsl(var(--primary))]" />
                  {ancestorPath.map((name, index) => (
                    <React.Fragment key={index}>
                      <ChevronRight className="h-3 w-3 flex-shrink-0 text-muted-foreground/50" />
                      <span
                        className="truncate max-w-[100px] text-muted-foreground hover:text-foreground transition-colors cursor-default"
                        title={name}
                      >
                        {name}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              )}
              <h1 className="text-2xl font-bold font-headline truncate">{node.name}</h1>
            </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="flex-shrink-0 border-b border-border/50 px-4 py-2 flex items-center gap-2 bg-[hsl(var(--toolbar-bg))]">
        <TooltipProvider delayDuration={300}>
          {/* Add Content Button */}
          <Tooltip>
            <DropdownMenu>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Add content</TooltipContent>
              <DropdownMenuContent align="start">
                {node.type !== 'canvas' && node.type !== 'spreadsheet' && (
                  <>
                    <DropdownMenuItem onClick={handleConvertToCanvas}>
                      <Brush className="mr-2 h-4 w-4" />
                      Canvas (Freeform)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleConvertToSpreadsheet}>
                      <Table className="mr-2 h-4 w-4" />
                      Spreadsheet
                    </DropdownMenuItem>
                  </>
                )}
                {(node.type === 'canvas' || node.type === 'spreadsheet') && (
                  <DropdownMenuItem onClick={handleConvertToText}>
                    <FileText className="mr-2 h-4 w-4" />
                    Switch to Text
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleOpenDrawing}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Drawing (Apple Pencil)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleImportPhoto}>
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Import Photo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleImportVideo}>
                  <Film className="mr-2 h-4 w-4" />
                  Import Video
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleInsertYouTube}>
                  <Video className="mr-2 h-4 w-4" />
                  YouTube Video
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleInsertGoogleDoc}>
                  <FileText className="mr-2 h-4 w-4" />
                  Google Doc
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleInsertGoogleSheet}>
                  <Sheet className="mr-2 h-4 w-4" />
                  Google Sheet
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleInsertGoogleSlide}>
                  <Presentation className="mr-2 h-4 w-4" />
                  Google Slides
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleInsertGoogleMaps}>
                  <Map className="mr-2 h-4 w-4" />
                  Google Maps
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Tooltip>

          {/* Speech Recognition Button */}
          {speechSupported && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isListening ? "default" : "outline"}
                  size="icon"
                  onClick={handleSpeechToggle}
                  className={isListening ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isListening ? 'Stop dictation' : 'Dictate (speak to type)'}
              </TooltipContent>
            </Tooltip>
          )}

          {/* Ask AI Button - opens prompt dialog directly */}
          {aiContentEnabled && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPromptDialogOpen(true)}
                  disabled={isGenerating || isLoadingAI}
                  className="text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950 px-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span className="ml-1.5 text-xs hidden sm:inline">Ask AI</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Chat with AI about this content</TooltipContent>
            </Tooltip>
          )}

          {/* AI Generate Content Dropdown Button */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleGenerateContent()}
                    disabled={isGenerating || isLoadingAI || !aiContentEnabled}
                    className="text-primary hover:bg-primary/20 rounded-r-none border-r-0 px-2"
                  >
                    {(isGenerating || isLoadingAI) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    <span className="ml-1.5 text-xs hidden sm:inline">
                      {generateSource === 'context' ? 'Generate' : 'Prompt'}
                    </span>
                  </Button>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isGenerating || isLoadingAI || !aiContentEnabled}
                      className="text-primary hover:bg-primary/20 rounded-l-none px-1"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {generateSource === 'context'
                  ? 'Generate content from outline context'
                  : 'Generate content from custom prompt'}
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Source</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={generateSource} onValueChange={(v) => setGenerateSource(v as GenerateSource)}>
                <DropdownMenuRadioItem value="context">From context</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="prompt">From prompt...</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">Placement</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={generatePlacement} onValueChange={(v) => setGeneratePlacement(v as GeneratePlacement)}>
                <DropdownMenuRadioItem value="append">Append (below)</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="prepend">Prepend (above)</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="replace">Replace</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">Enhancements</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={includeDiagram}
                onCheckedChange={setIncludeDiagram}
              >
                Include diagram
              </DropdownMenuCheckboxItem>
              {onGenerateContentForDescendants && node && node.childrenIds.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Bulk Actions</DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => onGenerateContentForDescendants(node.id)}
                    className="text-amber-600"
                  >
                    <Layers className="h-4 w-4 mr-2" />
                    Generate for Descendants
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Generate Image Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenImageDialog}
                disabled={isGeneratingImage || isGuide}
                className="text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950 px-2"
              >
                {isGeneratingImage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4" />
                )}
                <span className="ml-1.5 text-xs hidden sm:inline">Image</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Generate AI image</TooltipContent>
          </Tooltip>

          {/* Subtree Diagram Button */}
          {nodes && node && node.childrenIds.length > 0 && (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-green-600 hover:bg-green-50 dark:hover:bg-green-950 px-2"
                    >
                      <Network className="h-4 w-4" />
                      <span className="ml-1.5 text-xs hidden sm:inline">Diagram</span>
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Generate diagram of this subtree</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Generate Subtree Diagram
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handleGenerateSubtreeDiagram('mindmap')}>
                  <GitBranch className="h-4 w-4 mr-2" />
                  Mind Map
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleGenerateSubtreeDiagram('flowchart')}>
                  <Network className="h-4 w-4 mr-2" />
                  Flowchart
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </TooltipProvider>

        {/* Interim transcript indicator */}
        {isListening && interimTranscript && (
          <span className="text-sm text-muted-foreground italic truncate max-w-[200px]">
            {interimTranscript}...
          </span>
        )}
      </div>

      <main className="flex-grow overflow-y-auto p-6 space-y-4">
        {node.type === 'image' && node.content && isUrl(node.content.trimEnd()) && (
            <Card>
                <CardContent className="p-4">
                    <Image data-ai-hint="abstract texture" src={node.content.trimEnd()} alt={node.name} width={600} height={400} className="rounded-md w-full h-auto object-cover" />
                </CardContent>
            </Card>
        )}
        {node.type === 'youtube' && node.content && isUrl(node.content.trimEnd()) && (
            <Card>
                <CardContent className="p-4"><YouTubeEmbed url={node.content.trimEnd()} /></CardContent>
            </Card>
        )}
        {node.type === 'pdf' && node.content && isUrl(node.content.trimEnd()) && (
            <Card>
                <CardContent className="p-4"><PdfEmbed url={node.content.trimEnd()} /></CardContent>
            </Card>
        )}

        {/* Canvas node - Excalidraw editor */}
        {node.type === 'canvas' && (
          <div className="h-[calc(100vh-200px)] min-h-[500px] rounded-lg border overflow-hidden">
            <ExcalidrawEditor
              nodeId={node.id}
              data={node.content ? (() => {
                try {
                  return JSON.parse(node.content);
                } catch {
                  return null;
                }
              })() : null}
              onDataChange={(data) => {
                onUpdate(node.id, { content: JSON.stringify(data) });
              }}
            />
          </div>
        )}

        {/* Spreadsheet node - inline spreadsheet editor */}
        {/* Also render spreadsheet if content looks like spreadsheet data (fallback for type mismatch) */}
        {(node.type === 'spreadsheet' || contentLooksLikeSpreadsheet) && (
          <div className="h-[600px] rounded-lg border overflow-hidden bg-white">
            <SpreadsheetEditor
              key={`${node.id}-${spreadsheetKey}`} // Remount when navigating to ensure fresh data
              nodeId={node.id} // Used by cache to preserve data between remounts
              data={(() => {
                // Empty content = new spreadsheet, return null to use default
                if (!node.content) return null;
                // Try to parse as JSON
                try {
                  // Check if content starts with HTML tags (corrupted)
                  if (node.content.trim().startsWith('<')) {
                    // Try to extract JSON from HTML
                    const jsonMatch = node.content.match(/\{[\s\S]*"sheets"[\s\S]*\}/);
                    if (jsonMatch) {
                      const recovered = JSON.parse(jsonMatch[0]);
                      // Auto-fix the corrupted content
                      queueMicrotask(() => {
                        onUpdate(node.id, { content: JSON.stringify(recovered), type: 'spreadsheet' });
                      });
                      return recovered;
                    }
                    return null; // Can't recover, start fresh
                  }
                  return JSON.parse(node.content);
                } catch {
                  return null;
                }
              })()}
              onChange={(data) => {
                const jsonToSave = JSON.stringify(data);
                // Auto-correct node type if it's not 'spreadsheet' (fixes type mismatch)
                const updates: { content: string; type?: NodeType } = { content: jsonToSave };
                if (node.type !== 'spreadsheet') {
                  updates.type = 'spreadsheet';
                }
                onUpdate(node.id, updates);
              }}
              readOnly={isGuide}
            />
          </div>
        )}

        {/* Link node - URL input */}
        {node.type === 'link' && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">URL</label>
                <Input
                  type="url"
                  placeholder="https://example.com"
                  value={node.metadata?.url || ''}
                  onChange={(e) => {
                    onUpdate(node.id, {
                      metadata: {
                        ...node.metadata,
                        url: e.target.value,
                      },
                    });
                  }}
                  className="w-full"
                />
              </div>
              {node.metadata?.url && (
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (node.metadata?.url) {
                        window.open(node.metadata.url, '_blank');
                      }
                    }}
                    className="w-full"
                  >
                    Open Link
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Code node - syntax highlighted editor */}
        {node.type === 'code' && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium">Language</label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(node.content || '');
                      toast({ title: 'Copied to clipboard' });
                    }}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                </div>
              </div>
              <Select
                value={node.metadata?.codeLanguage || 'javascript'}
                onValueChange={(value) => {
                  onUpdate(node.id, {
                    metadata: {
                      ...node.metadata,
                      codeLanguage: value,
                    },
                  });
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="javascript">JavaScript</SelectItem>
                  <SelectItem value="typescript">TypeScript</SelectItem>
                  <SelectItem value="python">Python</SelectItem>
                  <SelectItem value="java">Java</SelectItem>
                  <SelectItem value="csharp">C#</SelectItem>
                  <SelectItem value="php">PHP</SelectItem>
                  <SelectItem value="ruby">Ruby</SelectItem>
                  <SelectItem value="go">Go</SelectItem>
                  <SelectItem value="rust">Rust</SelectItem>
                  <SelectItem value="sql">SQL</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="css">CSS</SelectItem>
                  <SelectItem value="markup">HTML</SelectItem>
                </SelectContent>
              </Select>
              <textarea
                value={node.content || ''}
                onChange={(e) => onUpdate(node.id, { content: e.target.value })}
                placeholder="Enter your code here..."
                className="w-full min-h-[300px] p-4 border rounded-md font-mono text-sm resize-y text-foreground bg-muted"
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: 14,
                  direction: 'ltr',
                  writingMode: 'horizontal-tb',
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* Quote node - quote text with citation */}
        {node.type === 'quote' && (
          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="p-6">
              <blockquote className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Quote</label>
                  <textarea
                    value={node.content || ''}
                    onChange={(e) => onUpdate(node.id, { content: e.target.value })}
                    placeholder="Enter quote text..."
                    className="w-full min-h-[120px] p-3 text-lg italic border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 text-foreground bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Source / Attribution</label>
                  <Input
                    value={node.metadata?.url || ''}
                    onChange={(e) => {
                      onUpdate(node.id, {
                        metadata: {
                          ...node.metadata,
                          url: e.target.value,
                        },
                      });
                    }}
                    placeholder="— Author Name, Book/Article Title"
                    className="text-sm"
                  />
                </div>
              </blockquote>
            </CardContent>
          </Card>
        )}

        {/* Date node - date picker with notes */}
        {node.type === 'date' && (
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Date</label>
                <Input
                  type="date"
                  value={node.metadata?.dueDate ? new Date(node.metadata.dueDate).toISOString().split('T')[0] : ''}
                  onChange={(e) => {
                    const timestamp = new Date(e.target.value).getTime();
                    onUpdate(node.id, {
                      metadata: {
                        ...node.metadata,
                        dueDate: timestamp,
                      },
                    });
                  }}
                  className="w-full"
                />
              </div>
              {node.metadata?.dueDate && (
                <div className="text-sm text-muted-foreground">
                  {new Date(node.metadata.dueDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Text editor for standard nodes only (not special types with custom editors) */}
        {shouldUseRichTextEditor && (
        <ContextMenu onOpenChange={(open) => {
            if (open) {
              // Block pointer events briefly when menu opens to prevent accidental clicks
              setContextMenuReady(false);
              setTimeout(() => setContextMenuReady(true), 100);
            }
          }}>
          <ContextMenuTrigger
            className={`min-h-[400px] flex-grow text-base font-body leading-relaxed p-0 relative block ${
              isDragging ? 'ring-2 ring-primary ring-offset-2' : ''
            }`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {isDragging && (
              <div className="absolute inset-0 bg-primary/10 flex items-center justify-center pointer-events-none z-10">
                <div className="text-lg font-semibold text-primary">
                  Drop file to insert
                </div>
              </div>
            )}
            {editor ? (
              <EditorContent editor={editor} />
            ) : (
              <div className="text-muted-foreground">Loading editor...</div>
            )}
          </ContextMenuTrigger>

          <ContextMenuContent
            className={contextMenuReady ? '' : 'pointer-events-none'}
            onCloseAutoFocus={(e) => {
              // Prevent auto-focus behavior that might interfere
              e.preventDefault();
            }}
          >
            {/* Text Editing Commands */}
            <ContextMenuItem onClick={handleCut}>
              <Scissors className="mr-2 h-4 w-4" />
              Cut
              <ContextMenuShortcut>Ctrl+X</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuItem onClick={handleCopy}>
              <Copy className="mr-2 h-4 w-4" />
              Copy
              <ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuItem onClick={handlePaste}>
              <Clipboard className="mr-2 h-4 w-4" />
              Paste
              <ContextMenuShortcut>Ctrl+V</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuSeparator />

            <ContextMenuItem onClick={handleSelectAll}>
              <Type className="mr-2 h-4 w-4" />
              Select All
              <ContextMenuShortcut>Ctrl+A</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuSeparator />

            {/* Text Formatting Submenu */}
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <Type className="mr-2 h-4 w-4" />
                Format
              </ContextMenuSubTrigger>
              <ContextMenuSubContent>
                <ContextMenuItem onClick={handleBold}>
                  <Bold className="mr-2 h-4 w-4" />
                  Bold
                  <ContextMenuShortcut>Ctrl+B</ContextMenuShortcut>
                </ContextMenuItem>

                <ContextMenuItem onClick={handleItalic}>
                  <Italic className="mr-2 h-4 w-4" />
                  Italic
                  <ContextMenuShortcut>Ctrl+I</ContextMenuShortcut>
                </ContextMenuItem>

                <ContextMenuItem onClick={handleStrikethrough}>
                  <Strikethrough className="mr-2 h-4 w-4" />
                  Strikethrough
                </ContextMenuItem>

                <ContextMenuItem onClick={handleCode}>
                  <Code className="mr-2 h-4 w-4" />
                  Code
                </ContextMenuItem>

                <ContextMenuSeparator />

                <ContextMenuItem onClick={handleHeading1}>
                  <Heading1 className="mr-2 h-4 w-4" />
                  Heading 1
                </ContextMenuItem>

                <ContextMenuItem onClick={handleHeading2}>
                  <Heading2 className="mr-2 h-4 w-4" />
                  Heading 2
                </ContextMenuItem>

                <ContextMenuItem onClick={handleHeading3}>
                  <Heading3 className="mr-2 h-4 w-4" />
                  Heading 3
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>

            {/* Font Size Submenu */}
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <ALargeSmall className="mr-2 h-4 w-4" />
                Font Size
              </ContextMenuSubTrigger>
              <ContextMenuSubContent>
                <ContextMenuItem onClick={() => setFontSize('xs')}>
                  {fontSize === 'xs' && <Check className="mr-2 h-4 w-4" />}
                  {fontSize !== 'xs' && <span className="mr-2 w-4" />}
                  Extra Small
                </ContextMenuItem>
                <ContextMenuItem onClick={() => setFontSize('sm')}>
                  {fontSize === 'sm' && <Check className="mr-2 h-4 w-4" />}
                  {fontSize !== 'sm' && <span className="mr-2 w-4" />}
                  Small
                </ContextMenuItem>
                <ContextMenuItem onClick={() => setFontSize('base')}>
                  {fontSize === 'base' && <Check className="mr-2 h-4 w-4" />}
                  {fontSize !== 'base' && <span className="mr-2 w-4" />}
                  Normal
                </ContextMenuItem>
                <ContextMenuItem onClick={() => setFontSize('lg')}>
                  {fontSize === 'lg' && <Check className="mr-2 h-4 w-4" />}
                  {fontSize !== 'lg' && <span className="mr-2 w-4" />}
                  Large
                </ContextMenuItem>
                <ContextMenuItem onClick={() => setFontSize('xl')}>
                  {fontSize === 'xl' && <Check className="mr-2 h-4 w-4" />}
                  {fontSize !== 'xl' && <span className="mr-2 w-4" />}
                  Extra Large
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>

            <ContextMenuSeparator />

            {/* List Formatting */}
            <ContextMenuItem onClick={handleBulletList}>
              <List className="mr-2 h-4 w-4" />
              Bullet List
            </ContextMenuItem>

            <ContextMenuItem onClick={handleNumberedList}>
              <ListOrdered className="mr-2 h-4 w-4" />
              Numbered List
            </ContextMenuItem>

            <ContextMenuItem onClick={handleCheckboxList}>
              <CheckSquare className="mr-2 h-4 w-4" />
              Checkbox List
            </ContextMenuItem>

            <ContextMenuItem onClick={handleHorizontalLine}>
              <Minus className="mr-2 h-4 w-4" />
              Horizontal Line
            </ContextMenuItem>

            <ContextMenuItem onClick={handleInsertDate}>
              <Calendar className="mr-2 h-4 w-4" />
              Insert Date
            </ContextMenuItem>

            <ContextMenuItem onClick={handleRemoveListFormatting}>
              <ListX className="mr-2 h-4 w-4" />
              Remove List Formatting
            </ContextMenuItem>

            <ContextMenuSeparator />

            {/* Media Submenu */}
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <AppWindow className="mr-2 h-4 w-4" />
                Insert Media
              </ContextMenuSubTrigger>
              <ContextMenuSubContent>
                <ContextMenuItem onClick={handleConvertToCanvas}>
                  <Brush className="mr-2 h-4 w-4" />
                  Canvas (Freeform)
                </ContextMenuItem>

                <ContextMenuItem onClick={handleConvertToSpreadsheet}>
                  <Table className="mr-2 h-4 w-4" />
                  Spreadsheet
                </ContextMenuItem>

                <ContextMenuSeparator />

                <ContextMenuItem onClick={handleInsertGoogleDoc}>
                  <FileText className="mr-2 h-4 w-4" />
                  Google Doc
                </ContextMenuItem>

                <ContextMenuItem onClick={handleInsertGoogleSheet}>
                  <Sheet className="mr-2 h-4 w-4" />
                  Google Sheet
                </ContextMenuItem>

                <ContextMenuItem onClick={handleInsertGoogleSlide}>
                  <Presentation className="mr-2 h-4 w-4" />
                  Google Slides
                </ContextMenuItem>

                <ContextMenuSeparator />

                <ContextMenuItem onClick={handleInsertYouTube}>
                  <Video className="mr-2 h-4 w-4" />
                  YouTube Video
                </ContextMenuItem>

                <ContextMenuItem onClick={handleOpenDrawing}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Drawing (Apple Pencil)
                </ContextMenuItem>

                <ContextMenuItem onClick={handleImportPhoto}>
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Import Photo
                </ContextMenuItem>

                <ContextMenuItem onClick={handleImportVideo}>
                  <Film className="mr-2 h-4 w-4" />
                  Import Video
                </ContextMenuItem>

                <ContextMenuItem onClick={handleInsertGoogleMaps}>
                  <Map className="mr-2 h-4 w-4" />
                  Google Maps
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>

            <ContextMenuSeparator />

            {/* Undo/Redo */}
            <ContextMenuItem onClick={handleUndo}>
              <Undo className="mr-2 h-4 w-4" />
              Undo
              <ContextMenuShortcut>Ctrl+Z</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuItem onClick={handleRedo}>
              <Redo className="mr-2 h-4 w-4" />
              Redo
              <ContextMenuShortcut>Ctrl+Y</ContextMenuShortcut>
            </ContextMenuItem>

            {/* AI & Content Management */}
            {aiContentEnabled && !isRoot && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={handleGenerateContent} disabled={isGenerating || isLoadingAI}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate AI Content
                </ContextMenuItem>
              </>
            )}

            <ContextMenuSeparator />

            <ContextMenuItem onClick={() => editor?.commands.clearContent()} disabled={!editor}>
              <Eraser className="mr-2 h-4 w-4" />
              Clear Content
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        )}
      </main>

      {/* Hidden file inputs for photo/video import */}
      <input
        type="file"
        ref={photoInputRef}
        accept="image/*"
        onChange={handlePhotoFileChange}
        className="hidden"
      />
      <input
        type="file"
        ref={videoInputRef}
        accept="video/*"
        onChange={handleVideoFileChange}
        className="hidden"
      />
    </div>
  );
}
