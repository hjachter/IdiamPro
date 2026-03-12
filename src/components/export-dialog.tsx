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
  const [searchQuery, setSearchQuery] = useState('');
  const [showWebsiteDialog, setShowWebsiteDialog] = useState(false);
  const [showPodcastDialog, setShowPodcastDialog] = useState(false);

  const displayName = nodeName || (rootNodeId ? outline.nodes[rootNodeId]?.name : null) || outline.name;

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedFormat(null);
      setFilename('');
      setIncludeContent(true);
      setIncludeMetadata(false);
      setSearchQuery('');
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

  const handleExport = async () => {
    if (!selectedFormat || !filename.trim()) return;

    // Website format opens its own dialog
    if (selectedFormat === 'website') {
      setShowWebsiteDialog(true);
      return;
    }

    setIsExporting(true);
    try {
      // PDF uses the existing exporter — lazy-loaded to keep bundle small
      if (selectedFormat === 'pdf') {
        const { exportSubtreeToPdf } = await import('@/lib/pdf-export');
        await exportSubtreeToPdf(
          outline.nodes,
          rootNodeId || outline.rootNodeId,
          filename
        );
      } else if (hasExporter(selectedFormat)) {
        await exportOutline(selectedFormat, outline, rootNodeId, {
          includeContent,
          includeMetadata,
        });
      } else {
        toast({
          title: 'Format Not Available',
          description: `Export to ${FORMAT_REGISTRY[selectedFormat]?.name || selectedFormat} is coming soon.`,
          variant: 'destructive',
        });
        setIsExporting(false);
        return;
      }

      toast({
        title: 'Export Complete',
        description: `Exported to ${FORMAT_REGISTRY[selectedFormat]?.name || selectedFormat}`,
      });
      onOpenChange(false);
    } catch (error: any) {
      console.error('Export failed:', error);
      toast({
        title: 'Export Failed',
        description: error.message || 'An error occurred during export',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
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
    <Dialog open={open && !showWebsiteDialog && !showPodcastDialog} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Share Subtree As...</DialogTitle>
          <DialogDescription>
            Exporting: &ldquo;{displayName}&rdquo;
            {rootNodeId && rootNodeId !== outline.rootNodeId && ' (subtree)'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search formats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

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
                    <div className="grid grid-cols-4 gap-2">
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

        <DialogFooter className="mt-4 flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={!selectedFormat || !filename.trim() || isExporting}
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              'Export'
            )}
          </Button>
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
