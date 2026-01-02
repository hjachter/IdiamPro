'use client';

import React, { useState, useEffect } from 'react';
import { useDebounce } from '@/lib/hooks';
import type { OutlineNode, NodeGenerationContext } from '@/types';
import NodeIcon from './node-icon';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { ArrowLeft, Sparkles, Loader2, Eraser, Scissors, Copy, Clipboard, Type, Undo, Redo, List, ListOrdered, ListX, Minus, FileText, Sheet, Presentation, Video, Map, AppWindow, Plus, Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3, Mic, MicOff, ChevronRight, Home } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import ContentConflictDialog, { type ContentConflictAction } from './content-conflict-dialog';
import EmbedUrlDialog, { type EmbedType } from './embed-url-dialog';
import { useAI, useAIFeature } from '@/contexts/ai-context';
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
    } catch (_) {
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

  const aiContentEnabled = useAIFeature('enableAIContentGeneration');
  const { aiService } = useAI();

  // Speech recognition
  const {
    isListening,
    transcript,
    interimTranscript,
    isSupported: speechSupported,
    startListening,
    stopListening,
    resetTranscript,
    error: speechError,
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
        class: 'tiptap focus:outline-none min-h-[400px] p-0',
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
    editor.commands.undo();
  };

  const handleRedo = () => {
    if (!editor) return;
    editor.commands.redo();
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
      (editor.commands as any).setGoogleDocs(url);
      // Update node type after microtask queue
      queueMicrotask(() => {
        onUpdate(node.id, { type: 'document' });
      });
    } else if (embedType === 'googleSheet') {
      (editor.commands as any).setGoogleSheets(url);
      queueMicrotask(() => {
        onUpdate(node.id, { type: 'spreadsheet' });
      });
    } else if (embedType === 'googleSlide') {
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
  const showAIButton = aiContentEnabled && !isRoot;

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
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1 overflow-hidden">
                  <Home className="h-3 w-3 flex-shrink-0" />
                  {ancestorPath.map((name, index) => (
                    <React.Fragment key={index}>
                      <ChevronRight className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate max-w-[100px]" title={name}>
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
      <div className="flex-shrink-0 border-b px-4 py-2 flex items-center gap-2 bg-muted/30">
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

        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              className={`min-h-[400px] flex-grow text-base font-body leading-relaxed p-0 relative ${
                isDragging ? 'ring-2 ring-primary ring-offset-2' : ''
              }`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onMouseDown={(e) => {
                // Prevent selection from being cleared when right-clicking
                if (e.button === 2) { // Right mouse button
                  e.preventDefault();
                }
              }}
              onContextMenu={(e) => {
                // Allow context menu to open but maintain selection
                e.stopPropagation();
              }}
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
            </div>
          </ContextMenuTrigger>

          <ContextMenuContent>
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
      </main>
    </div>
  );
}
