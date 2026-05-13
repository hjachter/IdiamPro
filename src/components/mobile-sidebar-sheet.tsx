'use client';

import React, { useState, useRef, useCallback } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  FileText,
  ChevronRight,
  Plus,
  BookOpen,
  LayoutTemplate,
  Trash2,
  MoreHorizontal,
  Search,
  X,
  Rocket,
  Pencil,
  Check,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Input } from '@/components/ui/input';
import { templates, type Template } from '@/lib/templates';
import type { Outline } from '@/types';
import { cn } from '@/lib/utils';

interface MobileSidebarSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

const LONG_PRESS_MS = 500;

export default function MobileSidebarSheet({
  open,
  onOpenChange,
  outlines,
  currentOutlineId,
  onSelectOutline,
  onCreateOutline,
  onCreateFromTemplate,
  onDeleteOutline,
  onRenameOutline,
  onOpenGuide,
  onShowWelcome,
}: MobileSidebarSheetProps) {
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [outlineSearch, setOutlineSearch] = useState('');

  // Inline rename state
  const [renamingOutlineId, setRenamingOutlineId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Multi-select state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedOutlineIds, setSelectedOutlineIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Long-press tracking
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);

  // Separate guide from user outlines
  const guide = outlines.find(o => o.isGuide);
  const userOutlines = outlines.filter(o => !o.isGuide);

  // Sort user outlines alphabetically by name (case-insensitive)
  const sortedOutlines = [...userOutlines].sort((a, b) => {
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  // Filter outlines by search query
  const searchLower = outlineSearch.toLowerCase();
  const filteredOutlines = sortedOutlines.filter(o =>
    outlineSearch === '' || o.name.toLowerCase().includes(searchLower)
  );
  const showGuide = !outlineSearch || (guide?.name.toLowerCase().includes(searchLower) ?? false);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const exitSelectMode = useCallback(() => {
    setIsSelectMode(false);
    setSelectedOutlineIds(new Set());
  }, []);

  const handleSelectTemplate = (template: Template) => {
    onCreateFromTemplate(template.create());
    onOpenChange(false);
  };

  const handleSelectOutline = (outlineId: string) => {
    onSelectOutline(outlineId);
    setOutlineSearch('');
    onOpenChange(false);
  };

  const handleShowWelcome = () => {
    onShowWelcome();
    onOpenChange(false);
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
      e.preventDefault();
      handleFinishRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setRenamingOutlineId(null);
      setRenameValue('');
    }
  };

  // Toggle outline selection in multi-select mode
  const toggleSelection = (outlineId: string) => {
    setSelectedOutlineIds(prev => {
      const next = new Set(prev);
      if (next.has(outlineId)) {
        next.delete(outlineId);
      } else {
        next.add(outlineId);
      }
      return next;
    });
  };

  // Long-press handlers — touch start begins a timer; tap/move clears it.
  const handleTouchStart = (outline: Outline) => {
    if (renamingOutlineId === outline.id) return;
    longPressFiredRef.current = false;
    clearLongPress();
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      if (!isSelectMode) {
        setIsSelectMode(true);
        setSelectedOutlineIds(new Set([outline.id]));
      } else {
        toggleSelection(outline.id);
      }
      // Haptic feedback on iOS if available
      try {
        if (typeof navigator !== 'undefined' && (navigator as any).vibrate) {
          (navigator as any).vibrate(10);
        }
      } catch {
        // ignore
      }
    }, LONG_PRESS_MS);
  };

  const handleTouchEndOrCancel = () => {
    clearLongPress();
  };

  const handleItemTap = (outlineId: string, isGuideItem = false) => {
    // If the long-press already fired, swallow the tap.
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    if (isSelectMode) {
      // Guide can't be selected for bulk delete
      if (isGuideItem) return;
      toggleSelection(outlineId);
      return;
    }
    if (isGuideItem) {
      onOpenGuide();
      onOpenChange(false);
      return;
    }
    handleSelectOutline(outlineId);
  };

  const handleConfirmBulkDelete = () => {
    selectedOutlineIds.forEach(id => onDeleteOutline(id));
    setDeleteDialogOpen(false);
    exitSelectMode();
  };

  // Reset transient state when sheet closes
  React.useEffect(() => {
    if (!open) {
      setRenamingOutlineId(null);
      setRenameValue('');
      exitSelectMode();
      clearLongPress();
    }
  }, [open, exitSelectMode, clearLongPress]);

  const renderOutlineItem = (
    outline: Outline,
    options: { isGuideItem?: boolean } = {}
  ) => {
    const { isGuideItem = false } = options;
    const isRenaming = renamingOutlineId === outline.id;
    const isSelected = selectedOutlineIds.has(outline.id);
    const isCurrent = currentOutlineId === outline.id;

    return (
      <div
        key={outline.id}
        className={cn(
          "group flex items-center gap-3 px-3 rounded-lg cursor-pointer transition-all duration-150 min-h-12 py-4",
          isSelected
            ? "bg-primary/20 text-primary font-medium ring-1 ring-primary/30"
            : isCurrent
            ? "bg-primary/10 text-primary border-l-2 border-primary -ml-0.5 pl-[calc(0.75rem+2px)]"
            : "hover:bg-muted/60 active:bg-muted"
        )}
        onClick={() => handleItemTap(outline.id, isGuideItem)}
        onTouchStart={() => {
          if (isGuideItem) return; // guide isn't multi-selectable
          handleTouchStart(outline);
        }}
        onTouchEnd={handleTouchEndOrCancel}
        onTouchMove={handleTouchEndOrCancel}
        onTouchCancel={handleTouchEndOrCancel}
      >
        {isSelectMode && !isGuideItem && (
          <span
            className={cn(
              "h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors",
              isSelected
                ? "bg-primary border-primary text-primary-foreground"
                : "border-muted-foreground/50"
            )}
            aria-hidden="true"
          >
            {isSelected && <Check className="h-3 w-3" />}
          </span>
        )}

        {isGuideItem ? (
          <BookOpen className="h-5 w-5 shrink-0" />
        ) : (
          <FileText className="h-5 w-5 shrink-0" />
        )}

        {isRenaming ? (
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleFinishRename}
            onKeyDown={handleRenameKeyDown}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="h-9 text-sm flex-1"
            autoFocus
          />
        ) : (
          <span
            className={cn(
              "truncate flex-1",
              isGuideItem && "italic font-medium"
            )}
          >
            {outline.name}
          </span>
        )}

        {!isSelectMode && !isRenaming && !isGuideItem && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 opacity-100"
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => {
                  // Prevent long-press-on-row from firing when tapping the menu button.
                  e.stopPropagation();
                  clearLongPress();
                }}
              >
                <MoreHorizontal className="h-5 w-5" />
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
                onSelect={() => {
                  onDeleteOutline(outline.id);
                  onOpenChange(false);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-xl p-0 flex flex-col elevation-3">
        {/* Header with title */}
        <SheetHeader className="flex-shrink-0 px-4 py-2 border-b border-border/60">
          <div className="flex items-center justify-between">
            <SheetTitle className="font-semibold tracking-tight">IdiamPro</SheetTitle>
          </div>
        </SheetHeader>

        {/* Multi-select action bar (replaces commands area when active) */}
        {isSelectMode ? (
          <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 bg-primary/10 border-b border-primary/20">
            <span className="text-sm font-medium text-primary">
              {selectedOutlineIds.size} selected
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-10"
                onClick={exitSelectMode}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="h-10"
                disabled={selectedOutlineIds.size === 0}
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </div>
          </div>
        ) : (
          /* Commands section - fixed at top */
          <div className="flex-shrink-0 px-3 pt-2 pb-2 border-b border-border/60 space-y-2">
            {/* Quick actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 justify-center gap-2 h-10 font-medium shadow-sm hover:shadow transition-all duration-150"
                onClick={() => {
                  onCreateOutline();
                  onOpenChange(false);
                }}
              >
                <Plus className="h-4 w-4" />
                New Outline
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 justify-center gap-2 h-10 text-muted-foreground hover:text-foreground transition-colors duration-150"
                onClick={handleShowWelcome}
              >
                <Rocket className="h-4 w-4" />
                Welcome
              </Button>
            </div>

            {/* Templates Section (collapsible) */}
            <Collapsible open={templatesOpen} onOpenChange={setTemplatesOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-2 h-8 px-3 text-muted-foreground hover:text-foreground transition-colors duration-150">
                  <span className="transition-transform duration-200" style={{ transform: templatesOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                    <ChevronRight className="h-4 w-4" />
                  </span>
                  <LayoutTemplate className="h-4 w-4" />
                  <span className="text-sm font-medium">Templates</span>
                  <span className="ml-auto text-xs text-muted-foreground/70">{templates.length}</span>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-0.5 animate-in slide-in-from-top-1 duration-200">
                <div className="grid grid-cols-1 gap-1 px-1 max-h-48 overflow-y-auto">
                  {templates.map(template => (
                    <div
                      key={template.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all duration-150 hover:bg-muted/80 active:bg-muted active:scale-[0.98]"
                      onClick={() => handleSelectTemplate(template)}
                    >
                      <span className="text-lg">{template.icon}</span>
                      <span className="text-sm truncate">{template.name}</span>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {/* Outlines list header */}
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-1 border-b border-border/40 bg-muted/30">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Outlines</span>
          <span className="ml-auto text-[10px] text-muted-foreground/70 tabular-nums">
            {outlineSearch ? `${filteredOutlines.length} / ${userOutlines.length}` : userOutlines.length}
          </span>
        </div>

        {/* Search input */}
        {!isSelectMode && (
          <div className="flex-shrink-0 px-3 py-1 border-b border-border/40">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={outlineSearch}
                onChange={(e) => setOutlineSearch(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Search outlines..."
                className="h-9 pl-8 pr-8 text-sm bg-muted/40 border-border/50"
              />
              {outlineSearch && (
                <button
                  onClick={() => setOutlineSearch('')}
                  className="absolute right-2.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Scrollable outline list */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {/* User Guide */}
            {guide && showGuide && renderOutlineItem(guide, { isGuideItem: true })}

            {/* User Outlines */}
            {filteredOutlines.map(outline => renderOutlineItem(outline))}

            {outlineSearch && filteredOutlines.length === 0 && !showGuide && (
              <p className="text-sm text-muted-foreground px-3 py-4 text-center">
                No outlines match &ldquo;{outlineSearch}&rdquo;
              </p>
            )}

            {!outlineSearch && userOutlines.length === 0 && (
              <p className="text-sm text-muted-foreground px-3 py-2">
                No outlines yet. Create one or use a template.
              </p>
            )}
          </div>
        </ScrollArea>

        {/* Bulk delete confirmation (vertical buttons for mobile) */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete {selectedOutlineIds.size}{' '}
                {selectedOutlineIds.size === 1 ? 'Outline' : 'Outlines'}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete {selectedOutlineIds.size}{' '}
                {selectedOutlineIds.size === 1 ? 'outline' : 'outlines'} and all
                their content.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
              <AlertDialogAction
                onClick={handleConfirmBulkDelete}
                className="bg-destructive hover:bg-destructive/90 w-full sm:w-auto"
              >
                Delete
              </AlertDialogAction>
              <AlertDialogCancel className="w-full sm:w-auto mt-0">
                Cancel
              </AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
