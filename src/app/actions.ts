'use server';

import { generateOutlineFromTopic } from '@/ai/flows/generate-outline-from-topic';
import { expandNodeContent } from '@/ai/flows/expand-node-content';
import { suggestTags } from '@/ai/flows/suggest-tags';
import { translateNodeContent, type TranslateNodeInput } from '@/ai/flows/translate-node-content';
import { reformatContent, type ReformatContentInput, type ReformatContentResult } from '@/ai/flows/reformat-content';
import { transformOutline, type TransformOutlineInput, type TransformOutlineResult } from '@/ai/flows/transform-outline';
import { generateEmail, type GenerateEmailInput, type GenerateEmailResult } from '@/ai/flows/generate-email';
import { distillVoiceProfile, type DistillVoiceProfileInput, type DistillVoiceProfileResult } from '@/ai/flows/distill-voice-profile';
import { generateSocialPost, type GenerateSocialPostInput, type GenerateSocialPostResult } from '@/ai/flows/generate-social-post';
import { generateInstagramPost, type GenerateInstagramInput, type GenerateInstagramResult } from '@/ai/flows/generate-instagram-post';
import { generateYoutubePackage, type GenerateYoutubePackageInput, type GenerateYoutubePackageResult } from '@/ai/flows/generate-youtube-package';
import { interpretCommand, type InterpretCommandInput, type InterpretedCommand } from '@/ai/flows/interpret-command';
import { transcribeAudio as transcribeAudioWithGemini, type TranscribeAudioInput, type TranscribeAudioResult } from '@/ai/flows/transcribe-audio';
import { refreshNodeContent, type RefreshNodeInput } from '@/ai/flows/refresh-node-content';
import {
  extractPdfFromUrl,
  extractPdfFromFile,
  extractYoutubeTranscript,
  extractTextFromWebUrl,
  extractTextFromImage,
  extractTextFromDocument,
  transcribeAudio,
  transcribeVideo,
  getYoutubeTitle,
} from '@/lib/media-extractors';
import {
  transcribeWithDiarization,
  formatTranscriptForSource,
} from '@/lib/transcription-service';
import { enforcePaidFeature } from '@/lib/billing/paid-feature-gate';
import { getCompanyKey } from '@/lib/billing/company-keys';
import type {
  NodeGenerationContext,
  ExternalSourceInput,
  IngestPreview,
  BulkResearchSources,
  BulkResearchResult,
  EmailImportInput,
  EmailImportResult,
  Outline,
  DiarizedTranscript,
  TranscriptionOptions,
  MergeStrategy,
  AIDepth,
  AITone,
  AILevel,
} from '@/types';
import { parseMarkdownToNodes, stripMarkdownFromTitle } from '@/lib/outline-utils';
import { v4 as uuidv4 } from 'uuid';
import { ai } from '@/ai/genkit';
import { GoogleGenAI } from '@google/genai';
import { getDefaultGeminiModel } from '@/config/gemini-models';
import {
  isOllamaAvailable,
  getOllamaModels,
  generateWithOllama,
  getBestAvailableModel,
  type OllamaModel,
} from '@/lib/ollama-service';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Extract retry delay from rate limit error messages
 * Looks for patterns like "retry in 55.547081133s" or "retryDelay":"55s"
 */
function extractRetryDelay(errorMessage: string): number | null {
  // Match "retry in Xs" or "retry in X.XXXs"
  const retryMatch = errorMessage.match(/retry in (\d+(?:\.\d+)?)\s*s/i);
  if (retryMatch) {
    return Math.ceil(parseFloat(retryMatch[1]));
  }
  // Match "retryDelay":"Xs"
  const delayMatch = errorMessage.match(/"retryDelay"\s*:\s*"(\d+)s"/);
  if (delayMatch) {
    return parseInt(delayMatch[1]);
  }
  return null;
}

/**
 * Execute an async function with automatic retry on rate limits
 * Detects "retry in X seconds" and waits accordingly
 * Optionally falls back to Ollama on exhausted retries
 */
async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 1,  // One retry, then fallback to Ollama (if provided)
  operationName: string = 'operation',
  ollamaFallback?: () => Promise<T>
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      const isRateLimit = errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('rate');

      if (isRateLimit && attempt < maxRetries) {
        // Try to extract the suggested retry delay
        let waitTime = extractRetryDelay(errorMsg);

        if (waitTime) {
          // Add a buffer and ensure minimum wait of 30 seconds
          waitTime = Math.max(waitTime + 10, 30);
          console.log(`Rate limited on ${operationName}. Waiting ${waitTime} seconds before retry (attempt ${attempt + 1}/${maxRetries})...`);
        } else {
          // Default to exponential backoff if no delay specified
          waitTime = Math.pow(2, attempt + 1) * 30; // 60s, 120s
          console.log(`Rate limited on ${operationName}. Waiting ${waitTime} seconds before retry (attempt ${attempt + 1}/${maxRetries})...`);
        }

        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
        continue;
      }

      // If we've exhausted retries and have Ollama fallback, try it
      if (isRateLimit && ollamaFallback) {
        console.log(`Rate limit exhausted. Attempting Ollama fallback for ${operationName}...`);
        try {
          const ollamaAvailable = await isOllamaAvailable();
          if (ollamaAvailable) {
            console.log('Ollama is available, using local model...');
            return await ollamaFallback();
          } else {
            console.log('Ollama not available for fallback');
          }
        } catch (ollamaError) {
          console.warn('Ollama fallback failed:', ollamaError);
        }
      }

      throw error;
    }
  }
  throw new Error(`${operationName} failed after ${maxRetries} retries`);
}

// Plan-aware configuration (server-side)
// function getPlanConfig(plan: SubscriptionPlan) {
//   return plan === 'PREMIUM'
//     ? { maxTokens: 4000, temperature: 0.8 }
//     : { maxTokens: 1000, temperature: 0.7 };
// }

/**
 * Get YouTube video title from URL (lightweight, no transcript fetch)
 */
export async function getYoutubeTitleAction(url: string): Promise<string | null> {
  try {
    return await getYoutubeTitle(url);
  } catch (error) {
    console.error('Error fetching YouTube title:', error);
    return null;
  }
}

// ============================================
// Ollama (Local AI) Server Actions
// ============================================

/**
 * Check if Ollama is running and available
 */
export async function checkOllamaStatusAction(): Promise<{
  available: boolean;
  models: OllamaModel[];
  recommendedModel: string | null;
}> {
  const available = await isOllamaAvailable();
  if (!available) {
    return { available: false, models: [], recommendedModel: null };
  }

  const models = await getOllamaModels();
  const recommendedModel = await getBestAvailableModel();

  return { available, models, recommendedModel };
}

/**
 * Generate outline using local Ollama model
 */
export async function generateOutlineWithOllamaAction(
  topic: string,
  model?: string
): Promise<string> {
  const systemPrompt = `You are an expert at creating hierarchical outlines.
Create a well-structured markdown outline for the given topic.
Use proper indentation with "- " for each level.
Include 3-5 main sections with 2-4 subsections each.
Be comprehensive but concise.`;

  const result = await generateWithOllama({
    model,
    prompt: topic,
    system: systemPrompt,
    temperature: 0.7,
    maxTokens: 3000,
  });

  return result;
}

/**
 * Generate content for a node using local Ollama model
 */
export async function expandNodeContentWithOllamaAction(
  nodeName: string,
  ancestorPath: string[],
  existingContent: string,
  customPrompt?: string,
  model?: string
): Promise<string> {
  const context = ancestorPath.length > 0
    ? `Context: This is a section about "${nodeName}" within the broader topic of "${ancestorPath.join(' > ')}".`
    : `Topic: "${nodeName}"`;

  const systemPrompt = `You are a helpful writing assistant. Generate informative, well-written content for outline nodes.
Write in a clear, professional style. Be informative but concise.
${existingContent ? 'Build upon or enhance the existing content.' : 'Create new content from scratch.'}`;

  const userPrompt = customPrompt
    ? `${context}\n\nUser request: ${customPrompt}\n\n${existingContent ? `Existing content:\n${existingContent}` : ''}`
    : `${context}\n\nWrite informative content (2-4 paragraphs) for this section.\n\n${existingContent ? `Existing content to enhance:\n${existingContent}` : ''}`;

  const result = await generateWithOllama({
    model,
    prompt: userPrompt,
    system: systemPrompt,
    temperature: 0.7,
    maxTokens: 2000,
  });

  return result;
}

export async function generateOutlineAction(
  topic: string,
  depth: AIDepth = 'standard',
  tone: AITone = 'professional',
  level: AILevel = 'college',
  userApiKey?: string | null,
  useLocal: boolean = false,
): Promise<string> {
  try {
    // Cost-free local path: route straight to on-device Ollama (Gemma). Used
    // when the user picked the Local provider — never bills a hosted key.
    if (useLocal) {
      const md = await generateWithOllama({
        system:
          'You are an expert author creating a structured book outline. Output ONLY GitHub-flavored markdown: a single "# Title" line, then "## Chapter" headings, then "### Section" headings under each chapter. No prose outside headings.',
        prompt: `Create a detailed book outline for the topic: "${topic}".\nTone: ${tone}. Depth: ${depth}. Audience level: ${level}.\nUse "# ${topic}" as the title, 4-6 "## " chapters, and 2-4 "### " sections under each chapter. Return ONLY the markdown outline, nothing else.`,
        maxTokens: 1500,
      });
      return md;
    }
    const result = await generateOutlineFromTopic({ topic, depth, tone, level, userApiKey });
    return result.outline;
  } catch (error) {
    console.error('Error generating outline:', error);
    throw new Error('Failed to generate outline.');
  }
}

export async function expandContentAction(
  title: string,
  userApiKey?: string | null,
): Promise<string> {
  try {
    // const config = getPlanConfig(plan);
    const result = await expandNodeContent({ title, userApiKey });
    return result.content;
  } catch (error) {
    console.error('Error expanding content:', error);
    throw new Error('Failed to expand content.');
  }
}

/**
 * Suggest 1-3 short topical tags for a Second Brain entry.
 * Returns empty array on error — caller treats tagging as best-effort.
 */
export async function suggestTagsAction(
  title: string,
  content?: string,
  userApiKey?: string | null,
): Promise<string[]> {
  try {
    const result = await suggestTags({ title, content, userApiKey });
    return result.tags;
  } catch (error) {
    console.error('Error suggesting tags:', error);
    return [];
  }
}

/**
 * LIVE BOOKS — refresh ONE node's content against the latest information.
 *
 * This is the server-side worker for the generalized transform engine's
 * `refresh` transform. It runs on the existing AI provider abstraction
 * (cloud Gemini with real Google Search grounding, local Ollama fallback)
 * and returns a proposed update + real citations. It NEVER applies anything
 * — the caller builds a preview and only applies after the user approves.
 */
