'use server';

/**
 * Transcribe a short audio clip to text via Gemini.
 *
 * Why this flow exists: Chromium's built-in Web Speech API (window.SpeechRecognition)
 * does NOT work inside Electron, because the bundled Chromium lacks the Google
 * speech-service API keys that ship with the real Chrome browser. The
 * SpeechRecognition object throws "network" on every call. This flow replaces
 * it with a MediaRecorder + Gemini multimodal pipeline that works on every
 * platform IDMPro ships to (Electron, web, iOS via Capacitor).
 *
 * Pattern: client records audio with MediaRecorder, base64-encodes the blob,
 * sends it here; we call Gemini with an inline audio part and a single-line
 * "transcribe this" prompt; we return the plain transcript.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDefaultGeminiModel } from '@/config/gemini-models';
import { requireApiKey } from '@/lib/byok-keys';

export interface TranscribeAudioInput {
  /** Base64-encoded audio bytes (no data-URL prefix). */
  audioBase64: string;
  /** MIME type of the recorded audio (e.g. "audio/webm", "audio/mp4"). */
  mimeType: string;
  /** User's BYOK Gemini API key, if any. */
  userApiKey?: string | null;
}

export interface TranscribeAudioResult {
  transcript: string;
  /** Set when transcription failed; transcript will be empty. */
  error?: string;
}

const PROMPT =
  'Transcribe the spoken words in this audio clip into plain text. Return ONLY the transcript itself — no quotes, no labels, no preamble. If the audio is silent or unintelligible, return an empty string.';

export async function transcribeAudio(input: TranscribeAudioInput): Promise<TranscribeAudioResult> {
  if (!input.audioBase64 || input.audioBase64.length === 0) {
    return { transcript: '', error: 'No audio captured.' };
  }
  // Diagnostic logging so server logs show exactly what arrived if Gemini fails.
  try {
    console.log(
      `[transcribeAudio] inbound: mimeType=${String(input.mimeType)} base64Length=${input.audioBase64.length}`
    );
  } catch {
    /* logging must never throw */
  }
  try {
    const apiKey = requireApiKey('gemini', input.userApiKey);
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: getDefaultGeminiModel('sdk'),
      generationConfig: { temperature: 0.0, maxOutputTokens: 500 },
    });
    const result = await model.generateContent([
      { text: PROMPT },
      { inlineData: { mimeType: input.mimeType, data: input.audioBase64 } },
    ]);
    const text = String(result.response.text() || '').trim();
    return { transcript: text };
  } catch (err: any) {
    // Coerce every possible shape of error into a plain string so the
    // returned object is always JSON-serializable for the RSC boundary.
    let msg: string;
    try {
      msg = typeof err?.message === 'string' && err.message
        ? err.message
        : String(err);
    } catch {
      msg = 'Transcription failed.';
    }
    return { transcript: '', error: msg };
  }
}
