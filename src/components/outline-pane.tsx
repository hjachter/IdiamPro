'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { Outline, OutlineNode, NodeMap, ExternalSourceInput, IngestPreview, AIDepth, AITone, AILevel } from '@/types';
import NodeItem from './node-item';
import AIMenu from './ai-menu';
import OutlineSearch, { type SearchMatch } from './outline-search';
import { MultiSelectToolbar } from './multi-select-toolbar';
import FileImportDialog from './file-import-dialog';
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { Plus, Trash2, FileDown, FileUp, Library, RotateCcw, ChevronsUp, ChevronsDown, ChevronsDownUp, Settings, Search, Command, PanelLeft, PanelLeftClose, Brain, StopCircle, Inbox, LayoutDashboard, Focus, Sparkles, Mic, MessageSquare, BookDown, BookUp, Share2, ExternalLink, RefreshCw, MoreHorizontal, HelpCircle, Send, ShieldCheck, GitFork, Video, ChevronDown, Sun, Moon, Info, User } from 'lucide-react';
import { AmplifyMark } from '@/components/brand/amplify-mark';
import { useTheme } from 'next-themes';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useDiscovery } from "@/hooks/use-discovery";
import SettingsDialog from './settings-dialog';
import type { NodeType } from '@/types';
import { exportOutlineToJson, exportAllOutlinesToJson, shareBackupFile, shareOutlineFile } from '@/lib/export';
import { loadStorageData, saveAllOutlines } from '@/lib/storage-manager';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { AppUserButton } from '@/lib/auth/user-button';
import { ReportIssueButton, ReportIssueMenuItem } from '@/components/report-issue-button';

// Check if running in Capacitor native app (not just mobile browser)
function isCapacitor(): boolean {
  return typeof window !== 'undefined' && !!(window as any).Capacitor;
}

// Format relative time (e.g., "2h ago", "3d ago")
function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  if (weeks > 0) return `${weeks}w ago`;
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

// Get previous sibling of a node
const getPreviousSibling = (nodes: NodeMap, nodeId: string): string | null => {
  const node = nodes[nodeId];
  if (!node || !node.parentId) return null;
  const parent = nodes[node.parentId];
  if (!parent || !parent.childrenIds) return null;
  const index = parent.childrenIds.indexOf(nodeId);
  if (index <= 0) return null;
  return parent.childrenIds[index - 1];
};

// Check if node can be indented (has a previous sibling to become its parent)
const canIndent = (nodes: NodeMap, nodeId: string): boolean => {
  const node = nodes[nodeId];
  if (!node || node.type === 'root') return false;
  return getPreviousSibling(nodes, nodeId) !== null;
};

// Check if node can be outdented (parent is not root)
const canOutdent = (nodes: NodeMap, nodeId: string, rootNodeId: string): boolean => {
  const node = nodes[nodeId];
  if (!node || node.type === 'root' || !node.parentId) return false;
  // Can outdent if parent is not the root
  return node.parentId !== rootNodeId;
};


// Helper to get path from root to a node (for expanding ancestors)
function getPathToNode(nodes: NodeMap, nodeId: string): string[] {
  const path: string[] = [];
  let current = nodes[nodeId];
  while (current && current.parentId) {
    path.unshift(current.parentId);
    current = nodes[current.parentId];
  }
  return path;
}

