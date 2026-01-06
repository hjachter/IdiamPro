'use server';

import { generateOutlineFromTopic } from '@/ai/flows/generate-outline-from-topic';
import { expandNodeContent } from '@/ai/flows/expand-node-content';
import type {
  NodeGenerationContext,
  ExternalSourceInput,
  IngestPreview,
} from '@/types';

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

    if (source.type === 'text' && source.content) {
      extractedContent = source.content;
    } else if (source.type === 'youtube' && source.url) {
      // TODO: Implement YouTube transcript extraction
      // For now, return a stub that explains the limitation
      extractedContent = `[YouTube Video: ${source.url}]\n\nNote: Automatic transcript extraction is not yet implemented. Please paste the video transcript or key points manually.`;
    } else if (source.type === 'pdf' && source.url) {
      // TODO: Implement PDF text extraction
      // For now, return a stub that explains the limitation
      extractedContent = `[PDF Document: ${source.url}]\n\nNote: Automatic PDF text extraction is not yet implemented. Please paste the document content manually.`;
    }

    if (!extractedContent) {
      throw new Error('No content could be extracted from the source.');
    }

    // Generate outline structure from content
    const outlinePrompt = existingOutlineSummary
      ? `Based on the following content, suggest how to merge it into an existing outline.\n\nExisting outline structure:\n${existingOutlineSummary}\n\nNew content to integrate:\n${extractedContent}`
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
