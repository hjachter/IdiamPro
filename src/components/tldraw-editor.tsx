'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { Tldraw, useEditor, TLEditorSnapshot } from 'tldraw';
import 'tldraw/tldraw.css';

interface TldrawEditorProps {
  snapshot: TLEditorSnapshot | null;
  onSnapshotChange: (snapshot: TLEditorSnapshot) => void;
  className?: string;
}

// Inner component that has access to the editor
function TldrawEditorInner({
  snapshot,
  onSnapshotChange,
}: {
  snapshot: TLEditorSnapshot | null;
  onSnapshotChange: (snapshot: TLEditorSnapshot) => void;
}) {
  const editor = useEditor();
  const isInitializedRef = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load snapshot on mount
  useEffect(() => {
    if (!editor || isInitializedRef.current) return;

    if (snapshot) {
      try {
        editor.loadSnapshot(snapshot);
      } catch (error) {
        console.error('Failed to load canvas snapshot:', error);
      }
    }
    isInitializedRef.current = true;
  }, [editor, snapshot]);

  // Auto-save on changes with debouncing
  useEffect(() => {
    if (!editor) return;

    const handleChange = () => {
      // Debounce saves to avoid excessive updates
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        try {
          const currentSnapshot = editor.getSnapshot();
          onSnapshotChange(currentSnapshot);
        } catch (error) {
          console.error('Failed to save canvas snapshot:', error);
        }
      }, 500); // 500ms debounce
    };

    // Listen for store changes
    const unsubscribe = editor.store.listen(handleChange, {
      source: 'user',
      scope: 'document',
    });

    return () => {
      unsubscribe();
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [editor, onSnapshotChange]);

  return null;
}

export default function TldrawEditor({
  snapshot,
  onSnapshotChange,
  className = '',
}: TldrawEditorProps) {
  const handleMount = useCallback((editor: any) => {
    // Optional: Configure editor on mount
    // editor.updateInstanceState({ isDebugMode: false });
  }, []);

  return (
    <div className={`w-full h-full min-h-[500px] ${className}`}>
      <Tldraw
        inferDarkMode
        autoFocus
        onMount={handleMount}
      >
        <TldrawEditorInner
          snapshot={snapshot}
          onSnapshotChange={onSnapshotChange}
        />
      </Tldraw>
    </div>
  );
}
