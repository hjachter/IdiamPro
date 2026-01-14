// Server-side transcription service using AssemblyAI
// This file should only be imported in server actions

import type { DiarizedTranscript, TranscriptSegment, TranscriptionOptions } from '@/types/recording';

const ASSEMBLYAI_API_URL = 'https://api.assemblyai.com/v2';

interface AssemblyAIUploadResponse {
  upload_url: string;
}

interface AssemblyAITranscriptRequest {
  audio_url: string;
  speaker_labels?: boolean;
  speakers_expected?: number;
  language_code?: string;
}

interface AssemblyAIWord {
  text: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: string;
}

interface AssemblyAIUtterance {
  text: string;
  start: number;
  end: number;
  confidence: number;
  speaker: string;
  words: AssemblyAIWord[];
}

interface AssemblyAITranscriptResponse {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  text?: string;
  utterances?: AssemblyAIUtterance[];
  error?: string;
  audio_duration?: number;
}

// Upload audio to AssemblyAI
async function uploadAudio(audioData: string, mimeType: string): Promise<string> {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    throw new Error('ASSEMBLYAI_API_KEY environment variable not set');
  }

  // Convert base64 to buffer
  const buffer = Buffer.from(audioData, 'base64');

  const response = await fetch(`${ASSEMBLYAI_API_URL}/upload`, {
    method: 'POST',
    headers: {
      'Authorization': apiKey,
      'Content-Type': mimeType || 'audio/webm',
    },
    body: buffer,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to upload audio: ${errorText}`);
  }

  const data = await response.json() as AssemblyAIUploadResponse;
  return data.upload_url;
}

// Start transcription job
async function startTranscription(
  audioUrl: string,
  options: TranscriptionOptions
): Promise<string> {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    throw new Error('ASSEMBLYAI_API_KEY environment variable not set');
  }

  const request: AssemblyAITranscriptRequest = {
    audio_url: audioUrl,
    speaker_labels: options.enableDiarization !== false, // Default to true
    language_code: options.language || 'en',
  };

  if (options.speakerCount) {
    request.speakers_expected = options.speakerCount;
  }

  const response = await fetch(`${ASSEMBLYAI_API_URL}/transcript`, {
    method: 'POST',
    headers: {
      'Authorization': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to start transcription: ${errorText}`);
  }

  const data = await response.json() as AssemblyAITranscriptResponse;
  return data.id;
}

// Poll for transcription result
async function pollTranscription(transcriptId: string): Promise<AssemblyAITranscriptResponse> {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    throw new Error('ASSEMBLYAI_API_KEY environment variable not set');
  }

  const maxAttempts = 120; // 10 minutes max with 5-second intervals
  const pollInterval = 5000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(`${ASSEMBLYAI_API_URL}/transcript/${transcriptId}`, {
      method: 'GET',
      headers: {
        'Authorization': apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get transcription status: ${errorText}`);
    }

    const data = await response.json() as AssemblyAITranscriptResponse;

    if (data.status === 'completed') {
      return data;
    }

    if (data.status === 'error') {
      throw new Error(`Transcription failed: ${data.error || 'Unknown error'}`);
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error('Transcription timed out');
}

// Convert AssemblyAI response to our format
function convertToTranscript(response: AssemblyAITranscriptResponse): DiarizedTranscript {
  const segments: TranscriptSegment[] = [];
  const speakersSet = new Set<string>();

  if (response.utterances) {
    for (const utterance of response.utterances) {
      // Convert speaker label (e.g., "A" to "Speaker A")
      const speaker = `Speaker ${utterance.speaker}`;
      speakersSet.add(speaker);

      segments.push({
        speaker,
        text: utterance.text,
        startTime: utterance.start,
        endTime: utterance.end,
        confidence: utterance.confidence,
      });
    }
  }

  const speakers = Array.from(speakersSet).sort();
  const fullText = response.text || segments.map(s => s.text).join(' ');

  // Build formatted text with speaker labels
  const formattedText = segments
    .map(s => `${s.speaker}: ${s.text}`)
    .join('\n\n');

  return {
    segments,
    speakers,
    fullText,
    formattedText,
    duration: response.audio_duration ? response.audio_duration * 1000 : 0,
  };
}

/**
 * Main transcription function with speaker diarization
 */
export async function transcribeWithDiarization(
  audioData: string,
  mimeType: string,
  options: TranscriptionOptions = {}
): Promise<DiarizedTranscript> {
  // Upload audio
  console.log('Uploading audio to AssemblyAI...');
  const audioUrl = await uploadAudio(audioData, mimeType);

  // Start transcription with diarization
  console.log('Starting transcription...');
  const transcriptId = await startTranscription(audioUrl, {
    enableDiarization: true,
    ...options,
  });

  // Poll for completion
  console.log('Waiting for transcription to complete...');
  const result = await pollTranscription(transcriptId);

  // Convert to our format
  console.log('Transcription complete, processing results...');
  return convertToTranscript(result);
}

/**
 * Format transcript for display in the UI
 */
export function formatTranscriptForSource(transcript: DiarizedTranscript): string {
  if (transcript.segments.length === 0) {
    return transcript.fullText;
  }

  // Format with speaker labels and timestamps
  return transcript.segments
    .map(segment => {
      const minutes = Math.floor(segment.startTime / 60000);
      const seconds = Math.floor((segment.startTime % 60000) / 1000);
      const timestamp = `[${minutes}:${seconds.toString().padStart(2, '0')}]`;
      return `${timestamp} ${segment.speaker}: ${segment.text}`;
    })
    .join('\n\n');
}
