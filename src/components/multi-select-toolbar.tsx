'use client';

import React, { useState } from 'react';
import { Button } from './ui/button';
import { X, Trash2, Palette, Tag, Move } from 'lucide-react';
import { ColorPicker } from './color-picker';
import type { NodeColor } from '@/types';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import { Input } from './ui/input';

interface MultiSelectToolbarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onBulkChangeColor: (color: NodeColor | undefined) => void;
  onBulkAddTag: (tag: string) => void;
}

export function MultiSelectToolbar({
  selectedCount,
  onClearSelection,
  onBulkDelete,
  onBulkChangeColor,
  onBulkAddTag,
}: MultiSelectToolbarProps) {
  const [newTag, setNewTag] = useState('');
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isTagInputOpen, setIsTagInputOpen] = useState(false);

  const handleAddTag = () => {
    if (newTag.trim()) {
      onBulkAddTag(newTag.trim());
      setNewTag('');
      setIsTagInputOpen(false);
    }
  };

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-card border rounded-lg shadow-lg px-4 py-3 flex items-center gap-3">
        <span className="text-sm font-medium">
          {selectedCount} node{selectedCount > 1 ? 's' : ''} selected
        </span>

        <div className="h-6 w-px bg-border" />

        {/* Tag */}
        <Popover open={isTagInputOpen} onOpenChange={setIsTagInputOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Tag className="h-4 w-4" />
              Tag
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Add Tag</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Tag name"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddTag();
                    }
                  }}
                />
                <Button onClick={handleAddTag} disabled={!newTag.trim()}>
                  Add
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Color */}
        <Popover open={isColorPickerOpen} onOpenChange={setIsColorPickerOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Palette className="h-4 w-4" />
              Color
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <ColorPicker
              onChange={(color) => {
                onBulkChangeColor(color);
                setIsColorPickerOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>

        {/* Move (placeholder for future implementation) */}
        <Button variant="outline" size="sm" className="gap-2" disabled>
          <Move className="h-4 w-4" />
          Move
        </Button>

        {/* Delete */}
        <Button
          variant="destructive"
          size="sm"
          className="gap-2"
          onClick={onBulkDelete}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>

        <div className="h-6 w-px bg-border" />

        {/* Clear Selection */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="gap-2"
        >
          <X className="h-4 w-4" />
          Clear
        </Button>
      </div>
    </div>
  );
}
