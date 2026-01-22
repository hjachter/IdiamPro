'use client';

import React, { useCallback, useState, useEffect } from 'react';
import { Excalidraw, exportToBlob } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { Button } from '@/components/ui/button';
import { X, Check, Trash2 } from 'lucide-react';

interface ExcalidrawDrawingCanvasProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (imageDataUrl: string) => void;
}

export default function ExcalidrawDrawingCanvas({
  isOpen,
  onClose,
  onSave,
}: ExcalidrawDrawingCanvasProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);

  // Detect dark mode
  const [isDarkMode, setIsDarkMode] = useState(false);
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const handleSave = useCallback(async () => {
    if (!excalidrawAPI) return;

    try {
      const elements = excalidrawAPI.getSceneElements();

      if (!elements || elements.length === 0) {
        // No elements, just close
        onClose();
        return;
      }

      // Export to PNG blob
      const blob = await exportToBlob({
        elements,
        appState: excalidrawAPI.getAppState(),
        files: excalidrawAPI.getFiles(),
        mimeType: 'image/png',
        exportPadding: 16,
      });

      if (blob) {
        // Convert blob to data URL
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          onSave(dataUrl);
        };
        reader.readAsDataURL(blob);
      } else {
        console.error('Failed to export drawing: no blob returned');
        onClose();
      }
    } catch (error) {
      console.error('Failed to export drawing:', error);
      onClose();
    }
  }, [excalidrawAPI, onSave, onClose]);

  const handleClear = useCallback(() => {
    if (!excalidrawAPI) return;
    excalidrawAPI.resetScene();
  }, [excalidrawAPI]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Top action bar */}
      <div className="absolute top-0 left-0 right-0 z-[1000] flex items-center justify-between p-3 bg-background/90 backdrop-blur-sm border-b" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
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

      {/* Excalidraw canvas */}
      <div className="absolute inset-0" style={{ paddingTop: 'max(60px, env(safe-area-inset-top))' }}>
        <Excalidraw
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
          theme={isDarkMode ? 'dark' : 'light'}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              saveAsImage: false,
              export: false,
            },
          }}
        />
      </div>
    </div>
  );
}
