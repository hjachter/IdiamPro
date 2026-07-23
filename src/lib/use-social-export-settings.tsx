'use client';

/**
 * Social export settings — the opt-in control framework for the app's
 * social-media output features (Professional Customization, 2026-07-22).
 *
 * GOVERNING PRINCIPLE: social export is strictly OPT-IN and OFF BY DEFAULT, and
 * INDEPENDENT of the Email tools and Your Voice masters. Nothing social-related
 * appears or runs until the user explicitly turns the master "Social export"
 * switch on (which triggers a short, honest note first). IdeaM NEVER posts
 * anything — every hand-off is copy / open-a-prefilled-compose-window /
 * download, and the user always reviews and posts themselves.
 *
 * Lives under Settings → Professional Customization, persisted in localStorage.
 * Both the settings dialog (writer) and the feature surfaces (readers — the
 * Share to Social action) use useSocialExportSettings() so a change anywhere is
 * reflected everywhere live, via a window CustomEvent.
 *
 * Structure is deliberately extensible: a master gate plus a map of per-platform
 * sub-toggles. X is the first inhabitant; future platforms (Instagram, LinkedIn,
 * Facebook, Threads, Bluesky, YouTube, short-form video) can be added by
 * extending the per-platform keys — mirroring the social-templates registry —
 * without touching consumers.
 */

import { useCallback, useEffect, useState } from 'react';

export const SOCIAL_EXPORT_STORAGE_KEYS = {
  /** Master gate. 'true' | 'false'. Default false (OFF). */
  master: 'socialExport.enabled',
  /** First-time enable consent. 'granted' once the note was accepted. */
  consent: 'socialExport.consent',
  /** Per-platform sub-toggle: Share to X. */
  x: 'socialExport.platform.x',
  /** Per-platform sub-toggle: Share to Instagram. */
  instagram: 'socialExport.platform.instagram',
} as const;

/** Fired on any write so every mounted consumer re-reads immediately. */
const CHANGE_EVENT = 'social-export-settings-changed';

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

// ---- Plain getters (usable outside React) --------------------------------

export function getSocialExportEnabled(): boolean {
  return readBool(SOCIAL_EXPORT_STORAGE_KEYS.master, false);
}
export function getSocialExportConsentGranted(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(SOCIAL_EXPORT_STORAGE_KEYS.consent) === 'granted';
}
/** Per-platform sub-toggle defaults ON once the master is on. */
export function getShareToXEnabled(): boolean {
  return readBool(SOCIAL_EXPORT_STORAGE_KEYS.x, true);
}
export function getShareToInstagramEnabled(): boolean {
  return readBool(SOCIAL_EXPORT_STORAGE_KEYS.instagram, true);
}
/** The single question the surface asks: is Share to X live right now? */
export function isShareToXAvailable(): boolean {
  return getSocialExportEnabled() && getShareToXEnabled();
}
export function isShareToInstagramAvailable(): boolean {
  return getSocialExportEnabled() && getShareToInstagramEnabled();
}

// ---- Plain setters -------------------------------------------------------

export function setSocialExportEnabled(on: boolean) {
  writeAndNotify(SOCIAL_EXPORT_STORAGE_KEYS.master, on ? 'true' : 'false');
}
export function grantSocialExportConsent() {
  writeAndNotify(SOCIAL_EXPORT_STORAGE_KEYS.consent, 'granted');
}
export function setShareToXEnabled(on: boolean) {
  writeAndNotify(SOCIAL_EXPORT_STORAGE_KEYS.x, on ? 'true' : 'false');
}
export function setShareToInstagramEnabled(on: boolean) {
  writeAndNotify(SOCIAL_EXPORT_STORAGE_KEYS.instagram, on ? 'true' : 'false');
}

export interface SocialExportSettings {
  /** Master gate — when false, ALL social-export features are hidden/disabled. */
  socialExportEnabled: boolean;
  /** True once the user has accepted the first-time note. */
  consentGranted: boolean;
  /** Share to X sub-toggle (only meaningful when master is on). */
  shareToXEnabled: boolean;
  /** Share to Instagram sub-toggle (only meaningful when master is on). */
  shareToInstagramEnabled: boolean;
  /** Convenience: master AND the Share to X sub-toggle. */
  shareToXAvailable: boolean;
  /** Convenience: master AND the Share to Instagram sub-toggle. */
  shareToInstagramAvailable: boolean;
  /** Convenience: is ANY social platform available right now (drives the group). */
  socialExportAvailable: boolean;
  setSocialExportEnabled: (on: boolean) => void;
  grantConsent: () => void;
  setShareToXEnabled: (on: boolean) => void;
  setShareToInstagramEnabled: (on: boolean) => void;
}

/**
 * Live-reactive view of the social-export settings. Subscribes to same-tab
 * writes (CustomEvent) and cross-tab writes (storage event).
 */
export function useSocialExportSettings(): SocialExportSettings {
  const [state, setState] = useState({
    socialExportEnabled: false,
    consentGranted: false,
    shareToXEnabled: true,
    shareToInstagramEnabled: true,
  });

  const refresh = useCallback(() => {
    setState({
      socialExportEnabled: getSocialExportEnabled(),
      consentGranted: getSocialExportConsentGranted(),
      shareToXEnabled: getShareToXEnabled(),
      shareToInstagramEnabled: getShareToInstagramEnabled(),
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

  const shareToXAvailable = state.socialExportEnabled && state.shareToXEnabled;
  const shareToInstagramAvailable = state.socialExportEnabled && state.shareToInstagramEnabled;
  return {
    ...state,
    shareToXAvailable,
    shareToInstagramAvailable,
    // Available if the master is on AND at least one platform sub-toggle is on.
    socialExportAvailable: state.socialExportEnabled && (state.shareToXEnabled || state.shareToInstagramEnabled),
    setSocialExportEnabled,
    grantConsent: grantSocialExportConsent,
    setShareToXEnabled,
    setShareToInstagramEnabled,
  };
}