interface OutlinePaneProps {
  outlines: Outline[];
  currentOutline: Outline | undefined;
  selectedNodeId: string | null;
  onSelectOutline: (id: string) => void;
  onCreateOutline: () => void;
  onRenameOutline: (id: string, newName: string) => void;
  onDeleteOutline: (id: string) => void;
  onSelectNode: (id: string, navigate?: boolean) => void;
  onMoveNode: (draggedId: string, targetId: string, position: 'before' | 'after' | 'inside') => void;
  onToggleCollapse: (id: string) => void;
  onCollapseAll: (nodeId?: string) => void;
  onExpandAll: (nodeId?: string) => void;
  onCreateNode: (type?: NodeType, content?: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onGenerateOutline: (topic: string, depth: AIDepth, tone: AITone, level: AILevel) => Promise<void>;
  onOpenBulkResearch: () => void;
  onUpdateNode: (nodeId: string, updates: Partial<OutlineNode>) => void;
  onImportOutline: (file: File) => void;
  onAddImportedOutline: (outline: Outline, showToast?: boolean) => void;
  onExportOutline: () => void;
  onCopySubtree: (nodeId: string) => void;
  onCutSubtree: (nodeId: string) => void;
  onPasteSubtree: (targetNodeId: string) => void;
  onDuplicateNode: (nodeId: string) => void;
  hasClipboard: boolean;
  onFolderSelected?: () => void;
  isLoadingAI: boolean;
  onCancelAI?: () => void;
  // Search-related props for expanding ancestors
  onExpandAncestors?: (nodeIds: string[]) => void;
  // Search-as-view-shaper: reshape outline so matches + ancestors stay expanded
  // and every other branch is collapsed (every node still renders as a row).
  onApplySearchView?: (matchedNodeIds: string[]) => void;
  // External control for search (for command palette)
  externalSearchOpen?: boolean;
  onSearchOpenChange?: (open: boolean) => void;
  // AI content generation for children
  onGenerateContentForChildren?: (nodeId: string) => void;
  // Applications (one-click automated workflows)
  onOpenApplications?: () => void;
  // Command palette
  onOpenCommandPalette?: () => void;
  // Help chat
  onOpenHelp?: () => void;
  // Knowledge chat
  onOpenKnowledgeChat?: () => void;
  // LIVE BOOKS — manual AI refresh of a node subtree
  onOpenLiveBooks?: () => void;
  // Translate — language translation of a node subtree (#52)
  onOpenTranslate?: () => void;
  // Reformat with AI — single-node content reformat per natural-language instruction
  onOpenReformat?: () => void;
  // Transform outline with AI — whole-subtree structural transformation per natural-language instruction
  onOpenTransformOutline?: () => void;
  // Multimedia AI (2026-06-11) — Capture from image, Share as YouTube package
  onOpenImageToOutline?: () => void;
  onOpenYoutubePackage?: () => void;
  onOpenGenerateVideo?: () => void;
  // Double-click child node creation
  onCreateChildNode?: (parentId: string) => void;
  // Edit mode control
  justCreatedNodeId?: string | null;
  editingNodeId?: string | null;
  onEditingComplete?: () => void;
  onTriggerEdit?: (nodeId: string) => void;
  // Multi-select
  selectedNodeIds?: Set<string>;
  onToggleNodeSelection?: (nodeId: string, isCtrlClick: boolean) => void;
  onRangeSelect?: (nodeId: string) => void;
  onClearSelection?: () => void;
  onBulkDelete?: () => void;
  onBulkChangeColor?: (color: string | undefined) => void;
  onBulkAddTag?: (tag: string) => void;
  // Search term for content highlighting
  onSearchTermChange?: (searchTerm: string, matchType?: 'name' | 'content' | 'both', matchIndex?: number) => void;
  // Export subtree
  onExportSubtree?: (nodeId: string) => void;
  // Save to Second Brain
  onSaveToSecondBrain?: (nodeId: string) => void;
  // Second Brain navigation
  onOpenSecondBrain?: () => void;
  onSearchSecondBrain?: () => void;
  /** FREE instant local keyword search of the Second Brain (no AI, no cost). */
  onSearchSecondBrainLocal?: () => void;
  onImportToSecondBrain?: () => void;
  onOpenQuickCapture?: () => void;
  onOpenSecondBrainDashboard?: () => void;
  // Sidebar toggle (desktop)
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  // Mobile sidebar sheet
  onOpenMobileSidebar?: () => void;
  // Unmerge button
  canUnmerge?: boolean;
  onUnmerge?: () => void;
  // Focus Mode
  isFocusMode?: boolean;
  onToggleFocusMode?: () => void;
  // Cross-outline link picker (Phase 1, 2026-06-04)
  onOpenLinkToOutline?: () => void;
  // Backup / Restore (2026-06-10) — open the snapshots dialog. When the user
  // clicks the toolbar Backup button we open it on the Backup tab; the
  // dropdown "Restore from backup…" opens it on the Restore tab.
  onOpenBackup?: () => void;
  onOpenRestore?: () => void;
}

export default function OutlinePane({
  outlines,
  currentOutline,
  selectedNodeId,
  onSelectOutline,
  onCreateOutline,
  onRenameOutline,
  onDeleteOutline,
  onSelectNode,
  onMoveNode,
  onToggleCollapse,
  onCollapseAll,
  onExpandAll,
  onCreateNode,
  onDeleteNode,
  onGenerateOutline,
  onOpenBulkResearch,
  onUpdateNode,
  onImportOutline,
  onAddImportedOutline,
  onExportOutline,
  onCopySubtree,
  onCutSubtree,
  onPasteSubtree,
  onDuplicateNode,
  hasClipboard,
  onFolderSelected,
  isLoadingAI,
  onCancelAI,
  onExpandAncestors,
  onApplySearchView,
  externalSearchOpen,
  onSearchOpenChange,
  onGenerateContentForChildren,
  onOpenApplications,
  onOpenCommandPalette,
  onOpenHelp,
  onOpenKnowledgeChat,
  onOpenLiveBooks,
  onOpenTranslate,
  onOpenReformat,
  onOpenTransformOutline,
  onOpenImageToOutline,
  onOpenYoutubePackage,
  onOpenGenerateVideo,
  onCreateChildNode,
  justCreatedNodeId,
  editingNodeId,
  onEditingComplete,
  onTriggerEdit,
  selectedNodeIds,
  onToggleNodeSelection,
  onRangeSelect,
  onClearSelection,
  onBulkDelete,
  onBulkChangeColor,
  onBulkAddTag,
  onSearchTermChange,
  onExportSubtree,
  onSaveToSecondBrain,
  onOpenSecondBrain,
  onSearchSecondBrain,
  onSearchSecondBrainLocal,
  onImportToSecondBrain,
  onOpenQuickCapture,
  onOpenSecondBrainDashboard,
  isSidebarOpen,
  onToggleSidebar,
  onOpenMobileSidebar,
  canUnmerge,
  onUnmerge,
  isFocusMode,
  onToggleFocusMode,
  onOpenLinkToOutline,
  onOpenBackup,
  onOpenRestore,
}: OutlinePaneProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  // Don't-ask-again state for the delete-item confirm (2026-06-10). When the
  // user checks the box + confirms, future deletes skip the dialog. Combined
  // with Professional mode (useDiscovery.isProfessional) which suppresses ALL
  // confirmations globally.
  const [deleteDontAskAgain, setDeleteDontAskAgain] = useState(false);
  const { isProfessional } = useDiscovery();
  const SUPPRESS_KEY = 'confirm.deleteNode.suppressed';
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // const outlinePaneRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  // App-menu "About & version" dialog (2026-07-21)
  const [showAboutDialog, setShowAboutDialog] = useState(false);

  // Collapse/Expand toggle state
  const [isAllCollapsed, setIsAllCollapsed] = useState(false);

  // Action-toolbar responsive overflow (2026-07-10).
  // The middle outline COLUMN can be narrow even on a wide desktop viewport
  // (it sits between the sidebar and the content pane in a resizable layout),
  // so Tailwind's viewport breakpoints don't reflect how much room this
  // toolbar actually has. We measure the toolbar's own width and collapse
  // lower-priority tools into a "More" (⋯) menu when space is tight, so no
  // button is ever clipped off the edges. Same overflow-menu UX as the title
  // row above; here it's column-width-driven instead of viewport-driven.
  const actionToolbarRef = useRef<HTMLDivElement>(null);
  const [actionToolbarWidth, setActionToolbarWidth] = useState<number>(Number.POSITIVE_INFINITY);
  useEffect(() => {
    const el = actionToolbarRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setActionToolbarWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Priority tiers. Only the three essentials (Add, Delete, Search) stay
  // inline at every width — the middle column can be as narrow as ~220px in a
  // 3-pane desktop layout, where nothing else fits. Tier 2 = Focus, Show/Hide
  // all, Share branch, Second Brain, Smart Tools. Tier 3 = Settings, Help.
  // Whatever is collapsed is mirrored in the "More" (⋯) menu.
  // Thresholds raised (2026-07-20) so that whatever stays inline at each tier
  // ALWAYS fits the measured column with margin — the toolbar is now a strict
  // single non-wrapping row, so a threshold that's too low would CLIP a button
  // instead of (as before) wrapping it to an ugly second line. Share moved out
  // of the always-inline set into Tier 2 (it was gated on the sm: VIEWPORT
  // breakpoint, which ignored the pane's true width).
  // FIXED-POSITION toolbar (2026-07-21, per Howard). Buttons hold FIXED spots
  // in a single NON-WRAPPING row and NEVER shuffle as the pane width changes —
  // this is the industry-standard "priority-plus" pattern and it protects
  // muscle memory (the previous flex-wrap moved buttons between rows).
  //   • PINNED, never collapse, never move: New Outline (green, far left),
  //     Search, AI, and Help (red, far right).
  //   • COLLAPSIBLE MIDDLE (between AI and Help), in fixed left-to-right order:
  //     Bring In, Turn Into, Second Brain, Expand/Compress. Only these fold,
  //     and only from the TAIL (Expand collapses first, then Second Brain, then
  //     Turn Into, then Bring In) into a single "⋯ More" menu that appears just
  //     before Help. Deterministic: the same buttons always collapse first.
  // Nothing to the left of the collapsible zone ever moves, so New/Search/AI
  // keep their exact positions at every width. Never wraps, never scrolls.
  const ACTION_MIDDLE_COUNT = 4; // [Bring In, Turn Into, Second Brain, Expand]
  const _aBtn = isMobile ? 50 : 44;                 // one icon button + gap
  const _aReserved =
    (_aBtn + 30) /* New split (chevron half) */ +
    _aBtn /* Search */ + _aBtn /* AI */ + _aBtn /* Help */ +
    14 * 3 /* separators */ + 16 /* container padding margin */;
  let _aAvail = (Number.isFinite(actionToolbarWidth) ? actionToolbarWidth : 100000) - _aReserved;
  let actionMiddleVisible = Math.max(0, Math.min(ACTION_MIDDLE_COUNT, Math.floor(_aAvail / _aBtn)));
  if (actionMiddleVisible < ACTION_MIDDLE_COUNT) {
    _aAvail -= _aBtn; // reserve room for the "More" button
    actionMiddleVisible = Math.max(0, Math.min(ACTION_MIDDLE_COUNT, Math.floor(_aAvail / _aBtn)));
  }
  const showActionMore = actionMiddleVisible < ACTION_MIDDLE_COUNT;
  const showBringIn = actionMiddleVisible >= 1;      // collapses last
  const showTurnInto = actionMiddleVisible >= 2;
  const showSecondBrain = actionMiddleVisible >= 3;
  const showExpand = actionMiddleVisible >= 4;        // collapses first (tail)

  // Header/title-row responsive overflow (2026-07-14 fix).
  // The prior overflow fix (above) only covered the lower ACTION toolbar. The
  // TOP title row (sidebar toggle, title, Quick Command, Import, Export,
  // Backup, Report Issue, avatar) still collapsed on Tailwind VIEWPORT
  // breakpoints (`sm:inline-flex` / `lg:hidden`), which don't reflect how
  // narrow the outline PANE actually is. So on a wide desktop with a
  // compressed pane — or any narrow window — the Import/Export/Backup/Report
  // icons clipped off the edge because their "More" fallback was hidden at
  // desktop viewport widths.
  //
  // We measure the outline PANE's own width (the root container always fills
  // the resizable panel, so its width is the true available room) and drive
  // the header row's collapse off that. At ANY pane/window width nothing is
  // ever clipped: lower-priority controls fold into the "More" (⋯) menu.
  const paneRef = useRef<HTMLDivElement>(null);
  const [paneWidth, setPaneWidth] = useState<number>(Number.POSITIVE_INFINITY);
  useEffect(() => {
    const el = paneRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setPaneWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Show Import / Export / Backup / Report-Issue inline only when the pane is
  // wide enough to fit them alongside the sidebar toggle, title, Quick Command
  // and avatar. Below that they fold into the "More" (⋯) menu, which becomes
  // visible whenever anything is collapsed OR on mobile.
  //
  // We take the MINIMUM of two independent width signals — the pane root and
  // the lower action toolbar (which shrinks/wraps and measures the true
  // usable column width very reliably). If EITHER says the column is narrow,
  // we collapse. This is deliberately conservative: it guarantees icons never
  // clip even if one measurement lags or over-reports. Threshold chosen so a
  // typical narrow 3-pane middle column (~150-360px) always collapses.
  // RESTORED (2026-07-20, per Howard): header/title-row buttons (Import,
  // Export, Backup, Report Issue, etc.) also render INLINE at all widths. The
  // "…" header overflow menu is disabled so nothing from the top row is hidden.
  void paneWidth;
  const showHeaderButtonsInline = true;
  const showHeaderOverflow = false;

  // Search state
  const [isSearchOpenInternal, setIsSearchOpenInternal] = useState(false);
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const prevSearchTermRef = useRef('');
  const currentOutlineRef = useRef(currentOutline);
  currentOutlineRef.current = currentOutline;
  // const [highlightedNodeIds, setHighlightedNodeIds] = useState<Set<string>>(new Set());

  // Progressive rendering for large outlines
  const LARGE_OUTLINE_THRESHOLD = 1000; // Enable progressive rendering for outlines with 1000+ nodes
  const INITIAL_RENDER_DEPTH = 2; // Start by rendering only 2 levels deep

  // Detect large outlines and enable progressive rendering
  const nodeCount = currentOutline ? Object.keys(currentOutline.nodes).length : 0;
  const isLargeOutline = nodeCount > LARGE_OUTLINE_THRESHOLD;

  // Track which outline we've started progressive rendering for
  const [progressiveOutlineId, setProgressiveOutlineId] = useState<string | undefined>(undefined);
  const [renderDepth, setRenderDepth] = useState<number>(INITIAL_RENDER_DEPTH);

  // Compute effective maxRenderDepth - this ensures we NEVER try to render a large outline without limits
  const maxRenderDepth = useMemo(() => {
    if (!isLargeOutline) return undefined; // No limit for small outlines
    if (progressiveOutlineId !== currentOutline?.id) {
      // New large outline - force initial depth limit (state update will follow)
      return INITIAL_RENDER_DEPTH;
    }
    return renderDepth;
  }, [isLargeOutline, progressiveOutlineId, currentOutline?.id, renderDepth]);

  // Reset render depth when switching to a new large outline
  useEffect(() => {
    if (isLargeOutline && progressiveOutlineId !== currentOutline?.id) {
      console.log(`[Progressive] Large outline detected (${nodeCount} nodes), starting at depth ${INITIAL_RENDER_DEPTH}`);
      setProgressiveOutlineId(currentOutline?.id);
      setRenderDepth(INITIAL_RENDER_DEPTH);
    } else if (!isLargeOutline && progressiveOutlineId) {
      setProgressiveOutlineId(undefined);
    }
  }, [currentOutline?.id, progressiveOutlineId, isLargeOutline, nodeCount]);

  // Progressively increase render depth for large outlines
  // For very large outlines (10K+), keep the depth limit to prevent UI freeze
  const VERY_LARGE_THRESHOLD = 10000;
  const isVeryLargeOutline = nodeCount > VERY_LARGE_THRESHOLD;
  const MAX_RENDER_DEPTH = isVeryLargeOutline ? 6 : 10; // Limit depth more for huge outlines

  useEffect(() => {
    if (!isLargeOutline || progressiveOutlineId !== currentOutline?.id) return;

    // Progressively render deeper levels
    const timer = setTimeout(() => {
      if (renderDepth < MAX_RENDER_DEPTH) {
        console.log(`[Progressive] Rendering depth ${renderDepth + 1}... (${nodeCount} nodes)`);
        setRenderDepth(prev => prev + 1);
      } else {
        // For very large outlines, keep the depth limit to prevent freeze
        if (isVeryLargeOutline) {
          console.log(`[Progressive] Keeping depth limit at ${MAX_RENDER_DEPTH} for ${nodeCount} node outline`);
        } else {
          console.log('[Progressive] Full outline rendered');
          setProgressiveOutlineId(undefined); // Remove limit only for moderately large outlines
        }
      }
    }, 500); // Add 500ms between each level

    return () => clearTimeout(timer);
  }, [renderDepth, isLargeOutline, isVeryLargeOutline, MAX_RENDER_DEPTH, nodeCount, progressiveOutlineId, currentOutline?.id]);

  // Compute effective search open state (internal or external)
  const isSearchOpen = externalSearchOpen !== undefined ? externalSearchOpen : isSearchOpenInternal;
  const setIsSearchOpen = useCallback((open: boolean) => {
    if (onSearchOpenChange) {
      onSearchOpenChange(open);
    } else {
      setIsSearchOpenInternal(open);
    }
  }, [onSearchOpenChange]);

  // Clear search when switching outlines
  const prevOutlineIdRef = useRef(currentOutline?.id);
  useEffect(() => {
    if (currentOutline?.id !== prevOutlineIdRef.current) {
      prevOutlineIdRef.current = currentOutline?.id;
      setIsSearchOpen(false);
      setSearchMatches([]);
      setSearchTerm('');
      setCurrentMatchIndex(0);
      prevSearchTermRef.current = '';
      if (onSearchTermChange) {
        onSearchTermChange('');
      }
    }
  }, [currentOutline?.id, setIsSearchOpen, onSearchTermChange]);

  // Compute highlighted node IDs for the current outline
  const currentOutlineHighlights = useMemo(() => {
    if (!currentOutline || !searchTerm) return new Set<string>();
    return new Set(
      searchMatches
        .filter(m => m.outlineId === currentOutline.id)
        .map(m => m.nodeId)
    );
  }, [searchMatches, currentOutline, searchTerm]);

  // Get visible nodes in display order (respects collapsed state)
  const getVisibleNodeIds = useCallback((): string[] => {
    if (!currentOutline) return [];
    const result: string[] = [];

    const traverse = (nodeId: string) => {
      const node = currentOutline.nodes[nodeId];
      if (!node) return;

      result.push(nodeId);

      // Only traverse children if node is not collapsed and has children
      if (!node.isCollapsed && node.childrenIds && node.childrenIds.length > 0) {
        for (const childId of node.childrenIds) {
          traverse(childId);
        }
      }
    };

    traverse(currentOutline.rootNodeId);
    return result;
  }, [currentOutline]);

  // Handle indent (Tab) - move node inside its previous sibling
  const handleIndent = useCallback((nodeId?: string) => {
    if (currentOutline?.isGuide) return; // Protect guide from modifications
    const targetNodeId = nodeId || selectedNodeId;
    if (!targetNodeId || !currentOutline) return;
    const nodes = currentOutline.nodes;

    if (!canIndent(nodes, targetNodeId)) return;

    const prevSibling = getPreviousSibling(nodes, targetNodeId);
    if (prevSibling) {
      onMoveNode(targetNodeId, prevSibling, 'inside');
    }
  }, [selectedNodeId, currentOutline, onMoveNode]);

  // Handle outdent (Shift+Tab) - move node to be after its parent
  const handleOutdent = useCallback((nodeId?: string) => {
    if (currentOutline?.isGuide) return; // Protect guide from modifications
    const targetNodeId = nodeId || selectedNodeId;
    if (!targetNodeId || !currentOutline) return;
    const nodes = currentOutline.nodes;

    if (!canOutdent(nodes, targetNodeId, currentOutline.rootNodeId)) return;

    const node = nodes[targetNodeId];
    if (node && node.parentId) {
      onMoveNode(targetNodeId, node.parentId, 'after');
    }
  }, [selectedNodeId, currentOutline, onMoveNode]);

  // Handle bulk indent - indent all selected nodes
  // Find the first non-selected previous sibling as the target for all selected nodes
  const handleBulkIndent = useCallback(() => {
    if (!selectedNodeIds || selectedNodeIds.size === 0 || !currentOutline) return;
    if (currentOutline.isGuide) return;

    const nodes = currentOutline.nodes;
    const nodeIdsArray = Array.from(selectedNodeIds);

    // For each selected node, find anchor and indent
    for (const nodeId of nodeIdsArray) {
      if (!canIndent(nodes, nodeId)) continue;

      // Find first non-selected previous sibling
      let anchor = getPreviousSibling(nodes, nodeId);
      while (anchor && selectedNodeIds.has(anchor)) {
        anchor = getPreviousSibling(nodes, anchor);
      }

      if (anchor) {
        onMoveNode(nodeId, anchor, 'inside');
      }
    }
  }, [selectedNodeIds, currentOutline, onMoveNode]);

  // Handle bulk outdent - outdent all selected nodes
  const handleBulkOutdent = useCallback(() => {
    if (!selectedNodeIds || selectedNodeIds.size === 0 || !currentOutline) return;
    if (currentOutline.isGuide) return;

    const nodes = currentOutline.nodes;
    const nodeIdsArray = Array.from(selectedNodeIds);

    for (const nodeId of nodeIdsArray) {
      if (!canOutdent(nodes, nodeId, currentOutline.rootNodeId)) continue;

      const node = nodes[nodeId];
      if (node && node.parentId) {
        onMoveNode(nodeId, node.parentId, 'after');
      }
    }
  }, [selectedNodeIds, currentOutline, onMoveNode]);

  // Search handlers
  const handleSearchResults = useCallback((matches: SearchMatch[], term: string) => {
    setSearchMatches(matches);
    setSearchTerm(term);

    // Only reset to first match if term actually changed (not just navigation)
    if (term !== prevSearchTermRef.current) {
      setCurrentMatchIndex(0);
      prevSearchTermRef.current = term;

      // Notify parent of search term change with first match info for scrolling
      if (onSearchTermChange && matches.length > 0) {
        const firstMatch = matches[0];
        const matchType = firstMatch.matchType;
        const localMatchIndex = 0; // First match always has local index 0
        onSearchTermChange(term, matchType, localMatchIndex);
      }

      // Auto-expand all ancestor nodes for matches in the current outline
      // Only on term change to avoid re-render loop (expanding changes outline state
      // which recreates OutlineSearch's performSearch, retriggering the debounce)
      const outline = currentOutlineRef.current;
      if (matches.length > 0 && outline && onExpandAncestors) {
        const nodeIdsToExpand = new Set<string>();
        for (const match of matches) {
          if (match.outlineId === outline.id) {
            const path = getPathToNode(outline.nodes, match.nodeId);
            path.forEach(id => nodeIdsToExpand.add(id));
          }
        }
        if (nodeIdsToExpand.size > 0) {
          onExpandAncestors(Array.from(nodeIdsToExpand));
        }
      }
    } else if (onSearchTermChange) {
      // Term didn't change, just update highlighting
      onSearchTermChange(term);
    }
  }, [onSearchTermChange, onExpandAncestors]);

  const handleNavigateToMatch = useCallback((match: SearchMatch) => {
    // Switch outline if needed
    if (match.outlineId !== currentOutline?.id) {
      onSelectOutline(match.outlineId);
    }

    // Expand path to the match
    const outline = outlines.find(o => o.id === match.outlineId);
    if (outline && onExpandAncestors) {
      const path = getPathToNode(outline.nodes, match.nodeId);
      onExpandAncestors(path);
    }

    // Select the node
    setTimeout(() => {
      onSelectNode(match.nodeId);
    }, 100);
  }, [currentOutline, outlines, onSelectOutline, onExpandAncestors, onSelectNode]);

  const handleNextMatch = useCallback(() => {
    if (searchMatches.length === 0) return;
    const nextIndex = (currentMatchIndex + 1) % searchMatches.length;
    setCurrentMatchIndex(nextIndex);
    handleNavigateToMatch(searchMatches[nextIndex]);

    // Calculate local match index within this node's content
    if (onSearchTermChange && searchTerm) {
      const currentMatch = searchMatches[nextIndex];
      const matchType = currentMatch.matchType;

      // Count how many content matches in the same node come before this one
      let localMatchIndex = 0;
      for (let i = 0; i < nextIndex; i++) {
        if (searchMatches[i].nodeId === currentMatch.nodeId && searchMatches[i].matchType === 'content') {
          localMatchIndex++;
        }
      }

      onSearchTermChange(searchTerm, matchType, localMatchIndex);
    }
  }, [searchMatches, currentMatchIndex, handleNavigateToMatch, onSearchTermChange, searchTerm]);

  const handlePrevMatch = useCallback(() => {
    if (searchMatches.length === 0) return;
    const prevIndex = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    setCurrentMatchIndex(prevIndex);
    handleNavigateToMatch(searchMatches[prevIndex]);

    // Calculate local match index within this node's content
    if (onSearchTermChange && searchTerm) {
      const currentMatch = searchMatches[prevIndex];
      const matchType = currentMatch.matchType;

      // Count how many content matches in the same node come before this one
      let localMatchIndex = 0;
      for (let i = 0; i < prevIndex; i++) {
        if (searchMatches[i].nodeId === currentMatch.nodeId && searchMatches[i].matchType === 'content') {
          localMatchIndex++;
        }
      }

      onSearchTermChange(searchTerm, matchType, localMatchIndex);
    }
  }, [searchMatches, currentMatchIndex, handleNavigateToMatch, onSearchTermChange, searchTerm]);

  const handleCloseSearch = useCallback(() => {
    setIsSearchOpen(false);
    // Keep highlights visible after closing search bar
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchMatches([]);
    setSearchTerm('');
    setCurrentMatchIndex(0);
    if (onSearchTermChange) {
      onSearchTermChange('');
    }
  }, [onSearchTermChange]);

  // Keyboard event handler for Tab/Shift+Tab, clipboard shortcuts, and search
  // Separate useEffect for multi-selection keyboard shortcuts (Escape and Tab)
  useEffect(() => {
    const handleMultiSelectKeys = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      // Cascading Escape: each press dismisses one layer of active state
      if (e.key === 'Escape') {
        e.preventDefault();
        // 1. Close search bar if open
        if (isSearchOpen) {
          handleCloseSearch();
          return;
        }
        // 2. Clear search highlights if present
        if (searchMatches.length > 0) {
          handleClearSearch();
          return;
        }
        // 3. Cancel active AI operation
        if (isLoadingAI && onCancelAI) {
          onCancelAI();
          return;
        }
        // 4. Clear multi-selection
        if (selectedNodeIds && selectedNodeIds.size > 0 && onClearSelection) {
          onClearSelection();
          return;
        }
        // 5. Deselect current node
        if (selectedNodeId) {
          onSelectNode('', false);
          return;
        }
        return;
      }

      // Handle Tab for multi-select indent/outdent
      if (e.key === 'Tab' && selectedNodeIds && selectedNodeIds.size > 0) {
        e.preventDefault();
        if (e.shiftKey) {
          handleBulkOutdent();
        } else {
          handleBulkIndent();
        }
      }
    };

    document.addEventListener('keydown', handleMultiSelectKeys);
    return () => document.removeEventListener('keydown', handleMultiSelectKeys);
  }, [selectedNodeIds, onClearSelection, handleBulkIndent, handleBulkOutdent, isSearchOpen, searchMatches, handleClearSearch, handleCloseSearch, isLoadingAI, onCancelAI, selectedNodeId, onSelectNode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle Ctrl+F for search (works even in input fields)
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setIsSearchOpen(true);
        return;
      }

      // Don't interfere with input fields or dialogs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (target.closest('[role="dialog"]')) return;

      // Handle Arrow keys for navigation through nodes
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        if (!currentOutline) return;
        e.preventDefault();

        const visibleNodes = getVisibleNodeIds();
        if (visibleNodes.length === 0) return;

        const currentIndex = selectedNodeId ? visibleNodes.indexOf(selectedNodeId) : -1;
        let newIndex: number;

        if (e.key === 'ArrowUp') {
          newIndex = currentIndex <= 0 ? visibleNodes.length - 1 : currentIndex - 1;
        } else {
          newIndex = currentIndex >= visibleNodes.length - 1 ? 0 : currentIndex + 1;
        }

        const newNodeId = visibleNodes[newIndex];
        if (newNodeId) {
          onSelectNode(newNodeId, false);
        }
        return;
      }

      // Handle Tab for single-node indent/outdent (multi-select handled in separate useEffect)
      if (e.key === 'Tab') {
        if (!selectedNodeId || !currentOutline) return;
        e.preventDefault();
        if (e.shiftKey) {
          handleOutdent();
        } else {
          handleIndent();
        }
        return;
      }

      // Handle Enter/Return to create new sibling node (or child if root selected)
      if (e.key === 'Enter') {
        if (!selectedNodeId || !currentOutline) return;
        e.preventDefault();
        onCreateNode();
        return;
      }

      // Handle Delete key to delete selected node
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!selectedNodeId || !currentOutline) return;
        const node = currentOutline.nodes[selectedNodeId];
        if (!node || node.type === 'root') return; // Don't delete root
        if (currentOutline.isGuide) return; // Don't delete from guide

        e.preventDefault();

        // Two-tier bypass — MUST mirror the toolbar Delete button (below) so the
        // "Don't ask again" opt-out and Professional mode work no matter how the
        // user triggers a delete:
        //   1. Professional mode — global suppress all confirms.
        //   2. Per-prompt "Don't ask again" — localStorage SUPPRESS_KEY.
        //   3. Legacy "Confirm before deleting" Setting toggle.
        const legacyConfirmDelete = localStorage.getItem('confirmDelete') !== 'false';
        const perPromptSuppressed = localStorage.getItem(SUPPRESS_KEY) === 'true';
        if (isProfessional || perPromptSuppressed || !legacyConfirmDelete) {
          onDeleteNode(selectedNodeId);
        } else {
          setDeleteDontAskAgain(false);
          setShowDeleteDialog(true);
        }
        return;
      }

      // Handle Space for edit mode (only for just-created nodes)
      if (e.key === ' ' && justCreatedNodeId && selectedNodeId === justCreatedNodeId) {
        e.preventDefault();
        onTriggerEdit?.(selectedNodeId);
        return;
      }

      // Handle clipboard shortcuts (Cmd on Mac, Ctrl on Windows/Linux)
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod || !selectedNodeId || !currentOutline) return;

      const selectedNode = currentOutline.nodes[selectedNodeId];
      const isRoot = selectedNode?.type === 'root';

      if (e.key === 'c') {
        // Copy subtree - works on all nodes including root
        e.preventDefault();
        onCopySubtree(selectedNodeId);
      } else if (e.key === 'x' && !isRoot) {
        // Cut subtree - only non-root nodes
        e.preventDefault();
        onCutSubtree(selectedNodeId);
      } else if (e.key === 'v' && hasClipboard) {
        // Paste subtree - only if clipboard has content
        e.preventDefault();
        onPasteSubtree(selectedNodeId);
      } else if (e.key === 'd' && !isRoot) {
        // Duplicate node - only non-root nodes
        e.preventDefault();
        onDuplicateNode(selectedNodeId);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, currentOutline, handleIndent, handleOutdent, hasClipboard, onCopySubtree, onCutSubtree, onPasteSubtree, onDuplicateNode, justCreatedNodeId, onTriggerEdit, getVisibleNodeIds, onSelectNode, isProfessional, onDeleteNode]);

