'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TagBadge } from './tag-badge';
import { getAllTags, getTagUsageCounts, renameTag, deleteTag } from '@/lib/tag-utils';
import type { NodeMap } from '@/types';
import { Plus, Pencil, Trash2 } from 'lucide-react';
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

interface TagManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodes: NodeMap;
  onUpdateNodes?: (nodes: NodeMap) => void;
  onAddTagToNode?: (tag: string) => void;
  currentNodeId?: string;
}

export function TagManager({
  open,
  onOpenChange,
  nodes,
  onUpdateNodes,
  onAddTagToNode,
  currentNodeId,
}: TagManagerProps) {
  const [newTagName, setNewTagName] = useState('');
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editedName, setEditedName] = useState('');
  const [deletingTag, setDeletingTag] = useState<string | null>(null);

  const allTags = getAllTags(nodes);
  const tagCounts = getTagUsageCounts(nodes);

  const handleAddTag = () => {
    if (!newTagName.trim()) return;

    const trimmedTag = newTagName.trim();

    // If we have a callback to add tag to current node, use it
    if (onAddTagToNode) {
      onAddTagToNode(trimmedTag);
      setNewTagName('');
      return;
    }

    // Otherwise, just reset (tag list will show all existing tags)
    setNewTagName('');
  };

  const handleRenameTag = (oldTag: string) => {
    if (!editedName.trim() || editedName === oldTag) {
      setEditingTag(null);
      setEditedName('');
      return;
    }

    const trimmedTag = editedName.trim();
    if (allTags.includes(trimmedTag)) {
      alert('Tag already exists');
      return;
    }

    if (onUpdateNodes) {
      const updatedNodes = renameTag(nodes, oldTag, trimmedTag);
      onUpdateNodes(updatedNodes);
    }
    setEditingTag(null);
    setEditedName('');
  };

  const handleDeleteTag = (tag: string) => {
    if (!onUpdateNodes) return;
    const updatedNodes = deleteTag(nodes, tag);
    onUpdateNodes(updatedNodes);
    setDeletingTag(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Manage Tags</DialogTitle>
            <DialogDescription>
              Add, rename, or delete tags used in this outline
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-auto">
            {/* Add new tag */}
            <div className="flex gap-2">
              <Input
                placeholder="New tag name..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddTag();
                  }
                }}
              />
              <Button onClick={handleAddTag} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Tag list */}
            <div className="space-y-2">
              {allTags.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No tags yet. Create one above or add tags to nodes.
                </div>
              ) : (
                allTags.map((tag) => (
                  <div
                    key={tag}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    {editingTag === tag ? (
                      <Input
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleRenameTag(tag);
                          } else if (e.key === 'Escape') {
                            setEditingTag(null);
                            setEditedName('');
                          }
                        }}
                        onBlur={() => handleRenameTag(tag)}
                        autoFocus
                        className="flex-1 mr-2"
                      />
                    ) : (
                      <div className="flex items-center gap-3 flex-1">
                        <TagBadge tag={tag} size="md" />
                        <span className="text-sm text-muted-foreground">
                          {tagCounts[tag]} {tagCounts[tag] === 1 ? 'node' : 'nodes'}
                        </span>
                      </div>
                    )}

                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingTag(tag);
                          setEditedName(tag);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingTag(tag)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deletingTag} onOpenChange={(open) => !open && setDeletingTag(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tag?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the tag &quot;{deletingTag}&quot; from {tagCounts[deletingTag || '']} {tagCounts[deletingTag || ''] === 1 ? 'node' : 'nodes'}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingTag && handleDeleteTag(deletingTag)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
