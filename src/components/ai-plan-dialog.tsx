'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Zap } from 'lucide-react';
import { useAI } from '@/contexts/ai-context';
import type { SubscriptionPlan } from '@/types';

interface AIPlanDialogProps {
  children: React.ReactNode;
}

const PLAN_FEATURES = {
  FREE: [
    { name: 'AI Content Generation', included: true },
    { name: 'External Source Ingestion', included: true },
    { name: 'Standard AI Model', included: true },
    { name: 'Subtree Summaries', included: false },
    { name: 'Teach Mode', included: false },
    { name: 'Consistency Checks', included: false },
    { name: 'Priority Processing', included: false },
  ],
  PREMIUM: [
    { name: 'AI Content Generation', included: true },
    { name: 'External Source Ingestion', included: true },
    { name: 'Advanced AI Model', included: true },
    { name: 'Subtree Summaries', included: true },
    { name: 'Teach Mode', included: true },
    { name: 'Consistency Checks', included: true },
    { name: 'Priority Processing', included: true },
  ],
};

export default function AIPlanDialog({ children }: AIPlanDialogProps) {
  const { plan, switchPlan, isPremium } = useAI();
  const [open, setOpen] = useState(false);

  const handleSwitchPlan = (newPlan: SubscriptionPlan) => {
    switchPlan(newPlan);
    // In a real app, this would trigger a payment flow for upgrades
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            Manage AI Plan
          </DialogTitle>
          <DialogDescription>
            Choose the plan that best fits your needs. Upgrade for advanced AI capabilities.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          {/* FREE Plan */}
          <div
            className={`rounded-lg border-2 p-4 cursor-pointer transition-all ${
              plan === 'FREE'
                ? 'border-primary bg-primary/5'
                : 'border-muted hover:border-muted-foreground/50'
            }`}
            onClick={() => handleSwitchPlan('FREE')}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Free
              </h3>
              {plan === 'FREE' && (
                <Badge variant="secondary">Current</Badge>
              )}
            </div>
            <p className="text-2xl font-bold mb-4">$0<span className="text-sm font-normal text-muted-foreground">/month</span></p>
            <ul className="space-y-2 text-sm">
              {PLAN_FEATURES.FREE.map((feature) => (
                <li key={feature.name} className="flex items-center gap-2">
                  {feature.included ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <span className="h-4 w-4 text-muted-foreground">-</span>
                  )}
                  <span className={feature.included ? '' : 'text-muted-foreground'}>
                    {feature.name}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* PREMIUM Plan */}
          <div
            className={`rounded-lg border-2 p-4 cursor-pointer transition-all ${
              plan === 'PREMIUM'
                ? 'border-yellow-500 bg-yellow-500/5'
                : 'border-muted hover:border-yellow-500/50'
            }`}
            onClick={() => handleSwitchPlan('PREMIUM')}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Crown className="h-4 w-4 text-yellow-500" />
                Premium
              </h3>
              {plan === 'PREMIUM' && (
                <Badge className="bg-yellow-500 text-black">Current</Badge>
              )}
            </div>
            <p className="text-2xl font-bold mb-4">$9.99<span className="text-sm font-normal text-muted-foreground">/month</span></p>
            <ul className="space-y-2 text-sm">
              {PLAN_FEATURES.PREMIUM.map((feature) => (
                <li key={feature.name} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  {feature.name}
                </li>
              ))}
            </ul>
          </div>
        </div>

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
