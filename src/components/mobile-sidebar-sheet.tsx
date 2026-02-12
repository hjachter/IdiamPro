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
  Search,
  X,
  Rocket,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
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
  onShowWelcome: () => void;
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
  onShowWelcome,
}: MobileSidebarSheetProps) {
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [outlineSearch, setOutlineSearch] = useState('');

  // Separate guide from user outlines
  const guide = outlines.find(o => o.isGuide);
  const userOutlines = outlines.filter(o => !o.isGuide);

  // Sort user outlines alphabetically by name (case-insensitive)
  const sortedOutlines = [...userOutlines].sort((a, b) => {
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  // Filter outlines by search query
  const searchLower = outlineSearch.toLowerCase();
  const filteredOutlines = sortedOutlines.filter(o =>
    outlineSearch === '' || o.name.toLowerCase().includes(searchLower)
  );
  const showGuide = !outlineSearch || (guide?.name.toLowerCase().includes(searchLower) ?? false);

  const handleSelectTemplate = (template: Template) => {
    onCreateFromTemplate(template.create());
    onOpenChange(false);
  };

  const handleSelectOutline = (outlineId: string) => {
    onSelectOutline(outlineId);
    setOutlineSearch('');
    onOpenChange(false);
  };

  const handleOpenGuide = () => {
    onOpenGuide();
    onOpenChange(false);
  };

  const handleShowWelcome = () => {
    onShowWelcome();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-xl p-0 flex flex-col elevation-3">
        {/* Header with title */}
        <SheetHeader className="flex-shrink-0 px-4 py-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <SheetTitle className="font-semibold tracking-tight">IdiamPro</SheetTitle>
          </div>
        </SheetHeader>

        {/* Commands section - fixed at top */}
        <div className="flex-shrink-0 p-3 border-b border-border/60 space-y-3">
          {/* Quick actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 justify-center gap-2 h-11 font-medium shadow-sm hover:shadow transition-all duration-150"
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
              className="flex-1 justify-center gap-2 h-11 text-muted-foreground hover:text-foreground transition-colors duration-150"
              onClick={handleOpenGuide}
            >
              <BookOpen className="h-4 w-4" />
              User Guide
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 justify-center gap-2 h-11 text-muted-foreground hover:text-foreground transition-colors duration-150"
              onClick={handleShowWelcome}
            >
              <Rocket className="h-4 w-4" />
              Welcome
            </Button>
          </div>

          {/* Templates Section (collapsible) */}
          <Collapsible open={templatesOpen} onOpenChange={setTemplatesOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-2 h-10 px-3 text-muted-foreground hover:text-foreground transition-colors duration-150">
                <span className="transition-transform duration-200" style={{ transform: templatesOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                  <ChevronRight className="h-4 w-4" />
                </span>
                <LayoutTemplate className="h-4 w-4" />
                <span className="font-medium">Templates</span>
                <span className="ml-auto text-xs text-muted-foreground/70">{templates.length}</span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1 animate-in slide-in-from-top-1 duration-200">
              <div className="grid grid-cols-2 gap-1.5 px-1 max-h-48 overflow-y-auto">
                {templates.map(template => (
                  <div
                    key={template.id}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150 hover:bg-muted/80 active:bg-muted active:scale-[0.98]"
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
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border-b border-border/40 bg-muted/30">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Outlines</span>
          <span className="ml-auto text-xs text-muted-foreground/70 tabular-nums">
            {outlineSearch ? `${filteredOutlines.length} / ${userOutlines.length}` : userOutlines.length}
          </span>
        </div>

        {/* Search input */}
        <div className="flex-shrink-0 px-3 py-2 border-b border-border/40">
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={outlineSearch}
              onChange={(e) => setOutlineSearch(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="Search outlines..."
              className="h-10 pl-8 pr-8 text-sm bg-muted/40 border-border/50"
            />
            {outlineSearch && (
              <button
                onClick={() => setOutlineSearch('')}
                className="absolute right-2.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable outline list */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {/* User Guide */}
            {guide && showGuide && (
              <div
                className={cn(
                  "group flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer transition-all duration-150",
                  currentOutlineId === guide.id
                    ? "bg-primary/10 text-primary border-l-2 border-primary -ml-0.5 pl-[calc(0.75rem+2px)]"
                    : "hover:bg-muted/60 active:bg-muted"
                )}
                onClick={() => handleSelectOutline(guide.id)}
              >
                <BookOpen className="h-5 w-5 shrink-0" />
                <span className="truncate italic font-medium">{guide.name}</span>
              </div>
            )}

            {/* User Outlines */}
            {filteredOutlines.map(outline => (
              <div
                key={outline.id}
                className={cn(
                  "group flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer transition-all duration-150",
                  currentOutlineId === outline.id
                    ? "bg-primary/10 text-primary font-medium border-l-2 border-primary -ml-0.5 pl-[calc(0.75rem+2px)]"
                    : "hover:bg-muted/60 active:bg-muted"
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
                      className="h-8 w-8 shrink-0 opacity-70"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="elevation-2">
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

            {outlineSearch && filteredOutlines.length === 0 && !showGuide && (
              <p className="text-sm text-muted-foreground px-3 py-4 text-center">
                No outlines match &ldquo;{outlineSearch}&rdquo;
              </p>
            )}

            {!outlineSearch && userOutlines.length === 0 && (
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
