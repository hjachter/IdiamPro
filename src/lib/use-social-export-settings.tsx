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
  /** Per-platform sub-toggle: Share to LinkedIn. */
  linkedin: 'socialExport.platform.linkedin',
  /** Per-platform sub-toggle: Share to Facebook. */
  facebook: 'socialExport.platform.facebook',
  /** Per-platform sub-toggle: Share to Threads. */
  threads: 'socialExport.platform.threads',
  /** Per-platform sub-toggle: Share to Bluesky. */
  bluesky: 'socialExport.platform.bluesky',
  /** Per-platform sub-toggle: Share to YouTube. */
  youtube: 'socialExport.platform.youtube',
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
export function getShareToLinkedInEnabled(): boolean {
  return readBool(SOCIAL_EXPORT_STORAGE_KEYS.linkedin, true);
}
export function getShareToFacebookEnabled(): boolean {
  return readBool(SOCIAL_EXPORT_STORAGE_KEYS.facebook, true);
}
export function getShareToThreadsEnabled(): boolean {
  return readBool(SOCIAL_EXPORT_STORAGE_KEYS.threads, true);
}
export function getShareToBlueskyEnabled(): boolean {
  return readBool(SOCIAL_EXPORT_STORAGE_KEYS.bluesky, true);
}
export function getShareToYouTubeEnabled(): boolean {
  return readBool(SOCIAL_EXPORT_STORAGE_KEYS.youtube, true);
}
/** The single question the surface asks: is Share to X live right now? */
export function isShareToXAvailable(): boolean {
  return getSocialExportEnabled() && getShareToXEnabled();
}
export function isShareToInstagramAvailable(): boolean {
  return getSocialExportEnabled() && getShareToInstagramEnabled();
}
export function isShareToLinkedInAvailable(): boolean {
  return getSocialExportEnabled() && getShareToLinkedInEnabled();
}
export function isShareToFacebookAvailable(): boolean {
  return getSocialExportEnabled() && getShareToFacebookEnabled();
}
export function isShareToThreadsAvailable(): boolean {
  return getSocialExportEnabled() && getShareToThreadsEnabled();
}
export function isShareToBlueskyAvailable(): boolean {
  return getSocialExportEnabled() && getShareToBlueskyEnabled();
}
export function isShareToYouTubeAvailable(): boolean {
  return getSocialExportEnabled() && getShareToYouTubeEnabled();
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
export function setShareToLinkedInEnabled(on: boolean) {
  writeAndNotify(SOCIAL_EXPORT_STORAGE_KEYS.linkedin, on ? 'true' : 'false');
}
export function setShareToFacebookEnabled(on: boolean) {
  writeAndNotify(SOCIAL_EXPORT_STORAGE_KEYS.facebook, on ? 'true' : 'false');
}
export function setShareToThreadsEnabled(on: boolean) {
  writeAndNotify(SOCIAL_EXPORT_STORAGE_KEYS.threads, on ? 'true' : 'false');
}
export function setShareToBlueskyEnabled(on: boolean) {
  writeAndNotify(SOCIAL_EXPORT_STORAGE_KEYS.bluesky, on ? 'true' : 'false');
}
export function setShareToYouTubeEnabled(on: boolean) {
  writeAndNotify(SOCIAL_EXPORT_STORAGE_KEYS.youtube, on ? 'true' : 'false');
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
  /** Share to LinkedIn sub-toggle (only meaningful when master is on). */
  shareToLinkedInEnabled: boolean;
  /** Share to Facebook sub-toggle (only meaningful when master is on). */
  shareToFacebookEnabled: boolean;
  /** Share to Threads sub-toggle (only meaningful when master is on). */
  shareToThreadsEnabled: boolean;
  /** Share to Bluesky sub-toggle (only meaningful when master is on). */
  shareToBlueskyEnabled: boolean;
  /** Share to YouTube sub-toggle (only meaningful when master is on). */
  shareToYouTubeEnabled: boolean;
  /** Convenience: master AND the Share to X sub-toggle. */
  shareToXAvailable: boolean;
  /** Convenience: master AND the Share to Instagram sub-toggle. */
  shareToInstagramAvailable: boolean;
  /** Convenience: master AND the Share to LinkedIn sub-toggle. */
  shareToLinkedInAvailable: boolean;
  /** Convenience: master AND the Share to Facebook sub-toggle. */
  shareToFacebookAvailable: boolean;
  /** Convenience: master AND the Share to Threads sub-toggle. */
  shareToThreadsAvailable: boolean;
  /** Convenience: master AND the Share to Bluesky sub-toggle. */
  shareToBlueskyAvailable: boolean;
  /** Convenience: master AND the Share to YouTube sub-toggle. */
  shareToYouTubeAvailable: boolean;
  /** Convenience: is ANY social platform available right now (drives the group). */
  socialExportAvailable: boolean;
  setSocialExportEnabled: (on: boolean) => void;
  grantConsent: () => void;
  setShareToXEnabled: (on: boolean) => void;
  setShareToInstagramEnabled: (on: boolean) => void;
  setShareToLinkedInEnabled: (on: boolean) => void;
  setShareToFacebookEnabled: (on: boolean) => void;
  setShareToThreadsEnabled: (on: boolean) => void;
  setShareToBlueskyEnabled: (on: boolean) => void;
  setShareToYouTubeEnabled: (on: boolean) => void;
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
    shareToLinkedInEnabled: true,
    shareToFacebookEnabled: true,
    shareToThreadsEnabled: true,
    shareToBlueskyEnabled: true,
    shareToYouTubeEnabled: true,
  });

  const refresh = useCallback(() => {
    setState({
      socialExportEnabled: getSocialExportEnabled(),
      consentGranted: getSocialExportConsentGranted(),
      shareToXEnabled: getShareToXEnabled(),
      shareToInstagramEnabled: getShareToInstagramEnabled(),
      shareToLinkedInEnabled: getShareToLinkedInEnabled(),
      shareToFacebookEnabled: getShareToFacebookEnabled(),
      shareToThreadsEnabled: getShareToThreadsEnabled(),
      shareToBlueskyEnabled: getShareToBlueskyEnabled(),
      shareToYouTubeEnabled: getShareToYouTubeEnabled(),
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
  const shareToLinkedInAvailable = state.socialExportEnabled && state.shareToLinkedInEnabled;
  const shareToFacebookAvailable = state.socialExportEnabled && state.shareToFacebookEnabled;
  const shareToThreadsAvailable = state.socialExportEnabled && state.shareToThreadsEnabled;
  const shareToBlueskyAvailable = state.socialExportEnabled && state.shareToBlueskyEnabled;
  const shareToYouTubeAvailable = state.socialExportEnabled && state.shareToYouTubeEnabled;
  return {
    ...state,
    shareToXAvailable,
    shareToInstagramAvailable,
    shareToLinkedInAvailable,
    shareToFacebookAvailable,
    shareToThreadsAvailable,
    shareToBlueskyAvailable,
    shareToYouTubeAvailable,
    // Available if the master is on AND at least one platform sub-toggle is on.
    socialExportAvailable:
      state.socialExportEnabled &&
      (state.shareToXEnabled ||
        state.shareToInstagramEnabled ||
        state.shareToLinkedInEnabled ||
        state.shareToFacebookEnabled ||
        state.shareToThreadsEnabled ||
        state.shareToBlueskyEnabled ||
        state.shareToYouTubeEnabled),
    setSocialExportEnabled,
    grantConsent: grantSocialExportConsent,
    setShareToXEnabled,
    setShareToInstagramEnabled,
    setShareToLinkedInEnabled,
    setShareToFacebookEnabled,
    setShareToThreadsEnabled,
    setShareToBlueskyEnabled,
    setShareToYouTubeEnabled,
  };
}
