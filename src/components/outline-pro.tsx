'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef, startTransition } from 'react';
import { flushSync, createPortal } from 'react-dom';
import DOMPurify from 'dompurify';
import { v4 as uuidv4 } from 'uuid';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Outline, OutlineNode, NodeType, NodeMap, NodeGenerationContext, ExternalSourceInput, IngestPreview } from '@/types';
import { getInitialGuide } from '@/lib/initial-guide';
import { addNode, addNodeAfter, removeNode, updateNode, moveNode, parseMarkdownToNodes, recalculatePrefixesForBranch, buildOutlineTreeString, generateMindmapFromSubtree, generateFlowchartFromSubtree } from '@/lib/outline-utils';
import OutlinePane from './outline-pane';
import ContentPane from './content-pane';
import { useToast } from "@/hooks/use-toast";
import { generateOutlineAction, expandContentAction, generateContentForNodeAction, ingestExternalSourceAction, bulkResearchIngestAction, bulletBasedResearchAction } from '@/app/actions';
import { useAI } from '@/contexts/ai-context';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction } from './ui/alert-dialog';
import { Button } from './ui/button';
import { loadStorageData, saveAllOutlines, migrateToFileSystem, deleteOutline, loadSingleOutlineOnDemand, saveUnmergeBackup, loadUnmergeBackup, deleteUnmergeBackup, type MigrationConflict, type ConflictResolution, type LazyOutline } from '@/lib/storage-manager';
import CommandPalette from './command-palette';
import EmptyState from './empty-state';
import TemplatesDialog from './templates-dialog';
import SidebarPane from './sidebar-pane';
import MobileSidebarSheet from './mobile-sidebar-sheet';
import KeyboardShortcutsDialog, { useKeyboardShortcuts } from './keyboard-shortcuts-dialog';
import BulkResearchDialog from './bulk-research-dialog';
import HelpChatDialog from './help-chat-dialog';
import KnowledgeChatDialog from './knowledge-chat-dialog';
import PdfExportDialog from './pdf-export-dialog';
import { exportOutlineToJson } from '@/lib/export';
import { exportSubtreeToPdf } from '@/lib/pdf-export';
import { isElectron, electronCheckPendingImports, electronDeletePendingImport, electronSaveOutlineToFile, electronGetOutlineMtime, onElectronWindowFocus, type PendingImportResult } from '@/lib/electron-storage';
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


