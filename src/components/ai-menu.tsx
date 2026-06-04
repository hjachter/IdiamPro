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
import { Sparkles, FileText, Crown, Loader2, Brain, RefreshCw, Mic, Languages } from 'lucide-react';
import { useAI, useAIFeature } from '@/contexts/ai-context';
import AiGenerateDialog from './ai-generate-dialog';

import type { AIDepth, AITone, AILevel } from '@/types';

interface AIMenuProps {
  onGenerateOutline: (topic: string, depth: AIDepth, tone: AITone, level: AILevel) => Promise<void>;
  outlineSummary?: string;
  isLoadingAI: boolean;
  disabled?: boolean;
  onOpenBulkResearch?: () => void;
  onOpenKnowledgeChat?: () => void;
  onOpenLiveBooks?: () => void;
  onOpenTranslate?: () => void;
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
  onOpenLiveBooks,
  onOpenTranslate,
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
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          disabled={disabled || isLoadingAI}
          className="text-primary hover:bg-primary/20 active:scale-95 active:bg-accent/30"
          title="Smart Tools"
          aria-label="Smart Tools menu"
        >
          {isLoadingAI ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
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

        {onAskAI && (
          <DropdownMenuItem
            onSelect={() => onAskAI()}
            className="cursor-pointer"
          >
            <Mic className="mr-2 h-4 w-4 text-red-500" />
            <span className="font-medium">Quick Command</span>
            <span className="ml-auto text-xs tracking-widest text-muted-foreground">⌘K</span>
          </DropdownMenuItem>
        )}

        {contentGenEnabled && (
          <AiGenerateDialog onGenerate={handleGenerate} isLoading={isLoadingAI} initialTopic={selectedNodeName}>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer">
              <FileText className="mr-2 h-4 w-4" />
              Generate Subtree from Topic
            </DropdownMenuItem>
          </AiGenerateDialog>
        )}

        {onOpenLiveBooks && hasSelectedNode && (
          <DropdownMenuItem onSelect={onOpenLiveBooks} className="cursor-pointer">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh from Web
          </DropdownMenuItem>
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
