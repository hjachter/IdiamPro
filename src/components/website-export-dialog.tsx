'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Lock, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Outline } from '@/types';
import { useAI } from '@/contexts/ai-context';
import { exportOutline } from '@/lib/export/index';
import { useToast } from '@/hooks/use-toast';

// Website type definitions
export interface WebsiteType {
  id: string;
  name: string;
  description: string;
  icon: string;
  isPremium: boolean;
  features: string[];
}

export const WEBSITE_TYPES: WebsiteType[] = [
  {
    id: 'marketing',
    name: 'Marketing',
    description: 'Product launches, landing pages, promotional campaigns',
    icon: '🚀',
    isPremium: false,
    features: ['Hero with CTA', 'Feature grid', 'Pricing tables', 'Testimonials'],
  },
  {
    id: 'informational',
    name: 'Informational',
    description: 'Company info, about pages, corporate sites',
    icon: '🏢',
    isPremium: false,
    features: ['Clean hierarchy', 'Navigation menu', 'Contact section', 'About sections'],
  },
  {
    id: 'documentation',
    name: 'Documentation',
    description: 'User guides, API docs, reference materials',
    icon: '📚',
    isPremium: false,
    features: ['Sidebar navigation', 'Table of contents', 'Code blocks', 'Search-friendly'],
  },
  {
    id: 'portfolio',
    name: 'Portfolio',
    description: 'Work samples, case studies, creative showcases',
    icon: '🎨',
    isPremium: true,
    features: ['Visual galleries', 'Project cards', 'Filterable grid', 'Lightbox views'],
  },
  {
    id: 'event',
    name: 'Event',
    description: 'Conferences, webinars, meetups, launches',
    icon: '🎪',
    isPremium: true,
    features: ['Date/time display', 'Speaker cards', 'Schedule/agenda', 'Registration CTA'],
  },
  {
    id: 'educational',
    name: 'Educational',
    description: 'Courses, tutorials, learning paths',
    icon: '🎓',
    isPremium: true,
    features: ['Module structure', 'Lesson cards', 'Progress indicators', 'Quiz sections'],
  },
  {
    id: 'blog',
    name: 'Blog / News',
    description: 'Articles, updates, news feeds',
    icon: '📰',
    isPremium: true,
    features: ['Featured posts', 'Category navigation', 'Author info', 'Date stamps'],
  },
  {
    id: 'personal',
    name: 'Personal / Resume',
    description: 'CV, personal brand, about me pages',
    icon: '👤',
    isPremium: true,
    features: ['Bio section', 'Skills display', 'Experience timeline', 'Contact form'],
  },
];

// Color scheme options
const COLOR_SCHEMES = [
  { id: 'auto', name: 'Auto (System)', description: 'Adapts to user preference' },
  { id: 'light', name: 'Light', description: 'Light background, dark text' },
  { id: 'dark', name: 'Dark', description: 'Dark background, light text' },
];

interface WebsiteExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outline: Outline;
  rootNodeId?: string;
  nodeName?: string;
}

