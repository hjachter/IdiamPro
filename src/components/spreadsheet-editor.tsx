'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Workbook, WorkbookInstance, Sheet } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';

// Default empty sheet for new spreadsheets
const DEFAULT_SHEET: Sheet = {
  name: 'Sheet1',
  celldata: [],
  order: 0,
  row: 50,
  column: 26,
  config: {},
  status: 1,
};

export interface SpreadsheetData {
  sheets: Sheet[];
  version?: string;
}

interface SpreadsheetEditorProps {
  data: SpreadsheetData | null;
  onChange: (data: SpreadsheetData) => void;
  className?: string;
  readOnly?: boolean;
}

export default function SpreadsheetEditor({
  data,
  onChange,
  className = '',
  readOnly = false,
}: SpreadsheetEditorProps) {
  const workbookRef = useRef<WorkbookInstance | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Initialize with data or default sheet
  const initialData: Sheet[] = data?.sheets?.length
    ? data.sheets
    : [{ ...DEFAULT_SHEET }];

  // Handle changes with debouncing
  const handleChange = useCallback((sheets: Sheet[]) => {
    if (readOnly) return;

    // Debounce saves to avoid excessive updates
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      onChange({
        sheets,
        version: '1.0',
      });
    }, 500); // 500ms debounce
  }, [onChange, readOnly]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Mark as ready after mount
  useEffect(() => {
    setIsReady(true);
  }, []);

  if (!isReady) {
    return (
      <div className={`w-full h-full min-h-[400px] flex items-center justify-center ${className}`}>
        <div className="text-muted-foreground">Loading spreadsheet...</div>
      </div>
    );
  }

  return (
    <div className={`w-full h-full min-h-[400px] ${className}`}>
      <Workbook
        ref={workbookRef}
        data={initialData}
        onChange={handleChange}
        allowEdit={!readOnly}
        showToolbar={!readOnly}
        showFormulaBar={!readOnly}
        showSheetTabs={true}
        lang="en"
        hooks={{
          // Additional hooks can be added here for more control
        }}
      />
    </div>
  );
}
