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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Lock, ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Outline } from '@/types';
import { useAI } from '@/contexts/ai-context';
import { exportOutline } from '@/lib/export/index';
import { useToast } from '@/hooks/use-toast';

// ============================================
// WIZARD CONFIGURATION
// ============================================

// Website types
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
    features: ['Hero with CTA', 'Feature grid', 'Testimonials', 'FAQ section'],
  },
  {
    id: 'informational',
    name: 'Informational',
    description: 'Company info, about pages, corporate sites',
    icon: '🏢',
    isPremium: false,
    features: ['Clean hierarchy', 'Navigation menu', 'Contact section', 'Feature showcase'],
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
    features: ['Visual galleries', 'Project cards', 'Filterable grid', 'Process section'],
  },
  {
    id: 'event',
    name: 'Event',
    description: 'Conferences, webinars, meetups, launches',
    icon: '🎪',
    isPremium: true,
    features: ['Date/time display', 'Speaker cards', 'Schedule timeline', 'Registration CTA'],
  },
  {
    id: 'educational',
    name: 'Educational',
    description: 'Courses, tutorials, learning paths',
    icon: '🎓',
    isPremium: true,
    features: ['Curriculum outline', 'Learning outcomes', 'Module structure', 'Enroll CTA'],
  },
  {
    id: 'blog',
    name: 'Blog / News',
    description: 'Articles, updates, news feeds',
    icon: '📰',
    isPremium: true,
    features: ['Featured posts', 'Topic categories', 'Newsletter signup', 'Archive'],
  },
  {
    id: 'personal',
    name: 'Personal / Resume',
    description: 'CV, personal brand, about me pages',
    icon: '👤',
    isPremium: true,
    features: ['Bio section', 'Skills display', 'Experience timeline', 'Contact section'],
  },
];

// Content depth options
const CONTENT_DEPTHS = [
  {
    id: 'overview',
    name: 'Overview',
    description: 'Headlines and brief descriptions only',
    icon: '📋',
    detail: 'Best for landing pages and quick summaries',
  },
  {
    id: 'standard',
    name: 'Standard',
    description: 'Include section content and key details',
    icon: '📄',
    detail: 'Balanced detail for most websites',
  },
  {
    id: 'comprehensive',
    name: 'Comprehensive',
    description: 'Full content with all subsections',
    icon: '📖',
    detail: 'Complete information for in-depth sites',
  },
];

// Color themes - curated professional palettes
const COLOR_THEMES = [
  {
    id: 'ocean',
    name: 'Ocean Blue',
    description: 'Professional and trustworthy',
    primary: '#2563eb',
    secondary: '#0891b2',
    bg: '#ffffff',
    text: '#1e293b',
    preview: 'bg-gradient-to-r from-blue-600 to-cyan-600',
  },
  {
    id: 'violet',
    name: 'Modern Violet',
    description: 'Creative and innovative',
    primary: '#7c3aed',
    secondary: '#a855f7',
    bg: '#ffffff',
    text: '#1e293b',
    preview: 'bg-gradient-to-r from-violet-600 to-purple-600',
  },
  {
    id: 'emerald',
    name: 'Fresh Emerald',
    description: 'Growth and sustainability',
    primary: '#059669',
    secondary: '#10b981',
    bg: '#ffffff',
    text: '#1e293b',
    preview: 'bg-gradient-to-r from-emerald-600 to-green-500',
  },
  {
    id: 'coral',
    name: 'Warm Coral',
    description: 'Friendly and approachable',
    primary: '#f97316',
    secondary: '#fb923c',
    bg: '#ffffff',
    text: '#1e293b',
    preview: 'bg-gradient-to-r from-orange-500 to-amber-500',
  },
  {
    id: 'rose',
    name: 'Elegant Rose',
    description: 'Sophisticated and modern',
    primary: '#e11d48',
    secondary: '#f43f5e',
    bg: '#ffffff',
    text: '#1e293b',
    preview: 'bg-gradient-to-r from-rose-600 to-pink-500',
  },
  {
    id: 'slate',
    name: 'Professional Slate',
    description: 'Corporate and serious',
    primary: '#475569',
    secondary: '#64748b',
    bg: '#ffffff',
    text: '#0f172a',
    preview: 'bg-gradient-to-r from-slate-600 to-slate-500',
  },
  {
    id: 'midnight',
    name: 'Midnight Dark',
    description: 'Bold and dramatic',
    primary: '#6366f1',
    secondary: '#818cf8',
    bg: '#0f172a',
    text: '#f1f5f9',
    preview: 'bg-gradient-to-r from-indigo-600 to-violet-600',
  },
  {
    id: 'forest',
    name: 'Forest Night',
    description: 'Natural and calming',
    primary: '#22c55e',
    secondary: '#4ade80',
    bg: '#0f172a',
    text: '#f1f5f9',
    preview: 'bg-gradient-to-r from-green-600 to-emerald-500',
  },
];

