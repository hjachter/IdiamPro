'use client';

// BOARD VIEW (P4 prototype, 2026-09-11) — a kanban-style PROJECTION of an
// outline subtree. The selected node is the board, its children are the
// columns, and its grandchildren are the cards. There is NO second data
// model: the board renders straight from the outline's NodeMap, and dragging
// a card to another column calls the same moveNode-backed handler the tree's
// own drag-and-drop uses — so every move is a normal, undo-backed outline
// mutation (Cmd+Z brings the card back), and the outline pane updates the
// instant a card lands.
//
// Ordering IS persisted: dropping a card on the top half of another card
// inserts BEFORE it, bottom half inserts AFTER it (sibling order in the
// outline), and dropping on a column's empty space appends to the end of
// that column's children.
//
// v1 scope: card MOVES only. No in-board editing, creation, or deletion —
// those stay in the outline pane / context menu for now. Natural later
// extensions: double-click to rename, a "+" per column to add a card, and
// showing a card's content preview.
//
// Entry point: right-click any node → "Board View" (scope-decides-placement:
// it acts on the SELECTED node's subtree, so it lives in the context menu,
// right next to Zoom In / Focus — the other subtree projection).

import React, { useMemo, useState, useCallback } from 'react';
import type { NodeMap, OutlineNode } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { TagBadge } from './tag-badge';
import { Columns3, GripVertical, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

// Module-level dragged-card id — dataTransfer.getData() is not readable
// during dragover events (same pattern as node-item.tsx).
let draggedCardId: string | null = null;

interface BoardViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The live NodeMap of the current outline — the single source of truth. */
  nodes: NodeMap;
  /** The node whose subtree is projected: children = columns, grandchildren = cards. */
  boardNodeId: string | null;
  /**
   * Move a card. Wired to the same moveNode-backed handler as tree drag-drop,
   * so the move is a real, undo-backed outline mutation. Undefined = read-only
   * board (e.g. the User Guide): cards are not draggable.
   */
  onMoveCard?: (draggedId: string, targetId: string, position: 'before' | 'after' | 'inside') => void;
}

interface DropIndicator {
  cardId: string;
  position: 'before' | 'after';
}

