import { NextRequest, NextResponse } from 'next/server';
import type { PodcastScriptSegment, OpenAIVoice } from '@/types';

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
};

const encoder = new TextEncoder();

function sseEvent(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'An unknown error occurred';
}

async function synthesizeSpeech(
  text: string,
  voice: OpenAIVoice,
  model: 'tts-1' | 'tts-1-hd',
  apiKey: string,
): Promise<Buffer> {
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: text,
      voice,
      response_format: 'mp3',
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    if (response.status === 429) {
      throw new Error(`RATE_LIMIT: ${errBody}`);
    }
    throw new Error(`OpenAI TTS error (${response.status}): ${errBody}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function synthesizeWithRetry(
  text: string,
  voice: OpenAIVoice,
  model: 'tts-1' | 'tts-1-hd',
  apiKey: string,
  maxRetries: number = 2,
): Promise<Buffer | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await synthesizeSpeech(text, voice, model, apiKey);
    } catch (err) {
      const msg = errorMessage(err);
      if (msg.startsWith('RATE_LIMIT:') && attempt < maxRetries) {
        const delay = Math.pow(2, attempt + 1) * 1000;
        console.log(`[Podcast] TTS rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      if (attempt < maxRetries) {
        console.warn(`[Podcast] TTS attempt ${attempt + 1} failed: ${msg}, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      console.error(`[Podcast] TTS failed after ${maxRetries + 1} attempts: ${msg}`);
      return null;
    }
  }
  return null;
}

/**
 * TTS-only: takes edited script segments and synthesizes audio.
 * Streams progress via SSE.
 */
export async function POST(request: NextRequest) {
  try {
    const { segments, ttsModel } = await request.json() as {
      segments: PodcastScriptSegment[];
      ttsModel: 'tts-1' | 'tts-1-hd';
    };

    if (!segments || segments.length === 0) {
      return NextResponse.json(
        { error: 'Missing required field: segments' },
        { status: 400 }
      );
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured.' },
        { status: 500 }
      );
    }

    const stream = new ReadableStream({
      async start(controller) {
        let closed = false;
        const close = () => { if (!closed) { closed = true; controller.close(); } };

        try {
          const audioBuffers: Buffer[] = [];
          let failedCount = 0;
          const maxFailures = Math.ceil(segments.length * 0.2);

          for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            const percent = Math.round((i / segments.length) * 90);

            controller.enqueue(encoder.encode(sseEvent({
              phase: 'tts',
              message: `Synthesizing audio (${i + 1}/${segments.length})...`,
              percent,
              segmentIndex: i,
              totalSegments: segments.length,
            })));

            const audioBuffer = await synthesizeWithRetry(
              segment.text,
              segment.voice,
              ttsModel || 'tts-1',
              openaiKey,
            );

            if (audioBuffer) {
              audioBuffers.push(audioBuffer);
            } else {
              failedCount++;
              if (failedCount > maxFailures) {
                throw new Error(`Too many TTS failures (${failedCount}/${segments.length}). Aborting.`);
              }
            }
          }

          controller.enqueue(encoder.encode(sseEvent({
            phase: 'combining',
            message: 'Combining audio segments...',
            percent: 92,
          })));

          const totalLength = audioBuffers.reduce((sum, buf) => sum + buf.length, 0);
          const combinedBuffer = Buffer.concat(audioBuffers, totalLength);
          const audioBase64 = combinedBuffer.toString('base64');

          console.log(`[Podcast] Audio combined: ${totalLength} bytes, ${audioBuffers.length} chunks`);

          controller.enqueue(encoder.encode(sseEvent({
            phase: 'done',
            message: 'Podcast generated successfully!',
            percent: 100,
            audioBase64,
            scriptSegments: segments,
            failedSegments: failedCount,
          })));
        } catch (err) {
          console.error('[Podcast TTS] Error:', err);
          try {
            controller.enqueue(encoder.encode(sseEvent({
              phase: 'error',
              message: errorMessage(err),
              percent: 0,
            })));
          } catch { /* controller may be closed */ }
        } finally {
          close();
        }
      },
    });

    return new Response(stream, { headers: SSE_HEADERS });
  } catch (error) {
    console.error('[Podcast TTS] Route error:', error);
    return NextResponse.json(
      { error: 'Failed to start audio synthesis' },
      { status: 500 }
    );
  }
}