// Tone/style options
const TONE_STYLES = [
  {
    id: 'professional',
    name: 'Professional',
    description: 'Corporate, formal, business-focused',
    icon: '💼',
    guidance: 'Use formal language, focus on credibility and expertise. Suitable for B2B and enterprise.',
  },
  {
    id: 'friendly',
    name: 'Friendly',
    description: 'Warm, approachable, conversational',
    icon: '😊',
    guidance: 'Use casual, welcoming language. Great for consumer products and community sites.',
  },
  {
    id: 'bold',
    name: 'Bold',
    description: 'Confident, impactful, attention-grabbing',
    icon: '⚡',
    guidance: 'Use strong statements, dynamic language. Perfect for startups and innovative products.',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean, focused, no-nonsense',
    icon: '✨',
    guidance: 'Use concise language, let the content breathe. Ideal for design-focused brands.',
  },
  {
    id: 'educational',
    name: 'Educational',
    description: 'Informative, helpful, guide-like',
    icon: '📚',
    guidance: 'Use clear explanations, step-by-step approach. Best for tutorials and learning content.',
  },
];

// Wizard steps
type WizardStep = 'type' | 'depth' | 'theme' | 'tone' | 'customize' | 'review';

const WIZARD_STEPS: { id: WizardStep; name: string; number: number }[] = [
  { id: 'type', name: 'Type', number: 1 },
  { id: 'depth', name: 'Detail', number: 2 },
  { id: 'theme', name: 'Theme', number: 3 },
  { id: 'tone', name: 'Style', number: 4 },
  { id: 'customize', name: 'Customize', number: 5 },
  { id: 'review', name: 'Review', number: 6 },
];

