'use client';

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Keyboard } from 'lucide-react';

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string[]; description: string }[];
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: 'General',
    shortcuts: [
      { keys: ['⌘', 'K'], description: 'Open command palette' },
      { keys: ['⌃', 'F'], description: 'Search outline' },
      { keys: ['⌘', '⇧', 'F'], description: 'Toggle focus mode' },
      { keys: ['Esc'], description: 'Exit focus mode' },
      { keys: ['?'], description: 'Show keyboard shortcuts' },
    ],
  },
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['↑', '↓'], description: 'Navigate between nodes' },
      { keys: ['←', '→'], description: 'Collapse/expand node' },
      { keys: ['Enter'], description: 'Edit selected node' },
    ],
  },
  {
    title: 'Editing',
    shortcuts: [
      { keys: ['⌘', 'N'], description: 'New node (sibling)' },
      { keys: ['⌘', 'D'], description: 'Duplicate node' },
      { keys: ['⌫'], description: 'Delete node' },
      { keys: ['Tab'], description: 'Indent node' },
      { keys: ['⇧', 'Tab'], description: 'Outdent node' },
    ],
  },
  {
    title: 'Clipboard',
    shortcuts: [
      { keys: ['⌘', 'C'], description: 'Copy subtree' },
      { keys: ['⌘', 'X'], description: 'Cut subtree' },
      { keys: ['⌘', 'V'], description: 'Paste subtree' },
    ],
  },
  {
    title: 'Text Formatting',
    shortcuts: [
      { keys: ['⌘', 'B'], description: 'Bold' },
      { keys: ['⌘', 'I'], description: 'Italic' },
      { keys: ['⌘', 'Z'], description: 'Undo' },
      { keys: ['⌘', '⇧', 'Z'], description: 'Redo' },
    ],
  },
];

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Quick reference for all available keyboard shortcuts
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          {shortcutGroups.map((group) => (
            <div key={group.title}>
              <h3 className="font-semibold text-sm text-muted-foreground mb-3">
                {group.title}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-foreground">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <kbd
                          key={keyIndex}
                          className="px-2 py-1 bg-muted rounded text-xs font-mono min-w-[24px] text-center"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t text-center text-sm text-muted-foreground">
          Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">?</kbd> anytime to show this dialog
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Hook to manage keyboard shortcuts dialog
export function useKeyboardShortcuts() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Show shortcuts on ? key (Shift + /)
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
        e.preventDefault();
        setIsOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { isOpen, setIsOpen };
}
