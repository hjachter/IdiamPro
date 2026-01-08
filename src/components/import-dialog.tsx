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
import { FileJson, Youtube, FileUp, Loader2 } from 'lucide-react';
import type { ExternalSourceInput } from '@/types';

interface ImportDialogProps {
  children: React.ReactNode;
  onIngestSource: (source: ExternalSourceInput) => Promise<void>;
}

export default function ImportDialog({ children, onIngestSource }: ImportDialogProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importType, setImportType] = useState<'pdf-url' | 'pdf-file' | 'youtube' | null>(null);
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const openDialog = (type: 'pdf-url' | 'pdf-file' | 'youtube') => {
    setImportType(type);
    setUrl('');
    setFile(null);
    setDialogOpen(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
    }
  };

  const handleImport = async () => {
    if (!importType) return;

    setIsAnalyzing(true);
    try {
      if (importType === 'youtube' && url) {
        await onIngestSource({
          type: 'youtube',
          url,
        });
      } else if (importType === 'pdf-url' && url) {
        await onIngestSource({
          type: 'pdf',
          url,
        });
      } else if (importType === 'pdf-file' && file) {
        // Read file as base64 for server transmission
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });

        await onIngestSource({
          type: 'pdf',
          content: base64,
          fileName: file.name,
        });
      }
      setDialogOpen(false);
    } catch (error) {
      console.error('Import failed:', error);
      // Show error to user (toast will be shown by outline-pro)
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getDialogContent = () => {
    switch (importType) {
      case 'pdf-url':
        return {
          title: 'Import PDF from URL',
          description: 'AI will analyze the PDF and generate a structured outline summary.',
        };
      case 'pdf-file':
        return {
          title: 'Import PDF from Computer',
          description: 'AI will analyze the PDF and generate a structured outline summary.',
        };
      case 'youtube':
        return {
          title: 'Import YouTube Video',
          description: 'AI will transcribe and outline the video content.',
        };
      default:
        return { title: '', description: '' };
    }
  };

  const { title, description } = getDialogContent();
  const canImport = (importType === 'youtube' && url) ||
                    (importType === 'pdf-url' && url) ||
                    (importType === 'pdf-file' && file);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => openDialog('pdf-file')}>
            <FileUp className="mr-2 h-4 w-4" />
            PDF from Computer
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openDialog('pdf-url')}>
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
            {importType === 'pdf-file' ? (
              <div className="grid gap-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                >
                  <FileUp className="mr-2 h-4 w-4" />
                  {file ? file.name : 'Choose PDF File...'}
                </Button>
              </div>
            ) : (
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
                  onKeyDown={e => e.key === 'Enter' && !isAnalyzing && canImport && handleImport()}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleImport} disabled={!canImport || isAnalyzing}>
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing with AI...
                </>
              ) : (
                'Analyze & Import'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
