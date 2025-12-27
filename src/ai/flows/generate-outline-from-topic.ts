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

const GenerateOutlineFromTopicInputSchema = z.object({
  topic: z
    .string()
    .describe('The topic for which to generate an outline.'),
});
export type GenerateOutlineFromTopicInput = z.infer<typeof GenerateOutlineFromTopicInputSchema>;

const GenerateOutlineFromTopicOutputSchema = z.object({
  outline: z
    .string()
    .describe('A structured, multi-level outline generated from the topic.'),
});
export type GenerateOutlineFromTopicOutput = z.infer<typeof GenerateOutlineFromTopicOutputSchema>;

export async function generateOutlineFromTopic(input: GenerateOutlineFromTopicInput): Promise<GenerateOutlineFromTopicOutput> {
  return generateOutlineFromTopicFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateOutlineFromTopicPrompt',
  input: {schema: GenerateOutlineFromTopicInputSchema},
  output: {schema: GenerateOutlineFromTopicOutputSchema},
  prompt: `You are an expert outline generator. Generate a structured, multi-level outline for the following topic:\n\nTopic: {{{topic}}}`,
});

const generateOutlineFromTopicFlow = ai.defineFlow(
  {
    name: 'generateOutlineFromTopicFlow',
    inputSchema: GenerateOutlineFromTopicInputSchema,
    outputSchema: GenerateOutlineFromTopicOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
