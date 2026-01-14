'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { UseAudioRecorderReturn, RecordingResult } from '@/types/recording';

// Check if running in Capacitor (iOS native)
function isCapacitor(): boolean {
  return typeof window !== 'undefined' && !!(window as unknown as { Capacitor?: unknown }).Capacitor;
}

// Check if MediaRecorder is supported
function isMediaRecorderSupported(): boolean {
  return typeof window !== 'undefined' && 'MediaRecorder' in window;
}

// Get preferred MIME type for recording
function getPreferredMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';

  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return 'audio/webm';
}

// Convert Blob to base64
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove data URL prefix if present
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Check platform support
  const isSupported = isMediaRecorderSupported() || isCapacitor();

  // Update audio level from analyser
  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate average level
    const average = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
    const normalizedLevel = Math.min(100, Math.round((average / 255) * 100 * 2)); // Scale up a bit

    setAudioLevel(normalizedLevel);

    if (isRecording && !isPaused) {
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    }
  }, [isRecording, isPaused]);

  // Update duration timer
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000 + pausedDurationRef.current;
        setDuration(Math.floor(elapsed));
      }, 100);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording, isPaused]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording) return;

    setError(null);
    audioChunksRef.current = [];
    pausedDurationRef.current = 0;

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        }
      });

      streamRef.current = stream;

      // Set up audio analyser for level visualization
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Create MediaRecorder
      const mimeType = getPreferredMimeType();
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setError('Recording error occurred');
        setIsRecording(false);
      };

      // Start recording with 1-second chunks for better recovery
      mediaRecorder.start(1000);
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setIsPaused(false);
      setDuration(0);

      // Start audio level updates
      updateAudioLevel();

    } catch (err) {
      console.error('Failed to start recording:', err);
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Microphone permission denied. Please allow access to record.');
        } else if (err.name === 'NotFoundError') {
          setError('No microphone found. Please connect a microphone.');
        } else {
          setError(`Failed to start recording: ${err.message}`);
        }
      } else {
        setError('Failed to start recording');
      }
    }
  }, [isRecording, updateAudioLevel]);

  const pauseRecording = useCallback(() => {
    if (!mediaRecorderRef.current || !isRecording || isPaused) return;

    mediaRecorderRef.current.pause();
    pausedDurationRef.current += (Date.now() - startTimeRef.current) / 1000;
    setIsPaused(true);
    setAudioLevel(0);

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, [isRecording, isPaused]);

  const resumeRecording = useCallback(() => {
    if (!mediaRecorderRef.current || !isRecording || !isPaused) return;

    mediaRecorderRef.current.resume();
    startTimeRef.current = Date.now();
    setIsPaused(false);

    // Resume audio level updates
    updateAudioLevel();
  }, [isRecording, isPaused, updateAudioLevel]);

  const stopRecording = useCallback(async (): Promise<RecordingResult | null> => {
    if (!mediaRecorderRef.current || !isRecording) return null;

    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current!;

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        // Close audio context
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }

        // Cancel animation frame
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }

        // Create audio blob
        const mimeType = getPreferredMimeType();
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

        // Convert to base64
        const audioData = await blobToBase64(audioBlob);

        // Calculate final duration
        const finalDuration = isPaused
          ? pausedDurationRef.current
          : (Date.now() - startTimeRef.current) / 1000 + pausedDurationRef.current;

        setIsRecording(false);
        setIsPaused(false);
        setAudioLevel(0);

        resolve({
          audioBlob,
          audioData,
          mimeType,
          duration: Math.round(finalDuration),
        });
      };

      mediaRecorder.stop();
    });
  }, [isRecording, isPaused]);

  return {
    isRecording,
    isPaused,
    duration,
    audioLevel,
    error,
    isSupported,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
  };
}
