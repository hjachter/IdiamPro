'use client';

import type {
  SubscriptionPlan,
  AIFeatureFlags,
  NodeGenerationContext,
  ExternalSourceInput,
  IngestPreview,
} from '@/types';
import {
  generateOutlineAction,
  expandContentAction,
  generateContentForNodeAction,
  ingestExternalSourceAction,
} from '@/app/actions';

// Default feature flags for each plan
export const DEFAULT_FREE_FLAGS: AIFeatureFlags = {
  enableAIContentGeneration: true,
  enableIngestExternalSource: true,
  enableSubtreeSummaries: false,      // future - premium only
  enableTeachMode: false,             // future - premium only
  enableConsistencyChecks: false,     // future - premium only
};

export const DEFAULT_PREMIUM_FLAGS: AIFeatureFlags = {
  enableAIContentGeneration: true,
  enableIngestExternalSource: true,
  enableSubtreeSummaries: true,
  enableTeachMode: true,
  enableConsistencyChecks: true,
};

// AI configuration per plan
interface PlanConfig {
  modelHint: string;  // Hint for server-side model selection
  maxTokens: number;
  temperature: number;
}

const PLAN_CONFIGS: Record<SubscriptionPlan, PlanConfig> = {
  FREE: {
    modelHint: 'standard',
    maxTokens: 1000,
    temperature: 0.7,
  },
  PREMIUM: {
    modelHint: 'premium',
    maxTokens: 4000,
    temperature: 0.8,
  },
};

/**
 * Central AI Service
 * Routes all AI operations through plan-aware configuration
 */
export class AIService {
  private plan: SubscriptionPlan;
  private features: AIFeatureFlags;

  constructor(plan: SubscriptionPlan, features?: AIFeatureFlags) {
    this.plan = plan;
    this.features = features || (plan === 'PREMIUM' ? DEFAULT_PREMIUM_FLAGS : DEFAULT_FREE_FLAGS);
  }

  /**
   * Get current plan configuration
   */
  getPlanConfig(): PlanConfig {
    return PLAN_CONFIGS[this.plan];
  }

  /**
   * Check if a feature is enabled
   */
  isFeatureEnabled(feature: keyof AIFeatureFlags): boolean {
    return this.features[feature];
  }

  /**
   * Generate a complete outline from a topic
   */
  async generateOutline(topic: string): Promise<string> {
    if (!this.features.enableAIContentGeneration) {
      throw new Error('AI content generation is not enabled for your plan.');
    }
    return generateOutlineAction(topic, this.plan);
  }

  /**
   * Generate content for a specific node with full context
   */
  async generateContentForNode(context: NodeGenerationContext): Promise<string> {
    if (!this.features.enableAIContentGeneration) {
      throw new Error('AI content generation is not enabled for your plan.');
    }
    return generateContentForNodeAction(context, this.plan);
  }

  /**
   * Legacy: Expand content based on title only
   */
  async expandContent(title: string): Promise<string> {
    if (!this.features.enableAIContentGeneration) {
      throw new Error('AI content generation is not enabled for your plan.');
    }
    return expandContentAction(title, this.plan);
  }

  /**
   * Ingest external source and generate preview
   * Returns a preview of changes - does NOT apply them
   */
  async ingestExternalSource(
    source: ExternalSourceInput,
    existingOutlineSummary?: string
  ): Promise<IngestPreview> {
    if (!this.features.enableIngestExternalSource) {
      throw new Error('External source ingestion is not enabled for your plan.');
    }
    return ingestExternalSourceAction(source, existingOutlineSummary, this.plan);
  }
}

/**
 * Factory function to create AIService with current context
 */
export function createAIService(plan: SubscriptionPlan, features?: AIFeatureFlags): AIService {
  return new AIService(plan, features);
}
