'use client';

import React, { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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

interface MobileSidebarSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outlines: Outline[];
  currentOutlineId: string;
  onSelectOutline: (outlineId: string) => void;
  onCreateOutline: () => void;
  onCreateFromTemplate: (outline: Outline) => void;
  onDeleteOutline: (outlineId: string) => void;
  onOpenGuide: () => void;
}

export default function MobileSidebarSheet({
  open,
  onOpenChange,
  outlines,
  currentOutlineId,
  onSelectOutline,
  onCreateOutline,
  onCreateFromTemplate,
  onDeleteOutline,
  onOpenGuide,
}: MobileSidebarSheetProps) {
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
    onOpenChange(false);
  };

  const handleSelectOutline = (outlineId: string) => {
    onSelectOutline(outlineId);
    onOpenChange(false);
  };

  const handleOpenGuide = () => {
    onOpenGuide();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-xl p-0 flex flex-col">
        {/* Header with title */}
        <SheetHeader className="flex-shrink-0 px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle>IdiamPro</SheetTitle>
          </div>
        </SheetHeader>

        {/* Commands section - fixed at top */}
        <div className="flex-shrink-0 p-3 border-b space-y-2">
          {/* Quick actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 justify-center gap-2 h-10"
              onClick={() => {
                onCreateOutline();
                onOpenChange(false);
              }}
            >
              <Plus className="h-4 w-4" />
              New Outline
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 justify-center gap-2 h-10"
              onClick={handleOpenGuide}
            >
              <BookOpen className="h-4 w-4" />
              User Guide
            </Button>
          </div>

          {/* Templates Section (collapsible) */}
          <Collapsible open={templatesOpen} onOpenChange={setTemplatesOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-2 h-10 px-3">
                {templatesOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <LayoutTemplate className="h-4 w-4" />
                <span className="font-medium">Templates</span>
                <span className="ml-auto text-xs text-muted-foreground">{templates.length}</span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1">
              <div className="grid grid-cols-2 gap-2 px-1 max-h-48 overflow-y-auto">
                {templates.map(template => (
                  <div
                    key={template.id}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer hover:bg-muted active:bg-muted"
                    onClick={() => handleSelectTemplate(template)}
                  >
                    <span className="text-xl">{template.icon}</span>
                    <span className="text-sm truncate">{template.name}</span>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Outlines list header */}
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border-b bg-muted/50">
          <FileText className="h-4 w-4" />
          <span className="text-sm font-medium">Outlines</span>
          <span className="ml-auto text-xs text-muted-foreground">{userOutlines.length}</span>
        </div>

        {/* Scrollable outline list */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {/* User Guide */}
            {guide && (
              <div
                className={cn(
                  "group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
                  currentOutlineId === guide.id
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted active:bg-muted"
                )}
                onClick={() => handleSelectOutline(guide.id)}
              >
                <BookOpen className="h-5 w-5 shrink-0" />
                <span className="truncate italic">{guide.name}</span>
              </div>
            )}

            {/* User Outlines */}
            {sortedOutlines.map(outline => (
              <div
                key={outline.id}
                className={cn(
                  "group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
                  currentOutlineId === outline.id
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted active:bg-muted"
                )}
                onClick={() => handleSelectOutline(outline.id)}
              >
                <FileText className="h-5 w-5 shrink-0" />
                <span className="truncate flex-1">{outline.name}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteOutline(outline.id);
                        onOpenChange(false);
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
              <p className="text-sm text-muted-foreground px-3 py-2">
                No outlines yet. Create one or use a template.
              </p>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
