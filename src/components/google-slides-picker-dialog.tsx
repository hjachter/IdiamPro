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
import { ExternalLink, Presentation } from 'lucide-react';
import { openExternalUrl } from '@/lib/electron-storage';

interface GoogleSlidesPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectSlides: (url: string) => void;
}

export default function GoogleSlidesPickerDialog({
  open,
  onOpenChange,
  onSelectSlides,
}: GoogleSlidesPickerDialogProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  // Check if URL is a valid Google Slides URL or embed URL
  const isValidGoogleSlidesUrl = (url: string) => {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();
    return (
      lowerUrl.includes('docs.google.com/presentation') ||
      lowerUrl.includes('slides.google.com')
    );
  };

  // Convert share URL to embed URL (embed works for shared presentations)
  const getEmbedUrl = (url: string): string => {
    // If already an embed or preview URL, return as-is
    if (url.includes('/embed') || url.includes('/preview')) {
      return url;
    }
    // Convert /presentation/d/ID/edit to /presentation/d/ID/embed
    const match = url.match(/presentation\/d\/([^\/]+)/);
    if (match) {
      return `https://docs.google.com/presentation/d/${match[1]}/embed?start=false&loop=false&delayms=3000`;
    }
    return url;
  };

  const handleOpenGoogleSlides = () => {
    openExternalUrl('https://slides.google.com');
  };

  const handleInsert = () => {
    if (!isValidGoogleSlidesUrl(url)) {
      setError('Please enter a valid Google Slides URL');
      return;
    }
    onSelectSlides(getEmbedUrl(url));
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
            <Presentation className="h-5 w-5" />
            Insert Google Slides
          </DialogTitle>
          <DialogDescription>
            Open your Google Slides and copy the URL from the address bar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Open Google Slides button */}
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={handleOpenGoogleSlides}
          >
            <ExternalLink className="h-4 w-4" />
            Open Google Slides in Browser
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            Find your presentation, then copy the URL from the address bar
          </div>

          {/* URL input */}
          <div className="space-y-2">
            <Input
              placeholder="Paste Google Slides URL here..."
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
            {url && isValidGoogleSlidesUrl(url) && (
              <p className="text-sm text-green-600">✓ Valid Google Slides URL</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleInsert}
            disabled={!url || !isValidGoogleSlidesUrl(url)}
          >
            Insert Presentation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
