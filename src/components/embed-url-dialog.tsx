'use client';

import React, { useState } from 'react';
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

export type EmbedType = 'googleDoc' | 'googleSheet' | 'googleSlide' | 'youtube' | 'googleMaps' | null;

interface EmbedUrlDialogProps {
  open: boolean;
  embedType: EmbedType;
  onSubmit: (url: string) => void;
  onCancel: () => void;
}

const embedTypeLabels = {
  googleDoc: 'Google Doc',
  googleSheet: 'Google Sheet',
  googleSlide: 'Google Slides',
  youtube: 'YouTube Video',
  googleMaps: 'Google Maps',
};

const embedTypeInstructions = {
  googleDoc: 'Open your Google Doc, click File → Share → Publish to web → Embed, then copy the URL from the embed code.',
  googleSheet: 'Open your Google Sheet, click File → Share → Publish to web → Embed, then copy the URL from the embed code.',
  googleSlide: 'Open your Google Slides, click File → Share → Publish to web → Embed, then copy the URL from the embed code.',
  youtube: 'Copy the YouTube video URL (e.g., https://www.youtube.com/watch?v=VIDEO_ID or the full embed URL).',
  googleMaps: 'Open Google Maps, click Share → Embed a map, then copy the URL from the iframe src attribute.',
};

export default function EmbedUrlDialog({
  open,
  embedType,
  onSubmit,
  onCancel,
}: EmbedUrlDialogProps) {
  const [url, setUrl] = useState('');

  const handleSubmit = () => {
    if (url.trim()) {
      onSubmit(url.trim());
      setUrl('');
    }
  };

  const handleCancel = () => {
    setUrl('');
    onCancel();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  if (!embedType) return null;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Insert {embedTypeLabels[embedType]}</DialogTitle>
          <DialogDescription>
            {embedTypeInstructions[embedType]}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="embed-url">Embed URL</Label>
            <Input
              id="embed-url"
              placeholder="https://docs.google.com/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!url.trim()}>
            Insert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
