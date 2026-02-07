'use client';

import React from 'react';
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
import { Sparkles, FileText, Crown, Loader2, Library, Brain } from 'lucide-react';
import { useAI, useAIFeature } from '@/contexts/ai-context';
import AiGenerateDialog from './ai-generate-dialog';
import AIPlanDialog from './ai-plan-dialog';

interface AIMenuProps {
  onGenerateOutline: (topic: string) => Promise<void>;
  outlineSummary?: string;
  isLoadingAI: boolean;
  disabled?: boolean;
  onOpenBulkResearch?: () => void;
  onOpenKnowledgeChat?: () => void;
}

export default function AIMenu({
  onGenerateOutline,
  outlineSummary,
  isLoadingAI,
  disabled,
  onOpenBulkResearch,
  onOpenKnowledgeChat,
}: AIMenuProps) {
  const { isPremium } = useAI();
  const contentGenEnabled = useAIFeature('enableAIContentGeneration');

  // Check if any AI features are enabled
  const hasAnyFeature = contentGenEnabled;

  if (!hasAnyFeature) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          disabled={disabled || isLoadingAI}
          className="text-primary hover:bg-primary/20"
          title="AI Features"
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
            <Sparkles className="h-4 w-4 text-violet-400" />
            AI Features
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

        {contentGenEnabled && (
          <AiGenerateDialog onGenerate={onGenerateOutline} isLoading={isLoadingAI}>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer">
              <FileText className="mr-2 h-4 w-4" />
              Generate Outline from Topic
            </DropdownMenuItem>
          </AiGenerateDialog>
        )}

        {onOpenBulkResearch && (
          <DropdownMenuItem onSelect={onOpenBulkResearch} className="cursor-pointer">
            <Library className="mr-2 h-4 w-4" />
            Research & Import
          </DropdownMenuItem>
        )}

        {onOpenKnowledgeChat && (
          <DropdownMenuItem onSelect={onOpenKnowledgeChat} className="cursor-pointer">
            <Brain className="mr-2 h-4 w-4" />
            Knowledge Chat
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <AIPlanDialog>
          <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer">
            <Crown className="mr-2 h-4 w-4" />
            Manage AI Plan...
          </DropdownMenuItem>
        </AIPlanDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
