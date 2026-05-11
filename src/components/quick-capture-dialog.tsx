'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Inbox, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface QuickCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (text: string) => void;
}

export function QuickCaptureDialog({ open, onOpenChange, onCapture }: QuickCaptureDialogProps) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (open) {
      setText('');
      setSaving(false);
      // Autofocus after dialog renders
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSaving(true);
    onCapture(trimmed);
    setText('');
    onOpenChange(false);
    setSaving(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl+Enter always submits (both platforms)
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
      return;
    }
    // On desktop, plain Enter submits and Shift+Enter inserts newline.
    // On mobile, plain Enter falls through to default newline behavior.
    if (!isMobile && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const charCount = text.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <Inbox className="h-5 w-5" />
            Quick Capture
          </DialogTitle>
          <DialogDescription>
            {isMobile ? (
              <>
                Type or paste anything. Tap <strong>Save to Inbox</strong> when you're done.
              </>
            ) : (
              <>
                Type or paste anything. Press <kbd className="px-1.5 py-0.5 text-xs bg-muted border rounded">Enter</kbd> to save to your Second Brain Inbox.
                <span className="ml-1 opacity-70">Shift+Enter for newline.</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Capture a thought, a URL, a quote, a reminder..."
            className="min-h-[140px] resize-none text-base"
            disabled={saving}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className={cn(charCount === 0 && 'opacity-50')}>
              {charCount === 0 ? 'Empty' : `${charCount} character${charCount === 1 ? '' : 's'}`}
            </span>
            <div className="flex items-center gap-2">
              <Sparkles className="h-3 w-3 text-emerald-500" />
              <span>AI will suggest tags after save</span>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!text.trim() || saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Inbox className="mr-2 h-4 w-4" />
                  Save to Inbox
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
