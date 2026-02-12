'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  FileText,
  ChevronRight,
  ChevronDown,
  Plus,
  BookOpen,
  LayoutTemplate,
  Trash2,
  MoreHorizontal,
  Pencil,
  Search,
  X,
  Rocket,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { templates, type Template } from '@/lib/templates';
import type { Outline } from '@/types';
import type { LazyOutline } from '@/lib/storage-manager';
import { cn } from '@/lib/utils';

interface SidebarPaneProps {
  outlines: Outline[];
  currentOutlineId: string;
  onSelectOutline: (outlineId: string) => void;
  onCreateOutline: () => void;
  onCreateFromTemplate: (outline: Outline) => void;
  onDeleteOutline: (outlineId: string) => void;
  onRenameOutline: (id: string, newName: string) => void;
  onOpenGuide: () => void;
  onShowWelcome: () => void;
}

export default function SidebarPane({
  outlines,
  currentOutlineId,
  onSelectOutline,
  onCreateOutline,
  onCreateFromTemplate,
  onDeleteOutline,
  onRenameOutline,
  onOpenGuide,
  onShowWelcome,
}: SidebarPaneProps) {
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [outlineToDelete, setOutlineToDelete] = useState<Outline | null>(null);
  const [selectedOutlineIds, setSelectedOutlineIds] = useState<Set<string>>(new Set());
  const [renamingOutlineId, setRenamingOutlineId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [contextMenuOutline, setContextMenuOutline] = useState<Outline | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [outlineSearch, setOutlineSearch] = useState('');

  // Separate guide from user outlines
  const guide = outlines.find(o => o.isGuide);
  const userOutlines = outlines.filter(o => !o.isGuide);

  // Deduplicate by ID (keep first occurrence) to prevent React key errors
  const uniqueUserOutlines = userOutlines.filter((outline, index, self) =>
    index === self.findIndex(o => o.id === outline.id)
  );

  // Sort user outlines alphabetically by name (case-insensitive)
  const sortedOutlines = [...uniqueUserOutlines].sort((a, b) => {
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  // Filter outlines by search query
  const searchLower = outlineSearch.toLowerCase();
  const filteredOutlines = sortedOutlines.filter(o =>
    outlineSearch === '' || o.name.toLowerCase().includes(searchLower)
  );
  const showGuide = !outlineSearch || (guide?.name.toLowerCase().includes(searchLower) ?? false);

  const handleSelectTemplate = (template: Template) => {
    onCreateFromTemplate(template.create());
    setTemplatesOpen(false);
  };

  const handleDeleteClick = (outline: Outline) => {
    const confirmDelete = localStorage.getItem('confirmDelete') !== 'false';
    if (confirmDelete) {
      setOutlineToDelete(outline);
      // Small delay to let dropdown close first
      setTimeout(() => setDeleteDialogOpen(true), 100);
    } else {
      onDeleteOutline(outline.id);
    }
  };

  const handleConfirmDelete = () => {
    if (outlineToDelete) {
      onDeleteOutline(outlineToDelete.id);
    } else if (selectedOutlineIds.size > 0) {
      // Bulk delete selected outlines
      selectedOutlineIds.forEach(id => onDeleteOutline(id));
      setSelectedOutlineIds(new Set());
    }
    setDeleteDialogOpen(false);
    setOutlineToDelete(null);
  };

  const handleOutlineClick = (outline: Outline, e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      // Toggle selection with Cmd/Ctrl click
      setSelectedOutlineIds(prev => {
        const next = new Set(prev);
        if (next.has(outline.id)) {
          next.delete(outline.id);
        } else {
          next.add(outline.id);
        }
        return next;
      });
    } else if (e.shiftKey && selectedOutlineIds.size > 0) {
      // Range selection with Shift click
      const lastSelectedId = Array.from(selectedOutlineIds).pop();
      const lastIndex = sortedOutlines.findIndex(o => o.id === lastSelectedId);
      const currentIndex = sortedOutlines.findIndex(o => o.id === outline.id);
      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        const rangeIds = sortedOutlines.slice(start, end + 1).map(o => o.id);
        setSelectedOutlineIds(prev => new Set([...prev, ...rangeIds]));
      }
    } else {
      // Normal click - clear selection and select outline
      setSelectedOutlineIds(new Set());
      onSelectOutline(outline.id);
    }
  };

  const handleBulkDeleteClick = () => {
    const confirmDelete = localStorage.getItem('confirmDelete') !== 'false';
    if (confirmDelete) {
      setOutlineToDelete(null); // null indicates bulk delete
      setDeleteDialogOpen(true);
    } else {
      // Delete all selected outlines
      const idsToDelete = Array.from(selectedOutlineIds);
      idsToDelete.forEach(id => onDeleteOutline(id));
      setSelectedOutlineIds(new Set());
    }
  };

  const handleStartRename = (outline: Outline) => {
    setRenamingOutlineId(outline.id);
    setRenameValue(outline.name);
  };

  const handleFinishRename = () => {
    if (renamingOutlineId && renameValue.trim()) {
      onRenameOutline(renamingOutlineId, renameValue.trim());
    }
    setRenamingOutlineId(null);
    setRenameValue('');
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFinishRename();
    } else if (e.key === 'Escape') {
      setRenamingOutlineId(null);
      setRenameValue('');
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-background/80 sidebar-shadow">
      {/* Header with commands */}
      <div className="flex-shrink-0 p-3 border-b border-border/60 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm tracking-tight">IdiamPro</span>
        </div>

        {/* Quick actions at top */}
        <div className="space-y-1.5">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 h-9 font-medium shadow-sm hover:shadow transition-all duration-150"
            onClick={onCreateOutline}
          >
            <Plus className="h-4 w-4" />
            New Outline
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 h-9 text-muted-foreground hover:text-foreground transition-colors duration-150"
            onClick={onOpenGuide}
          >
            <BookOpen className="h-4 w-4" />
            User Guide
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 h-9 text-muted-foreground hover:text-foreground transition-colors duration-150"
            onClick={onShowWelcome}
          >
            <Rocket className="h-4 w-4" />
            Welcome Tour
          </Button>
        </div>

        {/* Templates Section (collapsible) */}
        <Collapsible open={templatesOpen} onOpenChange={setTemplatesOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-2 h-8 px-2 text-muted-foreground hover:text-foreground transition-colors duration-150">
              <span className="transition-transform duration-200" style={{ transform: templatesOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                <ChevronRight className="h-4 w-4" />
              </span>
              <LayoutTemplate className="h-4 w-4" />
              <span className="text-sm font-medium">Templates</span>
              <span className="ml-auto text-xs text-muted-foreground/70">{templates.length}</span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1 animate-in slide-in-from-top-1 duration-200">
            <div className="grid grid-cols-1 gap-0.5 max-h-48 overflow-y-auto pl-2">
              {templates.map(template => (
                <div
                  key={template.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-all duration-150 hover:bg-muted/80 hover:translate-x-0.5 active:bg-muted"
                  onClick={() => handleSelectTemplate(template)}
                >
                  <span className="text-base">{template.icon}</span>
                  <span className="truncate">{template.name}</span>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Outlines list header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-muted/30">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Outlines</span>
        <span className="ml-auto text-xs text-muted-foreground/70 tabular-nums">
          {outlineSearch ? `${filteredOutlines.length} / ${uniqueUserOutlines.length}` : uniqueUserOutlines.length}
        </span>
      </div>

      {/* Search input */}
      <div className="flex-shrink-0 px-2 py-1.5 border-b border-border/40">
        <div className="relative flex items-center">
          <Search className="absolute left-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={outlineSearch}
            onChange={(e) => setOutlineSearch(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Search outlines..."
            className="h-8 pl-7 pr-7 text-sm bg-muted/40 border-border/50"
          />
          {outlineSearch && (
            <button
              onClick={() => setOutlineSearch('')}
              className="absolute right-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Bulk action bar when items are selected - FIXED position above scroll */}
      {selectedOutlineIds.size > 0 && (
        <div className="flex items-center justify-between px-3 py-2 bg-primary/10 border-b border-primary/20">
          <span className="text-sm font-medium text-primary">
            {selectedOutlineIds.size} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setSelectedOutlineIds(new Set())}
            >
              Clear
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-7 text-xs"
              onClick={handleBulkDeleteClick}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* Scrollable outline list at bottom */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {/* User Guide */}
          {guide && showGuide && (
            <div
              className={cn(
                "group flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer text-sm transition-all duration-150",
                currentOutlineId === guide.id
                  ? "bg-primary/10 text-primary border-l-2 border-primary -ml-0.5 pl-[calc(0.5rem+2px)]"
                  : "hover:bg-muted/60 hover:translate-x-0.5"
              )}
              onClick={() => onSelectOutline(guide.id)}
            >
              <BookOpen className="h-4 w-4 shrink-0" />
              <span className="truncate italic font-medium">{guide.name}</span>
            </div>
          )}

          {/* User Outlines */}
          {filteredOutlines.map(outline => (
            <ContextMenu key={outline.id}>
              <ContextMenuTrigger asChild>
                <div
                  className={cn(
                    "group flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer text-sm transition-all duration-150",
                    selectedOutlineIds.has(outline.id)
                      ? "bg-primary/20 text-primary font-medium ring-1 ring-primary/30"
                      : currentOutlineId === outline.id
                      ? "bg-primary/10 text-primary font-medium border-l-2 border-primary -ml-0.5 pl-[calc(0.5rem+2px)]"
                      : "hover:bg-muted/60 hover:translate-x-0.5"
                  )}
                  onClick={(e) => handleOutlineClick(outline, e)}
                >
                  <FileText className="h-4 w-4 shrink-0" />
                  {renamingOutlineId === outline.id ? (
                    <Input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={handleFinishRename}
                      onKeyDown={handleRenameKeyDown}
                      onClick={(e) => e.stopPropagation()}
                      className="h-6 text-sm flex-1"
                      autoFocus
                    />
                  ) : (
                    <>
                      <span className="truncate flex-1">{outline.name}</span>
                      {/* Show indicator for lazy-loaded (large) outlines */}
                      {(outline as LazyOutline)._isLazyLoaded && (
                        <span
                          className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full shrink-0"
                          title={`Large outline (~${((outline as LazyOutline)._estimatedNodeCount || 0).toLocaleString()} nodes)`}
                        >
                          {((outline as LazyOutline)._fileSize || 0) > 100_000_000
                            ? `${Math.round(((outline as LazyOutline)._fileSize || 0) / 1_000_000)}MB`
                            : ((outline as LazyOutline)._fileSize || 0) > 1_000_000
                            ? `${(((outline as LazyOutline)._fileSize || 0) / 1_000_000).toFixed(1)}MB`
                            : `${Math.round(((outline as LazyOutline)._fileSize || 0) / 1000)}KB`}
                        </span>
                      )}
                    </>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="elevation-2">
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onSelect={() => handleStartRename(outline)}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive cursor-pointer"
                        onSelect={() => handleDeleteClick(outline)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={() => handleStartRename(outline)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Rename
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  className="text-destructive"
                  onClick={() => handleDeleteClick(outline)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}

          {outlineSearch && filteredOutlines.length === 0 && !showGuide && (
            <p className="text-xs text-muted-foreground/80 px-2 py-4 text-center">
              No outlines match &ldquo;{outlineSearch}&rdquo;
            </p>
          )}

          {!outlineSearch && userOutlines.length === 0 && (
            <p className="text-xs text-muted-foreground/80 px-2 py-4 text-center">
              No outlines yet. Create one or use a template.
            </p>
          )}
        </div>
      </ScrollArea>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {outlineToDelete ? 'Delete Outline?' : `Delete ${selectedOutlineIds.size} Outlines?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {outlineToDelete
                ? `This will permanently delete "${outlineToDelete.name}" and all its content.`
                : `This will permanently delete ${selectedOutlineIds.size} outlines and all their content.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setOutlineToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
