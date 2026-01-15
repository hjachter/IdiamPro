'use server';

import { generateOutlineFromTopic } from '@/ai/flows/generate-outline-from-topic';
import { expandNodeContent } from '@/ai/flows/expand-node-content';
import {
  extractPdfFromUrl,
  extractPdfFromFile,
  extractYoutubeTranscript,
  extractTextFromWebUrl,
  extractTextFromImage,
  extractTextFromDocument,
  transcribeAudio,
  transcribeVideo,
} from '@/lib/media-extractors';
import {
  transcribeWithDiarization,
  formatTranscriptForSource,
} from '@/lib/transcription-service';
import type {
  NodeGenerationContext,
  ExternalSourceInput,
  IngestPreview,
  BulkResearchSources,
  BulkResearchResult,
  Outline,
  DiarizedTranscript,
  TranscriptionOptions,
} from '@/types';
import { parseMarkdownToNodes } from '@/lib/outline-utils';
import { v4 as uuidv4 } from 'uuid';
import { ai } from '@/ai/genkit';

// Plan-aware configuration (server-side)
// function getPlanConfig(plan: SubscriptionPlan) {
//   return plan === 'PREMIUM'
//     ? { maxTokens: 4000, temperature: 0.8 }
//     : { maxTokens: 1000, temperature: 0.7 };
// }

export async function generateOutlineAction(
  topic: string
): Promise<string> {
  try {
    // Config can be passed to flow in future for model switching
    // const config = getPlanConfig(plan);
    const result = await generateOutlineFromTopic({ topic });
    return result.outline;
  } catch (error) {
    console.error('Error generating outline:', error);
    throw new Error('Failed to generate outline.');
  }
}

export async function expandContentAction(
  title: string
): Promise<string> {
  try {
    // const config = getPlanConfig(plan);
    const result = await expandNodeContent({ title });
    return result.content;
  } catch (error) {
    console.error('Error expanding content:', error);
    throw new Error('Failed to expand content.');
  }
}

/**
 * Generate content for a node with full context (ancestors, existing content)
 */
export async function generateContentForNodeAction(
  context: NodeGenerationContext
): Promise<string> {
  try {
    // const config = getPlanConfig(plan);

    // Build a rich prompt with context
    const ancestorContext = context.ancestorPath.length > 0
      ? `This node is located at: ${context.ancestorPath.join(' > ')} > ${context.nodeName}`
      : `This is a top-level node named: ${context.nodeName}`;

    const draftContext = context.existingContent
      ? `\n\nExisting draft content to consider:\n${context.existingContent}`
      : '';

    // For now, use the existing expandNodeContent flow with enhanced title
    const enhancedTitle = `${ancestorContext}${draftContext}\n\nGenerate detailed content for: ${context.nodeName}`;

    const result = await expandNodeContent({ title: enhancedTitle });
    return result.content;
  } catch (error) {
    console.error('Error generating content for node:', error);
    throw new Error('Failed to generate content for node.');
  }
}

/**
 * Ingest external source and return a preview of proposed changes
 * This does NOT apply changes - returns preview for user confirmation
 */
export async function ingestExternalSourceAction(
  source: ExternalSourceInput,
  existingOutlineSummary: string | undefined
): Promise<IngestPreview> {
  try {
    // const config = getPlanConfig(plan);

    // Extract content from source
    let extractedContent = '';
    let sourceDescription = '';

    if (source.type === 'text' && source.content) {
      extractedContent = source.content;
      sourceDescription = 'Text input';
    } else if (source.type === 'youtube' && source.url) {
      // Extract YouTube transcript
      extractedContent = await extractYoutubeTranscript(source.url);
      sourceDescription = `YouTube Video: ${source.url}`;
    } else if (source.type === 'pdf') {
      // Handle both PDF URL and file upload
      if (source.url) {
        extractedContent = await extractPdfFromUrl(source.url);
        sourceDescription = `PDF: ${source.url}`;
      } else if (source.content) {
        // File upload (base64 data)
        extractedContent = await extractPdfFromFile(source.content);
        sourceDescription = `PDF: ${source.fileName || 'Uploaded file'}`;
      }
    }

    if (!extractedContent) {
      throw new Error('No content could be extracted from the source.');
    }

    // Generate outline structure from content
    const outlinePrompt = existingOutlineSummary
      ? `You are helping build a research outline by integrating new source material into an existing structure.

CRITICAL INSTRUCTIONS:
1. Review the existing outline structure carefully
2. For each topic in the new content, check if it matches or belongs under an existing category
3. ONLY create new top-level categories if the content doesn't fit any existing category
4. Prefer adding sub-topics under existing categories rather than creating duplicates
5. If the new content overlaps with existing categories, merge it into those categories

Existing outline structure:
${existingOutlineSummary}

New content to integrate:
${extractedContent}

Output a structured outline showing ONLY the new nodes to add (with their proper parent paths).
Format: Use markdown list format with proper indentation to show hierarchy.`
      : `Create a structured outline from the following content:\n${extractedContent}`;

    const result = await generateOutlineFromTopic({ topic: outlinePrompt });

    // Parse the result into preview format
    // For now, return a simple preview structure
    const preview: IngestPreview = {
      nodesToAdd: parseMarkdownToPreviewNodes(result.outline),
      nodesToModify: [], // No modifications for new content
      summary: existingOutlineSummary
        ? `Proposing to add ${parseMarkdownToPreviewNodes(result.outline).length} new sections based on the external source.`
        : `Creating new outline with ${parseMarkdownToPreviewNodes(result.outline).length} sections from the external source.`,
    };

    return preview;
  } catch (error) {
    console.error('Error ingesting external source:', error);
    throw new Error('Failed to process external source.');
  }
}