export default function OutlinePro() {
  const [isClient, setIsClient] = useState(false);
  const [outlines, rawSetOutlines] = useState<Outline[]>([]);

  // Dirty tracking: only save outlines that were actually modified in-app
  // This prevents overwriting externally-modified .idm files
  const dirtyOutlineIdsRef = useRef<Set<string>>(new Set());

  // Wrapper around setState that auto-detects which outlines changed via reference equality
  const setOutlines = useCallback((updater: React.SetStateAction<Outline[]>) => {
    rawSetOutlines(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
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

  // For loading outlines from disk — does NOT mark dirty
  const setOutlinesFromDisk = useCallback((updater: React.SetStateAction<Outline[]>) => {
    rawSetOutlines(updater);
  }, []);

  // Track last-known file mtime for external modification detection
  // Map: outlineId -> mtimeMs (time of our last save or load)
  const lastKnownMtimeRef = useRef<Map<string, number>>(new Map());

  // Track last in-app edit time per outline (for focus reload conflict protection)
  const lastEditTimeRef = useRef<Map<string, number>>(new Map());
  const [currentOutlineId, setCurrentOutlineId] = useState<string>('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>('stacked');
  const [isLoadingAI, setIsLoadingAI] = useState(false);
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

  // Sidebar state (persisted to localStorage)
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('idiampro-sidebar-open');
      return saved !== null ? saved === 'true' : true; // Default open
    }
    return true;
  });

  // Persist sidebar state
  useEffect(() => {
    localStorage.setItem('idiampro-sidebar-open', String(isSidebarOpen));
  }, [isSidebarOpen]);

  // Mobile sidebar sheet state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Bulk research dialog state
  const [isBulkResearchOpen, setIsBulkResearchOpen] = useState(false);

  // Help chat dialog state
  const [isHelpChatOpen, setIsHelpChatOpen] = useState(false);

  // Knowledge chat dialog state
  const [isKnowledgeChatOpen, setIsKnowledgeChatOpen] = useState(false);

  // PDF export dialog state
  const [pdfExportDialogOpen, setPdfExportDialogOpen] = useState(false);
  const [pdfExportNodeId, setPdfExportNodeId] = useState<string | null>(null);

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

  const { toast } = useToast();
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

  const { plan } = useAI();

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

  // Reload current outline from disk when Electron window regains focus (external edit detection)
  useEffect(() => {
    if (!isClient) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const handleWindowFocus = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
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
            console.log(`[Focus] External change detected for "${currentOutline.name}" (disk: ${diskMtime}, known: ${lastKnown})`);
            const freshOutline = await loadSingleOutlineOnDemand(currentOutline._fileName);
            if (freshOutline) {
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
          console.error('[Focus] Error checking file mtime:', error);
        }
      }, 300);
    };

    const unsubscribe = onElectronWindowFocus(handleWindowFocus);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubscribe?.();
    };
  }, [isClient, currentOutlineId, outlines, toast, setOutlinesFromDisk]);

  // Initial load: Load data from storage
  useEffect(() => {
    setIsClient(true);

    const loadData = async () => {
      const guide = getInitialGuide();

      // Show guide immediately so the app is never stuck on a blank screen
      setOutlinesFromDisk([guide]);
      setCurrentOutlineId(guide.id);
      setSelectedNodeId(guide.rootNodeId);

      try {
        // Timeout: if storage takes too long, the guide is already showing
        const storagePromise = loadStorageData();
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Storage load timed out')), 8000)
        );
        const { outlines: userOutlines, currentOutlineId: loadedCurrentOutlineId, fixedDuplicateCount, fixedDuplicateNames } = await Promise.race([storagePromise, timeoutPromise]);
        const validOutlines = userOutlines.filter(o => o && isValidOutline(o));
        const loadedOutlines = [guide, ...validOutlines];

        setOutlinesFromDisk(loadedOutlines);

        // Record initial mtime baseline for all loaded outlines
        const now = Date.now();
        for (const o of validOutlines) {
          if (!o.isGuide) {
            lastKnownMtimeRef.current.set(o.id, now);
          }
        }

        const outlineToLoad = loadedOutlines.find(o => o.id === loadedCurrentOutlineId) || validOutlines[0] || guide;
        setCurrentOutlineId(outlineToLoad.id);
        setSelectedNodeId(outlineToLoad.rootNodeId || null);

        // Notify user if duplicate IDs were fixed
        if (fixedDuplicateCount && fixedDuplicateCount > 0) {
          toast({
            title: "Fixed Duplicate Outline IDs",
            description: `${fixedDuplicateCount} outline(s) had duplicate IDs that were automatically fixed: ${fixedDuplicateNames?.join(', ')}`,
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
        description: `"${recoveredOutline.name}" (${Object.keys(recoveredOutline.nodes).length - 1} nodes) has been recovered and saved.`,
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

      // Delete key to delete selected node
      if (e.key === 'Delete' && selectedNodeId) {
        // Check if user is typing in an input/textarea
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
          return; // Don't delete node when typing
        }

        const outline = outlines.find(o => o.id === currentOutlineId);
        if (!outline) return;
        const node = outline.nodes[selectedNodeId];
        if (!node || !node.parentId) return; // Don't delete root

        e.preventDefault();

        const confirmDelete = localStorage.getItem('confirmDelete') !== 'false';
        if (confirmDelete) {
          // Show toast to tell user to use button/menu for confirmation
          toast({
            title: "Use Delete Button",
            description: "Disable 'Confirm before deleting' in Settings to use Delete key",
            duration: 2000,
          });
          return;
        }

        // Delete without confirmation
        setOutlines(currentOutlines => {
          const outline = currentOutlines.find(o => o.id === currentOutlineId);
          if (!outline) return currentOutlines;

          const nodeToDelete = outline.nodes[selectedNodeId];
          if (!nodeToDelete || !nodeToDelete.parentId) return currentOutlines;

          const updatedOutlines = currentOutlines.map(o => {
            if (o.id !== currentOutlineId) return o;

            const updatedNodes = { ...o.nodes };
            const parentNode = updatedNodes[nodeToDelete.parentId];
            if (!parentNode) return o;

            // Remove from parent's children
            parentNode.childrenIds = parentNode.childrenIds.filter(id => id !== selectedNodeId);

            // Delete the node and all descendants
            const deleteNodeAndDescendants = (nodeId: string) => {
              const node = updatedNodes[nodeId];
              if (node) {
                node.childrenIds.forEach(deleteNodeAndDescendants);
                delete updatedNodes[nodeId];
              }
            };
            deleteNodeAndDescendants(selectedNodeId);

            return { ...o, nodes: updatedNodes };
          });

          return updatedOutlines;
        });

        // Clear selection
        setSelectedNodeId(null);
        return;
      }

      // Escape to exit focus mode
      if (e.key === 'Escape' && isFocusMode) {
        e.preventDefault();
        setIsFocusMode(false);
        toast({
          title: "Focus Mode Off",
          description: "Returned to normal view",
          duration: 1500,
        });
        return;
      }

      // Cmd+Shift+F or Ctrl+Shift+F to toggle focus mode
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault();
        setIsFocusMode(prev => {
          const next = !prev;
          toast({
            title: next ? "Focus Mode On" : "Focus Mode Off",
            description: next ? "Press Escape to exit" : "Returned to normal view",
            duration: 1500,
          });
          return next;
        });
        return;
      }

      // Cmd++ (Cmd+Shift+=) to create sibling node (can be pressed repeatedly)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === '+' || e.key === '=' || e.code === 'Equal')) {
        // Check if user is typing in an input/textarea
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
          return; // Don't intercept when typing
        }

        e.preventDefault();
        e.stopPropagation();

        if (!selectedNodeId) return;

        // Clear multi-select first
        setSelectedNodeIds(new Set());

        // Copy the EXACT logic from handleCreateNode
        setOutlines(currentOutlines => {
          let newNodeId: string | null = null;

          const newOutlines = currentOutlines.map(o => {
            if (o.id === currentOutlineId) {
              const { newNodes, newNodeId: createdNodeId } = addNodeAfter(
                o.nodes,
                selectedNodeId,
                'document',
                'New Node',
                ''
              );
              newNodeId = createdNodeId;
              return { ...o, nodes: newNodes };
            }
            return o;
          });

          // Schedule the selection update after this state update - EXACT copy from handleCreateNode
          if (newNodeId) {
            const capturedNewNodeId = newNodeId;
            setTimeout(() => {
              setSelectedNodeId(capturedNewNodeId);
            }, 0);
          }

          return newOutlines;
        });

        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFocusMode, toast, selectedNodeId, currentOutlineId, outlines]);

  // handleSelectNode - navigate param controls whether to switch to full content view on mobile
  // On mobile with stacked layout: selection updates preview, navigate=true goes to full content
  const handleSelectNode = useCallback((nodeId: string, navigate = false) => {
    setSelectedNodeId(nodeId);
    // Only navigate to full content if explicitly requested (e.g., tap on already-selected node)
    if (isMobile && navigate) {
      setMobileView('content');
    }
  }, [isMobile]);

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

  // Collapse all nodes - simply collapse chapters (direct children of root)
  // This is fast because we only modify a handful of nodes, not the entire tree.
  // Descendants stay in their current state but are visually hidden.
  const handleCollapseAll = useCallback(() => {
    setOutlines(currentOutlines => {
      return currentOutlines.map(o => {
        if (o.id === currentOutlineId) {
          const newNodes = { ...o.nodes };
          const rootNode = newNodes[o.rootNodeId];
          if (!rootNode) return o;

          // Just collapse all chapters (immediate children of root)
          // This hides everything visually without modifying thousands of nodes
          rootNode.childrenIds.forEach(childId => {
            if (newNodes[childId]) {
              newNodes[childId] = { ...newNodes[childId], isCollapsed: true };
            }
          });

          return { ...o, nodes: newNodes };
        }
        return o;
      });
    });
  }, [currentOutlineId]);

  // Expand all nodes
  // Small outlines: expands entire outline. Large outlines: scoped to selected node's subtree (3 levels max).
  const handleExpandAll = useCallback(() => {
    if (!selectedNodeId) return;

    const currentOutline = outlines.find(o => o.id === currentOutlineId);
    if (!currentOutline) return;

    const nodeCount = Object.keys(currentOutline.nodes).length;
    const LARGE_OUTLINE_THRESHOLD = 5000;
    const isLargeOutline = nodeCount > LARGE_OUTLINE_THRESHOLD;

    setOutlines(currentOutlines => {
      return currentOutlines.map(o => {
        if (o.id === currentOutlineId) {
          const newNodes = { ...o.nodes };

          if (!isLargeOutline) {
            // Small outline: expand everything
            Object.keys(newNodes).forEach(nodeId => {
              if (newNodes[nodeId].isCollapsed) {
                newNodes[nodeId] = { ...newNodes[nodeId], isCollapsed: false };
              }
            });
          } else {
            // Large outline: scope to selected node, max 3 levels
            const nodeDepths = new Map<string, number>();
            const queue: { id: string; depth: number }[] = [{ id: selectedNodeId, depth: 0 }];

            while (queue.length > 0) {
              const { id, depth } = queue.shift()!;
              if (nodeDepths.has(id)) continue;
              nodeDepths.set(id, depth);

              const node = newNodes[id];
              if (node?.childrenIds) {
                for (const childId of node.childrenIds) {
                  if (!nodeDepths.has(childId)) {
                    queue.push({ id: childId, depth: depth + 1 });
                  }
                }
              }
            }

            // Expand only nodes within 3 levels of selected node
            nodeDepths.forEach((depth, nodeId) => {
              if (depth < 3 && newNodes[nodeId]?.isCollapsed) {
                newNodes[nodeId] = { ...newNodes[nodeId], isCollapsed: false };
              }
            });
          }

          return { ...o, nodes: newNodes };
        }
        return o;
      });
    });

    if (isLargeOutline) {
      toast({
        title: 'Expanded 3 Levels',
        description: `Large outline - expanded 3 levels from "${currentOutline.nodes[selectedNodeId]?.name || 'selected node'}".`,
      });
    }
  }, [currentOutlineId, outlines, selectedNodeId, toast]);

  // Expand specific ancestor nodes (for search results)
  const handleExpandAncestors = useCallback((nodeIds: string[]) => {
    setOutlines(currentOutlines => {
      return currentOutlines.map(o => {
        if (o.id === currentOutlineId) {
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
  const handleCreateOutline = useCallback(() => {
    const newRootId = uuidv4();
    const newOutlineId = uuidv4();
    const newOutline: Outline = {
      id: newOutlineId,
      name: "Untitled Outline",
      rootNodeId: newRootId,
      nodes: {
        [newRootId]: {
          id: newRootId,
          name: "Untitled Outline",
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
  }, []);

  // Create outline from template
  const handleCreateFromTemplate = useCallback((templateOutline: Outline) => {
    setOutlines(currentOutlines => [...currentOutlines, templateOutline]);
    setCurrentOutlineId(templateOutline.id);
    setSelectedNodeId(templateOutline.rootNodeId);
    toast({
      title: "Outline Created",
      description: `"${templateOutline.name}" has been created from template.`,
    });
  }, [toast]);

  // Open the User Guide
  const handleOpenGuide = useCallback(() => {
    const guide = outlines.find(o => o.isGuide);
    if (guide) {
      setCurrentOutlineId(guide.id);
      setSelectedNodeId(guide.rootNodeId);
    }
  }, [outlines]);

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
      // Use flushSync to ensure the UI updates immediately before async work
      console.log('[Progress] Setting loading state - phase: reading');
      flushSync(() => {
        setLoadingOutlineInfo({
          name: outlineToSelect.name,
          fileSize: fileSizeDisplay,
          estimatedNodes: outlineToSelect._estimatedNodeCount || 0,
          phase: 'reading',
        });
        setIsLoadingLazyOutline(true);
      });
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

  // FIXED: handleGenerateOutline uses functional update pattern
  const handleGenerateOutline = useCallback(async (topic: string) => {
    setIsLoadingAI(true);
    try {
      const markdown = await generateOutlineAction(topic);
      const { rootNodeId, nodes } = parseMarkdownToNodes(markdown, topic);
      const newOutlineId = uuidv4();
      const newOutline: Outline = {
        id: newOutlineId,
        name: topic,
        rootNodeId,
        nodes,
      };

      setOutlines(currentOutlines => [...currentOutlines, newOutline]);
      setCurrentOutlineId(newOutlineId);
      setSelectedNodeId(rootNodeId);
    } catch (e) {
      toast({
        variant: "destructive",
        title: "AI Error",
        description: (e as Error).message || "Could not generate outline.",
      });
    } finally {
      setIsLoadingAI(false);
    }
  }, [toast]);

  // FIXED: handleExpandContent uses functional update pattern (legacy)
  const handleExpandContent = useCallback(async () => {
    if (!selectedNode) return;

    // Capture the node ID before the async operation
    const nodeIdToUpdate = selectedNode.id;

    setIsLoadingAI(true);
    try {
      const content = await expandContentAction(selectedNode.name, plan);

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
        title: "AI Error",
        description: (e as Error).message || "Could not expand content.",
      });
    } finally {
      setIsLoadingAI(false);
    }
  }, [selectedNode, currentOutlineId, toast, plan]);

  // Enhanced content generation with context - returns generated content
  const handleGenerateContentForNode = useCallback(async (context: NodeGenerationContext): Promise<string> => {
    try {
      const content = await generateContentForNodeAction(context, plan);
      return content;
    } catch (e) {
      toast({
        variant: "destructive",
        title: "AI Error",
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

    const nodes = currentOutline.nodes;
    const parentNode = nodes[parentNodeId];
    if (!parentNode || !parentNode.childrenIds || parentNode.childrenIds.length === 0) {
      toast({
        title: "No Descendants",
        description: "This node has no descendants to generate content for.",
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
        description: "This node has no descendants to generate content for.",
      });
      return;
    }

    setIsLoadingAI(true);

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

        const generatedContent = await generateContentForNodeAction(context, plan);

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

    setIsLoadingAI(false);

    if (errorCount === 0) {
      if (isPremium) {
        toast({
          title: "Content Generated",
          description: `Successfully created content for ${successCount} descendant${successCount > 1 ? 's' : ''}, with subtree diagram.`,
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
  }, [currentOutline, currentOutlineId, getAncestorPath, plan, toast]);

  // Apply ingest preview - creates nodes from preview
  const handleApplyIngestPreview = useCallback(async (preview: IngestPreview): Promise<void> => {
    if (preview.nodesToAdd.length === 0) {
      toast({
        title: "No Changes",
        description: "No new nodes to add.",
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
      description: `Added ${preview.nodesToAdd.length} new nodes to your outline.`,
    });
  }, [currentOutlineId, toast]);

  // Ingest external source - auto-applies for MVP
  const handleIngestSource = useCallback(async (source: ExternalSourceInput): Promise<void> => {
    // Build full outline structure for intelligent merging
    const outlineSummary = currentOutline
      ? `Outline: ${currentOutline.name}\n\nCurrent structure:\n${buildOutlineTreeString(currentOutline.nodes, currentOutline.rootNodeId)}`
      : undefined;

    setIsLoadingAI(true);
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
    setIsLoadingAI(true);
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
    } catch (e) {
      const errorMsg = (e as Error).message || "Could not process bulk research import.";
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
        // Show actual error for debugging
        displayMsg = `Error: ${errorMsg.substring(0, 200)}${errorMsg.length > 200 ? '...' : ''}`;
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
      // Don't re-throw - we've handled the error with the toast
    } finally {
      setIsLoadingAI(false);
    }
  }, [currentOutline, toast]);

  // Refresh the User Guide to get latest version
  const handleRefreshGuide = useCallback(() => {
    const freshGuide = getInitialGuide();
    setOutlines(currentOutlines => {
      return currentOutlines.map(o => o.isGuide ? freshGuide : o);
    });
    // Switch to the guide and select its root
    setCurrentOutlineId(freshGuide.id);
    setSelectedNodeId(freshGuide.rootNodeId);
    toast({
      title: "Guide Refreshed",
      description: "The User Guide has been updated to the latest version.",
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
            toast({
              title: "Import Successful",
              description: `Outline "${capturedName}" has been imported.`,
            });
          }, 0);

          return [...currentOutlines, newOutline];
        });

      } catch (error) {
        toast({
          variant: "destructive",
          title: "Import Failed",
          description: (error as Error).message || "An unknown error occurred during import.",
        });
      }
    };
    reader.readAsText(file);
  }, [toast]);

  // Import an outline as a chapter within the current outline
  const handleImportAsChapter = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') {
          throw new Error("File could not be read.");
        }
        const importedData = JSON.parse(text);

        // Handle both single outline and array of outlines
        const outlineToImport = Array.isArray(importedData) ? importedData[0] : importedData;

        if (!isValidOutline(outlineToImport)) {
          throw new Error("Invalid outline file format.");
        }

        setOutlines(currentOutlines => {
          const outline = currentOutlines.find(o => o.id === currentOutlineId);
          if (!outline) {
            throw new Error("No current outline selected.");
          }

          // Create a mapping of old IDs to new IDs
          const idMapping: Record<string, string> = {};
          Object.keys(outlineToImport.nodes).forEach(oldId => {
            idMapping[oldId] = uuidv4();
          });

          // Create new nodes with remapped IDs
          const newNodes: NodeMap = {};
          const importedRoot = outlineToImport.nodes[outlineToImport.rootNodeId];

          Object.entries(outlineToImport.nodes).forEach(([oldId, node]) => {
            const typedNode = node as OutlineNode;
            const newId = idMapping[oldId];
            const isImportedRoot = oldId === outlineToImport.rootNodeId;

            newNodes[newId] = {
              ...typedNode,
              id: newId,
              // Convert imported root to chapter, keep others as-is
              type: isImportedRoot ? 'chapter' : typedNode.type,
              // Remap parent ID (imported root's parent becomes current outline's root)
              parentId: isImportedRoot
                ? outline.rootNodeId
                : (typedNode.parentId ? idMapping[typedNode.parentId] : null),
              // Remap children IDs
              childrenIds: typedNode.childrenIds.map(childId => idMapping[childId]),
            };
          });

          // Get the new chapter ID (was the imported root)
          const newChapterId = idMapping[outlineToImport.rootNodeId];

          // Update the current outline
          const updatedOutline: Outline = {
            ...outline,
            nodes: {
              ...outline.nodes,
              ...newNodes,
              // Update the root node to include the new chapter as a child
              [outline.rootNodeId]: {
                ...outline.nodes[outline.rootNodeId],
                childrenIds: [...outline.nodes[outline.rootNodeId].childrenIds, newChapterId],
              },
            },
          };

          // Schedule selection of the new chapter
          setTimeout(() => {
            setSelectedNodeId(newChapterId);
            toast({
              title: "Import Successful",
              description: `"${importedRoot.name}" has been added as a chapter.`,
            });
          }, 0);

          return currentOutlines.map(o => o.id === outline.id ? updatedOutline : o);
        });

      } catch (error) {
        toast({
          variant: "destructive",
          title: "Import Failed",
          description: (error as Error).message || "An unknown error occurred during import.",
        });
      }
    };
    reader.readAsText(file);
  }, [currentOutlineId, toast]);

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
            title: "Node Duplicated",
            description: `"${duplicatedRoot.name}" has been duplicated.`,
          });
        }, 0);

        return { ...o, nodes: newNodes };
      });
    });
  }, [currentOutlineId, outlines, collectSubtree, toast]);

  // Handle export outline (for command palette)
  const handleExportOutline = useCallback(() => {
    if (currentOutline) {
      exportOutlineToJson(currentOutline);
    }
  }, [currentOutline]);

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
      title: "Subtree Copied",
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
      title: "Subtree Cut",
      description: `"${outline.nodes[nodeId].name}" ready to move. Select a target node and paste.`,
    });
  }, [currentOutlineId, outlines, collectSubtree, toast]);

  // Paste subtree as sibling after target node
  const handlePasteSubtree = useCallback((targetNodeId: string) => {
    if (!subtreeClipboard) return;

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
          title: subtreeClipboard.isCut ? "Subtree Moved" : "Subtree Pasted",
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

  const handleBulkDelete = useCallback(() => {
    if (selectedNodeIds.size === 0) return;

    const nodeCount = selectedNodeIds.size;
    const confirm = window.confirm(`Delete ${nodeCount} selected node${nodeCount > 1 ? 's' : ''}? This will also delete all their children.`);
    if (!confirm) return;

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
      title: "Nodes Deleted",
      description: `Deleted ${nodeCount} node${nodeCount > 1 ? 's' : ''}.`,
    });
  }, [selectedNodeIds, currentOutlineId, toast]);

  const handleBulkChangeColor = useCallback((color: string | undefined) => {
    if (selectedNodeIds.size === 0) return;

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
      description: `Updated color for ${selectedNodeIds.size} node${selectedNodeIds.size > 1 ? 's' : ''}.`,
    });
  }, [selectedNodeIds, currentOutlineId, toast]);

  const handleBulkAddTag = useCallback((tag: string) => {
    if (selectedNodeIds.size === 0) return;

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
      description: `Added "${tag}" to ${selectedNodeIds.size} node${selectedNodeIds.size > 1 ? 's' : ''}.`,
    });
  }, [selectedNodeIds, currentOutlineId, toast]);

  // PDF Export handlers
  const handleExportSubtreePdf = useCallback((nodeId: string) => {
    setPdfExportNodeId(nodeId);
    setPdfExportDialogOpen(true);
  }, []);

  const handlePdfExportConfirm = useCallback(async (filename: string) => {
    if (!currentOutline || !pdfExportNodeId) return;

    try {
      await exportSubtreeToPdf(currentOutline.nodes, pdfExportNodeId, filename);
      toast({
        title: "PDF Exported",
        description: `Successfully exported to ${filename}`,
      });
    } catch (error) {
      console.error('PDF export failed:', error);
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: (error as Error).message || "Could not export PDF.",
      });
    } finally {
      setPdfExportDialogOpen(false);
      setPdfExportNodeId(null);
    }
  }, [currentOutline, pdfExportNodeId, toast]);

  const handlePdfExportCancel = useCallback(() => {
    setPdfExportDialogOpen(false);
    setPdfExportNodeId(null);
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
                <span style={{ fontWeight: 500, color: '#111' }}>{(loadingOutlineInfo.nodesLoaded || 0).toLocaleString()} / {loadingOutlineInfo.totalNodes.toLocaleString()} nodes</span>
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
          onRefreshGuide={handleRefreshGuide}
          onToggleFocusMode={() => setIsFocusMode(prev => !prev)}
          onShowShortcuts={() => setIsShortcutsOpen(true)}
          onOpenBulkResearch={() => setIsBulkResearchOpen(true)}
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
          canUnmerge={hasUnmergeBackup}
          onUnmerge={handleUnmerge}
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

        <PdfExportDialog
          open={pdfExportDialogOpen}
          nodeName={pdfExportNodeId ? currentOutline.nodes[pdfExportNodeId]?.name || '' : ''}
          onExport={handlePdfExportConfirm}
          onCancel={handlePdfExportCancel}
        />

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
          onOpenGuide={handleOpenGuide}
        />

        <AlertDialog open={prefixDialogState.open} onOpenChange={(open) => setPrefixDialogState(s => ({ ...s, open }))}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Node Prefix</AlertDialogTitle>
              <AlertDialogDescription>
                The numeric prefix for the node "<strong>{prefixDialogState.nodeName}</strong>" is: <strong>{prefixDialogState.prefix}</strong>
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
                        Completed {new Date(pending.createdAt).toLocaleString()}
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
                onCreateNode={handleCreateNode}
                onDeleteNode={handleDeleteNode}
                onGenerateOutline={handleGenerateOutline}
                onOpenBulkResearch={() => setIsBulkResearchOpen(true)}
                onUpdateNode={handleUpdateNode}
                onImportOutline={handleImportOutline}
                onImportAsChapter={handleImportAsChapter}
                onCopySubtree={handleCopySubtree}
                onCutSubtree={handleCutSubtree}
                onPasteSubtree={handlePasteSubtree}
                onDuplicateNode={handleDuplicateNode}
                hasClipboard={subtreeClipboard !== null}
                onRefreshGuide={handleRefreshGuide}
                onFolderSelected={handleFolderSelected}
                isLoadingAI={isLoadingAI}
                externalSearchOpen={isSearchOpen}
                onSearchOpenChange={setIsSearchOpen}
                onGenerateContentForChildren={handleGenerateContentForChildren}
                onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
                onOpenHelp={() => setIsHelpChatOpen(true)}
                onOpenKnowledgeChat={() => setIsKnowledgeChatOpen(true)}
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
                onExportSubtreePdf={handleExportSubtreePdf}
                onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
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
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full">
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
        onRefreshGuide={handleRefreshGuide}
        onToggleFocusMode={() => setIsFocusMode(prev => !prev)}
        onShowShortcuts={() => setIsShortcutsOpen(true)}
        onOpenBulkResearch={() => setIsBulkResearchOpen(true)}
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

      <TemplatesDialog
        open={isTemplatesDialogOpen}
        onOpenChange={setIsTemplatesDialogOpen}
        onCreateFromTemplate={handleCreateFromTemplate}
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

      <PdfExportDialog
        open={pdfExportDialogOpen}
        nodeName={pdfExportNodeId ? currentOutline.nodes[pdfExportNodeId]?.name || '' : ''}
        onExport={handlePdfExportConfirm}
        onCancel={handlePdfExportCancel}
      />

      <AlertDialog open={prefixDialogState.open} onOpenChange={(open) => setPrefixDialogState(s => ({ ...s, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Node Prefix</AlertDialogTitle>
            <AlertDialogDescription>
              The numeric prefix for the node "<strong>{prefixDialogState.nodeName}</strong>" is: <strong>{prefixDialogState.prefix}</strong>
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
                      Completed {new Date(pending.createdAt).toLocaleString()}
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
                onCreateNode={handleCreateNode}
                onDeleteNode={handleDeleteNode}
                onGenerateOutline={handleGenerateOutline}
                onOpenBulkResearch={() => setIsBulkResearchOpen(true)}
                onUpdateNode={handleUpdateNode}
                onImportOutline={handleImportOutline}
                onImportAsChapter={handleImportAsChapter}
                onCopySubtree={handleCopySubtree}
                onCutSubtree={handleCutSubtree}
                onPasteSubtree={handlePasteSubtree}
                onDuplicateNode={handleDuplicateNode}
                hasClipboard={subtreeClipboard !== null}
                onRefreshGuide={handleRefreshGuide}
                onFolderSelected={handleFolderSelected}
                isLoadingAI={isLoadingAI}
                externalSearchOpen={isSearchOpen}
                onSearchOpenChange={setIsSearchOpen}
                onGenerateContentForChildren={handleGenerateContentForChildren}
                onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
                onOpenHelp={() => setIsHelpChatOpen(true)}
                onOpenKnowledgeChat={() => setIsKnowledgeChatOpen(true)}
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
                onExportSubtreePdf={handleExportSubtreePdf}
                isSidebarOpen={isSidebarOpen}
                onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
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
              />
            </div>
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
    </div>
  );
}
