'use client';

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot } from 'lucide-react';
import type { AIDepth } from '@/types';
import { AI_DEPTH_CONFIG } from '@/types';

interface AiGenerateDialogProps {
  children: React.ReactNode;
  onGenerate: (topic: string, depth: AIDepth) => Promise<void>;
  isLoading: boolean;
}

export default function AiGenerateDialog({ children, onGenerate, isLoading }: AiGenerateDialogProps) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState('');
  const [depth, setDepth] = useState<AIDepth>('standard');

  // Load default depth from localStorage when dialog opens
  useEffect(() => {
    if (open) {
      const savedDepth = localStorage.getItem('aiDepth') as AIDepth | null;
      if (savedDepth) {
        setDepth(savedDepth);
      }
    }
  }, [open]);

  const handleSubmit = async () => {
    if (topic.trim()) {
      await onGenerate(topic, depth);
      setOpen(false);
      setTopic('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Bot /> Generate Outline from Topic</DialogTitle>
          <DialogDescription>
            Enter a topic, and AI will generate a structured outline for you. This will create a new outline.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="topic" className="text-right">
              Topic
            </Label>
            <Input
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="col-span-3"
              placeholder="e.g., The History of Ancient Rome"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">
              Depth
            </Label>
            <Select value={depth} onValueChange={(v) => setDepth(v as AIDepth)}>
              <SelectTrigger className="col-span-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(AI_DEPTH_CONFIG) as AIDepth[]).map((d) => (
                  <SelectItem key={d} value={d}>
                    <div className="flex items-center gap-2">
                      <span>{AI_DEPTH_CONFIG[d].icon}</span>
                      <span>{AI_DEPTH_CONFIG[d].label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground text-right">
            {AI_DEPTH_CONFIG[depth].description}
          </p>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSubmit} disabled={isLoading || !topic.trim()}>
            {isLoading ? (
              depth === 'deep' ? 'Thinking deeply...' : 'Generating...'
            ) : (
              'Generate'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
