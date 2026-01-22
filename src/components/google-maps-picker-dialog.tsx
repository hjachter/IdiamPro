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
import { ExternalLink, Map } from 'lucide-react';

interface GoogleMapsPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectMap: (url: string) => void;
}

export default function GoogleMapsPickerDialog({
  open,
  onOpenChange,
  onSelectMap,
}: GoogleMapsPickerDialogProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  // Check if URL is a valid Google Maps URL or embed URL
  const isValidGoogleMapsUrl = (url: string) => {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();
    return (
      lowerUrl.includes('google.com/maps') ||
      lowerUrl.includes('maps.google.com') ||
      lowerUrl.includes('goo.gl/maps')
    );
  };

  // Convert share URL to embed URL if needed
  const getEmbedUrl = (url: string): string => {
    // If already an embed URL, return as-is
    if (url.includes('/embed')) {
      return url;
    }
    // For place URLs, convert to embed format
    // Example: https://www.google.com/maps/place/... -> embed
    if (url.includes('/place/')) {
      const match = url.match(/place\/([^\/]+)/);
      if (match) {
        const placeName = match[1];
        return `https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${placeName}`;
      }
    }
    // For search URLs
    if (url.includes('/search/')) {
      const match = url.match(/search\/([^\/]+)/);
      if (match) {
        const query = match[1];
        return `https://www.google.com/maps/embed/v1/search?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${query}`;
      }
    }
    // For @lat,lng URLs, extract coordinates
    const coordMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (coordMatch) {
      const lat = coordMatch[1];
      const lng = coordMatch[2];
      return `https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d10000!2d${lng}!3d${lat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1`;
    }
    return url;
  };

  const handleOpenGoogleMaps = () => {
    window.open('https://maps.google.com', '_blank');
  };

  const handleInsert = () => {
    if (!isValidGoogleMapsUrl(url)) {
      setError('Please enter a valid Google Maps URL');
      return;
    }
    onSelectMap(getEmbedUrl(url));
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
            <Map className="h-5 w-5" />
            Insert Google Map
          </DialogTitle>
          <DialogDescription>
            Open Google Maps, search for a location, then copy the URL from the address bar. For best results, click Share → Embed a map.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Open Google Maps button */}
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={handleOpenGoogleMaps}
          >
            <ExternalLink className="h-4 w-4" />
            Open Google Maps in Browser
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            Find your location, then copy the URL from the address bar
          </div>

          {/* URL input */}
          <div className="space-y-2">
            <Input
              placeholder="Paste Google Maps URL here..."
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
            {url && isValidGoogleMapsUrl(url) && (
              <p className="text-sm text-green-600">✓ Valid Google Maps URL</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleInsert}
            disabled={!url || !isValidGoogleMapsUrl(url)}
          >
            Insert Map
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
