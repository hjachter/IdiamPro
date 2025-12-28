'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Outline, OutlineNode, NodeType, NodeMap, NodeGenerationContext, ExternalSourceInput, IngestPreview } from '@/types';
import { getInitialGuide } from '@/lib/initial-guide';
import { addNode, addNodeAfter, removeNode, updateNode, moveNode, parseMarkdownToNodes } from '@/lib/outline-utils';
import OutlinePane from './outline-pane';
import ContentPane from './content-pane';
import { useToast } from "@/hooks/use-toast";
import { generateOutlineAction, expandContentAction, generateContentForNodeAction, ingestExternalSourceAction } from '@/app/actions';
import { useAI } from '@/contexts/ai-context';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction } from './ui/alert-dialog';
import { loadStorageData, saveAllOutlines, migrateToFileSystem } from '@/lib/storage-manager';

type MobileView = 'outline' | 'content';

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
  const [mobileView, setMobileView] = useState<MobileView>('outline');
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [prefixDialogState, setPrefixDialogState] = useState<{ open: boolean, prefix: string, nodeName: string }>({ open: false, prefix: '', nodeName: '' });

  const { toast } = useToast();
  const isMobile = useIsMobile();
  const isInitialLoadDone = useRef(false);

  const currentOutline = useMemo(() => outlines.find(o => o.id === currentOutlineId), [outlines, currentOutlineId]);
  const selectedNode = useMemo(() => (currentOutline?.nodes && selectedNodeId) ? currentOutline.nodes[selectedNodeId] : null, [currentOutline, selectedNodeId]);

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
  useEffect(() => {
    // Skip saving during initial load
    if (!isInitialLoadDone.current) return;
    // Skip if no outlines loaded yet
    if (outlines.length === 0) return;

    // Save to storage (file system or localStorage)
    saveAllOutlines(outlines, currentOutlineId).catch(error => {
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

  // FIXED: handleSelectNode uses functional update for reading fresh state
  const handleSelectNode = useCallback((nodeId: string, showPrefixDialog = false) => {
    setSelectedNodeId(nodeId);
    if (isMobile) {
      setMobileView('content');
    }

    if (showPrefixDialog) {
      // Use functional update to ensure we read fresh state
      setOutlines(currentOutlines => {
        const outline = currentOutlines.find(o => o.id === currentOutlineId);
        if (outline) {
          const node = outline.nodes[nodeId];
          if (node) {
            const prefix = node.prefix || (node.type === 'root' ? '(Root)' : '');
            setPrefixDialogState({ open: true, prefix, nodeName: node.name });
          }
        }
        // Return unchanged - reading only
        return currentOutlines;
      });
    }
  }, [isMobile, currentOutlineId]);

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

  // Handle folder selection: migrate to file system and reload
  const handleFolderSelected = useCallback(async () => {
    try {
      // Migrate localStorage data to file system
      await migrateToFileSystem();

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
        description: 'Your outlines are now being saved as .json files in the selected folder.',
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

  if (!isClient || !currentOutline) {
    return (
      <div className="flex items-center justify-center h-screen w-full">
        <p>Loading Outline Pro...</p>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="h-screen bg-background">
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

        {mobileView === 'outline' ? (
          <OutlinePane
            outlines={outlines}
            currentOutline={currentOutline}
            selectedNodeId={selectedNodeId}
            onSelectOutline={handleSelectOutline}
            onCreateOutline={handleCreateOutline}
            onRenameOutline={handleRenameOutline}
            onDeleteOutline={handleDeleteOutline}
            onSelectNode={(id) => handleSelectNode(id, false)}
            onMoveNode={handleMoveNode}
            onToggleCollapse={handleToggleCollapse}
            onCollapseAll={handleCollapseAll}
            onExpandAll={handleExpandAll}
            onCreateNode={handleCreateNode}
            onDeleteNode={handleDeleteNode}
            onGenerateOutline={handleGenerateOutline}
            onIngestSource={handleIngestSource}
            onApplyIngestPreview={handleApplyIngestPreview}
            onUpdateNode={handleUpdateNode}
            onImportOutline={handleImportOutline}
            onRefreshGuide={handleRefreshGuide}
            onFolderSelected={handleFolderSelected}
            isLoadingAI={isLoadingAI}
          />
        ) : (
          <ContentPane
            node={selectedNode}
            ancestorPath={selectedNodeAncestorPath}
            onUpdate={handleUpdateNode}
            onBack={() => setMobileView('outline')}
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
            onSelectNode={(id) => handleSelectNode(id, false)}
            onMoveNode={handleMoveNode}
            onToggleCollapse={handleToggleCollapse}
            onCollapseAll={handleCollapseAll}
            onExpandAll={handleExpandAll}
            onCreateNode={handleCreateNode}
            onDeleteNode={handleDeleteNode}
            onGenerateOutline={handleGenerateOutline}
            onIngestSource={handleIngestSource}
            onApplyIngestPreview={handleApplyIngestPreview}
            onUpdateNode={handleUpdateNode}
            onImportOutline={handleImportOutline}
            onRefreshGuide={handleRefreshGuide}
            onFolderSelected={handleFolderSelected}
            isLoadingAI={isLoadingAI}
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