function BoardCard({
  card,
  draggable,
  dropIndicator,
  onDragStart,
  onDragEnd,
  onDragOverCard,
  onDropOnCard,
}: {
  card: OutlineNode;
  draggable: boolean;
  dropIndicator: DropIndicator | null;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  onDragOverCard: (e: React.DragEvent, id: string) => void;
  onDropOnCard: (e: React.DragEvent, id: string) => void;
}) {
  const tags = card.metadata?.tags?.filter(Boolean) ?? [];
  const color = card.metadata?.color;
  const subCount = card.childrenIds?.length ?? 0;
  const showBefore = dropIndicator?.cardId === card.id && dropIndicator.position === 'before';
  const showAfter = dropIndicator?.cardId === card.id && dropIndicator.position === 'after';

  return (
    <div className="relative">
      {/* Insert-position indicators (sibling order is persisted) */}
      {showBefore && <div className="absolute -top-[5px] left-1 right-1 h-[3px] rounded-full bg-primary" />}
      {showAfter && <div className="absolute -bottom-[5px] left-1 right-1 h-[3px] rounded-full bg-primary" />}
      <div
        data-board-card
        data-node-id={card.id}
        draggable={draggable}
        onDragStart={(e) => onDragStart(e, card.id)}
        onDragEnd={onDragEnd}
        onDragOver={(e) => onDragOverCard(e, card.id)}
        onDrop={(e) => onDropOnCard(e, card.id)}
        className={cn(
          'group rounded-md border bg-card text-card-foreground shadow-sm px-3 py-2',
          'transition-colors hover:border-primary/40',
          draggable && 'cursor-grab active:cursor-grabbing',
          color && 'border-l-4'
        )}
        style={color ? { borderLeftColor: `hsl(var(--node-${color}))` } : undefined}
      >
        <div className="flex items-start gap-1.5">
          {draggable && (
            <GripVertical className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground/80" />
          )}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium leading-snug break-words">{card.name}</div>
            {tags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {tags.slice(0, 3).map((tag) => (
                  <TagBadge key={tag} tag={tag} size="sm" />
                ))}
                {tags.length > 3 && (
                  <span className="text-[10px] text-muted-foreground self-center">+{tags.length - 3}</span>
                )}
              </div>
            )}
            {subCount > 0 && (
              <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                <Layers className="h-3 w-3" />
                {subCount} item{subCount === 1 ? '' : 's'} inside
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BoardView({ open, onOpenChange, nodes, boardNodeId, onMoveCard }: BoardViewProps) {
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);
  const [hoverColumnId, setHoverColumnId] = useState<string | null>(null);

  const boardNode = boardNodeId ? nodes[boardNodeId] : null;

  // Columns are the board node's children, read LIVE from the NodeMap so the
  // board re-renders the moment the outline changes (single source of truth).
  const columns = useMemo(() => {
    if (!boardNode) return [];
    return (boardNode.childrenIds || [])
      .map((id) => nodes[id])
      .filter((n): n is OutlineNode => !!n);
  }, [boardNode, nodes]);

  const clearDragState = useCallback(() => {
    draggedCardId = null;
    setDropIndicator(null);
    setHoverColumnId(null);
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    draggedCardId = id;
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', id); } catch { /* jsdom-safety */ }
  }, []);

  const handleDragOverCard = useCallback((e: React.DragEvent, cardId: string) => {
    if (!onMoveCard || !draggedCardId || draggedCardId === cardId) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const position: 'before' | 'after' = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    setDropIndicator((prev) =>
      prev?.cardId === cardId && prev.position === position ? prev : { cardId, position }
    );
    setHoverColumnId(null);
  }, [onMoveCard]);

  const handleDropOnCard = useCallback((e: React.DragEvent, cardId: string) => {
    if (!onMoveCard || !draggedCardId || draggedCardId === cardId) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const position: 'before' | 'after' = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    onMoveCard(draggedCardId, cardId, position);
    clearDragState();
  }, [onMoveCard, clearDragState]);

  const handleDragOverColumn = useCallback((e: React.DragEvent, columnId: string) => {
    if (!onMoveCard || !draggedCardId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setHoverColumnId(columnId);
    setDropIndicator(null);
  }, [onMoveCard]);

  const handleDropOnColumn = useCallback((e: React.DragEvent, columnId: string) => {
    if (!onMoveCard || !draggedCardId) return;
    e.preventDefault();
    // Dropping on the column's open space appends to the END of that column
    // (moveNode 'inside' pushes onto the parent's childrenIds).
    onMoveCard(draggedCardId, columnId, 'inside');
    clearDragState();
  }, [onMoveCard, clearDragState]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="board-view"
        className="max-w-[94vw] w-[94vw] h-[88vh] flex flex-col p-0 gap-0"
      >
        <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Columns3 className="h-5 w-5 text-primary" />
            <span className="truncate">{boardNode?.name ?? 'Board'}</span>
            <span className="text-muted-foreground font-normal">— Board View</span>
          </DialogTitle>
          <DialogDescription>
            {onMoveCard
              ? 'Each section is a column; its items are cards. Drag a card to another column and the outline itself is reorganized — press ⌘Z to undo any move.'
              : 'Each section is a column; its items are cards. This outline is read-only, so cards can be viewed but not moved.'}
          </DialogDescription>
        </DialogHeader>

        {columns.length === 0 ? (
          // Empty board — the selected node has no children to become columns.
          <div
            data-testid="board-empty-state"
            className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8"
          >
            <Columns3 className="h-10 w-10 text-muted-foreground/40" />
            <div className="text-sm font-medium">This section has no sub-sections yet</div>
            <div className="text-sm text-muted-foreground max-w-md">
              Add items under &ldquo;{boardNode?.name ?? 'this section'}&rdquo; in the outline — each one
              becomes a column here, and the items inside them become cards you can drag between columns.
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden px-6 py-4">
            <div className="flex gap-4 h-full items-stretch">
              {columns.map((column) => {
                const cards = (column.childrenIds || [])
                  .map((id) => nodes[id])
                  .filter((n): n is OutlineNode => !!n);
                const isHover = hoverColumnId === column.id;
                return (
                  <div
                    key={column.id}
                    data-board-column
                    data-node-id={column.id}
                    className={cn(
                      'w-72 shrink-0 flex flex-col rounded-lg border bg-muted/40 max-h-full',
                      isHover && 'ring-2 ring-primary/50 bg-primary/5'
                    )}
                    onDragOver={(e) => handleDragOverColumn(e, column.id)}
                    onDrop={(e) => handleDropOnColumn(e, column.id)}
                    onDragLeave={(e) => {
                      // Only clear when truly leaving the column (not entering a child)
                      if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
                        setHoverColumnId((prev) => (prev === column.id ? null : prev));
                      }
                    }}
                  >
                    <div className="px-3 py-2.5 border-b flex items-center justify-between gap-2 shrink-0">
                      <span className="text-sm font-semibold truncate" title={column.name}>
                        {column.name}
                      </span>
                      <span
                        data-board-column-count
                        className="text-xs font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5 shrink-0"
                      >
                        {cards.length}
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[80px]">
                      {cards.length === 0 ? (
                        <div
                          data-board-column-empty
                          className="rounded-md border border-dashed text-xs text-muted-foreground text-center py-6 px-3"
                        >
                          {onMoveCard ? 'No cards yet — drag one here' : 'No cards yet'}
                        </div>
                      ) : (
                        cards.map((card) => (
                          <BoardCard
                            key={card.id}
                            card={card}
                            draggable={!!onMoveCard}
                            dropIndicator={dropIndicator}
                            onDragStart={handleDragStart}
                            onDragEnd={clearDragState}
                            onDragOverCard={handleDragOverCard}
                            onDropOnCard={handleDropOnCard}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
