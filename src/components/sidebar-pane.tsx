'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  FileText,
  ChevronRight,
  ChevronDown,
  Plus,
  BookOpen,
  LayoutTemplate,
  Trash2,
  MoreHorizontal,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { templates, type Template } from '@/lib/templates';
import type { Outline } from '@/types';
import { cn } from '@/lib/utils';

interface SidebarPaneProps {
  outlines: Outline[];
  currentOutlineId: string;
  onSelectOutline: (outlineId: string) => void;
  onCreateOutline: () => void;
  onCreateFromTemplate: (outline: Outline) => void;
  onDeleteOutline: (outlineId: string) => void;
  onOpenGuide: () => void;
}

export default function SidebarPane({
  outlines,
  currentOutlineId,
  onSelectOutline,
  onCreateOutline,
  onCreateFromTemplate,
  onDeleteOutline,
  onOpenGuide,
}: SidebarPaneProps) {
  const [templatesOpen, setTemplatesOpen] = useState(false);

  // Separate guide from user outlines
  const guide = outlines.find(o => o.isGuide);
  const userOutlines = outlines.filter(o => !o.isGuide);

  // Sort user outlines by lastModified (most recent first)
  const sortedOutlines = [...userOutlines].sort((a, b) => {
    const aTime = a.lastModified || 0;
    const bTime = b.lastModified || 0;
    return bTime - aTime;
  });

  const handleSelectTemplate = (template: Template) => {
    onCreateFromTemplate(template.create());
    setTemplatesOpen(false);
  };

  return (
    <div className="h-full w-64 flex flex-col border-r bg-muted/30">
      {/* Header with commands */}
      <div className="flex-shrink-0 p-3 border-b space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm">IdiamPro</span>
        </div>

        {/* Quick actions at top */}
        <div className="space-y-1">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 h-8"
            onClick={onCreateOutline}
          >
            <Plus className="h-4 w-4" />
            New Outline
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 h-8"
            onClick={onOpenGuide}
          >
            <BookOpen className="h-4 w-4" />
            User Guide
          </Button>
        </div>

        {/* Templates Section (collapsible) */}
        <Collapsible open={templatesOpen} onOpenChange={setTemplatesOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-2 h-8 px-2">
              {templatesOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <LayoutTemplate className="h-4 w-4" />
              <span className="text-sm font-medium">Templates</span>
              <span className="ml-auto text-xs text-muted-foreground">{templates.length}</span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1">
            <div className="grid grid-cols-1 gap-1 max-h-48 overflow-y-auto">
              {templates.map(template => (
                <div
                  key={template.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm hover:bg-muted"
                  onClick={() => handleSelectTemplate(template)}
                >
                  <span className="text-base">{template.icon}</span>
                  <span className="truncate">{template.name}</span>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Outlines list header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/50">
        <FileText className="h-4 w-4" />
        <span className="text-sm font-medium">Outlines</span>
        <span className="ml-auto text-xs text-muted-foreground">{userOutlines.length}</span>
      </div>

      {/* Scrollable outline list at bottom */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {/* User Guide */}
          {guide && (
            <div
              className={cn(
                "group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm",
                currentOutlineId === guide.id
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-muted"
              )}
              onClick={() => onSelectOutline(guide.id)}
            >
              <BookOpen className="h-4 w-4 shrink-0" />
              <span className="truncate italic">{guide.name}</span>
            </div>
          )}

          {/* User Outlines */}
          {sortedOutlines.map(outline => (
            <div
              key={outline.id}
              className={cn(
                "group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm",
                currentOutlineId === outline.id
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-muted"
              )}
              onClick={() => onSelectOutline(outline.id)}
            >
              <FileText className="h-4 w-4 shrink-0" />
              <span className="truncate flex-1">{outline.name}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteOutline(outline.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}

          {userOutlines.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-2">
              No outlines yet. Create one or use a template.
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
