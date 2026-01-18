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
    <div className="flex flex-col items-center justify-center h-full p-6 space-y-8 bg-gradient-to-b from-background to-muted/20">
      {/* Welcome Header */}
      <div className="text-center space-y-4 max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-center mb-4">
          <div className="p-4 rounded-2xl bg-primary/10 shadow-lg shadow-primary/5">
            <Sparkles className="h-12 w-12 text-primary" />
          </div>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome to IdiamPro</h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          Create structured outlines for your ideas, projects, and notes.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
        <Button
          variant="default"
          size="lg"
          className="flex-1 h-14 text-base shadow-md hover:shadow-lg transition-all duration-200"
          onClick={onCreateBlankOutline}
        >
          <Plus className="h-5 w-5 mr-2" />
          Start Blank
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="flex-1 h-14 text-base hover:bg-muted/50 transition-all duration-200"
          onClick={onOpenGuide}
        >
          <BookOpen className="h-5 w-5 mr-2" />
          View Guide
        </Button>
      </div>

      {/* Templates Grid */}
      <div className="w-full max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-4 text-center">Start from a Template</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {templates.map((template, index) => (
            <TemplateCard
              key={template.id}
              template={template}
              onSelect={() => onCreateFromTemplate(template.create())}
              index={index}
            />
          ))}
        </div>
      </div>

      {/* Keyboard Shortcut Hint */}
      <p className="text-sm text-muted-foreground/70 animate-in fade-in duration-500 delay-300">
        Press <kbd className="px-2 py-1 bg-muted/80 border border-border/50 rounded-md text-xs font-mono shadow-sm">⌘K</kbd> anytime for quick actions
      </p>
    </div>
  );
}

interface TemplateCardProps {
  template: Template;
  onSelect: () => void;
  index?: number;
}

function TemplateCard({ template, onSelect, index = 0 }: TemplateCardProps) {
  return (
    <Card
      className="cursor-pointer transition-all duration-200 hover:border-primary/40 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] active:shadow-md bg-card/80 backdrop-blur-sm"
      onClick={onSelect}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{template.icon}</span>
          <CardTitle className="text-base font-medium">{template.name}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-sm line-clamp-2 leading-relaxed">
          {template.description}
        </CardDescription>
      </CardContent>
    </Card>
  );
}
