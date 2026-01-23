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

// Module-level cache to preserve data between remounts (same fix as SpreadsheetEditor)
const excalidrawDataCache = new Map<string, ExcalidrawData>();

interface ExcalidrawEditorProps {
  nodeId: string; // Used by cache to preserve data between remounts
  data: ExcalidrawData | null;
  onDataChange: (data: ExcalidrawData) => void;
  className?: string;
}

export default function ExcalidrawEditor({
  nodeId,
  data,
  onDataChange,
  className = '',
}: ExcalidrawEditorProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);
  const lastSavedJsonRef = useRef<string>('');
  const nodeIdRef = useRef(nodeId);
  const onDataChangeRef = useRef(onDataChange);

  // Keep refs updated
  useEffect(() => {
    nodeIdRef.current = nodeId;
    onDataChangeRef.current = onDataChange;
  }, [nodeId, onDataChange]);

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

      // Build save data
      const saveData: ExcalidrawData = {
        elements,
        appState: {
          viewBackgroundColor: appState.viewBackgroundColor,
          gridSize: appState.gridSize,
        },
        files,
        version: '1.0',
      };

      // Update cache FIRST (synchronous) so next mount sees latest data
      excalidrawDataCache.set(nodeIdRef.current, saveData);

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Debounce the React state update (async)
      saveTimeoutRef.current = setTimeout(() => {
        const json = JSON.stringify(saveData);
        if (json !== lastSavedJsonRef.current) {
          lastSavedJsonRef.current = json;
          onDataChangeRef.current(saveData);
        }
      }, 500);
    },
    []
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Get initial data - check cache first for fresh data (handles remount race condition)
  const cachedData = excalidrawDataCache.get(nodeId);
  const sourceData = cachedData || data;

  const initialData = sourceData ? {
    elements: sourceData.elements || [],
    appState: {
      ...sourceData.appState,
      theme: isDarkMode ? 'dark' as const : 'light' as const,
    },
    files: sourceData.files,
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
