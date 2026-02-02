'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { Outline, OutlineNode, NodeMap, ExternalSourceInput, IngestPreview } from '@/types';
import NodeItem from './node-item';
import AIMenu from './ai-menu';
import OutlineSearch, { type SearchMatch } from './outline-search';
import { MultiSelectToolbar } from './multi-select-toolbar';
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown, FilePlus, Plus, Trash2, Edit, FileDown, FileUp, Library, RotateCcw, ChevronsUp, ChevronsDown, Settings, Search, Command, PanelLeft, PanelLeftClose, Brain } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from './ui/input';
import SettingsDialog from './settings-dialog';
import type { NodeType } from '@/types';
import { exportOutlineToJson, exportAllOutlinesToJson, shareBackupFile, shareOutlineFile } from '@/lib/export';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';

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
  onCollapseAll: () => void;
  onExpandAll: () => void;
  onCreateNode: (type?: NodeType, content?: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onGenerateOutline: (topic: string) => Promise<void>;
  onOpenBulkResearch: () => void;
  onUpdateNode: (nodeId: string, updates: Partial<OutlineNode>) => void;
  onImportOutline: (file: File) => void;
  onImportAsChapter: (file: File) => void;
  onCopySubtree: (nodeId: string) => void;
  onCutSubtree: (nodeId: string) => void;
  onPasteSubtree: (targetNodeId: string) => void;
  onDuplicateNode: (nodeId: string) => void;
  hasClipboard: boolean;
  onRefreshGuide: () => void;
  onFolderSelected?: () => void;
  isLoadingAI: boolean;
  // Search-related props for expanding ancestors
  onExpandAncestors?: (nodeIds: string[]) => void;
  // External control for search (for command palette)
  externalSearchOpen?: boolean;
  onSearchOpenChange?: (open: boolean) => void;
  // AI content generation for children
  onGenerateContentForChildren?: (nodeId: string) => void;
  // Command palette
  onOpenCommandPalette?: () => void;
  // Help chat
  onOpenHelp?: () => void;
  // Knowledge chat
  onOpenKnowledgeChat?: () => void;
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
  // PDF export
  onExportSubtreePdf?: (nodeId: string) => void;
  // Podcast generation
  onGeneratePodcast?: (nodeId: string) => void;
  // Sidebar toggle (desktop)
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  // Mobile sidebar sheet
  onOpenMobileSidebar?: () => void;
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
  onImportAsChapter,
  onCopySubtree,
  onCutSubtree,
  onPasteSubtree,
  onDuplicateNode,
  hasClipboard,
  onRefreshGuide,
  onFolderSelected,
  isLoadingAI,
  onExpandAncestors,
  externalSearchOpen,
  onSearchOpenChange,
  onGenerateContentForChildren,
  onOpenCommandPalette,
  onOpenHelp,
  onOpenKnowledgeChat,
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
  onExportSubtreePdf,
  onGeneratePodcast,
  isSidebarOpen,
  onToggleSidebar,
  onOpenMobileSidebar,
}: OutlinePaneProps) {
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [outlineSearch, setOutlineSearch] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // const outlinePaneRef = useRef<HTMLDivElement>(null);
  // const isMobile = useIsMobile();
  const { toast } = useToast();

  // Search state
  const [isSearchOpenInternal, setIsSearchOpenInternal] = useState(false);
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const prevSearchTermRef = useRef('');
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
        const matchType = firstMatch.type;
        const localMatchIndex = 0; // First match always has local index 0
        onSearchTermChange(term, matchType, localMatchIndex);
      }
    } else if (onSearchTermChange) {
      // Term didn't change, just update highlighting
      onSearchTermChange(term);
    }

    // Don't auto-navigate on every keystroke - causes loops and re-render issues
    // User can navigate to matches using next/prev buttons or Enter key
    // The handleNavigateToMatch function will handle expansion and selection
  }, [onSearchTermChange]);

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
      const matchType = currentMatch.type;

      // Count how many content matches in the same node come before this one
      let localMatchIndex = 0;
      for (let i = 0; i < nextIndex; i++) {
        if (searchMatches[i].nodeId === currentMatch.nodeId && searchMatches[i].type === 'content') {
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
      const matchType = currentMatch.type;

      // Count how many content matches in the same node come before this one
      let localMatchIndex = 0;
      for (let i = 0; i < prevIndex; i++) {
        if (searchMatches[i].nodeId === currentMatch.nodeId && searchMatches[i].type === 'content') {
          localMatchIndex++;
        }
      }

      onSearchTermChange(searchTerm, matchType, localMatchIndex);
    }
  }, [searchMatches, currentMatchIndex, handleNavigateToMatch, onSearchTermChange, searchTerm]);

  const handleCloseSearch = useCallback(() => {
    setIsSearchOpen(false);
    // Don't clear search state - user said "leave as-is"
  }, []);

  // Keyboard event handler for Tab/Shift+Tab, clipboard shortcuts, and search
  // Separate useEffect for multi-selection keyboard shortcuts (Escape and Tab)
  useEffect(() => {
    const handleMultiSelectKeys = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      // Handle Escape to clear multi-selection
      if (e.key === 'Escape') {
        if (selectedNodeIds && selectedNodeIds.size > 0 && onClearSelection) {
          e.preventDefault();
          onClearSelection();
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
  }, [selectedNodeIds, onClearSelection, handleBulkIndent, handleBulkOutdent]);

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

      // Handle Enter/Return for edit mode (any selected node including root)
      if (e.key === 'Enter') {
        if (!selectedNodeId || !currentOutline) return;
        e.preventDefault();
        onTriggerEdit?.(selectedNodeId);
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
  }, [selectedNodeId, currentOutline, handleIndent, handleOutdent, hasClipboard, onCopySubtree, onCutSubtree, onPasteSubtree, onDuplicateNode, justCreatedNodeId, onTriggerEdit, getVisibleNodeIds, onSelectNode]);

  const handleStartRename = (id: string, currentName: string) => {
    setRenameId(id);
    setRenameValue(currentName);
  };

  const handleRenameSubmit = () => {
    if (renameId && renameValue) {
      onRenameOutline(renameId, renameValue);
    }
    setRenameId(null);
    setRenameValue('');
  };

  const handleExport = async () => {
    if (!currentOutline) return;

    if (isCapacitor()) {
      // In native app, use Share sheet
      const result = await shareOutlineFile(currentOutline);
      if (!result.success) {
        toast({
          title: 'Export Failed',
          description: 'Could not share the outline.',
          variant: 'destructive',
        });
      }
    } else {
      // In browser, use file download
      exportOutlineToJson(currentOutline);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
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
    if (isCapacitor()) {
      // In native app, use Share sheet to export file
      const result = await shareBackupFile(outlines);
      if (result.success) {
        toast({
          title: 'Backup Ready',
          description: `${result.count} outline${result.count !== 1 ? 's' : ''} ready to share.`,
        });
      } else {
        toast({
          title: 'Backup Failed',
          description: 'Could not create backup file.',
          variant: 'destructive',
        });
      }
    } else {
      // In browser (including mobile Safari), use file download
      exportAllOutlinesToJson(outlines);
    }
  };

  const handleRestoreAllClick = () => {
    // Use file picker on all platforms (works on iOS via Files app too)
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.idm,application/json,application/octet-stream';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleRestoreAll(file);
      }
    };
    input.click();
  };

  const handleRestoreAll = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const restoredOutlines = JSON.parse(content) as Outline[];

        // Import each outline
        restoredOutlines.forEach(outline => {
          onImportOutline(new File([JSON.stringify(outline)], `${outline.name}.json`, { type: 'application/json' }));
        });
      } catch (error) {
        console.error('Failed to restore outlines:', error);
      }
    };
    reader.readAsText(file);
  };

  // const handleImportAsChapterClick = () => {
  //   const input = document.createElement('input');
  //   input.type = 'file';
  //   input.accept = '.json';
  //   input.onchange = (e) => {
  //     const file = (e.target as HTMLInputElement).files?.[0];
  //     if (file) {
  //       onImportAsChapter(file);
  //     }
  //   };
  //   input.click();
  // };

  const rootNode = currentOutline?.nodes[currentOutline.rootNodeId];
  const selectedNode = selectedNodeId ? currentOutline?.nodes[selectedNodeId] : undefined;
  const isSelectedNodeRoot = selectedNode?.type === 'root';

  return (
    <div className="flex flex-col h-full bg-card p-3 space-y-3" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
      <div className="flex-shrink-0 flex items-center space-x-2 px-2">
        {/* Sidebar toggle button (desktop) */}
        {onToggleSidebar && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={onToggleSidebar}
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

        {/* Mobile sidebar button */}
        {onOpenMobileSidebar && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onOpenMobileSidebar}
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        )}

        <DropdownMenu open={dropdownOpen} onOpenChange={(open) => {
            setDropdownOpen(open);
            if (!open) setOutlineSearch('');
        }}>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex-grow font-headline text-lg font-bold truncate justify-between">
                    <span className="truncate">
                        {currentOutline?.isGuide && '📖 '}
                        {currentOutline?.name}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[280px] max-h-[80vh] flex flex-col">
                {/* Commands at top - always visible */}
                <DropdownMenuItem onSelect={onCreateOutline} className="cursor-pointer"><FilePlus className="mr-2 h-4 w-4" />New Outline</DropdownMenuItem>
                <DropdownMenuItem onSelect={handleImportClick} className="cursor-pointer">
                    <FileUp className="mr-2 h-4 w-4" /> Import Outline
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleExport} disabled={!currentOutline} className="cursor-pointer">
                    <FileDown className="mr-2 h-4 w-4" /> Export Current Outline
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Manage Current Outline</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => {
                    if (currentOutline) {
                        handleStartRename(currentOutline.id, currentOutline.name);
                    }
                    setDropdownOpen(false);
                }} disabled={currentOutline?.isGuide} className="cursor-pointer">
                    <Edit className="mr-2 h-4 w-4" /> Rename
                </DropdownMenuItem>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <DropdownMenuItem className="text-destructive cursor-pointer" disabled={currentOutline?.isGuide} onSelect={(e) => e.preventDefault()}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently delete the "{currentOutline?.name}" outline and all its content.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => currentOutline && onDeleteOutline(currentOutline.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Backup & Restore</DropdownMenuLabel>
                <DropdownMenuItem onSelect={handleBackupAll} className="cursor-pointer">
                    <FileDown className="mr-2 h-4 w-4" /> Backup All Outlines
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleRestoreAllClick} className="cursor-pointer">
                    <FileUp className="mr-2 h-4 w-4" /> Restore All Outlines
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onRefreshGuide} className="cursor-pointer">
                    <RotateCcw className="mr-2 h-4 w-4" /> Refresh User Guide
                </DropdownMenuItem>
                <DropdownMenuSeparator />

                {/* Search field */}
                <div className="px-2 py-1.5">
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md border bg-background">
                        <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <input
                            type="text"
                            placeholder="Search outlines..."
                            value={outlineSearch}
                            onChange={(e) => setOutlineSearch(e.target.value)}
                            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>

                {/* Scrollable outline list */}
                <DropdownMenuLabel className="text-xs">
                    Outlines ({outlines.filter(o =>
                        outlineSearch === '' ||
                        o.name.toLowerCase().includes(outlineSearch.toLowerCase())
                    ).length})
                </DropdownMenuLabel>
                <div className="overflow-y-auto max-h-[40vh] flex-1">
                    {[...outlines]
                        .filter(outline =>
                            outlineSearch === '' ||
                            outline.name.toLowerCase().includes(outlineSearch.toLowerCase())
                        )
                        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
                        .map(outline => {
                            const nodeCount = Object.keys(outline.nodes).length;
                            const lastMod = outline.lastModified;
                            const timeAgo = lastMod ? formatTimeAgo(lastMod) : null;
                            return (
                                <DropdownMenuItem
                                    key={outline.id}
                                    onSelect={() => {
                                        onSelectOutline(outline.id);
                                        setOutlineSearch('');
                                    }}
                                    className="cursor-pointer flex justify-between items-center"
                                >
                                    <span className="truncate">
                                        {outline.isGuide && '📖 '}{outline.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                                        {nodeCount} {nodeCount === 1 ? 'node' : 'nodes'}
                                        {timeAgo && ` · ${timeAgo}`}
                                    </span>
                                </DropdownMenuItem>
                            );
                        })}
                    {outlines.filter(o =>
                        outlineSearch !== '' &&
                        o.name.toLowerCase().includes(outlineSearch.toLowerCase())
                    ).length === 0 && outlineSearch !== '' && (
                        <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                            No outlines match "{outlineSearch}"
                        </div>
                    )}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>

        {/* File input outside dropdown so it doesn't unmount when dropdown closes */}
        <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json,.idm,application/json,application/octet-stream"
            className="hidden"
        />

        {renameId && (
            <AlertDialog open={!!renameId} onOpenChange={(open) => !open && setRenameId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Rename Outline</AlertDialogTitle>
                    </AlertDialogHeader>
                    <Input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit()}
                    />
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRenameSubmit}>Save</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        )}
      </div>

      <TooltipProvider delayDuration={300}>
        <div className="flex-shrink-0 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-[hsl(var(--toolbar-bg))] rounded-xl border border-border/30">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={() => onCreateNode()} disabled={!selectedNodeId || currentOutline?.isGuide} className="hover:bg-accent/20">
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{currentOutline?.isGuide ? 'Cannot modify User Guide' : 'Add sibling node'}</TooltipContent>
          </Tooltip>

          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={!selectedNodeId || isSelectedNodeRoot || currentOutline?.isGuide}
                  className="text-destructive hover:bg-destructive/20"
                  onClick={() => {
                    if (currentOutline?.isGuide) return;
                    const confirmDelete = localStorage.getItem('confirmDelete') !== 'false';
                    if (confirmDelete) {
                      setShowDeleteDialog(true);
                    } else {
                      selectedNodeId && onDeleteNode(selectedNodeId);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{currentOutline?.isGuide ? 'Cannot modify User Guide' : 'Delete node'}</TooltipContent>
            </Tooltip>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Node?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete "{selectedNode ? (selectedNode as OutlineNode).name : ''}" and all its children.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => {
                  selectedNodeId && onDeleteNode(selectedNodeId);
                  setShowDeleteDialog(false);
                }} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Visual spacer */}
          <div className="w-px h-6 bg-border/50 mx-0.5"></div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={() => setIsSearchOpen(true)} disabled={!currentOutline} className="hover:bg-accent/20">
                <Search className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Search outline (Ctrl+F)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={onCollapseAll} disabled={!currentOutline} className="hover:bg-accent/20">
                <ChevronsUp className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Collapse outline (show chapters only)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={onExpandAll} disabled={!currentOutline} className="hover:bg-accent/20">
                <ChevronsDown className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Expand outline (show all nodes)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onOpenBulkResearch}
                disabled={!currentOutline}
                className="hover:bg-accent/20"
              >
                <Library className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Research & Import (merge multiple sources)</TooltipContent>
          </Tooltip>

          <AIMenu
            onGenerateOutline={onGenerateOutline}
            outlineSummary={currentOutline?.name}
            isLoadingAI={isLoadingAI}
          />

          {/* Visual spacer */}
          <div className="w-px h-6 bg-border/50 mx-0.5"></div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onOpenCommandPalette}
                className="hover:bg-accent/20"
              >
                <Command className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Command Palette (⌘K)</TooltipContent>
          </Tooltip>

          <SettingsDialog onFolderSelected={onFolderSelected}>
            <Button variant="outline" size="icon" title="Settings" className="hover:bg-accent/20">
              <Settings className="h-4 w-4" />
            </Button>
          </SettingsDialog>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onOpenKnowledgeChat}
                className="hover:bg-blue-500/20 border-blue-500/30"
              >
                <Brain className="h-4 w-4 text-blue-500" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Knowledge Chat — Query Your Outlines</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onOpenHelp}
                className="hover:bg-red-500/20 border-red-500/30"
              >
                <span className="text-red-500 font-bold text-lg leading-none">?</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Help & Support</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      {/* Search panel */}
      <OutlineSearch
        isOpen={isSearchOpen}
        onClose={handleCloseSearch}
        outlines={outlines}
        currentOutline={currentOutline}
        onSearchResults={handleSearchResults}
        onNavigateToMatch={handleNavigateToMatch}
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
              onUpdateNode={currentOutline.isGuide ? () => {} : onUpdateNode}
              onCreateNode={currentOutline.isGuide ? () => {} : onCreateNode}
              onDeleteNode={currentOutline.isGuide ? () => {} : onDeleteNode}
              onCopySubtree={onCopySubtree}
              onCutSubtree={currentOutline.isGuide ? () => {} : onCutSubtree}
              onPasteSubtree={currentOutline.isGuide ? () => {} : onPasteSubtree}
              onDuplicateNode={currentOutline.isGuide ? () => {} : onDuplicateNode}
              hasClipboard={hasClipboard}
              isRoot={true}
              onIndent={handleIndent}
              onOutdent={handleOutdent}
              searchTerm={searchTerm}
              highlightedNodeIds={currentOutlineHighlights}
              onGenerateContentForChildren={currentOutline.isGuide ? undefined : onGenerateContentForChildren}
              onCreateChildNode={currentOutline.isGuide ? () => {} : onCreateChildNode}
              editingNodeId={currentOutline.isGuide ? null : editingNodeId}
              onEditingComplete={onEditingComplete}
              selectedNodeIds={selectedNodeIds}
              onToggleNodeSelection={onToggleNodeSelection}
              onRangeSelect={onRangeSelect}
              onExportSubtreePdf={onExportSubtreePdf}
              onGeneratePodcast={onGeneratePodcast}
              maxRenderDepth={maxRenderDepth}
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
