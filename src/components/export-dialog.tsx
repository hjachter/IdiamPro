'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Outline } from '@/types';
import {
  FORMAT_REGISTRY,
  FORMAT_CATEGORY_LABELS,
  getExportFormatsByCategory,
  type FormatDefinition,
  type FormatCategory,
} from '@/lib/format-registry';
import { exportOutline, hasExporter } from '@/lib/export/index';
import { useToast } from '@/hooks/use-toast';
import WebsiteExportDialog from './website-export-dialog';
import PodcastDialog from './podcast-dialog';
import ShareLinkDialog from './share-link-dialog';
import { Link2 } from 'lucide-react';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outline: Outline;
  rootNodeId?: string;
  nodeName?: string;
}

export default function ExportDialog({
  open,
  onOpenChange,
  outline,
  rootNodeId,
  nodeName,
}: ExportDialogProps) {
  const { toast } = useToast();
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [filename, setFilename] = useState('');
  const [includeContent, setIncludeContent] = useState(true);
  const [includeMetadata, setIncludeMetadata] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStage, setExportStage] = useState<string | null>(null);
  // When the user cancels, we abandon the in-flight result instead of showing
  // success/error, and reset the button immediately.
  const cancelledRef = React.useRef(false);
  // Lets us actually stop the PDF worker on cancel/timeout (not just hide it).
  const abortRef = React.useRef<AbortController | null>(null);
  // Hard safety cap: no export may spin longer than this before failing cleanly.
  const EXPORT_TIMEOUT_MS = 120000;
  const [searchQuery, setSearchQuery] = useState('');
  const [showWebsiteDialog, setShowWebsiteDialog] = useState(false);
  const [showPodcastDialog, setShowPodcastDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);

  const displayName = nodeName || (rootNodeId ? outline.nodes[rootNodeId]?.name : null) || outline.name;

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedFormat(null);
      setFilename('');
      setIncludeContent(true);
      setIncludeMetadata(false);
      setSearchQuery('');
      setExportStage(null);
      cancelledRef.current = false;
      try { abortRef.current?.abort(); } catch { /* ignore */ }
      abortRef.current = null;
    }
  }, [open]);

  // Update filename when format is selected
  useEffect(() => {
    if (selectedFormat && open) {
      const format = FORMAT_REGISTRY[selectedFormat];
      if (format) {
        const baseName = sanitizeFilename(displayName);
        setFilename(`${baseName}${format.extensions[0]}`);
      }
    }
  }, [selectedFormat, displayName, open]);

  // Group and filter formats
  const formatsByCategory = useMemo(() => {
    const all = getExportFormatsByCategory();
    if (!searchQuery.trim()) return all;

    const query = searchQuery.toLowerCase();
    const filtered: Record<FormatCategory, FormatDefinition[]> = {
      documents: [],
      outliners: [],
      'note-apps': [],
      'mind-maps': [],
      data: [],
      presentations: [],
      media: [],
      social: [],
    };

    for (const category of Object.keys(all) as FormatCategory[]) {
      filtered[category] = all[category].filter(
        (f) =>
          f.name.toLowerCase().includes(query) ||
          f.description.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [searchQuery]);

  // Cancel an in-flight export: stop the worker, abandon the result, and reset
  // the button now.
  const handleCancelExport = () => {
    cancelledRef.current = true;
    try { abortRef.current?.abort(); } catch { /* ignore */ }
    setIsExporting(false);
    setExportStage(null);
    toast({
      title: 'Export Canceled',
      description: 'The export was stopped.',
    });
  };

  const handleExport = async () => {
    if (!selectedFormat || !filename.trim()) return;

    // Website format opens its own dialog
    if (selectedFormat === 'website') {
      setShowWebsiteDialog(true);
      return;
    }

    // Formats with no exporter yet: tell the user, don't spin.
    if (selectedFormat !== 'pdf' && !hasExporter(selectedFormat)) {
      toast({
        title: 'Format Not Available',
        description: `Export to ${FORMAT_REGISTRY[selectedFormat]?.name || selectedFormat} is coming soon.`,
        variant: 'destructive',
      });
      return;
    }

    cancelledRef.current = false;
    const abortController = new AbortController();
    abortRef.current = abortController;
    setIsExporting(true);
    setExportStage('Starting…');

    // Hard safety timeout: whatever happens, the export cannot spin forever.
    // On timeout we also abort the worker so it stops doing work.
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        try { abortController.abort(); } catch { /* ignore */ }
        reject(
          new Error(
            'Export timed out. The document may be very large — try again or export a smaller section.'
          )
        );
      }, EXPORT_TIMEOUT_MS);
    });

    const runExport = async () => {
      // PDF uses the existing exporter — lazy-loaded to keep bundle small
      if (selectedFormat === 'pdf') {
        const { exportSubtreeToPdf } = await import('@/lib/pdf-export');
        await exportSubtreeToPdf(
          outline.nodes,
          rootNodeId || outline.rootNodeId,
          filename,
          (stage) => {
            if (!cancelledRef.current) setExportStage(stage);
          },
          abortController.signal
        );
      } else {
        setExportStage('Generating…');
        await exportOutline(selectedFormat, outline, rootNodeId, {
          includeContent,
          includeMetadata,
        });
      }
    };

    try {
      await Promise.race([runExport(), timeoutPromise]);
      // If the user cancelled while we were working, stay quiet.
      if (cancelledRef.current) return;
      toast({
        title: 'Export Complete',
        description: `Exported to ${FORMAT_REGISTRY[selectedFormat]?.name || selectedFormat}`,
      });
      onOpenChange(false);
    } catch (error: any) {
      if (cancelledRef.current) return;
      console.error('Export failed:', error);
      toast({
        title: 'Export Failed',
        description: error.message || 'An error occurred during export',
        variant: 'destructive',
      });
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      abortRef.current = null;
      // The button NEVER stays stuck: this runs on success, error, timeout,
      // and cancel alike.
      setIsExporting(false);
      setExportStage(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && selectedFormat && filename.trim()) {
      handleExport();
    }
  };

  const selectedFormatDef = selectedFormat ? FORMAT_REGISTRY[selectedFormat] : null;

  // Handle website dialog close
  const handleWebsiteDialogClose = (isOpen: boolean) => {
    setShowWebsiteDialog(isOpen);
    if (!isOpen) {
      onOpenChange(false);
    }
  };

  // Handle podcast dialog close
  const handlePodcastDialogClose = (isOpen: boolean) => {
    setShowPodcastDialog(isOpen);
    if (!isOpen) {
      onOpenChange(false);
    }
  };

  return (
    <>
    <Dialog open={open && !showWebsiteDialog && !showPodcastDialog && !showShareDialog} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Share Suboutline As...</DialogTitle>
          <DialogDescription>
            Exporting: &ldquo;{displayName}&rdquo;
            {rootNodeId && rootNodeId !== outline.rootNodeId && ' (suboutline)'}
          </DialogDescription>
        </DialogHeader>

        {/* Search — kept outside the scrolling area so its focus ring isn't clipped */}
        <div className="relative px-0.5 pt-0.5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search formats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto pr-1 pt-1">
          {/* Format Grid */}
          <div>
            <div className="space-y-4">
              {(Object.keys(formatsByCategory) as FormatCategory[]).map((category) => {
                const formats = formatsByCategory[category];
                if (formats.length === 0) return null;

                return (
                  <div key={category}>
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                      {FORMAT_CATEGORY_LABELS[category]}
                    </h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {formats.map((format) => {
                        const Icon = format.icon;
                        const isAvailable = format.id === 'pdf' || format.id === 'podcast' || hasExporter(format.id);
                        return (
                          <button
                            key={format.id}
                            onClick={() => {
                              if (format.id === 'website') {
                                setShowWebsiteDialog(true);
                                return;
                              }
                              if (format.id === 'podcast') {
                                setShowPodcastDialog(true);
                                return;
                              }
                              setSelectedFormat(format.id);
                            }}
                            disabled={!isAvailable}
                            className={cn(
                              'flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-colors',
                              'hover:bg-accent hover:text-accent-foreground',
                              selectedFormat === format.id
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border',
                              !isAvailable && 'opacity-40 cursor-not-allowed'
                            )}
                            title={format.description}
                          >
                            <Icon className="h-5 w-5 mb-1" />
                            <span className="text-xs font-medium">{format.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Options (shown when format selected) */}
          {selectedFormatDef && (
            <div className="space-y-4 border-t pt-4">
              {/* Filename */}
              <div className="grid gap-2">
                <Label htmlFor="export-filename">Filename</Label>
                <Input
                  id="export-filename"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>

              {/* Options */}
              {selectedFormatDef.hasOptions && (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="include-content"
                      checked={includeContent}
                      onCheckedChange={(checked) => setIncludeContent(checked === true)}
                    />
                    <Label htmlFor="include-content" className="text-sm font-normal">
                      Include node content
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="include-metadata"
                      checked={includeMetadata}
                      onCheckedChange={(checked) => setIncludeMetadata(checked === true)}
                    />
                    <Label htmlFor="include-metadata" className="text-sm font-normal">
                      Include metadata (tags, colors)
                    </Label>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Honest progress indicator while an export is running */}
        {isExporting && (
          <div className="mt-3 flex-shrink-0 px-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{exportStage || 'Working…'}</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
            </div>
          </div>
        )}

        <DialogFooter className="mt-4 flex-shrink-0 sm:justify-between">
          <Button
            variant="outline"
            onClick={() => setShowShareDialog(true)}
            disabled={isExporting}
            title="Publish this to a view-only link on our site that anyone can open"
          >
            <Link2 className="mr-2 h-4 w-4" />
            Share Link
          </Button>
          <div className="flex gap-2">
          {isExporting ? (
            <Button variant="outline" onClick={handleCancelExport}>
              Stop
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
          <Button
            onClick={handleExport}
            disabled={!selectedFormat || !filename.trim() || isExporting}
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {exportStage ? 'Working…' : 'Exporting...'}
              </>
            ) : (
              'Export'
            )}
          </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <WebsiteExportDialog
      open={showWebsiteDialog}
      onOpenChange={handleWebsiteDialogClose}
      outline={outline}
      rootNodeId={rootNodeId}
      nodeName={nodeName}
    />

    {showPodcastDialog && (
      <PodcastDialog
        open={showPodcastDialog}
        onOpenChange={handlePodcastDialogClose}
        nodeName={nodeName || displayName}
        nodeId={rootNodeId || outline.rootNodeId}
        nodes={outline.nodes}
      />
    )}

    <ShareLinkDialog
      open={showShareDialog}
      onOpenChange={setShowShareDialog}
      outline={outline}
      rootNodeId={rootNodeId}
      nodeName={nodeName}
    />
    </>
  );
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 100);
}
