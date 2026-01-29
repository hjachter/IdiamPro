'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { templates, type Template } from '@/lib/templates';
import type { Outline } from '@/types';

interface TemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateFromTemplate: (outline: Outline) => void;
}

export default function TemplatesDialog({
  open,
  onOpenChange,
  onCreateFromTemplate,
}: TemplatesDialogProps) {
  const handleSelectTemplate = (template: Template) => {
    onCreateFromTemplate(template.create());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Create from Template</DialogTitle>
          <DialogDescription>
            Choose a template to get started quickly with a pre-built outline structure.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto -webkit-overflow-scrolling-touch max-h-[60vh] pr-4" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pb-4">
            {templates.map(template => (
              <Card
                key={template.id}
                className="cursor-pointer transition-all duration-150 hover:border-primary/50 hover:shadow-md active:scale-[0.98]"
                onClick={() => handleSelectTemplate(template)}
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
            ))}
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Skip
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