// ============================================
// COMPONENT
// ============================================

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

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>('type');

  // Selection state
  const [selectedType, setSelectedType] = useState<WebsiteType | null>(null);
  const [selectedDepth, setSelectedDepth] = useState<string>('standard');
  const [selectedTheme, setSelectedTheme] = useState<string>('ocean');
  const [selectedTone, setSelectedTone] = useState<string>('professional');

  // Customization state
  const [filename, setFilename] = useState('');
  const [ctaText, setCtaText] = useState('Get Started');
  const [customInstructions, setCustomInstructions] = useState('');

  // Export state
  const [isExporting, setIsExporting] = useState(false);

  const displayName = nodeName || (rootNodeId ? outline.nodes[rootNodeId]?.name : null) || outline.name;

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setCurrentStep('type');
      setSelectedType(null);
      setSelectedDepth('standard');
      setSelectedTheme('ocean');
      setSelectedTone('professional');
      setFilename(sanitizeFilename(displayName) + '.html');
      setCtaText('Get Started');
      setCustomInstructions('');
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

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 'type': return selectedType !== null;
      case 'depth': return selectedDepth !== '';
      case 'theme': return selectedTheme !== '';
      case 'tone': return selectedTone !== '';
      case 'customize': return filename.trim() !== '';
      case 'review': return true;
      default: return false;
    }
  };

  const goNext = () => {
    const currentIndex = WIZARD_STEPS.findIndex(s => s.id === currentStep);
    if (currentIndex < WIZARD_STEPS.length - 1) {
      setCurrentStep(WIZARD_STEPS[currentIndex + 1].id);
    }
  };

  const goBack = () => {
    const currentIndex = WIZARD_STEPS.findIndex(s => s.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(WIZARD_STEPS[currentIndex - 1].id);
    }
  };

  const handleExport = async () => {
    if (!selectedType || !filename.trim()) return;

    const theme = COLOR_THEMES.find(t => t.id === selectedTheme);
    const tone = TONE_STYLES.find(t => t.id === selectedTone);
    const depth = CONTENT_DEPTHS.find(d => d.id === selectedDepth);

    // Build comprehensive guidance from selections
    let fullGuidance = '';
    if (tone) {
      fullGuidance += `Tone: ${tone.name}. ${tone.guidance}\n\n`;
    }
    if (depth) {
      fullGuidance += `Content depth: ${depth.name} - ${depth.description}\n\n`;
    }
    if (customInstructions.trim()) {
      fullGuidance += `Custom instructions: ${customInstructions}\n`;
    }

    setIsExporting(true);
    try {
      await exportOutline('website', outline, rootNodeId, {
        includeContent: selectedDepth !== 'overview',
        title: displayName,
        websiteType: selectedType.id,
        colorScheme: theme?.bg === '#0f172a' ? 'dark' : 'light',
        colorTheme: {
          id: selectedTheme,
          primary: theme?.primary,
          secondary: theme?.secondary,
          bg: theme?.bg,
          text: theme?.text,
        },
        contentDepth: selectedDepth,
        toneStyle: selectedTone,
        ctaText,
        guidance: fullGuidance,
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

  const currentStepIndex = WIZARD_STEPS.findIndex(s => s.id === currentStep);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[750px] max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Progress Header */}
        <div className="px-6 pt-6 pb-4 border-b">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl">
              Generate Website
            </DialogTitle>
            <DialogDescription>
              Create a professional website from &quot;{displayName}&quot;
            </DialogDescription>
          </DialogHeader>

          {/* Step Progress */}
          <div className="flex items-center justify-between">
            {WIZARD_STEPS.map((step, index) => (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all',
                      index < currentStepIndex
                        ? 'bg-primary text-primary-foreground'
                        : index === currentStepIndex
                        ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {index < currentStepIndex ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      step.number
                    )}
                  </div>
                  <span className={cn(
                    'text-xs mt-1',
                    index <= currentStepIndex ? 'text-foreground' : 'text-muted-foreground'
                  )}>
                    {step.name}
                  </span>
                </div>
                {index < WIZARD_STEPS.length - 1 && (
                  <div
                    className={cn(
                      'flex-1 h-0.5 mx-2',
                      index < currentStepIndex ? 'bg-primary' : 'bg-muted'
                    )}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          {/* Step 1: Website Type */}
          {currentStep === 'type' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">What type of website do you want to create?</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {WEBSITE_TYPES.map((type) => (
                  <Card
                    key={type.id}
                    className={cn(
                      'cursor-pointer transition-all duration-150',
                      'hover:border-primary/50 hover:shadow-md active:scale-[0.98]',
                      selectedType?.id === type.id && 'border-primary ring-2 ring-primary/20',
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
                            {isPremium ? 'Premium' : (
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
                      <CardDescription className="text-sm">
                        {type.description}
                      </CardDescription>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Content Depth */}
          {currentStep === 'depth' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">How much detail should be included?</h3>
              <div className="grid grid-cols-1 gap-3">
                {CONTENT_DEPTHS.map((depth) => (
                  <Card
                    key={depth.id}
                    className={cn(
                      'cursor-pointer transition-all duration-150',
                      'hover:border-primary/50 hover:shadow-md',
                      selectedDepth === depth.id && 'border-primary ring-2 ring-primary/20'
                    )}
                    onClick={() => setSelectedDepth(depth.id)}
                  >
                    <CardContent className="p-4 flex items-center gap-4">
                      <span className="text-3xl">{depth.icon}</span>
                      <div className="flex-1">
                        <h4 className="font-medium">{depth.name}</h4>
                        <p className="text-sm text-muted-foreground">{depth.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">{depth.detail}</p>
                      </div>
                      {selectedDepth === depth.id && (
                        <Check className="h-5 w-5 text-primary" />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Color Theme */}
          {currentStep === 'theme' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Choose a color theme</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {COLOR_THEMES.map((theme) => (
                  <Card
                    key={theme.id}
                    className={cn(
                      'cursor-pointer transition-all duration-150 overflow-hidden',
                      'hover:border-primary/50 hover:shadow-md',
                      selectedTheme === theme.id && 'border-primary ring-2 ring-primary/20'
                    )}
                    onClick={() => setSelectedTheme(theme.id)}
                  >
                    <div className={cn('h-16', theme.preview)} />
                    <CardContent className="p-3">
                      <h4 className="font-medium text-sm">{theme.name}</h4>
                      <p className="text-xs text-muted-foreground">{theme.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Tone/Style */}
          {currentStep === 'tone' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">What tone should the website have?</h3>
              <div className="grid grid-cols-1 gap-3">
                {TONE_STYLES.map((tone) => (
                  <Card
                    key={tone.id}
                    className={cn(
                      'cursor-pointer transition-all duration-150',
                      'hover:border-primary/50 hover:shadow-md',
                      selectedTone === tone.id && 'border-primary ring-2 ring-primary/20'
                    )}
                    onClick={() => setSelectedTone(tone.id)}
                  >
                    <CardContent className="p-4 flex items-center gap-4">
                      <span className="text-3xl">{tone.icon}</span>
                      <div className="flex-1">
                        <h4 className="font-medium">{tone.name}</h4>
                        <p className="text-sm text-muted-foreground">{tone.description}</p>
                      </div>
                      {selectedTone === tone.id && (
                        <Check className="h-5 w-5 text-primary" />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Step 5: Customize */}
          {currentStep === 'customize' && (
            <div className="space-y-6">
              <h3 className="font-semibold text-lg">Final customizations</h3>

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

              {/* CTA Button Text */}
              <div className="grid gap-2">
                <Label htmlFor="cta-text">Call-to-Action Button Text</Label>
                <Input
                  id="cta-text"
                  value={ctaText}
                  onChange={(e) => setCtaText(e.target.value)}
                  placeholder="Get Started"
                />
                <p className="text-xs text-muted-foreground">
                  The text shown on primary action buttons
                </p>
              </div>

              {/* Custom Instructions */}
              <div className="grid gap-2">
                <Label htmlFor="custom-instructions" className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Custom Instructions
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  id="custom-instructions"
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="Add any specific instructions to customize your website...

Examples:
• Target audience is small business owners
• Emphasize the security and reliability features
• Use a more casual, conversational tone
• Feature the pricing section prominently
• Include a FAQ about getting started"
                  className="min-h-[140px] resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Provide additional guidance to customize how your website is generated
                </p>
              </div>
            </div>
          )}

          {/* Step 6: Review */}
          {currentStep === 'review' && (
            <div className="space-y-6">
              <h3 className="font-semibold text-lg">Review your website settings</h3>

              <div className="bg-muted/50 rounded-lg p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-muted-foreground">Website Type</span>
                    <p className="font-medium flex items-center gap-2">
                      <span>{selectedType?.icon}</span>
                      {selectedType?.name}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Content Depth</span>
                    <p className="font-medium">
                      {CONTENT_DEPTHS.find(d => d.id === selectedDepth)?.name}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Color Theme</span>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'w-4 h-4 rounded',
                        COLOR_THEMES.find(t => t.id === selectedTheme)?.preview
                      )} />
                      <p className="font-medium">
                        {COLOR_THEMES.find(t => t.id === selectedTheme)?.name}
                      </p>
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Tone</span>
                    <p className="font-medium">
                      {TONE_STYLES.find(t => t.id === selectedTone)?.name}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">CTA Text</span>
                    <p className="font-medium">{ctaText}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Filename</span>
                    <p className="font-medium">{filename}</p>
                  </div>
                </div>

                {customInstructions && (
                  <div className="pt-2 border-t">
                    <span className="text-sm text-muted-foreground">Custom Instructions</span>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{customInstructions}</p>
                  </div>
                )}
              </div>

              {/* What you'll get */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  What you&apos;ll get
                </h4>
                <ul className="text-sm space-y-2">
                  {selectedType?.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      {feature}
                    </li>
                  ))}
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    Responsive design (mobile-friendly)
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    Self-contained HTML (no dependencies)
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer with Navigation */}
        <DialogFooter className="px-6 py-4 border-t bg-muted/30">
          <div className="flex w-full justify-between">
            <Button
              variant="outline"
              onClick={currentStep === 'type' ? () => onOpenChange(false) : goBack}
            >
              {currentStep === 'type' ? 'Cancel' : (
                <>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </>
              )}
            </Button>

            {currentStep === 'review' ? (
              <Button onClick={handleExport} disabled={isExporting}>
                {isExporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Website
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={goNext} disabled={!canProceed()}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
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
