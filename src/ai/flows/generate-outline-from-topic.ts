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
import type { AIDepth, AITone, AILevel } from '@/types';

const GenerateOutlineFromTopicInputSchema = z.object({
  topic: z
    .string()
    .describe('The topic for which to generate an outline.'),
  depth: z
    .enum(['quick', 'standard', 'deep'])
    .optional()
    .default('standard')
    .describe('The depth of analysis: quick (brief), standard (balanced), or deep (thorough).'),
  tone: z
    .enum(['academic', 'professional', 'friendly', 'storytelling'])
    .optional()
    .default('professional')
    .describe('The writing tone/voice.'),
  level: z
    .enum(['elementary', 'high-school', 'college', 'graduate', 'expert'])
    .optional()
    .default('college')
    .describe('The reading/complexity level.'),
});
export interface GenerateOutlineFromTopicInput {
  topic: string;
  depth?: AIDepth;
  tone?: AITone;
  level?: AILevel;
}

const GenerateOutlineFromTopicOutputSchema = z.object({
  outline: z
    .string()
    .describe('A structured, multi-level outline generated from the topic.'),
});
export type GenerateOutlineFromTopicOutput = z.infer<typeof GenerateOutlineFromTopicOutputSchema>;

// Depth-specific prompt instructions
const DEPTH_PROMPTS: Record<AIDepth, string> = {
  quick: `Generate a brief, high-level outline with 3-5 main sections and 2 levels deep.
Under each heading, write a short paragraph (2-3 sentences) summarizing the key points.`,
  standard: `Generate a well-structured outline with 5-8 main sections and 3-4 levels of hierarchy.
Under each heading, write 1-2 substantive paragraphs. Include specific facts, examples, and context.`,
  deep: `Generate a comprehensive, authoritative outline structured like a research monograph or technical reference book.

Structure: 5-8 major sections, 4-5 levels of hierarchy.

Think deeply about all aspects:
- Multiple perspectives, competing theories, and scholarly debates
- Historical context, current state of knowledge, and future directions
- Specific data points, case studies, key experiments, and named researchers
- Connections across disciplines and related fields
- Practical applications and real-world significance

Under each heading, write DETAILED content (2-4 paragraphs). Include:
- Specific facts, dates, names, quantities, and technical details
- Cause-and-effect explanations and mechanistic descriptions
- References to landmark studies, key publications, and notable figures
- Critical analysis — not just what happened, but why it matters`,
};

// Tone instructions
const TONE_PROMPTS: Record<AITone, string> = {
  academic: `Write in a scholarly, formal tone. Use precise terminology, cite theoretical frameworks, and maintain objectivity. Structure arguments with evidence and acknowledge limitations. Write as a professor authoring a peer-reviewed publication.`,
  professional: `Write in a clear, authoritative tone. Be direct and well-organized. Use domain-appropriate terminology but remain accessible. Write as an expert briefing knowledgeable colleagues.`,
  friendly: `Write in a warm, conversational tone. Use approachable language, relatable analogies, and an encouraging voice. Explain concepts as if helping a curious friend understand the topic. Use "you" and "we" naturally.`,
  storytelling: `Write in a vivid, narrative-driven tone. Open sections with compelling anecdotes, use descriptive language, and build dramatic tension. Connect facts through stories of real people, pivotal moments, and surprising discoveries. Make the reader feel they are there.`,
};

// Reading level instructions
const LEVEL_PROMPTS: Record<AILevel, string> = {
  elementary: `Write for a 3rd-5th grade reading level. Use simple, everyday words and short sentences. Explain big ideas with familiar comparisons (e.g., "as big as a school bus"). Avoid jargon entirely — if a technical term is needed, define it immediately in simple words.`,
  'high-school': `Write for a high school reading level. Use clear, straightforward language with moderate vocabulary. Introduce technical terms but always explain them. Use concrete examples to illustrate abstract concepts.`,
  college: `Write for a college-educated audience. Use standard academic vocabulary and domain terminology. Assume the reader has general knowledge but may be new to this specific field. Define specialized terms on first use.`,
  graduate: `Write for a graduate-level audience. Use advanced vocabulary and technical terminology freely. Assume familiarity with foundational concepts in the field. Discuss nuances, methodological considerations, and theoretical implications.`,
  expert: `Write for domain experts and specialists. Use full technical nomenclature without simplification. Assume deep background knowledge. Focus on cutting-edge developments, open questions, and subtle distinctions that only specialists would appreciate.`,
};

export async function generateOutlineFromTopic(input: GenerateOutlineFromTopicInput): Promise<GenerateOutlineFromTopicOutput> {
  const depth = input.depth || 'standard';
  const tone = input.tone || 'professional';
  const level = input.level || 'college';
  const depthInstructions = DEPTH_PROMPTS[depth as AIDepth];
  const toneInstructions = TONE_PROMPTS[tone as AITone];
  const levelInstructions = LEVEL_PROMPTS[level as AILevel];

  const response = await ai.generate({
    prompt: `You are an expert outline generator. Generate a structured, multi-level outline for the following topic.

Topic: ${input.topic}

DEPTH:
${depthInstructions}

WRITING TONE:
${toneInstructions}

READING LEVEL:
${levelInstructions}

CRITICAL FORMATTING RULES:
1. Use markdown heading levels: # for major parts, ## for chapters, ### for sections, #### for subsections
2. Headings must be SHORT (2-6 words). All detail goes in the BODY TEXT, never the heading.
3. Do NOT number headings (no "1.", "1.1", etc.) — hierarchy is conveyed by heading levels alone.
4. Body text goes directly below each heading. Maintain the specified tone and level consistently throughout.
5. Use markdown formatting in body text where appropriate:
   - **Bold** for key terms and important concepts when first introduced
   - Bullet lists for enumerating related items, methods, or factors
   - Paragraph breaks between distinct ideas
6. Every leaf section MUST have substantive content — never leave a section with just a heading and no body text.

EXAMPLE OF CORRECT FORMAT:

## Historical Context

The pursuit of low-energy nuclear reactions traces its origins to March 23, 1989, when electrochemists **Martin Fleischmann** and **Stanley Pons** of the University of Utah held a press conference announcing they had achieved nuclear fusion at room temperature. Their electrolysis experiment used **palladium** cathodes immersed in **heavy water** (D₂O), and they reported anomalous excess heat that could not be explained by known chemical processes.

The announcement triggered an unprecedented scientific controversy. Within weeks, laboratories worldwide attempted to replicate the results, with mixed outcomes.

### Early Experiments

Fleischmann and Pons employed a simple electrochemical cell consisting of a palladium rod cathode and a platinum wire anode submerged in an electrolyte of lithium deuteroxide dissolved in heavy water. They reported:

- **Excess heat** production of 10-20% above input power
- Intermittent **neutron emission** at levels above background
- Traces of **tritium** in the electrolyte after extended runs

EXAMPLE OF WRONG FORMAT (do NOT do this):
## 1.2. Historical Context: The Emergence and Development of Early Research
The field has a long history.`,
  });

  return { outline: response.text || '' };
}
