'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Input mode preference — controls how the user expects to enter text
 * in the command palette (Ask AI) and the Help chat.
 *
 *  - 'type'              — keyboard only (default). The mic button is still
 *                          visible for ad-hoc voice, but never auto-starts.
 *  - 'voice'             — user dictates freely. No auto-start; they tap mic.
 *  - 'voice-auto-start'  — when the command palette or Help chat opens,
 *                          the mic starts listening immediately (if the
 *                          browser supports Web Speech recognition).
 *
 * Stored in localStorage under the key 'inputMode'. Defaults to 'type'
 * when nothing is stored.
 */
export type InputMode = 'type' | 'voice' | 'voice-auto-start';

export const INPUT_MODE_STORAGE_KEY = 'inputMode';
const VALID_MODES: InputMode[] = ['type', 'voice', 'voice-auto-start'];

function readStoredMode(): InputMode {
  if (typeof window === 'undefined') return 'type';
  try {
    const raw = window.localStorage.getItem(INPUT_MODE_STORAGE_KEY);
    if (raw && (VALID_MODES as string[]).includes(raw)) {
      return raw as InputMode;
    }
  } catch {
    /* localStorage unavailable — fall through to default */
  }
  return 'type';
}

/**
 * Hook that returns the current input mode plus a setter that persists
 * it to localStorage and notifies other components in the same tab via
 * a custom event (the native 'storage' event only fires across tabs).
 */
export function useInputModePreference(): [InputMode, (mode: InputMode) => void] {
  const [mode, setMode] = useState<InputMode>('type');

  // Hydrate from localStorage on mount, and keep in sync if another
  // component changes the preference.
  useEffect(() => {
    setMode(readStoredMode());
    const onChange = () => setMode(readStoredMode());
    if (typeof window !== 'undefined') {
      window.addEventListener('inputmode:changed', onChange);
      window.addEventListener('storage', onChange);
      return () => {
        window.removeEventListener('inputmode:changed', onChange);
        window.removeEventListener('storage', onChange);
      };
    }
    return undefined;
  }, []);

  const update = useCallback((next: InputMode) => {
    setMode(next);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(INPUT_MODE_STORAGE_KEY, next);
      window.dispatchEvent(new CustomEvent('inputmode:changed'));
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }, []);

  return [mode, update];
}
