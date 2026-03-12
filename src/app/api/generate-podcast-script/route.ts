import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import type { NodeMap, PodcastConfig } from '@/types';
import { extractSubtreeContent, buildScriptPrompt, parseScriptResponse } from '@/lib/podcast-generator';

/**
 * Generate only the podcast script (no TTS).
 * Accepts either a custom prompt or builds one from nodes + config.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      nodes?: NodeMap;
      rootId?: string;
      config: PodcastConfig;
      customPrompt?: string; // If provided, use this instead of building from nodes
    };

    const { config, customPrompt } = body;

    if (!config) {
      return NextResponse.json(
        { error: 'Missing required field: config' },
        { status: 400 }
      );
    }

    let prompt: string;

    if (customPrompt) {
      // User provided an edited prompt
      prompt = customPrompt;
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
          { error: 'No content found in the selected subtree' },
          { status: 400 }
        );
      }

      const speakers = Object.keys(config.voices);
      const { system, user } = buildScriptPrompt(content, config.style, config.length, speakers);
      prompt = `${system}\n\n${user}`;
    }

    // Generate script with AI
    const { text: scriptText } = await ai.generate({
      model: 'googleai/gemini-2.0-flash',
      prompt,
      config: {
        maxOutputTokens: 8192,
        temperature: 0.9,
      },
    });

    const segments = parseScriptResponse(scriptText, config.voices);
    console.log(`[Podcast] Script generated: ${segments.length} segments`);

    return NextResponse.json({ segments });
  } catch (error: any) {
    console.error('[Podcast Script] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate script' },
      { status: 500 }
    );
  }
}
