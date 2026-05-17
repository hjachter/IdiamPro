'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { SubscriptionPlan, AIFeatureFlags, AIConfig } from '@/types';
import { AIService, DEFAULT_FREE_FLAGS, DEFAULT_PREMIUM_FLAGS } from '@/lib/ai-service';
import { canUseFeature, isEnforcementActive } from '@/lib/entitlements';

const AI_PLAN_STORAGE_KEY = 'outline-pro-ai-plan';

interface AIContextValue {
  plan: SubscriptionPlan;
  features: AIFeatureFlags;
  config: AIConfig;
  aiService: AIService;
  switchPlan: (newPlan: SubscriptionPlan) => void;
  toggleFeature: (feature: keyof AIFeatureFlags) => void;
  isPremium: boolean;
}

const AIContext = createContext<AIContextValue | null>(null);

interface AIProviderProps {
  children: React.ReactNode;
}

export function AIProvider({ children }: AIProviderProps) {
  const [plan, setPlan] = useState<SubscriptionPlan>('PREMIUM');
  const [features, setFeatures] = useState<AIFeatureFlags>(DEFAULT_PREMIUM_FLAGS);
  const [isInitialized, setIsInitialized] = useState(false);

  // Beta: Force PREMIUM plan for all users during beta testing
  // TODO: Re-enable localStorage plan loading when subscription billing is live
  useEffect(() => {
    try {
      // Ensure localStorage is set to PREMIUM for beta
      localStorage.setItem(AI_PLAN_STORAGE_KEY, 'PREMIUM');
    } catch (error) {
      console.error('Failed to save AI plan to storage:', error);
    }
    setIsInitialized(true);
  }, []);

  // Save plan to localStorage when it changes
  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(AI_PLAN_STORAGE_KEY, plan);
    } catch (error) {
      console.error('Failed to save AI plan to storage:', error);
    }
  }, [plan, isInitialized]);

  const switchPlan = useCallback((newPlan: SubscriptionPlan) => {
    setPlan(newPlan);
    // Reset features to defaults for the new plan (all paid plans get premium features)
    setFeatures(newPlan === 'FREE' ? DEFAULT_FREE_FLAGS : DEFAULT_PREMIUM_FLAGS);
  }, []);

  const toggleFeature = useCallback((feature: keyof AIFeatureFlags) => {
    setFeatures(current => ({
      ...current,
      [feature]: !current[feature],
    }));
  }, []);

  // Memoize the config object
  const config = useMemo<AIConfig>(() => ({
    plan,
    features,
  }), [plan, features]);

  // Memoize the AIService instance
  const aiService = useMemo(() => new AIService(plan, features), [plan, features]);

  // Phase 3: `isPremium` is now the real tier entitlement (premium AI
  // features = Pro+) instead of the ad-hoc local plan flag. SAFETY: when
  // enforcement is inactive (no auth/billing keys — the state today)
  // canUseFeature() is a no-op returning true, so this stays exactly as it
  // is now (the beta-forced PREMIUM plan keeps everything unlocked).
  const isPremium = useMemo(
    () => (isEnforcementActive() ? canUseFeature('premiumAIFeatures') : plan !== 'FREE'),
    [plan],
  );

  const value = useMemo<AIContextValue>(() => ({
    plan,
    features,
    config,
    aiService,
    switchPlan,
    toggleFeature,
    isPremium,
  }), [plan, features, config, aiService, switchPlan, toggleFeature, isPremium]);

  return (
    <AIContext.Provider value={value}>
      {children}
    </AIContext.Provider>
  );
}

export function useAI(): AIContextValue {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error('useAI must be used within an AIProvider');
  }
  return context;
}

// Convenience hook to check if a feature is enabled
export function useAIFeature(feature: keyof AIFeatureFlags): boolean {
  const { features } = useAI();
  return features[feature];
}
