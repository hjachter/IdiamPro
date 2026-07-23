'use client';

/**
 * Your Voice — personal writing-style emulation settings (2026-07-22).
 *
 * GOVERNING PRINCIPLE: "Your Voice" is strictly the USER'S OWN voice. The
 * feature learns the user's personal writing style from SAMPLES they provide
 * (pasted writing and/or a sample pulled from their own Second Brain) and
 * distills a reusable VOICE PROFILE — a concise description of their tone,
 * formality, rhythm, vocabulary, and quirks. That profile can then be injected
 * into the AI output wizards so generated text sounds like the user, not like
 * generic AI.
 *
 * ETHICS: this is emphatically NOT an "imitate someone else / a famous person"
 * capability. There is no third-party-impersonation surface anywhere. All copy
 * and behavior are centered on sounding like YOURSELF. The user always reviews
 * and edits both the distilled profile and every generated output.
 *
 * FUTURE DIRECTION (not built now): a "Teach Mode" could refine the profile by
 * learning from the edits the user makes to generated output. We deliberately
 * do NOT learn from edits today — the profile is only ever (re)generated from
 * explicit samples the user supplies. The review/edit step is the seam a future
 * Teach Mode would hook into.
 *
 * Independent of the Email tools master — Your Voice applies across many output
 * wizards (Export Email, Summarize, and the upcoming social-export formats),
 * not just email. It is its own opt-in entry in Professional Customization.
 *
 * Persistence mirrors the Email tools settings: localStorage plus a window
 * CustomEvent so every mounted consumer re-reads immediately on any write.
 */

import { useCallback, useEffect, useState } from 'react';

export const VOICE_PROFILE_STORAGE_KEYS = {
  /** Master gate. 'true' | 'false'. Default false (OFF). */
  master: 'voice.enabled',
  /** The distilled, editable voice-profile description (plain text). */
  profile: 'voice.profile',
  /** ISO timestamp of the last profile generation/edit — for the "updated" line. */
  updatedAt: 'voice.updatedAt',
} as const;

/** Fired on any write so every mounted consumer re-reads immediately. */
const CHANGE_EVENT = 'voice-profile-settings-changed';

/** A distilled profile longer than this is trimmed before we inject it into a
 *  generation prompt — keeps the style guidance tight and cheap. */
export const VOICE_PROFILE_MAX_CHARS = 2000;

function readBool(key: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback;
  const v = window.localStorage.getItem(key);
  if (v === null) return fallback;
  return v === 'true';
}

function readString(key: string): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(key) || '';
}

function writeAndNotify(key: string, value: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, value);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

// ---- Plain getters (usable outside React) --------------------------------

export function getVoiceEnabled(): boolean {
  return readBool(VOICE_PROFILE_STORAGE_KEYS.master, false);
}
export function getVoiceProfile(): string {
  return readString(VOICE_PROFILE_STORAGE_KEYS.profile);
}
export function getVoiceUpdatedAt(): string {
  return readString(VOICE_PROFILE_STORAGE_KEYS.updatedAt);
}
/** The single question every output wizard asks: can I offer "In my voice"
 *  right now? True only when the feature is on AND a profile actually exists. */
export function isVoiceAvailable(): boolean {
  return getVoiceEnabled() && getVoiceProfile().trim().length > 0;
}
/** The style guidance to inject into a generation prompt, trimmed for cost.
 *  Returns '' when Your Voice is off or no profile exists — callers treat an
 *  empty string as "generate normally". */
export function getVoiceProfileForPrompt(): string {
  if (!isVoiceAvailable()) return '';
  return getVoiceProfile().trim().slice(0, VOICE_PROFILE_MAX_CHARS);
}

// ---- Plain setters -------------------------------------------------------

export function setVoiceEnabled(on: boolean) {
  writeAndNotify(VOICE_PROFILE_STORAGE_KEYS.master, on ? 'true' : 'false');
}
export function setVoiceProfile(profile: string) {
  writeAndNotify(VOICE_PROFILE_STORAGE_KEYS.profile, profile);
  writeAndNotify(VOICE_PROFILE_STORAGE_KEYS.updatedAt, new Date().toISOString());
}
export function clearVoiceProfile() {
  writeAndNotify(VOICE_PROFILE_STORAGE_KEYS.profile, '');
  writeAndNotify(VOICE_PROFILE_STORAGE_KEYS.updatedAt, '');
}

export interface VoiceProfileSettings {
  /** Master gate — when false, Your Voice is entirely inactive/hidden. */
  voiceEnabled: boolean;
  /** The distilled, editable voice-profile description. */
  voiceProfile: string;
  /** ISO timestamp of the last generation/edit (empty if never). */
  voiceUpdatedAt: string;
  /** Convenience: master AND a non-empty profile — offer "In my voice". */
  voiceAvailable: boolean;
  setVoiceEnabled: (on: boolean) => void;
  setVoiceProfile: (profile: string) => void;
  clearVoiceProfile: () => void;
}

/**
 * Live-reactive view of the Your Voice settings. Subscribes to same-tab writes
 * (CustomEvent) and cross-tab writes (storage event).
 */
export function useVoiceProfile(): VoiceProfileSettings {
  const [state, setState] = useState({
    voiceEnabled: false,
    voiceProfile: '',
    voiceUpdatedAt: '',
  });

  const refresh = useCallback(() => {
    setState({
      voiceEnabled: getVoiceEnabled(),
      voiceProfile: getVoiceProfile(),
      voiceUpdatedAt: getVoiceUpdatedAt(),
    });
  }, []);

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

  return {
    ...state,
    voiceAvailable: state.voiceEnabled && state.voiceProfile.trim().length > 0,
    setVoiceEnabled,
    setVoiceProfile,
    clearVoiceProfile,
  };
}
