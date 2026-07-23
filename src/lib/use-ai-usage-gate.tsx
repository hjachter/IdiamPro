'use client';

/**
 * useAIUsageGate — single entry point every AI call site uses to gate AND
 * count user-initiated AI actions for the launch tier model (#33).
 *
 * Why a hook (vs. a plain function): the gate shows a soft-warn toast (at
 * 80%), a hard-block dialog (at 100%), and a Pro-only upgrade dialog. All
 * three are React-y. Call sites that already have access to the toast +
 * upgrade-prompt providers wrap their AI call in a single
 *
 *   const { gate } = useAIUsageGate();
 *   const ok = await gate({ feature: 'helpChat' });
 *   if (!ok) return; // gate already showed the right UX
 *   await doTheActualAICall();
 *
 * One generation = one user-initiated AI action. The gate is called ONCE
 * per user action (e.g. one help-chat Q&A round-trip, one LIVE BOOKS apply
 * of any number of nodes). It increments after a successful gate check.
 *
 * Exemptions (counter is bypassed and gate always allows):
 *   - the user has any BYOK key configured (free-byok, pro+BYOK, etc.)
 *   - the user picked the local Ollama provider (aiProvider === 'local')
 *
 * Fail-open: if anything in the gate itself throws (storage corruption,
 * etc.), the gate ALLOWS — better to occasionally over-serve than to lock
 * paying users out. The Pro-only check still applies regardless.
 */

import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useUpgradePrompt } from '@/components/upgrade-prompt';
import {
  getCurrentTier,
  getTierCap,
  getTierDisplayName,
  hasAnyByokKey,
  isProOnlyFeature,
  type LaunchTierId,
  type ProOnlyFeature,
} from '@/lib/tier-detection';
import {
  getCurrentMonthKey,
  getDaysUntilReset,
  getUsage,
  incrementUsage,
} from '@/lib/ai-usage-counter';

/** Feature key supplied by call sites — used for analytics + the Pro check. */
export type AIFeatureKey =
  | 'helpChat'
  | 'knowledgeChat'
  | 'liveBooks'
  | 'translate'
  | 'reformat'
  | 'transformOutline'
  | 'summarizeOutline'
  | 'exportEmail'
  | 'importEmail'
  | 'distillVoiceProfile'
  | 'tellAI'
  | 'bulkResearch'
  | 'aiMenu'
  | 'createContentForDescendants'
  | 'generateOutline'
  | 'expandContent'
  | 'podcastGeneration'
  | 'imageGeneration'
  | 'imageToOutline'
  | 'youtubePackage'
  | 'videoGeneration'
  | 'recordingTranscription'
  | 'wizardRun';

export interface AIGateOptions {
  /** Which feature is being invoked — used for the Pro-only check + toast. */
  feature: AIFeatureKey;
  /**
   * Optional label for the soft-warn toast. Default: friendly auto-text.
   */
  label?: string;
}

interface AIUsageGateHook {
  /**
   * Run the gate. Returns true → caller proceeds with the AI call; false →
   * gate showed the right UX (hard-block or Pro-only dialog) and caller
   * MUST NOT proceed. Auto-increments the counter on a true result for
   * non-exempt tiers.
   */
  gate: (opts: AIGateOptions) => boolean;
  /** Convenience: read the current tier + usage state. */
  readState: () => {
    tier: LaunchTierId;
    cap: number;
    used: number;
    isExempt: boolean;
  };
}

/** True if the request is exempt from counting (BYOK or local Ollama). */
function isExempt(): boolean {
  if (typeof window === 'undefined') return false;
  if (hasAnyByokKey()) return true;
  try {
    if (window.localStorage.getItem('aiProvider') === 'local') return true;
  } catch {
    /* fall through */
  }
  return false;
}

/** Conversational human-facing copy for the warn / block UX. */
function softWarnCopy(used: number, cap: number, tier: LaunchTierId) {
  if (tier === 'free-trial') {
    return {
      title: 'Running low on trial generations',
      description: `You've used ${used} of ${cap} free trial generations. Add a free API key in Settings to keep going, or upgrade for more.`,
    };
  }
  return {
    title: 'Running low on AI generations',
    description: `You've used ${used} of ${cap} this month. Switch to your own API key in Settings to bypass the cap, or upgrade your plan.`,
  };
}

