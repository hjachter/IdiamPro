import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import type { NodeMap, PodcastConfig } from '@/types';
import {
  extractSubtreeContent,
  buildScriptPrompt,
  buildContinuePrompt,
  generateScriptIteratively,
  countScriptWords,
  LENGTH_TARGETS,
} from '@/lib/podcast-generator';
import type { PodcastScriptSegment } from '@/types';
import { getDefaultGeminiModel } from '@/config/gemini-models';
import { generateWithOllama } from '@/lib/ollama-service';
import { runAIWithFailover, type AIProviderChoice } from '@/lib/ai-failover';
import { guardSensitiveRoute } from '@/lib/access/approval-guard';

/**
 * Generate only the podcast script (no TTS).
 * Accepts either a custom prompt or builds one from nodes + config.
 */
export async function POST(request: NextRequest) {
  // Approval + rate limit. Script generation is an AI call — approved-only.
  const blocked = await guardSensitiveRoute(request, {
    routeId: 'generate-podcast-script',
    perMinute: 10,
  });
  if (blocked) return blocked;

  try {
    const body = await request.json() as {
      nodes?: NodeMap;
      rootId?: string;
      config: PodcastConfig;
      customPrompt?: string; // If provided, use this instead of building from nodes
      aiProvider?: AIProviderChoice; // Cloud / Local / Auto — honors the user's setting like Help chat
      geminiKeyIsByok?: boolean;
    };

    const { config, customPrompt } = body;

    if (!config) {
      return NextResponse.json(
        { error: 'Missing required field: config' },
        { status: 400 }
      );
    }

    let prompt: string;
    // The raw source material used for CONTINUE passes (so the model can keep
    // covering topics it hasn't reached yet). For the custom-prompt path the
    // source is embedded in the prompt itself, so we reuse that.
    let sourceContent: string;

    if (customPrompt) {
      // User provided an edited prompt
      prompt = customPrompt;
      sourceContent = customPrompt;
    } else {
      // Build prompt from nodes
      const { nodes, rootId } = body;
      if (!nodes || !rootId) {
        return NextResponse.json(
          { error: 'Missing required fields: nodes, rootId (or provide customPrompt)' },
          { status: 400 }
        );
      }

      const content = extractSubtreeContent(nodes, rootId);
      if (!content.trim()) {
        return NextResponse.json(
          { error: 'No content found in the selected branch' },
          { status: 400 }
        );
      }

      const speakers = Object.keys(config.voices);
      const { system, user } = buildScriptPrompt(content, config.style, config.length, speakers);
      prompt = `${system}\n\n${user}`;
      sourceContent = content;
    }

    const speakers = Object.keys(config.voices);
    const target = LENGTH_TARGETS[config.length];

    // One generation pass through the same failover path (cloud → OpenRouter →
    // local Gemma) used by Help chat. `promptText` is the first-pass prompt on
    // pass 1, or a CONTINUE prompt on later passes. Non-streaming throughout.
    const runOnePass = async (promptText: string): Promise<string> => {
      const result = await runAIWithFailover({
        provider: body.aiProvider ?? 'auto',
        cloudKeyIsByok: body.geminiKeyIsByok ?? false,
        cloudProviderName: 'Gemini',
        openRouterPrompt: promptText,
        cloudAttempt: async () => {
          const { text } = await ai.generate({
            model: getDefaultGeminiModel('genkit'),
            prompt: promptText,
            config: {
              maxOutputTokens: 16384,
              temperature: 0.9,
            },
          });
          return text;
        },
        localAttempt: async (model) =>
          generateWithOllama({ model, prompt: promptText, maxTokens: 16384, temperature: 0.9 }),
      });
      return result.text;
    };

    // Stream the iterative generation as newline-delimited JSON so the client can
    // show a DETERMINATE progress bar. After each pass we emit a `progress` event
    // with the running segment count; the final `done` event carries the full
    // script. All the iterative generation logic below is unchanged — we only
    // report after each pass. (Errors mid-stream are emitted as an `error` event.)
    const runPass = (segmentsSoFar: PodcastScriptSegment[] | null) =>
      segmentsSoFar === null
        ? runOnePass(prompt)
        : runOnePass(
            buildContinuePrompt(
              sourceContent,
              config.style,
              config.length,
              speakers,
              segmentsSoFar,
            ),
          );

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const emit = (obj: unknown) =>
          controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
        try {
          // Generate ITERATIVELY: first pass, then CONTINUE passes until the
          // script actually reaches the target length (LLMs habitually stop long
          // scripts early). Short lengths that already hit target stay
          // single-pass — no wasted calls. Hard-capped at MAX_SCRIPT_PASSES;
          // stops early on no progress.
          const { segments, passes } = await generateScriptIteratively({
            target,
            voiceMap: config.voices,
            runPass,
            onProgress: ({ pass, maxPasses, segments: count }) =>
              emit({ type: 'progress', pass, maxPasses, segments: count }),
          });

          if (segments.length < 4) {
            console.warn(
              `[Podcast] Suspiciously few segments (${segments.length}) after ${passes} pass(es).`
            );
          }
          console.log(
            `[Podcast] Script generated in ${passes} pass(es): ${segments.length} segments, ` +
              `~${countScriptWords(segments)} words (target ${target.min}-${target.max} words / ` +
              `${target.minSegments}+ segments).`
          );

          emit({ type: 'done', segments });
        } catch (error: any) {
          console.error('[Podcast Script] Error:', error);
          emit({ type: 'error', error: error.message || 'Failed to generate script' });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  } catch (error: any) {
    console.error('[Podcast Script] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate script' },
      { status: 500 }
    );
  }
}
