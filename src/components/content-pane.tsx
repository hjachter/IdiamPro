'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import type { OutlineNode, NodeGenerationContext } from '@/types';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markup';
import 'prismjs/themes/prism.css';

/**
 * Detect if text appears to be tabular/aligned data that would benefit from monospace formatting.
 * Checks for: markdown tables, multiple consecutive spaces, tab-separated values, ASCII art tables.
 */
function isTabularData(text: string): boolean {
  const lines = text.split('\n').filter(line => line.trim().length > 0);

  // Need at least 2 lines to be considered tabular
  if (lines.length < 2) return false;

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
import NodeIcon from './node-icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Image from 'next/image';
import { ArrowLeft, Sparkles, Loader2, Eraser, Scissors, Copy, Clipboard, Type, Undo, Redo, List, ListOrdered, ListX, Minus, FileText, Sheet, Presentation, Video, Map, AppWindow, Plus, Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3, Mic, MicOff, ChevronRight, Home, Pencil, ALargeSmall, Check, Calendar, Brush } from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamically import DrawingCanvas to avoid SSR issues with tldraw
const DrawingCanvas = dynamic(() => import('./drawing-canvas'), {
  ssr: false,
  loading: () => null,
});

// Dynamically import TldrawEditor for canvas nodes
const TldrawEditor = dynamic(() => import('./tldraw-editor'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-[500px] text-muted-foreground">Loading canvas...</div>,
});
import { Card, CardContent } from './ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Breadcrumbs } from './breadcrumbs';
import ContentConflictDialog, { type ContentConflictAction } from './content-conflict-dialog';
import EmbedUrlDialog, { type EmbedType } from './embed-url-dialog';
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
} from '@/components/ui/dropdown-menu';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import ImageExt from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import Placeholder from '@tiptap/extension-placeholder';
import { GoogleDocs, GoogleSheets, GoogleSlides, GoogleMaps } from './tiptap-extensions';
import { useSpeechRecognition } from '@/lib/use-speech-recognition';

