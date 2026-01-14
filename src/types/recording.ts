// Types for conversation recording and transcription

export interface RecordingSession {
  id: string;
  startTime: number;
  duration: number;
  audioData: string; // base64 encoded
  mimeType: string;
  status: 'recording' | 'paused' | 'stopped' | 'transcribing' | 'completed' | 'error';
}

export interface TranscriptSegment {
  speaker: string;      // "Speaker A", "Speaker B", etc.
  text: string;
  startTime: number;    // milliseconds
  endTime: number;      // milliseconds
  confidence?: number;
}

export interface DiarizedTranscript {
  segments: TranscriptSegment[];
  speakers: string[];           // Unique speaker labels found
  fullText: string;             // Complete transcript without speaker labels
  formattedText: string;        // Transcript with speaker labels inline
  duration: number;             // Total duration in milliseconds
}

export interface UseAudioRecorderReturn {
  // State
  isRecording: boolean;
  isPaused: boolean;
  duration: number;           // Current recording duration in seconds
  audioLevel: number;         // 0-100 for visualization
  error: string | null;
  isSupported: boolean;

  // Actions
  startRecording: () => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => Promise<RecordingResult | null>;
}

export interface RecordingResult {
  audioBlob: Blob;
  audioData: string;    // base64
  mimeType: string;
  duration: number;     // seconds
}

export interface TranscriptionOptions {
  enableDiarization?: boolean;
  speakerCount?: number;        // Expected number of speakers (optional hint)
  language?: string;            // Default: 'en'
}

export interface TranscriptionResult {
  success: boolean;
  transcript?: DiarizedTranscript;
  error?: string;
}
