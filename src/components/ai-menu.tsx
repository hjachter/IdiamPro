'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Sparkles, FileText, Crown, Loader2, Brain, MessageSquare, Languages, WandSparkles, Wand2, Image as ImageIcon, LayoutGrid } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAI, useAIFeature } from '@/contexts/ai-context';
import AiGenerateDialog from './ai-generate-dialog';
import { fireDiscovery } from '@/hooks/use-discovery';

import type { AIDepth, AITone, AILevel } from '@/types';

interface AIMenuProps {
  onGenerateOutline: (topic: string, depth: AIDepth, tone: AITone, level: AILevel) => Promise<void>;
  outlineSummary?: string;
  isLoadingAI: boolean;
  disabled?: boolean;
  onOpenBulkResearch?: () => void;
  onOpenKnowledgeChat?: () => void;
  onOpenTranslate?: () => void;
  onOpenReformat?: () => void;
  onOpenTransformOutline?: () => void;
  onOpenImageToOutline?: () => void;
  onOpenApplications?: () => void;
  onAskAI?: () => void;
  hasSelectedNode?: boolean;
  selectedNodeName?: string;
}

export default function AIMenu({
  onGenerateOutline,
  outlineSummary,
  isLoadingAI,
  disabled,
  onOpenKnowledgeChat,
  onOpenTranslate,
  onOpenReformat,
  onOpenTransformOutline,
  onOpenImageToOutline,
  onOpenApplications,
  onAskAI,
  hasSelectedNode,
  selectedNodeName,
}: AIMenuProps) {
  const { isPremium } = useAI();
  const contentGenEnabled = useAIFeature('enableAIContentGeneration');
  const [menuOpen, setMenuOpen] = useState(false);

  // Check if any AI features are enabled
  const hasAnyFeature = contentGenEnabled;

  if (!hasAnyFeature) {
    return null;
  }

  const handleGenerate = async (topic: string, depth: AIDepth, tone: AITone, level: AILevel) => {
    setMenuOpen(false);
    await onGenerateOutline(topic, depth, tone, level);
  };

  return (
    <DropdownMenu
      open={menuOpen}
      onOpenChange={(next) => {
        setMenuOpen(next);
        if (next) fireDiscovery('smart-tools-menu-opened');
      }}
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                disabled={disabled || isLoadingAI}
                className="text-primary hover:bg-primary/20 active:scale-95 active:bg-accent/30"
                aria-label="Smart Tools menu"
              >
                {isLoadingAI ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Smart Tools</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            Smart Tools
          </span>
          <Badge variant={isPremium ? "default" : "secondary"} className="text-xs">
            {isPremium ? (
              <>
                <Crown className="h-3 w-3 mr-1" />
                Premium
              </>
            ) : (
              'Free'
            )}
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {onOpenApplications && (
          <>
            <DropdownMenuItem
              onSelect={() => {
                setMenuOpen(false);
                onOpenApplications?.();
              }}
              className="cursor-pointer"
            >
              <LayoutGrid className="mr-2 h-4 w-4 text-amber-500 dark:text-amber-400" />
              <span className="font-semibold">Wizards</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {onAskAI && (
          <DropdownMenuItem
            onSelect={() => onAskAI()}
            className="cursor-pointer"
          >
            <MessageSquare className="mr-2 h-4 w-4 text-primary" />
            <span className="font-medium">Quick Command</span>
            <span className="ml-auto text-xs tracking-widest text-muted-foreground">⌘K</span>
          </DropdownMenuItem>
        )}

        {onOpenReformat && hasSelectedNode && (
          <DropdownMenuItem onSelect={onOpenReformat} className="cursor-pointer">
            <WandSparkles className="mr-2 h-4 w-4 text-violet-500 dark:text-violet-400" />
            Reformat with AI…
          </DropdownMenuItem>
        )}

        {onOpenTransformOutline && (
          <DropdownMenuItem onSelect={onOpenTransformOutline} className="cursor-pointer">
            <Wand2 className="mr-2 h-4 w-4 text-fuchsia-500 dark:text-fuchsia-400" />
            Transform outline with AI…
          </DropdownMenuItem>
        )}

        {onOpenImageToOutline && hasSelectedNode && (
          <DropdownMenuItem onSelect={onOpenImageToOutline} className="cursor-pointer">
            <ImageIcon className="mr-2 h-4 w-4 text-sky-500 dark:text-sky-400" />
            Capture from image
          </DropdownMenuItem>
        )}

        {contentGenEnabled && (
          <AiGenerateDialog onGenerate={handleGenerate} isLoading={isLoadingAI} initialTopic={selectedNodeName}>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer">
              <FileText className="mr-2 h-4 w-4" />
              Generate Suboutline from Topic
            </DropdownMenuItem>
          </AiGenerateDialog>
        )}

        {onOpenTranslate && hasSelectedNode && (
          <DropdownMenuItem onSelect={onOpenTranslate} className="cursor-pointer">
            <Languages className="mr-2 h-4 w-4" />
            Translate this section
          </DropdownMenuItem>
        )}

        {onOpenKnowledgeChat && (
          <DropdownMenuItem onSelect={onOpenKnowledgeChat} className="cursor-pointer">
            <Brain className="mr-2 h-4 w-4" />
            Ask Your Outlines
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
