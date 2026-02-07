'use server';

/**
 * @fileOverview AI-powered outline generation from a given topic.
 *
 * - generateOutlineFromTopic - A function that generates a structured outline from a topic.
 * - GenerateOutlineFromTopicInput - The input type for the generateOutlineFromTopic function.
 * - GenerateOutlineFromTopicOutput - The return type for the generateOutlineFromTopic function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { AIDepth } from '@/types';

const GenerateOutlineFromTopicInputSchema = z.object({
  topic: z
    .string()
    .describe('The topic for which to generate an outline.'),
  depth: z
    .enum(['quick', 'standard', 'deep'])
    .optional()
    .default('standard')
    .describe('The depth of analysis: quick (brief), standard (balanced), or deep (thorough).'),
});
export type GenerateOutlineFromTopicInput = z.infer<typeof GenerateOutlineFromTopicInputSchema>;

const GenerateOutlineFromTopicOutputSchema = z.object({
  outline: z
    .string()
    .describe('A structured, multi-level outline generated from the topic.'),
});
export type GenerateOutlineFromTopicOutput = z.infer<typeof GenerateOutlineFromTopicOutputSchema>;

// Depth-specific prompt instructions
const DEPTH_PROMPTS: Record<AIDepth, string> = {
  quick: `Generate a brief, high-level outline with 3-5 main sections. Focus on key concepts only. Keep it concise - no more than 2 levels deep.`,
  standard: `Generate a well-structured outline with 5-8 main sections. Include key subtopics and important details. Use 3-4 levels of hierarchy where appropriate.`,
  deep: `Generate a comprehensive, thoroughly researched outline. Think deeply about all aspects of this topic:

1. Consider multiple perspectives and viewpoints
2. Include historical context, current state, and future implications
3. Add supporting examples, evidence, and case studies
4. Explore connections to related topics
5. Identify potential controversies or debates
6. Include practical applications and real-world relevance

Use 4-6 levels of hierarchy. Be thorough and detailed - this should be an exhaustive treatment of the subject.`,
};

export async function generateOutlineFromTopic(input: GenerateOutlineFromTopicInput): Promise<GenerateOutlineFromTopicOutput> {
  const depth = input.depth || 'standard';
  const depthInstructions = DEPTH_PROMPTS[depth as AIDepth];

  const { output } = await ai.generate({
    prompt: `You are an expert outline generator. Generate a structured, multi-level outline for the following topic.

Topic: ${input.topic}

${depthInstructions}

Format the outline using markdown with proper heading levels (# for main sections, ## for subsections, etc.). Each section should have a clear, descriptive title.`,
  });

  return { outline: output?.text || '' };
}
