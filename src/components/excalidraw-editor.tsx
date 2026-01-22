'use client';

import React, { useCallback, useRef, useEffect, useState } from 'react';
import { Excalidraw, MainMenu, WelcomeScreen } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';

// Simplified data format for saving/loading
export interface ExcalidrawData {
  elements: readonly unknown[];
  appState?: Record<string, unknown>;
  files?: Record<string, unknown>;
  version?: string;
}

interface ExcalidrawEditorProps {
  data: ExcalidrawData | null;
  onDataChange: (data: ExcalidrawData) => void;
  className?: string;
}

export default function ExcalidrawEditor({
  data,
  onDataChange,
  className = '',
}: ExcalidrawEditorProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);
  const lastSavedJsonRef = useRef<string>('');

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

  // Handle changes with debouncing
  const handleChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (elements: readonly any[], appState: any, files: any) => {
      // Skip initial change events before we're fully initialized
      if (!isInitializedRef.current) {
        isInitializedRef.current = true;
        return;
      }

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Debounce save
      saveTimeoutRef.current = setTimeout(() => {
        const saveData: ExcalidrawData = {
          elements,
          appState: {
            viewBackgroundColor: appState.viewBackgroundColor,
            gridSize: appState.gridSize,
          },
          files,
          version: '1.0',
        };

        const json = JSON.stringify(saveData);
        if (json !== lastSavedJsonRef.current) {
          lastSavedJsonRef.current = json;
          onDataChange(saveData);
        }
      }, 500);
    },
    [onDataChange]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Initial data for the component
  const initialData = data ? {
    elements: data.elements || [],
    appState: {
      ...data.appState,
      theme: isDarkMode ? 'dark' as const : 'light' as const,
    },
    files: data.files,
  } : undefined;

  return (
    <div className={`w-full h-full min-h-[500px] ${className}`}>
      <Excalidraw
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
        initialData={initialData}
        onChange={handleChange}
        theme={isDarkMode ? 'dark' : 'light'}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            export: { saveFileToDisk: true },
          },
        }}
      >
        <MainMenu>
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.DefaultItems.SaveAsImage />
          <MainMenu.DefaultItems.ChangeCanvasBackground />
          <MainMenu.Separator />
          <MainMenu.DefaultItems.ToggleTheme />
        </MainMenu>
        <WelcomeScreen>
          <WelcomeScreen.Hints.ToolbarHint />
          <WelcomeScreen.Hints.HelpHint />
        </WelcomeScreen>
      </Excalidraw>
    </div>
  );
}
