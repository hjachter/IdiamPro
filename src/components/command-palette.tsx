'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSpeechToText } from '@/hooks/use-speech-to-text';
import { toast } from '@/hooks/use-toast';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Plus,
  FileText,
  Search,
  FolderClosed,
  FolderOpen,
  Copy,
  Trash2,
  Download,
  Upload,
  BookOpen,
  ChevronRight,
  RefreshCw,
  Maximize,
  Keyboard,
  Library,
  LayoutTemplate,
  Sparkles,
} from 'lucide-react';
import { useInputModePreference } from '@/lib/use-input-mode-preference';
import type { Outline } from '@/types';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outlines: Outline[];
  currentOutlineId: string;
  selectedNodeId: string | null;
  onSelectOutline: (outlineId: string) => void;
  onCreateOutline: () => void;
  onCreateNode: () => void;
  onDuplicateNode?: (nodeId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  onOpenSearch: () => void;
  onExportOutline?: () => void;
  onImportOutline?: () => void;
  onRefreshGuide?: () => void;
  onToggleFocusMode?: () => void;
  onShowShortcuts?: () => void;
  onOpenBulkResearch?: () => void;
  onOpenTemplates?: () => void;
  onOpenLiveBooks?: () => void;
  isGuide: boolean;
  isFocusMode?: boolean;
  onAICommand?: (text: string) => void;
}