  const handleImportClick = () => {
    setImportDialogOpen(true);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onImportOutline(file);
    }
    // Reset input so the same file can be selected again
    event.target.value = '';
  };

  const handleBackupAll = async () => {
    // Save all sidebar outlines to the storage folder
    try {
      const userOutlines = outlines.filter(o => !o.isGuide);
      if (userOutlines.length === 0) {
        toast({ title: 'Nothing to Backup', description: 'No outlines to save.' });
        return;
      }
      // Save all outlines to disk (mark them all as dirty so they all get written)
      const allDirtyIds = new Set(userOutlines.map(o => o.id));
      await saveAllOutlines(outlines, outlines.find(o => !o.isGuide)?.id || '', allDirtyIds);
      toast({
        title: 'Backup Complete',
        description: `${userOutlines.length} outline${userOutlines.length !== 1 ? 's' : ''} saved to storage.`,
      });
    } catch (error) {
      console.error('Failed to backup outlines:', error);
      toast({
        title: 'Backup Failed',
        description: 'Could not save outlines to storage.',
        variant: 'destructive',
      });
    }
  };

  const handleRestoreAllClick = async () => {
    // Scan the default storage folder and add any missing outlines to the sidebar
    try {
      const storageData = await loadStorageData();
      const diskOutlines = storageData.outlines || [];

      if (diskOutlines.length === 0) {
        toast({ title: 'No Outlines Found', description: 'No outline files found in the storage folder.' });
        return;
      }

      // Find outlines on disk that aren't already in the sidebar
      const existingIds = new Set(outlines.map(o => o.id));
      const existingNames = new Set(outlines.map(o => o.name.toLowerCase()));
      const newOutlines = diskOutlines.filter(o =>
        !o.isGuide && !existingIds.has(o.id) && !existingNames.has(o.name.toLowerCase())
      );

      if (newOutlines.length === 0) {
        toast({
          title: 'All Synced',
          description: `All ${diskOutlines.filter(o => !o.isGuide).length} outlines from storage are already loaded.`,
        });
        return;
      }

      // Add each missing outline to the sidebar
      newOutlines.forEach(outline => {
        onAddImportedOutline(outline, false);
      });

      toast({
        title: 'Restore Complete',
        description: `Added ${newOutlines.length} outline${newOutlines.length !== 1 ? 's' : ''} from storage.`,
      });
    } catch (error) {
      console.error('Failed to restore outlines:', error);
      toast({
        title: 'Restore Failed',
        description: 'Could not read outlines from storage folder.',
        variant: 'destructive',
      });
    }
  };

  const rootNode = currentOutline?.nodes[currentOutline.rootNodeId];
  const selectedNode = selectedNodeId ? currentOutline?.nodes[selectedNodeId] : undefined;
  const isSelectedNodeRoot = selectedNode?.type === 'root';

  // Shared menu-item fragments for the four collapsible middle buttons. Used
  // BOTH by their inline toolbar dropdowns AND by the "⋯ More" overflow
  // submenus, so the two can never drift apart. (2026-07-21)
  const bringInMenuItems = (
    <>
      <DropdownMenuLabel className="py-1 text-xs uppercase tracking-wide text-muted-foreground">Bring In</DropdownMenuLabel>
      {onOpenBulkResearch && (
        <DropdownMenuItem onSelect={onOpenBulkResearch} className="cursor-pointer py-1">
          <Library className="mr-2 h-4 w-4" /> Research & Import
        </DropdownMenuItem>
      )}
      <DropdownMenuItem onSelect={handleImportClick} className="cursor-pointer py-1">
        <FileUp className="mr-2 h-4 w-4" /> Import Outline
      </DropdownMenuItem>
      {onOpenLinkToOutline && (
        <DropdownMenuItem
          onSelect={onOpenLinkToOutline}
          disabled={!currentOutline || currentOutline.isGuide}
          className="cursor-pointer py-1"
        >
          <ExternalLink className="mr-2 h-4 w-4" /> Import/Link to Outline…
        </DropdownMenuItem>
      )}
      {onOpenLiveBooks && (
        <DropdownMenuItem
          onSelect={onOpenLiveBooks}
          disabled={!selectedNodeId || currentOutline?.isGuide}
          className="cursor-pointer py-1"
          title={currentOutline?.isGuide ? 'User Guide is read-only' : (selectedNodeId ? 'Refresh selected item and its children against the latest web information' : 'Select an item first')}
        >
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh from Web
        </DropdownMenuItem>
      )}
      <DropdownMenuItem onSelect={handleRestoreAllClick} className="cursor-pointer py-1">
        <FileUp className="mr-2 h-4 w-4" /> Restore All Outlines
      </DropdownMenuItem>
      {onUnmerge && (
        <DropdownMenuItem
          onSelect={() => onUnmerge?.()}
          disabled={!canUnmerge}
          className="cursor-pointer py-1"
          title={canUnmerge ? 'Restore outline to pre-merge state' : 'Unmerge — available right after a merge'}
        >
          <RotateCcw className="mr-2 h-4 w-4" /> Unmerge
        </DropdownMenuItem>
      )}
    </>
  );

  const turnIntoMenuItems = (
    <>
      <DropdownMenuLabel className="py-1 text-xs uppercase tracking-wide text-muted-foreground">Turn Into</DropdownMenuLabel>
      <DropdownMenuItem
        onSelect={() => { if (selectedNodeId) onExportSubtree?.(selectedNodeId); }}
        disabled={!selectedNodeId}
        className="cursor-pointer py-1"
        title={selectedNodeId ? undefined : 'Select an item first'}
      >
        <Share2 className="mr-2 h-4 w-4" /> Share Suboutline as&hellip;
      </DropdownMenuItem>
      {onOpenYoutubePackage && (
        <DropdownMenuItem
          onSelect={() => onOpenYoutubePackage?.()}
          disabled={!selectedNodeId}
          className="cursor-pointer py-1"
          title={selectedNodeId ? undefined : 'Select a chapter first'}
        >
          <ExternalLink className="mr-2 h-4 w-4" /> Share as YouTube package
        </DropdownMenuItem>
      )}
      {onOpenGenerateVideo && (
        <DropdownMenuItem
          onSelect={() => onOpenGenerateVideo?.()}
          disabled={!selectedNodeId}
          className="cursor-pointer py-1"
          title={selectedNodeId ? undefined : 'Select a chapter first'}
        >
          <Video className="mr-2 h-4 w-4" /> Generate Video
        </DropdownMenuItem>
      )}
      <DropdownMenuItem onSelect={onExportOutline} disabled={!currentOutline} className="cursor-pointer py-1">
        <FileDown className="mr-2 h-4 w-4" /> Export Current Outline
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={handleBackupAll} className="cursor-pointer py-1">
        <FileDown className="mr-2 h-4 w-4" /> Backup All Outlines
      </DropdownMenuItem>
    </>
  );

  const secondBrainMenuItems = (
    <>
      <DropdownMenuLabel className="flex items-center gap-2">
        <span className="text-base">🧠</span>
        Second Brain
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => onOpenSecondBrain?.()} className="cursor-pointer">
        <Brain className="mr-2 h-4 w-4" />
        Open Second Brain
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => onOpenQuickCapture?.()} className="cursor-pointer">
        <Inbox className="mr-2 h-4 w-4" />
        Quick Capture
        {!isMobile && <span className="ml-auto text-xs text-muted-foreground">⌘⇧I</span>}
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={() => selectedNodeId && onSaveToSecondBrain?.(selectedNodeId)}
        disabled={!selectedNodeId || currentOutline?.isSecondBrain}
        className="cursor-pointer"
      >
        <Plus className="mr-2 h-4 w-4" />
        Save Selection to Second Brain
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => onSearchSecondBrainLocal?.()} className="cursor-pointer" aria-label="Search Second Brain — free, instant, local keyword search">
        <Search className="mr-2 h-4 w-4" />
        Search Second Brain
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => onSearchSecondBrain?.()} className="cursor-pointer" aria-label="Ask Second Brain — AI answer (uses an AI generation)">
        <MessageSquare className="mr-2 h-4 w-4" />
        Ask Second Brain
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => onOpenSecondBrainDashboard?.()} className="cursor-pointer">
        <LayoutDashboard className="mr-2 h-4 w-4" />
        View Dashboard
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => onImportToSecondBrain?.()} className="cursor-pointer">
        <Library className="mr-2 h-4 w-4" />
        Import to Second Brain
      </DropdownMenuItem>
    </>
  );

  const expandMenuItems = (
    <>
      <DropdownMenuItem
        onSelect={() => { onExpandAll(); setIsAllCollapsed(false); }}
        disabled={!currentOutline}
        className="cursor-pointer py-1"
      >
        <ChevronsDown className="mr-2 h-4 w-4" /> Expand All
        {!isMobile && <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>}
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={() => { onCollapseAll(); setIsAllCollapsed(true); }}
        disabled={!currentOutline}
        className="cursor-pointer py-1"
      >
        <ChevronsUp className="mr-2 h-4 w-4" /> Collapse All
        {!isMobile && <DropdownMenuShortcut>⌘⇧E</DropdownMenuShortcut>}
      </DropdownMenuItem>
    </>
  );

  return (
    <div ref={paneRef} data-testid="outline-pane" className="flex flex-col h-full bg-card p-3 space-y-3" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
      <div data-testid="outline-header-row" className="flex-shrink-0 flex flex-wrap items-center gap-2 px-2 min-w-0">
        {/* App menu (far left) — the IdeaM Amplify mark opens the app-level
            menu: switch outline, Settings, Account, theme, Backup & Restore,
            About. Global app actions live here; per-node actions live in the
            node right-click menu. */}
        <TooltipProvider>
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 p-0 overflow-hidden active:scale-95 min-h-[44px] min-w-[44px] touch-manipulation md:min-h-0 md:min-w-0"
                    aria-label="Menu"
                    data-testid="app-menu-trigger"
                  >
                    <AmplifyMark className="h-5 w-5 rounded-[4px]" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">Menu</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start" className="w-60">
              <DropdownMenuLabel className="flex items-center gap-2">
                <AmplifyMark className="h-4 w-4 rounded-[3px]" /> IdeaM
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              {/* Open / Switch outline — lists user outlines (excludes the
                  Second Brain + User Guide). Current one is checked. */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer">
                  <FileUp className="mr-2 h-4 w-4" /> Open / Switch outline…
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-80 overflow-y-auto w-56">
                  {outlines.filter(o => !o.isSecondBrain && !o.isGuide).length === 0 ? (
                    <DropdownMenuItem disabled>No outlines yet</DropdownMenuItem>
                  ) : (
                    outlines
                      .filter(o => !o.isSecondBrain && !o.isGuide)
                      .map(o => (
                        <DropdownMenuCheckboxItem
                          key={o.id}
                          checked={o.id === currentOutline?.id}
                          onSelect={() => onSelectOutline(o.id)}
                          className="cursor-pointer"
                        >
                          <span className="truncate">{o.name}</span>
                        </DropdownMenuCheckboxItem>
                      ))
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* Settings — opens the existing Settings dialog via its hidden
                  trigger button (kept mounted in the toolbar below). */}
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  const trigger = document.querySelector<HTMLButtonElement>('[data-settings-trigger]');
                  trigger?.click();
                }}
                className="cursor-pointer"
              >
                <Settings className="mr-2 h-4 w-4" /> Settings
              </DropdownMenuItem>

              {/* Account — opens the Clerk account menu (avatar kept on the
                  right so account stays reachable even in stub mode). */}
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  const btn = document.querySelector<HTMLElement>('.cl-userButtonTrigger');
                  btn?.click();
                }}
                className="cursor-pointer"
              >
                <User className="mr-2 h-4 w-4" /> Account
              </DropdownMenuItem>

              {/* Light / Dark theme toggle */}
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setTheme(theme === 'dark' ? 'light' : 'dark');
                }}
                className="cursor-pointer"
              >
                {theme === 'dark'
                  ? <Sun className="mr-2 h-4 w-4" />
                  : <Moon className="mr-2 h-4 w-4" />}
                Light / Dark theme
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* Backup & Restore — also available in Settings; surfaced here
                  for quick reach. */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer">
                  <ShieldCheck className="mr-2 h-4 w-4" /> Backup &amp; Restore…
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-60">
                  {onOpenBackup && (
                    <DropdownMenuItem onSelect={onOpenBackup} disabled={!currentOutline} className="cursor-pointer">
                      <ShieldCheck className="mr-2 h-4 w-4" /> Backup this outline
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={handleBackupAll} className="cursor-pointer">
                    <FileDown className="mr-2 h-4 w-4" /> Backup All Outlines
                  </DropdownMenuItem>
                  {onOpenRestore && (
                    <DropdownMenuItem onSelect={onOpenRestore} disabled={!currentOutline} className="cursor-pointer">
                      <RotateCcw className="mr-2 h-4 w-4" /> Restore from backup…
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={handleRestoreAllClick} className="cursor-pointer">
                    <FileUp className="mr-2 h-4 w-4" /> Restore All Outlines
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* About & version */}
              <DropdownMenuItem
                onSelect={() => setShowAboutDialog(true)}
                className="cursor-pointer"
              >
                <Info className="mr-2 h-4 w-4" /> About &amp; version
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipProvider>

        {/* Sidebar toggle button (desktop) */}
        {onToggleSidebar && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 min-h-[44px] min-w-[44px] touch-manipulation md:min-h-0 md:min-w-0"
                  onClick={onToggleSidebar}
                  aria-label={isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
                  aria-expanded={isSidebarOpen}
                >
                  {isSidebarOpen ? (
                    <PanelLeftClose className="h-4 w-4" />
                  ) : (
                    <PanelLeft className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Mobile sidebar button - larger tap target on mobile */}
        {onOpenMobileSidebar && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("shrink-0 touch-manipulation", isMobile ? "h-11 w-11" : "h-8 w-8")}
                  onClick={onOpenMobileSidebar}
                  aria-label="Open outlines sidebar"
                >
                  <PanelLeft className={cn(isMobile ? "h-5 w-5" : "h-4 w-4")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Outlines</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Current outline title (read-only; switching happens in sidebar) */}
        <div className="flex-grow font-headline text-lg font-bold truncate px-2 py-1" title={currentOutline?.name}>
            <span className="truncate">
                {currentOutline?.isSecondBrain && '🧠 '}
                {currentOutline?.isGuide && '📖 '}
                {currentOutline?.name}
            </span>
        </div>


        {/* Account avatar / sign-out menu. Renders nothing when Clerk is not
            configured (stub mode for local dev), so the toolbar is unchanged
            until real keys land in Vercel. */}
        <div className="ml-1 flex shrink-0 items-center">
            <AppUserButton />
        </div>

        {/* File input for backup restore (JSON arrays) - kept for backward compatibility */}
        <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json,.idm,application/json,application/octet-stream"
            className="hidden"
        />

        {/* File Import Dialog for multi-format import */}
        <FileImportDialog
            open={importDialogOpen}
            onOpenChange={setImportDialogOpen}
            onImportComplete={(outline) => onAddImportedOutline(outline, false)}
        />

      </div>

      {/* About & version dialog (opened from the App menu) */}
      <AlertDialog open={showAboutDialog} onOpenChange={setShowAboutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AmplifyMark className="h-5 w-5 rounded-[4px]" /> IdeaM
            </AlertDialogTitle>
            <AlertDialogDescription>
              Version {process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* "Derived from" banner (2026-06-10). Shown only when the loaded
          outline was created as a derivative of another outline. Subtle
          chip styling — does not dominate. Click "Open original" to switch
          to the parent. */}
      {currentOutline?.derivedFromOutlineId && (() => {
        const parent = outlines.find(o => o.id === currentOutline.derivedFromOutlineId);
        const parentName = parent?.name || 'a deleted outline';
        return (
          <div className="flex-shrink-0 px-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-purple-500/30 bg-purple-500/5 text-xs">
              <GitFork className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
              <span className="text-muted-foreground">
                Derived from <span className="font-medium text-foreground">{`"${parentName}"`}</span>
                {currentOutline.derivationLabel && (
                  <span className="text-muted-foreground/80"> · {currentOutline.derivationLabel}</span>
                )}
              </span>
              {parent ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 ml-auto text-xs text-purple-700 dark:text-purple-300 hover:bg-purple-500/10"
                  onClick={() => onSelectOutline(parent.id)}
                >
                  Open original
                </Button>
              ) : (
                <span className="ml-auto text-[10px] text-muted-foreground/70 italic">
                  Original was deleted
                </span>
              )}
            </div>
          </div>
        );
      })()}

      <TooltipProvider delayDuration={300}>
        <div ref={actionToolbarRef} data-testid="outline-action-toolbar" className="flex-shrink-0 flex flex-nowrap items-center justify-start gap-1.5 px-2 py-1.5 bg-[hsl(var(--toolbar-bg))] rounded-xl border border-border/30 min-w-0 overflow-hidden">

          {/* Keyboard Delete confirmation dialog — the Delete key handler opens
              this via setShowDeleteDialog(true). The per-node Delete button lives
              in the node right-click menu; this dialog stays mounted here so the
              "Don't ask again" opt-out keeps working. */}
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Item?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete &ldquo;{selectedNode ? (selectedNode as OutlineNode).name : ''}&rdquo; and all its children.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex items-center gap-2 py-2">
                <Checkbox
                  id="delete-node-dont-ask"
                  checked={deleteDontAskAgain}
                  onCheckedChange={(v) => setDeleteDontAskAgain(v === true)}
                />
                <Label htmlFor="delete-node-dont-ask" className="text-sm font-normal cursor-pointer select-none">
                  Don&apos;t ask again
                </Label>
              </div>
              <AlertDialogFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => {
                  if (deleteDontAskAgain) {
                    try { localStorage.setItem(SUPPRESS_KEY, 'true'); } catch { /* ignore */ }
                  }
                  selectedNodeId && onDeleteNode(selectedNodeId);
                  setShowDeleteDialog(false);
                }} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* 1. New Outline — GREEN split button. Main click creates a new
                 outline; the chevron pulls down template options. Green marks it
                 apart from the blue in-outline tools. */}
          <span className="inline-flex shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onCreateOutline()}
                  className="rounded-r-none bg-gradient-to-b from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 dark:from-emerald-600 dark:to-emerald-700 dark:hover:from-emerald-500 dark:hover:to-emerald-600 text-white border-transparent shadow-md shadow-emerald-700/40 ring-1 ring-inset ring-emerald-400/50 dark:ring-emerald-300/70 active:scale-95 min-h-[44px] min-w-[44px] touch-manipulation md:min-h-0 md:min-w-0"
                  aria-label="New outline"
                >
                  <Plus className="h-4 w-4 text-white" strokeWidth={2.75} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New Outline</TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-l-none border-l border-l-emerald-800/40 w-7 min-w-0 px-0 bg-gradient-to-b from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 dark:from-emerald-600 dark:to-emerald-700 dark:hover:from-emerald-500 dark:hover:to-emerald-600 text-white shadow-md shadow-emerald-700/40 ring-1 ring-inset ring-emerald-400/50 dark:ring-emerald-300/70 active:scale-95 min-h-[44px] md:min-h-0"
                  aria-label="New outline options"
                >
                  <ChevronDown className="h-4 w-4 text-white" strokeWidth={2.75} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuItem onSelect={() => onCreateOutline()} className="cursor-pointer">
                  <Plus className="mr-2 h-4 w-4" /> New Outline
                </DropdownMenuItem>
                {/* TODO: wire "New from Template…" to a real template picker when
                    one exists. For now it creates a blank outline so it never errors. */}
                <DropdownMenuItem onSelect={() => onCreateOutline()} className="cursor-pointer">
                  <FileDown className="mr-2 h-4 w-4" /> New from Template…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>

          <Separator orientation="vertical" className="h-6 mx-0.5 shrink-0" />

          {/* 2. Find / Search */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={-1} className="inline-flex shrink-0">
                <Button variant="outline" size="icon" onClick={() => setIsSearchOpen(true)} disabled={!currentOutline} className="bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 border-transparent text-white shadow-sm shadow-blue-700/30 ring-1 ring-inset ring-blue-500/40 dark:ring-blue-300/70 min-h-[44px] min-w-[44px] touch-manipulation md:min-h-0 md:min-w-0" aria-label="Search outline">
                  <Search className="h-4 w-4 text-white" strokeWidth={2.5} />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{!currentOutline ? 'Search outline — open an outline first' : `Search outline${!isMobile ? ' (⌘F)' : ''}`}</TooltipContent>
          </Tooltip>

          {/* 3. AI */}
          <AIMenu
            onGenerateOutline={onGenerateOutline}
            outlineSummary={currentOutline?.name}
            isLoadingAI={isLoadingAI}
            onOpenBulkResearch={onOpenBulkResearch}
            onOpenKnowledgeChat={onOpenKnowledgeChat}
            onOpenTranslate={currentOutline?.isGuide ? undefined : onOpenTranslate}
            onOpenReformat={currentOutline?.isGuide ? undefined : onOpenReformat}
            onOpenTransformOutline={currentOutline?.isGuide ? undefined : onOpenTransformOutline}
            onOpenImageToOutline={currentOutline?.isGuide ? undefined : onOpenImageToOutline}
            onOpenApplications={onOpenApplications}
            hasSelectedNode={!!selectedNodeId && !currentOutline?.isGuide}
            selectedNodeName={selectedNodeId && currentOutline?.nodes[selectedNodeId]?.name || ''}
          />

          {/* 4. Bring In — the single "intake" door: merge in YouTube, PDFs,
                 web pages, notes, audio, or another outline. Collapsible middle:
                 folds into "⋯ More" (3rd from tail) when the pane is very narrow. */}
          {showBringIn && (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 border-transparent text-white shadow-sm shadow-blue-700/30 ring-1 ring-inset ring-blue-500/40 dark:ring-blue-300/70 shrink-0 active:scale-95 min-h-[44px] min-w-[44px] touch-manipulation md:min-h-0 md:min-w-0" aria-label="Bring In">
                      <BookDown className="h-4 w-4 text-white" strokeWidth={2.5} />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Bring In — merge in YouTube, PDFs, web pages, notes, audio, or another outline</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-60 p-0.5">
                {bringInMenuItems}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* 5. Turn Into — the single "output" door: video, podcast, website,
                 or 20+ formats. Collapsible middle (2nd from tail). */}
          {showTurnInto && (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 border-transparent text-white shadow-sm shadow-blue-700/30 ring-1 ring-inset ring-blue-500/40 dark:ring-blue-300/70 shrink-0 active:scale-95 min-h-[44px] min-w-[44px] touch-manipulation md:min-h-0 md:min-w-0" aria-label="Turn Into">
                      <BookUp className="h-4 w-4 text-white" strokeWidth={2.5} />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Turn Into — video, podcast, website, or 20+ formats</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-56 p-0.5">
                {turnIntoMenuItems}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {(showBringIn || showTurnInto) && (showSecondBrain || showExpand) && (
            <Separator orientation="vertical" className="h-6 mx-0.5 shrink-0" />
          )}

          {/* 6. Second Brain menu. Collapsible middle (2nd from tail). */}
          {showSecondBrain && (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 border-transparent text-white shadow-sm shadow-blue-700/30 ring-1 ring-inset ring-blue-500/40 dark:ring-blue-300/70 active:scale-95 min-h-[44px] min-w-[44px] touch-manipulation md:min-h-0 md:min-w-0 inline-flex"
                      aria-label="Second Brain menu"
                    >
                      <Brain className="h-4 w-4 text-white" strokeWidth={2.5} />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Second Brain</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-52">
                {secondBrainMenuItems}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* 7. Expand All / Compress All — single dropdown. Lowest-priority
                 collapsible middle: folds into "⋯ More" FIRST (tail). */}
          {showExpand && (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={-1} className="inline-flex">
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={!currentOutline}
                        className="bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 border-transparent text-white shadow-sm shadow-blue-700/30 ring-1 ring-inset ring-blue-500/40 dark:ring-blue-300/70 shrink-0 active:scale-95 min-h-[44px] min-w-[44px] touch-manipulation md:min-h-0 md:min-w-0"
                        aria-label="Expand or compress all items"
                      >
                        <ChevronsDownUp className="h-4 w-4 text-white" strokeWidth={2.5} />
                      </Button>
                    </DropdownMenuTrigger>
                  </span>
                </TooltipTrigger>
                <TooltipContent>{!currentOutline ? 'Expand or compress all — open an outline first' : 'Expand or compress all items'}</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-56 p-0.5">
                {expandMenuItems}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Flexible spacer — pins the "⋯ More" menu and the red Help button to
              the far-right edge at every width, so Help never moves. */}
          <div className="flex-1 min-w-0" aria-hidden="true" />

          {/* "⋯ More" overflow — appears ONLY when the pane is too narrow to show
              the four collapsible middle tools inline. Deterministic tail-first
              collapse: Expand folds first, then Second Brain, then Turn Into,
              then Bring In. New / Search / AI / Help NEVER appear here. */}
          {showActionMore && (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 border-transparent text-white shadow-sm shadow-blue-700/30 ring-1 ring-inset ring-blue-500/40 dark:ring-blue-300/70 shrink-0 active:scale-95 min-h-[44px] min-w-[44px] touch-manipulation md:min-h-0 md:min-w-0"
                      aria-label="More tools"
                    >
                      <MoreHorizontal className="h-4 w-4 text-white" strokeWidth={2.5} />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>More tools</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-60 p-0.5 max-h-[70vh] overflow-y-auto">
                {!showBringIn && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="cursor-pointer">
                      <BookDown className="mr-2 h-4 w-4" /> Bring In
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-60">{bringInMenuItems}</DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
                {!showTurnInto && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="cursor-pointer">
                      <BookUp className="mr-2 h-4 w-4" /> Turn Into
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-56">{turnIntoMenuItems}</DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
                {!showSecondBrain && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="cursor-pointer">
                      <Brain className="mr-2 h-4 w-4" /> Second Brain
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-52">{secondBrainMenuItems}</DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
                {!showExpand && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="cursor-pointer">
                      <ChevronsDownUp className="mr-2 h-4 w-4" /> Expand / Compress
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-56">{expandMenuItems}</DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Stop AI — only shown while an AI operation is running. */}
          {isLoadingAI && onCancelAI && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onCancelAI}
                  className="border-red-500/50 hover:bg-red-500/20 animate-pulse min-h-[44px] min-w-[44px] touch-manipulation md:min-h-0 md:min-w-0"
                  aria-label="Stop AI operation"
                >
                  <StopCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Stop AI operation</TooltipContent>
            </Tooltip>
          )}

          {/* Hidden Settings trigger — kept mounted so the App menu's "Settings"
              item can open the Settings dialog by clicking [data-settings-trigger]. */}
          <SettingsDialog onFolderSelected={onFolderSelected}>
            <button
              type="button"
              aria-hidden="true"
              tabIndex={-1}
              className="hidden"
              data-settings-trigger
            />
          </SettingsDialog>

          <Separator orientation="vertical" className="h-6 mx-0.5 shrink-0" />

          {/* 8. HELP — its own RED button, far right, ALWAYS visible and PINNED
                 (never collapses, never moves), with a pull-down for Help,
                 Report a Problem, and Share Feedback. */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500 text-white border-transparent shadow-sm shadow-red-700/30 ring-1 ring-inset ring-red-400/50 dark:ring-red-300/70 min-h-[44px] min-w-[44px] touch-manipulation md:min-h-0 md:min-w-0 inline-flex"
                    aria-label="Help and support"
                  >
                    <span aria-hidden="true" className="text-white font-bold text-lg leading-none">?</span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Help & Support</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-56 p-0.5">
              {onOpenHelp && (
                <DropdownMenuItem onSelect={() => onOpenHelp()} className="cursor-pointer py-1">
                  <HelpCircle className="mr-2 h-4 w-4" /> Help & Support
                </DropdownMenuItem>
              )}
              <ReportIssueMenuItem currentOutlineName={currentOutline?.name ?? null} />
              <DropdownMenuItem
                onSelect={() => {
                  if (typeof window !== 'undefined') {
                    window.open('/feedback', '_blank', 'noopener,noreferrer');
                  }
                }}
                className="cursor-pointer py-1"
                aria-label="Share feedback (earn 1 year of Pro)"
              >
                <Send className="mr-2 h-4 w-4" /> Share Feedback
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TooltipProvider>

      {/* Search panel */}
      <OutlineSearch
        isOpen={isSearchOpen}
        onClose={handleCloseSearch}
        onClear={handleClearSearch}
        outlines={outlines}
        currentOutline={currentOutline}
        onSearchResults={handleSearchResults}
        onNavigateToMatch={handleNavigateToMatch}
        onApplySearchView={onApplySearchView}
        currentMatchIndex={currentMatchIndex}
        totalMatches={searchMatches.length}
        onNextMatch={handleNextMatch}
        onPrevMatch={handlePrevMatch}
      />

      <div
        className="flex-grow overflow-y-auto pr-2"
        onClick={(e) => {
          // Clear multi-selection when clicking on empty space (not on a node)
          if (e.target === e.currentTarget && selectedNodeIds && selectedNodeIds.size > 0) {
            onClearSelection?.();
          }
        }}
      >
        {rootNode && currentOutline && (
          <ul
            className="select-none"
            role="tree"
            aria-label={currentOutline.name || 'Outline'}
            onClick={(e) => {
              // Also handle clicks on the ul but not on nodes
              if (e.target === e.currentTarget && selectedNodeIds && selectedNodeIds.size > 0) {
                onClearSelection?.();
              }
            }}
          >
            <NodeItem
              key={rootNode.id}
              nodeId={rootNode.id}
              nodes={currentOutline.nodes}
              level={0}
              selectedNodeId={selectedNodeId}
              onSelectNode={onSelectNode}
              onMoveNode={currentOutline.isGuide ? () => {} : onMoveNode}
              onToggleCollapse={onToggleCollapse}
              onExpandAll={currentOutline.isGuide ? undefined : onExpandAll}
              onCollapseAll={currentOutline.isGuide ? undefined : onCollapseAll}
              onUpdateNode={currentOutline.isGuide ? () => {} : onUpdateNode}
              onCreateNode={currentOutline.isGuide ? undefined : onCreateNode}
              onDeleteNode={currentOutline.isGuide ? undefined : onDeleteNode}
              onCopySubtree={onCopySubtree}
              onCutSubtree={currentOutline.isGuide ? undefined : onCutSubtree}
              onPasteSubtree={currentOutline.isGuide ? undefined : onPasteSubtree}
              onDuplicateNode={currentOutline.isGuide ? undefined : onDuplicateNode}
              hasClipboard={hasClipboard}
              isRoot={true}
              onIndent={handleIndent}
              onOutdent={handleOutdent}
              searchTerm={searchTerm}
              highlightedNodeIds={currentOutlineHighlights}
              onGenerateContentForChildren={currentOutline.isGuide ? undefined : onGenerateContentForChildren}
              onCreateChildNode={currentOutline.isGuide ? undefined : onCreateChildNode}
              editingNodeId={currentOutline.isGuide ? null : editingNodeId}
              onEditingComplete={onEditingComplete}
              selectedNodeIds={selectedNodeIds}
              onToggleNodeSelection={onToggleNodeSelection}
              onRangeSelect={onRangeSelect}
              onExportSubtree={onExportSubtree}
              onSaveToSecondBrain={onSaveToSecondBrain}
              maxRenderDepth={maxRenderDepth}
              onInsertOutlineLink={currentOutline.isGuide ? undefined : onOpenLinkToOutline}
              onZoomNode={(id) => { onSelectNode(id); onToggleFocusMode?.(); }}
              onRefreshFromWeb={currentOutline.isGuide ? undefined : (id) => { onSelectNode(id); onOpenLiveBooks?.(); }}
              isReadOnly={!!currentOutline.isGuide}
            />
          </ul>
        )}
      </div>

      {/* Multi-select toolbar */}
      {selectedNodeIds && selectedNodeIds.size > 0 && (
        <MultiSelectToolbar
          selectedCount={selectedNodeIds.size}
          onClearSelection={onClearSelection || (() => {})}
          onBulkDelete={onBulkDelete || (() => {})}
          onBulkChangeColor={onBulkChangeColor || (() => {})}
          onBulkAddTag={onBulkAddTag || (() => {})}
          onBulkIndent={handleBulkIndent}
          onBulkOutdent={handleBulkOutdent}
        />
      )}
    </div>
  );
}
