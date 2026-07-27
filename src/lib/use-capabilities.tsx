'use client';

/**
 * CAPABILITIES — the opt-in feature-toggle framework (2026-07-27).
 *
 * GOVERNING PRINCIPLE: the DEFAULT app is just notes + an outline. Anything
 * that turns IdeaM into something more specialized (project management today;
 * more later) is a CAPABILITY the user deliberately switches ON. Every
 * capability is OFF by default, opt-in, and remembers its state. Turning one
 * off HIDES its UI but NEVER deletes the underlying data — flip it back on and
 * everything reappears exactly as it was.
 *
 * These live under Settings → Professional Customization → Capabilities and are
 * persisted in localStorage. The settings dialog (writer) and every feature
 * surface (readers) use the same getters / hook, so a change anywhere is
 * reflected everywhere live, via a window CustomEvent.
 *
 * EXTENSIBLE BY DESIGN: adding a future capability = add one entry to the
 * CAPABILITIES registry below and gate its surfaces on
 * `useCapabilityEnabled('<id>')`. No consumer plumbing changes.
 *
 * NO PAYWALL: during the evaluation period every capability is unlocked for
 * everyone. `isCapabilityAllowed()` is the single, clearly-marked seam where a
 * future entitlement / tier check would slot in — it ALWAYS returns true today.
 */

import { useCallback, useEffect, useState } from 'react';

/** A capability's static definition — its identity and its honest "what it adds". */
export interface CapabilityDef {
  /** Stable id used in storage keys and lookups. */
  id: string;
  /** User-facing name for the toggle. */
  name: string;
  /** One-line description shown under the toggle. */
  description: string;
  /**
   * The honest-enablement bullets — exactly what turning this on adds. Shown in
   * the light, dismissible note the first time the user flips it on.
   */
  adds: string[];
}

/**
 * The capability registry. Project Management is the first inhabitant. To add a
 * future capability, append an entry here and gate its surfaces on its id.
 */
export const CAPABILITIES: Record<string, CapabilityDef> = {
  projectManagement: {
    id: 'projectManagement',
    name: 'Project Management',
    description:
      'Turns your outline into a lightweight project tracker. Off by default — your notes and outline work exactly the same without it.',
    adds: [
      'Status tracking — mark any item Not started, In progress, Done, or Blocked, shown as a colored badge.',
      'Task dependencies — say a task “depends on” another; it shows a Blocked-by warning until the other is Done.',
      'Filter by status — because a status is just a tag, your existing Filter-by-tag control filters by status too.',
    ],
  },
};

/** Storage key for a capability's on/off state. */
function enabledKey(id: string): string {
  return `capabilities.${id}.enabled`;
}
/** Storage key for a capability's first-enable consent acknowledgement. */
function consentKey(id: string): string {
  return `capabilities.${id}.consent`;
}

/** Fired on any write so every mounted consumer re-reads immediately. */
const CHANGE_EVENT = 'capabilities-changed';

function readBool(key: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback;
  const v = window.localStorage.getItem(key);
  if (v === null) return fallback;
  return v === 'true';
}

function writeAndNotify(key: string, value: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, value);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

// ── Entitlement seam (NO paywall today) ─────────────────────────────────────
/**
 * The single, deliberate seam where a future entitlement / tier / subscription
 * check would slot in. During the evaluation period EVERY capability is
 * unlocked for EVERYONE, so this ALWAYS returns true. Do not add gating here
 * without an explicit product decision — this is a no-op on purpose.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function isCapabilityAllowed(_id: string): boolean {
  return true;
}

// ── Plain getters / setters (usable outside React) ──────────────────────────

/** Is this capability turned on right now? Off (false) by default. */
export function getCapabilityEnabled(id: string): boolean {
  // A capability is "live" only when the user turned it on AND it's allowed.
  // The allow-check is a no-op today (always true) — see isCapabilityAllowed.
  return isCapabilityAllowed(id) && readBool(enabledKey(id), false);
}
export function setCapabilityEnabled(id: string, on: boolean) {
  writeAndNotify(enabledKey(id), on ? 'true' : 'false');
}
export function getCapabilityConsentGranted(id: string): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(consentKey(id)) === 'granted';
}
export function grantCapabilityConsent(id: string) {
  writeAndNotify(consentKey(id), 'granted');
}

// ── Named convenience for Project Management (the first capability) ──────────

export const PROJECT_MANAGEMENT_ID = 'projectManagement';
export function getProjectManagementEnabled(): boolean {
  return getCapabilityEnabled(PROJECT_MANAGEMENT_ID);
}

// ── Reactive hooks ──────────────────────────────────────────────────────────

/**
 * Live-reactive boolean for a single capability. Subscribes to same-tab writes
 * (CustomEvent) and cross-tab writes (storage event) so every surface updates
 * the instant the toggle flips in Settings.
 */
export function useCapabilityEnabled(id: string): boolean {
  const [enabled, setEnabled] = useState(false);

  const refresh = useCallback(() => setEnabled(getCapabilityEnabled(id)), [id]);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [refresh]);

  return enabled;
}

/** Convenience hook for the Project Management capability. */
export function useProjectManagementEnabled(): boolean {
  return useCapabilityEnabled(PROJECT_MANAGEMENT_ID);
}
