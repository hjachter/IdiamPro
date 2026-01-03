'use client';

import React, { useCallback } from 'react';
import { Tldraw, useEditor } from 'tldraw';
import 'tldraw/tldraw.css';
import { Button } from '@/components/ui/button';
import { X, Check, Trash2 } from 'lucide-react';

interface DrawingCanvasProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (imageDataUrl: string) => void;
}

// Inner component that has access to the editor
function DrawingCanvasInner({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (imageDataUrl: string) => void;
}) {
  const editor = useEditor();

  const handleSave = useCallback(async () => {
    if (!editor) return;

    try {
      // Get all shape IDs on the current page
      const shapeIds = editor.getCurrentPageShapeIds();

      if (shapeIds.size === 0) {
        // No shapes, just close
        onClose();
        return;
      }

      // Export to PNG using tldraw 4.x API
      const result = await editor.toImage([...shapeIds], {
        format: 'png',
        background: false,
        padding: 16,
        scale: 2, // 2x for retina
      });

      if (result && result.blob) {
        // Convert blob to data URL
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          onSave(dataUrl);
        };
        reader.readAsDataURL(result.blob);
      } else {
        console.error('Failed to export drawing: no blob returned');
        onClose();
      }
    } catch (error) {
      console.error('Failed to export drawing:', error);
      onClose();
    }
  }, [editor, onSave, onClose]);

  const handleClear = useCallback(() => {
    if (!editor) return;
    const shapeIds = editor.getCurrentPageShapeIds();
    if (shapeIds.size > 0) {
      editor.deleteShapes([...shapeIds]);
    }
  }, [editor]);

  return (
    <>
      {/* Top action bar */}
      <div className="absolute top-0 left-0 right-0 z-[1000] flex items-center justify-between p-3 bg-background/90 backdrop-blur-sm border-b safe-area-top">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="gap-2"
        >
          <X className="h-4 w-4" />
          Cancel
        </Button>

        <span className="font-semibold text-sm">Drawing</span>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClear}
            title="Clear canvas"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleSave}
            className="gap-2"
          >
            <Check className="h-4 w-4" />
            Insert
          </Button>
        </div>
      </div>
    </>
  );
}

export default function DrawingCanvas({
  isOpen,
  onClose,
  onSave,
}: DrawingCanvasProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <div className="absolute inset-0" style={{ paddingTop: 'max(60px, env(safe-area-inset-top))' }}>
        <Tldraw
          inferDarkMode
          autoFocus
        >
          <DrawingCanvasInner onClose={onClose} onSave={onSave} />
        </Tldraw>
      </div>
    </div>
  );
}
