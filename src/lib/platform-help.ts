/**
 * Platform-aware user-facing help strings.
 *
 * Centralises the "where do I click to fix this?" instructions so we don't
 * hardcode macOS-only paths in dialogs that also have to make sense on
 * Windows, Linux, iOS, Android, and the plain web build.
 *
 * Keep messages short, plain-English, and action-first. Always end with a
 * period so they can be concatenated cleanly into a sentence.
 */

import { getPlatformContext, type PlatformContext } from './platform';

/**
 * Returns a one-sentence instruction for re-granting microphone access on
 * the user's current runtime. Falls back to a generic message when the
 * platform can't be determined (e.g. SSR / unknown UA).
 */
export function getMicPermissionHelp(ctx?: PlatformContext): string {
  const { runtime, os } = ctx ?? getPlatformContext();

  if (runtime === 'electron') {
    if (os === 'macos') {
      return 'Open System Settings → Privacy & Security → Microphone, then enable IDMPro (or Electron) and restart the app.';
    }
    if (os === 'windows') {
      return 'Open Settings → Privacy & security → Microphone, then enable IDMPro and restart the app.';
    }
    if (os === 'linux') {
      return 'Check your audio settings (PulseAudio/PipeWire) and make sure IDMPro has microphone access, then restart the app.';
    }
    return 'Check your system’s microphone permissions for IDMPro.';
  }

  if (runtime === 'capacitor-ios') {
    return 'Open the iOS Settings app → IDMPro → Microphone, and turn it on.';
  }
  if (runtime === 'capacitor-android') {
    return 'Open Android Settings → Apps → IDMPro → Permissions → Microphone, and turn it on.';
  }

  if (runtime === 'web') {
    return 'Click the microphone icon in your browser’s address bar and grant microphone access to this site.';
  }

  return 'Check your system’s microphone permissions for IDMPro.';
}
