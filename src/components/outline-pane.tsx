'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Outline, OutlineNode, NodeMap, ExternalSourceInput, IngestPreview } from '@/types';
import NodeItem from './node-item';
import AIMenu from './ai-menu';
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal } from "@/components/ui/dropdown-menu";
import { ChevronDown, FilePlus, Plus, Trash2, Edit, FileDown, FileUp, RotateCcw, ChevronsUp, ChevronsDown, Settings } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from './ui/input';
import ImportDialog from './import-dialog';
import SettingsDialog from './settings-dialog';
import type { NodeType } from '@/types';
import { exportOutlineToJson, exportAllOutlinesToJson } from '@/lib/export';

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


interface OutlinePaneProps {
  outlines: Outline[];
  currentOutline: Outline | undefined;
  selectedNodeId: string | null;
  onSelectOutline: (id: string) => void;
  onCreateOutline: () => void;
  onRenameOutline: (id: string, newName: string) => void;
  onDeleteOutline: (id: string) => void;
  onSelectNode: (id: string) => void;
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
  onRefreshGuide: () => void;
  onFolderSelected?: () => void;
  isLoadingAI: boolean;
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
  onRefreshGuide,
  onFolderSelected,
  isLoadingAI,
}: OutlinePaneProps) {
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const outlinePaneRef = useRef<HTMLDivElement>(null);

  // Handle indent (Tab) - move node inside its previous sibling
  const handleIndent = useCallback(() => {
    if (!selectedNodeId || !currentOutline) return;
    const nodes = currentOutline.nodes;

    if (!canIndent(nodes, selectedNodeId)) return;

    const prevSibling = getPreviousSibling(nodes, selectedNodeId);
    if (prevSibling) {
      onMoveNode(selectedNodeId, prevSibling, 'inside');
    }
  }, [selectedNodeId, currentOutline, onMoveNode]);

  // Handle outdent (Shift+Tab) - move node to be after its parent
  const handleOutdent = useCallback(() => {
    if (!selectedNodeId || !currentOutline) return;
    const nodes = currentOutline.nodes;

    if (!canOutdent(nodes, selectedNodeId, currentOutline.rootNodeId)) return;

    const node = nodes[selectedNodeId];
    if (node && node.parentId) {
      onMoveNode(selectedNodeId, node.parentId, 'after');
    }
  }, [selectedNodeId, currentOutline, onMoveNode]);

  // Keyboard event handler for Tab/Shift+Tab
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle Tab key when outline pane has focus or a node is selected
      if (e.key !== 'Tab') return;

      // Don't interfere with input fields
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (!selectedNodeId || !currentOutline) return;

      e.preventDefault();

      if (e.shiftKey) {
        handleOutdent();
      } else {
        handleIndent();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, currentOutline, handleIndent, handleOutdent]);

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

  const handleExport = () => {
    if (currentOutline) {
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
  };

  const handleBackupAll = () => {
    exportAllOutlinesToJson(outlines);
  };

  const handleRestoreAllClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
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

  const rootNode = currentOutline?.nodes[currentOutline.rootNodeId];
  const selectedNode = selectedNodeId && currentOutline?.nodes[selectedNodeId];
  const isSelectedNodeRoot = selectedNode?.type === 'root';

  return (
    <div className="flex flex-col h-full bg-background/50 dark:bg-black/10 p-2 space-y-2">
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
            <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
                <DropdownMenuLabel>Switch Outline</DropdownMenuLabel>
                {outlines.map(outline => (
                    <DropdownMenuItem key={outline.id} onSelect={() => onSelectOutline(outline.id)} className="cursor-pointer">
                        {outline.isGuide && '📖 '}{outline.name}
                    </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onCreateOutline} className="cursor-pointer"><FilePlus className="mr-2 h-4 w-4" />New Outline</DropdownMenuItem>
                <DropdownMenuItem onSelect={handleImportClick} className="cursor-pointer">
                    <FileUp className="mr-2 h-4 w-4" /> Import Outline
                </DropdownMenuItem>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".json"
                    className="hidden"
                />
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
        <div className="flex-shrink-0 flex items-center justify-center gap-1 px-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={() => onCreateNode()} disabled={!selectedNodeId} className="hover:bg-green-950 hover:text-green-400">
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add sibling node</TooltipContent>
          </Tooltip>

          <AlertDialog>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="icon" disabled={!selectedNodeId || isSelectedNodeRoot} className="text-red-400 hover:text-red-300 hover:bg-red-950">
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
          <div className="w-px h-8 bg-border mx-1"></div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={onCollapseAll} disabled={!currentOutline} className="hover:bg-blue-950 hover:text-blue-400">
                <ChevronsUp className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Collapse outline (show chapters only)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={onExpandAll} disabled={!currentOutline} className="hover:bg-blue-950 hover:text-blue-400">
                <ChevronsDown className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Expand outline (show all nodes)</TooltipContent>
          </Tooltip>

          <ImportDialog onCreateNode={onCreateNode}>
            <Button variant="outline" size="icon" disabled={!selectedNodeId} title="Import media (PDF, YouTube)" className="hover:bg-amber-950 hover:text-amber-400">
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
          <div className="w-px h-8 bg-border mx-1"></div>

          <SettingsDialog onFolderSelected={onFolderSelected}>
            <Button variant="outline" size="icon" title="Settings" className="hover:bg-purple-950 hover:text-purple-400">
              <Settings className="h-4 w-4" />
            </Button>
          </SettingsDialog>
        </div>
      </TooltipProvider>


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
              isRoot={true}
            />
          </ul>
        )}
      </div>
    </div>
  );
}