function hardBlockReason(
  used: number,
  cap: number,
  tier: LaunchTierId,
): string {
  if (tier === 'free-trial') {
    return `You've used all ${cap} of your free trial AI generations. Add a free API key in Settings — Gemini takes about a minute and stays free — or upgrade to keep going.`;
  }
  const days = getDaysUntilReset();
  return `You've used all ${cap} AI generations for this month. Your counter resets in ${days} day${days === 1 ? '' : 's'}. Or switch to your own API key in Settings to bypass the cap entirely.`;
}

function proOnlyReason(feature: ProOnlyFeature): string {
  if (feature === 'podcastGeneration') {
    return 'Podcast generation is a Pro feature — $9.99/mo unlocks unlimited podcast scripts plus image generation, 1,000 AI generations a month, and priority support.';
  }
  if (feature === 'videoGeneration') {
    return 'Video generation is a Pro feature — $9.99/mo unlocks narrated slideshow videos plus podcast scripts and image generation, 1,000 AI generations a month, and priority support.';
  }
  return 'Image generation is a Pro feature — $9.99/mo unlocks unlimited image generation plus podcast scripts, 1,000 AI generations a month, and priority support.';
}

export function useAIUsageGate(): AIUsageGateHook {
  const { toast } = useToast();
  const { promptUpgrade } = useUpgradePrompt();

  const readState = useCallback(() => {
    const tier = getCurrentTier();
    return {
      tier,
      cap: getTierCap(tier),
      used: getUsage().count,
      isExempt: isExempt(),
    };
  }, []);

  const gate = useCallback(
    (opts: AIGateOptions): boolean => {
      try {
        const tier = getCurrentTier();

        // Pro-only feature on a lower tier: show upgrade dialog, block.
        if (isProOnlyFeature(opts.feature) && tier !== 'pro') {
          promptUpgrade({
            requiredTier: 'pro',
            title: 'This is a Pro feature',
            reason: proOnlyReason(opts.feature as ProOnlyFeature),
          });
          return false;
        }

        // Exempt path: BYOK or local Ollama — never count, never block.
        if (isExempt()) return true;

        const cap = getTierCap(tier);
        if (!Number.isFinite(cap)) return true; // unlimited tier

        const before = getUsage().count;

        // Hard block at 100%.
        if (before >= cap) {
          promptUpgrade({
            requiredTier: 'pro',
            title:
              tier === 'free-trial'
                ? 'Free trial used up'
                : 'Monthly AI cap reached',
            reason: hardBlockReason(before, cap, tier),
          });
          return false;
        }

        // Increment first, then check the soft-warn threshold against the
        // new count (so the warn fires on the call that crosses 80%).
        const after = incrementUsage().count;
        const threshold = Math.floor(cap * 0.8);
        if (after >= threshold && before < threshold) {
          const { title, description } = softWarnCopy(after, cap, tier);
          toast({ title, description, duration: 8000 });
        }
        return true;
      } catch {
        // Fail-open: if the gate itself throws, allow the call. Better to
        // occasionally over-serve than to lock paying users out.
        return true;
      }
    },
    [promptUpgrade, toast],
  );

  return { gate, readState };
}

/**
 * Headless variant for call sites that don't have a React context handy
 * (e.g. context-menu actions called from outside a Provider). Same logic
 * minus the toast/dialog UX — returns a structured decision the caller
 * can route however they want. Most call sites should use the hook.
 */
export interface HeadlessGateDecision {
  allowed: boolean;
  reason: 'pro-only' | 'hard-block' | 'soft-warn-crossed' | 'ok' | 'exempt';
  tier: LaunchTierId;
  used: number;
  cap: number;
}

export function gateHeadless(opts: AIGateOptions): HeadlessGateDecision {
  const tier = getCurrentTier();
  const cap = getTierCap(tier);
  if (isProOnlyFeature(opts.feature) && tier !== 'pro') {
    return { allowed: false, reason: 'pro-only', tier, used: getUsage().count, cap };
  }
  if (isExempt() || !Number.isFinite(cap)) {
    return { allowed: true, reason: 'exempt', tier, used: getUsage().count, cap };
  }
  const before = getUsage().count;
  if (before >= cap) {
    return { allowed: false, reason: 'hard-block', tier, used: before, cap };
  }
  const after = incrementUsage().count;
  const threshold = Math.floor(cap * 0.8);
  return {
    allowed: true,
    reason:
      after >= threshold && before < threshold ? 'soft-warn-crossed' : 'ok',
    tier,
    used: after,
    cap,
  };
}

/** Re-export for convenience; consumers only need this file. */
export {
  getCurrentMonthKey,
  getCurrentTier,
  getTierCap,
  getTierDisplayName,
  hasAnyByokKey,
};
