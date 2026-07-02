'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  ExternalLink,
  RotateCw,
  GitFork,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { templates, type Template } from '@/lib/templates';
import type { Outline } from '@/types';
import type { LazyOutline } from '@/lib/storage-manager';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { fireDiscovery, useDiscovery } from '@/hooks/use-discovery';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

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

// Cross-link Phase 2 — sidebar nesting.
//
// Pixel-level indentation per nesting depth. 16px matches the visual rhythm
// of the in-outline tree (NodeItem) and feels nested without crowding the row.
const NESTING_INDENT_PX = 16;

// localStorage key prefix for persisting expand/collapse of a parent row.
// Keyed per outline ID so each row remembers its own state across reloads.
const EXPAND_STATE_KEY_PREFIX = 'sidebarExpanded:';

// Hook that reads/writes a single expand/collapse boolean for a sidebar row.
// Defaults to collapsed (false) so a freshly-opened library is not noisy.
function usePersistedExpansion(outlineId: string): [boolean, () => void] {
  const storageKey = `${EXPAND_STATE_KEY_PREFIX}${outlineId}`;
  const [expanded, setExpanded] = useState<boolean>(false);

  // Hydrate from localStorage after mount (avoids SSR mismatch).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw === 'true') setExpanded(true);
    } catch {
      /* ignore — private mode / disabled storage */
    }
  }, [storageKey]);

  const toggle = useCallback(() => {
    setExpanded(prev => {
      const next = !prev;
      try {
        window.localStorage.setItem(storageKey, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [storageKey]);

  return [expanded, toggle];
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
  const isMobile = useIsMobile();
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [outlineToDelete, setOutlineToDelete] = useState<Outline | null>(null);
  // Don't-ask-again for delete-outline (2026-06-10). Combined with Pro mode.
  const [deleteDontAskAgain, setDeleteDontAskAgain] = useState(false);
  const { isProfessional } = useDiscovery();
  const DELETE_OUTLINE_SUPPRESS_KEY = 'confirm.deleteOutline.suppressed';
  const [selectedOutlineIds, setSelectedOutlineIds] = useState<Set<string>>(new Set());
  const [renamingOutlineId, setRenamingOutlineId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [contextMenuOutline, setContextMenuOutline] = useState<Outline | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [outlineSearch, setOutlineSearch] = useState('');

  // Discovery: fire once on the first sidebar mount so the registry can
  // surface library-organisation tips. Dedupe is handled inside the hook.
  useEffect(() => {
    fireDiscovery('sidebar-first-load');
  }, []);

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

  // Hide derivative outlines from the TOP-LEVEL list when their parent is
  // present — they render nested under the parent instead. Orphaned
  // derivatives (parent deleted) still appear at top-level with a muted hint.
  const topLevelOutlines = useMemo(() => {
    const outlineIds = new Set(sortedOutlines.map(o => o.id));
    return filteredOutlines.filter(o => {
      if (!o.derivedFromOutlineId) return true;
      // Show at top-level only if parent has been deleted.
      return !outlineIds.has(o.derivedFromOutlineId);
    });
  }, [filteredOutlines, sortedOutlines]);

  // ── Cross-link Phase 2 + Derivative outlines — parent → children map ─────
  //
  // For every outline that contains one or more `outline-link` nodes, compute
  // the ordered, de-duplicated list of target outline IDs it links to. ALSO
  // include derivative outlines (`derivedFromOutlineId` field, 2026-06-10) —
  // they render nested under their original parent with a fork badge.
  //
  // Memoised so we only walk the outlines array when it actually changes —
  // typical library is ~50 outlines so the O(N×M) walk is negligible.
  const parentToChildrenIds = useMemo(() => {
    const map = new Map<string, string[]>();
    const seenPerParent = new Map<string, Set<string>>();
    const ensure = (parentId: string) => {
      let arr = map.get(parentId);
      if (!arr) { arr = []; map.set(parentId, arr); }
      let seen = seenPerParent.get(parentId);
      if (!seen) { seen = new Set<string>(); seenPerParent.set(parentId, seen); }
      return { arr, seen };
    };

    // Pass 1: outline-link based children (cross-outline link nodes).
    for (const outline of outlines) {
      const nodes = outline.nodes;
      if (!nodes) continue;
      for (const node of Object.values(nodes)) {
        if (node.type === 'outline-link' && node.linkedOutlineId) {
          const { arr, seen } = ensure(outline.id);
          if (seen.has(node.linkedOutlineId)) continue;
          seen.add(node.linkedOutlineId);
          arr.push(node.linkedOutlineId);
        }
      }
    }

    // Pass 2: derivative outlines — appear nested under their derivedFrom
    // parent. If the parent has BOTH outline-link children and derivatives,
    // they all render under the same parent row (derivatives appear at the
    // end of the children list, after link-based children, so the user can
    // see "links" and "derivatives" as visually contiguous groups).
    for (const outline of outlines) {
      if (!outline.derivedFromOutlineId) continue;
      const parentId = outline.derivedFromOutlineId;
      const { arr, seen } = ensure(parentId);
      if (seen.has(outline.id)) continue;
      seen.add(outline.id);
      arr.push(outline.id);
    }

    return map;
  }, [outlines]);

  // ── Derivative orphan detection ──────────────────────────────────────────
  //
  // A derivative whose parent has been deleted ("orphaned") still exists in
  // the library but no longer nests under anything. Render those at top-
  // level with a muted "(was a derivative of [deleted outline])" hint. We
  // pre-compute the set of IDs whose parent is missing.
  const orphanedDerivativeIds = useMemo(() => {
    const ids = new Set<string>();
    const outlineIds = new Set(outlines.map(o => o.id));
    for (const o of outlines) {
      if (o.derivedFromOutlineId && !outlineIds.has(o.derivedFromOutlineId)) {
        ids.add(o.id);
      }
    }
    return ids;
  }, [outlines]);

  // Quick lookup: outline ID → outline object.
  const outlinesById = useMemo(() => {
    const m = new Map<string, Outline>();
    for (const o of outlines) m.set(o.id, o);
    return m;
  }, [outlines]);

  const handleSelectTemplate = (template: Template) => {
    onCreateFromTemplate(template.create());
    setTemplatesOpen(false);
  };

  const handleDeleteClick = (outline: Outline) => {
    const legacyConfirmDelete = localStorage.getItem('confirmDelete') !== 'false';
    const perPromptSuppressed = localStorage.getItem(DELETE_OUTLINE_SUPPRESS_KEY) === 'true';
    if (isProfessional || perPromptSuppressed || !legacyConfirmDelete) {
      onDeleteOutline(outline.id);
    } else {
      setOutlineToDelete(outline);
      setDeleteDontAskAgain(false);
      // Small delay to let dropdown close first
      setTimeout(() => setDeleteDialogOpen(true), 100);
    }
  };

  const handleConfirmDelete = () => {
    if (deleteDontAskAgain) {
      try { localStorage.setItem(DELETE_OUTLINE_SUPPRESS_KEY, 'true'); } catch { /* ignore */ }
    }
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
    const legacyConfirmDelete = localStorage.getItem('confirmDelete') !== 'false';
    const perPromptSuppressed = localStorage.getItem(DELETE_OUTLINE_SUPPRESS_KEY) === 'true';
    if (isProfessional || perPromptSuppressed || !legacyConfirmDelete) {
      // Delete all selected outlines
      const idsToDelete = Array.from(selectedOutlineIds);
      idsToDelete.forEach(id => onDeleteOutline(id));
      setSelectedOutlineIds(new Set());
    } else {
      setOutlineToDelete(null); // null indicates bulk delete
      setDeleteDontAskAgain(false);
      setDeleteDialogOpen(true);
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

  // Test whether an outline (by ID) matches the current sidebar search query.
  // A nested-row branch is visible if its target outline OR any of its own
  // (transitive) linked children matches.
  const matchesSearch = useCallback(
    (outlineId: string, visited: Set<string> = new Set()): boolean => {
      if (!outlineSearch) return true;
      if (visited.has(outlineId)) return false;
      visited.add(outlineId);
      const o = outlinesById.get(outlineId);
      if (!o) return false;
      if (o.name.toLowerCase().includes(searchLower)) return true;
      const childIds = parentToChildrenIds.get(outlineId);
      if (!childIds) return false;
      for (const cid of childIds) {
        if (matchesSearch(cid, visited)) return true;
      }
      return false;
    },
    [outlineSearch, searchLower, outlinesById, parentToChildrenIds]
  );

  return (
    <div className="h-full w-full flex flex-col bg-background/80 sidebar-shadow">
      {/* Brand / app title */}
      <div className="flex-shrink-0 px-3 pt-2.5 pb-1.5 border-b border-border/60">
        <span className="font-semibold text-sm tracking-tight">IdiamPro</span>
      </div>

      {/* Function clusters — grouped and labeled so they no longer blend
          together. Each cluster gets an uppercase "eyebrow" header; icons
          carry a subtle, low-saturation accent hue to tell functions apart
          at a glance. Labels/buttons stay neutral. */}
      <div className="flex-shrink-0 px-3 pt-2 pb-2 border-b border-border/60 space-y-3">
        {/* Cluster: Create */}
        <div className="space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-0.5 pt-0.5">
            Create
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 h-8 font-medium shadow-sm hover:shadow transition-all duration-150"
            onClick={onCreateOutline}
          >
            <Plus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            New Outline
          </Button>

          {/* Templates Section (collapsible) — part of the Create cluster */}
          <Collapsible open={templatesOpen} onOpenChange={setTemplatesOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-2 h-8 px-2 text-muted-foreground hover:text-foreground transition-colors duration-150">
                <span className="transition-transform duration-200" style={{ transform: templatesOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                  <ChevronRight className="h-4 w-4" />
                </span>
                <LayoutTemplate className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className="text-sm font-medium">Templates</span>
                <span className="ml-auto text-xs text-muted-foreground/70">{templates.length}</span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-0.5 animate-in slide-in-from-top-1 duration-200">
              <div className="grid grid-cols-1 gap-0.5 max-h-48 overflow-y-auto pl-2">
                {templates.map(template => (
                  <div
                    key={template.id}
                    className="flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer text-sm transition-all duration-150 hover:bg-muted/80 hover:translate-x-0.5 active:bg-muted"
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

        <Separator className="bg-border/60" />

        {/* Cluster: Learn */}
        <div className="space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-0.5">
            Learn
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 h-8 text-muted-foreground hover:text-foreground transition-colors duration-150"
            onClick={onOpenGuide}
          >
            <BookOpen className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            User Guide
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 h-8 text-muted-foreground hover:text-foreground transition-colors duration-150"
            onClick={onShowWelcome}
          >
            <Rocket className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            Welcome Outline
          </Button>
        </div>
      </div>

      {/* ── Clear labeled boundary where the outline list begins ──────────
          "OUTLINES" eyebrow header sits directly above the list, with a
          heavier accent bar + rule so it's obvious and intuitive where the
          library starts (Howard's explicit request). */}
      <div className="flex-shrink-0">
        <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5 bg-muted/40">
          <FileText className="h-4 w-4 text-primary/70" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80">Outlines</span>
          <span className="ml-auto text-[11px] text-muted-foreground/70 tabular-nums font-medium">
            {outlineSearch ? `${filteredOutlines.length} / ${uniqueUserOutlines.length}` : uniqueUserOutlines.length}
          </span>
        </div>
        <Separator className="bg-border" />
      </div>

      {/* Search input */}
      <div className="flex-shrink-0 px-2 py-1.5 border-b border-border/40 bg-muted/20">
        <div className="relative flex items-center">
          <Search className="absolute left-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={outlineSearch}
            onChange={(e) => setOutlineSearch(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Search outlines..."
            className="h-8 pl-7 pr-7 text-sm bg-background border-border/50"
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
        <div className="p-1">
          {/* User Guide — built-in row. Tooltip explains why right-click /
              rename / delete are silently ignored. */}
          {guide && showGuide && (
            <TooltipProvider delayDuration={500}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "group flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer text-sm transition-all duration-150",
                      currentOutlineId === guide.id
                        ? "bg-primary/10 text-primary border-l-2 border-primary -ml-0.5 pl-[calc(0.5rem+2px)]"
                        : "hover:bg-muted/60 hover:translate-x-0.5"
                    )}
                    onClick={() => onSelectOutline(guide.id)}
                  >
                    <BookOpen className="h-4 w-4 shrink-0" />
                    <span className="truncate italic font-medium">{guide.name}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">Built-in. Cannot be renamed or deleted.</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* User Outlines — top-level rows, each may expand to show linked
              children OR derivative outlines nested beneath them. Derivatives
              whose parent is present render under the parent (not here). */}
          {topLevelOutlines.map(outline => (
            <OutlineRow
              key={outline.id}
              outline={outline}
              depth={0}
              ancestorIds={[]}
              isNested={false}
              parentToChildrenIds={parentToChildrenIds}
              outlinesById={outlinesById}
              currentOutlineId={currentOutlineId}
              selectedOutlineIds={selectedOutlineIds}
              isMobile={isMobile}
              renamingOutlineId={renamingOutlineId}
              renameValue={renameValue}
              setRenameValue={setRenameValue}
              handleFinishRename={handleFinishRename}
              handleRenameKeyDown={handleRenameKeyDown}
              handleStartRename={handleStartRename}
              handleDeleteClick={handleDeleteClick}
              handleOutlineClick={handleOutlineClick}
              outlineSearch={outlineSearch}
              matchesSearch={matchesSearch}
              orphanedDerivativeIds={orphanedDerivativeIds}
            />
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
          <div className="flex items-center gap-2 py-2">
            <Checkbox
              id="delete-outline-dont-ask"
              checked={deleteDontAskAgain}
              onCheckedChange={(v) => setDeleteDontAskAgain(v === true)}
            />
            <Label htmlFor="delete-outline-dont-ask" className="text-sm font-normal cursor-pointer select-none">
              Don&apos;t ask again
            </Label>
          </div>
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

// ─────────────────────────────────────────────────────────────────────────────
// OutlineRow — one row in the sidebar list. Renders both top-level outlines
// and nested linked-outline children. Recurses through linked children when
// expanded. Tracks ancestor IDs along the render path to safely break loops.
// ─────────────────────────────────────────────────────────────────────────────

interface OutlineRowProps {
  outline: Outline;
  depth: number;
  ancestorIds: string[];
  isNested: boolean;
  parentToChildrenIds: Map<string, string[]>;
  outlinesById: Map<string, Outline>;
  currentOutlineId: string;
  selectedOutlineIds: Set<string>;
  isMobile: boolean;
  renamingOutlineId: string | null;
  renameValue: string;
  setRenameValue: (v: string) => void;
  handleFinishRename: () => void;
  handleRenameKeyDown: (e: React.KeyboardEvent) => void;
  handleStartRename: (o: Outline) => void;
  handleDeleteClick: (o: Outline) => void;
  handleOutlineClick: (o: Outline, e: React.MouseEvent) => void;
  outlineSearch: string;
  matchesSearch: (id: string, visited?: Set<string>) => boolean;
  /** IDs of derivative outlines whose parent has been deleted. Used to
   *  render an "(was a derivative of [deleted])" hint at top-level. */
  orphanedDerivativeIds: Set<string>;
}

function OutlineRow(props: OutlineRowProps) {
  const {
    outline,
    depth,
    ancestorIds,
    isNested,
    parentToChildrenIds,
    outlinesById,
    currentOutlineId,
    selectedOutlineIds,
    isMobile,
    renamingOutlineId,
    renameValue,
    setRenameValue,
    handleFinishRename,
    handleRenameKeyDown,
    handleStartRename,
    handleDeleteClick,
    handleOutlineClick,
    outlineSearch,
    matchesSearch,
    orphanedDerivativeIds,
  } = props;

  // Is THIS outline a derivative? (renders with a fork badge on the icon).
  const isDerivative = !!outline.derivedFromOutlineId;
  const isOrphanDerivative = isDerivative && orphanedDerivativeIds.has(outline.id);

  const [expanded, toggleExpanded] = usePersistedExpansion(outline.id);

  // Raw set of children this outline links to. May contain IDs of deleted
  // outlines (filtered out here) or IDs that would form a cycle (rendered
  // as a non-expandable leaf with a ↻ indicator).
  const rawChildrenIds = parentToChildrenIds.get(outline.id) || [];

  // Split children into normal + cycle-breaking. A cycle is any child whose
  // ID appears in the current render path's ancestor list, OR the current
  // outline itself (self-link).
  const ancestorSet = useMemo(() => new Set([...ancestorIds, outline.id]), [ancestorIds, outline.id]);

  const childItems = useMemo(() => {
    return rawChildrenIds
      .map(childId => {
        const childOutline = outlinesById.get(childId);
        if (!childOutline) return null; // Linked outline was deleted; the
                                        // link node inside the parent still
                                        // shows the "deleted outline" muted
                                        // state from Phase 1 — sidebar just
                                        // omits it.
        const isCycle = ancestorSet.has(childId);
        return { outline: childOutline, isCycle };
      })
      .filter((x): x is { outline: Outline; isCycle: boolean } => x !== null);
  }, [rawChildrenIds, outlinesById, ancestorSet]);

  // Decide whether to show the chevron. Show only if at least one child is
  // currently visible under the search filter; otherwise nothing to expand.
  const hasVisibleChildren = useMemo(() => {
    if (childItems.length === 0) return false;
    if (!outlineSearch) return true;
    return childItems.some(c => matchesSearch(c.outline.id));
  }, [childItems, outlineSearch, matchesSearch]);

  // While searching, force-expand so matches are visible without the user
  // having to click every chevron in the chain.
  const effectiveExpanded = outlineSearch ? hasVisibleChildren : expanded;

  // Indentation in px, scales with nesting depth.
  const paddingLeft = depth * NESTING_INDENT_PX;

  // Click on the OUTLINE NAME loads the outline; click on the chevron
  // toggles expand. Chevron click is intercepted with stopPropagation so the
  // row's own click handler doesn't also fire.
  const onChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleExpanded();
  };

  const row = (
    <div
      className={cn(
        'group flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer text-sm transition-all duration-150',
        selectedOutlineIds.has(outline.id)
          ? 'bg-primary/20 text-primary font-medium ring-1 ring-primary/30'
          : currentOutlineId === outline.id
          ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary -ml-0.5 pl-[calc(0.5rem+2px)]'
          : 'hover:bg-muted/60 hover:translate-x-0.5'
      )}
      style={{ paddingLeft: paddingLeft + 8 }}
      onClick={(e) => handleOutlineClick(outline, e)}
      data-outline-id={outline.id}
      data-nested={isNested ? 'true' : 'false'}
      data-depth={depth}
    >
      {/* Chevron (only when this row has visible linked children).
          Slot is preserved (width-stable) when no chevron to keep names
          aligned at the same depth. */}
      {hasVisibleChildren ? (
        <button
          type="button"
          onClick={onChevronClick}
          className="h-4 w-4 shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          aria-label={effectiveExpanded ? 'Collapse linked outlines' : 'Expand linked outlines'}
          aria-expanded={effectiveExpanded}
        >
          {effectiveExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
      ) : (
        <span className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}

      {/* Outline-type icon. Three cases:
          1. Derivative outline (2026-06-10) → GitFork badge (purple). Marks
             the row as forked from another outline regardless of whether it's
             nested or orphaned at top-level.
          2. Nested cross-outline-link child → ExternalLink (blue).
          3. Plain top-level outline → FileText. */}
      {isDerivative ? (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="h-4 w-4 shrink-0 inline-flex items-center justify-center">
                <GitFork className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="right">
              {isOrphanDerivative
                ? 'Derivative of a deleted outline'
                : (outline.derivationLabel
                  ? `Derivative — ${outline.derivationLabel}`
                  : 'Derivative outline')}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : isNested ? (
        <ExternalLink className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
      ) : (
        <FileText className="h-4 w-4 shrink-0" />
      )}

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
          <span className="truncate flex-1">
            {outline.name}
            {isOrphanDerivative && (
              <span className="ml-1.5 text-xs text-muted-foreground/70 italic">
                (orphan derivative)
              </span>
            )}
          </span>
          {(outline as LazyOutline)._isLazyLoaded && (
            <span
              className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full shrink-0"
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
            className={cn(
              'h-6 w-6 shrink-0 transition-opacity duration-150',
              isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            )}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Actions for ${outline.name}`}
          >
            <MoreHorizontal className="h-4 w-4" />
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
  );

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
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

      {/* Nested linked-children, rendered recursively when expanded. */}
      {effectiveExpanded && childItems.map(({ outline: child, isCycle }) => {
        // Skip children that don't match the search filter when active.
        if (outlineSearch && !matchesSearch(child.id)) return null;

        if (isCycle) {
          // Cycle leaf: non-clickable, with ↻ indicator + explanatory tooltip.
          // Distinct from a normal nested row (no chevron, no dropdown, muted
          // colour) so the user can tell at a glance this isn't a real branch.
          return (
            <CycleLeafRow
              key={`cycle:${outline.id}->${child.id}`}
              outline={child}
              depth={depth + 1}
            />
          );
        }

        return (
          <OutlineRow
            key={`${outline.id}->${child.id}`}
            outline={child}
            depth={depth + 1}
            ancestorIds={[...ancestorIds, outline.id]}
            isNested={true}
            parentToChildrenIds={parentToChildrenIds}
            outlinesById={outlinesById}
            currentOutlineId={currentOutlineId}
            selectedOutlineIds={selectedOutlineIds}
            isMobile={isMobile}
            renamingOutlineId={renamingOutlineId}
            renameValue={renameValue}
            setRenameValue={setRenameValue}
            handleFinishRename={handleFinishRename}
            handleRenameKeyDown={handleRenameKeyDown}
            handleStartRename={handleStartRename}
            handleDeleteClick={handleDeleteClick}
            handleOutlineClick={handleOutlineClick}
            outlineSearch={outlineSearch}
            matchesSearch={matchesSearch}
            orphanedDerivativeIds={orphanedDerivativeIds}
          />
        );
      })}
    </>
  );
}

// Cycle leaf row — second occurrence of an outline that already appears as
// an ancestor in the current render path. Non-clickable, no chevron, muted
// colour, ↻ indicator + tooltip explaining "Already shown above" so the user
// understands it's a circular reference, not an error.
function CycleLeafRow({ outline, depth }: { outline: Outline; depth: number }) {
  const paddingLeft = depth * NESTING_INDENT_PX + 8;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-md text-sm text-muted-foreground/70 italic cursor-default select-none"
            style={{ paddingLeft }}
            data-cycle-leaf="true"
            data-outline-id={outline.id}
            data-depth={depth}
          >
            <span className="h-4 w-4 shrink-0" aria-hidden="true" />
            <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground/60" />
            <span className="truncate flex-1">{outline.name}</span>
            <RotateCw className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-label="Circular reference" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          Already shown above — this outline links back into the chain.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
