import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import type { NodeMap, PodcastConfig, PodcastScriptSegment, OpenAIVoice } from '@/types';
import { extractSubtreeContent, buildScriptPrompt, parseScriptResponse } from '@/lib/podcast-generator';

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

/**
 * Call OpenAI TTS API for a single text segment.
 * Returns the MP3 audio as a Buffer.
 */
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

/**
 * Retry a TTS call with exponential backoff.
 */
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
        // Exponential backoff: 2s, 4s
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
      return null; // Skip this segment
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { nodes, rootId, config } = await request.json() as {
      nodes: NodeMap;
      rootId: string;
      config: PodcastConfig;
    };

    if (!nodes || !rootId || !config) {
      return NextResponse.json(
        { error: 'Missing required fields: nodes, rootId, config' },
        { status: 400 }
      );
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured. Add OPENAI_API_KEY to your .env.local file to enable podcast generation.' },
        { status: 500 }
      );
    }

    const stream = new ReadableStream({
      async start(controller) {
        let closed = false;
        const close = () => { if (!closed) { closed = true; controller.close(); } };

        try {
          // Phase 1: Extract content and generate script
          controller.enqueue(encoder.encode(sseEvent({
            phase: 'script',
            message: 'Generating podcast script...',
            percent: 5,
          })));

          const content = extractSubtreeContent(nodes, rootId);
          if (!content.trim()) {
            throw new Error('No content found in the selected subtree');
          }

          const speakers = Object.keys(config.voices);
          const { system, user } = buildScriptPrompt(content, config.style, config.length, speakers);

          controller.enqueue(encoder.encode(sseEvent({
            phase: 'script',
            message: 'Waiting for AI to write the script...',
            percent: 10,
          })));

          // Use non-streaming generation for the script (we need the full text to parse JSON)
          const { text: scriptText } = await ai.generate({
            model: 'googleai/gemini-2.0-flash',
            prompt: `${system}\n\n${user}`,
          });

          controller.enqueue(encoder.encode(sseEvent({
            phase: 'script',
            message: 'Parsing script...',
            percent: 15,
          })));

          const segments = parseScriptResponse(scriptText, config.voices);
          console.log(`[Podcast] Script generated: ${segments.length} segments`);

          // Phase 2: Text-to-speech for each segment
          controller.enqueue(encoder.encode(sseEvent({
            phase: 'tts',
            message: `Synthesizing audio (0/${segments.length} segments)...`,
            percent: 15,
            totalSegments: segments.length,
            segmentIndex: 0,
          })));

          const audioBuffers: Buffer[] = [];
          let failedCount = 0;
          const maxFailures = Math.ceil(segments.length * 0.2); // Abort if >20% fail

          for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            const percent = 15 + Math.round((i / segments.length) * 75);

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
              config.ttsModel,
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

          // Phase 3: Combine audio
          controller.enqueue(encoder.encode(sseEvent({
            phase: 'combining',
            message: 'Combining audio segments...',
            percent: 92,
          })));

          const totalLength = audioBuffers.reduce((sum, buf) => sum + buf.length, 0);
          const combinedBuffer = Buffer.concat(audioBuffers, totalLength);
          const audioBase64 = combinedBuffer.toString('base64');

          console.log(`[Podcast] Audio combined: ${totalLength} bytes, ${audioBuffers.length} chunks`);

          // Phase 4: Done - send audio and script
          controller.enqueue(encoder.encode(sseEvent({
            phase: 'done',
            message: 'Podcast generated successfully!',
            percent: 100,
            audioBase64,
            scriptSegments: segments,
            failedSegments: failedCount,
          })));

        } catch (err) {
          console.error('[Podcast] Generation error:', err);
          try {
            controller.enqueue(encoder.encode(sseEvent({
              phase: 'error',
              message: errorMessage(err),
              percent: 0,
            })));
          } catch {
            // Controller may already be closed
          }
        } finally {
          close();
        }
      },
    });

    return new Response(stream, { headers: SSE_HEADERS });
  } catch (error) {
    console.error('[Podcast] Route error:', error);
    return NextResponse.json(
      { error: 'Failed to start podcast generation' },
      { status: 500 }
    );
  }
}
