'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import {
  Plus,
  FileText,
  Search,
  FolderClosed,
  FolderOpen,
  Copy,
  Trash2,
  Download,
  Upload,
  BookOpen,
  ChevronRight,
  RefreshCw,
  Maximize,
  Keyboard,
  Library,
  LayoutTemplate,
} from 'lucide-react';
import type { Outline } from '@/types';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outlines: Outline[];
  currentOutlineId: string;
  selectedNodeId: string | null;
  onSelectOutline: (outlineId: string) => void;
  onCreateOutline: () => void;
  onCreateNode: () => void;
  onDuplicateNode?: (nodeId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  onOpenSearch: () => void;
  onExportOutline?: () => void;
  onImportOutline?: () => void;
  onRefreshGuide?: () => void;
  onToggleFocusMode?: () => void;
  onShowShortcuts?: () => void;
  onOpenBulkResearch?: () => void;
  onOpenTemplates?: () => void;
  isGuide: boolean;
  isFocusMode?: boolean;
}

export default function CommandPalette({
  open,
  onOpenChange,
  outlines,
  currentOutlineId,
  selectedNodeId,
  onSelectOutline,
  onCreateOutline,
  onCreateNode,
  onDuplicateNode,
  onDeleteNode,
  onCollapseAll,
  onExpandAll,
  onOpenSearch,
  onExportOutline,
  onImportOutline,
  onRefreshGuide,
  onToggleFocusMode,
  onShowShortcuts,
  onOpenBulkResearch,
  onOpenTemplates,
  isGuide,
  isFocusMode,
}: CommandPaletteProps) {
  const [searchValue, setSearchValue] = useState('');

  // Reset search when dialog closes
  useEffect(() => {
    if (!open) {
      setSearchValue('');
    }
  }, [open]);

  // Execute a command and close the palette
  const runCommand = useCallback((callback: () => void) => {
    onOpenChange(false);
    // Small delay to allow dialog to close smoothly
    setTimeout(callback, 50);
  }, [onOpenChange]);

  // Get other outlines (not the current one)
  const otherOutlines = useMemo(() => {
    return outlines.filter(o => o.id !== currentOutlineId);
  }, [outlines, currentOutlineId]);

  // Get current outline name
  // const currentOutline = useMemo(() => {
  //   return outlines.find(o => o.id === currentOutlineId);
  // }, [outlines, currentOutlineId]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Type a command or search..."
        value={searchValue}
        onValueChange={setSearchValue}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Quick Actions */}
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => runCommand(onCreateNode)}>
            <Plus className="mr-2 h-4 w-4" />
            <span>New Node</span>
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(onCreateOutline)}>
            <FileText className="mr-2 h-4 w-4" />
            <span>New Outline</span>
          </CommandItem>
          {onOpenTemplates && (
            <CommandItem onSelect={() => runCommand(onOpenTemplates)}>
              <LayoutTemplate className="mr-2 h-4 w-4" />
              <span>New from Template</span>
            </CommandItem>
          )}
          {selectedNodeId && onDuplicateNode && !isGuide && (
            <CommandItem onSelect={() => runCommand(() => onDuplicateNode(selectedNodeId))}>
              <Copy className="mr-2 h-4 w-4" />
              <span>Duplicate Node</span>
              <CommandShortcut>⌘D</CommandShortcut>
            </CommandItem>
          )}
          {selectedNodeId && onDeleteNode && !isGuide && (
            <CommandItem onSelect={() => runCommand(() => onDeleteNode(selectedNodeId))}>
              <Trash2 className="mr-2 h-4 w-4" />
              <span>Delete Node</span>
              <CommandShortcut>⌫</CommandShortcut>
            </CommandItem>
          )}
        </CommandGroup>

        <CommandSeparator />

        {/* View */}
        <CommandGroup heading="View">
          <CommandItem onSelect={() => runCommand(onOpenSearch)}>
            <Search className="mr-2 h-4 w-4" />
            <span>Search Outline</span>
            <CommandShortcut>⌃F</CommandShortcut>
          </CommandItem>
          {onToggleFocusMode && (
            <CommandItem onSelect={() => runCommand(onToggleFocusMode)}>
              <Maximize className="mr-2 h-4 w-4" />
              <span>{isFocusMode ? 'Exit Focus Mode' : 'Focus Mode'}</span>
              <CommandShortcut>⌘⇧F</CommandShortcut>
            </CommandItem>
          )}
          <CommandItem onSelect={() => runCommand(onCollapseAll)}>
            <FolderClosed className="mr-2 h-4 w-4" />
            <span>Collapse All</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(onExpandAll)}>
            <FolderOpen className="mr-2 h-4 w-4" />
            <span>Expand All</span>
          </CommandItem>
          {onShowShortcuts && (
            <CommandItem onSelect={() => runCommand(onShowShortcuts)}>
              <Keyboard className="mr-2 h-4 w-4" />
              <span>Keyboard Shortcuts</span>
              <CommandShortcut>?</CommandShortcut>
            </CommandItem>
          )}
        </CommandGroup>

        <CommandSeparator />

        {/* Outline Operations */}
        <CommandGroup heading="Outline">
          {onExportOutline && (
            <CommandItem onSelect={() => runCommand(onExportOutline)}>
              <Download className="mr-2 h-4 w-4" />
              <span>Export Current Outline</span>
            </CommandItem>
          )}
          {onImportOutline && (
            <CommandItem onSelect={() => runCommand(onImportOutline)}>
              <Upload className="mr-2 h-4 w-4" />
              <span>Import Outline</span>
            </CommandItem>
          )}
          {onOpenBulkResearch && (
            <CommandItem onSelect={() => runCommand(onOpenBulkResearch)}>
              <Library className="mr-2 h-4 w-4" />
              <span>Bulk Research Import (PREMIUM)</span>
            </CommandItem>
          )}
          {onRefreshGuide && (
            <CommandItem onSelect={() => runCommand(onRefreshGuide)}>
              <RefreshCw className="mr-2 h-4 w-4" />
              <span>Refresh User Guide</span>
            </CommandItem>
          )}
        </CommandGroup>

        {/* Switch to Outline */}
        {otherOutlines.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Switch to Outline">
              {otherOutlines.map(outline => (
                <CommandItem
                  key={outline.id}
                  onSelect={() => runCommand(() => onSelectOutline(outline.id))}
                >
                  {outline.isGuide ? (
                    <BookOpen className="mr-2 h-4 w-4" />
                  ) : (
                    <ChevronRight className="mr-2 h-4 w-4" />
                  )}
                  <span className={outline.isGuide ? 'italic' : ''}>
                    {outline.name}
                  </span>
                  {outline.isGuide && (
                    <span className="ml-2 text-xs text-muted-foreground">(Guide)</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
