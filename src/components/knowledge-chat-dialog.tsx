'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Brain, Send, User, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Outline } from '@/types';
import { serializeOutline, serializeOutlines } from '@/lib/outline-serializer';
import { isElectron, electronReadKnowledgeBase } from '@/lib/electron-storage';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

type ChatMode = 'current' | 'all';

interface KnowledgeChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outlines: Outline[];
  currentOutlineId: string;
}

export default function KnowledgeChatDialog({
  open,
  onOpenChange,
  outlines,
  currentOutlineId,
}: KnowledgeChatDialogProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Ask me anything about your outlines. I can find information, make connections, and answer questions based on your content.',
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<ChatMode>('current');
  const [context, setContext] = useState<string>('');
  const [contextMeta, setContextMeta] = useState<{
    outlineCount: number;
    nodeCount: number;
    estimatedTokens: number;
  }>({ outlineCount: 0, nodeCount: 0, estimatedTokens: 0 });
  const [contextLoading, setContextLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentOutline = outlines.find(o => o.id === currentOutlineId);

  // Build context when dialog opens or mode changes
  const buildContext = useCallback(async (chatMode: ChatMode) => {
    setContextLoading(true);
    try {
      if (chatMode === 'current') {
        if (!currentOutline) {
          setContext('');
          setContextMeta({ outlineCount: 0, nodeCount: 0, estimatedTokens: 0 });
          return;
        }
        const { text, nodeCount } = serializeOutline(currentOutline);
        setContext(text);
        setContextMeta({
          outlineCount: 1,
          nodeCount,
          estimatedTokens: Math.round(text.length / 4),
        });
      } else {
        // All outlines mode
        if (isElectron()) {
          // Electron: read pre-built knowledge base file
          const kbContent = await electronReadKnowledgeBase();
          if (kbContent) {
            setContext(kbContent);
            // Estimate metadata from content
            const outlineCount = (kbContent.match(/^# /gm) || []).length;
            setContextMeta({
              outlineCount,
              nodeCount: (kbContent.match(/^#{2,6} /gm) || []).length,
              estimatedTokens: Math.round(kbContent.length / 4),
            });
            return;
          }
        }
        // Web fallback: serialize all in-memory outlines
        const result = serializeOutlines(outlines);
        setContext(result.text);
        setContextMeta({
          outlineCount: result.outlineCount,
          nodeCount: result.nodeCount,
          estimatedTokens: result.estimatedTokens,
        });
      }
    } finally {
      setContextLoading(false);
    }
  }, [currentOutline, outlines]);

  // Build context when dialog opens
  useEffect(() => {
    if (open) {
      buildContext(mode);
    }
  }, [open, buildContext, mode]);

  // Focus input when dialog opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleModeChange = (newMode: ChatMode) => {
    setMode(newMode);
    // Context will rebuild via useEffect
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || !context) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/knowledge-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content,
          })),
          context,
          mode,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Knowledge chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your question. Please try again.',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isOverTokenLimit = contextMeta.estimatedTokens > 1_000_000;
  const isNearTokenLimit = contextMeta.estimatedTokens > 500_000;

  const formatTokenCount = (tokens: number) => {
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
    if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(0)}K`;
    return String(tokens);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[600px] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Brain className="h-6 w-6 text-blue-500" />
            </div>
            <div className="flex-1">
              <DialogTitle>Knowledge Chat</DialogTitle>
              <DialogDescription>
                Ask questions about your outlines
              </DialogDescription>
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="flex gap-1 mt-3 p-1 bg-muted/50 rounded-lg border border-border/50">
            <button
              onClick={() => handleModeChange('current')}
              className={cn(
                'flex-1 px-3 py-1.5 text-sm rounded-md transition-colors',
                mode === 'current'
                  ? 'bg-blue-500 text-white shadow-sm font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Current Outline
            </button>
            <button
              onClick={() => handleModeChange('all')}
              className={cn(
                'flex-1 px-3 py-1.5 text-sm rounded-md transition-colors',
                mode === 'all'
                  ? 'bg-blue-500 text-white shadow-sm font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              All Outlines
            </button>
          </div>

          {/* Context Info Bar */}
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            {contextLoading ? (
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading context...
              </span>
            ) : (
              <>
                <span>
                  {mode === 'current'
                    ? currentOutline?.name || 'No outline selected'
                    : `${contextMeta.outlineCount} outline${contextMeta.outlineCount !== 1 ? 's' : ''}`
                  }
                </span>
                <span className="text-border">|</span>
                <span>{contextMeta.nodeCount} nodes</span>
                <span className="text-border">|</span>
                <span className={cn(
                  isOverTokenLimit && 'text-destructive font-medium',
                  isNearTokenLimit && !isOverTokenLimit && 'text-yellow-600 dark:text-yellow-500',
                )}>
                  ~{formatTokenCount(contextMeta.estimatedTokens)} tokens
                </span>
                {isNearTokenLimit && !isOverTokenLimit && (
                  <AlertTriangle className="h-3 w-3 text-yellow-600 dark:text-yellow-500" />
                )}
              </>
            )}
          </div>
        </DialogHeader>

        {/* Token limit warning */}
        {isOverTokenLimit && (
          <div className="px-6 py-2 bg-destructive/10 text-destructive text-sm border-b">
            Context exceeds 1M tokens. Switch to Current Outline mode for better results.
          </div>
        )}

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex gap-3',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.role === 'assistant' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Brain className="h-4 w-4 text-blue-500" />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[80%] rounded-lg px-4 py-2',
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap select-text cursor-text">{message.content}</p>
                </div>
                {message.role === 'user' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                </div>
                <div className="bg-muted rounded-lg px-4 py-2">
                  <p className="text-sm text-muted-foreground">Thinking...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="px-6 py-4 border-t">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                mode === 'current'
                  ? 'Ask about this outline...'
                  : 'Ask about all your outlines...'
              }
              disabled={isLoading || isOverTokenLimit || !context}
              className="flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading || isOverTokenLimit || !context}
              size="icon"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Press Enter to send. Answers are based only on your outline content.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
