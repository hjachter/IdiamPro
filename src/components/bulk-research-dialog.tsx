'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { X, Plus, FileText, Youtube, Type } from 'lucide-react';
import type { ExternalSourceInput, BulkResearchSources } from '@/types';

interface BulkResearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: BulkResearchSources) => Promise<void>;
  currentOutlineName?: string;
}

type SourceEntry = ExternalSourceInput & { id: string };

export default function BulkResearchDialog({
  open,
  onOpenChange,
  onSubmit,
  currentOutlineName,
}: BulkResearchDialogProps) {
  const [sources, setSources] = useState<SourceEntry[]>([]);
  const [includeExisting, setIncludeExisting] = useState(true);
  const [outlineName, setOutlineName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add new source
  const handleAddSource = () => {
    setSources([...sources, { id: crypto.randomUUID(), type: 'youtube' }]);
  };

  // Remove source
  const handleRemoveSource = (id: string) => {
    setSources(sources.filter(s => s.id !== id));
  };

  // Update source
  const handleUpdateSource = (id: string, updates: Partial<SourceEntry>) => {
    setSources(sources.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  // Handle file upload
  const handleFileUpload = async (id: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      handleUpdateSource(id, { content: dataUrl, fileName: file.name });
    };
    reader.readAsDataURL(file);
  };

  // Submit
  const handleSubmit = async () => {
    if (sources.length === 0) {
      alert('Please add at least one source.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        sources: sources.map(({ id, ...rest }) => rest),
        includeExistingContent: includeExisting,
        outlineName: outlineName.trim() || undefined,
      });

      // Reset form
      setSources([]);
      setIncludeExisting(true);
      setOutlineName('');
      onOpenChange(false);
    } catch (error) {
      console.error('Bulk import failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Research Import (PREMIUM)</DialogTitle>
          <DialogDescription>
            Import multiple sources and synthesize them into a comprehensive research outline.
            The AI will analyze all sources, find connections, and create a unified structure.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Outline Name */}
          <div className="space-y-2">
            <Label htmlFor="outline-name">Outline Name (optional)</Label>
            <Input
              id="outline-name"
              placeholder="Research Synthesis"
              value={outlineName}
              onChange={(e) => setOutlineName(e.target.value)}
            />
          </div>

          {/* Include Existing Content */}
          {currentOutlineName && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-existing"
                checked={includeExisting}
                onCheckedChange={(checked) => setIncludeExisting(checked === true)}
              />
              <Label htmlFor="include-existing" className="text-sm font-normal cursor-pointer">
                Include existing content from &quot;{currentOutlineName}&quot;
              </Label>
            </div>
          )}

          {/* Sources List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Sources ({sources.length})</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddSource}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Source
              </Button>
            </div>

            {sources.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-md">
                No sources added yet. Click &quot;Add Source&quot; to begin.
              </div>
            )}

            {sources.map((source, idx) => (
              <div key={source.id} className="border rounded-md p-3 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    {source.type === 'youtube' && <Youtube className="w-4 h-4 text-red-500" />}
                    {source.type === 'pdf' && <FileText className="w-4 h-4 text-blue-500" />}
                    {source.type === 'text' && <Type className="w-4 h-4 text-green-500" />}
                    <span className="text-sm font-medium">Source {idx + 1}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveSource(source.id)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <Select
                    value={source.type}
                    onValueChange={(type) => handleUpdateSource(source.id, { type: type as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="youtube">YouTube Video</SelectItem>
                      <SelectItem value="pdf">PDF Document</SelectItem>
                      <SelectItem value="text">Text/Notes</SelectItem>
                    </SelectContent>
                  </Select>

                  {source.type === 'youtube' && (
                    <Input
                      placeholder="YouTube URL"
                      value={source.url || ''}
                      onChange={(e) => handleUpdateSource(source.id, { url: e.target.value })}
                    />
                  )}

                  {source.type === 'pdf' && (
                    <div className="space-y-2">
                      <Input
                        placeholder="PDF URL (optional)"
                        value={source.url || ''}
                        onChange={(e) => handleUpdateSource(source.id, { url: e.target.value })}
                      />
                      <div className="text-sm text-muted-foreground text-center">or</div>
                      <Input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(source.id, file);
                        }}
                      />
                      {source.fileName && (
                        <div className="text-xs text-muted-foreground">
                          Uploaded: {source.fileName}
                        </div>
                      )}
                    </div>
                  )}

                  {source.type === 'text' && (
                    <textarea
                      className="w-full min-h-[100px] p-2 border rounded-md text-sm"
                      placeholder="Paste your text or notes here..."
                      value={source.content || ''}
                      onChange={(e) => handleUpdateSource(source.id, { content: e.target.value })}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || sources.length === 0}>
            {isSubmitting ? 'Processing...' : `Synthesize ${sources.length} Source${sources.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