/**
 * Helper: Parse markdown outline into preview nodes
 */
function parseMarkdownToPreviewNodes(markdown: string): IngestPreview['nodesToAdd'] {
  const lines = markdown.split('\n').filter(line => line.trim().startsWith('- '));
  const nodes: IngestPreview['nodesToAdd'] = [];
  const pathStack: string[] = [];

  lines.forEach(line => {
    const indentation = line.search(/\S|$/);
    const level = Math.floor(indentation / 2);
    const name = line.trim().substring(2);

    // Adjust path stack to current level
    while (pathStack.length > level) {
      pathStack.pop();
    }

    nodes.push({
      name,
      parentPath: pathStack.join(' > ') || 'Root',
      content: '', // Content would be generated separately
    });

    pathStack.push(name);
  });

  return nodes;
}

/**
 * Helper: Generate a concise title from content using AI
 */
async function generateTitleFromContent(content: string): Promise<string> {
  try {
    const { text } = await ai.generate({
      model: 'googleai/gemini-2.0-flash',
      prompt: `Generate a concise, descriptive title (5-10 words max) for the following content. Return ONLY the title, no quotes or explanation:

${content.substring(0, 3000)}`,
    });
    return text.trim().replace(/^["']|["']$/g, ''); // Remove any quotes
  } catch (error) {
    console.warn('Failed to generate title:', error);
    return 'Imported Content';
  }
}

/**
 * Helper: Extract content from a single source
 * Returns content, description, and optional title for naming
 */
async function extractContentFromSource(source: ExternalSourceInput): Promise<{ content: string; description: string; title?: string }> {
  let extractedContent = '';
  let sourceDescription = '';
  let sourceTitle: string | undefined;

  switch (source.type) {
    case 'text':
      if (source.content) {
        extractedContent = source.content;
        sourceDescription = 'Text input';
      }
      break;

    case 'youtube':
      if (source.url) {
        const ytResult = await extractYoutubeTranscript(source.url);
        extractedContent = ytResult.transcript;
        sourceTitle = ytResult.title;
        sourceDescription = `YouTube Video: ${ytResult.title}`;
      }
      break;

    case 'pdf':
      if (source.url) {
        extractedContent = await extractPdfFromUrl(source.url);
        sourceDescription = `PDF: ${source.url}`;
      } else if (source.content) {
        extractedContent = await extractPdfFromFile(source.content);
        sourceDescription = `PDF: ${source.fileName || 'Uploaded file'}`;
      }
      break;

    case 'web':
      if (source.url) {
        extractedContent = await extractTextFromWebUrl(source.url);
        sourceDescription = `Web Page: ${source.url}`;
      }
      break;

    case 'image':
      if (source.content) {
        extractedContent = await extractTextFromImage(source.content);
        sourceDescription = `Image: ${source.fileName || 'Uploaded image'}`;
      }
      break;

    case 'doc':
      if (source.content && source.fileName) {
        extractedContent = await extractTextFromDocument(source.content, source.fileName);
        sourceDescription = `Document: ${source.fileName}`;
      }
      break;

    case 'audio':
      if (source.content) {
        extractedContent = await transcribeAudio(source.content, source.fileName);
        sourceDescription = `Audio: ${source.fileName || 'Uploaded audio'}`;
      }
      break;

    case 'video':
      if (source.content) {
        extractedContent = await transcribeVideo(source.content, source.fileName);
        sourceDescription = `Video: ${source.fileName || 'Uploaded video'}`;
      }
      break;

    case 'recording':
      // Recording source - content is already the formatted transcript with speaker labels
      if (source.content) {
        extractedContent = source.content;
        sourceDescription = `Meeting Recording: ${source.fileName || 'Conversation transcript'}`;
      }
      break;

    case 'outline':
      if (source.content) {
        try {
          // Parse the outline file and extract all text content
          const outline = JSON.parse(source.content);
          const textParts: string[] = [];

          // Extract node names and content from the outline
          if (outline.nodes) {
            Object.values(outline.nodes).forEach((node: any) => {
              if (node.type !== 'root') {
                textParts.push(node.name);
                if (node.content) {
                  textParts.push(node.content);
                }
              }
            });
          }

          extractedContent = textParts.join('\n\n');
          sourceDescription = `Outline File: ${source.fileName || 'Imported outline'}`;
        } catch (error) {
          throw new Error('Failed to parse outline file');
        }
      }
      break;
  }

  return { content: extractedContent, description: sourceDescription, title: sourceTitle };
}

/**
 * Bulk Research Import (PREMIUM Feature)
 *
 * Extract content from multiple sources, synthesize with existing outline,
 * and regenerate entire outline with interrelationships.
 */
export async function bulkResearchIngestAction(
  input: BulkResearchSources,
  existingOutlineContent?: string
): Promise<BulkResearchResult> {
  try {
    // Extract content from all sources
    const extractedSources: Array<{ content: string; description: string; title?: string }> = [];

    for (const source of input.sources) {
      try {
        console.log(`Extracting from source type: ${source.type}, url: ${source.url || 'N/A'}`);
        const extracted = await extractContentFromSource(source);
        if (extracted.content) {
          console.log(`Successfully extracted ${extracted.content.length} chars from ${source.type}`);
          extractedSources.push(extracted);
        } else {
          console.log(`No content extracted from source type: ${source.type}`);
        }
      } catch (error) {
        console.error(`Failed to extract from source type ${source.type}:`, error instanceof Error ? error.message : error);
        // Continue with other sources even if one fails
      }
    }

    if (extractedSources.length === 0) {
      throw new Error('No content could be extracted from any of the provided sources.');
    }

    // Determine default outline name from first source's title, or generate one via AI
    let defaultOutlineName: string;
    if (input.includeExistingContent) {
      // When merging, use date-based name as we're adding to existing
      defaultOutlineName = `Research Synthesis ${new Date().toLocaleDateString()}`;
    } else {
      // For new outlines, use first source's title or generate one
      const firstSourceTitle = extractedSources[0]?.title;
      if (firstSourceTitle) {
        defaultOutlineName = firstSourceTitle;
      } else {
        // Generate title from first source content using AI
        console.log('Generating AI title from first source content...');
        defaultOutlineName = await generateTitleFromContent(extractedSources[0].content);
        console.log(`Generated title: "${defaultOutlineName}"`);
      }
    }

    // Build comprehensive research prompt
    const sourcesList = extractedSources.map((s, idx) =>
      `\n=== SOURCE ${idx + 1}: ${s.description} ===\n${s.content}`
    ).join('\n\n');

    const existingContentSection = input.includeExistingContent && existingOutlineContent
      ? `\n\n=== EXISTING OUTLINE CONTENT (to integrate) ===\n${existingOutlineContent}\n`
      : '';

    const researchPrompt = `You are creating a comprehensive research outline by synthesizing multiple sources.

TASK:
1. Analyze ALL sources provided below
2. Identify key themes, topics, and concepts across ALL sources
3. Find connections and interrelationships between different sources
4. Create a unified, hierarchical outline WITH CONTENT that:
   - Organizes information by theme/topic (not by source)
   - Shows relationships between concepts
   - Avoids duplication while preserving unique insights
   - Creates a logical flow for understanding the topic
   - INCLUDES substantive content for EVERY node from the source material
${input.includeExistingContent ? '5. Integrate the existing outline content into the new structure\n' : ''}
OUTPUT FORMAT:
- Use markdown list format with proper indentation
- Format: "- Node Title: Detailed content from the sources relevant to this topic"
- The content after the colon should include key points, quotes, facts, or discussion from the sources
- Use indentation to show hierarchy (2 spaces per level)
- CRITICAL: Every node MUST have substantive content, INCLUDING parent/chapter nodes
- Parent nodes should INTRODUCE and SUMMARIZE what their child nodes cover - they are not just headers!

EXAMPLE:
- Project Goals: The team outlined three strategic priorities for Q1, focusing on growth and product expansion. These goals represent a shift toward user retention and mobile-first strategy.
  - User Onboarding: Speaker A emphasized the importance of simplifying the signup flow. Current data shows 40% drop-off at step 3. The target is a 30% improvement.
  - Mobile App: The beta launch is scheduled for March. Key features include offline mode and push notifications. This addresses the #1 user request from surveys.

SOURCES TO SYNTHESIZE:
${sourcesList}${existingContentSection}

Generate the outline with content:`;

    const result = await generateOutlineFromTopic({ topic: researchPrompt });

    // Parse into full outline - use provided name, first source title, or date-based default
    const outlineName = input.outlineName || defaultOutlineName;
    const { rootNodeId, nodes } = parseMarkdownToNodes(result.outline, outlineName);

    // For NEW outlines (not merging), generate a summary for the root node
    if (!input.includeExistingContent) {
      // Collect all child node content for summarization
      const childContent = Object.values(nodes)
        .filter(n => n.id !== rootNodeId && n.content)
        .map(n => `${n.name}: ${n.content}`)
        .join('\n');

      if (childContent) {
        console.log('Generating root node summary...');
        // Retry with exponential backoff for rate limits
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            if (attempt > 0) {
              const delay = Math.pow(2, attempt) * 1000; // 2s, 4s
              console.log(`Retry attempt ${attempt + 1}, waiting ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
            const { text: rootSummary } = await ai.generate({
              model: 'googleai/gemini-2.0-flash',
              prompt: `Write a brief, non-technical introduction (2-4 sentences) that summarizes the following outline content. This will help readers quickly understand what this document covers. Be conversational and accessible:

${childContent.substring(0, 5000)}`,
            });
            nodes[rootNodeId].content = rootSummary.trim();
            console.log('Root summary generated successfully');
            break; // Success, exit retry loop
          } catch (summaryError: any) {
            const isRateLimit = summaryError?.message?.includes('429') || summaryError?.message?.includes('Resource exhausted');
            if (isRateLimit && attempt < 2) {
              console.warn(`Rate limited, will retry (attempt ${attempt + 1}/3)`);
            } else {
              console.warn('Failed to generate root summary:', summaryError);
              // Set a better fallback than the generic template
              const topicNames = Object.values(nodes)
                .filter(n => n.parentId === rootNodeId)
                .map(n => n.name)
                .slice(0, 5);
              if (topicNames.length > 0) {
                nodes[rootNodeId].content = `This outline covers ${topicNames.join(', ')}${topicNames.length < Object.values(nodes).filter(n => n.parentId === rootNodeId).length ? ', and more' : ''}.`;
              }
              break;
            }
          }
        }
      }
    }

    const outline: Outline = {
      id: uuidv4(),
      name: outlineName,
      rootNodeId,
      nodes,
      lastModified: Date.now(),
    };

    return {
      outline,
      summary: `Successfully synthesized ${extractedSources.length} source${extractedSources.length > 1 ? 's' : ''} into a unified outline with ${Object.keys(nodes).length - 1} nodes.`,
      sourcesProcessed: extractedSources.length,
    };
  } catch (error) {
    console.error('Error in bulk research ingest:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to process bulk research import: ${message}`);
  }
}

/**
 * Transcribe Recording with Speaker Diarization (PREMIUM Feature)
 *
 * Takes recorded audio and returns a transcript with speaker labels
 * using AssemblyAI for transcription with diarization.
 */
export async function transcribeRecordingAction(
  audioData: string,
  mimeType: string,
  options: TranscriptionOptions = {}
): Promise<{
  success: boolean;
  transcript?: DiarizedTranscript;
  formattedText?: string;
  error?: string;
}> {
  try {
    // Transcribe with diarization
    const transcript = await transcribeWithDiarization(audioData, mimeType, options);

    // Format for source integration
    const formattedText = formatTranscriptForSource(transcript);

    return {
      success: true,
      transcript,
      formattedText,
    };
  } catch (error) {
    console.error('Error in transcription:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Transcription failed',
    };
  }
}
