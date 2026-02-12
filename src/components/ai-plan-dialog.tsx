'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Zap, Star, GraduationCap } from 'lucide-react';
import { useAI } from '@/contexts/ai-context';
import type { SubscriptionPlan } from '@/types';
import { ScrollArea } from "@/components/ui/scroll-area";

interface AIPlanDialogProps {
  children: React.ReactNode;
}

const PLANS: {
  id: SubscriptionPlan;
  name: string;
  price: string;
  period?: string;
  description: string;
  icon: React.ReactNode;
  features: string[];
  highlighted?: boolean;
  badge?: string;
}[] = [
  {
    id: 'FREE',
    name: 'Free',
    price: '$0',
    description: 'For personal use and exploration',
    icon: <Zap className="h-4 w-4" />,
    features: [
      '3 outlines',
      'All core features',
      '10 AI generations/month',
      '3-source research imports',
      'Basic export formats'
    ]
  },
  {
    id: 'BASIC',
    name: 'Basic',
    price: '$9.99',
    period: '/month',
    description: 'For regular knowledge workers',
    icon: <Star className="h-4 w-4 text-blue-500" />,
    features: [
      'Unlimited outlines',
      '50 AI generations/month',
      '20-source research imports',
      'All export formats',
      'Email support'
    ]
  },
  {
    id: 'PREMIUM',
    name: 'Premium',
    price: '$29.99',
    period: '/month',
    description: 'For power users and professionals',
    icon: <Crown className="h-4 w-4 text-yellow-500" />,
    features: [
      'Everything in Basic',
      '100 AI generations/month',
      '50+ source research imports',
      'Claude & GPT-4 access',
      'AI image generation',
      'Podcast generation',
      'Priority support'
    ],
    highlighted: true,
    badge: 'Most Popular'
  },
  {
    id: 'ACADEMIC',
    name: 'Academic',
    price: '$49.99',
    period: '/month',
    description: 'For researchers and PhD students',
    icon: <GraduationCap className="h-4 w-4 text-indigo-500" />,
    features: [
      'Everything in Premium',
      'Unlimited AI operations',
      'Claude Opus access',
      'Advanced reasoning',
      'Citation management',
      'Dedicated support'
    ]
  }
];

export default function AIPlanDialog({ children }: AIPlanDialogProps) {
  const { plan, switchPlan } = useAI();
  const [open, setOpen] = useState(false);

  const handleSwitchPlan = (newPlan: SubscriptionPlan) => {
    switchPlan(newPlan);
    // In a real app, this would trigger a payment flow for upgrades
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            Manage Subscription Plan
          </DialogTitle>
          <DialogDescription>
            Choose the plan that best fits your needs. Upgrade for advanced AI capabilities.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 py-4 pr-4">
            {PLANS.map((p) => (
              <div
                key={p.id}
                className={`rounded-lg border-2 p-4 cursor-pointer transition-all ${
                  plan === p.id
                    ? p.highlighted
                      ? 'border-yellow-500 bg-yellow-500/5'
                      : 'border-primary bg-primary/5'
                    : p.highlighted
                      ? 'border-yellow-500/30 hover:border-yellow-500/50'
                      : 'border-muted hover:border-muted-foreground/50'
                }`}
                onClick={() => handleSwitchPlan(p.id)}
              >
                {p.badge && (
                  <Badge className="mb-2 bg-yellow-500 text-black text-xs">{p.badge}</Badge>
                )}
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-base flex items-center gap-2">
                    {p.icon}
                    {p.name}
                  </h3>
                  {plan === p.id && (
                    <Badge variant="secondary" className="text-xs">Current</Badge>
                  )}
                </div>
                <p className="text-xl font-bold mb-1">
                  {p.price}
                  {p.period && <span className="text-xs font-normal text-muted-foreground">{p.period}</span>}
                </p>
                <p className="text-xs text-muted-foreground mb-3">{p.description}</p>
                <ul className="space-y-1.5 text-xs">
                  {p.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-1.5">
                      <Check className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Simulation Mode</p>
          <p>
            This is a demo environment. Click on a plan to simulate switching.
            In production, this would connect to a payment processor.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
