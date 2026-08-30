'use server';

/**
 * @fileOverview A flow to expand the content of a selected node using AI based on the node's title.
 *
 * - expandNodeContent - A function that handles expanding the node content with AI.
 * - ExpandNodeContentInput - The input type for the expandNodeContent function.
 * - ExpandNodeContentOutput - The return type for the expandNodeContent function.
 */

import { generateText } from '@/lib/ai/generate-text';
import type { TextProviderSelection } from '@/lib/ai/text-providers';

export interface ExpandNodeContentInput {
  title: string;
  /** Optional user-supplied Gemini key (BYOK). Falls back to GEMINI_API_KEY env var. */
  userApiKey?: string | null;
  /** The user's selected text provider + key + model (defaults to Gemini). */
  providerSelection?: TextProviderSelection | null;
}

export interface ExpandNodeContentOutput {
  content: string;
}

export async function expandNodeContent(input: ExpandNodeContentInput): Promise<ExpandNodeContentOutput> {
  const prompt = `You are an expert content writer.

You will be provided with a title for a node in an outline. Your task is to generate a detailed paragraph of content for that node based on the title.

Title: ${input.title}

Content:`;

  const { text } = await generateText({
    prompt,
    temperature: 0.7,
    maxOutputTokens: 1024,
    geminiApiKey: input.userApiKey,
    selection: input.providerSelection,
  });

  return { content: text };
}