export default function CommandPalette({
  open,
  onOpenChange,
  outlines,
  currentOutlineId,
  selectedNodeId,
  onSelectOutline,
  onCreateOutline,
  onCreateNode,
  onDuplicateNode,
  onDeleteNode,
  onCollapseAll,
  onExpandAll,
  onOpenSearch,
  onExportOutline,
  onImportOutline,
  onRefreshGuide,
  onToggleFocusMode,
  onShowShortcuts,
  onOpenBulkResearch,
  onOpenTemplates,
  onOpenLiveBooks,
  isGuide,
  isFocusMode,
  onAICommand,
}: CommandPaletteProps) {
  const [searchValue, setSearchValue] = useState('');

  // Reset search when dialog closes
  useEffect(() => {
    if (!open) {
      setSearchValue('');
    }
  }, [open]);

  // Voice input — Gemini transcribes the recording into the search field.
  // No interim results: text appears all at once when the user clicks stop.
  const voiceBaseRef = useRef('');
  // When the user takes over by typing, we want the "Listening" indicator to
  // disappear immediately even though the underlying recorder is still
  // round-tripping audio to Gemini. This flag hides the indicator in that
  // window without affecting the in-flight transcription.
  const [userTookOver, setUserTookOver] = useState(false);
  const speech = useSpeechToText({
    onFinal: (text) => {
      voiceBaseRef.current = (voiceBaseRef.current + ' ' + text).trim();
      setSearchValue(voiceBaseRef.current);
    },
    onError: (msg) => {
      toast({ title: 'Voice input', description: msg, variant: 'destructive' });
    },
  });
  // Auto-start the mic when the palette opens, if Input mode is set to voice
  // (either "Voice" or "Voice + auto-start") and the browser supports it.
  // Stop listening cleanly when the palette closes.
  const [inputMode] = useInputModePreference();
  const wantsVoice = inputMode === 'voice' || inputMode === 'voice-auto-start';
  useEffect(() => {
    if (!open) {
      if (speech.listening) speech.stop();
      setUserTookOver(false);
      return;
    }
    if (!wantsVoice) return;
    if (!speech.supported) return;
    const t = setTimeout(() => {
      voiceBaseRef.current = '';
      setUserTookOver(false);
      speech.start();
    }, 50);
    return () => clearTimeout(t);
    // We intentionally don't depend on `speech` (a fresh object each render)
    // to avoid re-firing the timer on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, wantsVoice]);

  const submitAI = useCallback(() => {
    const t = searchValue.trim();
    if (!t || !onAICommand) return;
    if (speech.listening) speech.stop();
    onOpenChange(false);
    onAICommand(t);
  }, [searchValue, onAICommand, onOpenChange, speech]);

  // Physical-keyboard accelerator: Enter submits when no palette item is highlighted.
  // Also: typing any printable character or editing key stops listening, so the
  // user can seamlessly take over from voice without an explicit stop action.
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (speech.listening) {
      const isTextEdit =
        e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete';
      if (isTextEdit) {
        speech.stop();
        // Hide the "Listening" indicator immediately — don't wait for the
        // Gemini transcription round-trip to flip speech.listening to false.
        setUserTookOver(true);
      }
    }
    if (e.key !== 'Enter') return;
    if (!onAICommand || !searchValue.trim()) return;
    const selected = document.querySelector('[cmdk-root] [cmdk-item][data-selected="true"]');
    if (selected) return; // let cmdk handle Enter to activate that item
    e.preventDefault();
    e.stopPropagation();
    submitAI();
  };

  // Execute a command and close the palette
  const runCommand = useCallback((callback: () => void) => {
    onOpenChange(false);
    // Small delay to allow dialog to close smoothly
    setTimeout(callback, 50);
  }, [onOpenChange]);

  // Get other outlines (not the current one)
  const otherOutlines = useMemo(() => {
    return outlines.filter(o => o.id !== currentOutlineId);
  }, [outlines, currentOutlineId]);

  // Get current outline name
  // const currentOutline = useMemo(() => {
  //   return outlines.find(o => o.id === currentOutlineId);
  // }, [outlines, currentOutlineId]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Type or speak a command..."
        value={searchValue}
        onValueChange={setSearchValue}
        onKeyDown={handleInputKeyDown}
        action={
          speech.listening && !userTookOver ? (
            <div
              className="ml-2 mr-10 flex items-center gap-2 shrink-0 pointer-events-none"
              aria-live="polite"
            >
              <span
                data-testid="listening-indicator"
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-full bg-red-500 shrink-0"
              />
              <span className="text-xs text-muted-foreground">Listening</span>
            </div>
          ) : null
        }
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>


        {/* Quick Actions */}
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => runCommand(onCreateNode)}>
            <Plus className="mr-2 h-4 w-4" />
            <span>New Node</span>
            <CommandShortcut>Enter</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(onCreateOutline)}>
            <FileText className="mr-2 h-4 w-4" />
            <span>New Outline</span>
          </CommandItem>
          {onOpenTemplates && (
            <CommandItem onSelect={() => runCommand(onOpenTemplates)}>
              <LayoutTemplate className="mr-2 h-4 w-4" />
              <span>New from Template</span>
            </CommandItem>
          )}
          {selectedNodeId && onDuplicateNode && !isGuide && (
            <CommandItem onSelect={() => runCommand(() => onDuplicateNode(selectedNodeId))}>
              <Copy className="mr-2 h-4 w-4" />
              <span>Duplicate Node</span>
              <CommandShortcut>⌘D</CommandShortcut>
            </CommandItem>
          )}
          {selectedNodeId && onDeleteNode && !isGuide && (
            <CommandItem onSelect={() => runCommand(() => onDeleteNode(selectedNodeId))}>
              <Trash2 className="mr-2 h-4 w-4" />
              <span>Delete Node</span>
              <CommandShortcut>⌫</CommandShortcut>
            </CommandItem>
          )}
        </CommandGroup>

        <CommandSeparator />

        {/* View */}
        <CommandGroup heading="View">
          <CommandItem onSelect={() => runCommand(onOpenSearch)}>
            <Search className="mr-2 h-4 w-4" />
            <span>Search Outline</span>
            <CommandShortcut>⌃F</CommandShortcut>
          </CommandItem>
          {onToggleFocusMode && (
            <CommandItem onSelect={() => runCommand(onToggleFocusMode)}>
              <Maximize className="mr-2 h-4 w-4" />
              <span>{isFocusMode ? 'Exit Focus Mode' : 'Focus Mode'}</span>
              <CommandShortcut>⌘⇧F</CommandShortcut>
            </CommandItem>
          )}
          <CommandItem onSelect={() => runCommand(onCollapseAll)}>
            <FolderClosed className="mr-2 h-4 w-4" />
            <span>Collapse All</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(onExpandAll)}>
            <FolderOpen className="mr-2 h-4 w-4" />
            <span>Expand All</span>
          </CommandItem>
          {onShowShortcuts && (
            <CommandItem onSelect={() => runCommand(onShowShortcuts)}>
              <Keyboard className="mr-2 h-4 w-4" />
              <span>Keyboard Shortcuts</span>
              <CommandShortcut>?</CommandShortcut>
            </CommandItem>
          )}
        </CommandGroup>

        <CommandSeparator />

        {/* Outline Operations */}
        <CommandGroup heading="Outline">
          {onExportOutline && (
            <CommandItem onSelect={() => runCommand(onExportOutline)}>
              <Download className="mr-2 h-4 w-4" />
              <span>Export Current Outline</span>
            </CommandItem>
          )}
          {onImportOutline && (
            <CommandItem onSelect={() => runCommand(onImportOutline)}>
              <Upload className="mr-2 h-4 w-4" />
              <span>Import Outline</span>
            </CommandItem>
          )}
          {onOpenLiveBooks && selectedNodeId && !isGuide && (
            <CommandItem onSelect={() => runCommand(onOpenLiveBooks)}>
              <RefreshCw className="mr-2 h-4 w-4" />
              <span>LIVE BOOKS: Refresh from the web</span>
              <CommandShortcut>⌘⇧R</CommandShortcut>
            </CommandItem>
          )}
          {onOpenBulkResearch && (
            <CommandItem onSelect={() => runCommand(onOpenBulkResearch)}>
              <Library className="mr-2 h-4 w-4" />
              <span>Bulk Research Import (PREMIUM)</span>
            </CommandItem>
          )}
          {onRefreshGuide && (
            <CommandItem onSelect={() => runCommand(onRefreshGuide)}>
              <RefreshCw className="mr-2 h-4 w-4" />
              <span>Refresh User Guide</span>
            </CommandItem>
          )}
        </CommandGroup>

        {/* Switch to Outline */}
        {otherOutlines.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Switch to Outline">
              {otherOutlines.map(outline => (
                <CommandItem
                  key={outline.id}
                  onSelect={() => runCommand(() => onSelectOutline(outline.id))}
                >
                  {outline.isGuide ? (
                    <BookOpen className="mr-2 h-4 w-4" />
                  ) : (
                    <ChevronRight className="mr-2 h-4 w-4" />
                  )}
                  <span className={outline.isGuide ? 'italic' : ''}>
                    {outline.name}
                  </span>
                  {outline.isGuide && (
                    <span className="ml-2 text-xs text-muted-foreground">(Guide)</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
