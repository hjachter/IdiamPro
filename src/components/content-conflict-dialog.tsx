'use client';

import React from 'react';
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Replace, ListPlus, ListStart, X } from 'lucide-react';

export type ContentConflictAction = 'replace' | 'append' | 'prepend' | 'cancel';

interface ContentConflictDialogProps {
  open: boolean;
  onAction: (action: ContentConflictAction) => void;
  existingContentPreview: string;
  newContentPreview: string;
}

export default function ContentConflictDialog({
  open,
  onAction,
  existingContentPreview,
  newContentPreview,
}: ContentConflictDialogProps) {
  const truncate = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onAction('cancel')}>
      <AlertDialogContent className="sm:max-w-[500px]">
        <AlertDialogHeader>
          <AlertDialogTitle>Content Already Exists</AlertDialogTitle>
          <AlertDialogDescription>
            This node already has content. How would you like to handle the AI-generated content?
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border p-3 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground mb-1">Existing Content</p>
            <p className="text-sm">{truncate(existingContentPreview)}</p>
          </div>

          <div className="rounded-lg border p-3 bg-primary/5 border-primary/20">
            <p className="text-xs font-medium text-primary mb-1">AI-Generated Content</p>
            <p className="text-sm">{truncate(newContentPreview)}</p>
          </div>
        </div>

        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onAction('cancel')}
            className="w-full sm:w-auto"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => onAction('prepend')}
            className="w-full sm:w-auto"
          >
            <ListStart className="h-4 w-4 mr-2" />
            Append Above
          </Button>
          <Button
            variant="outline"
            onClick={() => onAction('append')}
            className="w-full sm:w-auto"
          >
            <ListPlus className="h-4 w-4 mr-2" />
            Append Below
          </Button>
          <Button
            onClick={() => onAction('replace')}
            className="w-full sm:w-auto"
          >
            <Replace className="h-4 w-4 mr-2" />
            Replace
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