interface ContentPaneProps {
  node: OutlineNode | null;
  ancestorPath: string[];  // Names of ancestors from root to parent
  onUpdate: (nodeId: string, updates: Partial<OutlineNode>) => void;
  onBack?: () => void;
  onExpandContent: () => Promise<void>;  // Legacy callback (kept for compatibility)
  onGenerateContent?: (context: NodeGenerationContext) => Promise<string>;  // Enhanced callback
  isLoadingAI: boolean;
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
  ancestorPath,
  onUpdate,
  onBack,
  onExpandContent,
  onGenerateContent,
  isLoadingAI
}: ContentPaneProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [pendingAIContent, setPendingAIContent] = useState('');
  const [embedDialogOpen, setEmbedDialogOpen] = useState(false);
  const [embedType, setEmbedType] = useState<EmbedType>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDrawingOpen, setIsDrawingOpen] = useState(false);
  const [pendingTabularPaste, setPendingTabularPaste] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState<'xs' | 'sm' | 'base' | 'lg' | 'xl'>('base');
  const [contextMenuReady, setContextMenuReady] = useState(true);

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

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      HorizontalRule,
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
    ],
    content: '',  // Start empty, useEffect will set content
    onUpdate: ({ editor }) => {
      if (node) {
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

  useEffect(() => {
    // Update editor content when node changes
    if (editor && node) {
      const currentContent = editor.getHTML();
      const newContent = node.content || '';
      if (currentContent !== newContent) {
        // Defer to avoid flushSync during render
        queueMicrotask(() => {
          editor.commands.setContent(newContent, false);
        });
      }
    }
  }, [node, editor]);

  // Update editor class when font size changes
  useEffect(() => {
    if (editor) {
      editor.setOptions({
        editorProps: {
          attributes: {
            class: `tiptap focus:outline-none min-h-[400px] p-0 font-size-${fontSize}`,
          },
        },
      });
    }
  }, [editor, fontSize]);

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
    // Undo the plain text paste, then insert as code block
    editor.chain().focus().undo().setCodeBlock().insertContent(text).run();
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

  const handleGenerateContent = async () => {
    if (!node || isGenerating || isLoadingAI || !editor) return;

    // Use enhanced generation if available, otherwise fall back to legacy
    if (onGenerateContent) {
      setIsGenerating(true);
      try {
        const context: NodeGenerationContext = {
          nodeId: node.id,
          nodeName: node.name,
          ancestorPath,
          existingContent: editor.getText(),
        };

        const generatedContent = await onGenerateContent(context);

        // Check if content exists
        const currentText = editor.getText().trim();
        if (currentText) {
          // Show conflict dialog
          setPendingAIContent(generatedContent);
          setConflictDialogOpen(true);
        } else {
          // Insert directly
          editor.commands.setContent(generatedContent);
        }
      } finally {
        setIsGenerating(false);
      }
    } else {
      // Fall back to legacy behavior
      await onExpandContent();
    }
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
    setEmbedType('googleDoc');
    setEmbedDialogOpen(true);
  };

  const handleInsertGoogleSheet = () => {
    setEmbedType('googleSheet');
    setEmbedDialogOpen(true);
  };

  const handleInsertGoogleSlide = () => {
    setEmbedType('googleSlide');
    setEmbedDialogOpen(true);
  };

  const handleInsertYouTube = () => {
    setEmbedType('youtube');
    setEmbedDialogOpen(true);
  };

  const handleInsertGoogleMaps = () => {
    setEmbedType('googleMaps');
    setEmbedDialogOpen(true);
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
    // The TldrawEditor will initialize a fresh canvas
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

  const handleSaveDrawing = (imageDataUrl: string) => {
    if (!editor) return;

    // Insert the drawing image into the editor
    editor.chain().focus().setImage({ src: imageDataUrl }).run();
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
        // Insert image
        editor.chain().focus().setImage({ src: dataUrl }).run();
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

      <DrawingCanvas
        isOpen={isDrawingOpen}
        onClose={() => setIsDrawingOpen(false)}
        onSave={handleSaveDrawing}
      />

      <header className="flex-shrink-0 p-4 border-b" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        <div className="flex items-center gap-2 min-w-0">
            {onBack && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  onBack();
                }}
                className="min-w-[44px] min-h-[44px] touch-manipulation flex-shrink-0"
              >
                <ArrowLeft />
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
                {node.type !== 'canvas' && (
                  <DropdownMenuItem onClick={handleConvertToCanvas}>
                    <Brush className="mr-2 h-4 w-4" />
                    Canvas (Freeform)
                  </DropdownMenuItem>
                )}
                {node.type === 'canvas' && (
                  <DropdownMenuItem onClick={handleConvertToText}>
                    <FileText className="mr-2 h-4 w-4" />
                    Switch to Text
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleOpenDrawing}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Drawing (Apple Pencil)
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

          {/* AI Generate Content Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={handleGenerateContent}
                disabled={isGenerating || isLoadingAI || !aiContentEnabled}
                className="text-primary hover:bg-primary/20"
              >
                {(isGenerating || isLoadingAI) ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Generate content with AI</TooltipContent>
          </Tooltip>
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

        {/* Canvas node - full tldraw editor */}
        {node.type === 'canvas' && (
          <div className="h-[calc(100vh-200px)] min-h-[500px] rounded-lg border overflow-hidden">
            <TldrawEditor
              snapshot={node.content ? (() => {
                try {
                  return JSON.parse(node.content);
                } catch {
                  return null;
                }
              })() : null}
              onSnapshotChange={(snapshot) => {
                onUpdate(node.id, { content: JSON.stringify(snapshot) });
              }}
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
              <div className="border rounded-md overflow-hidden">
                <Editor
                  value={node.content || ''}
                  onValueChange={(code) => {
                    onUpdate(node.id, { content: code });
                  }}
                  highlight={(code) => {
                    const language = node.metadata?.codeLanguage || 'javascript';
                    try {
                      return Prism.highlight(code, Prism.languages[language] || Prism.languages.javascript, language);
                    } catch {
                      return code;
                    }
                  }}
                  padding={16}
                  style={{
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    fontSize: 14,
                    minHeight: '300px',
                    backgroundColor: '#f8f9fa',
                  }}
                  className="font-mono text-sm"
                />
              </div>
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
                    className="w-full min-h-[120px] p-3 text-lg italic border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
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

        {/* Text editor for non-canvas nodes */}
        {node.type !== 'canvas' && (
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

            {/* Apps Submenu */}
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <AppWindow className="mr-2 h-4 w-4" />
                Insert App
              </ContextMenuSubTrigger>
              <ContextMenuSubContent>
                <ContextMenuItem onClick={handleConvertToCanvas}>
                  <Brush className="mr-2 h-4 w-4" />
                  Canvas (Freeform)
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
    </div>
  );
}