export default function WebsiteExportDialog({
  open,
  onOpenChange,
  outline,
  rootNodeId,
  nodeName,
}: WebsiteExportDialogProps) {
  const { toast } = useToast();
  const { isPremium } = useAI();

  // Selection state
  const [selectedType, setSelectedType] = useState<WebsiteType | null>(null);

  // Options state
  const [filename, setFilename] = useState('');
  const [colorScheme, setColorScheme] = useState('auto');
  const [ctaText, setCtaText] = useState('Get Started');
  const [guidance, setGuidance] = useState('');

  // Export state
  const [isExporting, setIsExporting] = useState(false);

  const displayName = nodeName || (rootNodeId ? outline.nodes[rootNodeId]?.name : null) || outline.name;

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedType(null);
      setFilename(sanitizeFilename(displayName) + '.html');
      setColorScheme('auto');
      setCtaText('Get Started');
      setGuidance('');
    }
  }, [open, displayName]);

  const handleSelectType = (type: WebsiteType) => {
    if (type.isPremium && !isPremium) {
      toast({
        title: 'Premium Feature',
        description: `The ${type.name} template is available on Premium plans.`,
        variant: 'destructive',
      });
      return;
    }
    setSelectedType(type);
  };

  const handleBack = () => {
    setSelectedType(null);
  };

  const handleExport = async () => {
    if (!selectedType || !filename.trim()) return;

    setIsExporting(true);
    try {
      await exportOutline('website', outline, rootNodeId, {
        includeContent: true,
        title: displayName,
        // Pass website-specific options through metadata
        // The exporter will read these from options
        websiteType: selectedType.id,
        colorScheme,
        ctaText,
        guidance,
      } as any);

      toast({
        title: 'Website Exported',
        description: `Your ${selectedType.name} website has been exported.`,
      });
      onOpenChange(false);
    } catch (error: any) {
      console.error('Export failed:', error);
      toast({
        title: 'Export Failed',
        description: error.message || 'An error occurred during export',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {selectedType && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 mr-1"
                onClick={handleBack}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {selectedType ? `${selectedType.icon} ${selectedType.name} Website` : 'Export as Website'}
          </DialogTitle>
          <DialogDescription>
            {selectedType
              ? `Configure your ${selectedType.name.toLowerCase()} website export`
              : `Choose a website type for "${displayName}"`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {!selectedType ? (
            // Type Selection Grid
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-4">
              {WEBSITE_TYPES.map((type) => (
                <Card
                  key={type.id}
                  className={cn(
                    'cursor-pointer transition-all duration-150',
                    'hover:border-primary/50 hover:shadow-md active:scale-[0.98]',
                    type.isPremium && !isPremium && 'opacity-60'
                  )}
                  onClick={() => handleSelectType(type)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{type.icon}</span>
                        <CardTitle className="text-base">{type.name}</CardTitle>
                      </div>
                      {type.isPremium && (
                        <Badge variant={isPremium ? 'secondary' : 'outline'} className="text-xs">
                          {isPremium ? (
                            'Premium'
                          ) : (
                            <span className="flex items-center gap-1">
                              <Lock className="h-3 w-3" />
                              Premium
                            </span>
                          )}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <CardDescription className="text-sm mb-2">
                      {type.description}
                    </CardDescription>
                    <div className="flex flex-wrap gap-1">
                      {type.features.slice(0, 3).map((feature) => (
                        <Badge key={feature} variant="secondary" className="text-xs font-normal">
                          {feature}
                        </Badge>
                      ))}
                      {type.features.length > 3 && (
                        <Badge variant="secondary" className="text-xs font-normal">
                          +{type.features.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            // Options Panel
            <div className="space-y-4 py-4">
              {/* Filename */}
              <div className="grid gap-2">
                <Label htmlFor="website-filename">Filename</Label>
                <Input
                  id="website-filename"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  placeholder="my-website.html"
                />
              </div>

              {/* Color Scheme */}
              <div className="grid gap-2">
                <Label htmlFor="color-scheme">Color Scheme</Label>
                <Select value={colorScheme} onValueChange={setColorScheme}>
                  <SelectTrigger id="color-scheme">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLOR_SCHEMES.map((scheme) => (
                      <SelectItem key={scheme.id} value={scheme.id}>
                        <div className="flex flex-col">
                          <span>{scheme.name}</span>
                          <span className="text-xs text-muted-foreground">{scheme.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* CTA Button Text (for marketing/promotional types) */}
              {['marketing', 'event', 'educational'].includes(selectedType.id) && (
                <div className="grid gap-2">
                  <Label htmlFor="cta-text">Call-to-Action Button Text</Label>
                  <Input
                    id="cta-text"
                    value={ctaText}
                    onChange={(e) => setCtaText(e.target.value)}
                    placeholder="Get Started"
                  />
                </div>
              )}

              {/* Guidance / Tone */}
              <div className="grid gap-2">
                <Label htmlFor="guidance">
                  Style Guidance <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  id="guidance"
                  value={guidance}
                  onChange={(e) => setGuidance(e.target.value)}
                  placeholder="e.g., Professional tone, target audience is enterprise buyers, emphasize security features..."
                  className="min-h-[80px] resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Describe the tone, target audience, or emphasis for the generated website.
                </p>
              </div>

              {/* Preview info */}
              <div className="bg-muted/50 rounded-lg p-4 mt-4">
                <h4 className="font-medium mb-2">What you&apos;ll get:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {selectedType.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <span className="text-primary">✓</span>
                      {feature}
                    </li>
                  ))}
                  <li className="flex items-center gap-2">
                    <span className="text-primary">✓</span>
                    Responsive design (mobile-friendly)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-primary">✓</span>
                    Self-contained HTML (no dependencies)
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {selectedType && (
            <Button onClick={handleExport} disabled={!filename.trim() || isExporting}>
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                'Export Website'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 100);
}
