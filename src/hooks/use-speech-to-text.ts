'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getUserApiKey } from '@/lib/byok-keys';
import { transcribeAudioAction } from '@/app/actions';

/**
 * Speech-to-text hook backed by MediaRecorder + Gemini multimodal transcription.
 *
 * Why not the Web Speech API?
 *   Chromium's built-in SpeechRecognition relies on Google's cloud speech
 *   service via API keys that ship with the real Chrome browser. Electron's
 *   bundled Chromium lacks those keys, so SpeechRecognition fails with
 *   "network" on every call. MediaRecorder + Gemini works on every platform
 *   IdiamPro ships to (Electron, web, iOS via Capacitor) using the user's
 *   existing BYOK Gemini key.
 *
 * Interface contract:
 *   - `supported`  — true when MediaRecorder + getUserMedia are available.
 *   - `listening`  — true while we're actively recording the user's voice.
 *                    After they click stop, this stays true through the
 *                    transcription request, then flips false when the
 *                    transcript arrives (or fails).
 *   - `start()`    — begins recording.
 *   - `stop()`     — stops recording, sends audio to Gemini, fires `onFinal`.
 *   - `toggle()`   — start if idle, stop if listening.
 *
 *   Callbacks:
 *   - `onFinal(text)`   — the transcript Gemini returned (may be empty).
 *   - `onInterim(text)` — never called in this implementation (kept for
 *                         interface compat with previous Web Speech version).
 *   - `onError(msg)`    — called when recording fails or transcription errors.
 */

interface Options {
  onFinal?: (text: string) => void;
  onInterim?: (text: string) => void;
  onError?: (error: string) => void;
}

export function useSpeechToText(opts: Options = {}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const mimeRef = useRef<string>('audio/webm');
  const optsRef = useRef(opts);
  useEffect(() => { optsRef.current = opts; }, [opts]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ok =
      typeof window.MediaRecorder !== 'undefined' &&
      !!navigator?.mediaDevices?.getUserMedia;
    setSupported(ok);
  }, []);

  // Pick a MIME type the browser will actually record. Order matters: webm/opus
  // works in Chromium/Electron; mp4 is Safari/iOS fallback.
  const pickMimeType = useCallback((): string => {
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac', ''];
    if (typeof MediaRecorder === 'undefined') return '';
    for (const t of candidates) {
      if (t === '' || MediaRecorder.isTypeSupported(t)) return t;
    }
    return '';
  }, []);

  const cleanupStream = useCallback(() => {
    const s = streamRef.current;
    if (s) {
      try { s.getTracks().forEach(t => t.stop()); } catch {}
      streamRef.current = null;
    }
  }, []);

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // strip the "data:<mime>;base64," prefix
        const comma = result.indexOf(',');
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
      reader.readAsDataURL(blob);
    });

  const start = useCallback(async () => {
    if (listening) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      optsRef.current.onError?.('Microphone not available in this environment.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMimeType();
      mimeRef.current = mime || 'audio/webm';
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onerror = (e: any) => {
        optsRef.current.onError?.(e?.error?.message || 'Recorder error');
        setListening(false);
        cleanupStream();
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeRef.current });
        cleanupStream();
        try {
          if (blob.size === 0) {
            optsRef.current.onError?.('No audio captured.');
            setListening(false);
            return;
          }
          const base64 = await blobToBase64(blob);
          const userKey = getUserApiKey('gemini');
          const res = await transcribeAudioAction({
            audioBase64: base64,
            mimeType: mimeRef.current,
            userApiKey: userKey,
          });
          if (res.error) {
            optsRef.current.onError?.(res.error);
          } else if (res.transcript) {
            optsRef.current.onFinal?.(res.transcript);
          } else {
            optsRef.current.onError?.('Nothing was transcribed — try speaking a bit closer to the microphone.');
          }
        } catch (err: any) {
          optsRef.current.onError?.(err?.message || 'Transcription failed.');
        } finally {
          setListening(false);
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setListening(true);
    } catch (err: any) {
      const name = err?.name || '';
      let msg = err?.message || 'Could not access the microphone.';
      if (name === 'NotAllowedError') {
        msg = 'Microphone permission was denied. Grant access in System Settings → Privacy & Security → Microphone.';
      } else if (name === 'NotFoundError') {
        msg = 'No microphone was found on this device.';
      }
      optsRef.current.onError?.(msg);
      setListening(false);
      cleanupStream();
    }
  }, [listening, pickMimeType, cleanupStream]);

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec) return;
    if (rec.state === 'inactive') return;
    try { rec.stop(); } catch {}
    // `listening` flips false in onstop after the transcript arrives.
  }, []);

  const toggle = useCallback(() => {
    if (listening) stop(); else start();
  }, [listening, start, stop]);

  // Best-effort cleanup if the consumer unmounts mid-recording.
  useEffect(() => {
    return () => {
      try { recorderRef.current?.stop(); } catch {}
      cleanupStream();
    };
  }, [cleanupStream]);

  return { supported, listening, start, stop, toggle };
}
