'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { Outline, OutlineNode, NodeMap, ExternalSourceInput, IngestPreview } from '@/types';
import NodeItem from './node-item';
import AIMenu from './ai-menu';
import OutlineSearch, { type SearchMatch } from './outline-search';
import { MultiSelectToolbar } from './multi-select-toolbar';
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown, FilePlus, Plus, Trash2, Edit, FileDown, FileUp, RotateCcw, ChevronsUp, ChevronsDown, Settings, Search, Command } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from './ui/input';
import ImportDialog from './import-dialog';
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
  onIngestSource: (source: ExternalSourceInput) => Promise<IngestPreview>;
  onApplyIngestPreview: (preview: IngestPreview) => Promise<void>;
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
  onIngestSource,
  onApplyIngestPreview,
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
}: OutlinePaneProps) {
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // const outlinePaneRef = useRef<HTMLDivElement>(null);
  // const isMobile = useIsMobile();
  const { toast } = useToast();

  // Search state
  const [isSearchOpenInternal, setIsSearchOpenInternal] = useState(false);
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  // const [highlightedNodeIds, setHighlightedNodeIds] = useState<Set<string>>(new Set());

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

  // Handle indent (Tab) - move node inside its previous sibling
  const handleIndent = useCallback((nodeId?: string) => {
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
    const targetNodeId = nodeId || selectedNodeId;
    if (!targetNodeId || !currentOutline) return;
    const nodes = currentOutline.nodes;

    if (!canOutdent(nodes, targetNodeId, currentOutline.rootNodeId)) return;

    const node = nodes[targetNodeId];
    if (node && node.parentId) {
      onMoveNode(targetNodeId, node.parentId, 'after');
    }
  }, [selectedNodeId, currentOutline, onMoveNode]);

  // Search handlers
  const handleSearchResults = useCallback((matches: SearchMatch[], term: string) => {
    setSearchMatches(matches);
    setSearchTerm(term);
    setCurrentMatchIndex(0);

    if (matches.length > 0 && currentOutline) {
      // First, collapse all nodes
      onCollapseAll();

      // Then expand paths to all matching nodes in current outline
      const currentOutlineMatches = matches.filter(m => m.outlineId === currentOutline.id);
      const ancestorsToExpand = new Set<string>();

      currentOutlineMatches.forEach(match => {
        const path = getPathToNode(currentOutline.nodes, match.nodeId);
        path.forEach(nodeId => ancestorsToExpand.add(nodeId));
      });

      // Expand ancestors after a brief delay to let collapse complete
      if (ancestorsToExpand.size > 0 && onExpandAncestors) {
        setTimeout(() => {
          onExpandAncestors(Array.from(ancestorsToExpand));
        }, 50);
      }

      // Navigate to first match
      if (currentOutlineMatches.length > 0) {
        onSelectNode(currentOutlineMatches[0].nodeId);
      }
    }
  }, [currentOutline, onCollapseAll, onExpandAncestors, onSelectNode]);

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
  }, [searchMatches, currentMatchIndex, handleNavigateToMatch]);

  const handlePrevMatch = useCallback(() => {
    if (searchMatches.length === 0) return;
    const prevIndex = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    setCurrentMatchIndex(prevIndex);
    handleNavigateToMatch(searchMatches[prevIndex]);
  }, [searchMatches, currentMatchIndex, handleNavigateToMatch]);

  const handleCloseSearch = useCallback(() => {
    setIsSearchOpen(false);
    // Don't clear search state - user said "leave as-is"
  }, []);

  // Keyboard event handler for Tab/Shift+Tab, clipboard shortcuts, and search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle Ctrl+F for search (works even in input fields)
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setIsSearchOpen(true);
        return;
      }

      // Don't interfere with input fields for other shortcuts
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      // Handle Tab for indent/outdent
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

      // Handle Enter/Return for edit mode (any selected node except root)
      if (e.key === 'Enter') {
        if (!selectedNodeId || !currentOutline) return;
        const selectedNode = currentOutline.nodes[selectedNodeId];
        if (selectedNode?.type === 'root') return;
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
  }, [selectedNodeId, currentOutline, handleIndent, handleOutdent, hasClipboard, onCopySubtree, onCutSubtree, onPasteSubtree, onDuplicateNode, justCreatedNodeId, onTriggerEdit]);

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
    input.accept = '.json,.idm';
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

        <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex-grow font-headline text-lg font-bold truncate justify-between">
                    <span className="truncate">
                        {currentOutline?.isGuide && '📖 '}
                        {currentOutline?.name}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[280px]">
                <DropdownMenuLabel>Switch Outline</DropdownMenuLabel>
                {outlines.map(outline => {
                    const nodeCount = Object.keys(outline.nodes).length;
                    const lastMod = outline.lastModified;
                    const timeAgo = lastMod ? formatTimeAgo(lastMod) : null;
                    return (
                        <DropdownMenuItem
                            key={outline.id}
                            onSelect={() => onSelectOutline(outline.id)}
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
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onCreateOutline} className="cursor-pointer"><FilePlus className="mr-2 h-4 w-4" />New Outline</DropdownMenuItem>
                <DropdownMenuItem onSelect={handleImportClick} className="cursor-pointer">
                    <FileUp className="mr-2 h-4 w-4" /> Import Outline
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleExport} disabled={!currentOutline} className="cursor-pointer">
                    <FileDown className="mr-2 h-4 w-4" /> Export Current Outline
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Backup & Restore</DropdownMenuLabel>
                <DropdownMenuItem onSelect={handleBackupAll} className="cursor-pointer">
                    <FileDown className="mr-2 h-4 w-4" /> Backup All Outlines
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleRestoreAllClick} className="cursor-pointer">
                    <FileUp className="mr-2 h-4 w-4" /> Restore All Outlines
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
                <DropdownMenuItem onSelect={onRefreshGuide} className="cursor-pointer">
                    <RotateCcw className="mr-2 h-4 w-4" /> Refresh Guide
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>

        {/* File input outside dropdown so it doesn't unmount when dropdown closes */}
        <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json,.idm"
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
              <Button variant="outline" size="icon" onClick={() => onCreateNode()} disabled={!selectedNodeId} className="hover:bg-accent/20">
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add sibling node</TooltipContent>
          </Tooltip>

          <AlertDialog>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="icon" disabled={!selectedNodeId || isSelectedNodeRoot} className="text-destructive hover:bg-destructive/20">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
              </TooltipTrigger>
              <TooltipContent>Delete node</TooltipContent>
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
                <AlertDialogAction onClick={() => selectedNodeId && onDeleteNode(selectedNodeId)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
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

          <ImportDialog onCreateNode={onCreateNode}>
            <Button variant="outline" size="icon" disabled={!selectedNodeId} title="Import media (PDF, YouTube)" className="hover:bg-accent/20">
              <FileUp className="h-4 w-4" />
            </Button>
          </ImportDialog>

          <AIMenu
            onGenerateOutline={onGenerateOutline}
            onIngestSource={onIngestSource}
            onApplyIngestPreview={onApplyIngestPreview}
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

      <div className="flex-grow overflow-y-auto pr-2">
        {rootNode && currentOutline && (
          <ul className="select-none">
            <NodeItem
              key={rootNode.id}
              nodeId={rootNode.id}
              nodes={currentOutline.nodes}
              level={0}
              selectedNodeId={selectedNodeId}
              onSelectNode={onSelectNode}
              onMoveNode={onMoveNode}
              onToggleCollapse={onToggleCollapse}
              onUpdateNode={onUpdateNode}
              onCreateNode={onCreateNode}
              onDeleteNode={onDeleteNode}
              onCopySubtree={onCopySubtree}
              onCutSubtree={onCutSubtree}
              onPasteSubtree={onPasteSubtree}
              onDuplicateNode={onDuplicateNode}
              hasClipboard={hasClipboard}
              isRoot={true}
              onIndent={handleIndent}
              onOutdent={handleOutdent}
              searchTerm={searchTerm}
              highlightedNodeIds={currentOutlineHighlights}
              onGenerateContentForChildren={onGenerateContentForChildren}
              onCreateChildNode={onCreateChildNode}
              editingNodeId={editingNodeId}
              onEditingComplete={onEditingComplete}
              selectedNodeIds={selectedNodeIds}
              onToggleNodeSelection={onToggleNodeSelection}
              onRangeSelect={onRangeSelect}
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
        />
      )}
    </div>
  );
}
