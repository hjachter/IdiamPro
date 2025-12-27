'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bot } from 'lucide-react';

interface AiGenerateDialogProps {
  children: React.ReactNode;
  onGenerate: (topic: string) => Promise<void>;
  isLoading: boolean;
}

export default function AiGenerateDialog({ children, onGenerate, isLoading }: AiGenerateDialogProps) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState('');

  const handleSubmit = async () => {
    if (topic.trim()) {
      await onGenerate(topic);
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
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSubmit} disabled={isLoading || !topic.trim()}>
            {isLoading ? 'Generating...' : 'Generate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
