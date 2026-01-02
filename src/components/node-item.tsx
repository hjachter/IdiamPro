'use client';

import React from 'react';
import type { OutlineNode, NodeMap } from '@/types';
import NodeIcon from './node-icon';
import { ChevronRight, Plus, Trash2, Edit3, ChevronDown, ChevronUp, Copy, Scissors, ClipboardPaste, CopyPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

// Module-level variable to track the currently dragged node ID
// (dataTransfer.getData() is not accessible during dragover events)
let currentDraggedNodeId: string | null = null;

interface NodeItemProps {
  nodeId: string;
  nodes: NodeMap;
  level: number;
  selectedNodeId: string | null;
  onSelectNode: (id: string, navigate?: boolean) => void;
  onMoveNode: (draggedId: string, targetId: string, position: 'before' | 'after' | 'inside') => void;
  onToggleCollapse: (id: string) => void;
  onUpdateNode: (nodeId: string, updates: Partial<OutlineNode>) => void;
  onCreateNode?: () => void;
  onDeleteNode?: (nodeId: string) => void;
  onCopySubtree?: (nodeId: string) => void;
  onCutSubtree?: (nodeId: string) => void;
  onPasteSubtree?: (targetNodeId: string) => void;
  onDuplicateNode?: (nodeId: string) => void;
  hasClipboard?: boolean;
  isRoot?: boolean;
  onIndent?: (nodeId: string) => void;
  onOutdent?: (nodeId: string) => void;
  // Search highlighting
  searchTerm?: string;
  highlightedNodeIds?: Set<string>;
}

// Helper to highlight search matches in text
function highlightText(text: string, searchTerm: string): React.ReactNode {
  if (!searchTerm || searchTerm.length < 2) return text;

  const lowerText = text.toLowerCase();
  const lowerSearch = searchTerm.toLowerCase();
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let index = lowerText.indexOf(lowerSearch);
  let key = 0;

  while (index !== -1) {
    // Add text before match
    if (index > lastIndex) {
      parts.push(text.slice(lastIndex, index));
    }
    // Add highlighted match
    parts.push(
      <mark
        key={key++}
        className="bg-yellow-300 dark:bg-yellow-600 text-foreground px-0.5 rounded-sm"
      >
        {text.slice(index, index + searchTerm.length)}
      </mark>
    );
    lastIndex = index + searchTerm.length;
    index = lowerText.indexOf(lowerSearch, lastIndex);
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

type DropPosition = 'before' | 'after' | 'inside' | null;

const isDescendant = (nodes: NodeMap, potentialDescendantId: string, potentialAncestorId: string): boolean => {
    if (!potentialDescendantId || !potentialAncestorId || !nodes[potentialDescendantId] || !nodes[potentialAncestorId]) return false;
    let currentId: string | null = nodes[potentialDescendantId]?.parentId ?? null;
    while (currentId) {
        if (currentId === potentialAncestorId) {
            return true;
        }
        currentId = nodes[currentId]?.parentId ?? null;
    }
    return false;
};

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

// Check if a node is a leaf (has no children)
const isLeafNode = (nodes: NodeMap, nodeId: string): boolean => {
    const node = nodes[nodeId];
    return !node || !node.childrenIds || node.childrenIds.length === 0;
};

export default function NodeItem({
  nodeId,
  nodes,
  level,
  selectedNodeId,
  onSelectNode,
  onMoveNode,
  onToggleCollapse,
  onUpdateNode,
  onCreateNode,
  onDeleteNode,
  onCopySubtree,
  onCutSubtree,
  onPasteSubtree,
  onDuplicateNode,
  hasClipboard = false,
  isRoot = false,
  onIndent,
  onOutdent,
  searchTerm,
  highlightedNodeIds,
}: NodeItemProps) {
  const node = nodes[nodeId];
  const [isEditing, setIsEditing] = React.useState(false);
  const [name, setName] = React.useState(node.name);
  const [dropPosition, setDropPosition] = React.useState<DropPosition>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const itemRef = React.useRef<HTMLLIElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Double-tap detection for touch devices
  const lastTapRef = React.useRef<number>(0);
  const tapTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Swipe gesture detection for indent/outdent (works with both touch and mouse/pointer)
  const pointerStartRef = React.useRef<{ x: number; y: number; time: number; pointerId: number } | null>(null);
  const [swipeOffset, setSwipeOffset] = React.useState(0);
  const SWIPE_THRESHOLD = 40; // pixels needed to trigger indent/outdent
  const swipeTriggeredRef = React.useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isRoot || isEditing) return;
    pointerStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now(), pointerId: e.pointerId };
    swipeTriggeredRef.current = false;
    setSwipeOffset(0);
    // Capture pointer to receive move events even outside element
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    // Prevent default to avoid zoom/scroll
    e.preventDefault();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointerStartRef.current || isRoot || swipeTriggeredRef.current) return;
    if (e.pointerId !== pointerStartRef.current.pointerId) return;

    const deltaX = e.clientX - pointerStartRef.current.x;
    const deltaY = Math.abs(e.clientY - pointerStartRef.current.y);

    // Only track horizontal swipes (ignore if more vertical than horizontal)
    if (deltaY > Math.abs(deltaX) * 0.5) {
      setSwipeOffset(0);
      return;
    }

    // Prevent default to avoid zoom/scroll during swipe
    e.preventDefault();

    // Limit the visual offset
    const clampedOffset = Math.max(-SWIPE_THRESHOLD * 2, Math.min(SWIPE_THRESHOLD * 2, deltaX));
    setSwipeOffset(clampedOffset);

    // Trigger indent/outdent immediately when threshold is crossed
    if (Math.abs(deltaX) >= SWIPE_THRESHOLD && !swipeTriggeredRef.current) {
      swipeTriggeredRef.current = true;
      if (deltaX > 0 && onIndent) {
        onIndent(nodeId);
      } else if (deltaX < 0 && onOutdent) {
        onOutdent(nodeId);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (pointerStartRef.current && e.pointerId === pointerStartRef.current.pointerId) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
    const wasSwipe = swipeTriggeredRef.current;
    pointerStartRef.current = null;
    swipeTriggeredRef.current = false;
    setSwipeOffset(0);
    return wasSwipe;
  };

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  React.useEffect(() => {
    setName(node.name);
  }, [node.name]);

  if (!node) return null;

  const isChapter = node.type === 'chapter' || node.type === 'root' || (Array.isArray(node.childrenIds) && node.childrenIds.length > 0);
  const isSelected = selectedNodeId === node.id;
  const numbering = node.prefix;

  const handleDragStart = (e: React.DragEvent) => {
    if (isRoot) {
      e.preventDefault();
      return;
    }
    e.stopPropagation();
    e.dataTransfer.setData('application/outline-node-id', node.id);
    e.dataTransfer.effectAllowed = 'move';
    currentDraggedNodeId = node.id;
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    currentDraggedNodeId = null;
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const draggedId = currentDraggedNodeId;
    if (!draggedId || draggedId === nodeId || isDescendant(nodes, nodeId, draggedId)) {
        e.dataTransfer.dropEffect = 'none';
        setDropPosition(null);
        return;
    }

    e.dataTransfer.dropEffect = 'move';

    if (!itemRef.current) return;

    const rect = itemRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;

    // Any node can receive children - leaf nodes become chapters when they do
    // Use smaller threshold (0.3) to make 'inside' zone larger for easier nesting
    const dropZoneThreshold = 0.3;

    let newDropPosition: DropPosition;
    if (y < height * dropZoneThreshold) {
        newDropPosition = 'before';
    } else if (y > height * (1 - dropZoneThreshold)) {
        newDropPosition = 'after';
    } else {
        // Middle zone = drop inside (nest as child)
        newDropPosition = 'inside';
    }

    // Root node special case: can only drop inside, not before/after
    if (isRoot && (newDropPosition === 'before' || newDropPosition === 'after')) {
        newDropPosition = 'inside';
    }

    setDropPosition(newDropPosition);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    setDropPosition(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Use module-level variable (more reliable than getData in some browsers)
    const draggedId = currentDraggedNodeId || e.dataTransfer.getData('application/outline-node-id');

    if (draggedId && dropPosition) {
        if (draggedId !== nodeId && !isDescendant(nodes, nodeId, draggedId)) {
            onMoveNode(draggedId, nodeId, dropPosition);
        }
    }
    setDropPosition(null);
    currentDraggedNodeId = null;
  };


  const handleNameChange = () => {
    if (name.trim() === '') {
      setName(node.name);
    } else if (name !== node.name) {
      onUpdateNode(node.id, { name });
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleNameChange();
    if (e.key === 'Escape') {
      setName(node.name);
      setIsEditing(false);
    }
  };

  // Track if we just handled a touch event to prevent double-firing
  const touchHandledRef = React.useRef<boolean>(false);

  // Handle touch tap with double-tap detection
  const handleTouchTap = (e: React.TouchEvent) => {
    // Don't handle if already editing
    if (isEditing) return;

    // Mark that we handled a touch event
    touchHandledRef.current = true;
    setTimeout(() => { touchHandledRef.current = false; }, 100);

    const now = Date.now();
    const DOUBLE_TAP_DELAY = 350;

    // Check if this is a double-tap
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double-tap detected - enter edit mode
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
      lastTapRef.current = 0;
      setIsEditing(true);
      e.preventDefault();
      e.stopPropagation();
    } else {
      // First tap - wait to see if there's a second tap
      lastTapRef.current = now;
      e.preventDefault();

      tapTimeoutRef.current = setTimeout(() => {
        // Just select the node, never navigate from here
        // Navigation only happens via content pane tap
        onSelectNode(node.id, false);
        tapTimeoutRef.current = null;
      }, DOUBLE_TAP_DELAY);
    }
  };

  // Handle mouse click (desktop only)
  const handleClick = (e: React.MouseEvent) => {
    // Skip if this click was triggered by a touch event
    if (touchHandledRef.current) return;

    // Don't handle if already editing
    if (isEditing) return;

    // Desktop: single click selects, double-click handled by onDoubleClick
    onSelectNode(node.id);
  };

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
    };
  }, []);

  return (
    <li
      ref={itemRef}
      className="relative list-none my-0.5"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
        {dropPosition === 'inside' && <div className="absolute inset-0 rounded-md pointer-events-none z-10 bg-primary/30 border-2 border-primary border-dashed" />}
        {dropPosition === 'before' && <div className="absolute left-0 top-0 w-full h-1 bg-primary rounded pointer-events-none z-20" />}
        {dropPosition === 'after' && <div className="absolute left-0 bottom-0 w-full h-1 bg-primary rounded pointer-events-none z-20" />}

        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
            className={cn(
                "relative flex items-center rounded-lg transition-all duration-150 group touch-manipulation",
                isSelected
                  ? "bg-primary/15 shadow-sm"
                  : "hover:bg-primary/5",
                dropPosition && "bg-accent/10",
                isDragging && "opacity-50 bg-muted",
                !isRoot && "cursor-grab active:cursor-grabbing"
            )}
            style={{
              paddingLeft: `${level * 1.5}rem`,
              transform: swipeOffset ? `translateX(${swipeOffset}px)` : undefined,
              transition: swipeOffset ? 'none' : 'transform 0.2s ease-out',
            }}
            onClick={handleClick}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={(e) => {
              const wasSwipe = handlePointerUp(e);
              // Don't process as tap if it was a swipe
              if (wasSwipe) {
                e.preventDefault();
              }
            }}
            onPointerCancel={(e) => {
              handlePointerUp(e);
            }}
            onDoubleClick={() => setIsEditing(true)}
            draggable={!isRoot}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <button
                className={cn(
                    "p-1 rounded-md hover:bg-primary/20",
                    isChapter ? "visible" : "invisible"
                )}
                onClick={(e) => {
                    e.stopPropagation();
                    onToggleCollapse(node.id);
                }}
            >
                <ChevronRight size={16} className={cn("transition-transform", !node.isCollapsed && "rotate-90")} />
            </button>
            <NodeIcon type={node.type} isChapter={isChapter} isCollapsed={node.isCollapsed} />
            {isEditing ? (
                <Input
                    ref={inputRef}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={handleNameChange}
                    onKeyDown={handleKeyDown}
                    className="h-7 w-full border-primary bg-background"
                    onClick={e => e.stopPropagation()}
                />
            ) : (
                <span className={cn(
                    "flex-1 truncate py-1.5 px-1 cursor-pointer text-foreground font-medium",
                    isSelected && "text-primary",
                    highlightedNodeIds?.has(nodeId) && "bg-yellow-100 dark:bg-yellow-900/30 rounded"
                )}>
                    {numbering && <span className="text-muted-foreground mr-2 font-normal">{numbering}</span>}
                    {searchTerm && highlightedNodeIds?.has(nodeId)
                      ? highlightText(node.name, searchTerm)
                      : node.name}
                </span>
            )}
            </div>
          </ContextMenuTrigger>

          <ContextMenuContent>
            {!isRoot && onCreateNode && (
              <ContextMenuItem onClick={(e) => { e.stopPropagation(); onCreateNode(); }}>
                <Plus className="mr-2 h-4 w-4" />
                Add Sibling Node
                <ContextMenuShortcut>Enter</ContextMenuShortcut>
              </ContextMenuItem>
            )}

            {!isRoot && (
              <ContextMenuItem onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}>
                <Edit3 className="mr-2 h-4 w-4" />
                Rename Node
                <ContextMenuShortcut>F2</ContextMenuShortcut>
              </ContextMenuItem>
            )}

            {isChapter && (
              <ContextMenuItem onClick={(e) => { e.stopPropagation(); onToggleCollapse(node.id); }}>
                {node.isCollapsed ? (
                  <>
                    <ChevronDown className="mr-2 h-4 w-4" />
                    Expand
                  </>
                ) : (
                  <>
                    <ChevronUp className="mr-2 h-4 w-4" />
                    Collapse
                  </>
                )}
              </ContextMenuItem>
            )}

            <ContextMenuSeparator />
            {onCopySubtree && (
              <ContextMenuItem onClick={(e) => { e.stopPropagation(); onCopySubtree(node.id); }}>
                <Copy className="mr-2 h-4 w-4" />
                Copy Subtree
                <ContextMenuShortcut>⌘C</ContextMenuShortcut>
              </ContextMenuItem>
            )}
            {!isRoot && onCutSubtree && (
              <ContextMenuItem onClick={(e) => { e.stopPropagation(); onCutSubtree(node.id); }}>
                <Scissors className="mr-2 h-4 w-4" />
                Move Subtree
                <ContextMenuShortcut>⌘X</ContextMenuShortcut>
              </ContextMenuItem>
            )}

            {onPasteSubtree && hasClipboard && (
              <ContextMenuItem onClick={(e) => { e.stopPropagation(); onPasteSubtree(node.id); }}>
                <ClipboardPaste className="mr-2 h-4 w-4" />
                Paste Subtree
                <ContextMenuShortcut>⌘V</ContextMenuShortcut>
              </ContextMenuItem>
            )}

            {!isRoot && onDuplicateNode && (
              <ContextMenuItem onClick={(e) => { e.stopPropagation(); onDuplicateNode(node.id); }}>
                <CopyPlus className="mr-2 h-4 w-4" />
                Duplicate
                <ContextMenuShortcut>⌘D</ContextMenuShortcut>
              </ContextMenuItem>
            )}

            {!isRoot && onDeleteNode && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onClick={(e) => { e.stopPropagation(); onDeleteNode(node.id); }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Node
                  <ContextMenuShortcut>Del</ContextMenuShortcut>
                </ContextMenuItem>
              </>
            )}
          </ContextMenuContent>
        </ContextMenu>

        {!node.isCollapsed && isChapter && Array.isArray(node.childrenIds) && (
            <ul>
            {node.childrenIds.map((childId) => (
                <NodeItem
                    key={childId}
                    nodeId={childId}
                    nodes={nodes}
                    level={level + 1}
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
                    onIndent={onIndent}
                    onOutdent={onOutdent}
                    searchTerm={searchTerm}
                    highlightedNodeIds={highlightedNodeIds}
                />
            ))}
            </ul>
        )}
    </li>
  );
}
