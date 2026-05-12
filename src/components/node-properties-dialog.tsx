'use client';

import React, { useState, useEffect } from 'react';
import type { OutlineNode, NodeMap, NodeType, NodeColor } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TagBadge } from './tag-badge';
import { Check, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NodePropertiesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  node: OutlineNode | null;
  nodes: NodeMap;
  onUpdateNode: (nodeId: string, updates: Partial<OutlineNode>) => void;
}

const TYPE_OPTIONS: { value: NodeType; label: string }[] = [
  { value: 'chapter', label: 'Chapter' },
  { value: 'document', label: 'Document' },
  { value: 'note', label: 'Note' },
  { value: 'task', label: 'Task' },
  { value: 'link', label: 'Link' },
  { value: 'code', label: 'Code' },
  { value: 'quote', label: 'Quote' },
  { value: 'date', label: 'Date' },
  { value: 'canvas', label: 'Canvas' },
];

const COLOR_OPTIONS: { value: NodeColor | undefined; label: string; cssVar: string | null }[] = [
  { value: undefined, label: 'Default', cssVar: null },
  { value: 'red', label: 'Red', cssVar: 'var(--node-red)' },
  { value: 'orange', label: 'Orange', cssVar: 'var(--node-orange)' },
  { value: 'yellow', label: 'Yellow', cssVar: 'var(--node-yellow)' },
  { value: 'green', label: 'Green', cssVar: 'var(--node-green)' },
  { value: 'blue', label: 'Blue', cssVar: 'var(--node-blue)' },
  { value: 'purple', label: 'Purple', cssVar: 'var(--node-purple)' },
  { value: 'pink', label: 'Pink', cssVar: 'var(--node-pink)' },
];

export default function NodePropertiesDialog({
  open,
  onOpenChange,
  node,
  nodes,
  onUpdateNode,
}: NodePropertiesDialogProps) {
  const [type, setType] = useState<NodeType>('document');
  const [color, setColor] = useState<NodeColor | undefined>(undefined);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  // Initialize state when the dialog opens with a node
  useEffect(() => {
    if (open && node) {
      setType(node.type);
      setColor(node.metadata?.color);
      setTags(node.metadata?.tags ? [...node.metadata.tags] : []);
      setNewTag('');
    }
  }, [open, node]);

  if (!node) return null;

  const handleAddTag = () => {
    const trimmed = newTag.trim();
    if (!trimmed) return;
    if (!tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
    }
    setNewTag('');
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSave = () => {
    const updates: Partial<OutlineNode> = {};

    // Only include type if it changed
    if (type !== node.type) {
      updates.type = type;
      // Some type changes need content reset (link/code/quote/date all expect non-rich content)
      if (
        (type === 'link' || type === 'code' || type === 'quote' || type === 'date') &&
        node.type !== type
      ) {
        updates.content = '';
      }
    }

    const newMetadata = { ...(node.metadata || {}) };
    newMetadata.color = color;
    newMetadata.tags = tags.length > 0 ? tags : undefined;
    updates.metadata = newMetadata;

    onUpdateNode(node.id, updates);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Node Properties</DialogTitle>
          <DialogDescription className="truncate">{node.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Type */}
          <div>
            <label className="text-sm font-medium mb-2 block">Type</label>
            <div className="grid grid-cols-3 gap-2">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  className={cn(
                    'px-2 py-1.5 rounded-md border text-sm transition-colors',
                    'min-h-9 active:scale-95',
                    type === opt.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-accent/20'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="text-sm font-medium mb-2 block">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((opt) => {
                const isSelected = color === opt.value;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setColor(opt.value)}
                    className={cn(
                      'relative h-9 w-9 rounded-full border-2 transition-all',
                      'active:scale-95',
                      isSelected ? 'border-primary ring-2 ring-primary/40' : 'border-border'
                    )}
                    style={{
                      backgroundColor: opt.cssVar ? `hsl(${opt.cssVar})` : 'transparent',
                    }}
                    title={opt.label}
                    aria-label={opt.label}
                  >
                    {isSelected && (
                      <Check
                        className={cn(
                          'absolute inset-0 m-auto h-4 w-4',
                          opt.value ? 'text-white drop-shadow' : 'text-foreground'
                        )}
                      />
                    )}
                    {!opt.value && !isSelected && (
                      <span className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                        —
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-sm font-medium mb-2 block">Tags</label>
            <div className="flex flex-wrap gap-1.5 mb-2 min-h-[24px]">
              {tags.length === 0 && (
                <span className="text-xs text-muted-foreground italic">No tags yet</span>
              )}
              {tags.map((tag) => (
                <span key={tag} className="inline-flex items-center">
                  <TagBadge tag={tag} onRemove={() => handleRemoveTag(tag)} />
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Add a tag..."
                className="flex-1 min-h-9"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleAddTag}
                disabled={!newTag.trim()}
                className="min-h-9 min-w-9"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="ghost" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
