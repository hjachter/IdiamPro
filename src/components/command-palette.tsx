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
import { getMicPermissionHelp } from '@/lib/platform-help';
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
  // Tracks the source of the *most recent* fill of `searchValue` so we know
  // whether to auto-submit. Voice fills should auto-submit after a tiny
  // debounce; typed fills should NOT. Reset to 'idle' when the field clears
  // or when the dialog closes.
  const lastInputSourceRef = useRef<'idle' | 'voice' | 'typed'>('idle');
  // Holds a pending auto-submit timer so we can cancel it if the user starts
  // typing during the debounce window.
  const autoSubmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset search when dialog closes
  useEffect(() => {
    if (!open) {
      setSearchValue('');
      lastInputSourceRef.current = 'idle';
      if (autoSubmitTimerRef.current) {
        clearTimeout(autoSubmitTimerRef.current);
        autoSubmitTimerRef.current = null;
      }
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
      // Mark this fill as voice-originated so the auto-submit effect picks it
      // up. We don't fire submit directly here because:
      //   1. `onAICommand` and `submitAI` aren't stable refs at this scope, and
      //   2. setting state then submitting on next render gives React time to
      //      apply the new value and the user a chance to take over.
      lastInputSourceRef.current = 'voice';
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
  // Track when listening started so we can surface a "we can't hear you" hint
  // if no real audio shows up within a few seconds. Drives the silence
  // fallback message under the input.
  const [listenStartedAt, setListenStartedAt] = useState<number | null>(null);
  const [silenceElapsed, setSilenceElapsed] = useState(false);
  useEffect(() => {
    if (!open) {
      if (speech.listening) speech.stop();
      setUserTookOver(false);
      setListenStartedAt(null);
      setSilenceElapsed(false);
      return;
    }
    if (!wantsVoice) return;
    if (!speech.supported) return;
    const t = setTimeout(() => {
      voiceBaseRef.current = '';
      setUserTookOver(false);
      setListenStartedAt(Date.now());
      setSilenceElapsed(false);
      speech.start();
    }, 50);
    return () => clearTimeout(t);
    // We intentionally don't depend on `speech` (a fresh object each render)
    // to avoid re-firing the timer on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, wantsVoice]);

  // After 3 seconds with no audio detected, surface the silence hint. The
  // hint clears immediately the moment real audio arrives.
  useEffect(() => {
    if (!speech.listening || listenStartedAt == null) {
      setSilenceElapsed(false);
      return;
    }
    if (speech.audioDetected) {
      setSilenceElapsed(false);
      return;
    }
    const remaining = Math.max(0, 3000 - (Date.now() - listenStartedAt));
    const t = setTimeout(() => setSilenceElapsed(true), remaining);
    return () => clearTimeout(t);
  }, [speech.listening, speech.audioDetected, listenStartedAt]);

  const showSilenceHint =
    speech.listening && !userTookOver && silenceElapsed && !speech.audioDetected;

  const submitAI = useCallback(() => {
    const t = searchValue.trim();
    if (!t || !onAICommand) return;
    if (autoSubmitTimerRef.current) {
      clearTimeout(autoSubmitTimerRef.current);
      autoSubmitTimerRef.current = null;
    }
    if (speech.listening) speech.stop();
    onOpenChange(false);
    onAICommand(t);
  }, [searchValue, onAICommand, onOpenChange, speech]);

  // Auto-submit after voice transcription. When `searchValue` was last filled
  // by voice (and the user hasn't taken over typing), schedule a tiny debounce
  // and then fire `submitAI()`. The debounce lets any in-flight transcript
  // chunk land and gives the user a brief window to cancel by typing.
  useEffect(() => {
    if (!open) return;
    if (lastInputSourceRef.current !== 'voice') return;
    if (userTookOver) return;
    if (!onAICommand) return;
    const trimmed = searchValue.trim();
    if (!trimmed) return;
    if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current);
    autoSubmitTimerRef.current = setTimeout(() => {
      autoSubmitTimerRef.current = null;
      // Re-check the conditions at fire time — the user may have started
      // typing during the debounce window, in which case we should NOT submit.
      if (lastInputSourceRef.current === 'voice' && !userTookOver) {
        submitAI();
      }
    }, 400);
    return () => {
      if (autoSubmitTimerRef.current) {
        clearTimeout(autoSubmitTimerRef.current);
        autoSubmitTimerRef.current = null;
      }
    };
  }, [searchValue, userTookOver, open, onAICommand, submitAI]);

  // Physical-keyboard accelerator: Enter submits when no palette item is highlighted.
  // Also: typing any printable character or editing key stops listening, so the
  // user can seamlessly take over from voice without an explicit stop action.
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const isTextEdit =
      e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete';
    if (isTextEdit) {
      // The user is typing — mark this as a typed fill so any pending
      // voice-auto-submit gets cancelled by the effect's guard.
      lastInputSourceRef.current = 'typed';
      if (autoSubmitTimerRef.current) {
        clearTimeout(autoSubmitTimerRef.current);
        autoSubmitTimerRef.current = null;
      }
      if (speech.listening) {
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

  // 5-bar live audio-level meter. Each bar lights up progressively as the
  // smoothed RMS rises. Bar i lights when level > (i+1)/N * scale.
  const BAR_COUNT = 5;
  // Scale level into 0..1 of "visible loudness". Anything above ~0.4 RMS is
  // basically yelling, so we map 0..0.4 to 0..1 for the meter.
  const meterScale = Math.min(1, speech.level / 0.4);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Type a command or question…"
        value={searchValue}
        onValueChange={(v) => {
          // If this change came from voice's onFinal, we've already marked the
          // source as 'voice' before calling setSearchValue (state batching is
          // fine — the ref is set first). For any *other* change (real typing,
          // backspace via IME, paste), treat it as typed and cancel any pending
          // auto-submit. We detect "voice fill" by reference equality with the
          // most recent voice-accumulated string; anything else is user input.
          if (v !== voiceBaseRef.current) {
            lastInputSourceRef.current = 'typed';
            if (autoSubmitTimerRef.current) {
              clearTimeout(autoSubmitTimerRef.current);
              autoSubmitTimerRef.current = null;
            }
          }
          setSearchValue(v);
        }}
        onKeyDown={handleInputKeyDown}
        action={
          speech.listening && !userTookOver ? (
            <div
              data-testid="listening-indicator"
              className="ml-2 mr-10 flex items-center gap-2 shrink-0 pointer-events-none"
              aria-live="polite"
              aria-label="Listening"
            >
              <span
                className="flex items-end gap-[2px] h-3 shrink-0"
                aria-hidden="true"
              >
                {Array.from({ length: BAR_COUNT }).map((_, i) => {
                  // Each bar's individual height scales with its share of the
                  // total level — bar 0 is most sensitive, bar N-1 needs loud
                  // audio to fully light. Min 20% so the meter is always
                  // visible as a placeholder shape, not invisible at silence.
                  const share = Math.max(0, Math.min(1, meterScale * (BAR_COUNT / (i + 1))));
                  const heightPct = 20 + share * 80;
                  return (
                    <span
                      key={i}
                      className="w-[2px] rounded-sm bg-red-500 transition-[height] duration-75"
                      style={{ height: `${heightPct}%` }}
                    />
                  );
                })}
              </span>
              <span className="text-xs text-muted-foreground">Listening</span>
            </div>
          ) : null
        }
      />
      {showSilenceHint && (
        <div
          data-testid="silence-hint"
          className="px-3 py-1.5 text-xs text-muted-foreground border-t"
          aria-live="polite"
        >
          Listening but not hearing anything — {getMicPermissionHelp()}
        </div>
      )}
      <CommandList>
        <CommandEmpty>
          {onAICommand && searchValue.trim() ? (
            // Natural-language affordance: when the typed/spoken text doesn't
            // match any built-in command, surface a clear "Ask AI" action
            // instead of the dead-end "No results found" message. This is the
            // primary call-to-action for our natural-language interface.
            <button
              type="button"
              onClick={submitAI}
              data-testid="ask-ai-affordance"
              className="w-full flex items-center gap-2 px-3 py-3 text-left text-sm rounded-sm hover:bg-accent hover:text-accent-foreground focus:outline-none focus:bg-accent focus:text-accent-foreground"
            >
              <Sparkles className="h-4 w-4 shrink-0 text-primary" />
              <span className="flex-1 min-w-0">
                <span className="text-muted-foreground">Ask AI: </span>
                <span className="font-medium truncate">
                  &ldquo;{searchValue.trim()}&rdquo;
                </span>
              </span>
              <CommandShortcut>Enter</CommandShortcut>
            </button>
          ) : (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Type a command or question.
            </div>
          )}
        </CommandEmpty>


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
