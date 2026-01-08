'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Outline, OutlineNode, NodeType, NodeMap, NodeGenerationContext, ExternalSourceInput, IngestPreview } from '@/types';
import { getInitialGuide } from '@/lib/initial-guide';
import { addNode, addNodeAfter, removeNode, updateNode, moveNode, parseMarkdownToNodes, recalculatePrefixesForBranch } from '@/lib/outline-utils';
import OutlinePane from './outline-pane';
import ContentPane from './content-pane';
import { useToast } from "@/hooks/use-toast";
import { generateOutlineAction, expandContentAction, generateContentForNodeAction, ingestExternalSourceAction } from '@/app/actions';
import { useAI } from '@/contexts/ai-context';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction } from './ui/alert-dialog';
import { Button } from './ui/button';
import { loadStorageData, saveAllOutlines, migrateToFileSystem, type MigrationConflict, type ConflictResolution } from '@/lib/storage-manager';
import CommandPalette from './command-palette';
import EmptyState from './empty-state';
import KeyboardShortcutsDialog, { useKeyboardShortcuts } from './keyboard-shortcuts-dialog';
import { exportOutlineToJson } from '@/lib/export';

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
        Array.isArray(data.nodes) ||
        Object.keys(data.nodes).length === 0 ||
        !data.nodes[data.rootNodeId]
    ) {
        return false;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Object.values(data.nodes).every((node: any) => typeof (node as OutlineNode).prefix === 'string');
};


