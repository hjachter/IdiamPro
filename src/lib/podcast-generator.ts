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

  const system = `You are a world-class podcast scriptwriter known for creating captivating, high-energy audio content. Your scripts sound like two friends who are genuinely excited about the topic — NOT like a dry lecture or news broadcast.

CRITICAL STYLE RULES:
- Write like people actually TALK, not how they write. Use contractions, sentence fragments, interruptions.
- Speakers should react genuinely: "Oh wow, I didn't realize that!", "Wait, really?", "That's wild!", "OK so here's the thing..."
- Include natural verbal fillers and reactions: "Right", "Exactly", "Hmm", "So basically...", "I mean think about it..."
- Vary energy levels — build excitement, have moments of reflection, express surprise
- Speakers should riff on each other's points, not just take turns delivering monologues
- Make the listener feel like they're eavesdropping on a fascinating conversation
- Each segment: 1-4 sentences. Keep the back-and-forth rapid and dynamic.
- NEVER sound like a textbook. Transform dry facts into compelling stories and insights.
- Start with an engaging hook that draws listeners in immediately

OUTPUT FORMAT:
- Output ONLY a valid JSON array: [{"speaker": "Name", "text": "..."}]
- No markdown, no code fences, no explanation — ONLY the JSON array
- Target total script length: ${target.min}-${target.max} words (approximately ${target.label} of audio)

SPEAKERS: ${speakerNames.join(', ')}`;

  let styleInstructions: string;
  switch (style) {
    case 'two-host':
      styleInstructions = `STYLE: Two-Host Deep Dive (think: best friends geeking out)
- ${speakerNames[0]} drives the conversation, sets up topics with enthusiasm and curiosity
- ${speakerNames[1]} reacts authentically, adds surprising angles, connects dots the listener wouldn't expect
- They interrupt each other (briefly!) when excited: "Oh, and that connects to—" "Yes! Exactly!"
- Use callbacks to earlier points: "Remember when we talked about...? Well get this..."
- Express genuine wonder: "What blows my mind is...", "The part that really got me was..."
- Disagree sometimes! "Hmm, I actually see that differently..." then come around or agree to disagree
- End segments with teasers: "But wait, it gets even more interesting..."
- Laugh occasionally, be human. These are real people, not AI voices.`;
      break;
    case 'narrator':
      styleInstructions = `STYLE: Compelling Solo Narrator (think: best TED talk you've ever heard)
- ${speakerNames[0]} speaks with warmth, authority, and genuine passion
- Pull the listener in: "Here's what most people miss...", "Now, this is where it gets really interesting..."
- Use rhetorical questions: "But why does this matter? Well..."
- Create narrative tension: "And just when you think you understand it... there's a twist."
- Vary pacing — slow down for important revelations, speed up for exciting sequences
- Speak TO the listener: "Picture this...", "Think about the last time you...", "You might be wondering..."
- Use vivid analogies to make abstract concepts click`;
      break;
    case 'interview':
      styleInstructions = `STYLE: Engaging Interview (think: the best podcast interview you've heard)
- ${speakerNames[0]} is a curious, well-prepared interviewer who asks the questions the audience is thinking
- ${speakerNames[1]} is an enthusiastic expert who lights up when talking about the topic
- Interviewer reacts genuinely: "Wow, I never thought of it that way", "OK, unpack that for me..."
- Expert uses stories and examples, not just facts: "So here's a perfect example of that..."
- Include "aha moment" follow-ups: "Wait, so you're saying that...?" "Exactly! And here's why that matters..."
- Interviewer occasionally pushes back: "But couldn't someone argue that...?"
- Expert gets visibly excited about their favorite parts: "Oh, this is my favorite part..."`;
      break;
    case 'debate':
      styleInstructions = `STYLE: Lively Debate (think: respectful but passionate intellectual sparring)
- ${speakerNames[0]} and ${speakerNames[1]} take genuinely different angles — not fake disagreement
- Challenge each other directly: "I hear what you're saying, but consider this..."
- Acknowledge good points before countering: "OK, that's fair, BUT..."
- Use evidence from the source: "Look, the content literally says..."
- Build tension: "I think you're missing the bigger picture here..."
- Have breakthrough moments: "Actually... hmm, you might have a point there."
- End with genuine synthesis — what did they learn from each other?`;
      break;
  }

  const user = `${styleInstructions}

SOURCE CONTENT:
${content}

Generate a captivating podcast script. Make it sound like a REAL conversation between passionate, knowledgeable people — not a script being read aloud. Output ONLY the JSON array.`;

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
