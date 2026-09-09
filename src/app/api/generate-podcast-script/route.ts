import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import type { NodeMap, PodcastConfig } from '@/types';
import {
  extractSubtreeContent,
  buildScriptPrompt,
  buildContinuePrompt,
  buildSectionScriptPrompt,
  generateScriptIteratively,
  parseScriptResponse,
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
      /**
       * Content-compiler Phase 1 (sectioned mode): generate the script one
       * SECTION (outline branch) at a time so every returned segment is
       * traceable to its source nodes and unchanged branches can be reused on
       * regeneration. Jobs arrive in show order and may be a SUBSET of the
       * show's sections (selective regeneration) — reused neighbors provide
       * `prevTail` for conversational continuity. Uses the exact same
       * provider/key failover path as the whole-outline mode.
       */
      sectionJobs?: Array<{
        index: number;
        title: string;
        content: string;
        targetWords: number;
        minSegments: number;
        prevTail?: { speaker: string; text: string }[];
      }>;
      showTitle?: string;
      sectionTitles?: string[];
    };

    const { config, customPrompt } = body;

    if (!config) {
      return NextResponse.json(
        { error: 'Missing required field: config' },
        { status: 400 }
      );
    }

    // ── Sectioned mode (content-compiler Phase 1) ─────────────────────────
    if (Array.isArray(body.sectionJobs) && body.sectionJobs.length > 0) {
      const jobs = body.sectionJobs;
      const sectionTitles = Array.isArray(body.sectionTitles) && body.sectionTitles.length > 0
        ? body.sectionTitles
        : jobs.map((j) => j.title);
      const showTitle = body.showTitle || sectionTitles[0] || 'Podcast';
      const speakers = Object.keys(config.voices);

      const runOnePassSectioned = async (promptText: string): Promise<string> => {
        const result = await runAIWithFailover({
          provider: body.aiProvider ?? 'auto',
          cloudKeyIsByok: body.geminiKeyIsByok ?? false,
          cloudProviderName: 'Gemini',
          openRouterPrompt: promptText,
          cloudAttempt: async () => {
            const { text } = await ai.generate({
              model: getDefaultGeminiModel('genkit'),
              prompt: promptText,
              config: { maxOutputTokens: 8192, temperature: 0.9 },
            });
            return text;
          },
          localAttempt: async (model) =>
            generateWithOllama({ model, prompt: promptText, maxTokens: 8192, temperature: 0.9 }),
        });
        return result.text;
      };

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const emit = (obj: unknown) =>
            controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
          try {
            // Tails of sections generated IN THIS RUN, by section index — when
            // the next job is the immediately following section, its freshest
            // possible lead-in is what we just wrote, not the client-supplied
            // (previous-version) tail.
            const freshTails = new Map<number, { speaker: string; text: string }[]>();
            let running = 0;
            for (let j = 0; j < jobs.length; j++) {
              const job = jobs[j];
              emit({ type: 'section-start', index: job.index, of: sectionTitles.length, done: j, jobs: jobs.length });
              const prevTail = freshTails.get(job.index - 1) ?? job.prevTail;
              const prompt = buildSectionScriptPrompt({
                style: config.style,
                speakerNames: speakers,
                showTitle,
                sectionTitles,
                sectionIndex: job.index,
                content: job.content,
                targetWords: job.targetWords,
                minSegments: job.minSegments,
                prevTail,
              });
              // One retry on an unreadable response — bounded cost, better odds.
              let segments;
              try {
                segments = parseScriptResponse(await runOnePassSectioned(prompt), config.voices);
              } catch {
                segments = parseScriptResponse(await runOnePassSectioned(prompt), config.voices);
              }
              freshTails.set(job.index, segments.slice(-2).map((s) => ({ speaker: s.speaker, text: s.text })));
              running += segments.length;
              emit({ type: 'section', index: job.index, segments });
              emit({ type: 'progress', segments: running, jobsDone: j + 1, jobs: jobs.length });
            }
            console.log(`[Podcast] Sectioned script: ${jobs.length} section(s), ${running} segments total.`);
            emit({ type: 'done', mode: 'sectioned' });
          } catch (error: any) {
            console.error('[Podcast Script] Sectioned error:', error);
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