export default function OutlinePro() {
  const [isClient, setIsClient] = useState(false);
  const [outlines, setOutlines] = useState<Outline[]>([]);
  const [currentOutlineId, setCurrentOutlineId] = useState<string>('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>('stacked');
  const [isLoadingAI, setIsLoadingAI] = useState(false);
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
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts dialog
  const { isOpen: isShortcutsOpen, setIsOpen: setIsShortcutsOpen } = useKeyboardShortcuts();

  // Focus mode state
  const [isFocusMode, setIsFocusMode] = useState(false);

  // Multi-select state
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [lastSelectedNodeId, setLastSelectedNodeId] = useState<string | null>(null);

  // Search term state (for content pane highlighting)
  const [searchTerm, setSearchTerm] = useState<string>('');

  const { toast } = useToast();
  const isMobile = useIsMobile();
  const isInitialLoadDone = useRef(false);
  const pendingSaveRef = useRef<Promise<void> | null>(null);
  const hasUnsavedChangesRef = useRef(false);

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
  useEffect(() => {
    // Skip saving during initial load
    if (!isInitialLoadDone.current) return;
    // Skip if no outlines loaded yet
    if (outlines.length === 0) return;

    // Mark as having unsaved changes
    hasUnsavedChangesRef.current = true;

    // Update lastModified for current outline before saving
    const updatedOutlines = outlines.map(o => {
      if (o.id === currentOutlineId && !o.isGuide) {
        return { ...o, lastModified: Date.now() };
      }
      return o;
    });

    // Save to storage (file system or localStorage)
    const savePromise = saveAllOutlines(updatedOutlines, currentOutlineId)
      .then(() => {
        hasUnsavedChangesRef.current = false;
      })
      .catch(error => {
        console.error("Auto-save failed:", error);
      })
      .finally(() => {
        pendingSaveRef.current = null;
      });

    pendingSaveRef.current = savePromise;
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

  // Initial load: Load data from storage
  useEffect(() => {
    setIsClient(true);

    const loadData = async () => {
      const guide = getInitialGuide();

      try {
        const { outlines: userOutlines, currentOutlineId: loadedCurrentOutlineId } = await loadStorageData();
        const validOutlines = userOutlines.filter(o => o && isValidOutline(o));
        const loadedOutlines = [guide, ...validOutlines];

        setOutlines(loadedOutlines);

        const outlineToLoad = loadedOutlines.find(o => o.id === loadedCurrentOutlineId) || validOutlines[0] || guide;
        setCurrentOutlineId(outlineToLoad.id);
        setSelectedNodeId(outlineToLoad.rootNodeId || null);
      } catch (error) {
        console.error("Failed to load data, initializing with guide:", error);
        setOutlines([guide]);
        setCurrentOutlineId(guide.id);
        setSelectedNodeId(guide.rootNodeId);
      }

      // Mark initial load as complete so auto-save can start
      isInitialLoadDone.current = true;
    };

    loadData();
  }, []);

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
  const handleSearchTermChange = useCallback((term: string) => {
    setSearchTerm(term);
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
          // On mobile, stay in outline view - user taps content preview to see content
        }, 0);
      }

      return newOutlines;
    });
  }, [selectedNodeId, currentOutlineId]);

  // handleCreateChildNode adds new node as child of specified parent (for double-click creation)
  const handleCreateChildNode = useCallback((parentId: string) => {
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
        // Clear the ref after 5 seconds (user has had enough time to press space)
        setTimeout(() => {
          if (justCreatedNodeIdRef.current === capturedNewNodeId) {
            justCreatedNodeIdRef.current = null;
          }
        }, 5000);
        setTimeout(() => {
          setSelectedNodeId(capturedNewNodeId);
          // On mobile, stay in outline view - user taps content preview to see content
        }, 0);
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

  // Collapse all nodes - show only top-level (chapter) nodes
  const handleCollapseAll = useCallback(() => {
    setOutlines(currentOutlines => {
      return currentOutlines.map(o => {
        if (o.id === currentOutlineId) {
          const newNodes = { ...o.nodes };
          const rootNode = newNodes[o.rootNodeId];
          if (!rootNode) return o;

          // Collapse all direct children of root (top-level/chapter nodes)
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

  // Expand all nodes - show complete outline
  const handleExpandAll = useCallback(() => {
    setOutlines(currentOutlines => {
      return currentOutlines.map(o => {
        if (o.id === currentOutlineId) {
          const newNodes = { ...o.nodes };

          // Expand all nodes in the outline
          Object.keys(newNodes).forEach(nodeId => {
            if (newNodes[nodeId].isCollapsed) {
              newNodes[nodeId] = { ...newNodes[nodeId], isCollapsed: false };
            }
          });

          return { ...o, nodes: newNodes };
        }
        return o;
      });
    });
  }, [currentOutlineId]);

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

      setOutlines(loadedOutlines);

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

  // FIXED: handleDeleteOutline uses functional update pattern
  const handleDeleteOutline = useCallback(() => {
    setOutlines(currentOutlines => {
      const outlineToDelete = currentOutlines.find(o => o.id === currentOutlineId);
      if (!outlineToDelete || outlineToDelete.isGuide) return currentOutlines;

      const nextOutlines = currentOutlines.filter(o => o.id !== currentOutlineId);

      // Determine next outline to select
      const nextOutlineToSelect = nextOutlines.find(o => !o.isGuide) || nextOutlines.find(o => o.isGuide);

      if (nextOutlineToSelect) {
        // Schedule these updates after the current state update
        const capturedOutlineId = nextOutlineToSelect.id;
        const capturedRootNodeId = nextOutlineToSelect.rootNodeId;
        setTimeout(() => {
          setCurrentOutlineId(capturedOutlineId);
          setSelectedNodeId(capturedRootNodeId);
        }, 0);
        return nextOutlines;
      } else {
        // No outlines left, create a new one
        setTimeout(() => {
          handleCreateOutline();
        }, 0);
        return nextOutlines.length > 0 ? nextOutlines : currentOutlines;
      }
    });
  }, [currentOutlineId, handleCreateOutline]);

  // FIXED: handleSelectOutline uses functional update to read fresh state
  const handleSelectOutline = useCallback((outlineId: string) => {
    setOutlines(currentOutlines => {
      const newOutline = currentOutlines.find(o => o.id === outlineId);
      if (newOutline) {
        // Schedule these updates
        setTimeout(() => {
          setCurrentOutlineId(outlineId);
          setSelectedNodeId(newOutline.rootNodeId);
        }, 0);
      }
      // Return unchanged - we're just reading and triggering side effects
      return currentOutlines;
    });
  }, []);

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
        title: "No Children",
        description: "This node has no children to generate content for.",
      });
      return;
    }

    const childIds = parentNode.childrenIds;
    const totalChildren = childIds.length;

    setIsLoadingAI(true);
    toast({
      title: "Generating Content",
      description: `Creating content for ${totalChildren} child node${totalChildren > 1 ? 's' : ''}...`,
    });

    let successCount = 0;
    let errorCount = 0;

    // Process children sequentially to avoid rate limits
    for (const childId of childIds) {
      const childNode = nodes[childId];
      if (!childNode) continue;

      try {
        const ancestorPath = getAncestorPath(nodes, childId);
        const context: NodeGenerationContext = {
          nodeId: childId,
          nodeName: childNode.name,
          ancestorPath,
          existingContent: childNode.content || '',
        };

        const generatedContent = await generateContentForNodeAction(context, plan);

        // Update the node with generated content
        setOutlines(currentOutlines => {
          return currentOutlines.map(o => {
            if (o.id === currentOutlineId) {
              return {
                ...o,
                lastModified: Date.now(),
                nodes: {
                  ...o.nodes,
                  [childId]: {
                    ...o.nodes[childId],
                    content: generatedContent,
                  },
                },
              };
            }
            return o;
          });
        });

        successCount++;
      } catch (e) {
        console.error(`Failed to generate content for ${childNode.name}:`, e);
        errorCount++;
      }
    }

    setIsLoadingAI(false);

    if (errorCount === 0) {
      toast({
        title: "Content Generated",
        description: `Successfully created content for ${successCount} node${successCount > 1 ? 's' : ''}.`,
      });
    } else {
      toast({
        variant: "destructive",
        title: "Partial Success",
        description: `Generated ${successCount} of ${totalChildren} nodes. ${errorCount} failed.`,
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
    // Build outline summary for context
    const outlineSummary = currentOutline
      ? `Outline: ${currentOutline.name}\nNodes: ${Object.keys(currentOutline.nodes).length}`
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
    setSelectedNodeIds(prev => {
      const newSelection = new Set(prev);
      if (isCtrlClick) {
        // Ctrl/Cmd+Click: toggle node in selection
        if (newSelection.has(nodeId)) {
          newSelection.delete(nodeId);
        } else {
          newSelection.add(nodeId);
        }
      } else {
        // Regular click: clear selection
        newSelection.clear();
      }
      setLastSelectedNodeId(nodeId);
      return newSelection;
    });
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

  if (!isClient || !currentOutline) {
    return (
      <div className="flex items-center justify-center h-screen w-full">
        <p>Loading Outline Pro...</p>
      </div>
    );
  }

  // Show empty state when there are no user outlines
  if (!hasUserOutlines) {
    return (
      <div className="h-screen w-full">
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
          isGuide={currentOutline?.isGuide ?? false}
          isFocusMode={isFocusMode}
        />

        {/* Keyboard Shortcuts Dialog */}
        <KeyboardShortcutsDialog
          open={isShortcutsOpen}
          onOpenChange={setIsShortcutsOpen}
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
              <AlertDialogDescription className="space-y-2">
                <p><strong>{conflictDialog.conflict?.fileName}</strong> already exists in the target folder.</p>
                <p className="text-sm">
                  <strong>Your version:</strong> {conflictDialog.conflict?.localOutline.name}
                </p>
                <p className="text-sm">
                  <strong>Existing version:</strong> {conflictDialog.conflict?.existingOutline.name}
                </p>
                <p className="mt-2">What would you like to do?</p>
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
                onIngestSource={handleIngestSource}
                onApplyIngestPreview={handleApplyIngestPreview}
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
                onCreateChildNode={handleCreateChildNode}
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
                      __html: selectedNode?.content || '<p class="italic">No content yet</p>'
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
            ancestorPath={selectedNodeAncestorPath}
            onUpdate={handleUpdateNode}
            onBack={() => setMobileView('stacked')}
            onExpandContent={handleExpandContent}
            onGenerateContent={handleGenerateContentForNode}
            isLoadingAI={isLoadingAI}
            searchTerm={searchTerm}
          />
        )}
      </div>
    );
  }

  return (
    <ResizablePanelGroup direction="horizontal" className="h-screen w-full rounded-none border-none">
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
        isGuide={currentOutline?.isGuide ?? false}
        isFocusMode={isFocusMode}
      />

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsDialog
        open={isShortcutsOpen}
        onOpenChange={setIsShortcutsOpen}
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
            <AlertDialogDescription className="space-y-2">
              <p><strong>{conflictDialog.conflict?.fileName}</strong> already exists in the target folder.</p>
              <p className="text-sm">
                <strong>Your version:</strong> {conflictDialog.conflict?.localOutline.name}
              </p>
              <p className="text-sm">
                <strong>Existing version:</strong> {conflictDialog.conflict?.existingOutline.name}
              </p>
              <p className="mt-2">What would you like to do?</p>
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
            ancestorPath={selectedNodeAncestorPath}
            onUpdate={handleUpdateNode}
            onExpandContent={handleExpandContent}
            onGenerateContent={handleGenerateContentForNode}
            isLoadingAI={isLoadingAI}
            searchTerm={searchTerm}
          />
        </div>
      ) : (
        <>
          <ResizablePanel defaultSize={30} minSize={20}>
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
                onIngestSource={handleIngestSource}
                onApplyIngestPreview={handleApplyIngestPreview}
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
                onCreateChildNode={handleCreateChildNode}
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
              />
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={70} minSize={30}>
            <div className="h-full overflow-hidden">
              <ContentPane
                node={selectedNode}
                ancestorPath={selectedNodeAncestorPath}
                onUpdate={handleUpdateNode}
                onExpandContent={handleExpandContent}
                onGenerateContent={handleGenerateContentForNode}
                isLoadingAI={isLoadingAI}
                searchTerm={searchTerm}
              />
            </div>
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  );
}
