import type { NodeMap, PodcastStyle, PodcastLength, PodcastScriptSegment, OpenAIVoice } from '@/types';

// Maximum content length to send to the AI (roughly 50K chars)
const MAX_CONTENT_CHARS = 50000;

/**
 * Strip HTML tags from content, returning plain text.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Walk the subtree depth-first, extracting plain text with hierarchy indicators.
 */
export function extractSubtreeContent(nodes: NodeMap, rootId: string): string {
  const parts: string[] = [];
  let totalChars = 0;
  let truncated = false;

  function walk(nodeId: string, depth: number) {
    if (truncated) return;

    const node = nodes[nodeId];
    if (!node) return;

    const indent = '  '.repeat(depth);
    const heading = depth === 0 ? `# ${node.name}` : `${'#'.repeat(Math.min(depth + 1, 6))} ${node.name}`;

    let section = `${heading}\n`;

    const content = stripHtml(node.content);
    if (content) {
      section += `${content}\n`;
    }
    section += '\n';

    totalChars += section.length;
    if (totalChars > MAX_CONTENT_CHARS) {
      truncated = true;
      parts.push('[... content truncated due to length ...]\n');
      return;
    }

    parts.push(section);

    for (const childId of node.childrenIds) {
      walk(childId, depth + 1);
    }
  }

  walk(rootId, 0);

  return parts.join('');
}

/**
 * Get speaker names based on podcast style.
 */
export function getDefaultSpeakers(style: PodcastStyle): string[] {
  switch (style) {
    case 'two-host':
      return ['Host A', 'Host B'];
    case 'narrator':
      return ['Narrator'];
    case 'interview':
      return ['Interviewer', 'Guest'];
    case 'debate':
      return ['Speaker A', 'Speaker B'];
  }
}

/**
 * Get default voice assignments for a style.
 */
export function getDefaultVoices(style: PodcastStyle): Record<string, OpenAIVoice> {
  const speakers = getDefaultSpeakers(style);
  const defaultVoicePairs: [OpenAIVoice, OpenAIVoice] = ['nova', 'onyx'];

  const voices: Record<string, OpenAIVoice> = {};
  speakers.forEach((speaker, i) => {
    voices[speaker] = defaultVoicePairs[i] || 'alloy';
  });
  return voices;
}

/**
 * Length target word counts for the script.
 */
const LENGTH_TARGETS: Record<PodcastLength, { min: number; max: number; label: string }> = {
  brief: { min: 300, max: 450, label: '2-3 minutes' },
  standard: { min: 750, max: 1200, label: '5-8 minutes' },
  detailed: { min: 1500, max: 2250, label: '10-15 minutes' },
};

/**
 * Build the AI prompt for generating a podcast script.
 */
export function buildScriptPrompt(
  content: string,
  style: PodcastStyle,
  length: PodcastLength,
  speakerNames: string[],
): { system: string; user: string } {
  const target = LENGTH_TARGETS[length];

  const system = `You are an expert podcast scriptwriter. Convert structured outline content into a natural, engaging podcast script.

RULES:
- Stay faithful to the source material — do not invent facts
- Create natural transitions between topics
- Use conversational language appropriate for audio
- Each segment should be 1-4 sentences (15-60 words)
- Output ONLY valid JSON array: [{"speaker": "Name", "text": "..."}]
- No markdown, no code fences, no explanation — ONLY the JSON array
- Target total script length: ${target.min}-${target.max} words (approximately ${target.label} of audio)

SPEAKERS: ${speakerNames.join(', ')}`;

  let styleInstructions: string;
  switch (style) {
    case 'two-host':
      styleInstructions = `STYLE: Two-Host Discussion
- ${speakerNames[0]} introduces topics and sets up key points
- ${speakerNames[1]} adds analysis, examples, and deeper insight
- Use natural conversational patterns — brief agreements, follow-up questions
- Include transitions like "That's a great point..." or "Building on that..."
- Alternate speakers frequently for engaging pacing`;
      break;
    case 'narrator':
      styleInstructions = `STYLE: Single Narrator
- ${speakerNames[0]} presents all content in a warm, authoritative tone
- Use transitions like "Now let's turn to..." and "An important aspect is..."
- Organize into logical sections with clear topic shifts
- Include brief pauses/transitions between major sections
- Speak directly to the listener — "you'll find that..." or "consider this..."`;
      break;
    case 'interview':
      styleInstructions = `STYLE: Interview Format
- ${speakerNames[0]} asks insightful questions that guide through the content
- ${speakerNames[1]} answers with depth, drawing from the source material
- Questions should build on previous answers naturally
- Include follow-up questions for complex topics
- ${speakerNames[0]} occasionally summarizes key takeaways`;
      break;
    case 'debate':
      styleInstructions = `STYLE: Debate/Discussion
- ${speakerNames[0]} and ${speakerNames[1]} take different interpretive angles on the content
- Include respectful challenges and rebuttals
- Both speakers should cite specific points from the source material
- Include moments of agreement to keep it balanced
- End with synthesis or common ground`;
      break;
  }

  const user = `${styleInstructions}

SOURCE CONTENT:
${content}

Generate the podcast script as a JSON array. Remember: ONLY output the JSON array, nothing else.`;

  return { system, user };
}

/**
 * Parse the AI response into script segments, assigning voices.
 */
export function parseScriptResponse(
  text: string,
  voiceMap: Record<string, OpenAIVoice>,
): PodcastScriptSegment[] {
  // Try to extract JSON array from the response
  let jsonStr = text.trim();

  // Remove markdown code fences if present
  jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '');

  // Try to find array brackets
  const arrayStart = jsonStr.indexOf('[');
  const arrayEnd = jsonStr.lastIndexOf(']');
  if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
    jsonStr = jsonStr.slice(arrayStart, arrayEnd + 1);
  }

  let parsed: Array<{ speaker: string; text: string }>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // Regex fallback: try to extract individual objects
    const objectPattern = /\{\s*"speaker"\s*:\s*"([^"]+)"\s*,\s*"text"\s*:\s*"([^"]+)"\s*\}/g;
    parsed = [];
    let match;
    while ((match = objectPattern.exec(text)) !== null) {
      parsed.push({ speaker: match[1], text: match[2] });
    }

    if (parsed.length === 0) {
      throw new Error('Could not parse podcast script from AI response');
    }
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('AI returned empty or invalid script');
  }

  return parsed.map((segment) => ({
    speaker: segment.speaker,
    voice: voiceMap[segment.speaker] || 'alloy',
    text: segment.text,
  }));
}
