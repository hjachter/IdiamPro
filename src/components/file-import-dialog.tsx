'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search, Upload, FileUp, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Outline } from '@/types';
import {
  FORMAT_REGISTRY,
  FORMAT_CATEGORY_LABELS,
  getImportFormatsByCategory,
  detectFormatFromFile,
  type FormatDefinition,
  type FormatCategory,
} from '@/lib/format-registry';
import { importFile, findImporterForFile, hasImporter, getSupportedImportExtensions } from '@/lib/import';
import type { ImportResult } from '@/lib/import/types';
import { useToast } from '@/hooks/use-toast';

interface FileImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: (outline: Outline) => void;
}

type ImportState = 'idle' | 'importing' | 'success' | 'error';

export default function FileImportDialog({
  open,
  onOpenChange,
  onImportComplete,
}: FileImportDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [detectedFormat, setDetectedFormat] = useState<FormatDefinition | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [outlineName, setOutlineName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [importState, setImportState] = useState<ImportState>('idle');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Build accept string for file input
  const acceptString = useMemo(() => {
    const extensions = getSupportedImportExtensions();
    // Also add .idm and .json for native format
    return [...extensions, '.idm', '.json'].join(',');
  }, []);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedFile(null);
      setDetectedFormat(null);
      setSelectedFormat(null);
      setOutlineName('');
      setSearchQuery('');
      setImportState('idle');
      setImportResult(null);
      setErrorMessage(null);
      setIsDragging(false);
    }
  }, [open]);

  // Auto-detect format when file is selected
  useEffect(() => {
    if (selectedFile) {
      const format = detectFormatFromFile(selectedFile);
      setDetectedFormat(format);

      // Auto-select if we have an importer for it
      if (format && hasImporter(format.id)) {
        setSelectedFormat(format.id);
      } else if (format?.id === 'json') {
        // Native JSON/IDM format
        setSelectedFormat('json');
      }

      // Set default outline name from filename
      const baseName = selectedFile.name.replace(/\.[^/.]+$/, '');
      setOutlineName(baseName);
    }
  }, [selectedFile]);

  // Group and filter formats
  const formatsByCategory = useMemo(() => {
    const all = getImportFormatsByCategory();
    if (!searchQuery.trim()) return all;

    const query = searchQuery.toLowerCase();
    const filtered: Record<FormatCategory, FormatDefinition[]> = {
      documents: [],
      outliners: [],
      'note-apps': [],
      'mind-maps': [],
      data: [],
      presentations: [],
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

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    setImportState('idle');
    setImportResult(null);
    setErrorMessage(null);
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setImportState('importing');
    setErrorMessage(null);

    try {
      // Check if it's a native JSON/IDM file
      const ext = selectedFile.name.split('.').pop()?.toLowerCase();
      if (ext === 'idm' || ext === 'json') {
        // Handle native format
        const content = await selectedFile.text();
        const outline = JSON.parse(content) as Outline;

        // Override name if provided
        if (outlineName.trim()) {
          outline.name = outlineName.trim();
        }

        setImportState('success');
        setImportResult({
          outline,
          stats: {
            nodesImported: Object.keys(outline.nodes).length,
            maxDepth: calculateMaxDepth(outline),
          },
        });

        // Auto-complete after brief delay to show success
        setTimeout(() => {
          onImportComplete(outline);
          onOpenChange(false);
        }, 500);
        return;
      }

      // Check if we have an importer
      const importer = findImporterForFile(selectedFile);
      if (!importer) {
        throw new Error(`No importer available for this file type. Detected format: ${detectedFormat?.name || 'Unknown'}`);
      }

      // Import the file
      const result = await importFile(selectedFile, {
        outlineName: outlineName.trim() || undefined,
      });

      setImportState('success');
      setImportResult(result);

      // Show warnings if any
      if (result.warnings && result.warnings.length > 0) {
        toast({
          title: 'Import Completed with Warnings',
          description: result.warnings.join('; '),
        });
      }

      // Auto-complete after brief delay to show success
      setTimeout(() => {
        onImportComplete(result.outline);
        onOpenChange(false);
      }, 500);
    } catch (error: any) {
      console.error('Import failed:', error);
      setImportState('error');
      setErrorMessage(error.message || 'An error occurred during import');
      toast({
        title: 'Import Failed',
        description: error.message || 'An error occurred during import',
        variant: 'destructive',
      });
    }
  };

  const canImport = selectedFile && (
    selectedFormat === 'json' ||
    (selectedFormat && hasImporter(selectedFormat)) ||
    findImporterForFile(selectedFile)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Outline</DialogTitle>
          <DialogDescription>
            Import an outline from another application or format
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col gap-4">
          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
              isDragging
                ? 'border-primary bg-primary/10'
                : 'border-muted-foreground/25 hover:border-muted-foreground/50',
              selectedFile && 'border-primary/50 bg-primary/5'
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={acceptString}
              onChange={handleFileInputChange}
              className="hidden"
            />
            {selectedFile ? (
              <div className="flex flex-col items-center gap-2">
                <FileUp className="h-8 w-8 text-primary" />
                <div className="font-medium">{selectedFile.name}</div>
                <div className="text-sm text-muted-foreground">
                  {detectedFormat ? `Detected: ${detectedFormat.name}` : 'Click or drag to replace'}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div className="font-medium">Drop a file here or click to browse</div>
                <div className="text-sm text-muted-foreground">
                  Supports Markdown, OPML, Plain Text, JSON, and more
                </div>
              </div>
            )}
          </div>

          {/* Format Selection (shown when file selected and format detection is ambiguous) */}
          {selectedFile && !detectedFormat?.supportsImport && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search formats..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <ScrollArea className="flex-1 min-h-[150px] max-h-[200px]">
                <div className="space-y-4 pr-4">
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
                            const isAvailable = format.id === 'json' || hasImporter(format.id);
                            return (
                              <button
                                key={format.id}
                                onClick={(e) => {
                                  e.stopPropagation();
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
              </ScrollArea>
            </>
          )}

          {/* Options (shown when file selected) */}
          {selectedFile && (
            <div className="space-y-4 border-t pt-4">
              <div className="grid gap-2">
                <Label htmlFor="outline-name">Outline Name</Label>
                <Input
                  id="outline-name"
                  value={outlineName}
                  onChange={(e) => setOutlineName(e.target.value)}
                  placeholder="Name for the imported outline"
                />
              </div>
            </div>
          )}

          {/* Import Result */}
          {importState === 'success' && importResult && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <Check className="h-5 w-5 text-green-500" />
              <div>
                <div className="font-medium text-green-700 dark:text-green-400">
                  Import Successful
                </div>
                <div className="text-sm text-muted-foreground">
                  {importResult.stats.nodesImported} nodes imported
                  {importResult.stats.maxDepth > 0 && `, ${importResult.stats.maxDepth} levels deep`}
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {importState === 'error' && errorMessage && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <div>
                <div className="font-medium text-destructive">Import Failed</div>
                <div className="text-sm text-muted-foreground">{errorMessage}</div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!canImport || importState === 'importing' || importState === 'success'}
          >
            {importState === 'importing' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : importState === 'success' ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Done
              </>
            ) : (
              'Import'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function calculateMaxDepth(outline: Outline): number {
  let maxDepth = 0;

  const traverse = (nodeId: string, depth: number) => {
    maxDepth = Math.max(maxDepth, depth);
    const node = outline.nodes[nodeId];
    if (node?.childrenIds) {
      for (const childId of node.childrenIds) {
        traverse(childId, depth + 1);
      }
    }
  };

  if (outline.rootNodeId) {
    traverse(outline.rootNodeId, 0);
  }

  return maxDepth;
}
