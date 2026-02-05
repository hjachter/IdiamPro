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
import { FileText, Link as LinkIcon, X } from 'lucide-react';

export type PdfImportAction = 'render' | 'link' | 'cancel';

interface PdfImportDialogProps {
  open: boolean;
  fileName: string;
  onAction: (action: PdfImportAction) => void;
}

export default function PdfImportDialog({
  open,
  fileName,
  onAction,
}: PdfImportDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onAction('cancel')}>
      <AlertDialogContent className="sm:max-w-[450px]">
        <AlertDialogHeader>
          <AlertDialogTitle>Import PDF</AlertDialogTitle>
          <AlertDialogDescription>
            How would you like to import &ldquo;{fileName}&rdquo;?
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:flex-wrap sm:justify-end">
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
            onClick={() => onAction('link')}
            className="w-full sm:w-auto"
          >
            <LinkIcon className="h-4 w-4 mr-2" />
            Insert as Link
          </Button>
          <Button
            onClick={() => onAction('render')}
            className="w-full sm:w-auto"
          >
            <FileText className="h-4 w-4 mr-2" />
            Extract Text
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
