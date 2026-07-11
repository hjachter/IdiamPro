/**
 * NativeTts — bridge to the on-device iOS/iPadOS voice plugin.
 *
 * Gives free (keyless) iOS users an audible, multi-voice podcast synthesized
 * entirely on the device with Apple's built-in speech engine — no server, no
 * cost, and crucially NEVER a paid OpenAI key. This is the iOS counterpart to
 * the desktop free `say` path. When higher-quality Enhanced/Premium system
 * voices are installed they're used automatically; a plain default voice is the
 * graceful fallback so output is always audible.
 *
 * On any non-iOS runtime the plugin is absent; callers should feature-detect via
 * `nativeTtsAvailable()` before use.
 */

import { registerPlugin, Capacitor } from '@capacitor/core';

export interface NativeTtsSegment {
  /** Speaker label (informational only). */
  speaker?: string;
  /** OpenAI-style voice key (e.g. "nova"/"onyx") used only to pick a matching
   *  gender flavor for the on-device voice. */
  voice?: string;
  text: string;
}

export interface NativeTtsVoice {
  identifier: string;
  name: string;
  language: string;
  quality: 'premium' | 'enhanced' | 'default';
  gender: 'male' | 'female' | 'unspecified';
}

export interface NativeTtsResult {
  /** Absolute file path of the rendered audio on the device. */
  path: string;
  /** file:// URI of the rendered audio. */
  uri: string;
  /** Base64 of the rendered audio (m4a/AAC), ready to turn into a Blob. */
  audioBase64: string;
  mimeType: string;
  /** Names of the distinct system voices that were used. */
  usedVoices: string[];
}

export interface NativeTtsPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  listVoices(): Promise<{ voices: NativeTtsVoice[] }>;
  synthesizePodcast(options: { segments: NativeTtsSegment[] }): Promise<NativeTtsResult>;
}

const NativeTts = registerPlugin<NativeTtsPlugin>('NativeTts');

/** True only when the native plugin is present (iOS/iPadOS native shell). */
export function nativeTtsAvailable(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('NativeTts');
  } catch {
    return false;
  }
}

/**
 * Render a full podcast on the device and return it as an audio Blob URL plus
 * base64 (for download/save), mirroring the shape the dialog already handles for
 * the desktop path.
 */
export async function synthesizePodcastNative(
  segments: NativeTtsSegment[]
): Promise<{ audioBase64: string; audioUrl: string; mimeType: string; usedVoices: string[] }> {
  const result = await NativeTts.synthesizePodcast({ segments });
  const binary = atob(result.audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: result.mimeType || 'audio/mp4' });
  return {
    audioBase64: result.audioBase64,
    audioUrl: URL.createObjectURL(blob),
    mimeType: result.mimeType || 'audio/mp4',
    usedVoices: result.usedVoices || [],
  };
}

export default NativeTts;
