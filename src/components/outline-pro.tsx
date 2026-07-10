'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef, startTransition } from 'react';
import { flushSync, createPortal } from 'react-dom';
import DOMPurify from 'dompurify';
import { v4 as uuidv4 } from 'uuid';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Outline, OutlineNode, NodeType, NodeMap, NodeGenerationContext, ExternalSourceInput, IngestPreview, AIDepth, AITone, AILevel } from '@/types';
import { getInitialGuide } from '@/lib/initial-guide';
import { getWelcomeOutline, hasSeenWelcome, markWelcomeSeen } from '@/lib/welcome-outline';
import { addNode, addNodeAfter, removeNode, updateNode, moveNode, parseMarkdownToNodes, recalculatePrefixesForBranch, buildOutlineTreeString, generateMindmapFromSubtree, generateFlowchartFromSubtree } from '@/lib/outline-utils';
import OutlinePane from './outline-pane';
import BackupRestoreDialog from './backup-restore-dialog';
import { snapshotBeforeTransform } from '@/lib/snapshot-storage';
import type { SnapshotMeta } from '@/lib/snapshot-storage';
import ContentPane from './content-pane';
import { useToast } from "@/hooks/use-toast";
import { generateOutlineAction, expandContentAction, generateContentForNodeAction, ingestExternalSourceAction, bulkResearchIngestAction, bulletBasedResearchAction, interpretCommandAction } from '@/app/actions';
import type { InterpretedCommand } from '@/ai/flows/interpret-command';
import AICommandConfirmDialog from '@/components/ai-command-confirm-dialog';
import { getUserApiKey } from '@/lib/byok-keys';
import { useAI } from '@/contexts/ai-context';
import {
  checkAIQuota,
  recordAIUsage,
  canUseFeature,
  getCurrentEntitlements,
  tierDisplayName,
} from '@/lib/entitlements';
import { useUpgradePrompt } from '@/components/upgrade-prompt';
import { fireDiscovery } from '@/hooks/use-discovery';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { useAIUsageGate } from '@/lib/use-ai-usage-gate';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction } from './ui/alert-dialog';
import { Button } from './ui/button';
import { loadStorageData, saveAllOutlines, migrateToFileSystem, deleteOutline, loadSingleOutlineOnDemand, saveUnmergeBackup, loadUnmergeBackup, deleteUnmergeBackup, type MigrationConflict, type ConflictResolution, type LazyOutline } from '@/lib/storage-manager';
import CommandPalette from './command-palette';
import EmptyState from './empty-state';
import { WelcomeShowcase } from './welcome-showcase';
import TemplatesDialog from './templates-dialog';
import SidebarPane from './sidebar-pane';
import MobileSidebarSheet from './mobile-sidebar-sheet';
import KeyboardShortcutsDialog, { useKeyboardShortcuts } from './keyboard-shortcuts-dialog';
import BulkResearchDialog from './bulk-research-dialog';
import LiveBooksDialog from './live-books-dialog';
import TranslateDialog from './translate-dialog';
import ReformatDialog from './reformat-dialog';
import TransformOutlineDialog from './transform-outline-dialog';
import ImageToOutlineDialog, { type ImageToOutlineApplyPayload } from './image-to-outline-dialog';
import YoutubePackageDialog from './youtube-package-dialog';
import GenerateVideoDialog from './generate-video-dialog';
import { useFeatureFlag } from './feature-flags-provider';
import { insertProposedNodes } from '@/lib/multimedia/insert-proposed-nodes';
import type { YoutubePackage } from '@/app/actions';
import { mergeTransformedSubtreeIntoOutline } from '@/lib/transform-outline-helpers';
import { buildDerivativeOutline, cloneNodesWithSingleContent, deepCloneNodes } from '@/lib/derivation/build-derivative';
import type { DerivationMode } from './derivation-choice';
import OutlineLinkPickerDialog from './outline-link-picker-dialog';
import HelpChatDialog from './help-chat-dialog';
import KnowledgeChatDialog from './knowledge-chat-dialog';
import AIConsentDialog from './ai-consent-dialog';
import { QuickCaptureDialog } from './quick-capture-dialog';
import { SecondBrainDashboardDialog } from './second-brain-dashboard-dialog';
import { suggestTagsAction } from '@/app/actions';
import dynamic from 'next/dynamic';

const ExportDialog = dynamic(() => import('./export-dialog'), { ssr: false, loading: () => null });
const PodcastDialog = dynamic(() => import('./podcast-dialog'), { ssr: false, loading: () => null });
import { isElectron, electronCheckPendingImports, electronDeletePendingImport, electronClearAllPendingImports, electronSaveOutlineToFile, electronGetOutlineMtime, onElectronWindowFocus, type PendingImportResult } from '@/lib/electron-storage';
import type { BulkResearchSources } from '@/types';

