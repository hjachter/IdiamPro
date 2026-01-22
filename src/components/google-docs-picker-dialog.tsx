'use client';

import React, { useState } from 'react';
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
import { ExternalLink, FileText } from 'lucide-react';

interface GoogleDocsPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectDoc: (url: string) => void;
}

export default function GoogleDocsPickerDialog({
  open,
  onOpenChange,
  onSelectDoc,
}: GoogleDocsPickerDialogProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  // Check if URL is a valid Google Docs URL or embed URL
  const isValidGoogleDocsUrl = (url: string) => {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();
    return (
      lowerUrl.includes('docs.google.com/document') ||
      lowerUrl.includes('docs.google.com/pub')
    );
  };

  // Convert share URL to embed URL if needed
  const getEmbedUrl = (url: string): string => {
    // If already an embed URL, return as-is
    if (url.includes('/pub')) {
      return url;
    }
    // Convert /document/d/ID/edit to /document/d/ID/pub
    const match = url.match(/docs\.google\.com\/document\/d\/([^\/]+)/);
    if (match) {
      return `https://docs.google.com/document/d/${match[1]}/pub?embedded=true`;
    }
    return url;
  };

  const handleOpenGoogleDocs = () => {
    window.open('https://docs.google.com', '_blank');
  };

  const handleInsert = () => {
    if (!isValidGoogleDocsUrl(url)) {
      setError('Please enter a valid Google Docs URL');
      return;
    }
    onSelectDoc(getEmbedUrl(url));
    setUrl('');
    setError('');
    onOpenChange(false);
  };

  const handleClose = () => {
    setUrl('');
    setError('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Insert Google Doc
          </DialogTitle>
          <DialogDescription>
            Open your Google Doc, then copy its URL from the address bar. Make sure the document is published (File → Share → Publish to web).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Open Google Docs button */}
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={handleOpenGoogleDocs}
          >
            <ExternalLink className="h-4 w-4" />
            Open Google Docs in Browser
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            Find your document, then copy the URL from the address bar
          </div>

          {/* URL input */}
          <div className="space-y-2">
            <Input
              placeholder="Paste Google Doc URL here..."
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleInsert();
                }
              }}
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            {url && isValidGoogleDocsUrl(url) && (
              <p className="text-sm text-green-600">✓ Valid Google Docs URL</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleInsert}
            disabled={!url || !isValidGoogleDocsUrl(url)}
          >
            Insert Document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
