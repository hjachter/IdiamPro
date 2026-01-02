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
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from './ui/alert-dialog';
import { Button } from './ui/button';
import { loadStorageData, saveAllOutlines, migrateToFileSystem, type MigrationConflict, type ConflictResolution } from '@/lib/storage-manager';
import CommandPalette from './command-palette';
import EmptyState from './empty-state';
import { exportOutlineToJson } from '@/lib/export';
import { createBlankOutline } from '@/lib/templates';

type MobileView = 'stacked' | 'content'; // stacked = outline + preview, content = full screen content

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

  const { toast } = useToast();
  const isMobile = useIsMobile();
  const isInitialLoadDone = useRef(false);

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

    // Update lastModified for current outline before saving
    const updatedOutlines = outlines.map(o => {
      if (o.id === currentOutlineId && !o.isGuide) {
        return { ...o, lastModified: Date.now() };
      }
      return o;
    });

    // Save to storage (file system or localStorage)
    saveAllOutlines(updatedOutlines, currentOutlineId).catch(error => {
      console.error("Auto-save failed:", error);
    });
  }, [outlines, currentOutlineId]);

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

  // Keyboard shortcut for Command Palette (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to open command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  // handleCreateNode adds new node as sibling AFTER selected node (or as child if root is selected)
  const handleCreateNode = useCallback((type: NodeType = 'document', content: string = '') => {
    if (!selectedNodeId) return;

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
          if (isMobile) {
            setMobileView('content');
          }
        }, 0);
      }

      return newOutlines;
    });
  }, [selectedNodeId, currentOutlineId, isMobile]);

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

  // Ingest external source - returns preview
  const handleIngestSource = useCallback(async (source: ExternalSourceInput): Promise<IngestPreview> => {
    // Build outline summary for context
    const outlineSummary = currentOutline
      ? `Outline: ${currentOutline.name}\nNodes: ${Object.keys(currentOutline.nodes).length}`
      : undefined;

    try {
      const preview = await ingestExternalSourceAction(source, outlineSummary, plan);
      return preview;
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Ingest Error",
        description: (e as Error).message || "Could not process external source.",
      });
      throw e;
    }
  }, [currentOutline, plan, toast]);

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
          let newNodes = { ...o.nodes };
          const rootId = o.rootNodeId;

          // Add each node from preview as children of root
          preview.nodesToAdd.forEach((previewNode, index) => {
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
          accept=".json,.idm"
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
          isGuide={currentOutline?.isGuide ?? false}
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
        accept=".json,.idm"
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
        isGuide={currentOutline?.isGuide ?? false}
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
          />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
