'use client';

import { useCallback } from 'react';

/**
 * Input mode preference — controls how the user expects to enter text
 * in the command palette (Ask AI) and the Help chat.
 *
 *  - 'type'              — keyboard only (default).
 *  - 'voice'             — (deprecated, see note below).
 *  - 'voice-auto-start'  — (deprecated, see note below).
 *
 * Historically stored in localStorage under the key 'inputMode'.
 */
export type InputMode = 'type' | 'voice' | 'voice-auto-start';

export const INPUT_MODE_STORAGE_KEY = 'inputMode';

// NOTE — 2026-06-01 hard pullback:
// Voice-as-command-interface has been removed from the UI entirely.
// This hook is intentionally hard-wired to always return 'type', regardless
// of what may be stored in localStorage from earlier builds. The underlying
// infrastructure (Web Speech, transcription flow, etc.) is preserved on disk
// for a possible future dictation / accessibility feature, but no surface in
// the app opts a user into voice mode anymore.

/**
 * Hook that returns the current input mode plus a setter.
 *
 * As of the 2026-06-01 pullback, this ALWAYS returns 'type'. The setter is a
 * no-op. Any pre-existing 'voice' / 'voice-auto-start' values in localStorage
 * are silently ignored.
 */
export function useInputModePreference(): [InputMode, (mode: InputMode) => void] {
  const update = useCallback((_next: InputMode) => {
    // Intentionally no-op. See note above.
  }, []);

  return ['type', update];
}
