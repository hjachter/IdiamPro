'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDefaultGeminiModel } from '@/config/gemini-models';
import { requireApiKey } from '@/lib/byok-keys';
import { safeJsonParse } from '@/lib/safe-json';

export interface SuggestTagsInput {
  title: string;
  content?: string;
  /** Optional user-supplied Gemini key (BYOK). Falls back to GEMINI_API_KEY env var. */
  userApiKey?: string | null;
}

export interface SuggestTagsOutput {
  tags: string[];
}

export async function suggestTags(input: SuggestTagsInput): Promise<SuggestTagsOutput> {
  const apiKey = requireApiKey('gemini', input.userApiKey);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: getDefaultGeminiModel('sdk'),
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 128,
      responseMimeType: 'application/json',
    },
  });

  const stripHtml = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const cleanContent = stripHtml(input.content || '').slice(0, 2000);

  const prompt = `You categorize knowledge entries with short topical tags for a personal knowledge management app.

Suggest 1 to 3 short, lowercase, hyphenated tags that describe the topic, theme, or domain of this entry. Avoid generic tags like "note", "idea", "thought". Prefer specific concepts (e.g., "productivity", "ai-ethics", "investing", "swift-ui", "sleep-science").

Return JSON in this exact shape: {"tags": ["tag1", "tag2"]}

Title: ${input.title}
Content: ${cleanContent || '(no body content)'}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  try {
    const parsed = safeJsonParse(text);
    const tags = Array.isArray(parsed.tags) ? parsed.tags : [];
    const cleaned = tags
      .filter((t: unknown): t is string => typeof t === 'string')
      .map((t: string) => t.toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, ''))
      .filter((t: string) => t.length > 0 && t.length <= 30)
      .slice(0, 3);
    return { tags: cleaned };
  } catch {
    return { tags: [] };
  }
}
