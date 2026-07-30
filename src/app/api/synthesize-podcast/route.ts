import { NextRequest, NextResponse } from 'next/server';
import type { PodcastScriptSegment, OpenAIVoice } from '@/types';
import { enforcePaidFeature } from '@/lib/billing/paid-feature-gate';
import { getCompanyKey } from '@/lib/billing/company-keys';
import { guardSensitiveRoute } from '@/lib/access/approval-guard';

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
};

const encoder = new TextEncoder();

// Gentle pacing between TTS calls so a long podcast (30+ segments) does not
// fire a burst that trips OpenAI's per-minute rate limit. Sequential calls
// already take ~1-3s each; this adds a little extra breathing room.
const PACE_BETWEEN_SEGMENTS_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
      // Preserve any Retry-After the API sends so we can honor its pace.
      const retryAfter = parseInt(response.headers.get('retry-after') ?? '', 10);
      const secs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : '';
      throw new Error(`RATE_LIMIT:${secs}:${errBody}`);
    }
    throw new Error(`OpenAI TTS error (${response.status}): ${errBody}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Synthesize one segment, retrying hard on failure. Prefers pacing/backoff
 * over giving up: rate-limit (429) responses get exponential backoff with
 * jitter (honoring Retry-After when present); other transient errors get a
 * shorter backoff. Returns null ONLY after every retry is exhausted, so the
 * caller can skip that single segment rather than lose the whole podcast.
 */
async function synthesizeWithRetry(
  text: string,
  voice: OpenAIVoice,
  model: 'tts-1' | 'tts-1-hd',
  apiKey: string,
  maxRetries: number = 6,
): Promise<Buffer | null> {
  let lastMsg = '';
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await synthesizeSpeech(text, voice, model, apiKey);
    } catch (err) {
      const msg = errorMessage(err);
      lastMsg = msg;
      if (attempt >= maxRetries) break;

      let delay: number;
      if (msg.startsWith('RATE_LIMIT:')) {
        // Message shape: "RATE_LIMIT:<suggestedSecs>:<body>"
        const suggested = parseInt(msg.split(':')[1] ?? '', 10);
        const base = Number.isFinite(suggested) && suggested > 0
          ? suggested * 1000
          : Math.min(Math.pow(2, attempt) * 1000, 32000); // 1s,2s,4s… capped 32s
        delay = base + Math.floor(Math.random() * 1000); // jitter to de-sync
        console.log(`[Podcast] TTS rate limited, backing off ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
      } else {
        delay = Math.min(Math.pow(2, attempt) * 500, 8000) + Math.floor(Math.random() * 500);
        console.warn(`[Podcast] TTS attempt ${attempt + 1} failed: ${msg}, retrying in ${delay}ms...`);
      }
      await sleep(delay);
    }
  }
  console.error(`[Podcast] TTS failed after ${maxRetries + 1} attempts: ${lastMsg}`);
  return null;
}

/**
 * TTS-only: takes edited script segments and synthesizes audio.
 * Streams progress via SSE.
 */
export async function POST(request: NextRequest) {
  // Approval + rate limit. TTS synthesis spends real AI money, so gate it to
  // approved accounts with a low per-minute cap.
  const blocked = await guardSensitiveRoute(request, {
    routeId: 'synthesize-podcast',
    perMinute: 6,
  });
  if (blocked) return blocked;

  try {
    const _body = await request.json() as {
      segments: PodcastScriptSegment[];
      ttsModel: 'tts-1' | 'tts-1-hd';
      userOpenaiKey?: string;
    };
    const { segments, ttsModel } = _body;

    if (!segments || segments.length === 0) {
      return NextResponse.json(
        { error: 'Missing required field: segments' },
        { status: 400 }
      );
    }

    // Premium AI voice is a PAID-per-use feature. It may run ONLY on the
    // user's own key (BYOK) or a funded COMPANY key — NEVER the founder's
    // personal env key. The shared server gate enforces plan + lifetime taste.
    const userOpenaiKey = typeof _body.userOpenaiKey === 'string' ? _body.userOpenaiKey.trim() : '';
    const isByok = userOpenaiKey.length > 0;
    const decision = await enforcePaidFeature('premiumVoice', { isByok });
    if (!decision.ok) {
      return NextResponse.json(
        { error: decision.error, upgradeRequired: decision.upgradeRequired },
        { status: decision.status }
      );
    }
    const openaiKey = decision.fund === 'byok' ? userOpenaiKey : getCompanyKey('premiumVoice');
    if (!openaiKey) {
      return NextResponse.json(
        { error: 'The premium AI voice needs your own OpenAI key. Add one in Settings → AI Service Keys.', upgradeRequired: true },
        { status: 402 }
      );
    }

    const stream = new ReadableStream({
      async start(controller) {
        let closed = false;
        const close = () => { if (!closed) { closed = true; controller.close(); } };

        try {
          const audioBuffers: Buffer[] = [];
          let failedCount = 0;

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
              // A single segment gave up after all retries. Do NOT throw the
              // whole podcast away — skip it (leaves a brief gap) and continue.
              failedCount++;
              console.warn(`[Podcast] Skipping segment ${i + 1}/${segments.length} after exhausting retries.`);
            }

            // Pace the next call so we don't burst past the rate limit.
            if (i < segments.length - 1) {
              await sleep(PACE_BETWEEN_SEGMENTS_MS);
            }
          }

          // Only hard-fail if essentially everything failed — otherwise ship
          // what we finished.
          if (audioBuffers.length === 0) {
            throw new Error('The AI voice service was unavailable (likely rate limits) so no audio could be generated. Please wait a minute and try again.');
          }

          controller.enqueue(encoder.encode(sseEvent({
            phase: 'combining',
            message: 'Combining audio segments...',
            percent: 92,
          })));

          const totalLength = audioBuffers.reduce((sum, buf) => sum + buf.length, 0);
          const combinedBuffer = Buffer.concat(audioBuffers, totalLength);
          const audioBase64 = combinedBuffer.toString('base64');

          console.log(`[Podcast] Audio combined: ${totalLength} bytes, ${audioBuffers.length} chunks, ${failedCount} skipped`);

          controller.enqueue(encoder.encode(sseEvent({
            phase: 'done',
            message: failedCount > 0
              ? `Podcast ready — ${failedCount} short segment${failedCount === 1 ? ' was' : 's were'} skipped due to voice-service limits.`
              : 'Podcast generated successfully!',
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
