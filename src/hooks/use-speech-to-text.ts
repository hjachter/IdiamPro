'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getUserApiKey } from '@/lib/byok-keys';
import { transcribeAudioAction } from '@/app/actions';
import { getMicPermissionHelp } from '@/lib/platform-help';

/**
 * Speech-to-text hook backed by MediaRecorder + Gemini multimodal transcription.
 *
 * Why not the Web Speech API?
 *   Chromium's built-in SpeechRecognition relies on Google's cloud speech
 *   service via API keys that ship with the real Chrome browser. Electron's
 *   bundled Chromium lacks those keys, so SpeechRecognition fails with
 *   "network" on every call. MediaRecorder + Gemini works on every platform
 *   IdeaM ships to (Electron, web, iOS via Capacitor) using the user's
 *   existing BYOK Gemini key.
 *
 * Interface contract:
 *   - `supported`     — true when MediaRecorder + getUserMedia are available.
 *   - `listening`     — true while we're actively recording the user's voice.
 *                       After they click stop, this stays true through the
 *                       transcription request, then flips false when the
 *                       transcript arrives (or fails).
 *   - `level`         — current smoothed RMS audio level in 0–1. Updates
 *                       continuously via requestAnimationFrame while
 *                       listening. Goes to 0 when not listening.
 *   - `audioDetected` — flips true the first time the smoothed level exceeds
 *                       a small threshold after `start()` is called. Resets
 *                       to false on each new `start()`. This is the signal
 *                       that the mic is actually receiving non-silence — use
 *                       it to surface a "we can't hear you" hint when it
 *                       stays false for a few seconds.
 *   - `start()`       — begins recording.
 *   - `stop()`        — stops recording, sends audio to Gemini, fires `onFinal`.
 *   - `toggle()`      — start if idle, stop if listening.
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

// Smoothed level threshold that counts as "real audio" rather than ambient
// noise floor. Calibrated empirically against typical laptop mics: silence
// hovers around 0.001-0.01, normal speech easily exceeds 0.05.
const AUDIO_DETECTED_THRESHOLD = 0.02;

export function useSpeechToText(opts: Options = {}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [level, setLevel] = useState(0);
  const [audioDetected, setAudioDetected] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const mimeRef = useRef<string>('audio/webm');
  const optsRef = useRef(opts);
  useEffect(() => { optsRef.current = opts; }, [opts]);

  // Audio-level metering refs. Kept separate from the recorder so the
  // analyser can run independently of MediaRecorder's chunked output.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const smoothedLevelRef = useRef(0);
  const audioDetectedRef = useRef(false);

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

  // Tear down the AudioContext + rAF loop. Safe to call multiple times.
  const teardownMetering = useCallback(() => {
    if (rafRef.current != null) {
      try { cancelAnimationFrame(rafRef.current); } catch {}
      rafRef.current = null;
    }
    try { sourceRef.current?.disconnect(); } catch {}
    sourceRef.current = null;
    try { analyserRef.current?.disconnect(); } catch {}
    analyserRef.current = null;
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state !== 'closed') {
      try { ctx.close(); } catch {}
    }
    audioCtxRef.current = null;
    smoothedLevelRef.current = 0;
    setLevel(0);
  }, []);

  const cleanupStream = useCallback(() => {
    teardownMetering();
    const s = streamRef.current;
    if (s) {
      try { s.getTracks().forEach(t => t.stop()); } catch {}
      streamRef.current = null;
    }
  }, [teardownMetering]);

  // Wire up an AudioContext + AnalyserNode on the live mic stream and start
  // sampling time-domain data on rAF. Computes smoothed RMS in 0–1.
  const startMetering = useCallback((stream: MediaStream) => {
    if (typeof window === 'undefined') return;
    const AnyWindow = window as unknown as {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const Ctor = AnyWindow.AudioContext || AnyWindow.webkitAudioContext;
    if (!Ctor) return;
    try {
      const ctx = new Ctor();
      // Browsers (and Electron's Chromium) often start AudioContexts in a
      // "suspended" state until a user gesture resumes them. Without this,
      // the analyser silently yields all-128 frames and the meter never moves.
      // resume() is async but we don't await — fire-and-forget is fine since
      // the rAF loop will pick up real data as soon as the context wakes up.
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {
          /* ignore — best-effort */
        });
      }
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);

      audioCtxRef.current = ctx;
      sourceRef.current = source;
      analyserRef.current = analyser;
      smoothedLevelRef.current = 0;
      audioDetectedRef.current = false;
      setAudioDetected(false);

      const buf = new Uint8Array(analyser.fftSize);
      // Exponential smoothing factor — higher = snappier, lower = smoother.
      const ALPHA = 0.25;
      const startedAt = Date.now();
      let warnedStuck = false;

      const tick = () => {
        const a = analyserRef.current;
        if (!a) return;
        a.getByteTimeDomainData(buf);
        // Compute RMS around 128 (silence midpoint for unsigned 8-bit PCM).
        let sumSq = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128; // -1..1
          sumSq += v * v;
        }
        const rms = Math.sqrt(sumSq / buf.length); // 0..~1
        const smoothed = smoothedLevelRef.current + ALPHA * (rms - smoothedLevelRef.current);
        smoothedLevelRef.current = smoothed;
        setLevel(smoothed);
        if (!audioDetectedRef.current && smoothed > AUDIO_DETECTED_THRESHOLD) {
          audioDetectedRef.current = true;
          setAudioDetected(true);
        }
        // Diagnostic: if the AudioContext exists but the meter has been pinned
        // at zero for over a second, surface a one-shot warning so we can spot
        // it in Playwright probes / DevTools. Common causes: suspended context
        // that never resumed, or the analyser receiving silence-only frames.
        if (!warnedStuck && Date.now() - startedAt > 1000 && smoothed === 0) {
          warnedStuck = true;
          const c = audioCtxRef.current;
          // eslint-disable-next-line no-console
          console.warn(
            `[speech-to-text] level stuck at 0 for >1s — audioCtx state=${c?.state ?? 'null'}, analyser=${a ? 'ok' : 'null'}`,
          );
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      // Metering is best-effort; transcription still works without it.
      teardownMetering();
    }
  }, [teardownMetering]);

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
      // Reset the audio-detected signal for this new session before metering
      // starts, so consumers always see a clean false→true transition.
      audioDetectedRef.current = false;
      setAudioDetected(false);
      startMetering(stream);
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
        msg = `Microphone permission was denied. ${getMicPermissionHelp()}`;
      } else if (name === 'NotFoundError') {
        msg = 'No microphone was found on this device.';
      }
      optsRef.current.onError?.(msg);
      setListening(false);
      cleanupStream();
    }
  }, [listening, pickMimeType, cleanupStream, startMetering]);

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

  // Testability hook: mirror the current smoothed level and audioDetected
  // signal onto `window` so Playwright can assert the meter is actually
  // responding to fake-audio input. No-op in non-browser environments.
  // The mirror is gated on listening so it doesn't leak stale values after
  // the user stops.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as unknown as Record<string, unknown>;
    w.__speechLevel = level;
    w.__speechAudioDetected = audioDetected;
    w.__speechListening = listening;
  }, [level, audioDetected, listening]);

  return { supported, listening, level, audioDetected, start, stop, toggle };
}
