'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getSuggestedPdfFilename } from '@/lib/pdf-export';

interface PdfExportDialogProps {
  open: boolean;
  nodeName: string;
  onExport: (filename: string) => void;
  onCancel: () => void;
}

export default function PdfExportDialog({
  open,
  nodeName,
  onExport,
  onCancel,
}: PdfExportDialogProps) {
  const [filename, setFilename] = useState('');

  // Set suggested filename when dialog opens
  useEffect(() => {
    if (open && nodeName) {
      setFilename(getSuggestedPdfFilename(nodeName));
    }
  }, [open, nodeName]);

  const handleExport = () => {
    if (filename.trim()) {
      // Ensure .pdf extension
      const finalName = filename.trim().endsWith('.pdf')
        ? filename.trim()
        : `${filename.trim()}.pdf`;
      onExport(finalName);
      setFilename('');
    }
  };

  const handleCancel = () => {
    setFilename('');
    onCancel();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleExport();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Export to PDF</DialogTitle>
          <DialogDescription>
            Export this subtree as a formatted PDF document.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="pdf-filename">Filename</Label>
            <div className="flex items-center gap-2">
              <Input
                id="pdf-filename"
                placeholder="outline"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />
              <span className="text-muted-foreground text-sm">.pdf</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={!filename.trim()}>
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
