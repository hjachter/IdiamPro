'use client';

import React from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Check, Plus, Edit3, AlertTriangle } from 'lucide-react';
import type { IngestPreview } from '@/types';

interface IngestPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: IngestPreview | null;
  onConfirm: () => void;
  onCancel: () => void;
  isApplying: boolean;
}

export default function IngestPreviewDialog({
  open,
  onOpenChange,
  preview,
  onConfirm,
  onCancel,
  isApplying,
}: IngestPreviewDialogProps) {
  if (!preview) return null;

  const hasChanges = preview.nodesToAdd.length > 0 || preview.nodesToModify.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-500" />
            Preview Changes
          </DialogTitle>
          <DialogDescription>
            {preview.summary}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-4">
            {/* Nodes to Add */}
            {preview.nodesToAdd.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium flex items-center gap-2 text-sm">
                  <Plus className="h-4 w-4 text-green-500" />
                  Nodes to Add ({preview.nodesToAdd.length})
                </h3>
                <div className="space-y-2">
                  {preview.nodesToAdd.slice(0, 10).map((node, index) => (
                    <div
                      key={index}
                      className="rounded-lg border p-3 bg-green-500/5 border-green-500/20"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {node.parentPath}
                        </Badge>
                      </div>
                      <p className="font-medium text-sm">{node.name}</p>
                      {node.content && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {node.content}
                        </p>
                      )}
                    </div>
                  ))}
                  {preview.nodesToAdd.length > 10 && (
                    <p className="text-sm text-muted-foreground">
                      ... and {preview.nodesToAdd.length - 10} more nodes
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Nodes to Modify */}
            {preview.nodesToModify.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium flex items-center gap-2 text-sm">
                  <Edit3 className="h-4 w-4 text-yellow-500" />
                  Nodes to Modify ({preview.nodesToModify.length})
                </h3>
                <div className="space-y-2">
                  {preview.nodesToModify.slice(0, 5).map((mod, index) => (
                    <div
                      key={index}
                      className="rounded-lg border p-3 bg-yellow-500/5 border-yellow-500/20"
                    >
                      <p className="font-medium text-sm mb-2">{mod.nodeName}</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground mb-1">Before:</p>
                          <p className="line-clamp-2 bg-muted/50 p-2 rounded">
                            {mod.before || '(empty)'}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-1">After:</p>
                          <p className="line-clamp-2 bg-primary/10 p-2 rounded">
                            {mod.after || '(empty)'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {preview.nodesToModify.length > 5 && (
                    <p className="text-sm text-muted-foreground">
                      ... and {preview.nodesToModify.length - 5} more modifications
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* No Changes */}
            {!hasChanges && (
              <div className="rounded-lg border p-4 bg-muted/30 text-center">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                <p className="text-sm text-muted-foreground">
                  No changes detected. The content may already be present in your outline.
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
          <p>
            Review the proposed changes carefully. Click &quot;Apply Changes&quot; to add these nodes to your outline, or &quot;Cancel&quot; to discard.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isApplying}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isApplying || !hasChanges}>
            {isApplying ? 'Applying...' : 'Apply Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
