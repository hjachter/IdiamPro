'use client';

import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { FileJson, Youtube } from 'lucide-react';
import type { NodeType } from '@/types';

interface ImportDialogProps {
  children: React.ReactNode;
  onCreateNode: (type: NodeType, content: string) => void;
}

export default function ImportDialog({ children, onCreateNode }: ImportDialogProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importType, setImportType] = useState<NodeType | null>(null);
  const [url, setUrl] = useState('');

  const openDialog = (type: NodeType) => {
    setImportType(type);
    setUrl('');
    setDialogOpen(true);
  };

  const handleImport = () => {
    if (importType && url) {
      onCreateNode(importType, url);
      setDialogOpen(false);
    }
  };

  const title = importType === 'pdf' ? 'Import PDF from URL' : 'Import YouTube Video';
  const description = importType === 'pdf' ? 'Enter the URL of a PDF file to create a new PDF node.' : 'Enter the URL of a YouTube video to create a new video node.';

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => openDialog('pdf')}>
            <FileJson className="mr-2 h-4 w-4" />
            PDF from URL
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openDialog('youtube')}>
            <Youtube className="mr-2 h-4 w-4" />
            YouTube Video
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="url" className="text-right">
                URL
              </Label>
              <Input
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="col-span-3"
                placeholder="https://..."
                onKeyDown={e => e.key === 'Enter' && handleImport()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleImport} disabled={!url}>Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
