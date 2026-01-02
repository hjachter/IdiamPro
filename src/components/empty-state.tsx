'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { templates, type Template } from '@/lib/templates';
import type { Outline } from '@/types';
import { Plus, BookOpen, Sparkles } from 'lucide-react';

interface EmptyStateProps {
  onCreateBlankOutline: () => void;
  onCreateFromTemplate: (outline: Outline) => void;
  onOpenGuide: () => void;
}

export default function EmptyState({
  onCreateBlankOutline,
  onCreateFromTemplate,
  onOpenGuide,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 space-y-8 bg-background">
      {/* Welcome Header */}
      <div className="text-center space-y-3 max-w-md">
        <div className="flex items-center justify-center mb-4">
          <div className="p-3 rounded-2xl bg-primary/10">
            <Sparkles className="h-10 w-10 text-primary" />
          </div>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome to IdiamPro</h1>
        <p className="text-muted-foreground text-lg">
          Create structured outlines for your ideas, projects, and notes.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
        <Button
          variant="default"
          size="lg"
          className="flex-1 h-14 text-base"
          onClick={onCreateBlankOutline}
        >
          <Plus className="h-5 w-5 mr-2" />
          Start Blank
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="flex-1 h-14 text-base"
          onClick={onOpenGuide}
        >
          <BookOpen className="h-5 w-5 mr-2" />
          View Guide
        </Button>
      </div>

      {/* Templates Grid */}
      <div className="w-full max-w-3xl">
        <h2 className="text-lg font-semibold mb-4 text-center">Start from a Template</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {templates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              onSelect={() => onCreateFromTemplate(template.create())}
            />
          ))}
        </div>
      </div>

      {/* Keyboard Shortcut Hint */}
      <p className="text-sm text-muted-foreground">
        Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">⌘K</kbd> anytime for quick actions
      </p>
    </div>
  );
}

interface TemplateCardProps {
  template: Template;
  onSelect: () => void;
}

function TemplateCard({ template, onSelect }: TemplateCardProps) {
  return (
    <Card
      className="cursor-pointer transition-all duration-150 hover:border-primary/50 hover:shadow-md active:scale-[0.98]"
      onClick={onSelect}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{template.icon}</span>
          <CardTitle className="text-base">{template.name}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-sm line-clamp-2">
          {template.description}
        </CardDescription>
      </CardContent>
    </Card>
  );
}