export async function refreshNodeContentAction(
  input: RefreshNodeInput
): Promise<{
  content: string;
  citations: { url: string; title?: string }[];
  changed: boolean;
  model: string;
  modelProvider: 'cloud' | 'local';
  webGrounded: boolean;
  error?: string;
}> {
  try {
    return await refreshNodeContent(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Refresh failed';
    console.error('Error refreshing node content:', message);
    return {
      content: input.currentContent,
      citations: [],
      changed: false,
      model: input.useLocal ? 'Local' : 'Gemini',
      modelProvider: input.useLocal ? 'local' : 'cloud',
      webGrounded: false,
      error: message,
    };
  }
}


/**
 * Translate ONE node's content into a target language (#52 language translation).
 *
 * Server-side worker for the generalized transform engine's `translate` transform.
 * Same shape as refreshNodeContentAction (no web grounding; no citations).
 */
export async function translateNodeContentAction(
  input: TranslateNodeInput
): Promise<{
  content: string;
  citations: { url: string; title?: string }[];
  changed: boolean;
  model: string;
  modelProvider: 'cloud' | 'local';
  webGrounded: boolean;
  error?: string;
}> {
  try {
    return await translateNodeContent(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Translation failed';
    console.error('Error translating node content:', message);
    return {
      content: input.currentContent,
      citations: [],
      changed: false,
      model: input.useLocal ? 'Local' : 'Gemini',
      modelProvider: input.useLocal ? 'local' : 'cloud',
      webGrounded: false,
      error: message,
    };
  }
}

/**
 * Reformat a single piece of HTML content per a plain-language instruction
 * (#XX Reformat with AI). Used by the Reformat dialog from the Smart Tools
 * menu, the bubble menu, and the editor context menu.
 *
 * Single-shot: takes one HTML fragment, returns one reformatted fragment.
 * No web grounding, no citations, no subtree fan-out — that's why it skips
 * the transform engine that LIVE BOOKS and Translate share.
 */
export async function reformatContentAction(
  input: ReformatContentInput
): Promise<ReformatContentResult> {
  try {
    return await reformatContent(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Reformat failed';
    console.error('Error reformatting content:', message);
    return {
      content: input.contentHtml,
      changed: false,
      model: input.useLocal ? 'Local' : 'Gemini',
      modelProvider: input.useLocal ? 'local' : 'cloud',
      error: message,
    };
  }
}

/**
 * Transform an outline subtree's STRUCTURE per a plain-language instruction
 * (Transform outline with AI). Distinct from reformatContentAction, which
 * touches a single node's HTML body — this walks the subtree and can add,
 * remove, rename, merge, or move nodes.
 *
 * The AI returns a serialized subtree; the client merges it back into the
 * outline (preserving the subtree's anchor parentId on the root). Counts as
 * 1 generation regardless of subtree size.
 */
export async function transformOutlineAction(
  input: TransformOutlineInput
): Promise<TransformOutlineResult> {
  try {
    return await transformOutline(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Transform failed';
    console.error('Error transforming outline:', message);
    return {
      transformedNodes: input.subtreeNodes,
      transformedRootId: input.rootNodeId,
      summary: '',
      stats: { added: 0, removed: 0, renamed: 0, moved: 0, unchanged: Object.keys(input.subtreeNodes).length },
      model: input.useLocal ? 'Local' : 'Gemini',
      modelProvider: input.useLocal ? 'local' : 'cloud',
      changed: false,
      error: message,
    };
  }
}

/**
 * Export Email — turn a selected branch (node + descendants) into a
 * ready-to-send email (subject + body). Sibling of transformOutlineAction:
 * same Gemini-with-Ollama fallback, same BYOK contract. Counts as 1 AI
 * generation (gated on the client via useAIUsageGate 'exportEmail').
 */
export async function generateEmailAction(
  input: GenerateEmailInput,
): Promise<GenerateEmailResult> {
  try {
    return await generateEmail(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Email draft failed';
    console.error('Error generating email:', message);
    return {
      subject: '',
      bodyHtml: '',
      bodyText: '',
      model: input.useLocal ? 'Local' : 'Gemini',
      modelProvider: input.useLocal ? 'local' : 'cloud',
      error: message,
    };
  }
}

/**
 * Share to Social — turn a selected branch (node + descendants) into ready-to-post
 * social content (X thread or single post today; more platforms via templates).
 * Sibling of generateEmailAction: same Gemini-with-Ollama fallback, same BYOK
 * contract. Counts as 1 AI generation (gated on the client via useAIUsageGate).
 */
export async function generateSocialPostAction(
  input: GenerateSocialPostInput,
): Promise<GenerateSocialPostResult> {
  try {
    return await generateSocialPost(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Social post generation failed';
    console.error('Error generating social post:', message);
    return {
      posts: [],
      model: input.useLocal ? 'Local' : 'Gemini',
      modelProvider: input.useLocal ? 'local' : 'cloud',
      error: message,
    };
  }
}

/**
 * Share to Instagram — turn a selected branch into an Instagram caption (with
 * natural hashtags) OR a carousel: short slide lines the client renders into
 * branded square images, plus the accompanying caption + hashtags. Sibling of
 * generateSocialPostAction: same Gemini-with-Ollama fallback, same BYOK contract.
 * Counts as 1 AI generation (gated on the client via useAIUsageGate).
 */
export async function generateInstagramPostAction(
  input: GenerateInstagramInput,
): Promise<GenerateInstagramResult> {
  try {
    return await generateInstagramPost(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Instagram content generation failed';
    console.error('Error generating Instagram content:', message);
    return {
      caption: '',
      hashtags: [],
      slides: [],
      model: input.useLocal ? 'Local' : 'Gemini',
      modelProvider: input.useLocal ? 'local' : 'cloud',
      error: message,
    };
  }
}

/**
 * Share to YouTube — turn a selected branch into a YouTube PUBLISH PACKAGE: an
 * SEO-friendly title (a few options), a description with chapter timestamps, a
 * tags list, and a thumbnail idea (STANDARD variant); or a punchy Shorts title +
 * a tight vertical script (SHORTS variant). Pairs with the existing Generate
 * Video feature, which produces the actual MP4. Sibling of
 * generateSocialPostAction: same Gemini-with-Ollama fallback, same BYOK contract.
 * Counts as 1 AI generation (gated on the client via useAIUsageGate). NO posting
 * and NO OAuth — the client hand-off is copy / download / open the upload page.
 */
export async function generateYoutubeShareAction(
  input: GenerateYoutubePackageInput,
): Promise<GenerateYoutubePackageResult> {
  try {
    return await generateYoutubePackage(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'YouTube package generation failed';
    console.error('Error generating YouTube package:', message);
    return {
      package: null,
      model: input.useLocal ? 'Local' : 'Gemini',
      modelProvider: input.useLocal ? 'local' : 'cloud',
      error: message,
    };
  }
}

/**
 * Your Voice — distill a reusable VOICE PROFILE from the user's OWN writing
 * samples (pasted text and/or a sample of their Second Brain). Sibling of
 * generateEmailAction: same Gemini-with-Ollama fallback, same BYOK contract.
 * Counts as 1 AI generation (gated on the client via useAIUsageGate). The
 * result is the user's own style description — never a third-party impersonation.
 */
export async function distillVoiceProfileAction(
  input: DistillVoiceProfileInput,
): Promise<DistillVoiceProfileResult> {
  try {
    return await distillVoiceProfile(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Voice profile failed';
    console.error('Error distilling voice profile:', message);
    return {
      profile: '',
      model: input.useLocal ? 'Local' : 'Gemini',
      modelProvider: input.useLocal ? 'local' : 'cloud',
      error: message,
    };
  }
}

/**
 * Generate content for a node with full context (ancestors, existing content)
 * Supports both context-based and custom prompt-based generation
 */
export async function generateContentForNodeAction(
  context: NodeGenerationContext,
  useLocal: boolean = false,
): Promise<string> {
  try {
    // Build context information
    const ancestorContext = context.ancestorPath.length > 0
      ? `This node is located at: ${context.ancestorPath.join(' > ')} > ${context.nodeName}`
      : `This is a top-level node named: ${context.nodeName}`;

    const draftContext = context.existingContent
      ? `\n\nExisting content:\n${context.existingContent}`
      : '';

    // Diagram generation instructions when enabled
    const diagramTypeInstruction = context.diagramType && context.diagramType !== 'auto'
      ? `You MUST use a ${context.diagramType} diagram type. Do not use any other diagram type.`
      : `Choose the most appropriate diagram type from: flowchart, sequenceDiagram, mindmap, gantt, pie, classDiagram, stateDiagram, erDiagram.`;

    const diagramInstructions = context.includeDiagram
      ? `\n\nIMPORTANT: Include a Mermaid diagram that visualizes the key concepts, processes, or relationships in this content. Use this exact format:

\`\`\`mermaid
[diagram code here]
\`\`\`

${diagramTypeInstruction}

MERMAID SYNTAX RULES (critical - diagrams will fail if violated):
- Node/participant names must be simple identifiers (letters, numbers, underscores only)
- NO parentheses () inside node labels - they break the parser!
- WRONG: B[Retention (D1, D7, D30)] - this will FAIL
- RIGHT: B[Retention D1 D7 D30] or B[Retention Metrics]
- Use short names like "Platform" not "Platform (iOS, Mac, Web)"
- For descriptive labels in flowcharts, use: NodeID[Descriptive Label]
- Keep the diagram simple and focused`
      : '';

    let enhancedTitle: string;

    if (context.customPrompt) {
      // User provided a custom prompt - use it with context
      enhancedTitle = `${ancestorContext}${draftContext}${diagramInstructions}\n\nUser request: ${context.customPrompt}\n\nGenerate content based on the user's request for the node "${context.nodeName}".`;
    } else {
      // Default context-based generation
      enhancedTitle = `${ancestorContext}${draftContext}${diagramInstructions}\n\nGenerate detailed content for: ${context.nodeName}`;
    }

    // Cost-free local path: on-device Ollama (Gemma). Never bills a hosted key.
    if (useLocal) {
      const content = await generateWithOllama({
        system:
          'You are an expert author writing a clear, engaging section of a book. Write 1-3 well-formed paragraphs. Do not repeat the section title as a heading.',
        prompt: enhancedTitle,
        maxTokens: 800,
      });
      return content;
    }

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
      const ytResult = await extractYoutubeTranscript(source.url);
      extractedContent = ytResult.transcript;
      sourceDescription = `YouTube Video: ${ytResult.title || source.url}`;
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

    const result = await generateOutlineFromTopic({ topic: outlinePrompt, depth: 'standard' });

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
    const name = stripMarkdownFromTitle(line.trim().substring(2));

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
    const titlePrompt = `Generate a concise, descriptive title (5-10 words max) for the following content. Return ONLY the title, no quotes or explanation:

${content.substring(0, 3000)}`;

    // Ollama fallback for title generation (auto-selects best available model)
    const ollamaTitleFallback = async () => {
      const ollamaTitle = await generateWithOllama({
        prompt: titlePrompt,
        system: 'You generate concise titles. Return ONLY the title, nothing else.',
        temperature: 0.5,
        maxTokens: 50,
      });
      return { text: ollamaTitle };
    };

    const { text } = await withRateLimitRetry(
      () => ai.generate({
        model: getDefaultGeminiModel('genkit'),
        prompt: titlePrompt,
      }),
      1,  // One retry, then fallback to Ollama
      'title generation',
      ollamaTitleFallback
    );
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

// ============================================
// Bullet-Based Outline Generation (Content-First Approach)
// ============================================

/**
 * A single atomic piece of information extracted from sources
 */
interface ContentBullet {
  topic: string;       // Short topic/title (e.g., "User Authentication")
  content: string;     // The actual information/fact
  source?: string;     // Optional source attribution
}

/**
 * Maximum characters per chunk for bullet extraction
 * Gemini 2.0 Flash can handle ~1M tokens, so we use larger chunks to reduce API calls
 * 50k chars ≈ 12,500 tokens, well within limits but keeps extraction focused
 */
const BULLET_EXTRACTION_CHUNK_SIZE = 50000;

/**
 * Extract bullets from a single content chunk
 */
async function extractBulletsFromChunk(
  content: string,
  sourceDescription: string,
  chunkIndex: number,
  totalChunks: number,
  detailLevel: 'overview' | 'standard' | 'comprehensive' = 'standard',
  useLocalAI: boolean = false
): Promise<ContentBullet[]> {
  const chunkInfo = totalChunks > 1 ? ` (Part ${chunkIndex + 1}/${totalChunks})` : '';

  // Adjust extraction guidelines based on detail level
  let detailGuidelines: string;
  let bulletCountGuidance: string;

  if (detailLevel === 'overview') {
    detailGuidelines = `EXTRACTION MODE: HIGH-LEVEL OVERVIEW
- Focus on main concepts, themes, and conclusions only
- Skip supporting details, examples, and evidence
- Capture the "big picture" - what are the key takeaways?
- Each bullet should represent a major concept or conclusion`;
    bulletCountGuidance = `- For books/long documents: extract 15-25 bullets capturing major themes
- For shorter content: extract 8-15 bullets`;
  } else if (detailLevel === 'comprehensive') {
    detailGuidelines = `EXTRACTION MODE: COMPREHENSIVE (PhD THESIS LEVEL)
- Extract EVERY significant fact, concept, argument, and piece of evidence
- Include specific examples, case studies, and supporting data
- Capture nuances, caveats, and counterarguments
- Preserve methodological details and research findings
- Include direct quotes when they contain key insights
- Extract definitions, frameworks, and models in full detail
- Nothing important should be left out - this is for deep study`;
    bulletCountGuidance = `- For books/long documents: extract 100-150 bullets to capture everything significant
- For shorter content: extract 50-80 bullets
- When in doubt, include more detail rather than less`;
  } else {
    // Standard
    detailGuidelines = `EXTRACTION MODE: STANDARD (BALANCED)
- Extract main points and important supporting details
- Include key examples that illustrate concepts
- Capture important evidence and conclusions
- Balance thoroughness with readability`;
    bulletCountGuidance = `- For books/long documents: extract 50-80 bullets to capture key ideas thoroughly
- For shorter content: extract 20-40 bullets`;
  }

  const extractionPrompt = `You are extracting ATOMIC FACTS from source content. Each fact should be:
- Self-contained and understandable on its own
- A single topic with its key information
- Neither too granular (avoid single sentences) nor too broad (avoid combining unrelated ideas)

${detailGuidelines}

OUTPUT FORMAT (JSON array):
[
  {"topic": "Short Topic Name", "content": "The key information about this topic..."},
  {"topic": "Another Topic", "content": "Information about this topic..."}
]

GUIDELINES:
${bulletCountGuidance}
- Topic names should be 2-6 words
- Content should be 1-3 sentences capturing the essence
- Include specific data, numbers, names, dates when present
- Don't editorialize - extract what's actually stated
- Capture chapter themes, key arguments, examples, and actionable advice

SOURCE: ${sourceDescription}${chunkInfo}
===
${content}
===

Extract the bullets (respond with ONLY the JSON array):`;

  // Ollama generation function
  const generateWithOllamaLocal = async () => {
    const ollamaResult = await generateWithOllama({
      prompt: extractionPrompt,
      system: 'You extract atomic facts from text. Output ONLY valid JSON array.',
      temperature: 0.5,
      maxTokens: 6000,
    });
    return { text: ollamaResult };
  };

  let text: string;

  if (useLocalAI) {
    // Use Ollama directly - no rate limits, no delays needed
    console.log(`[Chunk ${chunkIndex + 1}/${totalChunks}] Using local AI (Ollama)...`);
    const result = await generateWithOllamaLocal();
    text = result.text;
  } else {
    // Use Gemini with rate limit protection and Ollama fallback
    const { text: geminiText } = await withRateLimitRetry(
      () => ai.generate({
        model: getDefaultGeminiModel('genkit'),
        prompt: extractionPrompt,
      }),
      1,
      `bullet extraction chunk ${chunkIndex + 1}`,
      generateWithOllamaLocal
    );
    text = geminiText;
  }

  // Parse the JSON response
  try {
    let jsonStr = text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    const bullets: ContentBullet[] = JSON.parse(jsonStr);
    console.log(`[Chunk ${chunkIndex + 1}/${totalChunks}] Extracted ${bullets.length} bullets`);
    return bullets;
  } catch (parseError) {
    console.warn(`[Chunk ${chunkIndex + 1}] Failed to parse JSON, using text fallback:`, parseError);
    const lines = text.split('\n').filter(l => l.includes(':'));
    return lines.slice(0, 50).map(line => {
      const colonIdx = line.indexOf(':');
      return {
        topic: line.substring(0, colonIdx).replace(/[-*"]/g, '').trim(),
        content: line.substring(colonIdx + 1).replace(/"/g, '').trim(),
      };
    });
  }
}

/**
 * Split content into chunks at natural boundaries (paragraphs, sections)
 */
function splitContentIntoChunks(content: string, maxChunkSize: number): string[] {
  if (content.length <= maxChunkSize) {
    return [content];
  }

  const chunks: string[] = [];
  let remaining = content;

  while (remaining.length > 0) {
    if (remaining.length <= maxChunkSize) {
      chunks.push(remaining);
      break;
    }

    // Find a good break point (paragraph boundary) near the max size
    let breakPoint = maxChunkSize;

    // Look for paragraph breaks (double newline) before the limit
    const doubleNewline = remaining.lastIndexOf('\n\n', maxChunkSize);
    if (doubleNewline > maxChunkSize * 0.7) {
      breakPoint = doubleNewline;
    } else {
      // Fall back to single newline
      const singleNewline = remaining.lastIndexOf('\n', maxChunkSize);
      if (singleNewline > maxChunkSize * 0.7) {
        breakPoint = singleNewline;
      }
    }

    chunks.push(remaining.substring(0, breakPoint).trim());
    remaining = remaining.substring(breakPoint).trim();
  }

  return chunks;
}

/**
 * Extract atomic bullets from all sources
 * This treats all information as independent facts to be organized later
 * For long content (books, etc.), processes in chunks to capture full detail
 */
async function extractBulletsFromSources(
  extractedSources: Array<{ content: string; description: string; title?: string }>,
  detailLevel: 'overview' | 'standard' | 'comprehensive' = 'standard',
  useLocalAI: boolean = false
): Promise<ContentBullet[]> {
  const allBullets: ContentBullet[] = [];

  for (const source of extractedSources) {
    const chunks = splitContentIntoChunks(source.content, BULLET_EXTRACTION_CHUNK_SIZE);
    console.log(`[Bullet] Source "${source.description}": ${source.content.length} chars → ${chunks.length} chunk(s) [${detailLevel} detail]`);

    for (let i = 0; i < chunks.length; i++) {
      // Add delay between chunks to avoid rate limits (skip if using local AI)
      // Gemini free tier: 15 RPM, so we need ~4s between calls to stay safe
      if (i > 0 && !useLocalAI) {
        const delayMs = 5000; // 5 seconds between chunks
        console.log(`[Bullet] Waiting ${delayMs/1000}s between chunks (rate limit protection)...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      const chunkBullets = await extractBulletsFromChunk(
        chunks[i],
        source.title || source.description,
        i,
        chunks.length,
        detailLevel,
        useLocalAI
      );

      // Add source attribution for multi-source scenarios
      const bulletsWithSource = chunkBullets.map(b => ({
        ...b,
        source: source.title || source.description,
      }));

      allBullets.push(...bulletsWithSource);
    }
  }

  console.log(`[Bullet] Total extracted: ${allBullets.length} bullets from ${extractedSources.length} source(s)`);
  return allBullets;
}

/**
 * Extract bullets from an existing outline structure
 * Used when merging new content with existing outline
 */
function extractBulletsFromOutline(outlineContent: string): ContentBullet[] {
  const bullets: ContentBullet[] = [];
  const lines = outlineContent.split('\n');

  for (const line of lines) {
    // Match "- Topic: Content" (standard format)
    const colonMatch = line.match(/^\s*-\s+([^:]+):\s*(.+)$/);
    if (colonMatch) {
      bullets.push({
        topic: colonMatch[1].trim(),
        content: colonMatch[2].trim(),
        source: 'existing',
      });
      continue;
    }

    // Match "- Text without colon" (comprehensive/content-in-name format)
    const plainMatch = line.match(/^\s*-\s+(.{10,})$/);
    if (plainMatch) {
      const text = plainMatch[1].trim();
      // Use first few words as topic, keep full text as content
      const words = text.split(/\s+/);
      const topic = words.slice(0, 4).join(' ');
      bullets.push({ topic, content: text, source: 'existing' });
    }
  }

  console.log(`Extracted ${bullets.length} bullets from existing outline`);
  return bullets;
}

/**
 * Auto-detect the best merge strategy based on source analysis
 * Returns: 'synthesize' | 'separate' | 'architecture'
 */
async function detectMergeStrategy(
  sources: Array<{ content: string; description: string; title?: string }>,
  outlineName?: string,
  existingContent?: string
): Promise<{ strategy: MergeStrategy; hasUserContext: boolean }> {
  // Single source always synthesizes
  if (sources.length <= 1) {
    return { strategy: 'synthesize', hasUserContext: false };
  }

  // Check if user provided architecture context in outline name or existing content
  const contextHints = [outlineName, existingContent].filter(Boolean).join(' ').toLowerCase();
  const architectureKeywords = ['architecture', 'system', 'suite', 'integration', 'platform', 'ecosystem', 'components', 'work together', 'combined'];
  const hasUserContext = architectureKeywords.some(kw => contextHints.includes(kw));

  // Build a summary of sources for analysis
  const sourceSummaries = sources.map((s, i) => {
    const title = s.title || s.description || `Source ${i + 1}`;
    const preview = s.content.substring(0, 500);
    return `Source ${i + 1}: "${title}"\nPreview: ${preview}...`;
  }).join('\n\n');

  const detectionPrompt = `Analyze these ${sources.length} sources and determine their relationship:

${sourceSummaries}

QUESTION: Are these sources about:
A) The SAME topic/subject (just different perspectives or articles about one thing)
B) DIFFERENT unrelated topics/products (completely separate subjects)
C) RELATED components that work together (different products/parts of a larger system)

Respond with ONLY one letter: A, B, or C`;

  try {
    const ollamaDetectionFallback = async () => {
      const result = await generateWithOllama({
        prompt: detectionPrompt,
        system: 'You analyze content relationships. Respond with only A, B, or C.',
        temperature: 0.3,
        maxTokens: 10,
      });
      return { text: result };
    };

    const { text: response } = await withRateLimitRetry(
      () => ai.generate({
        model: getDefaultGeminiModel('genkit'),
        prompt: detectionPrompt,
      }),
      1,
      'strategy detection',
      ollamaDetectionFallback
    );

    const answer = response.trim().toUpperCase().charAt(0);
    console.log(`[Bullet] Auto-detected relationship: ${answer} (hasUserContext: ${hasUserContext})`);

    if (answer === 'A') {
      return { strategy: 'synthesize', hasUserContext };
    } else if (answer === 'B') {
      // Different topics - use separate, or architecture if user provided context
      return { strategy: hasUserContext ? 'architecture' : 'separate', hasUserContext };
    } else if (answer === 'C') {
      // Related components - architecture mode
      return { strategy: 'architecture', hasUserContext };
    }
  } catch (error) {
    console.warn('[Bullet] Strategy detection failed, defaulting to synthesize:', error);
  }

  // Default to synthesize if detection fails
  return { strategy: 'synthesize', hasUserContext: false };
}

/**
 * Recursively organize bullets into a hierarchical structure
 * Creates deeper levels when there are many bullets in a category
 */
async function recursivelyOrganizeBullets(
  bullets: ContentBullet[],
  parentId: string,
  nodes: Record<string, any>,
  ai: any,
  currentDepth: number = 1,
  maxDepth: number = 5,
  parentTheme: string = '',
  useLocalAI: boolean = false
): Promise<void> {
  const BULLETS_FOR_SUBSECTIONS = 12; // Threshold to create sub-levels
  const MIN_BULLETS_FOR_LEAF = 3; // Minimum bullets to warrant a node

  // Base case: too few bullets or max depth reached
  if (bullets.length < MIN_BULLETS_FOR_LEAF || currentDepth > maxDepth) {
    // Add remaining bullets as content to parent
    if (bullets.length > 0 && nodes[parentId]) {
      const bulletContent = bullets.map(b => `• ${b.content}`).join('\n\n');
      nodes[parentId].content = (nodes[parentId].content || '') +
        (nodes[parentId].content ? '\n\n' : '') + bulletContent;
    }
    return;
  }

  // If few enough bullets, create leaf nodes directly
  if (bullets.length < BULLETS_FOR_SUBSECTIONS) {
    // Group into 2-4 small subsections with individual bullet content preserved
    const groupSize = Math.ceil(bullets.length / Math.min(4, Math.ceil(bullets.length / 3)));
    for (let i = 0; i < bullets.length; i += groupSize) {
      const groupBullets = bullets.slice(i, Math.min(i + groupSize, bullets.length));
      if (groupBullets.length === 0) continue;

      // Use first bullet's topic as a hint for the subsection name
      const subId = uuidv4();
      const groupTopics = [...new Set(groupBullets.map(b => b.topic))];
      const nodeName = groupTopics.length <= 2
        ? groupTopics.join(' & ')
        : groupTopics[0] + (groupTopics.length > 1 ? ` (+${groupTopics.length - 1} more)` : '');

      nodes[subId] = {
        id: subId,
        name: nodeName,
        content: groupBullets.map(b => `• ${b.content}`).join('\n\n'),
        type: 'document',
        parentId: parentId,
        childrenIds: [],
        prefix: '',
      };
      nodes[parentId].childrenIds.push(subId);
    }
    return;
  }

  // Many bullets: identify sub-themes and recursively organize
  console.log(`[Recursive] Depth ${currentDepth}: Organizing ${bullets.length} bullets under "${parentTheme || 'root'}"...`);

  const bulletSample = bullets.slice(0, 50).map(b => `[${b.topic}] ${b.content.substring(0, 100)}`).join('\n');

  const subThemePrompt = `Identify 4-7 distinct SUB-THEMES within this content about "${parentTheme || 'the topic'}".

CONTENT SAMPLE (${bullets.length} total facts):
${bulletSample}

Requirements:
- Each sub-theme should be specific and focused
- Sub-themes should cover different aspects (not overlap)
- Use concise names (2-5 words)
- These will become subsections, so be specific not generic

Return ONLY a JSON array of sub-theme names:
["Sub-theme 1", "Sub-theme 2", ...]`;

  let subThemes: string[] = [];
  try {
    // Skip delay when using local AI
    if (!useLocalAI) {
      await new Promise(resolve => setTimeout(resolve, 1500)); // Rate limit
    }

    const generateWithOllamaLocal = async () => {
      const result = await generateWithOllama({
        prompt: subThemePrompt,
        system: 'You identify sub-themes in content. Return only a JSON array.',
        temperature: 0.5,
        maxTokens: 500,
      });
      return { text: result };
    };

    let text: string;
    if (useLocalAI) {
      // Use Ollama directly - no rate limits
      const result = await generateWithOllamaLocal();
      text = result.text;
    } else {
      const { text: geminiText } = await withRateLimitRetry(
        () => ai.generate({
          model: getDefaultGeminiModel('genkit'),
          prompt: subThemePrompt,
        }),
        1,
        `sub-theme detection (depth ${currentDepth})`,
        generateWithOllamaLocal
      );
      text = geminiText;
    }

    let jsonStr = text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    subThemes = JSON.parse(jsonStr);
    console.log(`[Recursive] Found ${subThemes.length} sub-themes at depth ${currentDepth}`);
  } catch (error) {
    console.warn(`[Recursive] Sub-theme detection failed at depth ${currentDepth}:`, error);
    // Fallback: split bullets roughly equally
    const numGroups = Math.min(5, Math.ceil(bullets.length / 15));
    subThemes = Array.from({ length: numGroups }, (_, i) => `Section ${i + 1}`);
  }

  // Assign bullets to sub-themes and recurse
  for (const subTheme of subThemes) {
    const themeKeywords = subTheme.toLowerCase().split(/\s+/).filter(w => w.length > 2);

    // Find bullets matching this sub-theme
    const matchingBullets = bullets.filter(b => {
      const bulletText = `${b.topic} ${b.content}`.toLowerCase();
      return themeKeywords.some(kw => bulletText.includes(kw));
    });

    // If no matches, skip (bullets will be redistributed)
    if (matchingBullets.length < MIN_BULLETS_FOR_LEAF) continue;

    // Create node for this sub-theme
    const subNodeId = uuidv4();
    nodes[subNodeId] = {
      id: subNodeId,
      name: subTheme,
      content: '',
      type: currentDepth === 1 ? 'chapter' : 'document',
      parentId: parentId,
      childrenIds: [],
      prefix: '',
    };
    nodes[parentId].childrenIds.push(subNodeId);

    // Recursively organize this sub-theme's bullets
    await recursivelyOrganizeBullets(
      matchingBullets,
      subNodeId,
      nodes,
      ai,
      currentDepth + 1,
      maxDepth,
      subTheme,
      useLocalAI
    );
  }

  // Handle unassigned bullets (add to parent or create "Other" section)
  const assignedBullets = new Set<ContentBullet>();
  for (const subTheme of subThemes) {
    const themeKeywords = subTheme.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    bullets.forEach(b => {
      const bulletText = `${b.topic} ${b.content}`.toLowerCase();
      if (themeKeywords.some(kw => bulletText.includes(kw))) {
        assignedBullets.add(b);
      }
    });
  }

  const unassignedBullets = bullets.filter(b => !assignedBullets.has(b));
  if (unassignedBullets.length >= MIN_BULLETS_FOR_LEAF) {
    // Create an "Additional Topics" section for unassigned
    const otherNodeId = uuidv4();
    nodes[otherNodeId] = {
      id: otherNodeId,
      name: 'Additional Topics',
      content: '',
      type: 'document',
      parentId: parentId,
      childrenIds: [],
      prefix: '',
    };
    nodes[parentId].childrenIds.push(otherNodeId);

    // Recursively organize unassigned bullets (but with reduced depth)
    await recursivelyOrganizeBullets(
      unassignedBullets,
      otherNodeId,
      nodes,
      ai,
      currentDepth + 1,
      Math.min(maxDepth, currentDepth + 2), // Limit depth for "other" section
      'Additional Topics',
      useLocalAI
    );
  }
}

/**
 * For very large bullet sets (500+), use a two-pass approach:
 * Pass 1: Identify major themes from a sample of bullets
 * Pass 2: Organize bullets by theme into sub-outlines (NOW WITH RECURSIVE DEPTH)
 */
async function organizeLargeBulletSet(
  bullets: ContentBullet[],
  outlineName: string,
  detailLevel: 'overview' | 'standard' | 'comprehensive' = 'standard',
  useLocalAI: boolean = false
): Promise<{ rootNodeId: string; nodes: Record<string, any> }> {
  // Determine max depth based on detail level
  const maxDepth = detailLevel === 'overview' ? 3 : detailLevel === 'comprehensive' ? 6 : 5;
  console.log(`[Bullet] Large set detected (${bullets.length} bullets). Using two-pass organization [${detailLevel} → ${maxDepth} levels]...`);

  // Pass 1: Identify major themes from bullet topics
  const topicSample = bullets
    .map(b => b.topic)
    .filter((v, i, a) => a.indexOf(v) === i) // unique topics
    .slice(0, 100) // sample first 100 unique topics
    .join(', ');

  const themePrompt = `Analyze these topic keywords from a book/document and identify 10-15 MAJOR THEMES that would make good chapter headings.

TOPICS: ${topicSample}

Requirements:
- Each theme should be broad enough to contain multiple related subtopics
- Themes should be distinct and non-overlapping
- Use clear, concise names (2-5 words each)
- Order themes logically (introduction → details → conclusion if applicable)

Return ONLY a JSON array of theme names, nothing else:
["Theme 1", "Theme 2", "Theme 3", ...]`;

  let themes: string[] = [];
  try {
    const generateThemesWithOllama = async () => {
      const result = await generateWithOllama({
        prompt: themePrompt,
        system: 'You identify major themes in content. Return only a JSON array.',
        temperature: 0.5,
        maxTokens: 500,
      });
      return { text: result };
    };

    let text: string;
    if (useLocalAI) {
      // Use Ollama directly - no rate limits
      console.log('[Bullet] Using local AI for theme detection...');
      const result = await generateThemesWithOllama();
      text = result.text;
    } else {
      const { text: geminiText } = await withRateLimitRetry(
        () => ai.generate({
          model: getDefaultGeminiModel('genkit'),
          prompt: themePrompt,
        }),
        1,
        'theme detection',
        generateThemesWithOllama
      );
      text = geminiText;
    }

    let jsonStr = text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    themes = JSON.parse(jsonStr);
    console.log(`[Bullet] Identified ${themes.length} themes:`, themes);
  } catch (error) {
    console.warn('[Bullet] Theme detection failed, using default themes:', error);
    themes = ['Introduction', 'Core Concepts', 'Key Strategies', 'Practical Applications',
              'Advanced Topics', 'Case Studies', 'Best Practices', 'Conclusions'];
  }

  // Pass 2: Assign bullets to themes and organize each
  // Create a simpler bullet summary for assignment (to keep prompt manageable)
  const bulletSummaries = bullets.map((b, idx) => `${idx}:${b.topic}`).join('|');

  // Build the outline structure
  const rootNodeId = uuidv4();
  const nodes: Record<string, any> = {
    [rootNodeId]: {
      id: rootNodeId,
      name: outlineName,
      content: '',
      type: 'root',
      parentId: null,
      childrenIds: [],
      prefix: '',
    },
  };

  // Process each theme
  for (let themeIdx = 0; themeIdx < themes.length; themeIdx++) {
    const theme = themes[themeIdx];
    console.log(`[Bullet] Processing theme ${themeIdx + 1}/${themes.length}: "${theme}"`);

    // Find bullets that match this theme (simple keyword matching)
    const themeKeywords = theme.toLowerCase().split(/\s+/);
    const themeBullets = bullets.filter(b => {
      const bulletText = `${b.topic} ${b.content}`.toLowerCase();
      return themeKeywords.some(kw => kw.length > 3 && bulletText.includes(kw));
    });

    // If no matches, take a proportional slice
    let bulletsForTheme = themeBullets.length > 0
      ? themeBullets
      : bullets.slice(
          Math.floor(themeIdx * bullets.length / themes.length),
          Math.floor((themeIdx + 1) * bullets.length / themes.length)
        );

    if (bulletsForTheme.length === 0) continue;

    // For very large themes, sample evenly to keep prompt manageable
    const MAX_BULLETS_PER_THEME = 100;
    if (bulletsForTheme.length > MAX_BULLETS_PER_THEME) {
      console.log(`[Bullet] Theme "${theme}" has ${bulletsForTheme.length} bullets, sampling ${MAX_BULLETS_PER_THEME}`);
      const step = Math.ceil(bulletsForTheme.length / MAX_BULLETS_PER_THEME);
      bulletsForTheme = bulletsForTheme.filter((_, idx) => idx % step === 0).slice(0, MAX_BULLETS_PER_THEME);
    }

    // Create chapter node
    const chapterId = uuidv4();
    nodes[chapterId] = {
      id: chapterId,
      name: theme,
      content: '',
      type: 'chapter',
      parentId: rootNodeId,
      childrenIds: [],
      prefix: '',
    };
    nodes[rootNodeId].childrenIds.push(chapterId);

    // Use RECURSIVE organization for deeper hierarchy (depth based on detail level)
    try {
      await recursivelyOrganizeBullets(
        bulletsForTheme,
        chapterId,
        nodes,
        ai,
        2, // Start at depth 2 (chapter is depth 1)
        maxDepth, // Depth based on detail level: overview=3, standard=5, comprehensive=6
        theme,
        useLocalAI
      );

      // If recursive organization didn't create any children, add bullets directly
      if (nodes[chapterId].childrenIds.length === 0) {
        nodes[chapterId].content = bulletsForTheme
          .map(b => `• ${b.content}`)
          .join('\n\n');
      }
    } catch (error) {
      console.warn(`[Bullet] Failed to organize theme "${theme}":`, error);
      // Add bullets directly as fallback
      nodes[chapterId].content = bulletsForTheme
        .map(b => `• ${b.content}`)
        .join('\n\n');
    }
  }

  console.log(`[Bullet] Two-pass organization complete. Created ${Object.keys(nodes).length - 1} nodes.`);
  return { rootNodeId, nodes };
}

/**
 * Organize a flat list of bullets into a hierarchical outline
 * This is the key function that creates structure from atomic facts
 * For large sets (500+), uses two-pass theme-based organization
 */
/**
 * Convert a language model's freeform markdown outline into the strict
 * dash-indent format that parseMarkdownToNodes turns into a real hierarchy.
 *
 * Local models (Gemma via Ollama) frequently ignore the requested
 * "- Chapter: content" dash format and instead emit a mix of "#"/"###"
 * headings, "**I. Chapter**" bold-numbered lines, and "*"/"+" bullets. The
 * parser only builds a tree from "#" headings OR "- " bullets, so that dialect
 * used to collapse a whole merge to ~1 node. This normalizer maps:
 *   - the first heading            -> dropped (it is the document title; the
 *                                     outline root already carries the name)
 *   - any later "#…" heading       -> a top-level chapter ("- …")
 *   - a "**bold**" line (no bullet) -> a top-level chapter ("- …")
 *   - a "-"/"*"/"+" bullet          -> a nested subtopic ("  - …"), depth from
 *                                     its own indentation (min depth 1)
 *   - a plain prose line            -> appended to the previous item's content
 * Bold markers and leading "I."/"1)" numbering are stripped from titles.
 * It is idempotent on already-clean dash output.
 */
function normalizeOrganizedOutline(raw: string): string {
  if (!raw) return '';
  const debold = (s: string) => s.replace(/\*\*/g, '').replace(/`/g, '').trim();
  const denum = (s: string) => s.replace(/^(?:[IVXLCDM]+|\d+)[.)]\s+/i, '').trim();
  const clean = (s: string) => denum(debold(s));

  const outLines: string[] = [];
  let droppedTitle = false;

  for (const rawLine of raw.split('\n')) {
    const line = rawLine.replace(/```[a-z]*/gi, '');
    const s = line.trim();
    if (!s) continue;

    // Skip a leading conversational preamble ("Here is the outline:", "Sure!").
    if (outLines.length === 0 && !droppedTitle && /^(here|sure|okay|below|certainly|this outline)\b/i.test(s) && !/^[#\-*+]/.test(s)) {
      continue;
    }

    // Heading line: first becomes the (dropped) document title, rest are chapters.
    const h = s.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      if (!droppedTitle) { droppedTitle = true; continue; }
      const text = clean(h[2]);
      if (text) outLines.push(`- ${text}`);
      continue;
    }

    // Bullet line (-, *, +): nested subtopic, depth from leading indentation.
    const b = line.match(/^(\s*)[-*+]\s+(.*)$/);
    if (b) {
      const depth = Math.max(1, Math.floor(b[1].length / 2) || 1);
      const text = clean(b[2]);
      if (text) outLines.push(`${'  '.repeat(depth)}- ${text}`);
      continue;
    }

    // Bold-only line (e.g. "**I. Selecting Beans**"): a chapter.
    if (/^\*\*.+\*\*:?/.test(s)) {
      const text = clean(s);
      if (text) outLines.push(`- ${text}`);
      continue;
    }

    // Plain prose: fold into the previous item's content so it isn't lost.
    if (outLines.length) {
      outLines[outLines.length - 1] += ` ${debold(s)}`;
    } else {
      outLines.push(`- ${clean(s)}`);
    }
  }

  return outLines.join('\n');
}

async function organizeBulletsIntoOutline(
  bullets: ContentBullet[],
  outlineName: string,
  mergeStrategy: MergeStrategy = 'synthesize',
  detailLevel: 'overview' | 'standard' | 'comprehensive' = 'standard',
  useLocalAI: boolean = false
): Promise<{ rootNodeId: string; nodes: Record<string, any> }> {

  // For larger bullet sets (100+), use recursive two-pass approach for deeper hierarchy
  // Depth varies by detail level: overview=3, standard=5, comprehensive=6
  if (bullets.length > 100 && mergeStrategy === 'synthesize') {
    return organizeLargeBulletSet(bullets, outlineName, detailLevel, useLocalAI);
  }

  // Format bullets for the organization prompt (numbered for AI reference only)
  const bulletList = bullets.map((b, idx) =>
    `#${idx + 1}. [${b.topic}] ${b.content}`
  ).join('\n');

  // Get unique sources for separate/architecture strategies
  const uniqueSources = [...new Set(bullets.map(b => b.topic))];

  // Dynamic chapter range based on content complexity (bullet count)
  const bulletCount = bullets.length;
  let chapterGuidance: string;
  if (bulletCount <= 30) {
    chapterGuidance = 'For this content volume, aim for 4-6 chapters.';
  } else if (bulletCount <= 60) {
    chapterGuidance = 'For this content volume, aim for 5-8 chapters.';
  } else if (bulletCount <= 100) {
    chapterGuidance = 'For this content volume, aim for 7-12 chapters.';
  } else if (bulletCount <= 200) {
    chapterGuidance = 'For this substantial content (book-length), create 12-18 chapters. Each chapter should cover a major theme with 3-6 subsections.';
  } else {
    chapterGuidance = 'For this extensive content, create 15-25 chapters organized by major themes. Group related bullets into cohesive chapters with multiple subsections each.';
  }

  // Add detail-level-specific formatting emphasis
  let formatEmphasis = '';
  if (detailLevel === 'comprehensive') {
    formatEmphasis = `
CRITICAL FORMAT RULE FOR DETAILED OUTPUT:
- Node NAMES must be SHORT (2-6 words) — they appear as tree labels
- ALL detailed content goes AFTER the colon
- Example: "- Quantum Entanglement: Quantum entanglement is a phenomenon where particles become correlated..."
- WRONG: "- Quantum entanglement is a phenomenon where particles become correlated such that..."
- The colon separates the SHORT TITLE from the DETAILED CONTENT
`;
  }

  // Generate different prompts based on merge strategy
  let organizationPrompt: string;

  if (mergeStrategy === 'separate') {
    // SEPARATE: Keep each source as its own section
    organizationPrompt = `You are organizing facts from MULTIPLE DISTINCT SOURCES into an outline with SEPARATE SECTIONS for each source.

IMPORTANT: These sources are about DIFFERENT topics or products. Keep them SEPARATE - do NOT merge content across sources!

SOURCES IDENTIFIED: ${uniqueSources.join(', ')}

FACTS TO ORGANIZE (${bulletCount} total):
${bulletList}

STRUCTURE REQUIREMENTS:
- Create ONE top-level chapter for EACH source (${uniqueSources.length} total)
- Name each chapter after the source/product it covers
- Within each source chapter, organize that source's content into logical subtopics
- Do NOT mix content from different sources
${formatEmphasis}
OUTPUT FORMAT:
- [Source 1 Name]: Brief overview of this source.
  - Subtopic A: Content from source 1 only.
  - Subtopic B: More content from source 1.
- [Source 2 Name]: Brief overview of this source.
  - Subtopic A: Content from source 2 only.
  - Subtopic B: More content from source 2.

ABSOLUTE RULES:
- Each top-level chapter = ONE source
- Content stays within its source section
- Each chapter has 2+ subtopics
- Write flowing prose, not bullet lists

Generate the separated outline:`;

  } else if (mergeStrategy === 'architecture') {
    // ARCHITECTURE: Introduction + separate product sections with cross-references
    organizationPrompt = `You are organizing facts about RELATED PRODUCTS/COMPONENTS that work together as a system.

SOURCES (products/components): ${uniqueSources.join(', ')}

FACTS TO ORGANIZE (${bulletCount} total):
${bulletList}

STRUCTURE REQUIREMENTS:
1. START with an "Overview" or "System Architecture" chapter that:
   - Explains how these products/components relate to each other
   - Describes the overall system or workflow
   - Highlights integration points and dependencies

2. Then create ONE chapter for EACH product/component (${uniqueSources.length} total)
   - Name each chapter after the product/component
   - Within each, organize into logical subtopics (features, specs, usage, etc.)
   - Include cross-references where relevant (e.g., "integrates with [Other Product]'s API")

3. Optionally end with "Integration" or "Workflow" chapter if there's significant cross-product content
${formatEmphasis}
OUTPUT FORMAT:
- System Overview: How these components work together as a unified solution.
  - Architecture: High-level view of component relationships.
  - Integration Points: Where components connect.
- [Product 1 Name]: Overview of this component's role.
  - Features: What it does.
  - Specifications: Technical details.
- [Product 2 Name]: Overview of this component's role.
  - Features: What it does.
  - Specifications: Technical details.

ABSOLUTE RULES:
- First chapter MUST be an overview explaining the system/relationships
- Each product gets its own section
- Include cross-references where products interact
- Write flowing prose, not bullet lists

Generate the product architecture outline:`;

  } else {
    // SYNTHESIZE (default): Deep merge into unified outline
    organizationPrompt = `You are organizing facts from MULTIPLE SOURCES into ONE UNIFIED OUTLINE.

IMPORTANT: These facts come from different sources about the SAME TOPIC. Your job is to MERGE them into a single coherent outline - NOT to create separate sections for each source!

FACTS TO ORGANIZE (${bulletCount} total):
${bulletList}

CHAPTER COUNT GUIDANCE:
${chapterGuidance}
Create as many chapters as needed to cover DISTINCT topics - but NEVER create duplicate or overlapping chapters.

CRITICAL RULES - NO DUPLICATES:
1. Each theme appears ONCE - merge all facts about that theme into ONE chapter
2. Facts from different sources about the same topic go in the SAME chapter
3. NEVER create "Introduction from Source 1" and "Introduction from Source 2" - just ONE "Introduction"
4. If two chapter titles could be merged (e.g., "Features" and "Capabilities"), MERGE THEM

THINK OF IT THIS WAY:
- You're writing a Wikipedia article, not a collection of summaries
- A reader should NOT be able to tell how many sources were used
- Redundant information from different sources should be MERGED, not repeated
${formatEmphasis}
OUTPUT FORMAT:
- Chapter Title: Synthesized overview combining facts from ALL sources.
  - Subtopic: Merged content from multiple sources as coherent prose.
  - Another Subtopic: More synthesized content.

ABSOLUTE RULES:
- Each chapter covers a DISTINCT theme (no overlap!)
- Each chapter has 2+ subtopics
- NO source attribution or references
- Write flowing prose, not bullet lists

BEFORE OUTPUTTING: Review your chapter titles. If ANY two could be merged, MERGE THEM.

Generate the unified outline:`;
  }

  // Ollama generation for organization
  // Use higher token limit for book-length content
  const ollamaMaxTokens = bulletCount > 100 ? 8000 : 4000;
  const generateOrgWithOllama = async () => {
    const ollamaResult = await generateWithOllama({
      prompt: organizationPrompt,
      system: 'You organize information into clear hierarchical outlines with detailed content for each section.',
      temperature: 0.7,
      maxTokens: ollamaMaxTokens,
    });
    return { outline: ollamaResult };
  };

  let result: { outline: string };
  if (useLocalAI) {
    // Use Ollama directly - no rate limits
    console.log('[Bullet] Using local AI for bullet organization...');
    result = await generateOrgWithOllama();
  } else {
    result = await withRateLimitRetry(
      () => generateOutlineFromTopic({ topic: organizationPrompt, depth: 'standard' }),
      1,
      'bullet organization',
      generateOrgWithOllama
    );
  }

  // Normalize the model's freeform markdown into the clean dash-indent format
  // that parseMarkdownToNodes reliably turns into a hierarchy. Local models
  // (Gemma) tend to answer with "### Title", "**I. Chapter**" bold-numbered
  // lines, and "*"/"+" bullets rather than the requested "- Chapter: content"
  // dash list — which silently collapsed the merge to ~0 nodes. This pre-pass
  // is scoped to the merge organize step only.
  const normalizedOutline = normalizeOrganizedOutline(result.outline);

  // Parse the organized outline into nodes
  let { rootNodeId, nodes } = parseMarkdownToNodes(normalizedOutline, outlineName);
  // Safety net: if normalization somehow yielded nothing, fall back to the raw
  // model output so we never do WORSE than before.
  if (Object.keys(nodes).length <= 1) {
    const fallback = parseMarkdownToNodes(result.outline, outlineName);
    if (Object.keys(fallback.nodes).length > Object.keys(nodes).length) {
      rootNodeId = fallback.rootNodeId;
      nodes = fallback.nodes;
    }
  }

  // Post-process: clean up artifacts and consolidate
  cleanupBulletOutlineNodes(nodes, rootNodeId);

  return { rootNodeId, nodes };
}

/**
 * Post-process bullet-organized outline to clean up artifacts
 */
function cleanupBulletOutlineNodes(nodes: Record<string, any>, rootNodeId: string): void {
  // Patterns to remove from content (both plain text and HTML)
  const artifactPatterns = [
    /\[[\d,\s]+\]/g,           // [1, 2, 3] bullet references
    /#\d+[.,]?\s*/g,           // #1, #2. style references
    // --- separators (plain text) - multiple patterns for robustness
    /\n+\s*---+\s*\n+/g,      // newlines with optional spaces around ---
    /\r?\n\r?\n---\r?\n\r?\n/g, // handle CRLF line endings
    /\s*---\s*(?=\n|$)/g,     // --- at end of paragraph
    /(?:^|\n)\s*---\s*(?:\n|$)/g, // --- on its own line
    /---+\s*$/g,              // trailing ---
    /^\s*---+\s*/g,           // leading ---
    // --- separators (HTML wrapped)
    /<p>---+<\/p>/gi,          // <p>---</p>
    /<\/p><p>---+<\/p><p>/gi,  // </p><p>---</p><p>
    // AI meta-commentary patterns (plain text)
    /This theme (?:covers|provides|focuses|describes|explains|outlines|details|highlights|tracks|is about)[^.]*\./gi,
    /\n+This theme [^\n]*/gi,
    /An overview of [^.]*\./gi,
    /Exploration of [^.]*\./gi,
    /Steps for [^.]*\./gi,
    /Plans for [^.]*\./gi,
    /Risks and [^.]*related to[^.]*\./gi,
    /Configuring the [^.]*settings\./gi,
    /Different methods for [^.]*\./gi,
    /Important [^.]* practices when [^.]*\./gi,
    /[^.]*'s commitment to [^.]*\./gi,
    // AI meta-commentary (HTML wrapped) - short intro sentences before real content
    /<p>Introducing [^<]*\.<\/p>/gi,
    /<p>Configuring [^<]*\.<\/p>/gi,
    /<p>An overview [^<]*\.<\/p>/gi,
    /<p>Exploration [^<]*\.<\/p>/gi,
    /<p>Steps for [^<]*\.<\/p>/gi,
    /<p>Plans for [^<]*\.<\/p>/gi,
    /<p>This theme [^<]*\.<\/p>/gi,
  ];

  // Clean each node's content
  for (const nodeId of Object.keys(nodes)) {
    const node = nodes[nodeId];
    if (node.content) {
      let cleaned = node.content;

      // Direct string replacements first (most reliable)
      cleaned = cleaned.split('\n\n---\n\n').join('\n\n');
      cleaned = cleaned.split('\n---\n').join('\n');
      cleaned = cleaned.split('---').filter((part: string) => part.trim().length > 0).join(' ');

      // Then apply regex patterns
      for (const pattern of artifactPatterns) {
        cleaned = cleaned.replace(pattern, '');
      }
      // Clean up extra whitespace
      cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
      nodes[nodeId] = { ...node, content: cleaned };
    }
  }

  // Merge single-child chapters into siblings or parent
  const rootNode = nodes[rootNodeId];
  if (!rootNode?.childrenIds) return;

  const topLevelIds = [...rootNode.childrenIds];

  // Find chapters with only one child
  const singleChildChapters: string[] = [];
  for (const chapterId of topLevelIds) {
    const chapter = nodes[chapterId];
    if (chapter?.childrenIds?.length === 1) {
      singleChildChapters.push(chapterId);
    }
  }

  // If we have many single-child chapters (more than 2), try to merge them
  if (singleChildChapters.length > 2 && topLevelIds.length > 8) {
    console.log(`[Bullet Cleanup] Found ${singleChildChapters.length} single-child chapters, attempting to merge...`);

    // Strategy: Merge single-child chapters' content into their only child
    // and promote that child to chapter level
    for (const chapterId of singleChildChapters) {
      const chapter = nodes[chapterId];
      const onlyChildId = chapter.childrenIds[0];
      const onlyChild = nodes[onlyChildId];

      if (onlyChild) {
        // Combine chapter overview with child content
        const combinedContent = [chapter.content, onlyChild.content]
          .filter(c => c && c.trim())
          .join('\n\n');

        // Update the child with combined content and promote to chapter level
        nodes[onlyChildId] = {
          ...onlyChild,
          name: chapter.name, // Keep the broader chapter name
          content: combinedContent,
          parentId: rootNodeId,
          type: 'chapter',
          childrenIds: onlyChild.childrenIds || [],
        };

        // Update root's children: replace chapter with promoted child
        const chapterIndex = rootNode.childrenIds.indexOf(chapterId);
        if (chapterIndex !== -1) {
          rootNode.childrenIds[chapterIndex] = onlyChildId;
        }

        // Update any grandchildren to point to promoted child
        for (const grandchildId of (onlyChild.childrenIds || [])) {
          if (nodes[grandchildId]) {
            nodes[grandchildId] = { ...nodes[grandchildId], parentId: onlyChildId };
          }
        }

        // Remove the old chapter node
        delete nodes[chapterId];
      }
    }

    // Update root node
    nodes[rootNodeId] = rootNode;
  }
}

/**
 * Bullet-Based Research Import (Content-First Approach)
 *
 * 1. Extract atomic bullets from all sources
 * 2. If merging, also extract bullets from existing outline
 * 3. Combine all bullets into a single pool
 * 4. Organize the combined bullets into a hierarchical outline
 */
export async function bulletBasedResearchAction(
  input: BulkResearchSources,
  existingOutlineContent?: string
): Promise<BulkResearchResult> {
  try {
    // Extract content from all sources
    const extractedSources: Array<{ content: string; description: string; title?: string }> = [];
    const extractionErrors: string[] = [];

    for (const source of input.sources) {
      try {
        console.log(`[Bullet] Extracting from source type: ${source.type}`);
        const extracted = await extractContentFromSource(source);
        if (extracted.content) {
          console.log(`[Bullet] Got ${extracted.content.length} chars from ${source.type}`);
          extractedSources.push(extracted);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[Bullet] Failed to extract from ${source.type}:`, msg);
        extractionErrors.push(`${source.type}: ${msg}`);
      }
    }

    if (extractedSources.length === 0) {
      const detail = extractionErrors.length > 0
        ? extractionErrors.join('; ')
        : 'Unknown reason';
      throw new Error(`No content could be extracted. ${detail}`);
    }

    // Step 1: Extract bullets from new sources (using specified detail level)
    const detailLevel = input.detailLevel || 'standard';
    const useLocalAI = input.useLocalAI || false;
    console.log(`[Bullet] Extracting bullets from new sources (detail level: ${detailLevel}, local AI: ${useLocalAI})...`);
    const newBullets = await extractBulletsFromSources(extractedSources, detailLevel, useLocalAI);

    // Step 2: If merging, extract bullets from existing outline
    let allBullets: ContentBullet[] = [];
    if (input.includeExistingContent && existingOutlineContent) {
      console.log('[Bullet] Extracting bullets from existing outline...');
      const existingBullets = extractBulletsFromOutline(existingOutlineContent);
      // Existing bullets first, then new ones (to preserve original structure hints)
      allBullets = [...existingBullets, ...newBullets];
      console.log(`[Bullet] Combined: ${existingBullets.length} existing + ${newBullets.length} new = ${allBullets.length} total`);
    } else {
      allBullets = newBullets;
    }

    // Step 3: Determine outline name
    let outlineName: string;
    if (input.outlineName) {
      outlineName = input.outlineName;
    } else if (input.includeExistingContent) {
      outlineName = `Research Synthesis ${new Date().toLocaleDateString()}`;
    } else {
      const firstSourceTitle = extractedSources[0]?.title;
      if (firstSourceTitle) {
        outlineName = firstSourceTitle;
      } else {
        outlineName = await generateTitleFromContent(extractedSources[0].content);
      }
    }

    // Add delay before organization to avoid rate limits
    console.log('[Bullet] Waiting before organization step...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 4: Auto-detect merge strategy (unless manually specified)
    let strategy: MergeStrategy;
    let hasUserContext = false;

    if (input.mergeStrategy) {
      // User manually specified a strategy
      strategy = input.mergeStrategy;
      hasUserContext = true;
      console.log(`[Bullet] Using manual strategy: ${strategy}`);
    } else {
      // Auto-detect based on source analysis
      console.log('[Bullet] Auto-detecting merge strategy...');
      const detection = await detectMergeStrategy(extractedSources, outlineName, existingOutlineContent);
      strategy = detection.strategy;
      hasUserContext = detection.hasUserContext;
      console.log(`[Bullet] Auto-detected strategy: ${strategy} (hasUserContext: ${hasUserContext})`);
    }

    // Step 5: Organize all bullets into hierarchical outline
    console.log(`[Bullet] Organizing bullets into outline (strategy: ${strategy}, detail: ${detailLevel}, local AI: ${useLocalAI})...`);
    const { rootNodeId, nodes } = await organizeBulletsIntoOutline(allBullets, outlineName, strategy, detailLevel, useLocalAI);

    // Step 6: For 'separate' strategy without user context, add stub intro
    if (strategy === 'separate' && !hasUserContext && !input.includeExistingContent) {
      const stubIntro = `[This outline contains information about multiple distinct topics. Consider adding an introduction here that explains how these topics relate to your goals, or leave them as separate reference sections.]`;
      nodes[rootNodeId].content = stubIntro;
    }

    // Generate root summary
    if (!input.includeExistingContent) {
      const childContent = Object.values(nodes)
        .filter((n: any) => n.id !== rootNodeId && n.content)
        .map((n: any) => `${n.name}: ${n.content}`)
        .join('\n');

      if (childContent) {
        try {
          await new Promise(resolve => setTimeout(resolve, 3000));
          const summaryPrompt = `Write a brief introduction (2-3 sentences) summarizing this outline:

${childContent.substring(0, 5000)}`;

          const ollamaSummaryFallback = async () => {
            const result = await generateWithOllama({
              prompt: summaryPrompt,
              system: 'Write clear, concise summaries.',
              temperature: 0.7,
              maxTokens: 300,
            });
            return { text: result };
          };

          const { text: rootSummary } = await withRateLimitRetry(
            () => ai.generate({
              model: getDefaultGeminiModel('genkit'),
              prompt: summaryPrompt,
            }),
            1,
            'root summary',
            ollamaSummaryFallback
          );
          nodes[rootNodeId].content = rootSummary.trim();
        } catch (err) {
          console.warn('[Bullet] Failed to generate root summary:', err);
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

    // Save to pending results file in case HTTP response doesn't reach client
    // This allows recovery of long-running imports that "time out"
    console.log('[Bullet] Attempting to save pending result...');
    try {
      const pendingDir = path.join(os.homedir(), 'Documents', 'IDM Outlines', '.pending');
      console.log(`[Bullet] Pending directory: ${pendingDir}`);

      // Create pending directory if it doesn't exist
      if (!fs.existsSync(pendingDir)) {
        console.log('[Bullet] Creating pending directory...');
        fs.mkdirSync(pendingDir, { recursive: true });
      }

      // Save the outline with timestamp and merge context
      const pendingFile = path.join(pendingDir, `pending-${Date.now()}.json`);
      const pendingData = {
        outline,
        summary: `[Bullet-Based] Extracted ${allBullets.length} atomic facts from ${extractedSources.length} source(s), organized into ${Object.keys(nodes).length - 1} nodes.`,
        sourcesProcessed: extractedSources.length,
        createdAt: Date.now(),
        outlineName: outline.name,
        // Merge context for recovery
        mergeContext: {
          includeExistingContent: input.includeExistingContent,
          targetOutlineId: input.targetOutlineId,
        },
      };
      fs.writeFileSync(pendingFile, JSON.stringify(pendingData, null, 2));
      console.log(`[Bullet] ✅ Saved pending result to: ${pendingFile}`);
    } catch (saveError) {
      console.error('[Bullet] ❌ Could not save pending result:', saveError);
    }

    return {
      outline,
      summary: `[Bullet-Based] Extracted ${allBullets.length} atomic facts from ${extractedSources.length} source(s), organized into ${Object.keys(nodes).length - 1} nodes.`,
      sourcesProcessed: extractedSources.length,
    };
  } catch (error) {
    console.error('[Bullet] Error in bullet-based research:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    // Write error to file for debugging
    try {
      const errPath = path.join(os.homedir(), 'Documents', 'IDM Outlines', '.last-import-error.txt');
      fs.writeFileSync(errPath, `${new Date().toISOString()}\n${message}\n\n${error instanceof Error ? error.stack || '' : ''}`);
    } catch {}
    // Return error as data instead of throwing
    // (Next.js strips error messages from thrown errors in server actions)
    return {
      outline: null as any,
      summary: '',
      sourcesProcessed: 0,
      error: `Bullet-based research failed: ${message}`,
    } as any;
  }
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
        // Add delay after title generation to avoid rate limits
        console.log('Waiting 3 seconds before generating outline (rate limit protection)...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // Build comprehensive research prompt
    const sourcesList = extractedSources.map((s, idx) =>
      `\n=== SOURCE ${idx + 1}: ${s.description} ===\n${s.content}`
    ).join('\n\n');

    let researchPrompt: string;

    if (input.includeExistingContent && existingOutlineContent) {
      // MERGE MODE: Add to existing outline
      researchPrompt = `You are adding NEW information to an EXISTING outline. Be HIGHLY SELECTIVE.

EXISTING OUTLINE STRUCTURE:
${existingOutlineContent}

NEW SOURCE CONTENT:
${sourcesList}

CRITICAL RULES:
1. ONLY add content that is TRULY NEW and not already covered
2. Prefer adding to existing sections rather than creating new ones
3. Create a new section ONLY if the topic is completely absent from the existing outline
4. Maximum 2-3 new sections - consolidate aggressively
5. Each new section should be a MAJOR theme, not a minor detail

OUTPUT: Generate only the new sections to add (if any). Use format:
- Section Name: Substantive content

If the new sources mostly cover topics already in the outline, output just additional content points to add to existing sections, not new sections.

Generate additions:`;
    } else {
      // NEW OUTLINE MODE: Create from scratch
      researchPrompt = `You are creating a CONCISE research outline synthesizing multiple sources into KEY THEMES.

CRITICAL CONSTRAINTS:
- Maximum 5-8 top-level chapters (consolidate aggressively!)
- Each chapter should be a MAJOR theme that spans multiple sources
- Do NOT create separate chapters for each source
- Combine related subtopics into broader categories

TASK:
1. Identify the 5-8 MAIN themes across ALL sources
2. Group related information under these broad themes
3. Create substantive content for each section

OUTPUT FORMAT:
- Use markdown list format with proper indentation
- Format: "- Chapter Title: Summary and key points from all sources on this theme"
- Subsections should elaborate on specific aspects
- Every node MUST have substantive content

EXAMPLE (note: only 3 main chapters, not one per topic):
- Strategic Priorities: The sources emphasize three key areas for growth. Speaker A focuses on user retention, while B and C discuss expansion strategies. All agree on the mobile-first approach.
  - User Experience: Multiple speakers highlighted onboarding improvements. Current metrics show 40% drop-off. Solutions include simplified flows and better tutorials.
  - Mobile Strategy: Beta launch planned for March. Key features: offline mode, push notifications. This addresses the top user request across all surveys.

SOURCES TO SYNTHESIZE:
${sourcesList}

Generate the outline with content:`;
    }

    // Ollama fallback function for when cloud rate limits are exhausted
    const ollamaFallback = async () => {
      console.log('Using Ollama for outline generation...');
      console.log(`Prompt size: ${researchPrompt.length} chars`);

      const ollamaResult = await generateWithOllama({
        prompt: researchPrompt,
        system: 'You are an expert at creating hierarchical outlines. Create well-structured markdown outlines with proper indentation using "- " for each level.',
        temperature: 0.7,
        maxTokens: 4000,
      });

      // Validate Ollama returned actual content
      if (!ollamaResult || ollamaResult.trim().length < 50) {
        throw new Error('Ollama returned empty or insufficient content');
      }

      console.log(`Ollama generated ${ollamaResult.length} chars of outline`);
      return { outline: ollamaResult };
    };

    const result = await withRateLimitRetry(
      () => generateOutlineFromTopic({ topic: researchPrompt, depth: 'standard' }),
      1,  // One retry, then fallback to Ollama
      'outline generation',
      ollamaFallback
    );

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
        // Add delay before next AI call to avoid rate limits
        console.log('Waiting 3 seconds before generating root summary (rate limit protection)...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log('Generating root node summary...');
        try {
          const summaryPrompt = `Write a brief, non-technical introduction (2-4 sentences) that summarizes the following outline content. This will help readers quickly understand what this document covers. Be conversational and accessible:

${childContent.substring(0, 5000)}`;

          // Ollama fallback for root summary (auto-selects best available model)
          const ollamaSummaryFallback = async () => {
            const ollamaSummary = await generateWithOllama({
              prompt: summaryPrompt,
              system: 'You are a helpful assistant that writes clear, concise summaries.',
              temperature: 0.7,
              maxTokens: 500,
            });
            return { text: ollamaSummary };
          };

          const { text: rootSummary } = await withRateLimitRetry(
            () => ai.generate({
              model: getDefaultGeminiModel('genkit'),
              prompt: summaryPrompt,
            }),
            1,  // One retry, then fallback to Ollama
            'root summary generation',
            ollamaSummaryFallback
          );
          nodes[rootNodeId].content = rootSummary.trim();
          console.log('Root summary generated successfully');
        } catch (summaryError: any) {
          console.warn('Failed to generate root summary:', summaryError);
          // Set a fallback based on child topics
          const topicNames = Object.values(nodes)
            .filter(n => n.parentId === rootNodeId)
            .map(n => n.name)
            .slice(0, 5);
          if (topicNames.length > 0) {
            nodes[rootNodeId].content = `This outline covers ${topicNames.join(', ')}${topicNames.length < Object.values(nodes).filter(n => n.parentId === rootNodeId).length ? ', and more' : ''}.`;
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
      summary: `Successfully digested ${extractedSources.length} source${extractedSources.length > 1 ? 's' : ''} into a unified outline with ${Object.keys(nodes).length - 1} nodes.`,
      sourcesProcessed: extractedSources.length,
    };
  } catch (error) {
    console.error('Error in bulk research ingest:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    // Return error as data instead of throwing
    // (Next.js strips error messages from thrown errors in server actions)
    return {
      outline: null as any,
      summary: '',
      sourcesProcessed: 0,
      error: `Failed to process bulk research import: ${message}`,
    } as any;
  }
}

/**
 * INBOUND EMAIL IMPORT (Phase 2 — Professional Customization)
 *
 * Turn a pasted email / thread (or the text of a dropped .eml file) into a
 * clean, STRUCTURED outline — a Summary, Key Points, Decisions, and Action
 * Items — never a wall of quoted text. Reuses the same AI pipeline as bulk
 * research: Gemini via generateOutlineFromTopic with an automatic Ollama
 * fallback, or forced on-device when useLocalAI is set. One import counts as
 * one AI generation (the client gates it through useAIUsageGate).
 *
 * "File junk aside" (fileJunkAside): when importing a thread, the AI classifies
 * each message as keep vs. suspected-junk and files suspected junk under a
 * clearly-labeled "Filtered — likely junk" sub-branch. It NEVER deletes
 * anything — quarantine only, always rescuable. A single non-junk email
 * produces no such branch.
 */
const JUNK_BRANCH_LABEL = 'Filtered — likely junk';

function deriveEmailSubject(emailText: string): string | null {
  // Pull the first "Subject:" header if present (single email or .eml source).
  const m = emailText.match(/^\s*Subject:\s*(.+)$/im);
  if (m && m[1]) {
    const subj = m[1].replace(/^(re|fwd?):\s*/i, '').trim();
    if (subj.length > 2) return subj.slice(0, 100);
  }
  return null;
}

export async function importEmailAction(
  input: EmailImportInput
): Promise<EmailImportResult> {
  try {
    const emailText = (input.emailText || '').trim();
    if (!emailText || emailText.length < 10) {
      return {
        outline: null,
        summary: '',
        junkCount: 0,
        error: 'There was no email content to import. Paste an email or drop a .eml file first.',
      };
    }

    // Cap runaway input (very long threads / raw .eml with encoded attachments).
    const MAX_CHARS = 40000;
    const trimmedText = emailText.length > MAX_CHARS
      ? emailText.slice(0, MAX_CHARS) + '\n\n[content truncated for length]'
      : emailText;

    const junkInstruction = input.fileJunkAside
      ? `\nTHIS MAY BE A THREAD OF MULTIPLE MESSAGES. Classify EACH message as KEEP (real, substantive correspondence) or JUNK (promotional blast, marketing, newsletter, automated notification, spam, unsubscribe-footer noise).
- Fold all useful content from KEEP messages into the sections above.
- For EVERY message you judge JUNK, add ONE short bullet under a top-level section named EXACTLY "${JUNK_BRANCH_LABEL}" that names the sender and gist so the reader can glance and rescue it. NEVER discard a message silently and NEVER delete anything.
- If NOTHING is junk, OMIT the "${JUNK_BRANCH_LABEL}" section entirely.`
      : '';

    const emailPrompt = `You are turning an email${input.fileJunkAside ? ' thread' : ''} into a clean, STRUCTURED outline for a note-taking app. Distill it — do NOT paste walls of quoted text or raw headers.

Produce a markdown bullet outline using "- " for each item and indentation for nesting. Item titles must be short 2-6 word labels; put detail after a colon or in nested bullets.

Organize it under these top-level sections, INCLUDING a section only when it actually has content:
- Summary: a 1-3 sentence plain-English overview of what this email/thread is about.
- Key Points: the substantive points and important facts, one per bullet.
- Decisions: explicit decisions made or agreed (omit if none).
- Action Items: concrete to-dos — include who owns each and any due date, one per bullet (omit if none).
- Participants & Context: who is involved and relevant dates (optional, keep brief).
${junkInstruction}

EMAIL CONTENT:
${trimmedText}

Generate the structured outline now:`;

    const systemPrompt = 'You are an expert at distilling email correspondence into clean, hierarchical outlines. Output only a well-structured markdown bullet outline (using "- " and indentation). Never echo raw email headers, quoted reply chains, or signatures verbatim.';

    let outlineMarkdown: string;

    if (input.useLocalAI) {
      // Forced on-device — run entirely through Ollama.
      const ollamaResult = await generateWithOllama({
        prompt: emailPrompt,
        system: systemPrompt,
        temperature: 0.5,
        maxTokens: 4000,
      });
      if (!ollamaResult || ollamaResult.trim().length < 30) {
        throw new Error('Local AI returned empty or insufficient content.');
      }
      outlineMarkdown = ollamaResult;
    } else {
      const ollamaFallback = async () => {
        const ollamaResult = await generateWithOllama({
          prompt: emailPrompt,
          system: systemPrompt,
          temperature: 0.5,
          maxTokens: 4000,
        });
        if (!ollamaResult || ollamaResult.trim().length < 30) {
          throw new Error('Ollama returned empty or insufficient content');
        }
        return { outline: ollamaResult };
      };

      const result = await withRateLimitRetry(
        () => generateOutlineFromTopic({ topic: emailPrompt, depth: 'standard' }),
        1,
        'email import',
        ollamaFallback
      );
      outlineMarkdown = result.outline;
    }

    if (!outlineMarkdown || outlineMarkdown.trim().length < 10) {
      return {
        outline: null,
        summary: '',
        junkCount: 0,
        error: 'The AI could not structure that email. Try again, or paste a bit more of the message.',
      };
    }

    // Name the outline from the subject, an explicit override, or a date fallback.
    const outlineName =
      input.outlineName?.trim() ||
      deriveEmailSubject(emailText) ||
      `Email import ${new Date().toLocaleDateString()}`;

    const { rootNodeId, nodes } = parseMarkdownToNodes(outlineMarkdown, outlineName);

    // Count how many messages were quarantined under the junk sub-branch (if any).
    let junkCount = 0;
    if (input.fileJunkAside) {
      const junkNode = Object.values(nodes).find(
        n =>
          n.id !== rootNodeId &&
          /filtered|likely\s*junk|junk/i.test(n.name || '')
      );
      if (junkNode) {
        junkCount = (junkNode.childrenIds || []).length || 1;
      }
    }

    const outline: Outline = {
      id: uuidv4(),
      name: outlineName,
      rootNodeId,
      nodes,
      lastModified: Date.now(),
    };

    const nodeCount = Object.keys(nodes).length - 1;
    const junkNote = junkCount > 0
      ? ` ${junkCount} suspected-junk message${junkCount === 1 ? '' : 's'} filed aside (nothing deleted).`
      : '';

    return {
      outline,
      summary: `Structured the email into ${nodeCount} point${nodeCount === 1 ? '' : 's'}.${junkNote}`,
      junkCount,
    };
  } catch (error) {
    console.error('Error in email import:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      outline: null,
      summary: '',
      junkCount: 0,
      error: `Failed to import the email: ${message}`,
    };
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
  options: TranscriptionOptions = {},
  userAssemblyaiKey?: string | null
): Promise<{
  success: boolean;
  transcript?: DiarizedTranscript;
  formattedText?: string;
  error?: string;
  upgradeRequired?: boolean;
}> {
  try {
    // Transcription (AssemblyAI) is a PAID-per-use feature. It may run ONLY on
    // the user's own key (BYOK) or a funded COMPANY key — NEVER the founder's
    // personal env key. The shared server gate enforces plan + lifetime taste.
    const byokKey = typeof userAssemblyaiKey === 'string' ? userAssemblyaiKey.trim() : '';
    const isByok = byokKey.length > 0;
    const decision = await enforcePaidFeature('transcription', { isByok });
    if (!decision.ok) {
      return { success: false, error: decision.error, upgradeRequired: decision.upgradeRequired };
    }
    const assemblyKey = decision.fund === 'byok' ? byokKey : getCompanyKey('transcription');
    if (!assemblyKey) {
      return {
        success: false,
        upgradeRequired: true,
        error: 'Audio transcription runs on your own AssemblyAI key for now. Add one in Settings → AI Service Keys.',
      };
    }

    // Transcribe with diarization
    const transcript = await transcribeWithDiarization(audioData, mimeType, options, assemblyKey);

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

/**
 * Generate an AI Image using Google Imagen 3 (PREMIUM Feature)
 *
 * Takes a text prompt and returns a base64-encoded image.
 * Uses the Imagen 3 model through the Google GenAI API.
 */
export async function generateImageAction(
  prompt: string,
  options: {
    aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  } = {},
  userApiKey?: string | null,
): Promise<{
  success: boolean;
  imageBase64?: string;
  mimeType?: string;
  error?: string;
}> {
  try {
    // AI image generation (Imagen) is a PAID-per-use feature. It may run ONLY
    // on the user's own key (BYOK) or a funded COMPANY key — NEVER the
    // founder's personal env key. The shared server gate enforces plan +
    // lifetime taste.
    const byokKey = (userApiKey && userApiKey.trim()) || '';
    const isByok = byokKey.length > 0;
    const decision = await enforcePaidFeature('imageGeneration', { isByok });
    if (!decision.ok) {
      return { success: false, error: decision.error };
    }
    const apiKey = decision.fund === 'byok' ? byokKey : getCompanyKey('imageGeneration');
    if (!apiKey) {
      return {
        success: false,
        error: 'AI image generation runs on your own Gemini key for now. Add one in Settings → AI Service Keys.',
      };
    }

    const genai = new GoogleGenAI({ apiKey });

    const response = await genai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: prompt,
      config: {
        numberOfImages: 1,
        aspectRatio: options.aspectRatio || '1:1',
      },
    });

    if (!response.generatedImages || response.generatedImages.length === 0) {
      throw new Error('No image was generated');
    }

    const generatedImage = response.generatedImages[0];
    const imageBytes = generatedImage.image?.imageBytes;

    if (!imageBytes) {
      throw new Error('Generated image has no data');
    }

    return {
      success: true,
      imageBase64: imageBytes,
      mimeType: 'image/png',
    };
  } catch (error) {
    console.error('Error generating image:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Image generation failed',
    };
  }
}

/**
 * Generate a descriptive caption for an AI-generated image (PREMIUM Feature)
 *
 * Uses Gemini to create a meaningful textual description that explains
 * what the image represents and its conceptual significance.
 */
export async function generateImageDescriptionAction(
  imagePrompt: string,
  nodeName: string
,
  userApiKey?: string | null,
): Promise<{
  success: boolean;
  description?: string;
  error?: string;
}> {
  try {
    const { text } = await withRateLimitRetry(
      () => ai.generate({
        model: getDefaultGeminiModel('genkit'),
        prompt: `You are writing a descriptive caption for an illustration. The image was generated from this prompt: "${imagePrompt}" for a section titled "${nodeName}".

Write a description that fully explains what the image depicts and why it matters. Your description should:
- Clearly describe the key elements, relationships, and structure shown in the image
- Connect the visual to the concept or topic it illustrates
- Highlight the key insights or takeaways the viewer should get from it
- For complex diagrams, explain the flow, components, and how they interact

The description should be as long as needed to clearly convey the meaning — a simple image might need a few sentences, while a complex diagram or flowchart may need a full paragraph or more. Be thorough but avoid filler. Write in a clear, professional tone. Do NOT mention that the image is AI-generated.

Return ONLY the description text, no prefixes like "Caption:" or "Description:".`,
      }),
      1,
      'image description generation'
    );

    return {
      success: true,
      description: text.trim(),
    };
  } catch (error) {
    console.error('Error generating image description:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Description generation failed',
    };
  }
}

/**
 * Describe a user-supplied image using AI vision (local Gemma 4 or cloud Gemini).
 *
 * When provider is 'local' or 'auto' with Ollama available, the image bytes
 * stay entirely on-device — nothing is sent to the cloud.
 *
 * @param imageBase64 - Base64-encoded image data (no data: prefix)
 * @param context - Optional context: node name, surrounding text, user instruction
 * @param provider - 'cloud' | 'local' | 'auto'
 */
export async function describeImageAction(
  imageBase64: string,
  context: string = '',
  provider: 'cloud' | 'local' | 'auto' = 'auto'
,
  userApiKey?: string | null,
): Promise<{
  success: boolean;
  description?: string;
  provider?: string;
  error?: string;
}> {
  const prompt = context
    ? `Describe this image in detail. Context: ${context}. Focus on what is depicted, key elements, text if visible, and relevance to the context. Return ONLY the description.`
    : `Describe this image in detail: what is depicted, key elements, any visible text, layout, and purpose. Return ONLY the description.`;

  // Try local first if provider allows it
  if (provider === 'local' || provider === 'auto') {
    try {
      const available = await isOllamaAvailable();
      if (available) {
        const model = await getBestAvailableModel();
        if (model) {
          const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              prompt,
              images: [imageBase64],
              stream: false,
              think: false,
              options: { temperature: 0.3, num_predict: 1000 },
            }),
          });
          if (response.ok) {
            const data = await response.json();
            if (data.response) {
              return { success: true, description: data.response.trim(), provider: `Ollama ${model}` };
            }
          }
        }
      }
      // If provider was explicitly 'local' and Ollama failed, don't fall through to cloud
      if (provider === 'local') {
        return { success: false, error: 'Ollama is not available. Check that Ollama is running with a Gemma 4 model installed.' };
      }
    } catch (err) {
      if (provider === 'local') {
        return { success: false, error: `Local AI failed: ${err instanceof Error ? err.message : 'Unknown error'}` };
      }
      // Auto mode: fall through to cloud
    }
  }

  // Cloud path (Gemini)
  try {
    const _describeKey = (userApiKey && userApiKey.trim()) || process.env.GEMINI_API_KEY || '';
    const genai = new GoogleGenAI({ apiKey: _describeKey });
    const result = await genai.models.generateContent({
      model: getDefaultGeminiModel('sdk'),
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType: 'image/png', data: imageBase64 } },
        ],
      }],
    });
    const text = result.text || '';
    return { success: true, description: text.trim(), provider: 'Gemini 2.0 Flash' };
  } catch (error) {
    console.error('Error describing image:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Image description failed',
    };
  }
}


export async function interpretCommandAction(input: InterpretCommandInput): Promise<InterpretedCommand> {
  try {
    return await interpretCommand(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Interpretation failed';
    console.error('Error interpreting command:', message);
    return {
      action: {
        kind: 'unknown',
        reason: "Something went wrong on my end while I was thinking that through. Mind trying again in a moment?",
      },
      destructive: false,
      confidence: 'low',
      human_description: "I didn't act on that.",
    };
  }
}

export async function transcribeAudioAction(input: TranscribeAudioInput): Promise<TranscribeAudioResult> {
  // Defensive boundary: this Server Action MUST always resolve with a plain,
  // JSON-serializable {transcript, error} object. If anything in the chain
  // throws a non-Error value, Next.js wraps it as the opaque
  // "An unexpected response was received from the server" message. Coerce
  // every possible shape of error to a plain string before returning.
  try {
    const result = await transcribeAudioWithGemini(input);
    // Re-shape into a plain object in case Gemini's SDK leaks an exotic field.
    return {
      transcript: typeof result?.transcript === 'string' ? result.transcript : '',
      ...(result?.error ? { error: String(result.error) } : {}),
    };
  } catch (error) {
    let message: string;
    try {
      if (error instanceof Error && error.message) {
        message = error.message;
      } else if (error && typeof (error as any).message === 'string') {
        message = String((error as any).message);
      } else {
        message = String(error);
      }
    } catch {
      message = 'Transcription failed';
    }
    console.error('Error transcribing audio:', message);
    return { transcript: '', error: message };
  }
}


// ==========================================================================
// MULTIMEDIA AI (2026-06-11) — Image-to-Outline + YouTube package generation.
//
// These two server actions both use Gemini's multimedia / generation API.
// They never apply anything to user outlines — they only produce proposals.
// The renderer dialogs show the preview and only commit on user approval,
// going through the existing auto-snapshot + derivative-flow protections.
// ==========================================================================

export interface ImageToOutlineProposedNode {
  name: string;
  content?: string;
  children?: ImageToOutlineProposedNode[];
}

export interface ImageToOutlineResult {
  success: boolean;
  rootLabel?: string;
  proposedNodes?: ImageToOutlineProposedNode[];
  provider?: string;
  error?: string;
}

/**
 * Image-to-Outline: send an image (base64 PNG/JPEG) to the AI and parse a
 * hierarchical outline structure out of it. Use cases: whiteboard photos,
 * mind maps, diagrams, sticky-note brainstorms, slide screenshots.
 *
 * The provider is currently hardcoded to Gemini; the dialog passes through
 * a future-proof `provider` option so we can route to Claude Vision or
 * other vision models without changing call sites.
 */
export async function imageToOutlineAction(
  imageBase64: string,
  context: string = '',
  provider: 'gemini' = 'gemini',
  userApiKey?: string | null,
): Promise<ImageToOutlineResult> {
  const _provider = provider; // reserved for future provider routing
  void _provider;
  const prompt = `You will extract a HIERARCHICAL OUTLINE from this image.

The image may be: a whiteboard photo, a hand-drawn mind map, a diagram, a sticky-note brainstorm, a screenshot of slides or a textbook page, or any other content with implied or visible structure.

${context ? `Context the user gave: ${context}\n\n` : ''}Return ONLY a valid JSON object with this exact shape:
{
  "rootLabel": "Short descriptive title for the whole outline",
  "nodes": [
    {
      "name": "Top-level item name (short)",
      "content": "Optional plain-text body, 1-3 sentences",
      "children": [
        { "name": "Child item", "content": "Optional", "children": [] }
      ]
    }
  ]
}

Rules:
- Preserve hierarchy you can see in the image (indentation, bullets, branches of a mind map, columns of sticky notes).
- Keep node names short (under 60 characters when possible).
- Put longer explanation in "content".
- If the image is text-heavy (a slide, a page), break it into logical sections instead of dumping everything into one node.
- Output STRICTLY the JSON object — no markdown fences, no commentary.`;

  // Cloud path (Gemini). Local vision via Ollama is supported by the
  // describeImageAction pattern but image-to-outline needs structured JSON
  // output, which the cloud models are far more reliable at. v1: cloud only.
  try {
    const key = (userApiKey && userApiKey.trim()) || process.env.GEMINI_API_KEY || '';
    if (!key) {
      return {
        success: false,
        error: 'No Gemini API key found. Add one in Settings, or set GEMINI_API_KEY in your environment.',
      };
    }
    const genai = new GoogleGenAI({ apiKey: key });
    const result = await genai.models.generateContent({
      model: getDefaultGeminiModel('sdk'),
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType: 'image/png', data: imageBase64 } },
        ],
      }],
    });
    const text = (result.text || '').trim();
    // Strip optional code fences in case the model wraps despite the rule.
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();
    let parsed: { rootLabel?: string; nodes?: ImageToOutlineProposedNode[] };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return {
        success: false,
        error: 'The AI response did not come back as valid JSON. Try again, or use a clearer image.',
      };
    }
    if (!parsed || !Array.isArray(parsed.nodes) || parsed.nodes.length === 0) {
      return {
        success: false,
        error: 'The AI did not detect any structure in the image. Try a clearer or more structured image.',
      };
    }
    return {
      success: true,
      rootLabel: parsed.rootLabel || 'Captured from image',
      proposedNodes: parsed.nodes,
      provider: 'Gemini 2.0 Flash',
    };
  } catch (error) {
    console.error('Error in imageToOutlineAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Image-to-outline failed.',
    };
  }
}


export interface YoutubePackageInput {
  /** The user-facing chapter title (the selected node's name). */
  chapterName: string;
  /** Optional plain-text dump of the chapter and its descendants. */
  chapterContext: string;
  /** Target duration in seconds. */
  durationSeconds: 60 | 90 | 120 | 300;
  /** Stylistic register the user picked. */
  style: 'tutorial' | 'explainer' | 'promo' | 'story';
  /** Free-text audience hint (e.g. "developers", "general"). */
  audience: string;
  userApiKey?: string | null;
}

export interface YoutubePackage {
  voiceoverScript: string;       // Full narration with [shot N] markers + timing cues
  chapters: string;              // YouTube-style chapter list ("00:00 Intro · 00:15 …")
  description: string;           // 200-300 word description with chapter markers + keywords
  titleVariants: string[];       // 5 CTR-optimized title suggestions
  seoTags: string[];             // 15-20 YouTube tags
  thumbnailConcept: string;      // Recommended composition (text)
  brollPrompts: string[];        // Ready-to-paste AI video gen prompts
  screenRecordingShotList: string[]; // Steps to record in-app demo segments
}

export interface YoutubePackageResult {
  success: boolean;
  package?: YoutubePackage;
  provider?: string;
  error?: string;
}

/**
 * Generate a complete YouTube content package from a chapter (a selected
 * node + its descendants). Output: 8 fields, shown in 8 editable tabs.
 * Future-proofed to support other AI providers via the provider arg.
 */
export async function generateYoutubePackageAction(
  input: YoutubePackageInput,
): Promise<YoutubePackageResult> {
  const minutes = input.durationSeconds / 60;
  const durationLabel = input.durationSeconds < 120
    ? `${input.durationSeconds} seconds`
    : `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const styleHint = ({
    tutorial: 'step-by-step tutorial that teaches a specific skill',
    explainer: 'clear explainer that breaks down a concept',
    promo: 'punchy promotional video that hooks fast and has a CTA',
    story: 'narrative story-driven format with a beginning, middle, end',
  } as const)[input.style];

  const prompt = `You are producing a YouTube content package for the chapter "${input.chapterName}".

Target duration: ${durationLabel}.
Style: ${styleHint}.
Audience: ${input.audience || 'general'}.

Chapter content the package must cover:
"""
${input.chapterContext.slice(0, 8000)}
"""

Return ONLY a valid JSON object with this exact shape:
{
  "voiceoverScript": "Full narration with timing cues and [shot 1], [shot 2] markers inline. Total spoken length should match the target duration when read aloud at normal pace.",
  "chapters": "YouTube description chapter markers, one per line, format MM:SS Title (e.g. 00:00 Intro)",
  "description": "200-300 word YouTube description: hook, value summary, chapter markers section, relevant keywords woven in naturally",
  "titleVariants": ["Title 1", "Title 2", "Title 3", "Title 4", "Title 5"],
  "seoTags": ["tag1", "tag2", "..."],
  "thumbnailConcept": "Text description of the recommended thumbnail composition: subject, expression, text overlay, color palette",
  "brollPrompts": ["AI video gen prompt 1", "prompt 2", "..."],
  "screenRecordingShotList": ["Step 1 to record", "Step 2", "..."]
}

Rules:
- voiceoverScript: include [shot N] markers AND time cues like (0:00-0:08).
- titleVariants: exactly 5 entries, CTR-optimized but honest.
- seoTags: 15-20 YouTube tags, lowercase, no leading hash.
- brollPrompts: 4-8 ready-to-paste prompts for Runway / MagicLight / Sora.
- screenRecordingShotList: 4-10 concrete recording steps for in-app demo segments.
- Output STRICTLY the JSON object — no markdown fences, no commentary.`;

  try {
    const key = (input.userApiKey && input.userApiKey.trim()) || process.env.GEMINI_API_KEY || '';
    if (!key) {
      return {
        success: false,
        error: 'No Gemini API key found. Add one in Settings, or set GEMINI_API_KEY in your environment.',
      };
    }
    const genai = new GoogleGenAI({ apiKey: key });
    const result = await genai.models.generateContent({
      model: getDefaultGeminiModel('sdk'),
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    const text = (result.text || '').trim();
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();
    let parsed: Partial<YoutubePackage>;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return {
        success: false,
        error: 'The AI response did not come back as valid JSON. Try again.',
      };
    }
    const pkg: YoutubePackage = {
      voiceoverScript: parsed.voiceoverScript || '',
      chapters: parsed.chapters || '',
      description: parsed.description || '',
      titleVariants: Array.isArray(parsed.titleVariants) ? parsed.titleVariants : [],
      seoTags: Array.isArray(parsed.seoTags) ? parsed.seoTags : [],
      thumbnailConcept: parsed.thumbnailConcept || '',
      brollPrompts: Array.isArray(parsed.brollPrompts) ? parsed.brollPrompts : [],
      screenRecordingShotList: Array.isArray(parsed.screenRecordingShotList) ? parsed.screenRecordingShotList : [],
    };
    return { success: true, package: pkg, provider: 'Gemini 2.0 Flash' };
  } catch (error) {
    console.error('Error in generateYoutubePackageAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'YouTube package generation failed.',
    };
  }
}
