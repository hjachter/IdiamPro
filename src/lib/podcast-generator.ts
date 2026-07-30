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
 * Canonical labels for the OpenAI TTS voices. Single source of truth shared by
 * the Podcast dialog and the Generate Video Style step so the two features
 * always offer the same voice menu (never drift apart).
 */
export const OPENAI_VOICE_LABELS: Record<OpenAIVoice, string> = {
  alloy: 'Alloy (neutral)',
  echo: 'Echo (male)',
  fable: 'Fable (expressive)',
  nova: 'Nova (female)',
  onyx: 'Onyx (male, deep)',
  shimmer: 'Shimmer (female, warm)',
};

/** The voices in menu order, ready for a radio group / dropdown. */
export const OPENAI_VOICE_OPTIONS: { value: OpenAIVoice; label: string }[] =
  (Object.keys(OPENAI_VOICE_LABELS) as OpenAIVoice[]).map((value) => ({
    value,
    label: OPENAI_VOICE_LABELS[value],
  }));

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
const LENGTH_TARGETS: Record<PodcastLength, { min: number; max: number; minSegments: number; label: string }> = {
  brief: { min: 300, max: 450, minSegments: 12, label: '2-3 minutes' },
  standard: { min: 750, max: 1200, minSegments: 30, label: '5-8 minutes' },
  detailed: { min: 1500, max: 2250, minSegments: 60, label: '10-15 minutes' },
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

CRITICAL LENGTH REQUIREMENT — THIS IS MANDATORY:
- You MUST generate between ${target.min} and ${target.max} total words of dialogue
- This means at least ${target.minSegments} dialogue segments (speaker turns)
- The final podcast should be approximately ${target.label} of audio
- Each segment should be 1-4 sentences (15-60 words)
- Do NOT stop early. Cover ALL major topics from the source content.
- If the content is long, discuss EVERY section — do not skip or summarize away sections
- Count your words mentally as you write. If you're under ${target.min} words, KEEP GOING.

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

/** Keys the AI might use to hold a segment's spoken line. */
const TEXT_KEYS = ['text', 'line', 'dialogue', 'content', 'message', 'utterance'] as const;

/**
 * Pull the spoken text out of a raw segment object, trying each known key in
 * priority order and coercing whatever we find to a trimmed string.
 */
function extractSegmentText(obj: Record<string, unknown>): string {
  for (const key of TEXT_KEYS) {
    const val = obj[key];
    if (val === undefined || val === null) continue;
    const str = typeof val === 'string' ? val : String(val);
    if (str.trim()) return str.trim();
  }
  return '';
}

/**
 * Scan a (possibly truncated) string and return every COMPLETE top-level
 * `{...}` object as its own substring, using string-and-escape-aware brace
 * matching. An incomplete trailing object (opened but never closed — the
 * signature of a truncated AI response) is simply dropped, so we salvage
 * everything up to the cut. This never treats braces that appear inside a JSON
 * string value as structural.
 */
function extractTopLevelObjects(str: string): string[] {
  const objects: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      if (depth > 0) {
        depth--;
        if (depth === 0 && start !== -1) {
          objects.push(str.slice(start, i + 1));
          start = -1;
        }
      }
    }
  }

  return objects;
}

/**
 * Parse the AI response into script segments, assigning voices.
 *
 * Robust against the two ways a long/detailed script commonly breaks:
 *   1. The dialogue lives under a different key than "text".
 *   2. The JSON array is TRUNCATED (output token cap hit) so the whole-array
 *      parse fails — we then salvage every complete object and drop only the
 *      incomplete tail.
 */
export function parseScriptResponse(
  text: string,
  voiceMap: Record<string, OpenAIVoice>,
): PodcastScriptSegment[] {
  // Fast path: strip code fences + slice to the outer array, then parse whole.
  let jsonStr = text.trim();
  jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '');

  const arrayStart = jsonStr.indexOf('[');
  const arrayEnd = jsonStr.lastIndexOf(']');
  if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
    jsonStr = jsonStr.slice(arrayStart, arrayEnd + 1);
  }

  let rawObjects: Array<Record<string, unknown>> = [];

  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) {
      rawObjects = parsed.filter(
        (o): o is Record<string, unknown> => o !== null && typeof o === 'object',
      );
    }
  } catch {
    // Truncation salvage: extract each COMPLETE top-level {...} object with
    // string/escape-aware brace matching and parse them one at a time, keeping
    // every valid one. This drops only the incomplete trailing object.
    for (const objStr of extractTopLevelObjects(jsonStr)) {
      try {
        const obj = JSON.parse(objStr);
        if (obj !== null && typeof obj === 'object') {
          rawObjects.push(obj as Record<string, unknown>);
        }
      } catch {
        // Skip an unparseable individual object; keep going.
      }
    }
  }

  // Build usable segments: require both a speaker and some spoken text.
  const segments: PodcastScriptSegment[] = [];
  for (const obj of rawObjects) {
    const speakerRaw = obj.speaker ?? obj.name ?? obj.role;
    const speaker = typeof speakerRaw === 'string' ? speakerRaw.trim() : '';
    const segmentText = extractSegmentText(obj);
    if (!speaker || !segmentText) continue;
    segments.push({
      speaker,
      voice: voiceMap[speaker] || 'alloy',
      text: segmentText,
    });
  }

  if (segments.length === 0) {
    throw new Error(
      'The AI returned an unreadable script — try a shorter length, or regenerate.',
    );
  }

  return segments;
}
