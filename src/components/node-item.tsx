'use client';

import React from 'react';
import type { OutlineNode, NodeMap } from '@/types';
import NodeIcon from './node-icon';
import { TagBadge } from './tag-badge';
import NodePropertiesDialog from './node-properties-dialog';
import { ChevronRight, Plus, Trash2, Edit3, ChevronDown, ChevronUp, ChevronsDown, ChevronsUp, Copy, Scissors, ClipboardPaste, CopyPlus, Sparkles, CheckSquare2, Square, Sliders, Share, Globe, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
  // Recursive expand/collapse for this node's subtree (context menu).
  onExpandAll?: (id: string) => void;
  onCollapseAll?: (id: string) => void;
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
  // AI content generation
  onGenerateContentForChildren?: (nodeId: string) => void;
  // Create child node
  onCreateChildNode?: (parentId: string) => void;
  // External edit mode trigger
  editingNodeId?: string | null;
  onEditingComplete?: () => void;
  // Multi-select
  selectedNodeIds?: Set<string>;
  onToggleNodeSelection?: (nodeId: string, isCtrlClick: boolean) => void;
  onRangeSelect?: (nodeId: string) => void;
  // Export/Share subtree
  onExportSubtree?: (nodeId: string) => void;
  // Save to Second Brain
  onSaveToSecondBrain?: (nodeId: string) => void;
  // Progressive rendering - max depth to render (for large outlines)
  maxRenderDepth?: number;
  // Cross-outline link picker (Phase 1, 2026-06-04) — context menu entry
  onInsertOutlineLink?: () => void;
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
// const getPreviousSibling = (nodes: NodeMap, nodeId: string): string | null => {
//     const node = nodes[nodeId];
//     if (!node || !node.parentId) return null;
//     const parent = nodes[node.parentId];
//     if (!parent || !parent.childrenIds) return null;
//     const index = parent.childrenIds.indexOf(nodeId);
//     if (index <= 0) return null;
//     return parent.childrenIds[index - 1];
// };

// Check if a node is a leaf (has no children)
// const isLeafNode = (nodes: NodeMap, nodeId: string): boolean => {
//     const node = nodes[nodeId];
//     return !node || !node.childrenIds || node.childrenIds.length === 0;
// };

export default function NodeItem({
  nodeId,
  nodes,
  level,
  selectedNodeId,
  onSelectNode,
  onMoveNode,
  onToggleCollapse,
  onExpandAll,
  onCollapseAll,
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
  onGenerateContentForChildren,
  onCreateChildNode,
  editingNodeId,
  onEditingComplete,
  selectedNodeIds,
  onToggleNodeSelection,
  onRangeSelect,
  onExportSubtree,
  onSaveToSecondBrain,
  maxRenderDepth,
  onInsertOutlineLink,
}: NodeItemProps) {
  const node = nodes[nodeId];
  const [isEditing, setIsEditing] = React.useState(false);
  const [name, setName] = React.useState(node?.name ?? '');
  const [dropPosition, setDropPosition] = React.useState<DropPosition>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const isMultiSelected = selectedNodeIds?.has(nodeId) || false;
  const [isPropertiesOpen, setIsPropertiesOpen] = React.useState(false);

  const itemRef = React.useRef<HTMLLIElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Double-tap detection for touch devices
  const lastTapRef = React.useRef<number>(0);
  const tapTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Long-press detection for entering multi-select mode on touch (FIX 1)
  // 500ms hold with no movement enters multi-select.
  const longPressTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const longPressTriggeredRef = React.useRef(false);
  const LONG_PRESS_DURATION = 500;

  // Swipe gesture detection for indent/outdent (works with both touch and mouse/pointer)
  const pointerStartRef = React.useRef<{ x: number; y: number; time: number; pointerId: number } | null>(null);
  const [swipeOffset, setSwipeOffset] = React.useState(0);
  const SWIPE_THRESHOLD = 40; // pixels needed to trigger indent/outdent
  const swipeTriggeredRef = React.useRef(false);
  // Records the input device of the most recent pointerdown so handleClick
  // can branch behavior (touch → tap-again-to-edit, mouse → click-to-select).
  const lastPointerTypeRef = React.useRef<string>('mouse');

  // Trigger lightweight haptic feedback (vibration) when available.
  const triggerHaptic = React.useCallback((duration: number = 20) => {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(duration);
      }
    } catch {
      // Ignore - vibration not supported or blocked
    }
  }, []);

  const cancelLongPress = React.useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    lastPointerTypeRef.current = e.pointerType;
    // Only use swipe gestures for touch input, not mouse (to preserve drag and drop)
    if (isRoot || isEditing || e.pointerType === 'mouse') return;
    pointerStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now(), pointerId: e.pointerId };
    swipeTriggeredRef.current = false;
    setSwipeOffset(0);
    // Capture pointer to receive move events even outside element
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    // NOTE: do NOT preventDefault() here. iOS WebKit suppresses the synthesized
    // click event when preventDefault is called on the touch-equivalent
    // pointerdown, which would break single-tap selection. We only suppress
    // default behavior in handlePointerMove once we detect actual swipe motion.
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

  // Touch long-press for multi-select entry (FIX 1).
  // Coexists with drag-init (movement cancels timer → drag wins per FIX 5)
  // and system context-menu (browser default fires after this; we win at 500ms).
  const handleTouchStart = React.useCallback((e: React.TouchEvent) => {
    if (isRoot || isEditing) return;
    longPressTriggeredRef.current = false;
    cancelLongPress();
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      // Skip if user is already in multi-select mode (taps handle toggling there)
      if (selectedNodeIds && selectedNodeIds.size > 0) return;
      if (!onToggleNodeSelection) return;
      longPressTriggeredRef.current = true;
      triggerHaptic(25);
      // Enter multi-select and add this node. Use isCtrlClick=true semantics
      // so the parent handler clears single-selection and toggles set membership.
      onToggleNodeSelection(nodeId, true);
    }, LONG_PRESS_DURATION);
  }, [isRoot, isEditing, selectedNodeIds, onToggleNodeSelection, nodeId, cancelLongPress, triggerHaptic]);

  const handleTouchMove = React.useCallback(() => {
    // Any finger motion cancels long-press → defers to drag/swipe (FIX 5).
    cancelLongPress();
  }, [cancelLongPress]);

  const handleTouchEnd = React.useCallback(() => {
    cancelLongPress();
  }, [cancelLongPress]);

  const handleTouchCancel = React.useCallback(() => {
    cancelLongPress();
  }, [cancelLongPress]);

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  React.useEffect(() => {
    if (node) {
      setName(node.name);
    }
  }, [node?.name]);

  // Watch for external edit trigger (editingNodeId set by parent)
  React.useEffect(() => {
    if (editingNodeId === nodeId && !isEditing) {
      setIsEditing(true);
    }
  }, [editingNodeId, nodeId, isEditing]);

  // Track if we just handled a touch event to prevent double-firing
  const touchHandledRef = React.useRef<boolean>(false);

  // Cleanup timeouts on unmount
  React.useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  if (!node) return null;

  const isChapter = node.type === 'chapter' || node.type === 'root' || (Array.isArray(node.childrenIds) && node.childrenIds.length > 0);
  const isSelected = selectedNodeId === node.id;
  const isHighlighted = highlightedNodeIds?.has(node.id) ?? false;
  const numbering = node.prefix;

  const handleDragStart = (e: React.DragEvent) => {
    if (isRoot) {
      e.preventDefault();
      return;
    }
    // FIX 5: drag started — make sure pending long-press doesn't fire.
    cancelLongPress();
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
    onEditingComplete?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleNameChange();
    if (e.key === 'Escape') {
      setName(node.name);
      setIsEditing(false);
      onEditingComplete?.();
    }
  };

  // Handle touch tap with double-tap detection
  // const handleTouchTap = (e: React.TouchEvent) => {
  //   // Don't handle if already editing
  //   if (isEditing) return;

  //   // Mark that we handled a touch event
  //   touchHandledRef.current = true;
  //   setTimeout(() => { touchHandledRef.current = false; }, 100);

  //   const now = Date.now();
  //   const DOUBLE_TAP_DELAY = 350;

  //   // Check if this is a double-tap
  //   if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
  //     // Double-tap detected - create child node
  //     if (tapTimeoutRef.current) {
  //       clearTimeout(tapTimeoutRef.current);
  //       tapTimeoutRef.current = null;
  //     }
  //     lastTapRef.current = 0;
  //     onCreateChildNode?.(nodeId);
  //     e.preventDefault();
  //     e.stopPropagation();
  //   } else {
  //     // First tap - check if already selected
  //     lastTapRef.current = now;
  //     e.preventDefault();

  //     // If already selected and not root, enter edit mode on single tap
  //     if (isSelected && !isRoot) {
  //       tapTimeoutRef.current = setTimeout(() => {
  //         setIsEditing(true);
  //         tapTimeoutRef.current = null;
  //       }, DOUBLE_TAP_DELAY);
  //     } else {
  //       // Not selected - wait to see if there's a second tap, then select
  //       tapTimeoutRef.current = setTimeout(() => {
  //         onSelectNode(node.id, false);
  //         tapTimeoutRef.current = null;
  //       }, DOUBLE_TAP_DELAY);
  //     }
  //   }
  // };

  // Handle mouse click (desktop only)
  const handleClick = (e: React.MouseEvent) => {
    // Skip if this click was triggered by a touch event
    if (touchHandledRef.current) return;

    // If a long-press just fired (entered multi-select), swallow the synthesized click.
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Don't handle if already editing
    if (isEditing) return;

    // Multi-select logic
    if (onToggleNodeSelection && onRangeSelect) {
      if (e.shiftKey) {
        // Shift+Click: range select
        e.preventDefault();
        onRangeSelect(node.id);
        return;
      } else if (e.ctrlKey || e.metaKey) {
        // Ctrl/Cmd+Click: toggle selection
        e.preventDefault();
        onToggleNodeSelection(node.id, true);
        return;
      } else if (selectedNodeIds && selectedNodeIds.size > 0) {
        // Already in multi-select mode: a plain tap/click toggles this node's membership.
        // This is the FIX 1 path for touch users — once multi-select is entered via
        // long-press, plain taps add/remove nodes from the selection.
        e.preventDefault();
        onToggleNodeSelection(node.id, true);
        return;
      }
    }

    // Touch (iOS): tapping the already-selected node enters edit mode.
    // This is the iOS equivalent of double-click on desktop, per the gesture
    // model in CLAUDE.md (Tap selected node → edit name).
    if (isSelected && lastPointerTypeRef.current !== 'mouse' && !isRoot) {
      setIsEditing(true);
      return;
    }

    // Desktop: single click selects, double-click handled by onDoubleClick
    onSelectNode(node.id);
  };

  return (
    <li
      ref={itemRef}
      className="relative list-none my-0.5"
      role="treeitem"
      aria-level={level + 1}
      aria-selected={isSelected}
      aria-expanded={node.childrenIds.length > 0 ? !node.isCollapsed : undefined}
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
                  ? "bg-primary/15 shadow-sm ring-1 ring-primary/30"
                  : "hover:bg-primary/5",
                dropPosition && "bg-accent/10",
                isDragging && "opacity-50 bg-muted",
                !isRoot && "cursor-grab active:cursor-grabbing",
                isHighlighted && !isSelected && "bg-yellow-100 dark:bg-yellow-900/30",
                // Multi-select indicator (blue ring + background)
                isMultiSelected && !isSelected && "bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500/50",
                // Left border: custom color only (user-assigned)
                node.metadata?.color && "border-l-4"
            )}
            style={{
              paddingLeft: `${level * 1.5 + 0.5}rem`,
              transform: swipeOffset ? `translateX(${swipeOffset}px)` : undefined,
              transition: swipeOffset ? 'none' : 'transform 0.2s ease-out',
              ...(node.metadata?.color && {
                borderLeftColor: `hsl(var(--node-${node.metadata.color}))`,
              }),
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
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchCancel}
            onDoubleClick={() => { if (!isEditing) setIsEditing(true); }}
            draggable={!isRoot}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <button
                className={cn(
                    "inline-flex items-center justify-center min-h-8 min-w-8 rounded-md hover:bg-primary/20 active:scale-95 active:bg-accent/30 transition-colors",
                    isChapter ? "visible" : "invisible"
                )}
                onClick={(e) => {
                    e.stopPropagation();
                    onToggleCollapse(node.id);
                }}
                aria-label={node.isCollapsed ? "Expand" : "Collapse"}
            >
                <ChevronRight size={16} className={cn("transition-transform", !node.isCollapsed && "rotate-90")} />
            </button>
            {/* Show NodeIcon for all types except task (task has its own checkbox) */}
            {node.type !== 'task' && (
                <NodeIcon type={node.type} isChapter={isChapter} isCollapsed={node.isCollapsed} />
            )}
            {node.type === 'task' && (
                <button
                    className="inline-flex items-center justify-center min-h-8 min-w-8 rounded-md hover:bg-primary/20 active:scale-95 active:bg-accent/30 transition-colors ml-1"
                    onClick={(e) => {
                        e.stopPropagation();
                        onUpdateNode(nodeId, {
                            metadata: {
                                ...node.metadata,
                                isCompleted: !node.metadata?.isCompleted,
                            },
                        });
                    }}
                    aria-label={node.metadata?.isCompleted ? "Mark task incomplete" : "Mark task complete"}
                >
                    {node.metadata?.isCompleted ? (
                        <CheckSquare2 size={16} className="text-blue-500 dark:text-blue-400" />
                    ) : (
                        <Square size={16} className="text-muted-foreground" />
                    )}
                </button>
            )}
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
                <div className="flex-1 flex items-center gap-2 min-w-0">
                    <span
                        className={cn(
                            "truncate py-1.5 px-1 cursor-pointer text-foreground font-medium",
                            isSelected && "text-primary",
                            highlightedNodeIds?.has(nodeId) && "bg-yellow-100 dark:bg-yellow-900/30 rounded",
                            node.type === 'task' && node.metadata?.isCompleted && "line-through opacity-60",
                            node.type === 'link' && "text-blue-600 dark:text-blue-400 underline hover:no-underline"
                        )}
                        onClick={(e) => {
                            if (node.type === 'link' && node.metadata?.url) {
                                e.stopPropagation();
                                window.open(node.metadata.url, '_blank');
                            }
                        }}
                    >
                        {numbering && <span className="text-muted-foreground mr-2 font-normal">{numbering}</span>}
                        {searchTerm && highlightedNodeIds?.has(nodeId)
                          ? highlightText(node.name, searchTerm)
                          : node.name}
                    </span>
                    {node.metadata?.tags && node.metadata.tags.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                            {node.metadata.tags.slice(0, 3).map((tag, index) => (
                                <TagBadge
                                    key={tag}
                                    tag={tag}
                                    onRemove={() => {
                                        const newTags = node.metadata?.tags?.filter(t => t !== tag);
                                        onUpdateNode(nodeId, {
                                            metadata: {
                                                ...node.metadata,
                                                tags: newTags && newTags.length > 0 ? newTags : undefined,
                                            },
                                        });
                                    }}
                                />
                            ))}
                            {node.metadata.tags.length > 3 && (
                                <span className="text-xs text-muted-foreground py-0.5">
                                    +{node.metadata.tags.length - 3} more
                                </span>
                            )}
                        </div>
                    )}
                    {node.metadata?.transform && (
                        <Popover>
                            <PopoverTrigger asChild>
                                <button
                                    type="button"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground rounded px-1 py-0.5 border border-border/50 shrink-0"
                                    title="Show how this node was refreshed and its sources"
                                >
                                    <Globe className="h-2.5 w-2.5" />
                                    {node.metadata.transform.citations.length > 0
                                        ? `${node.metadata.transform.citations.length} source${node.metadata.transform.citations.length === 1 ? '' : 's'}`
                                        : 'Sources'}
                                </button>
                            </PopoverTrigger>
                            <PopoverContent
                                className="w-72 text-xs"
                                align="start"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <p className="font-medium mb-1">
                                    Refreshed with {node.metadata.transform.model}
                                </p>
                                <p className="text-muted-foreground mb-2">
                                    {new Date(node.metadata.transform.refreshedAt).toLocaleString()}
                                    {' · '}
                                    {node.metadata.transform.webGrounded
                                        ? 'live web grounding'
                                        : 'model knowledge (no live web)'}
                                </p>
                                {node.metadata.transform.citations.length > 0 ? (
                                    <ul className="space-y-1">
                                        {node.metadata.transform.citations.map((c, i) => (
                                            <li key={i}>
                                                <a
                                                    href={c.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-600 hover:underline inline-flex items-center gap-0.5 break-all"
                                                >
                                                    {c.title || c.url}
                                                    <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-muted-foreground italic">
                                        No web sources (model-knowledge refresh).
                                    </p>
                                )}
                            </PopoverContent>
                        </Popover>
                    )}
                </div>
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

            {onInsertOutlineLink && (
              <ContextMenuItem onClick={(e) => { e.stopPropagation(); onInsertOutlineLink(); }}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Insert Link to Outline…
              </ContextMenuItem>
            )}

            <ContextMenuItem onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}>
              <Edit3 className="mr-2 h-4 w-4" />
              Rename Node
              <ContextMenuShortcut>↵</ContextMenuShortcut>
            </ContextMenuItem>

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

            {isChapter && onExpandAll && (
              <ContextMenuItem onClick={(e) => { e.stopPropagation(); onExpandAll(node.id); }}>
                <ChevronsDown className="mr-2 h-4 w-4" />
                Expand All
              </ContextMenuItem>
            )}

            {isChapter && onCollapseAll && (
              <ContextMenuItem onClick={(e) => { e.stopPropagation(); onCollapseAll(node.id); }}>
                <ChevronsUp className="mr-2 h-4 w-4" />
                Collapse All
              </ContextMenuItem>
            )}

            {isChapter && onGenerateContentForChildren && (
              <ContextMenuItem onClick={(e) => { e.stopPropagation(); onGenerateContentForChildren(node.id); }}>
                <Sparkles className="mr-2 h-4 w-4" />
                Create Content for Descendants
              </ContextMenuItem>
            )}

            {onExportSubtree && (
              <ContextMenuItem onClick={(e) => { e.stopPropagation(); onExportSubtree(node.id); }}>
                <Share className="mr-2 h-4 w-4" />
                Share Subtree As...
              </ContextMenuItem>
            )}

            {onSaveToSecondBrain && (
              <ContextMenuItem onClick={(e) => { e.stopPropagation(); onSaveToSecondBrain(node.id); }}>
                <span className="mr-2 text-base">🧠</span>
                Save to Second Brain
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

            {!isRoot && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={(e) => { e.stopPropagation(); setIsPropertiesOpen(true); }}>
                  <Sliders className="mr-2 h-4 w-4" />
                  Properties...
                </ContextMenuItem>
              </>
            )}
          </ContextMenuContent>
        </ContextMenu>

        {!node.isCollapsed && isChapter && Array.isArray(node.childrenIds) && (
            <>
              {/* Progressive rendering disabled - using collapse approach instead for large outlines */}
              {false && maxRenderDepth !== undefined && level >= maxRenderDepth ? (
                <div
                  className="text-xs text-muted-foreground italic py-1"
                  style={{ paddingLeft: `${(level + 1) * 1.5 + 0.5}rem` }}
                >
                  {node.childrenIds.length} items
                </div>
              ) : (
                <ul role="group">
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
                        onExpandAll={onExpandAll}
                        onCollapseAll={onCollapseAll}
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
                        onGenerateContentForChildren={onGenerateContentForChildren}
                        onCreateChildNode={onCreateChildNode}
                        editingNodeId={editingNodeId}
                        onEditingComplete={onEditingComplete}
                        selectedNodeIds={selectedNodeIds}
                        onToggleNodeSelection={onToggleNodeSelection}
                        onRangeSelect={onRangeSelect}
                        onExportSubtree={onExportSubtree}
                        onSaveToSecondBrain={onSaveToSecondBrain}
                        maxRenderDepth={maxRenderDepth}
                        onInsertOutlineLink={onInsertOutlineLink}
                    />
                ))}
                </ul>
              )}
            </>
        )}

        {/* Properties Dialog (replaces Type submenu, Color submenu, Tag manager) */}
        <NodePropertiesDialog
          open={isPropertiesOpen}
          onOpenChange={setIsPropertiesOpen}
          node={node}
          nodes={nodes}
          onUpdateNode={onUpdateNode}
        />
    </li>
  );
}
