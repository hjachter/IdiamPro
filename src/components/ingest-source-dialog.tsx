'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Youtube, File, Loader2, Upload } from 'lucide-react';
import type { ExternalSourceType, ExternalSourceInput, IngestPreview } from '@/types';
import { useAI, useAIFeature } from '@/contexts/ai-context';
import IngestPreviewDialog from './ingest-preview-dialog';

interface IngestSourceDialogProps {
  children: React.ReactNode;
  onIngest: (source: ExternalSourceInput) => Promise<IngestPreview>;
  onApplyPreview: (preview: IngestPreview) => Promise<void>;
  outlineSummary?: string;  // Summary of current outline for merge context
}

export default function IngestSourceDialog({
  children,
  onIngest,
  onApplyPreview,
  outlineSummary,
}: IngestSourceDialogProps) {
  const [open, setOpen] = useState(false);
  const [sourceType, setSourceType] = useState<ExternalSourceType>('text');
  const [url, setUrl] = useState('');
  const [textContent, setTextContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [preview, setPreview] = useState<IngestPreview | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ingestEnabled = useAIFeature('enableIngestExternalSource');

  const resetForm = () => {
    setUrl('');
    setTextContent('');
    setError(null);
    setPreview(null);
    setShowPreview(false);
  };

  const handleClose = () => {
    setOpen(false);
    resetForm();
  };

  const handleSubmit = async () => {
    setError(null);
    setIsLoading(true);

    try {
      let source: ExternalSourceInput;

      if (sourceType === 'text') {
        if (!textContent.trim()) {
          throw new Error('Please enter some text content.');
        }
        source = { type: 'text', content: textContent };
      } else if (sourceType === 'youtube') {
        if (!url.trim()) {
          throw new Error('Please enter a YouTube URL.');
        }
        if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
          throw new Error('Please enter a valid YouTube URL.');
        }
        source = { type: 'youtube', url };
      } else {
        if (!url.trim()) {
          throw new Error('Please enter a PDF URL.');
        }
        source = { type: 'pdf', url };
      }

      const result = await onIngest(source);
      setPreview(result);
      setShowPreview(true);
    } catch (e) {
      setError((e as Error).message || 'Failed to process source.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyPreview = async () => {
    if (!preview) return;

    setIsApplying(true);
    try {
      await onApplyPreview(preview);
      handleClose();
    } catch (e) {
      setError((e as Error).message || 'Failed to apply changes.');
    } finally {
      setIsApplying(false);
    }
  };

  const handleCancelPreview = () => {
    setShowPreview(false);
    setPreview(null);
  };

  if (!ingestEnabled) {
    return null;
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isOpen) handleClose();
        else setOpen(true);
      }}>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Ingest External Source
            </DialogTitle>
            <DialogDescription>
              Import content from YouTube videos, PDFs, or text to create or extend your outline.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={sourceType} onValueChange={(v) => setSourceType(v as ExternalSourceType)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="text" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Text
              </TabsTrigger>
              <TabsTrigger value="youtube" className="flex items-center gap-2">
                <Youtube className="h-4 w-4" />
                YouTube
              </TabsTrigger>
              <TabsTrigger value="pdf" className="flex items-center gap-2">
                <File className="h-4 w-4" />
                PDF
              </TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="text-content">Content</Label>
                <Textarea
                  id="text-content"
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Paste your text content here..."
                  className="min-h-[150px]"
                />
                <p className="text-xs text-muted-foreground">
                  Paste any text content - notes, articles, transcripts, etc.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="youtube" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="youtube-url">YouTube URL</Label>
                <Input
                  id="youtube-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
                <p className="text-xs text-muted-foreground">
                  Note: Automatic transcript extraction is coming soon. For now, paste the video transcript in the Text tab.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="pdf" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="pdf-url">PDF URL</Label>
                <Input
                  id="pdf-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/document.pdf"
                />
                <p className="text-xs text-muted-foreground">
                  Note: Automatic PDF extraction is coming soon. For now, copy and paste the PDF content in the Text tab.
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {outlineSummary && (
            <div className="rounded-lg border p-3 bg-muted/30 text-sm">
              <p className="font-medium mb-1">Current Outline</p>
              <p className="text-muted-foreground text-xs line-clamp-2">{outlineSummary}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Content will be merged into this outline.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Generate Preview'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <IngestPreviewDialog
        open={showPreview}
        onOpenChange={setShowPreview}
        preview={preview}
        onConfirm={handleApplyPreview}
        onCancel={handleCancelPreview}
        isApplying={isApplying}
      />
    </>
  );
}
