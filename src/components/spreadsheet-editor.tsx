'use client';

import React, { useCallback, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Workbook, WorkbookInstance } from '@fortune-sheet/react';
import { Sheet, Cell } from '@fortune-sheet/core';
import '@fortune-sheet/react/dist/index.css';

// Module-level cache to preserve data between remounts
// This solves the timing issue where unmount save races with new component mount
const spreadsheetDataCache = new Map<string, SpreadsheetData>();

// Default empty sheet for new spreadsheets
const DEFAULT_SHEET: Sheet = {
  name: 'Sheet1',
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
  nodeId?: string; // Used to detect node changes and reload data
}

// Convert sparse celldata format to dense data format
function celldataToData(celldata: Array<{r: number; c: number; v: Cell | null}> | undefined, rows: number, cols: number): (Cell | null)[][] {
  const data: (Cell | null)[][] = [];
  for (let r = 0; r < rows; r++) {
    data[r] = new Array(cols).fill(null);
  }
  if (celldata) {
    for (const cell of celldata) {
      if (cell.r < rows && cell.c < cols) {
        data[cell.r][cell.c] = cell.v;
      }
    }
  }
  return data;
}

// Convert dense data format to sparse celldata format
function dataToCelldata(data: (Cell | null)[][] | undefined): Array<{r: number; c: number; v: Cell}> {
  const celldata: Array<{r: number; c: number; v: Cell}> = [];
  if (!data) return celldata;
  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (cell !== null && cell !== undefined) {
        celldata.push({ r, c, v: cell });
      }
    }
  }
  return celldata;
}

export default function SpreadsheetEditor({
  data,
  onChange,
  className = '',
  readOnly = false,
  nodeId = 'default',
}: SpreadsheetEditorProps) {
  const workbookRef = useRef<WorkbookInstance>(null);
  const onChangeRef = useRef(onChange);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedJsonRef = useRef<string>('');
  const nodeIdRef = useRef(nodeId);

  // Keep refs up to date
  useEffect(() => {
    onChangeRef.current = onChange;
    nodeIdRef.current = nodeId;
  }, [onChange, nodeId]);

  // Initialize with data from cache (if available) or props or default sheet
  // The cache preserves data that was saved during unmount but hasn't propagated yet
  const initialData: Sheet[] = (() => {
    // First check if there's cached data for this node
    const cachedData = spreadsheetDataCache.get(nodeId);
    const propsData = data;

    // Determine which data source to use
    // Prefer cache if it has data and props don't, or if cache was more recently updated
    let sourceData: SpreadsheetData | null = null;
    if (cachedData?.sheets?.[0]?.celldata?.length) {
      // Cache has cell data
      const propsHasCells = propsData?.sheets?.[0]?.celldata?.length || propsData?.sheets?.[0]?.data?.flat().some(c => c !== null);
      if (!propsHasCells) {
        // Props don't have cells, use cache
        sourceData = cachedData;
      } else {
        // Both have data, use props (it's from the persisted store)
        sourceData = propsData;
      }
    } else {
      // No cache, use props
      sourceData = propsData;
    }

    if (!sourceData?.sheets?.length) {
      return [{ ...DEFAULT_SHEET }];
    }
    // Ensure sheets have data in the right format
    return sourceData.sheets.map(sheet => {
      // If sheet has celldata but no data, convert it
      if (sheet.celldata && (!sheet.data || sheet.data.length === 0)) {
        const rows = sheet.row || 50;
        const cols = sheet.column || 26;
        return {
          ...sheet,
          data: celldataToData(sheet.celldata, rows, cols),
        };
      }
      return sheet;
    });
  })();

  // Save function that uses workbook's getSheet API to get actual data
  const saveData = useCallback(() => {
    if (readOnly || !workbookRef.current) return;

    try {
      // Use getSheet() API which returns the sheet with celldata already populated
      const currentSheet = workbookRef.current.getSheet();

      if (!currentSheet || !currentSheet.celldata || currentSheet.celldata.length === 0) {
        return;
      }

      // Build the save data with both celldata and data formats
      const rows = currentSheet.row || 50;
      const cols = currentSheet.column || 26;

      // Convert celldata to proper format (ensure v is a Cell object)
      const normalizedCelldata = currentSheet.celldata.map(cell => ({
        r: cell.r,
        c: cell.c,
        v: typeof cell.v === 'object' ? cell.v as Cell : { v: cell.v, m: String(cell.v) },
      }));

      const saveData: SpreadsheetData = {
        sheets: [{
          name: currentSheet.name || 'Sheet1',
          order: currentSheet.order || 0,
          row: rows,
          column: cols,
          config: currentSheet.config || {},
          status: currentSheet.status || 1,
          celldata: normalizedCelldata,
          data: celldataToData(normalizedCelldata, rows, cols),
        }],
        version: '1.0',
      };

      const json = JSON.stringify(saveData);

      // Only save if data actually changed
      if (json !== lastSavedJsonRef.current) {
        lastSavedJsonRef.current = json;
        // Update cache FIRST (synchronous) so next mount sees latest data
        spreadsheetDataCache.set(nodeIdRef.current, saveData);
        // Then trigger React state update (asynchronous)
        onChangeRef.current(saveData);
      }
    } catch (error) {
      console.error('[SpreadsheetEditor] Error saving:', error);
    }
  }, [readOnly]);

  // Handle changes - debounce saves
  const handleChange = useCallback(() => {
    if (readOnly) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save to avoid too many saves
    saveTimeoutRef.current = setTimeout(() => {
      saveData();
    }, 500);
  }, [readOnly, saveData]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // Final save on unmount
      saveData();
    };
  }, [saveData]);

  return (
    <div className={`w-full h-full ${className}`}>
      <Workbook
        ref={workbookRef}
        data={initialData}
        onChange={handleChange}
        allowEdit={!readOnly}
        showToolbar={!readOnly}
        showFormulaBar={!readOnly}
        showSheetTabs={true}
        lang="en"
      />
    </div>
  );
}
