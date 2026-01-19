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
import { ExternalLink, Video } from 'lucide-react';

interface YouTubePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectVideo: (url: string) => void;
}

export default function YouTubePickerDialog({
  open,
  onOpenChange,
  onSelectVideo,
}: YouTubePickerDialogProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  // Check if URL is a valid YouTube video URL
  const isValidYouTubeUrl = (url: string) => {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();
    return (
      (lowerUrl.includes('youtube.com/watch') && lowerUrl.includes('v=')) ||
      lowerUrl.includes('youtu.be/') ||
      lowerUrl.includes('youtube.com/shorts/')
    );
  };

  const handleOpenYouTube = () => {
    // Open YouTube in system browser
    window.open('https://www.youtube.com', '_blank');
  };

  const handleInsert = () => {
    if (!isValidYouTubeUrl(url)) {
      setError('Please enter a valid YouTube video URL');
      return;
    }
    onSelectVideo(url);
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
            <Video className="h-5 w-5" />
            Insert YouTube Video
          </DialogTitle>
          <DialogDescription>
            Find a video on YouTube, copy its URL, and paste it below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Open YouTube button */}
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={handleOpenYouTube}
          >
            <ExternalLink className="h-4 w-4" />
            Open YouTube in Browser
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            Find your video, then copy the URL from the address bar
          </div>

          {/* URL input */}
          <div className="space-y-2">
            <Input
              placeholder="Paste YouTube URL here..."
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
            {url && isValidYouTubeUrl(url) && (
              <p className="text-sm text-green-600">✓ Valid YouTube URL</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleInsert}
            disabled={!url || !isValidYouTubeUrl(url)}
          >
            Insert Video
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
