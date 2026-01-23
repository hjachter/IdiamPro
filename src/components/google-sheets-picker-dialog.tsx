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
import { ExternalLink, Sheet } from 'lucide-react';
import { openExternalUrl } from '@/lib/electron-storage';

interface GoogleSheetsPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectSheet: (url: string) => void;
}

export default function GoogleSheetsPickerDialog({
  open,
  onOpenChange,
  onSelectSheet,
}: GoogleSheetsPickerDialogProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  // Check if URL is a valid Google Sheets URL or embed URL
  const isValidGoogleSheetsUrl = (url: string) => {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();
    return (
      lowerUrl.includes('docs.google.com/spreadsheets') ||
      lowerUrl.includes('sheets.google.com')
    );
  };

  // Convert share URL to htmlview URL (works with shared sheets)
  const getEmbedUrl = (url: string): string => {
    // If already an embed-friendly URL, return as-is
    if (url.includes('/htmlview') || url.includes('/pubhtml') || url.includes('/preview')) {
      return url;
    }
    // Convert /spreadsheets/d/ID/edit to /spreadsheets/d/ID/htmlview
    const match = url.match(/spreadsheets\/d\/([^\/]+)/);
    if (match) {
      return `https://docs.google.com/spreadsheets/d/${match[1]}/htmlview?widget=true`;
    }
    return url;
  };

  const handleOpenGoogleSheets = () => {
    openExternalUrl('https://sheets.google.com');
  };

  const handleInsert = () => {
    if (!isValidGoogleSheetsUrl(url)) {
      setError('Please enter a valid Google Sheets URL');
      return;
    }
    onSelectSheet(getEmbedUrl(url));
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
            <Sheet className="h-5 w-5" />
            Insert Google Sheet
          </DialogTitle>
          <DialogDescription>
            Open your Google Sheet and copy the URL from the address bar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Open Google Sheets button */}
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={handleOpenGoogleSheets}
          >
            <ExternalLink className="h-4 w-4" />
            Open Google Sheets in Browser
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            Find your spreadsheet, then copy the URL from the address bar
          </div>

          {/* URL input */}
          <div className="space-y-2">
            <Input
              placeholder="Paste Google Sheets URL here..."
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
            {url && isValidGoogleSheetsUrl(url) && (
              <p className="text-sm text-green-600">✓ Valid Google Sheets URL</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleInsert}
            disabled={!url || !isValidGoogleSheetsUrl(url)}
          >
            Insert Spreadsheet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
