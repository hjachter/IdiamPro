'use client';

/**
 * Email Tools settings — the opt-in control framework for the app's
 * email-related power features (Professional Customization, 2026-07-22).
 *
 * GOVERNING PRINCIPLE: email tools are strictly OPT-IN and OFF BY DEFAULT.
 * The app NEVER touches a user's email automatically. Nothing email-related
 * appears or runs until the user explicitly turns the master "Email tools"
 * switch on (which triggers an honest consent/warning first). The user is
 * always in control and progressively enabled.
 *
 * These settings live under Settings → Professional Customization and are
 * persisted in localStorage. Both the settings dialog (writer) and the
 * feature surfaces (readers — e.g. the Export Email menu items) use the
 * useEmailToolsSettings() hook so a change anywhere is reflected everywhere
 * live, via a window CustomEvent.
 *
 * Structure is deliberately extensible: the master gate plus a map of
 * per-feature sub-toggles. Export Email is the first inhabitant; a future
 * "Import email into outlines" and "Filter junk aside" (Phase 2) can be
 * added by extending EMAIL_FEATURE_KEYS without touching consumers.
 */

import { useCallback, useEffect, useState } from 'react';

export const EMAIL_TOOLS_STORAGE_KEYS = {
  /** Master gate. 'true' | 'false'. Default false (OFF). */
  master: 'emailTools.enabled',
  /** First-time enable consent. 'granted' once the warning was accepted. */
  consent: 'emailTools.consent',
  /** The user's own email address — targets Gmail + personalizes sign-off. */
  address: 'emailTools.address',
  /** Per-feature sub-toggle: turn an outline branch into an email. */
  exportEmail: 'emailTools.feature.exportEmail',
  /** Per-feature sub-toggle: bring an email / thread IN as a structured outline. */
  importEmail: 'emailTools.feature.importEmail',
  /** Per-feature sub-toggle: quarantine suspected junk into a labeled sub-branch on import. */
  fileJunkAside: 'emailTools.feature.fileJunkAside',
} as const;

/** Fired on any write so every mounted consumer re-reads immediately. */
const CHANGE_EVENT = 'email-tools-settings-changed';

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

export function getEmailToolsEnabled(): boolean {
  return readBool(EMAIL_TOOLS_STORAGE_KEYS.master, false);
}
export function getEmailToolsConsentGranted(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(EMAIL_TOOLS_STORAGE_KEYS.consent) === 'granted';
}
export function getUserEmailAddress(): string {
  return readString(EMAIL_TOOLS_STORAGE_KEYS.address);
}
/** Sub-toggle defaults ON once the master is on. */
export function getExportEmailEnabled(): boolean {
  return readBool(EMAIL_TOOLS_STORAGE_KEYS.exportEmail, true);
}
/** The single question every surface asks: is Export Email live right now? */
export function isExportEmailAvailable(): boolean {
  return getEmailToolsEnabled() && getExportEmailEnabled();
}
/** Sub-toggle defaults ON once the master is on. */
export function getImportEmailEnabled(): boolean {
  return readBool(EMAIL_TOOLS_STORAGE_KEYS.importEmail, true);
}
/** "File suspected junk aside" quarantine defaults ON. */
export function getFileJunkAsideEnabled(): boolean {
  return readBool(EMAIL_TOOLS_STORAGE_KEYS.fileJunkAside, true);
}
/** The single question the import surface asks: is inbound Email import live right now? */
export function isEmailImportAvailable(): boolean {
  return getEmailToolsEnabled() && getImportEmailEnabled();
}

// ---- Plain setters -------------------------------------------------------

export function setEmailToolsEnabled(on: boolean) {
  writeAndNotify(EMAIL_TOOLS_STORAGE_KEYS.master, on ? 'true' : 'false');
}
export function grantEmailToolsConsent() {
  writeAndNotify(EMAIL_TOOLS_STORAGE_KEYS.consent, 'granted');
}
export function setUserEmailAddress(addr: string) {
  writeAndNotify(EMAIL_TOOLS_STORAGE_KEYS.address, addr);
}
export function setExportEmailEnabled(on: boolean) {
  writeAndNotify(EMAIL_TOOLS_STORAGE_KEYS.exportEmail, on ? 'true' : 'false');
}
export function setImportEmailEnabled(on: boolean) {
  writeAndNotify(EMAIL_TOOLS_STORAGE_KEYS.importEmail, on ? 'true' : 'false');
}
export function setFileJunkAsideEnabled(on: boolean) {
  writeAndNotify(EMAIL_TOOLS_STORAGE_KEYS.fileJunkAside, on ? 'true' : 'false');
}

export interface EmailToolsSettings {
  /** Master gate — when false, ALL email features are hidden/disabled. */
  emailToolsEnabled: boolean;
  /** True once the user has accepted the first-time consent/warning. */
  consentGranted: boolean;
  /** The user's email address (optional; personalizes + targets Gmail). */
  userEmail: string;
  /** Export Email sub-toggle (only meaningful when master is on). */
  exportEmailEnabled: boolean;
  /** Import Email sub-toggle (only meaningful when master is on). */
  importEmailEnabled: boolean;
  /** "File suspected junk aside" quarantine sub-toggle. */
  fileJunkAsideEnabled: boolean;
  /** Convenience: master AND the Export Email sub-toggle. */
  exportEmailAvailable: boolean;
  /** Convenience: master AND the Import Email sub-toggle. */
  emailImportAvailable: boolean;
  setEmailToolsEnabled: (on: boolean) => void;
  grantConsent: () => void;
  setUserEmail: (addr: string) => void;
  setExportEmailEnabled: (on: boolean) => void;
  setImportEmailEnabled: (on: boolean) => void;
  setFileJunkAsideEnabled: (on: boolean) => void;
}

/**
 * Live-reactive view of the email-tools settings. Subscribes to same-tab
 * writes (CustomEvent) and cross-tab writes (storage event).
 */
export function useEmailToolsSettings(): EmailToolsSettings {
  const [state, setState] = useState({
    emailToolsEnabled: false,
    consentGranted: false,
    userEmail: '',
    exportEmailEnabled: true,
    importEmailEnabled: true,
    fileJunkAsideEnabled: true,
  });

  const refresh = useCallback(() => {
    setState({
      emailToolsEnabled: getEmailToolsEnabled(),
      consentGranted: getEmailToolsConsentGranted(),
      userEmail: getUserEmailAddress(),
      exportEmailEnabled: getExportEmailEnabled(),
      importEmailEnabled: getImportEmailEnabled(),
      fileJunkAsideEnabled: getFileJunkAsideEnabled(),
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
    exportEmailAvailable: state.emailToolsEnabled && state.exportEmailEnabled,
    emailImportAvailable: state.emailToolsEnabled && state.importEmailEnabled,
    setEmailToolsEnabled,
    grantConsent: grantEmailToolsConsent,
    setUserEmail: setUserEmailAddress,
    setExportEmailEnabled,
    setImportEmailEnabled,
    setFileJunkAsideEnabled,
  };
}