type MobileView = 'stacked' | 'content'; // stacked = outline + preview, content = full screen content

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isValidOutline = (data: any): data is Outline => {
    if (
        typeof data !== 'object' ||
        data === null ||
        typeof data.id !== 'string' ||
        typeof data.name !== 'string' ||
        typeof data.rootNodeId !== 'string' ||
        typeof data.nodes !== 'object' ||
        data.nodes === null ||
        Array.isArray(data.nodes)
    ) {
        return false;
    }

    // Allow lazy-loaded outlines with empty nodes (they'll be loaded on demand)
    if (data._isLazyLoaded === true) {
        return true;
    }

    // For regular outlines, require non-empty nodes with valid root
    if (Object.keys(data.nodes).length === 0 || !data.nodes[data.rootNodeId]) {
        return false;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Object.values(data.nodes).every((node: any) => typeof (node as OutlineNode).prefix === 'string');
};


// Read saved outline ID synchronously to prevent blank screen on load
function getSavedCurrentOutlineId(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('idiampro-current-outline-id') || '';
}

export default function OutlinePro() {
  const [isClient, setIsClient] = useState(false);
  const [outlines, rawSetOutlines] = useState<Outline[]>([]);

  // Dirty tracking: only save outlines that were actually modified in-app
  // This prevents overwriting externally-modified .idm files
  const dirtyOutlineIdsRef = useRef<Set<string>>(new Set());

  // ── Undo / redo history ──────────────────────────────────────────────────
  // History stacks hold past/future snapshots of the whole `outlines` array.
  // Because outline state is updated immutably (every change produces new
  // references), storing the previous array reference is a valid snapshot — it
  // is never mutated by later updates. Every mutation flows through
  // setOutlines below, so recording history there covers ALL actions
  // (including AI-driven ones: LIVE BOOKS apply, Translate apply, NL command
  // bar, etc.) without touching any individual call site.
  // Stack entries now carry an action label so undo toasts can read
  // "Undid: Translate Outline" instead of a generic "Undone". The label is
  // optional; when absent we fall back to a quiet generic message.
  // (Howard 2026-06-10: no hard cap — undo depth is unlimited, bounded only
  // by memory.)
  interface HistoryEntry { outlines: Outline[]; label?: string; big?: boolean }
  const undoStackRef = useRef<HistoryEntry[]>([]);
  const redoStackRef = useRef<HistoryEntry[]>([]);
  // Side channel: any call site that knows it just performed a big action
  // (AI transform applied, paste/import, mass-delete, rename) sets this BEFORE
  // calling setOutlines; the setOutlines wrapper picks it up and attaches it
  // to the snapshot. After the snapshot is recorded the side channel is
  // cleared so unrelated subsequent updates don't inherit a stale label.
  const pendingActionRef = useRef<{ label: string; big: boolean } | null>(null);
  // Marks the NEXT setOutlines update as a "big" action that should fire a
  // persistent toast when undone. Helper for call sites that already build
  // their setOutlines payload elsewhere.
  const markNextAction = useCallback((label: string, big = true) => {
    pendingActionRef.current = { label, big };
  }, []);
  // Keeps a synchronously-readable view of the latest outlines array. Used by
  // undo/redo to compare snapshots against current state without going through
  // a React updater (which is fragile in strict mode and would re-run our pop
  // logic on every invocation).
  const outlinesRef = useRef<Outline[]>([]);
  // True for a short window right after an undo/redo runs. While set, downstream
  // auto-save / dirty-tracking effects that flow through setOutlines must NOT
  // clear the redo stack — otherwise a Cmd+Z immediately followed by Cmd+Shift+Z
  // loses the redo target because the input-blur effect (or similar) wipes it.
  const suppressRedoClearRef = useRef(false);

  // Wrapper around setState that auto-detects which outlines changed via
  // reference equality (for dirty-tracking) AND records history for undo.
  const setOutlines = useCallback((updater: React.SetStateAction<Outline[]>) => {
    rawSetOutlines(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      // Record the pre-change snapshot for undo. A no-op update (next === prev)
      // is not recorded. Any genuine user/AI action clears the redo future.
      // Snapshots that don't visibly change the *current* outline are filtered
      // out at undo time (see the undo callback below) — that's a more reliable
      // place to catch dirty-tracking churn, React strict-mode double-invokes,
      // and startup effects than trying to gate them at push time.
      if (next !== prev) {
        const pending = pendingActionRef.current;
        undoStackRef.current.push({
          outlines: prev,
          label: pending?.label,
          big: pending?.big,
        });
        pendingActionRef.current = null;
        // No hard cap on depth (Howard 2026-06-10: "many levels deep, no
        // hard cap"). Memory is the only practical bound.
        if (!suppressRedoClearRef.current) {
          redoStackRef.current = [];
        }
      }
      for (const outline of next) {
        const prevOutline = prev.find(o => o.id === outline.id);
        if (!prevOutline || prevOutline !== outline) {
          dirtyOutlineIdsRef.current.add(outline.id);
          lastEditTimeRef.current.set(outline.id, Date.now());
        }
      }
      return next;
    });
  }, []);

  // For loading outlines from disk — does NOT mark dirty and does NOT record
  // undo history (external syncs are not user actions).
  const setOutlinesFromDisk = useCallback((updater: React.SetStateAction<Outline[]>) => {
    rawSetOutlines(updater);
  }, []);

  // Track last-known file mtime for external modification detection
  // Map: outlineId -> mtimeMs (time of our last save or load)
  const lastKnownMtimeRef = useRef<Map<string, number>>(new Map());

  // Track last in-app edit time per outline (for focus reload conflict protection)
  const lastEditTimeRef = useRef<Map<string, number>>(new Map());
  const [currentOutlineId, setCurrentOutlineId] = useState<string>(getSavedCurrentOutlineId);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>('stacked');
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const aiLoadingStartTime = useRef<number | null>(null);
  const aiCancelledRef = useRef(false);
  const [aiConsentDialogOpen, setAiConsentDialogOpen] = useState(false);
  const pendingAiAction = useRef<(() => void) | null>(null);
  const [isLoadingLazyOutline, setIsLoadingLazyOutline] = useState(false);
  const [loadingOutlineInfo, setLoadingOutlineInfo] = useState<{
    name: string;
    fileSize: string;
    estimatedNodes: number;
    currentLevel?: number;
    totalLevels?: number;
    nodesLoaded?: number;
    totalNodes?: number;
    phase?: 'reading' | 'rendering' | 'complete';
  } | null>(null);
  const [prefixDialogState, setPrefixDialogState] = useState<{ open: boolean, prefix: string, nodeName: string }>({ open: false, prefix: '', nodeName: '' });

  // Subtree clipboard state
  const [subtreeClipboard, setSubtreeClipboard] = useState<{
    nodes: NodeMap;
    rootId: string;
    sourceOutlineId: string;
    isCut: boolean;
  } | null>(null);

  // Migration conflict dialog state
  const [conflictDialog, setConflictDialog] = useState<{
    open: boolean;
    conflict: MigrationConflict | null;
    resolve: ((resolution: ConflictResolution) => void) | null;
  }>({ open: false, conflict: null, resolve: null });

  // Command palette state
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isTemplatesDialogOpen, setIsTemplatesDialogOpen] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const preMergeSnapshotRef = useRef<Outline | null>(null);
  const [hasUnmergeBackup, setHasUnmergeBackup] = useState(false);

  // Keyboard shortcuts dialog
  const { isOpen: isShortcutsOpen, setIsOpen: setIsShortcutsOpen } = useKeyboardShortcuts();

  // Focus mode state
  const [isFocusMode, setIsFocusMode] = useState(false);

  // Sidebar state — always open on app start so an outline can be selected.
  // The user can toggle it closed during a session, but every fresh start brings it back.
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Toast must be declared before any useEffect that uses it
  const { toast } = useToast();

  // Unified confirmation dialog (2026-06-10) — supports "Don't ask again"
  // per-prompt + Professional mode global bypass. Renders <dialog/> below.
  const { confirm: confirmDialog, dialog: confirmDialogEl } = useConfirmDialog();

  // ── Undo / redo (history stacks declared above with setOutlines) ──────────
  // Both bypass setOutlines and call rawSetOutlines directly so the restore is
  // not itself recorded as a new history entry. Restored outlines are marked
  // dirty so the undone/redone state persists to disk.
  // Signature of the current outline only — what the user actually sees. Used
  // to detect "noise" snapshots that left the visible outline unchanged
  // (dirty-tracking churn, lazy-load updates of other outlines, etc.) so
  // Cmd+Z always produces a visible change instead of seeming to do nothing.
  //
  // Volatile fields stripped from the signature:
  //  - lastModified / createdAt / updatedAt timestamps tick on every save.
  //  - Tiptap initializes empty node content to `<p></p>` (and a few similar
  //    "blank document" wrappers) as soon as the editor mounts, which counts
  //    as a state change but is invisible to the user.
  const normalizeContent = (content: unknown): unknown => {
    if (typeof content !== 'string') return content;
    return content.replace(/<p>\s*(<br\s*\/?>\s*)?<\/p>/g, '').trim();
  };
  const visibleSignature = (arr: Outline[], outlineId: string): string => {
    const o = arr.find(o => o.id === outlineId);
    if (!o) return '__none__';
    try {
      return JSON.stringify(o, (key, value) => {
        if (key === 'lastModified' || key === 'createdAt' || key === 'updatedAt') return undefined;
        if (key === 'content') return normalizeContent(value);
        return value;
      });
    } catch { return String(arr.length); }
  };

  const undo = useCallback(() => {
    if (undoStackRef.current.length === 0) {
      toast({ title: 'Nothing to undo', duration: 1200 });
      return;
    }
    const current = outlinesRef.current;
    const currentSig = visibleSignature(current, currentOutlineId);
    let target: HistoryEntry | null = null;
    while (undoStackRef.current.length > 0) {
      const candidate = undoStackRef.current.pop()!;
      if (visibleSignature(candidate.outlines, currentOutlineId) !== currentSig) {
        target = candidate;
        break;
      }
      // Noise snapshot (no visible change). Discard rather than adding to the
      // redo stack — a later Cmd+Shift+Z would otherwise "redo" something the
      // user never saw happen in the first place.
    }
    if (!target) {
      toast({ title: 'Nothing to undo', duration: 1200 });
      return;
    }
    redoStackRef.current.push({ outlines: current, label: target.label, big: target.big });
    for (const o of target.outlines) dirtyOutlineIdsRef.current.add(o.id);
    // Protect the freshly-pushed redo entry from being wiped by the cascade
    // of auto-save / blur / dirty-tracking effects that the undone state
    // change will trigger.
    suppressRedoClearRef.current = true;
    rawSetOutlines(target.outlines);
    setTimeout(() => { suppressRedoClearRef.current = false; }, 500);
    // Big actions (AI transforms, mass operations, imports) get a persistent
    // labeled toast — Howard wants the user to see exactly what they reverted
    // and have time to decide what to do next. Small actions (typing,
    // single-node edits) get the existing brief auto-fade toast so they don't
    // pile up.
    if (target.big && target.label) {
      toast({ title: `Undid: ${target.label}` });
    } else {
      toast({ title: 'Undone', duration: 1200 });
    }
  }, [toast, currentOutlineId]);

  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) {
      toast({ title: 'Nothing to redo', duration: 1200 });
      return;
    }
    const current = outlinesRef.current;
    const currentSig = visibleSignature(current, currentOutlineId);
    let target: HistoryEntry | null = null;
    while (redoStackRef.current.length > 0) {
      const candidate = redoStackRef.current.pop()!;
      if (visibleSignature(candidate.outlines, currentOutlineId) !== currentSig) {
        target = candidate;
        break;
      }
    }
    if (!target) {
      toast({ title: 'Nothing to redo', duration: 1200 });
      return;
    }
    undoStackRef.current.push({ outlines: current, label: target.label, big: target.big });
    for (const o of target.outlines) dirtyOutlineIdsRef.current.add(o.id);
    suppressRedoClearRef.current = true;
    rawSetOutlines(target.outlines);
    setTimeout(() => { suppressRedoClearRef.current = false; }, 500);
    if (target.big && target.label) {
      toast({ title: `Redid: ${target.label}` });
    } else {
      toast({ title: 'Redone', duration: 1200 });
    }
  }, [toast, currentOutlineId]);

  const [pendingAICommand, setPendingAICommand] = useState<InterpretedCommand | null>(null);

  // Keep outlinesRef in sync with React state so undo/redo can read it
  // synchronously without going through a state updater.
  useEffect(() => { outlinesRef.current = outlines; }, [outlines]);

  // Reset stale AI loading state when returning from sleep/background
  // If loading has been going for more than 5 minutes, it's likely stale
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isLoadingAI && aiLoadingStartTime.current) {
        const elapsed = Date.now() - aiLoadingStartTime.current;
        const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes
        if (elapsed > STALE_THRESHOLD) {
          console.log('[AI] Resetting stale loading state after', Math.round(elapsed / 1000), 'seconds');
          setIsLoadingAI(false);
          aiLoadingStartTime.current = null;
          toast({
            title: 'AI Operation Cancelled',
            description: 'The AI operation was interrupted. Please try again.',
          });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isLoadingAI, toast]);

  // Mobile sidebar sheet state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Bulk research dialog state
  const [isBulkResearchOpen, setIsBulkResearchOpen] = useState(false);

  // LIVE BOOKS (manual AI refresh) dialog state
  const [isLiveBooksOpen, setIsLiveBooksOpen] = useState(false);

  // Translate (language translation) dialog state — same transform engine
  // as LIVE BOOKS, different transformer (#52). Re-wired 2026-06-04.
  const [isTranslateOpen, setIsTranslateOpen] = useState(false);

  // Multimedia AI dialogs (2026-06-11) — Image-to-Outline + YouTube package.
  const [isImageToOutlineOpen, setIsImageToOutlineOpen] = useState(false);
  const [isYoutubePackageOpen, setIsYoutubePackageOpen] = useState(false);
  // Generate Video (Phase 2, 2026-07) — render the selected chapter into a
  // narrated slideshow MP4 (Electron desktop only).
  const [isGenerateVideoOpen, setIsGenerateVideoOpen] = useState(false);

  // Feature Switchboard: an ADDITIONAL outer switch over Generate Video. The
  // admin can kill it or target it to Everyone/Free/Pro from /admin/flags,
  // resolved tier-aware here. When off (or the audience excludes this user),
  // the entry point disappears; the desktop-only + Pro/free-taste rules still
  // apply underneath inside the dialog. Fail-safe: defaults to enabled.
  const isGenerateVideoFlagOn = useFeatureFlag('generate-video');
  const handleOpenGenerateVideo = isGenerateVideoFlagOn
    ? () => setIsGenerateVideoOpen(true)
    : undefined;

  // Transform outline with AI dialog state — whole-subtree structural
  // transformation driven by a plain-language instruction. Scope rule:
  // if a node is selected, operate on that subtree; otherwise, operate on
  // the whole current outline (root down).
  const [isTransformOutlineOpen, setIsTransformOutlineOpen] = useState(false);

  // Reformat with AI dialog state — single-shot per-node content reformat
  // driven by a plain-language instruction. Different from Translate/LIVE
  // BOOKS: no subtree fan-out, no transform engine — just one piece of
  // HTML in, one piece of HTML out.
  const [isReformatOpen, setIsReformatOpen] = useState(false);
  // When the dialog opens from a selection inside the editor, we hand it
  // the selected HTML instead of the whole node. The content-pane sets
  // these via an exposed ref. From the Smart Tools / context menu the
  // selection refs are null and we use the whole node's content.
  const [reformatSelectionHtml, setReformatSelectionHtml] = useState<string | null>(null);
  const [reformatApplySelectionFn, setReformatApplySelectionFn] = useState<((newHtml: string) => void) | null>(null);

  // Cross-outline link picker (Phase 1, 2026-06-04). Picks a target outline
  // and inserts an 'outline-link' node into the current outline as a child of
  // the selected node (or the root if nothing is selected).
  const [isOutlineLinkPickerOpen, setIsOutlineLinkPickerOpen] = useState(false);

  // Backup / Restore dialog state (2026-06-10). One dialog, two tabs — the
  // initial tab depends on whether the user clicked Backup or Restore.
  const [isBackupRestoreOpen, setIsBackupRestoreOpen] = useState(false);
  const [backupRestoreInitialTab, setBackupRestoreInitialTab] = useState<'backup' | 'restore'>('backup');

  // The backup-health warning toast (mounted globally in the root layout)
  // dispatches this event when the user clicks "How to fix". Open the Backup &
  // Restore dialog on the Backup tab so they can save a copy right away.
  useEffect(() => {
    const openBackup = () => {
      setBackupRestoreInitialTab('backup');
      setIsBackupRestoreOpen(true);
    };
    window.addEventListener('idm:open-backup-restore', openBackup);
    return () => window.removeEventListener('idm:open-backup-restore', openBackup);
  }, []);

  // Help chat dialog state
  const [isHelpChatOpen, setIsHelpChatOpen] = useState(false);

  // Knowledge chat dialog state
  const [isKnowledgeChatOpen, setIsKnowledgeChatOpen] = useState(false);

  // Second Brain Quick Capture dialog state
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);

  // Second Brain Dashboard dialog state
  const [isSecondBrainDashboardOpen, setIsSecondBrainDashboardOpen] = useState(false);
  // When true, the dashboard opens with its free local search box focused.
  const [secondBrainSearchFocus, setSecondBrainSearchFocus] = useState(false);

  // Export dialog state
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportNodeId, setExportNodeId] = useState<string | null>(null);

  // Podcast generation dialog state
  const [podcastDialogOpen, setPodcastDialogOpen] = useState(false);
  const [podcastNodeId, setPodcastNodeId] = useState<string | null>(null);

  // Pending imports recovery state
  const [pendingImports, setPendingImports] = useState<PendingImportResult[]>([]);
  const [pendingImportDialogOpen, setPendingImportDialogOpen] = useState(false);

  // Multi-select state
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [lastSelectedNodeId, setLastSelectedNodeId] = useState<string | null>(null);

  // Search term state (for content pane highlighting)
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentMatchType, setCurrentMatchType] = useState<'name' | 'content' | 'both' | null>(null);
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);

  // Panel size preference (sticky)
  const [outlinePanelSize, setOutlinePanelSize] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('idiampro-outline-panel-size');
      return saved ? parseFloat(saved) : 30;
    }
    return 30;
  });

  const handlePanelResize = useCallback((sizes: number[]) => {
    if (sizes[0] && typeof window !== 'undefined') {
      setOutlinePanelSize(sizes[0]);
      localStorage.setItem('idiampro-outline-panel-size', sizes[0].toString());
    }
  }, []);

  const isMobile = useIsMobile();
  const isInitialLoadDone = useRef(false);
  const pendingSaveRef = useRef<Promise<void> | null>(null);
  const hasUnsavedChangesRef = useRef(false);
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sidebar width state (persisted to localStorage)
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('idiampro-sidebar-width');
      return saved ? parseInt(saved, 10) : 240;
    }
    return 240;
  });
  const isResizingSidebar = useRef(false);

  // Track just-created node for space-to-edit feature
  const justCreatedNodeIdRef = useRef<string | null>(null);
  // Trigger edit mode on a specific node (set by keyboard shortcuts)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);

  const currentOutline = useMemo(() => outlines.find(o => o.id === currentOutlineId), [outlines, currentOutlineId]);
  const selectedNode = useMemo(() => (currentOutline?.nodes && selectedNodeId) ? currentOutline.nodes[selectedNodeId] : null, [currentOutline, selectedNodeId]);

  // Check if there are any user outlines (not just the guide)
  const hasUserOutlines = useMemo(() => outlines.some(o => !o.isGuide), [outlines]);

  // One-time "make something from this" nudge — fires exactly once, the first
  // time the user has a real outline with a few nodes of content. Uses the
  // Discovery Hints system so it honors the two-tier opt-out + Professional
  // mode. Guarded by a dedicated localStorage flag so it can never nag.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!currentOutline || currentOutline.isGuide) return;
    const nodeCount = currentOutline.nodes ? Object.keys(currentOutline.nodes).length : 0;
    // Root + a few children = something worth turning into media.
    if (nodeCount < 4) return;
    try {
      if (window.localStorage.getItem('onboarding:makeSomethingNudgeFired') === 'true') return;
      window.localStorage.setItem('onboarding:makeSomethingNudgeFired', 'true');
    } catch {
      return;
    }
    fireDiscovery('outline-has-content');
  }, [currentOutline]);

  const { plan } = useAI();
  const { promptUpgrade } = useUpgradePrompt();
  const { gate: aiUsageGate } = useAIUsageGate();

  /**
   * Phase 3 gate: enforce the monthly hosted cloud-AI quota + cloud-AI-by-tier
   * for `kind`. Returns true if the caller may proceed.
   *
   * NO-OP SAFETY: when enforcement is inactive (no auth/billing keys — the
   * state today) checkAIQuota/canUseFeature both allow everything, so this
   * always returns true and the live app is unchanged. Local Ollama and BYOK
   * are exempt inside checkAIQuota and never counted.
   */
  const ensureAIQuota = useCallback(
    (kind: 'outlineGeneration' | 'contentExpansion'): boolean => {
      // Cloud-AI-by-tier (Free = local-only hosted). BYOK/local are exempt
      // and reported as exempt by checkAIQuota, so skip the cloud gate then.
      const quota = checkAIQuota(kind);
      if (!quota.exempt && !canUseFeature('cloudAI')) {
        promptUpgrade({
          reason:
            'Cloud AI is a Pro feature. Free includes unlimited local (Ollama) AI and bring-your-own-key.',
          requiredTier: 'pro',
        });
        return false;
      }
      if (!quota.allowed) {
        const resetDate = new Date(quota.resetsAt).toLocaleDateString(
          undefined,
          { month: 'long', day: 'numeric' },
        );
        const label =
          kind === 'outlineGeneration'
            ? 'outline generations'
            : 'content expansions';
        // Live pricing only ships Free / Student / Pro — anyone over quota
        // gets routed to the Pro upsell. Local AI and BYOK remain unlimited
        // regardless of tier.
        promptUpgrade({
          reason: `You've used all ${quota.limit} of your ${tierDisplayName(
            getCurrentEntitlements().id,
          )} ${label} this month — resets on ${resetDate}. Local AI and your own API key stay unlimited.`,
          requiredTier: 'pro',
        });
        return false;
      }
      return true;
    },
    [promptUpgrade],
  );

  // Compute ancestor path for selected node (names from root to parent)
  const selectedNodeAncestorPath = useMemo(() => {
    if (!currentOutline || !selectedNodeId) return [];
    const nodes = currentOutline.nodes;
    const path: string[] = [];
    let currentNode = nodes[selectedNodeId];

    // Walk up the tree from parent to root
    while (currentNode && currentNode.parentId) {
      const parent = nodes[currentNode.parentId];
      if (parent) {
        path.unshift(parent.name);
        currentNode = parent;
      } else {
        break;
      }
    }
    return path;
  }, [currentOutline, selectedNodeId]);

  // Auto-save: Save to persistent storage whenever outlines change
  // Also update lastModified timestamp for current outline
  // Uses debouncing to prevent rapid saves
  useEffect(() => {
    // Skip saving during initial load
    if (!isInitialLoadDone.current) return;
    // Skip if no outlines loaded yet
    if (outlines.length === 0) return;

    // Mark as having unsaved changes
    hasUnsavedChangesRef.current = true;

    // Clear any existing debounce timer
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current);
    }

    // Debounce saves to prevent rapid repeated saves
    saveDebounceRef.current = setTimeout(() => {
      // Capture and clear the dirty set atomically
      const dirtyIds = new Set(dirtyOutlineIdsRef.current);
      dirtyOutlineIdsRef.current.clear();

      // Skip save if nothing was modified in-app
      if (dirtyIds.size === 0) {
        return;
      }

      // Update lastModified only for dirty outlines before saving
      const updatedOutlines = outlines.map(o => {
        if (dirtyIds.has(o.id) && !o.isGuide) {
          return { ...o, lastModified: Date.now() };
        }
        return o;
      });

      // Save only dirty outlines to storage (preserves external file modifications)
      const savePromise = saveAllOutlines(updatedOutlines, currentOutlineId, dirtyIds)
        .then(() => {
          hasUnsavedChangesRef.current = false;
          // Record mtime for saved outlines so mtime detection knows our last save time
          const saveTime = Date.now();
          for (const id of dirtyIds) {
            lastKnownMtimeRef.current.set(id, saveTime);
          }
        })
        .catch(error => {
          console.error("Auto-save failed:", error);
          // Re-add failed IDs for retry on next save cycle
          for (const id of dirtyIds) {
            dirtyOutlineIdsRef.current.add(id);
          }
        })
        .finally(() => {
          pendingSaveRef.current = null;
        });

      pendingSaveRef.current = savePromise;
    }, 500); // 500ms debounce

    // Cleanup on unmount or when effect re-runs
    return () => {
      if (saveDebounceRef.current) {
        clearTimeout(saveDebounceRef.current);
      }
    };
  }, [outlines, currentOutlineId]);

  // Warn user before leaving if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChangesRef.current || pendingSaveRef.current) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Check for external modifications to the current outline
  // Shared logic used by both focus handler and periodic poll
  const checkExternalModification = useCallback(async () => {
    const currentOutline = outlines.find(o => o.id === currentOutlineId) as LazyOutline | undefined;
    if (!currentOutline) return;
    if (currentOutline.isGuide) return;
    if (currentOutline._isLazyLoaded) return;
    if (!currentOutline._fileName) return;

    // Skip reload if the user recently edited this outline in-app (their work takes priority)
    const lastEdit = lastEditTimeRef.current.get(currentOutlineId) || 0;
    if (Date.now() - lastEdit < 10000) return;

    try {
      const diskMtime = await electronGetOutlineMtime(currentOutline);
      const lastKnown = lastKnownMtimeRef.current.get(currentOutlineId);

      if (diskMtime && lastKnown && diskMtime > lastKnown + 1000) {
        console.log(`[Mtime] External change detected for "${currentOutline.name}" (disk: ${diskMtime}, known: ${lastKnown})`);
        const freshOutline = await loadSingleOutlineOnDemand(currentOutline._fileName);
        if (freshOutline) {
          // Clear dirty flag for this outline so we don't overwrite the reload
          dirtyOutlineIdsRef.current.delete(currentOutlineId);
          setOutlinesFromDisk(current =>
            current.map(o => o.id === currentOutlineId ? freshOutline : o)
          );
          lastKnownMtimeRef.current.set(currentOutlineId, diskMtime);
          toast({
            title: 'Outline Reloaded',
            description: `"${currentOutline.name}" was modified externally and has been refreshed.`,
          });
        }
      }
    } catch (error) {
      console.error('[Mtime] Error checking file mtime:', error);
    }
  }, [currentOutlineId, outlines, toast, setOutlinesFromDisk]);

  // Reload current outline from disk when Electron window regains focus (external edit detection)
  useEffect(() => {
    if (!isClient) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const handleWindowFocus = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(checkExternalModification, 300);
    };

    const unsubscribe = onElectronWindowFocus(handleWindowFocus);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubscribe?.();
    };
  }, [isClient, checkExternalModification]);

  // Periodic poll for external modifications (catches edits by Claude Code while app is in foreground)
  useEffect(() => {
    if (!isClient || !isElectron()) return;

    const interval = setInterval(checkExternalModification, 5000);
    return () => clearInterval(interval);
  }, [isClient, checkExternalModification]);

  // iOS soft-keyboard scroll-into-view: when a text field / editor gains focus
  // on a touch device, the on-screen keyboard can cover it. Scroll the focused
  // element to the vertical center after a short delay so the keyboard has time
  // to animate up. Touch-only (pointer: coarse) so desktop is unaffected.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (typeof window.matchMedia !== 'function') return;
    if (!window.matchMedia('(pointer: coarse)').matches) return;

    let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      const isEditable =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        target.isContentEditable === true;
      if (!isEditable) return;
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        if (typeof target.scrollIntoView === 'function') {
          target.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }, 300);
    };

    document.addEventListener('focusin', handleFocusIn);
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  }, []);

  // Initial load: Load data from storage
  useEffect(() => {
    setIsClient(true);

    const loadData = async () => {
      const guide = getInitialGuide();

      // Show guide immediately so the app is never stuck on a blank screen
      // But don't overwrite currentOutlineId if one was restored from localStorage
      setOutlinesFromDisk([guide]);
      if (!currentOutlineId) {
        setCurrentOutlineId(guide.id);
        setSelectedNodeId(guide.rootNodeId);
      }

      try {
        // Timeout: if storage takes too long, the guide is already showing
        const storagePromise = loadStorageData();
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Storage load timed out')), 30000)
        );
        const { outlines: userOutlines, currentOutlineId: loadedCurrentOutlineId, fixedDuplicateCount, fixedDuplicateNames } = await Promise.race([storagePromise, timeoutPromise]);
        // Strip any stale isGuide entries from disk — the User Guide is always
        // sourced from the bundled getInitialGuide() so users get the latest
        // version on every app launch. (Read-only enforcement makes a stale
        // disk copy unlikely, but defend against older app versions that may
        // have persisted one.)
        const validOutlines = userOutlines.filter(o => o && isValidOutline(o) && !o.isGuide);
        const loadedOutlines = [guide, ...validOutlines];

        // Auto-create the Second Brain outline if none exists
        if (!loadedOutlines.some(o => o.isSecondBrain)) {
          const sbRootId = 'second-brain-root';
          const secondBrain: Outline = {
            id: 'second-brain',
            name: 'Second Brain',
            rootNodeId: sbRootId,
            isSecondBrain: true,
            nodes: {
              [sbRootId]: {
                id: sbRootId,
                name: 'Second Brain',
                parentId: null as unknown as string,
                childrenIds: [],
                type: 'root' as const,
                content: '<p>Your personal knowledge base. Save anything here — notes, research, ideas, articles, images — and search it all with Ask Your Outlines.</p><p><em>The app that makes the Second Brain method actually work.</em></p>',
              },
            },
          };
          loadedOutlines.push(secondBrain);
        }

        setOutlinesFromDisk(loadedOutlines);

        // Record initial mtime baseline for all loaded outlines
        const now = Date.now();
        for (const o of validOutlines) {
          if (!o.isGuide) {
            lastKnownMtimeRef.current.set(o.id, now);
          }
        }

        // Determine which outline to load
        let outlineToLoad: Outline;

        // Check if this is first-time user (hasn't seen welcome)
        if (!hasSeenWelcome()) {
          const welcomeOutline = getWelcomeOutline();
          loadedOutlines.push(welcomeOutline);
          setOutlinesFromDisk(loadedOutlines);
          outlineToLoad = welcomeOutline;
          markWelcomeSeen();
        } else {
          outlineToLoad = loadedOutlines.find(o => o.id === loadedCurrentOutlineId) || validOutlines[0] || guide;
        }

        setCurrentOutlineId(outlineToLoad.id);
        setSelectedNodeId(outlineToLoad.rootNodeId || null);

        // If the outline is lazy-loaded, load it fully now
        const lazyOutline = outlineToLoad as LazyOutline;
        if (lazyOutline._isLazyLoaded && lazyOutline._fileName) {
          try {
            const fullOutline = await loadSingleOutlineOnDemand(lazyOutline._fileName);
            if (fullOutline) {
              setOutlinesFromDisk(prev => prev.map(o => o.id === fullOutline.id ? fullOutline : o));
              setSelectedNodeId(fullOutline.rootNodeId || null);
            }
          } catch (error) {
            console.error('Failed to load lazy outline on startup:', error);
          }
        }

        // Notify user if duplicate IDs were fixed. Framed as a calm, plain-English
        // reassurance rather than the old CLI-style "Fixed Duplicate Outline IDs".
        if (fixedDuplicateCount && fixedDuplicateCount > 0) {
          const many = fixedDuplicateCount > 1;
          const names = fixedDuplicateNames?.length ? `: ${fixedDuplicateNames.join(', ')}` : '';
          toast({
            title: "Outlines tidied up",
            description: `${fixedDuplicateCount} ${many ? 'outlines were' : 'outline was'} automatically cleaned up in the background — no action needed${names}.`,
            duration: 8000,
          });
        }
      } catch (error) {
        console.error("Failed to load data, initializing with guide:", error);
        // Guide is already showing — no action needed, but warn user if it was a timeout
        if ((error as Error).message?.includes('timed out')) {
          toast({
            variant: "destructive",
            title: "Storage Load Slow",
            description: "Your outlines are taking a while to load. They may appear shortly, or try refreshing again.",
            duration: 10000,
          });
        }
      }

      // Mark initial load as complete so auto-save can start
      isInitialLoadDone.current = true;
    };

    loadData();
  }, []);

  // Restore unmerge backup on startup so the Unmerge button survives restarts
  useEffect(() => {
    if (!isClient || !isInitialLoadDone.current) return;

    const restoreUnmergeBackup = async () => {
      try {
        const backup = await loadUnmergeBackup();
        if (backup?.snapshot) {
          preMergeSnapshotRef.current = backup.snapshot;
          setHasUnmergeBackup(true);
          console.log('[Unmerge] Restored backup for outline:', backup.outlineName);
        }
      } catch (error) {
        console.error('[Unmerge] Failed to restore backup:', error);
      }
    };

    restoreUnmergeBackup();
  }, [isClient, outlines]); // outlines dep ensures we run after initial load populates outlines

  // Check for pending imports after initial load (for recovering timed-out imports)
  useEffect(() => {
    if (!isClient) return;

    const checkPendingImports = async () => {
      if (!isElectron()) return;

      try {
        const pending = await electronCheckPendingImports();
        if (pending.length > 0) {
          console.log(`[Pending] Found ${pending.length} pending import(s) to recover`);
          setPendingImports(pending);
          setPendingImportDialogOpen(true);
        }
      } catch (error) {
        console.error('[Pending] Failed to check pending imports:', error);
      }
    };

    // Check after a short delay to let the app initialize
    const timer = setTimeout(checkPendingImports, 2000);
    return () => clearTimeout(timer);
  }, [isClient]);

  // Handle recovering a pending import
  const handleRecoverPendingImport = async (pending: PendingImportResult) => {
    try {
      const recoveredOutline = pending.outline;
      const mergeContext = pending.mergeContext;

      // Check if this was supposed to be a merge into an existing outline
      if (mergeContext?.includeExistingContent && mergeContext.targetOutlineId) {
        const targetOutline = outlines.find(o => o.id === mergeContext.targetOutlineId);

        if (targetOutline) {
          // MERGE MODE: Merge recovered nodes into target outline
          console.log(`[Pending] Merging into existing outline: ${targetOutline.name}`);

          const newNodes = recoveredOutline.nodes;
          const newRootId = recoveredOutline.rootNodeId;
          const newTopLevelNodeIds = newNodes[newRootId]?.childrenIds || [];

          // Create updated nodes map starting with target outline
          const updatedNodes = { ...targetOutline.nodes };
          const currentRootId = targetOutline.rootNodeId;
          const existingChildIds = [...updatedNodes[currentRootId].childrenIds];

          // Helper: Normalize name for comparison
          const normalizeName = (name: string) =>
            name.toLowerCase().replace(/[0-9\.\:\-\_\(\)\"\'\,]/g, '').trim();

          // Add new top-level nodes (avoiding duplicates)
          for (const newNodeId of newTopLevelNodeIds) {
            const newNode = newNodes[newNodeId];
            if (!newNode) continue;

            const normalizedNewName = normalizeName(newNode.name);
            const existingMatch = existingChildIds.find(existingId => {
              const existingNode = updatedNodes[existingId];
              return existingNode && normalizeName(existingNode.name) === normalizedNewName;
            });

            if (!existingMatch) {
              // Add new node with unique ID
              const uniqueId = uuidv4();
              updatedNodes[uniqueId] = {
                ...newNode,
                id: uniqueId,
                parentId: currentRootId,
              };
              existingChildIds.push(uniqueId);

              // Add children recursively
              const addChildren = (parentId: string, originalParentId: string) => {
                const originalNode = newNodes[originalParentId];
                if (!originalNode?.childrenIds) return;
                const newChildIds: string[] = [];
                for (const childId of originalNode.childrenIds) {
                  const childNode = newNodes[childId];
                  if (childNode) {
                    const newChildId = uuidv4();
                    updatedNodes[newChildId] = {
                      ...childNode,
                      id: newChildId,
                      parentId,
                    };
                    newChildIds.push(newChildId);
                    addChildren(newChildId, childId);
                  }
                }
                updatedNodes[parentId].childrenIds = newChildIds;
              };
              addChildren(uniqueId, newNodeId);
            }
          }

          // Update root's children
          updatedNodes[currentRootId] = {
            ...updatedNodes[currentRootId],
            childrenIds: existingChildIds,
          };

          // Update the target outline
          const mergedOutline: Outline = {
            ...targetOutline,
            nodes: updatedNodes,
            lastModified: Date.now(),
          };

          setOutlines(prev => prev.map(o => o.id === targetOutline.id ? mergedOutline : o));

          // Save to file system
          if (isElectron()) {
            await electronSaveOutlineToFile(mergedOutline);
            await electronDeletePendingImport(pending.fileName);
          }

          // Remove from pending list
          setPendingImports(prev => prev.filter(p => p.fileName !== pending.fileName));

          // Select the merged outline
          setCurrentOutlineId(targetOutline.id);

          toast({
            title: "Import Merged!",
            description: `${newTopLevelNodeIds.length} sections merged into "${targetOutline.name}".`,
            duration: 8000,
          });

          if (pendingImports.length <= 1) {
            setPendingImportDialogOpen(false);
          }
          return;
        }
      }

      // DEFAULT: Create as new outline (no merge or target not found)
      setOutlines(prev => [...prev, recoveredOutline]);

      // Save to file system
      if (isElectron()) {
        await electronSaveOutlineToFile(recoveredOutline);
        await electronDeletePendingImport(pending.fileName);
      }

      // Remove from pending list
      setPendingImports(prev => prev.filter(p => p.fileName !== pending.fileName));

      // Select the recovered outline
      setCurrentOutlineId(recoveredOutline.id);
      setSelectedNodeId(recoveredOutline.rootNodeId);

      toast({
        title: "Import Recovered!",
        description: `"${recoveredOutline.name}" (${Object.keys(recoveredOutline.nodes).length - 1} items) has been recovered and saved.`,
        duration: 8000,
      });

      // Close dialog if no more pending imports
      if (pendingImports.length <= 1) {
        setPendingImportDialogOpen(false);
      }
    } catch (error) {
      console.error('[Pending] Failed to recover import:', error);
      toast({
        variant: "destructive",
        title: "Recovery Failed",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  // Handle dismissing a pending import
  const handleDismissPendingImport = async (pending: PendingImportResult) => {
    try {
      if (isElectron()) {
        await electronDeletePendingImport(pending.fileName);
      }
      setPendingImports(prev => prev.filter(p => p.fileName !== pending.fileName));

      if (pendingImports.length <= 1) {
        setPendingImportDialogOpen(false);
      }
    } catch (error) {
      console.error('[Pending] Failed to dismiss import:', error);
    }
  };

  // Keyboard shortcuts (Command Palette, Focus Mode)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to open command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
        return;
      }

      // Ctrl+F to open the outline search. We deliberately use Control (not
      // Command) so we don't fight Electron/Chromium's built-in Cmd+F page
      // find. This matches the ⌃F hint shown in the command palette and the
      // keyboard-shortcuts cheat-sheet. Works from anywhere, including while a
      // node's inline editor is focused.
      if (e.ctrlKey && !e.metaKey && !e.shiftKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        setIsSearchOpen(true);
        return;
      }

      // Cmd+B / Ctrl+B to toggle the sidebar (platform convention: Notion,
      // VS Code). Guarded so it never hijacks Bold while the user is typing in
      // an input / textarea / rich-text node editor.
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === 'b' || e.key === 'B')) {
        const el = document.activeElement as HTMLElement | null;
        const isEditingText = !!el && (
          el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.isContentEditable
        );
        if (isEditingText) return;
        e.preventDefault();
        setIsSidebarOpen((prev) => !prev);
        return;
      }

      // Cmd+Z / Ctrl+Z to undo, +Shift to redo. Skip when the user is editing
      // text in an input / textarea / contenteditable — there the browser's
      // own character-level text undo should win, not the outline-level undo.
      // Exception: if that editable area is EMPTY, the browser has nothing
      // useful to undo, so fall through to outline-level undo. This covers
      // the common "I just created a node and immediately want to take it
      // back" case — Enter creates a new child node and focuses it, so the
      // cursor is sitting in an empty editable when Cmd+Z is pressed.
      if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) {
        const el = document.activeElement as HTMLElement | null;
        const isEditingText = !!el && (
          el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.isContentEditable
        );
        if (isEditingText) {
          const text = (el?.textContent ?? '').trim();
          if (text.length > 0) return;
        }
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }

      // Escape to exit focus mode
      if (e.key === 'Escape' && isFocusMode) {
        e.preventDefault();
        setIsFocusMode(false);
        setTimeout(() => {
          toast({
            title: "Focus Mode Off",
            description: "Returned to normal view",
            duration: 1500,
          });
        }, 0);
        return;
      }

      // Cmd+Shift+F or Ctrl+Shift+F to toggle focus mode
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault();
        const next = !isFocusMode;
        setIsFocusMode(next);
        setTimeout(() => {
          toast({
            title: next ? "Focus Mode On" : "Focus Mode Off",
            description: next ? "Press Escape to exit" : "Returned to normal view",
            duration: 1500,
          });
        }, 0);
        return;
      }

      // Cmd+Shift+R or Ctrl+Shift+R — open LIVE BOOKS (refresh from web).
      // Not an iOS-reserved gesture, not an F-key; unbound elsewhere in-app.
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'r' || e.key === 'R')) {
        if (selectedNodeId && currentOutline && !currentOutline.isGuide) {
          e.preventDefault();
          setIsLiveBooksOpen(true);
        }
        return;
      }

    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFocusMode, toast, selectedNodeId, currentOutline, undo, redo]);

  // handleSelectOutline is declared further down in the component body. We
  // route outline-link navigation through this ref so handleSelectNode (above)
  // can call it without a forward-reference TDZ error.
  const handleSelectOutlineRef = useRef<((id: string) => Promise<void> | void) | null>(null);

  // handleSelectNode - navigate param controls whether to switch to full content view on mobile
  // On mobile with stacked layout: selection updates preview, navigate=true goes to full content
  // Cross-outline link nodes (type 'outline-link'): clicking navigates to the
  // linked outline. If the target outline has been deleted, we show a toast
  // and do not navigate.
  const handleSelectNode = useCallback((nodeId: string, navigate = false) => {
    const current = outlines.find(o => o.id === currentOutlineId);
    const node = current?.nodes?.[nodeId];

    // Outline-link navigation: a tap on an outline-link node jumps to the
    // linked outline. The first tap navigates — this matches user expectation
    // for link-style nodes (the existing 'link' node type opens the URL on
    // click too).
    if (node?.type === 'outline-link' && node.linkedOutlineId) {
      const target = outlines.find(o => o.id === node.linkedOutlineId);
      if (!target) {
        toast({
          title: 'Outline not found',
          description: 'The outline you linked to has been deleted.',
          variant: 'destructive',
        });
        setSelectedNodeId(nodeId);
        return;
      }
      const go = handleSelectOutlineRef.current;
      if (go) {
        go(target.id);
        return;
      }
      // Fallback if the ref hasn't wired up yet — just select the node.
      setSelectedNodeId(nodeId);
      return;
    }

    setSelectedNodeId(nodeId);
    // Only navigate to full content if explicitly requested (e.g., tap on already-selected node)
    if (isMobile && navigate) {
      setMobileView('content');
    }
  }, [isMobile, outlines, currentOutlineId, toast]);

  // handleUpdateNode - also updates outline name when root node name changes
  const handleUpdateNode = useCallback((nodeId: string, updates: Partial<OutlineNode>) => {
    setOutlines(currentOutlines => {
      return currentOutlines.map(o => {
        if (o.id === currentOutlineId) {
          const newNodes = updateNode(o.nodes, nodeId, updates);
          // If renaming the root node, also update the outline name
          if (nodeId === o.rootNodeId && updates.name && !o.isGuide) {
            return { ...o, name: updates.name, nodes: newNodes };
          }
          return { ...o, nodes: newNodes };
        }
        return o;
      });
    });
  }, [currentOutlineId]);

  // LIVE BOOKS — apply an approved refresh back into the current outline,
  // OR fork into a new derivative outline (2026-06-10 default for content-
  // altering transforms). The dialog already built the new node map (with
  // citations + provenance); for derivative mode we wrap the same map into
  // a brand-new Outline; for in-place we swap it into the current outline.
  const handleApplyLiveBooks = useCallback((nextNodes: NodeMap, derivation?: { mode: DerivationMode; label: string }) => {
    const target = outlines.find(o => o.id === currentOutlineId && !o.isGuide);
    if (!target) return;

    if (derivation && derivation.mode === 'derivative') {
      // Original is untouched — no snapshot needed (the original is the
      // backup). Create a new outline and switch to it.
      const newOutline = buildDerivativeOutline({
        original: target,
        transformedNodes: nextNodes,
        transformedRootNodeId: target.rootNodeId,
        derivationLabel: derivation.label,
      });
      markNextAction('Create derivative (Refresh from Web)');
      setOutlines(curr => [...curr, newOutline]);
      setCurrentOutlineId(newOutline.id);
      toast({
        title: 'Derivative created',
        description: `"${newOutline.name}". Original "${target.name}" was not modified.`,
        duration: 8000,
      });
      return;
    }

    // In-place: snapshot the pre-transform state to disk. Fire-and-forget —
    // never blocks the apply. Skipped when the user has opted out in
    // Settings or when not running in Electron.
    void snapshotBeforeTransform(target, 'Refresh from Web');
    markNextAction('Refresh from Web');
    setOutlines(currentOutlines =>
      currentOutlines.map(o =>
        o.id === currentOutlineId && !o.isGuide ? { ...o, nodes: nextNodes } : o
      )
    );
  }, [currentOutlineId, markNextAction, setOutlines, outlines, toast]);

  // Translate — apply an approved translation back into the current outline,
  // or fork into a derivative outline. Default for Translate is in-place
  // (the user already chose the target language and expects replacement),
  // but derivative is offered as an opt-in for users who want to preserve
  // the source. We don't write to the Guide outline (Guide is read-only).
  const handleApplyTranslate = useCallback((nextNodes: NodeMap, derivation?: { mode: DerivationMode; label: string }) => {
    const target = outlines.find(o => o.id === currentOutlineId && !o.isGuide);
    if (!target) return;

    if (derivation && derivation.mode === 'derivative') {
      const newOutline = buildDerivativeOutline({
        original: target,
        transformedNodes: nextNodes,
        transformedRootNodeId: target.rootNodeId,
        derivationLabel: derivation.label,
      });
      markNextAction('Create derivative (Translate)');
      setOutlines(curr => [...curr, newOutline]);
      setCurrentOutlineId(newOutline.id);
      toast({
        title: 'Derivative created',
        description: `"${newOutline.name}". Original "${target.name}" was not modified.`,
        duration: 8000,
      });
      return;
    }

    void snapshotBeforeTransform(target, 'Translate Outline');
    markNextAction('Translate Outline');
    setOutlines(currentOutlines =>
      currentOutlines.map(o =>
        o.id === currentOutlineId && !o.isGuide ? { ...o, nodes: nextNodes } : o
      )
    );
  }, [currentOutlineId, markNextAction, setOutlines, outlines, toast]);

  // ===== Multimedia AI handlers (2026-06-11) =====================
  //
  // Image-to-Outline apply: the dialog hands us a tree of proposed nodes,
  // a derivation choice, and the original image bytes. We:
  //   1. Auto-snapshot the target outline (data-protection rule 2)
  //   2. Register a single undo step via markNextAction (rule 1)
  //   3. Either append as children of the selected node (default) OR
  //      build a derivative outline that begins with the proposed tree
  //
  // The original image bytes are passed to the apply payload. v1 stores
  // them in localStorage keyed by sourceImageId so the small node-tree
  // thumbnail can render without an Electron round-trip. Future work: move
  // to a .media/ directory next to the outline file via Electron IPC.
  const handleApplyImageToOutline = useCallback((payload: ImageToOutlineApplyPayload) => {
    const target = outlines.find(o => o.id === currentOutlineId && !o.isGuide);
    if (!target || !selectedNodeId) return;

    // Persist the source image (v1: localStorage). The sourceImageId is a
    // short hash; the data URL is stored under `idiampro:sourceImage:<id>`.
    const sourceImageId = `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      if (typeof window !== 'undefined' && payload.imageBase64) {
        const dataUrl = `data:${payload.imageMimeType};base64,${payload.imageBase64}`;
        // Only store if it fits within a reasonable cap to keep localStorage healthy.
        if (dataUrl.length < 2_500_000) {
          window.localStorage.setItem(`idiampro:sourceImage:${sourceImageId}`, dataUrl);
        }
      }
    } catch (e) {
      console.warn('[ImageToOutline] could not persist source image:', e);
    }

    if (payload.derivation.mode === 'derivative') {
      // Build a derivative whose root is a fresh single-node tree and apply
      // the proposed nodes underneath it. The simplest model is: take the
      // current outline's full nodes, then in a CLONE, append the proposed
      // tree under the selected node, then mark that clone as the derivative.
      const { newNodes } = insertProposedNodes(target.nodes, selectedNodeId, payload.proposedNodes, { sourceImageId });
      const newOutline = buildDerivativeOutline({
        original: target,
        transformedNodes: newNodes,
        transformedRootNodeId: target.rootNodeId,
        derivationLabel: payload.derivation.label,
      });
      markNextAction('Create derivative (Capture from image)');
      setOutlines(curr => [...curr, newOutline]);
      setCurrentOutlineId(newOutline.id);
      toast({
        title: 'Derivative created',
        description: `"${newOutline.name}". Original "${target.name}" was not modified.`,
        duration: 8000,
      });
      return;
    }

    // In-place append.
    void snapshotBeforeTransform(target, 'Capture from image');
    markNextAction('Capture from image');
    const { newNodes, totalInserted } = insertProposedNodes(target.nodes, selectedNodeId, payload.proposedNodes, { sourceImageId });
    setOutlines(currentOutlines =>
      currentOutlines.map(o =>
        o.id === currentOutlineId && !o.isGuide ? { ...o, nodes: newNodes } : o
      )
    );
    toast({
      title: 'Captured from image',
      description: `${totalInserted} node${totalInserted === 1 ? '' : 's'} added under "${target.nodes[selectedNodeId]?.name || 'this node'}".`,
      duration: 10000,
    });
  }, [currentOutlineId, selectedNodeId, markNextAction, setOutlines, outlines, toast]);

  // YouTube package: markdown export downloads via a hidden <a>.
  const handleExportYoutubeMarkdown = useCallback((markdown: string, fileName: string) => {
    try {
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({ title: 'YouTube package saved', description: fileName, duration: 6000 });
    } catch (e) {
      console.warn('[YouTubePackage] export failed:', e);
    }
  }, [toast]);

  // YouTube package: "Save as new outline" — packages the 8 outputs as a
  // small derivative outline (one node per output) for easy editing.
  const handleSaveYoutubeAsOutline = useCallback((chapterName: string, pkg: YoutubePackage) => {
    const target = outlines.find(o => o.id === currentOutlineId && !o.isGuide);
    if (!target) return;
    // Build a tiny node map for the new outline.
    const rootId = uuidv4();
    const nodes: NodeMap = {
      [rootId]: {
        id: rootId, name: `${chapterName} — YouTube package`, content: '',
        type: 'root', parentId: null, childrenIds: [],
        isCollapsed: false, prefix: '',
      },
    };
    const addChild = (name: string, content: string) => {
      const id = uuidv4();
      nodes[id] = {
        id, name, content, type: 'document', parentId: rootId, childrenIds: [],
        isCollapsed: false, prefix: '',
        metadata: { createdAt: Date.now(), updatedAt: Date.now() },
      };
      (nodes[rootId].childrenIds as string[]).push(id);
    };
    addChild('Title variants', pkg.titleVariants.map(t => `<p>${t}</p>`).join(''));
    addChild('Description', `<p>${pkg.description.replace(/\n/g, '</p><p>')}</p>`);
    addChild('Chapters', `<pre>${pkg.chapters}</pre>`);
    addChild('Voiceover script', `<pre>${pkg.voiceoverScript}</pre>`);
    addChild('Thumbnail concept', `<p>${pkg.thumbnailConcept}</p>`);
    addChild('SEO tags', `<p>${pkg.seoTags.join(', ')}</p>`);
    addChild('B-roll prompts', pkg.brollPrompts.map(p => `<p>${p}</p>`).join(''));
    addChild('Screen-recording shot list', pkg.screenRecordingShotList.map(s => `<p>${s}</p>`).join(''));

    const newOutline = buildDerivativeOutline({
      original: target,
      transformedNodes: nodes,
      transformedRootNodeId: rootId,
      derivationLabel: 'YouTube package',
    });
    markNextAction('Create derivative (YouTube package)');
    setOutlines(curr => [...curr, newOutline]);
    setCurrentOutlineId(newOutline.id);
    toast({
      title: 'YouTube package saved as outline',
      description: `"${newOutline.name}"`,
      duration: 8000,
    });
  }, [currentOutlineId, markNextAction, setOutlines, outlines, toast]);

  // Resolved content the Reformat dialog operates on — either the
  // selection handed in from the bubble menu, or the whole node's content.
  const reformatContentForDialog = useMemo(() => {
    if (reformatSelectionHtml !== null) return reformatSelectionHtml;
    if (!selectedNodeId) return '';
    const outline = outlines.find(o => o.id === currentOutlineId);
    return outline?.nodes[selectedNodeId]?.content || '';
  }, [reformatSelectionHtml, selectedNodeId, outlines, currentOutlineId]);

  const reformatScopeLabel = useMemo(() => {
    if (reformatSelectionHtml !== null) return 'your selection';
    return 'this node';
  }, [reformatSelectionHtml]);

  // Reformat — apply the AI-reformatted HTML back to the selected node,
  // OR fork into a derivative outline (2026-06-10). When the dialog was
  // scoped to a selection, derivation is undefined and we go straight to
  // the in-editor selection swap (a partial-selection derivative would be
  // incoherent).
  const handleApplyReformat = useCallback((newHtml: string, derivation?: { mode: DerivationMode; label: string }) => {
    const target = outlines.find(o => o.id === currentOutlineId && !o.isGuide);
    if (!target) return;

    // Selection scope path — always in-place, no derivative.
    if (reformatApplySelectionFn) {
      void snapshotBeforeTransform(target, 'Reformat with AI');
      reformatApplySelectionFn(newHtml);
      return;
    }
    if (!selectedNodeId) return;

    if (derivation && derivation.mode === 'derivative') {
      // Whole-node reformat into a new derivative. Clone the entire node
      // map with the selected node's content swapped, then wrap it as a
      // derivative outline.
      const newNodes = cloneNodesWithSingleContent(target.nodes, selectedNodeId, newHtml);
      const newOutline = buildDerivativeOutline({
        original: target,
        transformedNodes: newNodes,
        transformedRootNodeId: target.rootNodeId,
        derivationLabel: derivation.label,
      });
      markNextAction('Create derivative (Reformat)');
      setOutlines(curr => [...curr, newOutline]);
      setCurrentOutlineId(newOutline.id);
      toast({
        title: 'Derivative created',
        description: `"${newOutline.name}". Original "${target.name}" was not modified.`,
        duration: 8000,
      });
      return;
    }

    // In-place: snapshot the pre-transform outline before the rewrite.
    // Reformat on a single node still gets a disk snapshot — Howard's
    // data-protection rule is "every AI transform writes a snapshot",
    // regardless of scope.
    void snapshotBeforeTransform(target, 'Reformat with AI');
    markNextAction('Reformat with AI');
    setOutlines(currentOutlines =>
      currentOutlines.map(o => {
        if (o.id !== currentOutlineId || o.isGuide) return o;
        const node = o.nodes[selectedNodeId];
        if (!node) return o;
        return {
          ...o,
          nodes: { ...o.nodes, [selectedNodeId]: { ...node, content: newHtml } },
        };
      })
    );
  }, [currentOutlineId, selectedNodeId, reformatApplySelectionFn, markNextAction, setOutlines, outlines, toast]);

  // Transform outline with AI — scope is the selected node (if any) plus its
  // descendants, OR the whole current outline's root + descendants when
  // nothing is selected. Decision logged in IdiamPro - Development.idm.
  const transformScopeRootId = useMemo(() => {
    if (!currentOutlineId) return null;
    const outline = outlines.find(o => o.id === currentOutlineId);
    if (!outline || outline.isGuide) return null;
    if (selectedNodeId && outline.nodes[selectedNodeId]) return selectedNodeId;
    return outline.rootNodeId;
  }, [outlines, currentOutlineId, selectedNodeId]);

  const transformScopeLabel = useMemo(() => {
    if (!transformScopeRootId) return 'the current outline';
    const outline = outlines.find(o => o.id === currentOutlineId);
    if (!outline) return 'the current outline';
    if (transformScopeRootId === outline.rootNodeId) return 'the current outline';
    const node = outline.nodes[transformScopeRootId];
    if (!node) return 'the current outline';
    return `"${node.name}" and everything beneath it`;
  }, [outlines, currentOutlineId, transformScopeRootId]);

  // Apply an approved structural transform back into the outline, OR fork
  // into a derivative outline (2026-06-10 default for content-altering
  // transforms). The dialog hands back the new SerializedNode subtree; for
  // in-place we merge it in via the helper (which preserves the original
  // parentId on the subtree root anchor). For derivative, we merge into a
  // fresh clone of the original's node map so the original stays untouched.
  const handleApplyTransformOutline = useCallback((args: {
    transformedNodes: Record<string, { id: string; name: string; content: string; type: string; parentId: string | null; childrenIds: string[] }>;
    rootNodeId: string;
    derivation?: { mode: DerivationMode; label: string };
  }) => {
    const target = outlines.find(o => o.id === currentOutlineId && !o.isGuide);
    if (!target) return;

    if (args.derivation && args.derivation.mode === 'derivative') {
      // Build the derivative's node map by merging the transform into a
      // CLONE of the original's nodes (the helper itself doesn't mutate,
      // but we deep-clone first to guarantee the original is untouched
      // even if anything else holds a reference).
      const baseClone = deepCloneNodes(target.nodes);
      const mergedNodes = mergeTransformedSubtreeIntoOutline(
        baseClone,
        args.transformedNodes as Parameters<typeof mergeTransformedSubtreeIntoOutline>[1],
        args.rootNodeId,
      );
      const newOutline = buildDerivativeOutline({
        original: target,
        transformedNodes: mergedNodes,
        transformedRootNodeId: target.rootNodeId,
        derivationLabel: args.derivation.label,
      });
      markNextAction('Create derivative (Transform Outline)');
      setOutlines(curr => [...curr, newOutline]);
      setCurrentOutlineId(newOutline.id);
      toast({
        title: 'Derivative created',
        description: `"${newOutline.name}". Original "${target.name}" was not modified.`,
        duration: 8000,
      });
      return;
    }

    void snapshotBeforeTransform(target, 'Transform Outline with AI');
    markNextAction('Transform Outline with AI');
    setOutlines(currentOutlines =>
      currentOutlines.map(o => {
        if (o.id !== currentOutlineId || o.isGuide) return o;
        const nextNodes = mergeTransformedSubtreeIntoOutline(
          o.nodes,
          // The dialog's SerializedNode type matches what the helper expects.
          args.transformedNodes as Parameters<typeof mergeTransformedSubtreeIntoOutline>[1],
          args.rootNodeId,
        );
        return { ...o, nodes: nextNodes };
      }),
    );
  }, [currentOutlineId, setOutlines, markNextAction, outlines, toast]);

  // Backup / Restore — apply a snapshot's content over the current outline.
  // The dialog has already (a) confirmed with the user and (b) written an
  // auto-snapshot of the pre-restore state. We just replace the outline's
  // nodes + rootNodeId here and mark it on the undo stack so Cmd+Z works.
  const handleRestoreFromSnapshot = useCallback((restoredOutline: Outline, preRestoreMeta: SnapshotMeta | null) => {
    markNextAction('Restore from Backup');
    setOutlines(currentOutlines =>
      currentOutlines.map(o => {
        if (o.id !== currentOutlineId || o.isGuide) return o;
        // Preserve the outline's id + name so the file on disk doesn't get
        // renamed; everything else (nodes, rootNodeId, isSecondBrain flag) is
        // taken from the snapshot.
        return {
          ...restoredOutline,
          id: o.id,
          name: o.name,
        };
      })
    );
    toast({
      title: 'Restored: ' + (restoredOutline.name || 'snapshot'),
      description: preRestoreMeta
        ? 'A backup of your previous state was saved before the restore. Press ⌘Z to undo.'
        : 'Press ⌘Z to undo.',
      duration: Infinity,
    });
  }, [currentOutlineId, markNextAction, setOutlines, toast]);

  // Respect the app-wide AI provider setting: only force local when the user
  // explicitly chose "local" (cloud/auto keep cloud grounding + citations).
  const liveBooksUseLocal = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('aiProvider') === 'local';
  }, [isLiveBooksOpen]);

  // Handle search term change from OutlinePane (for content highlighting)
  const handleSearchTermChange = useCallback((term: string, matchType?: 'name' | 'content' | 'both', matchIndex?: number) => {
    setSearchTerm(term);
    setCurrentMatchType(matchType || null);
    setCurrentMatchIndex(matchIndex ?? 0);
  }, []);

  // handleCreateNode adds new node as sibling AFTER selected node (or as child if root is selected)
  const handleCreateNode = useCallback((type: NodeType = 'document', content: string = '') => {
    if (!selectedNodeId) return;

    // Clear multi-select to ensure single selection
    setSelectedNodeIds(new Set());

    setOutlines(currentOutlines => {
      let newNodeId: string | null = null;

      const newOutlines = currentOutlines.map(o => {
        if (o.id === currentOutlineId) {
          const { newNodes, newNodeId: createdNodeId } = addNodeAfter(
            o.nodes,
            selectedNodeId,
            type,
            type === 'youtube' ? 'New YouTube Video' : type === 'pdf' ? 'New PDF' : 'New Node',
            content
          );
          newNodeId = createdNodeId;
          return { ...o, nodes: newNodes };
        }
        return o;
      });

      // Schedule the selection update after this state update
      if (newNodeId) {
        const capturedNewNodeId = newNodeId;
        setTimeout(() => {
          setSelectedNodeId(capturedNewNodeId);
          setEditingNodeId(capturedNewNodeId); // Auto-enter edit mode for new nodes
          // On mobile, stay in outline view - user taps content preview to see content
        }, 0);
      }

      return newOutlines;
    });
  }, [selectedNodeId, currentOutlineId]);

  // handleCreateChildNode adds new node as child of specified parent (for double-click creation)
  const handleCreateChildNode = useCallback((parentId: string) => {
    // Clear multi-select to ensure single selection (same as handleCreateNode)
    setSelectedNodeIds(new Set());

    setOutlines(currentOutlines => {
      let newNodeId: string | null = null;

      const newOutlines = currentOutlines.map(o => {
        if (o.id === currentOutlineId) {
          const { newNodes, newNodeId: createdNodeId } = addNode(
            o.nodes,
            parentId,
            'document',
            'New Node',
            ''
          );
          newNodeId = createdNodeId;
          return { ...o, nodes: newNodes };
        }
        return o;
      });

      // Schedule the selection update after this state update
      if (newNodeId) {
        const capturedNewNodeId = newNodeId;
        // Track this as a just-created node for space-to-edit feature
        justCreatedNodeIdRef.current = capturedNewNodeId;
        // Clear the ref after 5 seconds
        setTimeout(() => {
          if (justCreatedNodeIdRef.current === capturedNewNodeId) {
            justCreatedNodeIdRef.current = null;
          }
        }, 5000);
        // Use requestAnimationFrame to ensure DOM has updated before setting edit mode
        requestAnimationFrame(() => {
          setSelectedNodeId(capturedNewNodeId);
          setEditingNodeId(capturedNewNodeId); // Auto-enter edit mode for new nodes
        });
      }

      return newOutlines;
    });
  }, [currentOutlineId]);

  // Add a named node from the Tell-AI command bar. Adds it as a CHILD of the
  // currently-selected node, or as a top-level node (child of the root) when
  // nothing is selected. Returns true if the node was actually inserted.
  // Goes through setOutlines, so it records an undo snapshot automatically.
  const handleCreateNamedNode = useCallback((rawName: string): boolean => {
    const name = (rawName && rawName.trim()) || 'New Node';
    const outline = outlines.find(o => o.id === currentOutlineId);
    if (!outline) return false;
    // Prefer the selected node as parent; fall back to the outline root so a
    // bare "add a node" with nothing selected still lands somewhere sensible.
    const parentId = (selectedNodeId && outline.nodes[selectedNodeId])
      ? selectedNodeId
      : outline.rootNodeId;
    if (!parentId || !outline.nodes[parentId]) return false;

    setSelectedNodeIds(new Set());
    setOutlines(currentOutlines => {
      let newNodeId: string | null = null;
      const newOutlines = currentOutlines.map(o => {
        if (o.id === currentOutlineId) {
          const { newNodes, newNodeId: createdNodeId } = addNode(
            o.nodes,
            parentId,
            'document',
            name,
            ''
          );
          newNodeId = createdNodeId;
          return { ...o, nodes: newNodes };
        }
        return o;
      });
      if (newNodeId) {
        const capturedNewNodeId = newNodeId;
        requestAnimationFrame(() => {
          setSelectedNodeId(capturedNewNodeId);
        });
      }
      return newOutlines;
    });
    return true;
  }, [outlines, currentOutlineId, selectedNodeId]);

  // handleCreateSiblingNode adds new node as sibling after specified node (for double-click creation)
  const handleCreateSiblingNode = useCallback((nodeId: string) => {
    // Clear multi-select to ensure single selection (same as handleCreateNode)
    setSelectedNodeIds(new Set());

    setOutlines(currentOutlines => {
      let newNodeId: string | null = null;

      const newOutlines = currentOutlines.map(o => {
        if (o.id === currentOutlineId) {
          const { newNodes, newNodeId: createdNodeId } = addNodeAfter(
            o.nodes,
            nodeId,
            'document',
            'New Node',
            ''
          );
          newNodeId = createdNodeId;
          return { ...o, nodes: newNodes };
        }
        return o;
      });

      // Schedule the selection update after this state update
      if (newNodeId) {
        const capturedNewNodeId = newNodeId;
        // Track this as a just-created node for space-to-edit feature
        justCreatedNodeIdRef.current = capturedNewNodeId;
        // Clear the ref after 5 seconds
        setTimeout(() => {
          if (justCreatedNodeIdRef.current === capturedNewNodeId) {
            justCreatedNodeIdRef.current = null;
          }
        }, 5000);
        // Use requestAnimationFrame to ensure DOM has updated before setting edit mode
        requestAnimationFrame(() => {
          setSelectedNodeId(capturedNewNodeId);
          setEditingNodeId(capturedNewNodeId); // Auto-enter edit mode for new nodes
        });
      }

      return newOutlines;
    });
  }, [currentOutlineId]);

  const isDescendant = (nodes: NodeMap, childId: string, parentId: string): boolean => {
    let current = nodes[childId];
    while (current && current.parentId) {
      if (current.parentId === parentId) return true;
      current = nodes[current.parentId];
    }
    return false;
  };

  // FIXED: handleDeleteNode uses functional update pattern
  const handleDeleteNode = useCallback((nodeId: string) => {
    setOutlines(currentOutlines => {
      const outline = currentOutlines.find(o => o.id === currentOutlineId);
      if (!outline) return currentOutlines;

      const nodeToDelete = outline.nodes[nodeId];
      if (!nodeToDelete || !nodeToDelete.parentId) return currentOutlines;

      // Tag the snapshot so Cmd+Z says "Undid: Delete [Name]". Counts subtree
      // size for a more honest label when the delete cascades.
      const subtreeCount = collectDescendantIds(outline.nodes, nodeId).length;
      const label = subtreeCount > 1
        ? `Delete ${nodeToDelete.name || 'item'} and ${subtreeCount - 1} child${subtreeCount - 1 === 1 ? '' : 'ren'}`
        : `Delete ${nodeToDelete.name || 'item'}`;
      pendingActionRef.current = { label, big: subtreeCount > 1 };

      // Determine next selected node
      let nextSelectedNodeId = selectedNodeId;
      if (selectedNodeId === nodeId || (selectedNodeId && isDescendant(outline.nodes, selectedNodeId, nodeId))) {
        nextSelectedNodeId = nodeToDelete.parentId;
      }

      const newOutlines = currentOutlines.map(o => {
        if (o.id === currentOutlineId) {
          return {
            ...o,
            nodes: removeNode(o.nodes, nodeId),
          };
        }
        return o;
      });

      // Schedule selection update
      if (nextSelectedNodeId && nextSelectedNodeId !== selectedNodeId) {
        const capturedNextId = nextSelectedNodeId;
        setTimeout(() => {
          setSelectedNodeId(capturedNextId);
        }, 0);
      }

      return newOutlines;
    });
  }, [currentOutlineId, selectedNodeId]);

  // FIXED: handleMoveNode uses functional update pattern
  const handleMoveNode = useCallback((draggedId: string, targetId: string, position: 'before' | 'after' | 'inside') => {
    setOutlines(currentOutlines => {
      return currentOutlines.map(o => {
        if (o.id === currentOutlineId) {
          const newNodes = moveNode(o.nodes, draggedId, targetId, position);
          return newNodes ? { ...o, nodes: newNodes } : o;
        }
        return o;
      });
    });
  }, [currentOutlineId]);

  // FIXED: handleToggleCollapse uses functional update pattern
  const handleToggleCollapse = useCallback((nodeId: string) => {
    setOutlines(currentOutlines => {
      return currentOutlines.map(o => {
        if (o.id === currentOutlineId) {
          const node = o.nodes[nodeId];
          if (!node) return o;
          const newNodes = updateNode(o.nodes, nodeId, { isCollapsed: !node.isCollapsed });
          return { ...o, nodes: newNodes };
        }
        return o;
      });
    });
  }, [currentOutlineId]);

  // Collect all descendant node IDs from a starting node
  const collectDescendantIds = useCallback((nodes: Record<string, OutlineNode>, startId: string): string[] => {
    const ids: string[] = [];
    const queue = [startId];
    while (queue.length > 0) {
      const id = queue.shift()!;
      ids.push(id);
      const node = nodes[id];
      if (node?.childrenIds) {
        queue.push(...node.childrenIds);
      }
    }
    return ids;
  }, []);

  // Recursive Collapse All:
  // - If nodeId provided -> scope is that subtree (from context menu / programmatic).
  // - Else if a node is selected -> scope is the selected subtree.
  // - Else -> scope is the entire current outline (from root).
  // Every chapter descendant within the scope is set to isCollapsed:true.
  // The scope's root node itself is NOT collapsed (otherwise its subtree disappears
  // immediately and the user can't see the result). Only descendants change state.
  const handleCollapseAll = useCallback((nodeId?: string) => {
    setOutlines(currentOutlines => {
      return currentOutlines.map(o => {
        if (o.id === currentOutlineId) {
          const targetId = nodeId ?? selectedNodeId ?? o.rootNodeId;
          if (!targetId || !o.nodes[targetId]) return o;
          const descendantIds = collectDescendantIds(o.nodes, targetId);
          const newNodes = { ...o.nodes };
          for (const id of descendantIds) {
            if (id === targetId) continue; // don't collapse the scope's root itself
            const node = newNodes[id];
            if (node && node.childrenIds.length > 0 && !node.isCollapsed) {
              newNodes[id] = { ...node, isCollapsed: true };
            }
          }
          return { ...o, nodes: newNodes };
        }
        return o;
      });
    });
  }, [currentOutlineId, selectedNodeId, collectDescendantIds]);

  // Recursive Expand All:
  // - Scope rules mirror handleCollapseAll above.
  // - Every descendant within the scope is set to isCollapsed:false (all the way
  //   down to leaves). This is the fix for the "only one level deep" bug.
  const handleExpandAll = useCallback((nodeId?: string) => {
    setOutlines(currentOutlines => {
      return currentOutlines.map(o => {
        if (o.id === currentOutlineId) {
          const targetId = nodeId ?? selectedNodeId ?? o.rootNodeId;
          if (!targetId || !o.nodes[targetId]) return o;
          const descendantIds = collectDescendantIds(o.nodes, targetId);
          const newNodes = { ...o.nodes };
          for (const id of descendantIds) {
            const node = newNodes[id];
            if (node && node.isCollapsed) {
              newNodes[id] = { ...node, isCollapsed: false };
            }
          }
          return { ...o, nodes: newNodes };
        }
        return o;
      });
    });

  }, [currentOutlineId, selectedNodeId, collectDescendantIds]);

  // Reshape the current outline by COLLAPSING non-matching branches.
  // Search is "compress, don't hide": every node remains a visible row in the
  // tree, but everything that isn't a match or an ancestor of a match has its
  // children folded away. The user can chevron-open any branch at any time to
  // explore — search never removes a row, it just reshapes what's expanded.
  //
  // - Matches + ancestors of matches: isCollapsed=false (so their subtrees
  //   render through).
  // - Every other node: isCollapsed=true (its children hide, but it itself
  //   still renders as a row, controlled by its parent's expanded state).
  // - If matchedNodeIds is empty, the tree is left alone (no reshape).
  const handleApplySearchView = useCallback((
    matchedNodeIds: string[],
  ) => {
    if (matchedNodeIds.length === 0) return;

    setOutlines(currentOutlines => {
      return currentOutlines.map(o => {
        if (o.id !== currentOutlineId) return o;

        const matchedSet = new Set(matchedNodeIds);

        // Pass 1: compute the set of ancestor IDs for every match.
        const ancestorSet = new Set<string>();
        for (const matchId of matchedNodeIds) {
          let cur = o.nodes[matchId];
          while (cur && cur.parentId) {
            const parentId = cur.parentId;
            if (ancestorSet.has(parentId)) break; // already walked up from here
            ancestorSet.add(parentId);
            cur = o.nodes[parentId];
          }
        }

        // Pass 2: matches + ancestors get expanded, everything else collapsed.
        // The root is always treated as expanded so its children can render.
        const newNodes = { ...o.nodes };
        let mutated = false;
        for (const id of Object.keys(newNodes)) {
          const node = newNodes[id];
          if (!node) continue;
          const shouldExpand =
            matchedSet.has(id) || ancestorSet.has(id) || id === o.rootNodeId;
          if (shouldExpand) {
            if (node.isCollapsed) {
              newNodes[id] = { ...node, isCollapsed: false };
              mutated = true;
            }
          } else {
            if (!node.isCollapsed && node.childrenIds.length > 0) {
              newNodes[id] = { ...node, isCollapsed: true };
              mutated = true;
            }
          }
        }

        if (!mutated) return o;
        return { ...o, nodes: newNodes };
      });
    });
  }, [currentOutlineId]);

  // Expand specific ancestor nodes (for search results)
  const handleExpandAncestors = useCallback((nodeIds: string[]) => {
    setOutlines(currentOutlines => {
      return currentOutlines.map(o => {
        if (o.id === currentOutlineId) {
          // Check if any nodes actually need expanding before creating new state
          const needsExpand = nodeIds.some(id => o.nodes[id]?.isCollapsed);
          if (!needsExpand) return o;

          const newNodes = { ...o.nodes };
          nodeIds.forEach(nodeId => {
            if (newNodes[nodeId] && newNodes[nodeId].isCollapsed) {
              newNodes[nodeId] = { ...newNodes[nodeId], isCollapsed: false };
            }
          });

          return { ...o, nodes: newNodes };
        }
        return o;
      });
    });
  }, [currentOutlineId]);

  // FIXED: handleCreateOutline uses functional update pattern
  const handleCreateOutline = useCallback((name?: string) => {
    const outlineName = (typeof name === 'string' && name.trim()) ? name.trim() : "Untitled Outline";
    const newRootId = uuidv4();
    const newOutlineId = uuidv4();
    const newOutline: Outline = {
      id: newOutlineId,
      name: outlineName,
      rootNodeId: newRootId,
      nodes: {
        [newRootId]: {
          id: newRootId,
          name: outlineName,
          content: '',
          type: 'root',
          parentId: null,
          childrenIds: [],
          isCollapsed: false,
          prefix: ''
        },
      },
    };

    setOutlines(currentOutlines => [...currentOutlines, newOutline]);
    // These are independent state updates, safe to call after setOutlines
    setCurrentOutlineId(newOutlineId);
    setSelectedNodeId(newRootId);
    // Discovery: surface cross-link + import-export tips the first time
    // a user creates an outline. Dedupe is in the hook.
    fireDiscovery('first-outline-created');
  }, []);

  // Create outline from template
  const handleCreateFromTemplate = useCallback((templateOutline: Outline) => {
    setOutlines(currentOutlines => [...currentOutlines, templateOutline]);
    setCurrentOutlineId(templateOutline.id);
    setSelectedNodeId(templateOutline.rootNodeId);
    // Discovery: template starters are the dominant first-run path, so they
    // should also see the marquee-feature tips. Dedupe is in the hook.
    fireDiscovery('first-outline-created');
    toast({
      title: "Outline Created",
      description: `"${templateOutline.name}" has been created from template.`,
    });
  }, [toast]);

  // ── Natural-language command dispatcher (Cmd+K → Ask AI) ──────────────────
  const resolveNodeHint = useCallback((hint: string | null | undefined): string | null => {
    if ((!hint || !hint.trim())) return selectedNodeId;
    if (!currentOutline) return selectedNodeId;
    const lower = hint.toLowerCase().trim();
    for (const n of Object.values(currentOutline.nodes)) {
      if (n.name.toLowerCase() === lower) return n.id;
    }
    for (const n of Object.values(currentOutline.nodes)) {
      if (n.name.toLowerCase().includes(lower)) return n.id;
    }
    return selectedNodeId;
  }, [currentOutline, selectedNodeId]);

  const executeAICommand = useCallback((cmd: InterpretedCommand) => {
    const a = cmd.action;
    // AI responses stay visible until the user dismisses them via the X button —
    // they're conversational replies, not transient confirmations.
    const AI_PERSIST = 1000 * 60 * 60 * 24; // ~24h, effectively "until dismissed"
    try {
      switch (a.kind) {
        case 'create_outline':
          handleCreateOutline(a.name);
          toast({ title: 'AI command', description: `I created a new outline called "${a.name}".`, duration: AI_PERSIST });
          break;
        case 'create_node': {
          const nodeName = (a.name && a.name.trim()) || 'New Node';
          const added = handleCreateNamedNode(nodeName);
          if (added) {
            toast({ title: 'AI command', description: `Added a node called "${nodeName}".`, duration: AI_PERSIST });
          } else {
            toast({ title: "I'm not sure", description: `I wanted to add a node called "${nodeName}", but I couldn't find an open outline to put it in. Open or create an outline first and I'll add it right away.`, duration: AI_PERSIST });
          }
          break;
        }
        case 'collapse_all':
          handleCollapseAll();
          toast({ title: 'AI command', description: 'I collapsed the whole tree for you.', duration: AI_PERSIST });
          break;
        case 'expand_all':
          handleExpandAll();
          toast({ title: 'AI command', description: 'I expanded the whole tree for you.', duration: AI_PERSIST });
          break;
        case 'open_live_books':
          setIsLiveBooksOpen(true);
          toast({ title: 'AI command', description: 'Opening Refresh from Web now.', duration: AI_PERSIST });
          break;
        case 'open_templates':
          setIsTemplatesDialogOpen(true);
          toast({ title: 'AI command', description: 'Opening the template picker.', duration: AI_PERSIST });
          break;
        case 'open_search':
          setIsSearchOpen(true);
          toast({ title: 'AI command', description: 'Opening search.', duration: AI_PERSIST });
          break;
        case 'open_help_chat':
          setIsHelpChatOpen(true);
          toast({ title: 'AI command', description: 'Opening the help chat.', duration: AI_PERSIST });
          break;
        case 'open_knowledge_chat':
          setIsKnowledgeChatOpen(true);
          toast({ title: 'AI command', description: 'Opening the knowledge chat.', duration: AI_PERSIST });
          break;
        case 'delete_node': {
          const id = resolveNodeHint(a.node_hint);
          if (!id) {
            toast({ title: "I'm not sure", description: `I couldn't find an item matching "${a.node_hint}". Want to try the exact name, or use the outline to point at it?`, duration: AI_PERSIST });
            break;
          }
          handleDeleteNode(id);
          toast({ title: 'AI command', description: 'I deleted that item for you.', duration: AI_PERSIST });
          break;
        }
        case 'unknown':
          toast({ title: "I'm not sure", description: a.reason, duration: AI_PERSIST });
          break;
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : '';
      toast({
        title: 'AI command',
        description: detail
          ? `I tried to do that, but something went wrong on my end (${detail}). Mind trying again?`
          : 'I tried to do that, but something went wrong on my end. Mind trying again?',
        duration: AI_PERSIST,
      });
    } finally {
      setPendingAICommand(null);
    }
  }, [handleCreateOutline, handleCreateNamedNode, handleCollapseAll, handleExpandAll, handleDeleteNode, resolveNodeHint, toast]);

  const handleAICommand = useCallback(async (text: string) => {
    // Tier-enforcement gate (#33): one Tell-AI / NL-command submission =
    // one generation. If the gate hard-blocks (or Pro-only), bail before
    // we even send the prompt off to the interpreter.
    if (!aiUsageGate({ feature: 'tellAI' })) return;
    try {
      const cmd = await interpretCommandAction({
        text,
        current_outline_name: currentOutline?.name,
        selected_node_name: selectedNodeId && currentOutline ? currentOutline.nodes[selectedNodeId]?.name : undefined,
        userApiKey: typeof window !== 'undefined' ? localStorage.getItem('apiKey_gemini') : null,
      });
      const reqRaw = typeof window !== 'undefined' ? localStorage.getItem('requireDestructiveConfirmation') : null;
      const requireConfirm = reqRaw === null ? true : reqRaw === 'true';
      if (cmd.destructive && requireConfirm) {
        setPendingAICommand(cmd);
        return;
      }
      executeAICommand(cmd);
    } catch (err) {
      const detail = err instanceof Error ? err.message : '';
      toast({
        title: 'AI command',
        description: detail
          ? `Something went wrong on my end (${detail}). Mind trying again?`
          : 'Something went wrong on my end. Mind trying again?',
        duration: 1000 * 60 * 60 * 24, // persist until dismissed
      });
    }
  }, [currentOutline, selectedNodeId, executeAICommand, toast, aiUsageGate]);


  // Open the User Guide
  const handleOpenGuide = useCallback(() => {
    const guide = outlines.find(o => o.isGuide);
    if (guide) {
      setCurrentOutlineId(guide.id);
      setSelectedNodeId(guide.rootNodeId);
    }
  }, [outlines]);

  // Show Welcome outline (creates a new one if needed)
  const handleShowWelcome = useCallback(() => {
    // Check if a welcome outline already exists
    const existingWelcome = outlines.find(o => o.name === 'Welcome to IdiamPro!');
    if (existingWelcome) {
      setCurrentOutlineId(existingWelcome.id);
      setSelectedNodeId(existingWelcome.rootNodeId);
    } else {
      // Create a fresh welcome outline
      const welcomeOutline = getWelcomeOutline();
      setOutlines(prev => [...prev, welcomeOutline]);
      setCurrentOutlineId(welcomeOutline.id);
      setSelectedNodeId(welcomeOutline.rootNodeId);
    }
  }, [outlines, setOutlines]);

  // Handle folder selection: migrate to file system and reload
  const handleFolderSelected = useCallback(async () => {
    try {
      // Conflict resolver that shows a dialog and waits for user choice
      const conflictResolver = async (conflict: MigrationConflict): Promise<ConflictResolution> => {
        return new Promise((resolve) => {
          setConflictDialog({
            open: true,
            conflict,
            resolve,
          });
        });
      };

      // Migrate localStorage data to file system with conflict resolution
      await migrateToFileSystem(conflictResolver);

      // Reload outlines from file system
      const guide = getInitialGuide();
      const { outlines: userOutlines, currentOutlineId: loadedCurrentOutlineId } = await loadStorageData();
      const validOutlines = userOutlines.filter(o => o && isValidOutline(o));
      const loadedOutlines = [guide, ...validOutlines];

      setOutlinesFromDisk(loadedOutlines);

      const outlineToLoad = loadedOutlines.find(o => o.id === loadedCurrentOutlineId) || validOutlines[0] || guide;
      setCurrentOutlineId(outlineToLoad.id);
      setSelectedNodeId(outlineToLoad.rootNodeId || null);

      toast({
        title: 'File Storage Enabled',
        description: 'Your outlines are now being saved as .idm files in the selected folder.',
      });
    } catch (error) {
      console.error('Failed to migrate to file system:', error);
      toast({
        variant: 'destructive',
        title: 'Migration Failed',
        description: 'Could not migrate outlines to file system. Using browser storage.',
      });
    }
  }, [toast]);

  // FIXED: handleRenameOutline uses functional update pattern
  const handleRenameOutline = useCallback((outlineId: string, newName: string) => {
    setOutlines(currentOutlines => {
      return currentOutlines.map(o => {
        if (o.id === outlineId && !o.isGuide) {
          const newNodes = { ...o.nodes };
          const rootNode = { ...newNodes[o.rootNodeId], name: newName };
          newNodes[o.rootNodeId] = rootNode;
          return { ...o, name: newName, nodes: newNodes };
        }
        return o;
      });
    });
  }, []);

  // FIXED: handleDeleteOutline - deletes file FIRST, then updates state
  // This prevents race conditions where auto-save might recreate the file
  const handleDeleteOutline = useCallback(async (outlineId?: string) => {
    const idToDelete = outlineId || currentOutlineId;

    // Find the outline to delete from current state
    const outlineToDelete = outlines.find(o => o.id === idToDelete);
    if (!outlineToDelete || outlineToDelete.isGuide) return;

    // IMPORTANT: Delete file from disk FIRST, before updating state
    // This prevents auto-save from recreating the file
    try {
      await deleteOutline(outlineToDelete);
      console.log('Successfully deleted outline file:', outlineToDelete.name);
    } catch (error) {
      console.error('Failed to delete outline file:', error);
      // Still proceed with removing from state even if file delete fails
    }

    // Now update state (which will trigger auto-save, but file is already gone)
    setOutlines(currentOutlines => {
      const nextOutlines = currentOutlines.filter(o => o.id !== idToDelete);
      return nextOutlines;
    });

    // Update selection if we deleted the current outline
    if (idToDelete === currentOutlineId) {
      const remainingOutlines = outlines.filter(o => o.id !== idToDelete);
      const nextOutlineToSelect = remainingOutlines.find(o => !o.isGuide) || remainingOutlines.find(o => o.isGuide);

      if (nextOutlineToSelect) {
        setCurrentOutlineId(nextOutlineToSelect.id);
        setSelectedNodeId(nextOutlineToSelect.rootNodeId);
      } else {
        // No outlines left, create a new one
        handleCreateOutline();
      }
    }
  }, [currentOutlineId, outlines, handleCreateOutline]);

  // Save sidebar width to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('idiampro-sidebar-width', sidebarWidth.toString());
    }
  }, [sidebarWidth]);

  // Handle sidebar resize drag
  const handleSidebarMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingSidebar.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingSidebar.current) return;
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.min(400, Math.max(180, startWidth + delta));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      isResizingSidebar.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [sidebarWidth]);

  // FIXED: handleSelectOutline uses functional update to read fresh state
  // Now also handles lazy-loaded outlines - loads progressively with visual feedback
  const handleSelectOutline = useCallback(async (outlineId: string) => {
    // Get the outline from current state
    const outlineToSelect = outlines.find(o => o.id === outlineId) as LazyOutline | undefined;

    if (!outlineToSelect) {
      return;
    }

    // Check if this is a lazy-loaded outline that needs to be fully loaded
    if (outlineToSelect._isLazyLoaded && outlineToSelect._fileName) {
      console.log(`Loading lazy outline: ${outlineToSelect._fileName}`);

      // Format file size for display
      const fileSizeBytes = outlineToSelect._fileSize || 0;
      const fileSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(1);
      const fileSizeDisplay = fileSizeBytes > 1024 * 1024
        ? `${fileSizeMB} MB`
        : `${(fileSizeBytes / 1024).toFixed(0)} KB`;

      // Show loading dialog - phase 1: reading from disk
      console.log('[Progress] Setting loading state - phase: reading');
      setLoadingOutlineInfo({
        name: outlineToSelect.name,
        fileSize: fileSizeDisplay,
        estimatedNodes: outlineToSelect._estimatedNodeCount || 0,
        phase: 'reading',
      });
      setIsLoadingLazyOutline(true);
      // Yield to allow React to render the loading state before async work
      await new Promise(resolve => setTimeout(resolve, 0));
      console.log('[Progress] isLoadingLazyOutline set to true');

      try {
        const fullOutline = await loadSingleOutlineOnDemand(outlineToSelect._fileName);

        if (fullOutline) {
          const totalNodes = Object.keys(fullOutline.nodes).length;
          const PROGRESSIVE_THRESHOLD = 5000; // Only progressive load for large outlines

          if (totalNodes > PROGRESSIVE_THRESHOLD) {
            // Progressive loading: show outline growing level by level
            console.log(`[Progressive] Loading ${totalNodes} nodes progressively`);

            // Calculate depth levels
            const nodesByLevel: Map<number, string[]> = new Map();
            const nodeDepths: Map<string, number> = new Map();

            // BFS to assign levels
            const queue: { nodeId: string; depth: number }[] = [{ nodeId: fullOutline.rootNodeId, depth: 0 }];
            while (queue.length > 0) {
              const { nodeId, depth } = queue.shift()!;
              if (nodeDepths.has(nodeId)) continue;
              nodeDepths.set(nodeId, depth);

              if (!nodesByLevel.has(depth)) {
                nodesByLevel.set(depth, []);
              }
              nodesByLevel.get(depth)!.push(nodeId);

              const node = fullOutline.nodes[nodeId];
              if (node?.childrenIds) {
                for (const childId of node.childrenIds) {
                  if (!nodeDepths.has(childId)) {
                    queue.push({ nodeId: childId, depth: depth + 1 });
                  }
                }
              }
            }

            const maxDepth = Math.max(...nodesByLevel.keys());
            console.log(`[Progressive] Found ${maxDepth + 1} levels`);

            // Update phase to rendering
            setLoadingOutlineInfo(prev => prev ? {
              ...prev,
              phase: 'rendering',
              totalLevels: maxDepth + 1,
              totalNodes: totalNodes,
              currentLevel: 0,
              nodesLoaded: 0,
            } : null);

            // Start with empty outline structure
            let currentNodes: typeof fullOutline.nodes = {};
            let nodesLoaded = 0;

            // Progressively add levels
            for (let level = 0; level <= maxDepth; level++) {
              const levelNodeIds = nodesByLevel.get(level) || [];

              // Add nodes at this level
              for (const nodeId of levelNodeIds) {
                const node = fullOutline.nodes[nodeId];
                if (node) {
                  // Collapse nodes at level 2+ for better visual
                  currentNodes[nodeId] = { ...node, isCollapsed: level >= 2 };
                  nodesLoaded++;
                }
              }

              // Update state to show progress
              const outlineSnapshot = { ...fullOutline, nodes: { ...currentNodes } };

              // Update progress info
              setLoadingOutlineInfo(prev => prev ? {
                ...prev,
                currentLevel: level + 1,
                nodesLoaded: nodesLoaded,
              } : null);

              // Update the outline in state (loaded from disk, not dirty)
              setOutlinesFromDisk(currentOutlines => {
                return currentOutlines.map(o =>
                  o.id === outlineId ? outlineSnapshot : o
                );
              });

              // Set current outline and selection on first level
              if (level === 0) {
                setCurrentOutlineId(outlineId);
                setSelectedNodeId(fullOutline.rootNodeId);
              }

              // Small delay between levels to show progress visually
              // Shorter delays for deeper levels (they have fewer nodes typically)
              const delay = level < 3 ? 100 : 50;
              await new Promise(resolve => setTimeout(resolve, delay));
            }

            // Recalculate prefixes to ensure proper numbering
            recalculatePrefixesForBranch(currentNodes, fullOutline.rootNodeId);

            // Final update with recalculated prefixes (loaded from disk, not dirty)
            const finalOutline = { ...fullOutline, nodes: { ...currentNodes } };
            setOutlinesFromDisk(currentOutlines => {
              return currentOutlines.map(o =>
                o.id === outlineId ? finalOutline : o
              );
            });

            // Show completion in the progress indicator
            setLoadingOutlineInfo(prev => prev ? {
              ...prev,
              phase: 'complete',
              nodesLoaded: totalNodes,
            } : null);

            // Keep the completion message visible briefly
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Record mtime after lazy load
            lastKnownMtimeRef.current.set(outlineId, Date.now());
          } else {
            // Small outline - load directly (loaded from disk, not dirty)
            setOutlinesFromDisk(currentOutlines => {
              return currentOutlines.map(o =>
                o.id === outlineId ? fullOutline : o
              );
            });
            setCurrentOutlineId(outlineId);
            setSelectedNodeId(fullOutline.rootNodeId);
            // Record mtime after lazy load
            lastKnownMtimeRef.current.set(outlineId, Date.now());
          }
        } else {
          toast({
            variant: 'destructive',
            title: 'Failed to Load Outline',
            description: 'Could not load the outline file.',
          });
        }
      } catch (error) {
        console.error('Error loading lazy outline:', error);
        toast({
          variant: 'destructive',
          title: 'Error Loading Outline',
          description: (error as Error).message || 'An error occurred.',
        });
      } finally {
        setIsLoadingLazyOutline(false);
        setLoadingOutlineInfo(null);
      }
    } else {
      // Not lazy-loaded — check if the file was modified externally before selecting
      if (isElectron() && (outlineToSelect as LazyOutline)._fileName && !outlineToSelect.isGuide) {
        try {
          const diskMtime = await electronGetOutlineMtime(outlineToSelect);
          const lastKnown = lastKnownMtimeRef.current.get(outlineId);

          if (diskMtime && lastKnown && diskMtime > lastKnown + 1000) {
            // File was modified externally — reload from disk
            console.log(`[Mtime] External change detected for ${outlineToSelect.name} (disk: ${diskMtime}, known: ${lastKnown})`);
            const fileName = (outlineToSelect as LazyOutline)._fileName!;
            const freshOutline = await loadSingleOutlineOnDemand(fileName);
            if (freshOutline) {
              setOutlinesFromDisk(currentOutlines =>
                currentOutlines.map(o => o.id === outlineId ? freshOutline : o)
              );
              lastKnownMtimeRef.current.set(outlineId, diskMtime);
              setCurrentOutlineId(outlineId);
              setSelectedNodeId(freshOutline.rootNodeId);
              toast({
                title: 'Outline Reloaded',
                description: `"${outlineToSelect.name}" was modified externally and has been refreshed.`,
              });
              return;
            }
          }
        } catch (error) {
          console.error('[Mtime] Error checking file mtime:', error);
        }
      }
      // Normal selection (no external changes or not in Electron)
      setCurrentOutlineId(outlineId);
      setSelectedNodeId(outlineToSelect.rootNodeId);
    }
  }, [outlines, toast, setOutlinesFromDisk]);

  // Wire handleSelectOutline into the forward-reference ref that
  // handleSelectNode uses for outline-link navigation.
  useEffect(() => {
    handleSelectOutlineRef.current = handleSelectOutline;
  }, [handleSelectOutline]);

  // Insert a cross-outline link node (Phase 1, 2026-06-04). The new node is
  // inserted as a child of the currently-selected node (or, if no node is
  // selected, as a top-level child of the current outline's root). Its name
  // defaults to the linked outline's name; the user can rename freely.
  const handleInsertOutlineLink = useCallback((targetOutlineId: string, targetOutlineName: string) => {
    if (!currentOutlineId) return;
    setOutlines(currentOutlines => {
      const outline = currentOutlines.find(o => o.id === currentOutlineId);
      if (!outline || outline.isGuide) return currentOutlines;
      const parentId = (selectedNodeId && outline.nodes[selectedNodeId])
        ? selectedNodeId
        : outline.rootNodeId;
      const { newNodes, newNodeId } = addNode(
        outline.nodes,
        parentId,
        'outline-link',
        targetOutlineName,
        '',
      );
      if (!newNodeId) return currentOutlines;
      // Attach the link target on the freshly-created node.
      const linkedNode = newNodes[newNodeId];
      if (linkedNode) {
        newNodes[newNodeId] = { ...linkedNode, linkedOutlineId: targetOutlineId };
      }
      // Select the new node so it's visible right away.
      setTimeout(() => setSelectedNodeId(newNodeId), 0);
      return currentOutlines.map(o =>
        o.id === currentOutlineId ? { ...o, nodes: newNodes } : o
      );
    });
  }, [currentOutlineId, selectedNodeId]);

  // Copy the current outline (useful for copying the User Guide)
  const handleCopyOutline = useCallback(() => {
    setOutlines(currentOutlines => {
      const outlineToCopy = currentOutlines.find(o => o.id === currentOutlineId);
      if (!outlineToCopy) return currentOutlines;

      // Deep copy the outline with new IDs
      const newOutlineId = uuidv4();
      const idMap: Record<string, string> = {};

      // Create new IDs for all nodes
      Object.keys(outlineToCopy.nodes).forEach(oldId => {
        idMap[oldId] = uuidv4();
      });

      // Copy nodes with new IDs and updated references
      const newNodes: NodeMap = {};
      Object.entries(outlineToCopy.nodes).forEach(([oldId, node]) => {
        const newId = idMap[oldId];
        newNodes[newId] = {
          ...node,
          id: newId,
          parentId: node.parentId ? idMap[node.parentId] : null,
          childrenIds: node.childrenIds.map(cId => idMap[cId]),
        };
      });

      const newRootNodeId = idMap[outlineToCopy.rootNodeId];
      const copyName = outlineToCopy.isGuide
        ? 'My Guide'
        : `${outlineToCopy.name} (Copy)`;

      // Update root node name to match
      if (newNodes[newRootNodeId]) {
        newNodes[newRootNodeId].name = copyName;
      }

      const newOutline: Outline = {
        id: newOutlineId,
        name: copyName,
        rootNodeId: newRootNodeId,
        nodes: newNodes,
        isGuide: false, // Copy is never a guide
        lastModified: Date.now(),
      };

      // Schedule switching to the new outline
      setTimeout(() => {
        setCurrentOutlineId(newOutlineId);
        setSelectedNodeId(newRootNodeId);
        toast({
          title: 'Outline Copied',
          description: `Created "${copyName}" from the original outline.`,
        });
      }, 0);

      return [...currentOutlines, newOutline];
    });
  }, [currentOutlineId, toast]);

  // Cancel any running AI operation and restore UI to ready state
  const handleCancelAI = useCallback(() => {
    aiCancelledRef.current = true;
    setIsLoadingAI(false);
    aiLoadingStartTime.current = null;
    toast({
      title: 'Operation Cancelled',
      description: 'AI operation was stopped. Any work completed so far has been kept.',
    });
  }, [toast]);

  // AI Consent gate - checks localStorage, shows dialog if not consented
  const checkAiConsent = useCallback((action: () => void): boolean => {
    const consent = localStorage.getItem('aiDataConsent');
    if (consent === 'granted') {
      return true; // proceed
    }
    // Store the pending action and show consent dialog
    pendingAiAction.current = action;
    setAiConsentDialogOpen(true);
    return false; // don't proceed yet
  }, []);

  const handleAiConsentGranted = useCallback(() => {
    localStorage.setItem('aiDataConsent', 'granted');
    setAiConsentDialogOpen(false);
    toast({ title: 'AI Consent Granted', description: 'AI features are now enabled. You can revoke this in Settings.' });
    // Run the pending action
    if (pendingAiAction.current) {
      const action = pendingAiAction.current;
      pendingAiAction.current = null;
      action();
    }
  }, [toast]);

  const handleAiConsentDeclined = useCallback(() => {
    setAiConsentDialogOpen(false);
    pendingAiAction.current = null;
    toast({ title: 'AI Features Disabled', description: 'You can enable AI features later in Settings.' });
  }, [toast]);

  // Generate a subtree from a topic and insert it as children of the selected node
  const handleGenerateOutline = useCallback(async (topic: string, depth: AIDepth = 'standard', tone: AITone = 'professional', level: AILevel = 'college') => {
    if (!checkAiConsent(() => handleGenerateOutline(topic, depth, tone, level))) return;
    if (!selectedNodeId || !currentOutlineId) return;
    // Tier-enforcement gate (#33): one generate-outline submission = one gen.
    if (!aiUsageGate({ feature: 'generateOutline' })) return;
    // Phase 3 quota/cloud gate (no-op when enforcement inactive; local/BYOK exempt)
    if (!ensureAIQuota('outlineGeneration')) return;

    const parentId = selectedNodeId;
    aiCancelledRef.current = false;
    setIsLoadingAI(true);
    aiLoadingStartTime.current = Date.now();
    try {
      const markdown = await generateOutlineAction(topic, depth, tone, level, getUserApiKey('gemini'));
      // Count this successful hosted call (no-op for local/BYOK & when off)
      recordAIUsage('outlineGeneration');
      const { rootNodeId: generatedRootId, nodes: generatedNodes } = parseMarkdownToNodes(markdown, topic);

      // Remap all generated node IDs to fresh UUIDs
      const idMapping: Record<string, string> = {};
      Object.keys(generatedNodes).forEach(oldId => {
        idMapping[oldId] = uuidv4();
      });

      setOutlines(currentOutlines => {
        return currentOutlines.map(o => {
          if (o.id !== currentOutlineId) return o;

          const newNodes = { ...o.nodes };

          // The generated root's children become direct children of the selected node
          const generatedRoot = generatedNodes[generatedRootId];
          const topLevelChildIds = generatedRoot.childrenIds;

          // Clone all generated nodes (except the generated root itself) with new IDs
          Object.entries(generatedNodes).forEach(([oldId, node]) => {
            if (oldId === generatedRootId) return; // skip the generated root
            const newId = idMapping[oldId];
            const isTopLevel = topLevelChildIds.includes(oldId);
            newNodes[newId] = {
              ...node,
              id: newId,
              parentId: isTopLevel ? parentId : idMapping[node.parentId] || parentId,
              childrenIds: node.childrenIds.map(cid => idMapping[cid] || cid),
            };
          });

          // Add the top-level generated children to the selected node
          const parentNode = newNodes[parentId];
          const newChildIds = topLevelChildIds.map(id => idMapping[id]);
          newNodes[parentId] = {
            ...parentNode,
            childrenIds: [...parentNode.childrenIds, ...newChildIds],
            isCollapsed: false, // expand to show new children
          };

          return { ...o, nodes: newNodes };
        });
      });

      toast({
        title: "Branch Generated",
        description: `AI-generated branch for "${topic}" added under the selected item.`,
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Couldn't generate that",
        description: (e as Error).message || "Could not generate branch.",
      });
    } finally {
      setIsLoadingAI(false);
      aiLoadingStartTime.current = null;
    }
  }, [toast, selectedNodeId, currentOutlineId, ensureAIQuota, aiUsageGate]);

  // FIXED: handleExpandContent uses functional update pattern (legacy)
  const handleExpandContent = useCallback(async () => {
    if (!selectedNode) return;
    if (!checkAiConsent(() => handleExpandContent())) return;
    // Tier-enforcement gate (#33): one content expansion = one generation.
    if (!aiUsageGate({ feature: 'expandContent' })) return;
    // Phase 3 quota/cloud gate (no-op when enforcement inactive; local/BYOK exempt)
    if (!ensureAIQuota('contentExpansion')) return;

    // Capture the node ID before the async operation
    const nodeIdToUpdate = selectedNode.id;

    aiCancelledRef.current = false;
    setIsLoadingAI(true);
    aiLoadingStartTime.current = Date.now();
    try {
      const content = await expandContentAction(selectedNode.name);
      // Count this successful hosted call (no-op for local/BYOK & when off)
      recordAIUsage('contentExpansion');

      // Use functional update to ensure we're updating the latest state
      setOutlines(currentOutlines => {
        return currentOutlines.map(o => {
          if (o.id === currentOutlineId) {
            const existingNode = o.nodes[nodeIdToUpdate];
            if (!existingNode) return o;

            const newContent = existingNode.content
              ? `${existingNode.content}\n\n${content}`
              : content;

            const updatedNode = { ...existingNode, content: newContent };
            const newNodes = { ...o.nodes, [nodeIdToUpdate]: updatedNode };
            return { ...o, nodes: newNodes };
          }
          return o;
        });
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Couldn't expand this note",
        description: (e as Error).message || "Could not expand content.",
      });
    } finally {
      setIsLoadingAI(false);
      aiLoadingStartTime.current = null;
    }
  }, [selectedNode, currentOutlineId, toast, plan, ensureAIQuota, aiUsageGate]);

  // Enhanced content generation with context - returns generated content
  const handleGenerateContentForNode = useCallback(async (context: NodeGenerationContext): Promise<string> => {
    try {
      const content = await generateContentForNodeAction(context);
      return content;
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Couldn't generate content",
        description: (e as Error).message || "Could not generate content.",
      });
      throw e;
    }
  }, [plan, toast]);

  // Helper to build ancestor path for a node
  const getAncestorPath = useCallback((nodes: NodeMap, nodeId: string): string[] => {
    const path: string[] = [];
    let currentNode = nodes[nodeId];
    while (currentNode && currentNode.parentId) {
      const parent = nodes[currentNode.parentId];
      if (parent) {
        path.unshift(parent.name);
        currentNode = parent;
      } else {
        break;
      }
    }
    return path;
  }, []);

  // Generate content for all children of a node
  const handleGenerateContentForChildren = useCallback(async (parentNodeId: string) => {
    if (!currentOutline) return;
    if (!checkAiConsent(() => handleGenerateContentForChildren(parentNodeId))) return;

    // Tier-enforcement gate (#33): one "Create Content for Descendants"
    // action = one generation, regardless of how many descendants get filled.
    if (!aiUsageGate({ feature: 'createContentForDescendants' })) return;

    const nodes = currentOutline.nodes;
    const parentNode = nodes[parentNodeId];
    if (!parentNode || !parentNode.childrenIds || parentNode.childrenIds.length === 0) {
      toast({
        title: "No Descendants",
        description: "This item has no descendants to generate content for.",
      });
      return;
    }

    // Helper function to collect all descendant IDs recursively
    const collectAllDescendants = (nodeId: string): string[] => {
      const node = nodes[nodeId];
      if (!node || !node.childrenIds || node.childrenIds.length === 0) {
        return [];
      }
      const descendants: string[] = [];
      for (const childId of node.childrenIds) {
        descendants.push(childId);
        descendants.push(...collectAllDescendants(childId));
      }
      return descendants;
    };

    const allDescendantIds = collectAllDescendants(parentNodeId);
    const totalDescendants = allDescendantIds.length;

    if (totalDescendants === 0) {
      toast({
        title: "No Descendants",
        description: "This item has no descendants to generate content for.",
      });
      return;
    }

    aiCancelledRef.current = false;
    setIsLoadingAI(true);
    aiLoadingStartTime.current = Date.now();

    // Premium users get faster generation (higher rate limits)
    const isPremium = plan === 'PREMIUM';
    const delayMs = isPremium ? 1000 : 6500; // Premium: 1s, Free: 6.5s
    const errorDelayMs = isPremium ? 2000 : 10000; // Premium: 2s, Free: 10s

    const estimatedSeconds = totalDescendants * (delayMs / 1000);
    const estimatedMinutes = Math.ceil(estimatedSeconds / 60);

    toast({
      title: "Generating Content",
      description: isPremium
        ? `Creating content for ${totalDescendants} descendants (~${estimatedMinutes} min)...`
        : `Creating content for ${totalDescendants} descendants (~${estimatedMinutes} min due to API limits)...`,
    });

    let successCount = 0;
    let errorCount = 0;

    // Helper to delay between requests
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Process descendants sequentially with rate limiting
    for (let i = 0; i < allDescendantIds.length; i++) {
      // Check if user cancelled
      if (aiCancelledRef.current) break;

      const descendantId = allDescendantIds[i];
      const descendantNode = nodes[descendantId];
      if (!descendantNode) continue;

      try {
        const ancestorPath = getAncestorPath(nodes, descendantId);
        const context: NodeGenerationContext = {
          nodeId: descendantId,
          nodeName: descendantNode.name,
          ancestorPath,
          existingContent: descendantNode.content || '',
        };

        const generatedContent = await generateContentForNodeAction(context);

        // Update the node - APPEND new content after existing content
        setOutlines(currentOutlines => {
          return currentOutlines.map(o => {
            if (o.id === currentOutlineId) {
              const existingContent = o.nodes[descendantId]?.content || '';
              // Only append if there's existing content, otherwise just use generated
              const newContent = existingContent.trim()
                ? existingContent + '<hr class="my-4"/>' + generatedContent
                : generatedContent;
              return {
                ...o,
                lastModified: Date.now(),
                nodes: {
                  ...o.nodes,
                  [descendantId]: {
                    ...o.nodes[descendantId],
                    content: newContent,
                  },
                },
              };
            }
            return o;
          });
        });

        successCount++;

        // Rate limit delay - skip on last item
        if (i < allDescendantIds.length - 1) {
          await delay(delayMs);
        }
      } catch (e) {
        console.error(`Failed to generate content for ${descendantNode.name}:`, e);
        errorCount++;

        // On rate limit error, wait longer before next attempt
        if (i < allDescendantIds.length - 1) {
          await delay(errorDelayMs);
        }
      }
    }

    // Also generate a subtree diagram for the parent node (using flowchart - more reliable)
    try {
      const mindmapCode = generateFlowchartFromSubtree(parentNode, nodes);
      const escapedCode = mindmapCode
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      const diagramHtml = `<div data-mermaid-block data-mermaid-code="${escapedCode}"></div>`;

      // Add the diagram to the parent node's content
      setOutlines(currentOutlines => {
        return currentOutlines.map(o => {
          if (o.id === currentOutlineId) {
            const currentParentContent = o.nodes[parentNodeId]?.content || '';
            return {
              ...o,
              lastModified: Date.now(),
              nodes: {
                ...o.nodes,
                [parentNodeId]: {
                  ...o.nodes[parentNodeId],
                  content: diagramHtml + '<p></p>' + currentParentContent,
                },
              },
            };
          }
          return o;
        });
      });
    } catch (e) {
      console.error('Failed to generate subtree diagram:', e);
    }

    // If cancelled, the cancel handler already cleaned up — just show summary
    if (aiCancelledRef.current) {
      if (successCount > 0) {
        toast({
          title: "Cancelled",
          description: `Stopped after generating ${successCount} of ${totalDescendants} descendants. Completed work was kept.`,
        });
      }
      return;
    }

    setIsLoadingAI(false);
    aiLoadingStartTime.current = null;

    if (errorCount === 0) {
      if (isPremium) {
        toast({
          title: "Content Generated",
          description: `Successfully created content for ${successCount} descendant${successCount > 1 ? 's' : ''}, with branch diagram.`,
        });
      } else {
        // Show premium upsell for free users
        toast({
          title: "Content Generated",
          description: `Created content for ${successCount} descendant${successCount > 1 ? 's' : ''}. Upgrade to Premium for 6x faster generation!`,
          duration: 8000,
        });
      }
    } else {
      toast({
        variant: "destructive",
        title: "Partial Success",
        description: `Generated ${successCount} of ${totalDescendants} descendants. ${errorCount} failed.`,
      });
    }
  }, [currentOutline, currentOutlineId, getAncestorPath, plan, toast, aiUsageGate]);

  // Apply ingest preview - creates nodes from preview
  const handleApplyIngestPreview = useCallback(async (preview: IngestPreview): Promise<void> => {
    if (preview.nodesToAdd.length === 0) {
      toast({
        title: "No Changes",
        description: "No new items to add.",
      });
      return;
    }

    // Create new nodes from preview
    setOutlines(currentOutlines => {
      return currentOutlines.map(o => {
        if (o.id === currentOutlineId) {
          const newNodes = { ...o.nodes };
          const rootId = o.rootNodeId;

          // Add each node from preview as children of root
          preview.nodesToAdd.forEach((previewNode) => {
            const newNodeId = uuidv4();
            const newNode: OutlineNode = {
              id: newNodeId,
              name: previewNode.name,
              content: previewNode.content || '',
              type: 'document',
              parentId: rootId,
              childrenIds: [],
              isCollapsed: false,
              prefix: '',
            };

            newNodes[newNodeId] = newNode;

            // Add to root's children
            const root = { ...newNodes[rootId] };
            root.childrenIds = [...root.childrenIds, newNodeId];
            if (root.type === 'root' || root.childrenIds.length > 0) {
              // Keep as root or convert to chapter
            }
            newNodes[rootId] = root;
          });

          return { ...o, nodes: newNodes };
        }
        return o;
      });
    });

    toast({
      title: "Content Added",
      description: `Added ${preview.nodesToAdd.length} new items to your outline.`,
    });
  }, [currentOutlineId, toast]);

  // Ingest external source - auto-applies for MVP
  const handleIngestSource = useCallback(async (source: ExternalSourceInput): Promise<void> => {
    if (!checkAiConsent(() => handleIngestSource(source))) return;
    // Build full outline structure for intelligent merging
    const outlineSummary = currentOutline
      ? `Outline: ${currentOutline.name}\n\nCurrent structure:\n${buildOutlineTreeString(currentOutline.nodes, currentOutline.rootNodeId)}`
      : undefined;

    aiCancelledRef.current = false;
    setIsLoadingAI(true);
    aiLoadingStartTime.current = Date.now();
    try {
      const preview = await ingestExternalSourceAction(source, outlineSummary);

      // For MVP, auto-apply the preview
      await handleApplyIngestPreview(preview);

      toast({
        title: "Content Imported",
        description: preview.summary,
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Import Error",
        description: (e as Error).message || "Could not process external source.",
      });
      throw e;
    } finally {
      setIsLoadingAI(false);
      aiLoadingStartTime.current = null;
    }
  }, [currentOutline, handleApplyIngestPreview, toast]);

  // Unmerge: restore the pre-merge snapshot and delete the persisted backup
  const handleUnmerge = useCallback(() => {
    const snapshot = preMergeSnapshotRef.current;
    if (snapshot) {
      setOutlines(prev => prev.map(o => o.id === snapshot.id ? snapshot : o));
      preMergeSnapshotRef.current = null;
      setHasUnmergeBackup(false);
      deleteUnmergeBackup().catch(err =>
        console.error('[Unmerge] Failed to delete backup:', err)
      );
      toast({ title: "Merge Reverted", description: "Outline restored to its pre-merge state." });
    }
  }, [setOutlines, toast]);

  // Bulk Research Import (PREMIUM) - Synthesizes multiple sources
  const handleBulkResearch = useCallback(async (input: BulkResearchSources): Promise<void> => {
    if (!checkAiConsent(() => handleBulkResearch(input))) {
      // Surface this to the calling dialog so it stays open with a visible
      // error, instead of silently closing as if the synthesis succeeded.
      // The original silent-return left iOS Safari users in particular
      // confused — the consent dialog opens behind the closed Research
      // dialog and looks like the synthesis just disappeared.
      throw new Error('AI_CONSENT_REQUIRED');
    }
    aiCancelledRef.current = false;
    setIsLoadingAI(true);
    aiLoadingStartTime.current = Date.now();
    try {
      // Build content from existing outline if requested
      let existingContent: string | undefined;
      if (input.includeExistingContent && currentOutline) {
        // Extract all node names and content for context
        // Skip embedded media (base64 images, etc.) and limit content size
        const contentParts: string[] = [];
        const maxNodeContentLength = 2000; // Skip nodes with huge content (likely embedded media)
        const maxTotalLength = 15000; // Cap total existing content
        let totalLength = 0;

        Object.values(currentOutline.nodes).forEach(node => {
          if (node.type !== 'root' && totalLength < maxTotalLength) {
            let nodeContent = node.content || '';

            // Skip base64 data (embedded images/media)
            if (nodeContent.includes('data:image') || nodeContent.includes('data:video') || nodeContent.includes('data:audio')) {
              nodeContent = '[media content]';
            }

            // Skip excessively long content (likely transcripts or embedded data)
            if (nodeContent.length > maxNodeContentLength) {
              nodeContent = nodeContent.substring(0, maxNodeContentLength) + '...';
            }

            const part = `${node.name}${nodeContent ? ': ' + nodeContent : ''}`;
            if (totalLength + part.length < maxTotalLength) {
              contentParts.push(part);
              totalLength += part.length;
            }
          }
        });
        existingContent = contentParts.join('\n');
        console.log(`Existing outline content: ${existingContent.length} chars from ${contentParts.length} nodes`);
      }

      // Add target outline ID for pending recovery if merging
      const inputWithTarget: BulkResearchSources = {
        ...input,
        targetOutlineId: input.includeExistingContent && currentOutline ? currentOutline.id : undefined,
      };

      // Always use bullet-based (content-first) approach for best results
      const result = await bulletBasedResearchAction(inputWithTarget, existingContent);

      // Server actions return errors as data (Next.js strips thrown error messages)
      if ((result as any)?.error) {
        throw new Error((result as any).error);
      }

      if (!result?.outline?.nodes || !result?.outline?.rootNodeId) {
        throw new Error('The AI returned an incomplete outline. Please try again.');
      }

      // Snapshot for undo (in-memory + persisted to disk)
      if (input.includeExistingContent && currentOutline) {
        const snapshot = JSON.parse(JSON.stringify(currentOutline));
        preMergeSnapshotRef.current = snapshot;
        setHasUnmergeBackup(true);
        saveUnmergeBackup(snapshot).catch(err =>
          console.error('[Unmerge] Failed to persist backup:', err)
        );
      }

      if (input.includeExistingContent && currentOutline) {
        // TRUE MERGE: Intelligently merge new nodes into existing outline
        const newNodes = result.outline.nodes;
        const newRootId = result.outline.rootNodeId;
        const newTopLevelNodeIds = newNodes[newRootId]?.childrenIds || [];

        // Create updated nodes map starting with current outline
        const updatedNodes = { ...currentOutline.nodes };
        const currentRootId = currentOutline.rootNodeId;
        const existingChildIds = [...updatedNodes[currentRootId].childrenIds];

        // Helper: Normalize name for comparison (lowercase, remove numbers/punctuation)
        const normalizeName = (name: string) =>
          name.toLowerCase().replace(/[0-9\.\:\-\_\(\)\"\'\,]/g, '').trim();

        // Helper: Shorten long titles intelligently
        const shortenTitle = (title: string, maxLength = 80): string => {
          if (title.length <= maxLength) return title;
          // Try to break at sentence boundaries first (: or .)
          const colonIdx = title.indexOf(':');
          if (colonIdx > 10 && colonIdx < maxLength) {
            return title.substring(0, colonIdx).trim();
          }
          const periodIdx = title.indexOf('.');
          if (periodIdx > 10 && periodIdx < maxLength) {
            return title.substring(0, periodIdx).trim();
          }
          // Fall back to word boundary
          const truncated = title.substring(0, maxLength);
          const lastSpace = truncated.lastIndexOf(' ');
          if (lastSpace > maxLength * 0.5) {
            return truncated.substring(0, lastSpace).trim();
          }
          return truncated.trim();
        };

        // Helper: Check if node has meaningful content
        const hasContent = (content: string | undefined): boolean => {
          if (!content) return false;
          // Strip HTML tags and check for actual text
          const text = content.replace(/<[^>]*>/g, '').trim();
          return text.length > 10; // At least 10 chars of actual content
        };

        // Helper: Check if content is just a repeated header (AI artifact)
        const isRepeatedHeader = (content: string, nodeName: string): boolean => {
          const text = content.replace(/<[^>]*>/g, '').replace(/---/g, '').trim();
          const normalized = normalizeName(text);
          const normalizedName = normalizeName(nodeName);
          // If the content is mostly just the node name repeated, it's not useful
          return normalized.length < normalizedName.length * 3;
        };

        // Helper: Find existing node with similar name (searches ALL nodes, not just top-level)
        const findMatchingNode = (newName: string) => {
          const normalizedNew = normalizeName(newName);

          // Search all existing nodes (except root)
          const allExistingIds = Object.keys(updatedNodes).filter(id => id !== currentRootId);

          // First try exact match
          for (const existingId of allExistingIds) {
            const existingNode = updatedNodes[existingId];
            if (existingNode && normalizeName(existingNode.name) === normalizedNew) {
              return existingId;
            }
          }
          // Then try partial matching (new name contains existing or vice versa)
          // Only for longer names (5+ chars after normalization) to avoid false matches
          if (normalizedNew.length >= 5) {
            for (const existingId of allExistingIds) {
              const existingNode = updatedNodes[existingId];
              if (existingNode) {
                const normalizedExisting = normalizeName(existingNode.name);
                if (normalizedExisting.length >= 5 &&
                    (normalizedNew.includes(normalizedExisting) || normalizedExisting.includes(normalizedNew))) {
                  return existingId;
                }
              }
            }
          }
          return null;
        };

        let mergedCount = 0;
        let addedCount = 0;
        const newChildIds: string[] = [];

        // Process each new top-level node
        for (const newNodeId of newTopLevelNodeIds) {
          const newNode = newNodes[newNodeId];
          if (!newNode) continue;

          const matchingExistingId = findMatchingNode(newNode.name);

          if (matchingExistingId) {
            // MERGE: Append content to existing node
            const existingNode = updatedNodes[matchingExistingId];
            if (newNode.content && newNode.content.trim()) {
              const separator = existingNode.content ? '\n\n---\n\n' : '';
              updatedNodes[matchingExistingId] = {
                ...existingNode,
                content: (existingNode.content || '') + separator + newNode.content,
              };
              console.log(`[Merge] Appended content to "${existingNode.name}" (now ${updatedNodes[matchingExistingId].content?.length} chars)`);
            }

            // Recursively merge children too
            const newNodeChildren = newNode.childrenIds || [];
            for (const childId of newNodeChildren) {
              const childNode = newNodes[childId];
              if (!childNode) continue;

              // Check if this child matches an existing child of the matched node
              const existingChildren = updatedNodes[matchingExistingId].childrenIds || [];
              let matchedChildId: string | null = null;
              const normalizedChildName = normalizeName(childNode.name);

              for (const existingChildId of existingChildren) {
                const existingChild = updatedNodes[existingChildId];
                if (existingChild && normalizeName(existingChild.name) === normalizedChildName) {
                  matchedChildId = existingChildId;
                  break;
                }
              }

              if (matchedChildId) {
                // Merge child content (only if meaningful)
                const existingChild = updatedNodes[matchedChildId];
                if (hasContent(childNode.content) && !isRepeatedHeader(childNode.content, childNode.name)) {
                  const childSeparator = existingChild.content ? '\n\n---\n\n' : '';
                  updatedNodes[matchedChildId] = {
                    ...existingChild,
                    content: (existingChild.content || '') + childSeparator + childNode.content,
                  };
                  console.log(`[Merge] Appended child content to "${existingChild.name}"`);
                }
              } else {
                // Only add as new child if it has meaningful content
                if (hasContent(childNode.content) && !isRepeatedHeader(childNode.content, childNode.name)) {
                  updatedNodes[childId] = {
                    ...childNode,
                    name: shortenTitle(childNode.name),
                    parentId: matchingExistingId,
                  };
                  updatedNodes[matchingExistingId] = {
                    ...updatedNodes[matchingExistingId],
                    childrenIds: [...(updatedNodes[matchingExistingId].childrenIds || []), childId],
                  };
                } else {
                  console.log(`[Merge] Skipped empty child node: "${childNode.name}"`);
                }
              }
            }
            mergedCount++;
          } else {
            // Only add top-level node if it has content or children with content
            const nodeHasContent = hasContent(newNode.content) && !isRepeatedHeader(newNode.content, newNode.name);
            const hasChildrenWithContent = (newNode.childrenIds || []).some(cid => {
              const child = newNodes[cid];
              return child && hasContent(child.content);
            });

            if (!nodeHasContent && !hasChildrenWithContent) {
              console.log(`[Merge] Skipped empty top-level node: "${newNode.name}"`);
              continue; // Skip this node entirely
            }

            // ADD: Create new top-level node with shortened title
            updatedNodes[newNodeId] = {
              ...newNode,
              name: shortenTitle(newNode.name),
              parentId: currentRootId,
            };
            newChildIds.push(newNodeId);

            // Also add all descendants with shortened titles (filter empty nodes)
            const addDescendants = (nodeId: string, parentId: string) => {
              const node = updatedNodes[nodeId] || newNodes[nodeId];
              if (!node) return;

              const validChildIds: string[] = [];
              for (const childId of node.childrenIds || []) {
                const childNode = newNodes[childId];
                if (!childNode) continue;

                // Skip empty nodes
                if (!hasContent(childNode.content) && (!childNode.childrenIds || childNode.childrenIds.length === 0)) {
                  console.log(`[Merge] Skipped empty descendant: "${childNode.name}"`);
                  continue;
                }

                updatedNodes[childId] = {
                  ...childNode,
                  name: shortenTitle(childNode.name),
                  parentId: nodeId,
                };
                validChildIds.push(childId);
                addDescendants(childId, nodeId);
              }

              // Update parent's children list to only include valid children
              if (updatedNodes[nodeId]) {
                updatedNodes[nodeId] = {
                  ...updatedNodes[nodeId],
                  childrenIds: validChildIds,
                };
              }
            };
            addDescendants(newNodeId, currentRootId);
            addedCount++;
          }
        }

        // Update root node to include only truly new children
        if (newChildIds.length > 0) {
          updatedNodes[currentRootId] = {
            ...updatedNodes[currentRootId],
            childrenIds: [...existingChildIds, ...newChildIds],
          };
        }

        // Recalculate all prefixes to ensure proper numbering (1., 2., 3., etc.)
        recalculatePrefixesForBranch(updatedNodes, currentRootId);

        // Update the current outline with merged nodes
        const mergedOutline: Outline = {
          ...currentOutline,
          nodes: updatedNodes,
          lastModified: Date.now(),
        };

        // Update outlines list with the merged outline
        setOutlines(currentOutlines =>
          currentOutlines.map(o => o.id === currentOutline.id ? mergedOutline : o)
        );

        if (mergedCount === 0 && addedCount === 0) {
          toast({
            variant: "destructive",
            title: "Nothing to Merge",
            description: "The source didn't produce enough content to add to your outline. Try a different URL or a content-rich page.",
            duration: 10000,
          });
        } else {
          toast({
            title: "Content Merged!",
            description: `Merged ${mergedCount} existing sections, added ${addedCount} new sections. Open Research & Import to unmerge.`,
          });
        }
      } else {
        // CREATE NEW: Add the new outline to the list
        setOutlines(currentOutlines => [...currentOutlines, result.outline]);

        // Switch to the new outline
        setCurrentOutlineId(result.outline.id);
        setSelectedNodeId(result.outline.rootNodeId);

        toast({
          title: "Research Synthesized!",
          description: result.summary,
        });
      }

      // Clean up pending import files now that the result reached the client
      if (isElectron()) {
        electronClearAllPendingImports();
      }
    } catch (e) {
      const errorMsg = typeof e === 'string' ? e : ((e as any)?.message || String(e || '') || "Could not process bulk research import.");
      // Use console.warn to avoid Next.js error overlay in dev mode
      console.warn('[Research Import] Full error:', errorMsg);

      // Create user-friendly error messages with more detail
      let displayMsg: string;
      let title = "Research Import Failed";

      if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('rate')) {
        title = "AI Service Busy";
        displayMsg = "The AI service is temporarily overloaded. Please wait 2-3 minutes and try again. For large documents, consider importing in smaller pieces.";
      } else if (errorMsg.includes('transcript') || errorMsg.includes('captions')) {
        title = "Video Transcript Unavailable";
        displayMsg = "Could not get transcript from this video. It may not have captions enabled, or captions may be disabled by the creator.";
      } else if (errorMsg.includes('No content could be extracted') || errorMsg.includes('No content')) {
        title = "Content Extraction Failed";
        displayMsg = "Could not extract any content from the provided source(s). Check that the URL is accessible and the content is available.";
      } else if (errorMsg.includes('timeout') || errorMsg.includes('ETIMEDOUT') || errorMsg.includes('ECONNRESET')) {
        title = "Request Timed Out";
        displayMsg = "The import took too long and timed out. For large documents like books, try importing individual chapters or sections separately.";
      } else if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('Failed to fetch')) {
        title = "Connection Lost";
        displayMsg = "Lost connection during import. For long imports (5+ minutes), the connection may have dropped. Check your network and try again.";
      } else if (errorMsg.includes('JSON') || errorMsg.includes('parse')) {
        title = "Processing Error";
        displayMsg = "Error processing the AI response. This sometimes happens with very long documents. Try again or import in smaller sections.";
      } else {
        // Show actual error for debugging (safely handle any type)
        const safeMsg = String(errorMsg || 'Unknown error');
        displayMsg = `Error: ${safeMsg.substring(0, 200)}${safeMsg.length > 200 ? '...' : ''}`;
      }

      // Auto-copy error to clipboard so user can paste it
      const fullError = `${title}: ${displayMsg}`;
      try { navigator.clipboard.writeText(fullError); } catch {}

      toast({
        variant: "destructive",
        title,
        description: `${displayMsg}\n(Error copied to clipboard)`,
        duration: 15000, // 15 seconds for errors (much longer than default)
      });
      // Re-throw so the calling dialog can keep itself OPEN and show an
      // inline error. iOS Safari frequently clips top-anchored toasts
      // behind the URL bar; without this re-throw the user sees the
      // bulk-research dialog close with no visible feedback (#youtube-bug).
      throw new Error(displayMsg);
    } finally {
      setIsLoadingAI(false);
      aiLoadingStartTime.current = null;
    }
  }, [currentOutline, toast]);

  // Add an already-parsed outline to the app (used by FileImportDialog and handleImportOutline)
  const handleAddImportedOutline = useCallback((importedData: Outline, showToast: boolean = true) => {
    pendingActionRef.current = {
      label: `Import ${importedData.name || 'outline'}`,
      big: true,
    };
    setOutlines(currentOutlines => {
      const newId = currentOutlines.some(o => o.id === importedData.id)
        ? uuidv4()
        : importedData.id;
      const newOutline = { ...importedData, id: newId, isGuide: false };

      // Schedule these updates after the state update
      const capturedOutlineId = newOutline.id;
      const capturedRootNodeId = newOutline.rootNodeId;
      const capturedName = newOutline.name;

      setTimeout(() => {
        setCurrentOutlineId(capturedOutlineId);
        setSelectedNodeId(capturedRootNodeId);
        if (showToast) {
          toast({
            title: "Import Successful",
            description: `Outline "${capturedName}" has been imported.`,
          });
        }
      }, 0);

      return [...currentOutlines, newOutline];
    });
  }, [toast]);

  // FIXED: handleImportOutline uses functional update pattern
  const handleImportOutline = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') {
          throw new Error("File could not be read.");
        }
        const importedData = JSON.parse(text);

        if (!isValidOutline(importedData)) {
          throw new Error("Invalid outline file format.");
        }

        handleAddImportedOutline(importedData);

      } catch (error) {
        toast({
          variant: "destructive",
          title: "Import Failed",
          description: (error as Error).message || "An unknown error occurred during import.",
        });
      }
    };
    reader.readAsText(file);
  }, [toast, handleAddImportedOutline]);

  // Helper function to collect all nodes in a subtree
  const collectSubtree = useCallback((nodes: NodeMap, rootId: string): NodeMap => {
    const result: NodeMap = {};
    const collectRecursive = (nodeId: string) => {
      const node = nodes[nodeId];
      if (node) {
        result[nodeId] = { ...node };
        node.childrenIds.forEach(collectRecursive);
      }
    };
    collectRecursive(rootId);
    return result;
  }, []);

  // Duplicate a node and its subtree as a sibling
  const handleDuplicateNode = useCallback((nodeId: string) => {
    const outline = outlines.find(o => o.id === currentOutlineId);
    if (!outline) return;

    const nodeToDuplicate = outline.nodes[nodeId];
    if (!nodeToDuplicate || nodeToDuplicate.type === 'root') return;

    setOutlines(currentOutlines => {
      return currentOutlines.map(o => {
        if (o.id !== currentOutlineId) return o;

        // Collect subtree
        const subtreeNodes = collectSubtree(o.nodes, nodeId);

        // Create new IDs for all duplicated nodes
        const idMapping: Record<string, string> = {};
        Object.keys(subtreeNodes).forEach(oldId => {
          idMapping[oldId] = uuidv4();
        });

        // Create new nodes with remapped IDs
        const newNodes: NodeMap = { ...o.nodes };
        const duplicatedRoot = subtreeNodes[nodeId];

        Object.entries(subtreeNodes).forEach(([oldId, node]) => {
          const newId = idMapping[oldId];
          const isSubtreeRoot = oldId === nodeId;

          newNodes[newId] = {
            ...node,
            id: newId,
            name: isSubtreeRoot ? `${node.name} (copy)` : node.name,
            prefix: '',
            parentId: isSubtreeRoot
              ? node.parentId
              : (node.parentId ? idMapping[node.parentId] : null),
            childrenIds: node.childrenIds.map(childId => idMapping[childId]),
          };
        });

        // Insert the duplicated root after the original
        const newRootId = idMapping[nodeId];
        const parentId = nodeToDuplicate.parentId;
        if (parentId && newNodes[parentId]) {
          const parent = newNodes[parentId];
          const originalIndex = parent.childrenIds.indexOf(nodeId);
          const newChildrenIds = [...parent.childrenIds];
          newChildrenIds.splice(originalIndex + 1, 0, newRootId);
          newNodes[parentId] = { ...parent, childrenIds: newChildrenIds };
        }

        // Recalculate prefixes
        if (parentId) {
          recalculatePrefixesForBranch(newNodes, parentId);
        }

        // Schedule selection of the duplicated node
        setTimeout(() => {
          setSelectedNodeId(newRootId);
          toast({
            title: "Item Duplicated",
            description: `"${duplicatedRoot.name}" has been duplicated.`,
          });
        }, 0);

        return { ...o, nodes: newNodes };
      });
    });
  }, [currentOutlineId, outlines, collectSubtree, toast]);

  // Handle export outline (opens export dialog)
  const handleExportOutline = useCallback(() => {
    setExportNodeId(null); // null means export entire outline
    setExportDialogOpen(true);
  }, []);

  // Handle import outline trigger (opens file picker)
  const handleImportOutlineTrigger = useCallback(() => {
    importFileInputRef.current?.click();
  }, []);

  // Handle file selection for import
  const handleImportFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleImportOutline(file);
    }
    // Reset input so the same file can be selected again
    event.target.value = '';
  }, [handleImportOutline]);

  // Open search (callback for command palette)
  const handleOpenSearch = useCallback(() => {
    setIsSearchOpen(true);
  }, []);

  // Copy subtree to clipboard
  const handleCopySubtree = useCallback((nodeId: string) => {
    const outline = outlines.find(o => o.id === currentOutlineId);
    if (!outline) return;

    const subtreeNodes = collectSubtree(outline.nodes, nodeId);
    setSubtreeClipboard({
      nodes: subtreeNodes,
      rootId: nodeId,
      sourceOutlineId: currentOutlineId,
      isCut: false,
    });

    toast({
      title: "Branch Copied",
      description: `"${outline.nodes[nodeId].name}" and its children copied to clipboard.`,
    });
  }, [currentOutlineId, outlines, collectSubtree, toast]);

  // Cut subtree to clipboard (will be removed on paste)
  const handleCutSubtree = useCallback((nodeId: string) => {
    const outline = outlines.find(o => o.id === currentOutlineId);
    if (!outline) return;

    const subtreeNodes = collectSubtree(outline.nodes, nodeId);
    setSubtreeClipboard({
      nodes: subtreeNodes,
      rootId: nodeId,
      sourceOutlineId: currentOutlineId,
      isCut: true,
    });

    toast({
      title: "Branch Cut",
      description: `"${outline.nodes[nodeId].name}" ready to move. Select a target item and paste.`,
    });
  }, [currentOutlineId, outlines, collectSubtree, toast]);

  // Paste subtree as sibling after target node
  const handlePasteSubtree = useCallback((targetNodeId: string) => {
    if (!subtreeClipboard) return;

    const pastedCount = Object.keys(subtreeClipboard.nodes).length;
    pendingActionRef.current = {
      label: pastedCount > 1 ? `Paste ${pastedCount} items` : 'Paste item',
      big: true,
    };
    setOutlines(currentOutlines => {
      const targetOutline = currentOutlines.find(o => o.id === currentOutlineId);
      if (!targetOutline) return currentOutlines;

      const targetNode = targetOutline.nodes[targetNodeId];
      if (!targetNode) return currentOutlines;

      // Create new IDs for all pasted nodes
      const idMapping: Record<string, string> = {};
      Object.keys(subtreeClipboard.nodes).forEach(oldId => {
        idMapping[oldId] = uuidv4();
      });

      // Create new nodes with remapped IDs
      const newNodes: NodeMap = {};
      const clipboardRoot = subtreeClipboard.nodes[subtreeClipboard.rootId];

      Object.entries(subtreeClipboard.nodes).forEach(([oldId, node]) => {
        const newId = idMapping[oldId];
        const isClipboardRoot = oldId === subtreeClipboard.rootId;

        // Determine the new type - if it was a root node, change to chapter (has children) or document
        let newType = node.type;
        if (isClipboardRoot && node.type === 'root') {
          newType = node.childrenIds.length > 0 ? 'chapter' : 'document';
        }

        newNodes[newId] = {
          ...node,
          id: newId,
          type: newType,
          // Clear prefix - will be recalculated
          prefix: '',
          // The clipboard root becomes a sibling of target, so its parent is target's parent
          parentId: isClipboardRoot
            ? targetNode.parentId
            : (node.parentId ? idMapping[node.parentId] : null),
          childrenIds: node.childrenIds.map(childId => idMapping[childId]),
        };
      });

      const newRootId = idMapping[subtreeClipboard.rootId];

      // Find the target's parent and insert the new root after the target
      const parentNode = targetNode.parentId ? targetOutline.nodes[targetNode.parentId] : null;
      let updatedOutline = { ...targetOutline };

      if (parentNode) {
        const targetIndex = parentNode.childrenIds.indexOf(targetNodeId);
        const newChildrenIds = [...parentNode.childrenIds];
        newChildrenIds.splice(targetIndex + 1, 0, newRootId);

        updatedOutline = {
          ...updatedOutline,
          nodes: {
            ...updatedOutline.nodes,
            ...newNodes,
            [parentNode.id]: {
              ...parentNode,
              childrenIds: newChildrenIds,
            },
          },
        };
      } else {
        // Target is root node - paste as child instead
        const newChildrenIds = [...targetNode.childrenIds, newRootId];
        newNodes[newRootId].parentId = targetNodeId;

        updatedOutline = {
          ...updatedOutline,
          nodes: {
            ...updatedOutline.nodes,
            ...newNodes,
            [targetNodeId]: {
              ...targetNode,
              childrenIds: newChildrenIds,
            },
          },
        };
      }

      // If it was a cut operation, remove the source nodes
      let result = currentOutlines.map(o => o.id === currentOutlineId ? updatedOutline : o);

      if (subtreeClipboard.isCut) {
        const sourceOutline = result.find(o => o.id === subtreeClipboard.sourceOutlineId);
        if (sourceOutline) {
          // Remove the cut subtree from source
          const sourceNode = sourceOutline.nodes[subtreeClipboard.rootId];
          if (sourceNode && sourceNode.parentId) {
            const sourceParent = sourceOutline.nodes[sourceNode.parentId];
            if (sourceParent) {
              const updatedSourceNodes = { ...sourceOutline.nodes };
              // Remove all nodes in the cut subtree
              Object.keys(subtreeClipboard.nodes).forEach(nodeId => {
                delete updatedSourceNodes[nodeId];
              });
              // Update parent's children
              updatedSourceNodes[sourceParent.id] = {
                ...sourceParent,
                childrenIds: sourceParent.childrenIds.filter(id => id !== subtreeClipboard.rootId),
              };

              // Recalculate prefixes for the source outline after removal
              recalculatePrefixesForBranch(updatedSourceNodes, sourceParent.id);

              result = result.map(o =>
                o.id === subtreeClipboard.sourceOutlineId
                  ? { ...o, nodes: updatedSourceNodes }
                  : o
              );
            }
          }
        }
      }

      // Recalculate prefixes for the pasted subtree
      result = result.map(o => {
        if (o.id === currentOutlineId) {
          const parentId = parentNode ? parentNode.id : targetNodeId;
          recalculatePrefixesForBranch(o.nodes, parentId);
        }
        return o;
      });

      // Schedule toast and clear clipboard
      setTimeout(() => {
        setSelectedNodeId(newRootId);
        toast({
          title: subtreeClipboard.isCut ? "Branch Moved" : "Branch Pasted",
          description: `"${clipboardRoot.name}" has been ${subtreeClipboard.isCut ? 'moved' : 'pasted'}.`,
        });
        if (subtreeClipboard.isCut) {
          setSubtreeClipboard(null);
        }
      }, 0);

      return result;
    });
  }, [currentOutlineId, subtreeClipboard, toast]);

  // Multi-select handlers
  const handleToggleNodeSelection = useCallback((nodeId: string, isCtrlClick: boolean) => {
    if (isCtrlClick) {
      // Ctrl/Cmd+Click: clear single selection and toggle in multi-selection
      setSelectedNodeId(null); // Clear single selection when multi-selecting
      setSelectedNodeIds(prev => {
        const newSelection = new Set(prev);
        if (newSelection.has(nodeId)) {
          newSelection.delete(nodeId);
        } else {
          newSelection.add(nodeId);
        }
        return newSelection;
      });
      setLastSelectedNodeId(nodeId);
    } else {
      // Regular click: clear multi-selection
      setSelectedNodeIds(new Set());
    }
  }, []);

  const handleRangeSelect = useCallback((nodeId: string) => {
    if (!currentOutline || !lastSelectedNodeId) return;

    // Get all visible node IDs in order
    const allNodeIds: string[] = [];
    const collectVisibleNodes = (id: string) => {
      allNodeIds.push(id);
      const node = currentOutline.nodes[id];
      if (node && !node.isCollapsed) {
        node.childrenIds.forEach(collectVisibleNodes);
      }
    };
    collectVisibleNodes(currentOutline.rootNodeId);

    // Find range between last selected and current
    const lastIndex = allNodeIds.indexOf(lastSelectedNodeId);
    const currentIndex = allNodeIds.indexOf(nodeId);
    if (lastIndex === -1 || currentIndex === -1) return;

    const start = Math.min(lastIndex, currentIndex);
    const end = Math.max(lastIndex, currentIndex);
    const range = allNodeIds.slice(start, end + 1);

    setSelectedNodeIds(prev => {
      const newSelection = new Set(prev);
      range.forEach(id => newSelection.add(id));
      return newSelection;
    });
    setLastSelectedNodeId(nodeId);
  }, [currentOutline, lastSelectedNodeId]);

  const handleClearSelection = useCallback(() => {
    setSelectedNodeIds(new Set());
    setLastSelectedNodeId(null);
  }, []);

  const handleBulkDelete = useCallback(async () => {
    if (selectedNodeIds.size === 0) return;
    if (currentOutline?.isGuide) {
      toast({ title: "User Guide is read-only", description: "Make personal notes in your own outline instead." });
      return;
    }

    const nodeCount = selectedNodeIds.size;
    // Unified confirm dialog with Don't-ask-again + Professional bypass.
    const ok = await confirmDialog({
      id: 'confirm.bulkDeleteNodes',
      title: `Delete ${nodeCount} item${nodeCount > 1 ? 's' : ''}?`,
      description: `This will also delete all their children.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;

    pendingActionRef.current = {
      label: `Delete ${nodeCount} item${nodeCount > 1 ? 's' : ''}`,
      big: true,
    };

    setOutlines(currentOutlines => {
      return currentOutlines.map(o => {
        if (o.id === currentOutlineId) {
          let newNodes = { ...o.nodes };
          // Delete each selected node
          selectedNodeIds.forEach(nodeId => {
            if (newNodes[nodeId]) {
              newNodes = removeNode(newNodes, nodeId);
            }
          });
          return { ...o, nodes: newNodes };
        }
        return o;
      });
    });

    setSelectedNodeIds(new Set());
    setLastSelectedNodeId(null);
    toast({
      title: "Items Deleted",
      description: `Deleted ${nodeCount} item${nodeCount > 1 ? 's' : ''}.`,
    });
  }, [selectedNodeIds, currentOutlineId, currentOutline, toast, confirmDialog, setOutlines]);

  const handleBulkChangeColor = useCallback((color: string | undefined) => {
    if (selectedNodeIds.size === 0) return;
    if (currentOutline?.isGuide) {
      toast({ title: "User Guide is read-only", description: "Make personal notes in your own outline instead." });
      return;
    }

    setOutlines(currentOutlines => {
      return currentOutlines.map(o => {
        if (o.id === currentOutlineId) {
          const newNodes = { ...o.nodes };
          selectedNodeIds.forEach(nodeId => {
            if (newNodes[nodeId]) {
              newNodes[nodeId] = {
                ...newNodes[nodeId],
                metadata: {
                  ...newNodes[nodeId].metadata,
                  color: color as any,
                },
              };
            }
          });
          return { ...o, nodes: newNodes };
        }
        return o;
      });
    });

    toast({
      title: "Color Updated",
      description: `Updated color for ${selectedNodeIds.size} item${selectedNodeIds.size > 1 ? 's' : ''}.`,
    });
  }, [selectedNodeIds, currentOutlineId, currentOutline, toast]);

  const handleBulkAddTag = useCallback((tag: string) => {
    if (selectedNodeIds.size === 0) return;
    if (currentOutline?.isGuide) {
      toast({ title: "User Guide is read-only", description: "Make personal notes in your own outline instead." });
      return;
    }

    setOutlines(currentOutlines => {
      return currentOutlines.map(o => {
        if (o.id === currentOutlineId) {
          const newNodes = { ...o.nodes };
          selectedNodeIds.forEach(nodeId => {
            if (newNodes[nodeId]) {
              const existingTags = newNodes[nodeId].metadata?.tags || [];
              if (!existingTags.includes(tag)) {
                newNodes[nodeId] = {
                  ...newNodes[nodeId],
                  metadata: {
                    ...newNodes[nodeId].metadata,
                    tags: [...existingTags, tag],
                  },
                };
              }
            }
          });
          return { ...o, nodes: newNodes };
        }
        return o;
      });
    });

    toast({
      title: "Tag Added",
      description: `Added "${tag}" to ${selectedNodeIds.size} item${selectedNodeIds.size > 1 ? 's' : ''}.`,
    });
  }, [selectedNodeIds, currentOutlineId, currentOutline, toast]);

  // Export handlers
  const handleSaveToSecondBrain = useCallback((nodeId: string) => {
    const sourceOutline = outlines.find(o => o.id === currentOutlineId);
    if (!sourceOutline) return;

    const secondBrain = outlines.find(o => o.isSecondBrain);
    if (!secondBrain) {
      toast({ title: "We couldn't find your Second Brain", description: "Your Second Brain outline seems to be missing. Try reopening the app — it should be re-created automatically.", variant: "destructive" });
      return;
    }

    // Don't save from Second Brain into itself
    if (sourceOutline.isSecondBrain) {
      toast({ title: "Already in Second Brain", description: "This item is already in your Second Brain." });
      return;
    }

    // Collect the subtree to copy
    const subtreeNodes = collectSubtree(sourceOutline.nodes, nodeId);

    // Create new IDs for all nodes
    const idMapping: Record<string, string> = {};
    Object.keys(subtreeNodes).forEach(oldId => {
      idMapping[oldId] = uuidv4();
    });

    // Snapshot the Second Brain before modification so user can unmerge
    const sbSnapshot = JSON.parse(JSON.stringify(secondBrain));
    preMergeSnapshotRef.current = sbSnapshot;
    setHasUnmergeBackup(true);
    saveUnmergeBackup(sbSnapshot).catch(err =>
      console.error('[Unmerge] Failed to persist Second Brain backup:', err)
    );

    setOutlines(currentOutlines => {
      const sb = currentOutlines.find(o => o.isSecondBrain);
      if (!sb) return currentOutlines;

      const newNodes = { ...sb.nodes };

      // Create cloned nodes with new IDs
      Object.entries(subtreeNodes).forEach(([oldId, node]) => {
        const newId = idMapping[oldId];
        const isSubtreeRoot = oldId === nodeId;
        newNodes[newId] = {
          ...node,
          id: newId,
          parentId: isSubtreeRoot ? sb.rootNodeId : idMapping[node.parentId] || sb.rootNodeId,
          childrenIds: node.childrenIds.map(cid => idMapping[cid] || cid),
        };
      });

      // Add the subtree root as a child of the Second Brain root
      const sbRoot = newNodes[sb.rootNodeId];
      newNodes[sb.rootNodeId] = {
        ...sbRoot,
        childrenIds: [...sbRoot.childrenIds, idMapping[nodeId]],
      };

      return currentOutlines.map(o =>
        o.isSecondBrain ? { ...o, nodes: newNodes } : o
      );
    });

    const nodeName = sourceOutline.nodes[nodeId]?.name || 'Node';
    const nodeContent = sourceOutline.nodes[nodeId]?.content || '';
    const childCount = Object.keys(subtreeNodes).length - 1;
    toast({
      title: "Saved to Second Brain",
      description: `"${nodeName}"${childCount > 0 ? ` and ${childCount} child item${childCount === 1 ? '' : 's'}` : ''} added to your Second Brain.`,
    });

    // Fire-and-forget auto-tagging on the subtree-root node copy
    const newSubtreeRootId = idMapping[nodeId];
    suggestTagsAction(nodeName, nodeContent)
      .then(tags => {
        if (!tags || tags.length === 0) return;
        setOutlines(currentOutlines =>
          currentOutlines.map(o => {
            if (!o.isSecondBrain) return o;
            const node = o.nodes[newSubtreeRootId];
            if (!node) return o;
            const existingTags = node.metadata?.tags || [];
            const mergedTags = Array.from(new Set([...existingTags, ...tags]));
            return {
              ...o,
              nodes: {
                ...o.nodes,
                [newSubtreeRootId]: {
                  ...node,
                  metadata: { ...node.metadata, tags: mergedTags },
                },
              },
            };
          })
        );
        toast({
          title: "Tagged with",
          description: tags.map(t => `#${t}`).join(' '),
        });
      })
      .catch(err => console.error('[Auto-tag] suggestTagsAction failed:', err));
  }, [currentOutlineId, outlines, collectSubtree, toast, setOutlines]);

  const handleOpenSecondBrain = useCallback(() => {
    const sb = outlines.find(o => o.isSecondBrain);
    if (sb) {
      setCurrentOutlineId(sb.id);
      setSelectedNodeId(sb.rootNodeId);
    }
  }, [outlines]);

  const handleSearchSecondBrain = useCallback(() => {
    setIsKnowledgeChatOpen(true);
    // The Knowledge Chat dialog will need to be told to switch to secondbrain mode
    // We store a flag that the dialog checks on open
    localStorage.setItem('knowledgeChatInitMode', 'secondbrain');
  }, []);

  const handleImportToSecondBrain = useCallback(() => {
    // Switch to the Second Brain outline first, then open Research & Import
    const sb = outlines.find(o => o.isSecondBrain);
    if (sb) {
      setCurrentOutlineId(sb.id);
      setSelectedNodeId(sb.rootNodeId);
    }
    setIsBulkResearchOpen(true);
  }, [outlines]);

  const handleOpenQuickCapture = useCallback(() => {
    setIsQuickCaptureOpen(true);
  }, []);

  const handleOpenSecondBrainDashboard = useCallback(() => {
    setSecondBrainSearchFocus(false);
    setIsSecondBrainDashboardOpen(true);
  }, []);

  // FREE instant local keyword search: opens the dashboard with the search box focused.
  const handleOpenSecondBrainSearch = useCallback(() => {
    setSecondBrainSearchFocus(true);
    setIsSecondBrainDashboardOpen(true);
  }, []);

  const handleJumpToSecondBrainNode = useCallback((nodeId: string) => {
    const sb = outlines.find(o => o.isSecondBrain);
    if (!sb) return;
    setCurrentOutlineId(sb.id);
    setSelectedNodeId(nodeId);
  }, [outlines, setCurrentOutlineId, setSelectedNodeId]);

  const handleQuickCapture = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const secondBrain = outlines.find(o => o.isSecondBrain);
    if (!secondBrain) {
      toast({ title: "We couldn't find your Second Brain", description: "Your Second Brain outline seems to be missing. Try reopening the app — it should be re-created automatically.", variant: "destructive" });
      return;
    }

    // Derive name (first 60 chars) and remaining content (as <p>...</p>)
    const entryName = trimmed.length > 60 ? trimmed.slice(0, 60) : trimmed;
    const remainder = trimmed.length > 60 ? trimmed.slice(60) : '';
    const entryContent = remainder ? `<p>${remainder}</p>` : '';
    const entryId = uuidv4();
    const now = Date.now();

    let inboxIdForTagging: string | null = null;

    setOutlines(currentOutlines => {
      const sb = currentOutlines.find(o => o.isSecondBrain);
      if (!sb) return currentOutlines;

      const sbRoot = sb.nodes[sb.rootNodeId];
      if (!sbRoot) return currentOutlines;

      // Find existing Inbox among direct children of the SB root
      let inboxId = sbRoot.childrenIds.find(cid => sb.nodes[cid]?.name === '📥 Inbox') || null;

      const newNodes = { ...sb.nodes };
      let newRootChildrenIds = sbRoot.childrenIds;

      if (!inboxId) {
        // Create the Inbox node lazily
        inboxId = uuidv4();
        newNodes[inboxId] = {
          id: inboxId,
          name: '📥 Inbox',
          content: '',
          type: 'document',
          parentId: sb.rootNodeId,
          childrenIds: [entryId],
          prefix: '',
          metadata: { createdAt: now, updatedAt: now },
        };
        newRootChildrenIds = [inboxId, ...sbRoot.childrenIds];
      } else {
        const existingInbox = newNodes[inboxId];
        newNodes[inboxId] = {
          ...existingInbox,
          childrenIds: [...existingInbox.childrenIds, entryId],
        };
      }

      // Add the new entry node under the Inbox
      newNodes[entryId] = {
        id: entryId,
        name: entryName,
        content: entryContent,
        type: 'document',
        parentId: inboxId,
        childrenIds: [],
        prefix: '',
        metadata: { createdAt: now, updatedAt: now },
      };

      // Update SB root's children if Inbox was newly created
      newNodes[sb.rootNodeId] = {
        ...sbRoot,
        childrenIds: newRootChildrenIds,
      };

      inboxIdForTagging = inboxId;

      return currentOutlines.map(o =>
        o.isSecondBrain ? { ...o, nodes: newNodes } : o
      );
    });

    toast({ title: "Saved to Inbox", description: `"${entryName}" added to your Second Brain Inbox.` });

    // Fire-and-forget tag suggestion
    suggestTagsAction(entryName, entryContent)
      .then(tags => {
        if (!tags || tags.length === 0) return;
        setOutlines(currentOutlines =>
          currentOutlines.map(o => {
            if (!o.isSecondBrain) return o;
            const node = o.nodes[entryId];
            if (!node) return o;
            return {
              ...o,
              nodes: {
                ...o.nodes,
                [entryId]: {
                  ...node,
                  metadata: { ...node.metadata, tags },
                },
              },
            };
          })
        );
        toast({
          title: "Tagged with",
          description: tags.map(t => `#${t}`).join(' '),
        });
      })
      .catch(err => console.error('[Quick Capture Auto-tag] suggestTagsAction failed:', err));
  }, [outlines, setOutlines, toast]);

  // Keyboard shortcuts for Second Brain and collapse/expand
  useEffect(() => {
    const handleSecondBrainKeys = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true';

      // Expand/Collapse All are OUTLINE-STRUCTURE commands, not text commands.
      // They must fire even when focus sits inside a node's contentEditable
      // (which happens right after selecting/editing a node), exactly like the
      // outline-undo (Cmd+Z) handler. So they run ABOVE the isTyping guard.

      // Cmd+Shift+E — Collapse All (recursive). Tested first because
      // Cmd+E without shift would otherwise match the shift-modified form too.
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'E' || e.key === 'e')) {
        e.preventDefault();
        handleCollapseAll();
        return;
      }

      // Cmd+E — Expand All (recursive). Operates on current selection if any,
      // otherwise the whole outline.
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === 'E' || e.key === 'e')) {
        e.preventDefault();
        handleExpandAll();
        return;
      }

      // Second-Brain shortcuts below are text-context-sensitive, so they stay
      // guarded — don't hijack typing.
      if (isTyping) return;

      // Cmd+B is reserved for sidebar toggle (platform convention: Notion, VS Code).
      // Second Brain is accessed via toolbar Brain button / menu — no shortcut.

      // Cmd+Shift+B — Save selection to Second Brain
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'B') {
        e.preventDefault();
        if (selectedNodeId) handleSaveToSecondBrain(selectedNodeId);
        return;
      }

      // Cmd+Shift+S — Ask Second Brain
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        handleSearchSecondBrain();
        return;
      }

      // Cmd+Shift+I — Quick capture to Second Brain Inbox
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
        e.preventDefault();
        setIsQuickCaptureOpen(true);
        return;
      }
    };

    document.addEventListener('keydown', handleSecondBrainKeys);
    return () => document.removeEventListener('keydown', handleSecondBrainKeys);
  }, [outlines, currentOutlineId, selectedNodeId, handleSaveToSecondBrain, handleSearchSecondBrain, handleCollapseAll, handleExpandAll, setIsQuickCaptureOpen]);

  const handleExportSubtree = useCallback((nodeId: string) => {
    setExportNodeId(nodeId);
    setExportDialogOpen(true);
  }, []);

  // Podcast generation handler
  const handleGeneratePodcast = useCallback((nodeId: string) => {
    setPodcastNodeId(nodeId);
    setPodcastDialogOpen(true);
  }, []);

  // Progress indicator for large outline loading - use Portal to render to document.body
  const progressIndicatorContent = isLoadingLazyOutline && loadingOutlineInfo ? (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999 }}>
      {/* Semi-transparent overlay */}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)' }} />

      {/* Progress panel at bottom - using inline styles to guarantee visibility */}
      <div style={{
        position: 'absolute',
        bottom: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '400px',
        padding: '0 16px',
        boxSizing: 'border-box',
      }}>
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          padding: '16px',
        }}>
          {/* Header with spinner */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            {loadingOutlineInfo.phase === 'complete' ? (
              <svg style={{ width: '20px', height: '20px', color: '#22c55e' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg style={{ width: '20px', height: '20px', animation: 'spin 1s linear infinite' }} viewBox="0 0 24 24">
                <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            <span style={{ fontWeight: 500, color: '#111' }}>
              {loadingOutlineInfo.phase === 'complete'
                ? 'Outline Loaded!'
                : `Loading: ${loadingOutlineInfo.name}`}
            </span>
          </div>

          {/* Phase content */}
          {loadingOutlineInfo.phase === 'reading' && (
            <div style={{ fontSize: '14px', color: '#666' }}>
              Reading {loadingOutlineInfo.fileSize} from disk...
            </div>
          )}

          {loadingOutlineInfo.phase === 'rendering' && loadingOutlineInfo.totalNodes && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ color: '#666' }}>Level {loadingOutlineInfo.currentLevel || 0} / {loadingOutlineInfo.totalLevels || 0}</span>
                <span style={{ fontWeight: 500, color: '#111' }}>{(loadingOutlineInfo.nodesLoaded || 0).toLocaleString()} / {loadingOutlineInfo.totalNodes.toLocaleString()} items</span>
              </div>
              <div style={{ height: '10px', backgroundColor: '#e5e7eb', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  backgroundColor: '#3b82f6',
                  width: `${Math.round(((loadingOutlineInfo.nodesLoaded || 0) / loadingOutlineInfo.totalNodes) * 100)}%`,
                  transition: 'width 0.1s ease-out',
                }} />
              </div>
            </div>
          )}

          {loadingOutlineInfo.phase === 'complete' && loadingOutlineInfo.totalNodes && (
            <div>
              <div style={{ height: '10px', backgroundColor: '#e5e7eb', borderRadius: '5px', overflow: 'hidden', marginBottom: '8px' }}>
                <div style={{ height: '100%', backgroundColor: '#22c55e', width: '100%' }} />
              </div>
              <div style={{ fontSize: '14px', color: '#666' }}>
                {loadingOutlineInfo.totalNodes.toLocaleString()} nodes loaded successfully
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CSS for spinner animation */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  ) : null;

  // Use portal to render progress indicator directly to document.body
  const progressIndicator = typeof document !== 'undefined' && progressIndicatorContent
    ? createPortal(progressIndicatorContent, document.body)
    : null;

  if (!isClient || !currentOutline) {
    return (
      <div className="flex h-screen w-full bg-background">
        {progressIndicator}
        {/* Skeleton sidebar */}
        <div className="w-64 border-r bg-muted/20 p-3 space-y-4 hidden md:block">
          <div className="skeleton h-5 w-24" />
          <div className="skeleton h-9 w-full" />
          <div className="skeleton h-9 w-full" />
          <div className="space-y-2 mt-6">
            <div className="skeleton h-4 w-20" />
            <div className="skeleton h-8 w-full" />
            <div className="skeleton h-8 w-full" />
            <div className="skeleton h-8 w-3/4" />
          </div>
        </div>
        {/* Skeleton main content */}
        <div className="flex-1 flex flex-col">
          <div className="border-b p-3 flex items-center gap-3">
            <div className="skeleton h-9 w-48" />
            <div className="skeleton h-8 w-8 rounded-full" />
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="skeleton h-8 w-8 rounded-full mx-auto" />
              <p className="text-sm text-muted-foreground">Loading IdiamPro...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show empty state when there are no user outlines
  if (!hasUserOutlines) {
    return (
      <div className="h-screen w-full">
        {progressIndicator}
        <WelcomeShowcase />
        <EmptyState
          onCreateBlankOutline={handleCreateOutline}
          onCreateFromTemplate={handleCreateFromTemplate}
          onOpenGuide={handleOpenGuide}
        />
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="h-screen bg-background">
        <WelcomeShowcase />
        {/* Hidden file input for import */}
        <input
          type="file"
          ref={importFileInputRef}
          onChange={handleImportFileChange}
          accept=".json,.idm,application/json,application/octet-stream"
          className="hidden"
        />

        {/* Command Palette */}
        <CommandPalette
          onAICommand={handleAICommand}
          open={isCommandPaletteOpen}
          onOpenChange={setIsCommandPaletteOpen}
          outlines={outlines}
          currentOutlineId={currentOutlineId}
          selectedNodeId={selectedNodeId}
          onSelectOutline={handleSelectOutline}
          onCreateOutline={handleCreateOutline}
          onCreateNode={() => handleCreateNode()}
          onDuplicateNode={handleDuplicateNode}
          onDeleteNode={handleDeleteNode}
          onCollapseAll={handleCollapseAll}
          onExpandAll={handleExpandAll}
          onOpenSearch={handleOpenSearch}
          onExportOutline={handleExportOutline}
          onImportOutline={handleImportOutlineTrigger}
          onToggleFocusMode={() => setIsFocusMode(prev => !prev)}
          onShowShortcuts={() => setIsShortcutsOpen(true)}
          onOpenBulkResearch={() => setIsBulkResearchOpen(true)}
          onOpenLiveBooks={() => setIsLiveBooksOpen(true)}
          onOpenTranslate={() => setIsTranslateOpen(true)}
          onOpenReformat={() => {
            setReformatSelectionHtml(null);
            setReformatApplySelectionFn(null);
            setIsReformatOpen(true);
          }}
          onOpenTransformOutline={() => setIsTransformOutlineOpen(true)}
          onOpenImageToOutline={() => setIsImageToOutlineOpen(true)}
          onOpenYoutubePackage={() => setIsYoutubePackageOpen(true)}
          onOpenGenerateVideo={handleOpenGenerateVideo}
          onOpenTemplates={() => setIsTemplatesDialogOpen(true)}
          isGuide={currentOutline?.isGuide ?? false}
          isFocusMode={isFocusMode}
        />
        <AICommandConfirmDialog
          open={pendingAICommand !== null}
          onOpenChange={(o) => { if (!o) setPendingAICommand(null); }}
          description={pendingAICommand?.human_description || ''}
          onConfirm={() => { if (pendingAICommand) executeAICommand(pendingAICommand); }}
        />

        {/* Keyboard Shortcuts Dialog */}
        <KeyboardShortcutsDialog
          open={isShortcutsOpen}
          onOpenChange={setIsShortcutsOpen}
        />

        <BulkResearchDialog
          open={isBulkResearchOpen}
          onOpenChange={setIsBulkResearchOpen}
          onSubmit={handleBulkResearch}
          currentOutlineName={currentOutline?.name}
          canUnmerge={hasUnmergeBackup}
          onUnmerge={handleUnmerge}
        />

        <LiveBooksDialog
          open={isLiveBooksOpen}
          onOpenChange={setIsLiveBooksOpen}
          outline={currentOutline}
          selectedNodeId={selectedNodeId}
          onApply={handleApplyLiveBooks}
          useLocalAI={liveBooksUseLocal}
        />
        <TranslateDialog
          open={isTranslateOpen}
          onOpenChange={setIsTranslateOpen}
          outline={currentOutline}
          selectedNodeId={selectedNodeId}
          onApply={handleApplyTranslate}
        />

        <ImageToOutlineDialog
          open={isImageToOutlineOpen}
          onOpenChange={setIsImageToOutlineOpen}
          outline={currentOutline}
          selectedNodeId={selectedNodeId}
          onApply={handleApplyImageToOutline}
        />

        <YoutubePackageDialog
          open={isYoutubePackageOpen}
          onOpenChange={setIsYoutubePackageOpen}
          outline={currentOutline}
          selectedNodeId={selectedNodeId}
          onExportMarkdown={handleExportYoutubeMarkdown}
          onSaveAsOutline={handleSaveYoutubeAsOutline}
        />

        <GenerateVideoDialog
          open={isGenerateVideoOpen}
          onOpenChange={setIsGenerateVideoOpen}
          outline={currentOutline}
          selectedNodeId={selectedNodeId}
        />

        <ReformatDialog
          open={isReformatOpen}
          onOpenChange={(o) => {
            setIsReformatOpen(o);
            if (!o) {
              setReformatSelectionHtml(null);
              setReformatApplySelectionFn(null);
            }
          }}
          contentHtml={reformatContentForDialog}
          scopeLabel={reformatScopeLabel}
          isSelectionScope={reformatSelectionHtml !== null}
          outlineName={currentOutline?.name}
          onApply={handleApplyReformat}
        />

        <TransformOutlineDialog
          open={isTransformOutlineOpen}
          onOpenChange={setIsTransformOutlineOpen}
          nodes={currentOutline?.nodes ?? null}
          rootNodeId={transformScopeRootId}
          scopeLabel={transformScopeLabel}
          outlineName={currentOutline?.name}
          onApply={handleApplyTransformOutline}
        />

        <BackupRestoreDialog
          open={isBackupRestoreOpen}
          onOpenChange={setIsBackupRestoreOpen}
          initialTab={backupRestoreInitialTab}
          outline={currentOutline}
          onRestore={handleRestoreFromSnapshot}
        />

        {/* Always-on backup watchdog — raises a loud, persistent warning if
            automatic backups ever silently fail, and clears it on recovery.
            "How to fix" opens the Backup & Restore dialog so the user can save
            a copy right away. Silent while backups are healthy. */}
        <OutlineLinkPickerDialog
          open={isOutlineLinkPickerOpen}
          onOpenChange={setIsOutlineLinkPickerOpen}
          outlines={outlines}
          currentOutlineId={currentOutlineId}
          onPick={handleInsertOutlineLink}
        />

        <HelpChatDialog
          open={isHelpChatOpen}
          onOpenChange={setIsHelpChatOpen}
        />

        <KnowledgeChatDialog
          open={isKnowledgeChatOpen}
          onOpenChange={setIsKnowledgeChatOpen}
          outlines={outlines}
          currentOutlineId={currentOutlineId}
        />

        <QuickCaptureDialog
          open={isQuickCaptureOpen}
          onOpenChange={setIsQuickCaptureOpen}
          onCapture={handleQuickCapture}
        />
        <SecondBrainDashboardDialog
          open={isSecondBrainDashboardOpen}
          onOpenChange={(o) => { setIsSecondBrainDashboardOpen(o); if (!o) setSecondBrainSearchFocus(false); }}
          secondBrain={outlines.find(o => o.isSecondBrain) || null}
          onOpenSecondBrain={handleOpenSecondBrain}
          onJumpToNode={handleJumpToSecondBrainNode}
          autoFocusSearch={secondBrainSearchFocus}
        />

        {currentOutline && (
          <ExportDialog
            open={exportDialogOpen}
            onOpenChange={setExportDialogOpen}
            outline={currentOutline}
            rootNodeId={exportNodeId || undefined}
            nodeName={exportNodeId ? currentOutline.nodes[exportNodeId]?.name : undefined}
          />
        )}

        {podcastNodeId && currentOutline && (
          <PodcastDialog
            open={podcastDialogOpen}
            onOpenChange={(open) => { setPodcastDialogOpen(open); if (!open) setPodcastNodeId(null); }}
            nodeName={currentOutline.nodes[podcastNodeId]?.name || ''}
            nodeId={podcastNodeId}
            nodes={currentOutline.nodes}
          />
        )}

        <TemplatesDialog
          open={isTemplatesDialogOpen}
          onOpenChange={setIsTemplatesDialogOpen}
          onCreateFromTemplate={handleCreateFromTemplate}
        />

        <MobileSidebarSheet
          open={isMobileSidebarOpen}
          onOpenChange={setIsMobileSidebarOpen}
          outlines={outlines}
          currentOutlineId={currentOutlineId}
          onSelectOutline={handleSelectOutline}
          onCreateOutline={handleCreateOutline}
          onCreateFromTemplate={handleCreateFromTemplate}
          onDeleteOutline={handleDeleteOutline}
          onRenameOutline={handleRenameOutline}
          onOpenGuide={handleOpenGuide}
          onShowWelcome={handleShowWelcome}
        />

        <AlertDialog open={prefixDialogState.open} onOpenChange={(open) => setPrefixDialogState(s => ({ ...s, open }))}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Item Prefix</AlertDialogTitle>
              <AlertDialogDescription>
                The numeric prefix for the item "<strong>{prefixDialogState.nodeName}</strong>" is: <strong>{prefixDialogState.prefix}</strong>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setPrefixDialogState({ open: false, prefix: '', nodeName: '' })}>Close</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Loading Large Outline progress indicator */}
        {progressIndicator}

        {/* Migration Conflict Dialog */}
        <AlertDialog open={conflictDialog.open}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>File Already Exists</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div><strong>{conflictDialog.conflict?.fileName}</strong> already exists in the target folder.</div>
                  <div className="text-sm">
                    <strong>Your version:</strong> {conflictDialog.conflict?.localOutline.name}
                  </div>
                  <div className="text-sm">
                    <strong>Existing version:</strong> {conflictDialog.conflict?.existingOutline.name}
                  </div>
                  <div className="mt-2">What would you like to do?</div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="destructive"
                onClick={() => {
                  conflictDialog.resolve?.('overwrite');
                  setConflictDialog({ open: false, conflict: null, resolve: null });
                }}
              >
                Overwrite
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  conflictDialog.resolve?.('keep_existing');
                  setConflictDialog({ open: false, conflict: null, resolve: null });
                }}
              >
                Keep Existing
              </Button>
              <Button
                variant="default"
                onClick={() => {
                  conflictDialog.resolve?.('keep_both');
                  setConflictDialog({ open: false, conflict: null, resolve: null });
                }}
              >
                Keep Both
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Pending Imports Recovery Dialog */}
        <AlertDialog open={pendingImportDialogOpen} onOpenChange={setPendingImportDialogOpen}>
          <AlertDialogContent className="max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Recovered Research Import{pendingImports.length > 1 ? 's' : ''}</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <div>
                    {pendingImports.length === 1
                      ? 'A Research & Import operation finished in the background after the app closed or the request timed out. The result was saved automatically. You can apply it now or dismiss it.'
                      : `${pendingImports.length} Research & Import operations finished in the background after the app closed or timed out. Their results were saved automatically. You can apply each one or dismiss it.`
                    }
                  </div>
                  {pendingImports.map((pending) => {
                    const mergeTarget = pending.mergeContext?.includeExistingContent && pending.mergeContext.targetOutlineId
                      ? outlines.find(o => o.id === pending.mergeContext?.targetOutlineId)
                      : null;
                    return (
                    <div key={pending.fileName} className="p-3 bg-muted rounded-lg space-y-2">
                      <div className="font-medium text-foreground">{pending.outlineName}</div>
                      <div className="text-xs text-muted-foreground">
                        {Object.keys(pending.outline.nodes).length - 1} nodes •
                        Completed {(() => { const d = new Date(pending.createdAt); return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear() % 100}`; })()}
                      </div>
                      {mergeTarget ? (
                        <div className="text-xs text-blue-600 dark:text-blue-400">
                          → Ready to merge into &quot;{mergeTarget.name}&quot;
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          Will be added as a new outline
                        </div>
                      )}
                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          onClick={() => handleRecoverPendingImport(pending)}
                        >
                          {mergeTarget ? 'Apply Merge' : 'Add Outline'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDismissPendingImport(pending)}
                        >
                          Discard
                        </Button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button variant="ghost" onClick={() => setPendingImportDialogOpen(false)}>
                Close
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {mobileView === 'stacked' ? (
          /* Stacked layout: Outline (70%) + Content Preview (30%) */
          <div className="flex flex-col h-full">
            {/* Outline Pane - takes ~70% */}
            <div className="flex-[7] min-h-0 overflow-hidden border-b">
              <OutlinePane
                outlines={outlines}
                currentOutline={currentOutline}
                selectedNodeId={selectedNodeId}
                onSelectOutline={handleSelectOutline}
                onCreateOutline={handleCreateOutline}
                onRenameOutline={handleRenameOutline}
                onDeleteOutline={handleDeleteOutline}
                onSelectNode={(id, navigate) => handleSelectNode(id, navigate)}
                onMoveNode={handleMoveNode}
                onToggleCollapse={handleToggleCollapse}
                onCollapseAll={handleCollapseAll}
                onExpandAll={handleExpandAll}
                onExpandAncestors={handleExpandAncestors}
                onApplySearchView={handleApplySearchView}
                onCreateNode={handleCreateNode}
                onDeleteNode={handleDeleteNode}
                onGenerateOutline={handleGenerateOutline}
                onOpenBulkResearch={() => setIsBulkResearchOpen(true)}
                onUpdateNode={handleUpdateNode}
                onImportOutline={handleImportOutline}
                onAddImportedOutline={handleAddImportedOutline}
                onExportOutline={handleExportOutline}
                onCopySubtree={handleCopySubtree}
                onCutSubtree={handleCutSubtree}
                onPasteSubtree={handlePasteSubtree}
                onDuplicateNode={handleDuplicateNode}
                hasClipboard={subtreeClipboard !== null}
                onFolderSelected={handleFolderSelected}
                isLoadingAI={isLoadingAI}
                onCancelAI={handleCancelAI}
                externalSearchOpen={isSearchOpen}
                onSearchOpenChange={setIsSearchOpen}
                onGenerateContentForChildren={handleGenerateContentForChildren}
                onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
                onOpenHelp={() => setIsHelpChatOpen(true)}
                onOpenKnowledgeChat={() => setIsKnowledgeChatOpen(true)}
                onOpenLiveBooks={() => setIsLiveBooksOpen(true)}
                onOpenTranslate={() => setIsTranslateOpen(true)}
                onOpenReformat={() => {
                  setReformatSelectionHtml(null);
                  setReformatApplySelectionFn(null);
                  setIsReformatOpen(true);
                }}
                onOpenTransformOutline={() => setIsTransformOutlineOpen(true)}
          onOpenImageToOutline={() => setIsImageToOutlineOpen(true)}
          onOpenYoutubePackage={() => setIsYoutubePackageOpen(true)}
          onOpenGenerateVideo={handleOpenGenerateVideo}
                onCreateChildNode={handleCreateSiblingNode}
                justCreatedNodeId={justCreatedNodeIdRef.current}
                editingNodeId={editingNodeId}
                onEditingComplete={() => setEditingNodeId(null)}
                onTriggerEdit={setEditingNodeId}
                selectedNodeIds={selectedNodeIds}
                onToggleNodeSelection={handleToggleNodeSelection}
                onRangeSelect={handleRangeSelect}
                onClearSelection={handleClearSelection}
                onBulkDelete={handleBulkDelete}
                onBulkChangeColor={handleBulkChangeColor}
                onBulkAddTag={handleBulkAddTag}
                onSearchTermChange={handleSearchTermChange}
                onExportSubtree={handleExportSubtree}
                onSaveToSecondBrain={handleSaveToSecondBrain}
                onOpenSecondBrain={handleOpenSecondBrain}
                onSearchSecondBrain={handleSearchSecondBrain}
                onSearchSecondBrainLocal={handleOpenSecondBrainSearch}
                onOpenQuickCapture={handleOpenQuickCapture}
                onOpenSecondBrainDashboard={handleOpenSecondBrainDashboard}
                onImportToSecondBrain={handleImportToSecondBrain}
                onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
                canUnmerge={hasUnmergeBackup}
                onUnmerge={handleUnmerge}
                isFocusMode={isFocusMode}
                onToggleFocusMode={() => setIsFocusMode(prev => !prev)}
                onOpenLinkToOutline={() => setIsOutlineLinkPickerOpen(true)}
                onOpenBackup={() => {
                  setBackupRestoreInitialTab('backup');
                  setIsBackupRestoreOpen(true);
                }}
                onOpenRestore={() => {
                  setBackupRestoreInitialTab('restore');
                  setIsBackupRestoreOpen(true);
                }}
              />
            </div>
            {/* Content Preview - takes ~30%, tap to expand */}
            <div
              className="flex-[3] min-h-0 overflow-hidden bg-background cursor-pointer active:bg-accent/10"
              onClick={() => setMobileView('content')}
              onTouchEnd={(e) => {
                e.preventDefault();
                setMobileView('content');
              }}
            >
              <div className="h-full flex flex-col">
                {/* Preview header with node name */}
                <div className="flex-shrink-0 px-4 py-2 border-b bg-muted/30 flex items-center justify-between">
                  <span className="font-semibold truncate text-sm">
                    {selectedNode?.name || 'Select a node'}
                  </span>
                  <span className="text-xs text-muted-foreground">Tap to expand</span>
                </div>
                {/* Preview content - limited height with fade */}
                <div className="flex-1 overflow-hidden relative px-4 py-2">
                  <div
                    className="text-sm text-muted-foreground line-clamp-4"
                    dangerouslySetInnerHTML={{
                      __html: typeof window !== 'undefined'
                        ? DOMPurify.sanitize(selectedNode?.content || '<p class="italic">No content yet</p>')
                        : (selectedNode?.content || '<p class="italic">No content yet</p>')
                    }}
                  />
                  {/* Fade overlay at bottom */}
                  <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Full screen content view */
          <ContentPane
            node={selectedNode}
            nodes={currentOutline?.nodes}
            ancestorPath={selectedNodeAncestorPath}
            onUpdate={handleUpdateNode}
            onBack={() => setMobileView('stacked')}
            onExpandContent={handleExpandContent}
            onGenerateContent={handleGenerateContentForNode}
            onGenerateContentForDescendants={handleGenerateContentForChildren}
            isLoadingAI={isLoadingAI}
            searchTerm={searchTerm}
            currentMatchIndex={currentMatchIndex}
            currentMatchType={currentMatchType}
            isGuide={currentOutline?.isGuide ?? false}
            onCopyOutline={handleCopyOutline}
            onOpenReformat={(args) => {
              if (args) {
                setReformatSelectionHtml(args.selectionHtml);
                setReformatApplySelectionFn(() => args.applySelection);
              } else {
                setReformatSelectionHtml(null);
                setReformatApplySelectionFn(null);
              }
              setIsReformatOpen(true);
            }}
          />
        )}
      </div>
    );
  }


  return (
    <div className="flex h-screen w-full">
      <WelcomeShowcase />
      {/* Collapsible Sidebar */}
      {isSidebarOpen && (
        <div className="relative flex-shrink-0" style={{ width: sidebarWidth }}>
          <SidebarPane
            outlines={outlines}
            currentOutlineId={currentOutlineId}
            onSelectOutline={handleSelectOutline}
            onCreateOutline={handleCreateOutline}
            onCreateFromTemplate={handleCreateFromTemplate}
            onDeleteOutline={handleDeleteOutline}
            onRenameOutline={handleRenameOutline}
            onOpenGuide={handleOpenGuide}
            onShowWelcome={handleShowWelcome}
          />
          {/* Resize handle */}
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors"
            onMouseDown={handleSidebarMouseDown}
          />
        </div>
      )}

      {/* Main content area */}
      <ResizablePanelGroup direction="horizontal" className="h-screen flex-1 rounded-none border-none" onLayout={handlePanelResize}>
      {/* Hidden file input for import */}
      <input
        type="file"
        ref={importFileInputRef}
        onChange={handleImportFileChange}
        accept=".json,.idm,application/json,application/octet-stream"
        className="hidden"
      />

      {/* Command Palette */}
      <CommandPalette
        onAICommand={handleAICommand}
        open={isCommandPaletteOpen}
        onOpenChange={setIsCommandPaletteOpen}
        outlines={outlines}
        currentOutlineId={currentOutlineId}
        selectedNodeId={selectedNodeId}
        onSelectOutline={handleSelectOutline}
        onCreateOutline={handleCreateOutline}
        onCreateNode={() => handleCreateNode()}
        onDuplicateNode={handleDuplicateNode}
        onDeleteNode={handleDeleteNode}
        onCollapseAll={handleCollapseAll}
        onExpandAll={handleExpandAll}
        onOpenSearch={handleOpenSearch}
        onExportOutline={handleExportOutline}
        onImportOutline={handleImportOutlineTrigger}
        onToggleFocusMode={() => setIsFocusMode(prev => !prev)}
        onShowShortcuts={() => setIsShortcutsOpen(true)}
        onOpenBulkResearch={() => setIsBulkResearchOpen(true)}
        onOpenLiveBooks={() => setIsLiveBooksOpen(true)}
        onOpenTemplates={() => setIsTemplatesDialogOpen(true)}
        isGuide={currentOutline?.isGuide ?? false}
        isFocusMode={isFocusMode}
      />

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsDialog
        open={isShortcutsOpen}
        onOpenChange={setIsShortcutsOpen}
      />

      <BulkResearchDialog
        open={isBulkResearchOpen}
        onOpenChange={setIsBulkResearchOpen}
        onSubmit={handleBulkResearch}
        currentOutlineName={currentOutline?.name}
      />

      <LiveBooksDialog
        open={isLiveBooksOpen}
        onOpenChange={setIsLiveBooksOpen}
        outline={currentOutline}
        selectedNodeId={selectedNodeId}
        onApply={handleApplyLiveBooks}
        useLocalAI={liveBooksUseLocal}
      />

      <TranslateDialog
        open={isTranslateOpen}
        onOpenChange={setIsTranslateOpen}
        outline={currentOutline}
        selectedNodeId={selectedNodeId}
        onApply={handleApplyTranslate}
      />

      <ImageToOutlineDialog
        open={isImageToOutlineOpen}
        onOpenChange={setIsImageToOutlineOpen}
        outline={currentOutline}
        selectedNodeId={selectedNodeId}
        onApply={handleApplyImageToOutline}
      />

      <YoutubePackageDialog
        open={isYoutubePackageOpen}
        onOpenChange={setIsYoutubePackageOpen}
        outline={currentOutline}
        selectedNodeId={selectedNodeId}
        onExportMarkdown={handleExportYoutubeMarkdown}
        onSaveAsOutline={handleSaveYoutubeAsOutline}
      />

      <GenerateVideoDialog
        open={isGenerateVideoOpen}
        onOpenChange={setIsGenerateVideoOpen}
        outline={currentOutline}
        selectedNodeId={selectedNodeId}
      />

      <ReformatDialog
        open={isReformatOpen}
        onOpenChange={(o) => {
          setIsReformatOpen(o);
          if (!o) {
            setReformatSelectionHtml(null);
            setReformatApplySelectionFn(null);
          }
        }}
        contentHtml={reformatContentForDialog}
        scopeLabel={reformatScopeLabel}
        onApply={handleApplyReformat}
      />

      <TransformOutlineDialog
        open={isTransformOutlineOpen}
        onOpenChange={setIsTransformOutlineOpen}
        nodes={currentOutline?.nodes ?? null}
        rootNodeId={transformScopeRootId}
        scopeLabel={transformScopeLabel}
        outlineName={currentOutline?.name}
        onApply={handleApplyTransformOutline}
      />

      {/* Backup / Restore — desktop layout copy. This was previously only
          rendered in the mobile-layout branch, so on desktop the Backup toolbar
          button flipped the open state but no dialog was mounted to show it,
          making the manual Backup/Restore feature dead on desktop/web. */}
      <BackupRestoreDialog
        open={isBackupRestoreOpen}
        onOpenChange={setIsBackupRestoreOpen}
        initialTab={backupRestoreInitialTab}
        outline={currentOutline}
        onRestore={handleRestoreFromSnapshot}
      />

      <OutlineLinkPickerDialog
        open={isOutlineLinkPickerOpen}
        onOpenChange={setIsOutlineLinkPickerOpen}
        outlines={outlines}
        currentOutlineId={currentOutlineId}
        onPick={handleInsertOutlineLink}
      />

      <TemplatesDialog
        open={isTemplatesDialogOpen}
        onOpenChange={setIsTemplatesDialogOpen}
        onCreateFromTemplate={handleCreateFromTemplate}
      />

      <AIConsentDialog
        open={aiConsentDialogOpen}
        onConsent={handleAiConsentGranted}
        onDecline={handleAiConsentDeclined}
      />

      <HelpChatDialog
        open={isHelpChatOpen}
        onOpenChange={setIsHelpChatOpen}
      />

      <KnowledgeChatDialog
        open={isKnowledgeChatOpen}
        onOpenChange={setIsKnowledgeChatOpen}
        outlines={outlines}
        currentOutlineId={currentOutlineId}
      />

      <QuickCaptureDialog
        open={isQuickCaptureOpen}
        onOpenChange={setIsQuickCaptureOpen}
        onCapture={handleQuickCapture}
      />
      <SecondBrainDashboardDialog
        open={isSecondBrainDashboardOpen}
        onOpenChange={(o) => { setIsSecondBrainDashboardOpen(o); if (!o) setSecondBrainSearchFocus(false); }}
        secondBrain={outlines.find(o => o.isSecondBrain) || null}
        onOpenSecondBrain={handleOpenSecondBrain}
        onJumpToNode={handleJumpToSecondBrainNode}
        autoFocusSearch={secondBrainSearchFocus}
      />

      {currentOutline && (
        <ExportDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          outline={currentOutline}
          rootNodeId={exportNodeId || undefined}
          nodeName={exportNodeId ? currentOutline.nodes[exportNodeId]?.name : undefined}
        />
      )}

      {podcastNodeId && currentOutline && (
        <PodcastDialog
          open={podcastDialogOpen}
          onOpenChange={(open) => { setPodcastDialogOpen(open); if (!open) setPodcastNodeId(null); }}
          nodeName={currentOutline.nodes[podcastNodeId]?.name || ''}
          nodeId={podcastNodeId}
          nodes={currentOutline.nodes}
        />
      )}

      <AlertDialog open={prefixDialogState.open} onOpenChange={(open) => setPrefixDialogState(s => ({ ...s, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Item Prefix</AlertDialogTitle>
            <AlertDialogDescription>
              The numeric prefix for the item "<strong>{prefixDialogState.nodeName}</strong>" is: <strong>{prefixDialogState.prefix}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setPrefixDialogState({ open: false, prefix: '', nodeName: '' })}>Close</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Migration Conflict Dialog */}
      <AlertDialog open={conflictDialog.open}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>File Already Exists</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div><strong>{conflictDialog.conflict?.fileName}</strong> already exists in the target folder.</div>
                <div className="text-sm">
                  <strong>Your version:</strong> {conflictDialog.conflict?.localOutline.name}
                </div>
                <div className="text-sm">
                  <strong>Existing version:</strong> {conflictDialog.conflict?.existingOutline.name}
                </div>
                <div className="mt-2">What would you like to do?</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="destructive"
              onClick={() => {
                conflictDialog.resolve?.('overwrite');
                setConflictDialog({ open: false, conflict: null, resolve: null });
              }}
            >
              Overwrite
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                conflictDialog.resolve?.('keep_existing');
                setConflictDialog({ open: false, conflict: null, resolve: null });
              }}
            >
              Keep Existing
            </Button>
            <Button
              variant="default"
              onClick={() => {
                conflictDialog.resolve?.('keep_both');
                setConflictDialog({ open: false, conflict: null, resolve: null });
              }}
            >
              Keep Both
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pending Imports Recovery Dialog */}
      <AlertDialog open={pendingImportDialogOpen} onOpenChange={setPendingImportDialogOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Recovered Import{pendingImports.length > 1 ? 's' : ''}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div>
                  {pendingImports.length === 1
                    ? 'A previously timed-out import has been recovered:'
                    : `${pendingImports.length} previously timed-out imports have been recovered:`
                  }
                </div>
                {pendingImports.map((pending) => {
                  const mergeTarget = pending.mergeContext?.includeExistingContent && pending.mergeContext.targetOutlineId
                    ? outlines.find(o => o.id === pending.mergeContext?.targetOutlineId)
                    : null;
                  return (
                  <div key={pending.fileName} className="p-3 bg-muted rounded-lg space-y-2">
                    <div className="font-medium text-foreground">{pending.outlineName}</div>
                    <div className="text-xs text-muted-foreground">
                      {Object.keys(pending.outline.nodes).length - 1} nodes •
                      Completed {(() => { const d = new Date(pending.createdAt); return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear() % 100}`; })()}
                    </div>
                    {mergeTarget && (
                      <div className="text-xs text-blue-600 dark:text-blue-400">
                        → Will merge into &quot;{mergeTarget.name}&quot;
                      </div>
                    )}
                    <div className="flex gap-2 mt-2">
                      <Button
                        size="sm"
                        onClick={() => handleRecoverPendingImport(pending)}
                      >
                        {mergeTarget ? 'Merge' : 'Recover'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDismissPendingImport(pending)}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                  );
                })}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="ghost" onClick={() => setPendingImportDialogOpen(false)}>
              Close
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Focus Mode: Full-screen content only */}
      {isFocusMode ? (
        <div className="h-full w-full relative">
          {/* Focus mode indicator */}
          <div className="absolute top-4 right-4 z-10 px-3 py-1.5 bg-primary/10 text-primary text-xs rounded-full font-medium flex items-center gap-2">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            Focus Mode
            <span className="text-muted-foreground ml-1">Esc to exit</span>
          </div>
          <ContentPane
            node={selectedNode}
            nodes={currentOutline?.nodes}
            ancestorPath={selectedNodeAncestorPath}
            onUpdate={handleUpdateNode}
            onExpandContent={handleExpandContent}
            onGenerateContent={handleGenerateContentForNode}
            onGenerateContentForDescendants={handleGenerateContentForChildren}
            isLoadingAI={isLoadingAI}
            searchTerm={searchTerm}
            currentMatchIndex={currentMatchIndex}
            currentMatchType={currentMatchType}
            isGuide={currentOutline?.isGuide ?? false}
            onCopyOutline={handleCopyOutline}
            onOpenReformat={(args) => {
              if (args) {
                setReformatSelectionHtml(args.selectionHtml);
                setReformatApplySelectionFn(() => args.applySelection);
              } else {
                setReformatSelectionHtml(null);
                setReformatApplySelectionFn(null);
              }
              setIsReformatOpen(true);
            }}
          />
        </div>
      ) : (
        <>
          <ResizablePanel defaultSize={outlinePanelSize} minSize={20}>
            <div className="h-full overflow-hidden">
              <OutlinePane
                outlines={outlines}
                currentOutline={currentOutline}
                selectedNodeId={selectedNodeId}
                onSelectOutline={handleSelectOutline}
                onCreateOutline={handleCreateOutline}
                onRenameOutline={handleRenameOutline}
                onDeleteOutline={handleDeleteOutline}
                onSelectNode={(id, navigate) => handleSelectNode(id, navigate)}
                onMoveNode={handleMoveNode}
                onToggleCollapse={handleToggleCollapse}
                onCollapseAll={handleCollapseAll}
                onExpandAll={handleExpandAll}
                onExpandAncestors={handleExpandAncestors}
                onApplySearchView={handleApplySearchView}
                onCreateNode={handleCreateNode}
                onDeleteNode={handleDeleteNode}
                onGenerateOutline={handleGenerateOutline}
                onOpenBulkResearch={() => setIsBulkResearchOpen(true)}
                onUpdateNode={handleUpdateNode}
                onImportOutline={handleImportOutline}
                onAddImportedOutline={handleAddImportedOutline}
                onExportOutline={handleExportOutline}
                onCopySubtree={handleCopySubtree}
                onCutSubtree={handleCutSubtree}
                onPasteSubtree={handlePasteSubtree}
                onDuplicateNode={handleDuplicateNode}
                hasClipboard={subtreeClipboard !== null}
                onFolderSelected={handleFolderSelected}
                isLoadingAI={isLoadingAI}
                onCancelAI={handleCancelAI}
                externalSearchOpen={isSearchOpen}
                onSearchOpenChange={setIsSearchOpen}
                onGenerateContentForChildren={handleGenerateContentForChildren}
                onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
                onOpenHelp={() => setIsHelpChatOpen(true)}
                onOpenKnowledgeChat={() => setIsKnowledgeChatOpen(true)}
                onOpenLiveBooks={() => setIsLiveBooksOpen(true)}
                onOpenTranslate={() => setIsTranslateOpen(true)}
                onOpenReformat={() => {
                  setReformatSelectionHtml(null);
                  setReformatApplySelectionFn(null);
                  setIsReformatOpen(true);
                }}
                onOpenTransformOutline={() => setIsTransformOutlineOpen(true)}
          onOpenImageToOutline={() => setIsImageToOutlineOpen(true)}
          onOpenYoutubePackage={() => setIsYoutubePackageOpen(true)}
          onOpenGenerateVideo={handleOpenGenerateVideo}
                onCreateChildNode={handleCreateSiblingNode}
                justCreatedNodeId={justCreatedNodeIdRef.current}
                editingNodeId={editingNodeId}
                onEditingComplete={() => setEditingNodeId(null)}
                onTriggerEdit={setEditingNodeId}
                selectedNodeIds={selectedNodeIds}
                onToggleNodeSelection={handleToggleNodeSelection}
                onRangeSelect={handleRangeSelect}
                onClearSelection={handleClearSelection}
                onBulkDelete={handleBulkDelete}
                onBulkChangeColor={handleBulkChangeColor}
                onBulkAddTag={handleBulkAddTag}
                onSearchTermChange={handleSearchTermChange}
                onExportSubtree={handleExportSubtree}
                onSaveToSecondBrain={handleSaveToSecondBrain}
                onOpenSecondBrain={handleOpenSecondBrain}
                onSearchSecondBrain={handleSearchSecondBrain}
                onSearchSecondBrainLocal={handleOpenSecondBrainSearch}
                onOpenQuickCapture={handleOpenQuickCapture}
                onOpenSecondBrainDashboard={handleOpenSecondBrainDashboard}
                onImportToSecondBrain={handleImportToSecondBrain}
                isSidebarOpen={isSidebarOpen}
                onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
                canUnmerge={hasUnmergeBackup}
                onUnmerge={handleUnmerge}
                isFocusMode={isFocusMode}
                onToggleFocusMode={() => setIsFocusMode(prev => !prev)}
                onOpenLinkToOutline={() => setIsOutlineLinkPickerOpen(true)}
                onOpenBackup={() => {
                  setBackupRestoreInitialTab('backup');
                  setIsBackupRestoreOpen(true);
                }}
                onOpenRestore={() => {
                  setBackupRestoreInitialTab('restore');
                  setIsBackupRestoreOpen(true);
                }}
              />
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={100 - outlinePanelSize} minSize={30}>
            <div className="h-full overflow-auto">
              <ContentPane
                node={selectedNode}
                nodes={currentOutline?.nodes}
                ancestorPath={selectedNodeAncestorPath}
                onUpdate={handleUpdateNode}
                onExpandContent={handleExpandContent}
                onGenerateContent={handleGenerateContentForNode}
                onGenerateContentForDescendants={handleGenerateContentForChildren}
                isLoadingAI={isLoadingAI}
                searchTerm={searchTerm}
                currentMatchIndex={currentMatchIndex}
                currentMatchType={currentMatchType}
                isGuide={currentOutline?.isGuide ?? false}
                onCopyOutline={handleCopyOutline}
                onOpenReformat={(args) => {
                  if (args) {
                    setReformatSelectionHtml(args.selectionHtml);
                    setReformatApplySelectionFn(() => args.applySelection);
                  } else {
                    setReformatSelectionHtml(null);
                    setReformatApplySelectionFn(null);
                  }
                  setIsReformatOpen(true);
                }}
              />
            </div>
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
    {/* Unified confirmation dialog (Don't-ask-again + Pro mode). 2026-06-10. */}
    {confirmDialogEl}
    </div>
  );
}
