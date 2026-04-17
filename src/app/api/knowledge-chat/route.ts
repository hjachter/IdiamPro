import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import { getBestAvailableModel } from '@/lib/ollama-service';
import type { AIDepth } from '@/types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const OLLAMA_BASE_URL = 'http://localhost:11434';
// Local models like Gemma 4 and llama3.2 have 128K context windows but quality degrades past ~8K.
// Truncate context to keep total prompt under ~6K tokens (~24K chars).
const OLLAMA_MAX_CONTEXT_CHARS = 24000;

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
};

// Simple stopwords to exclude from keyword extraction
const STOPWORDS = new Set(['the','a','an','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','shall','can','to','of','in','for','on','with','at','by','from','as','or','and','but','not','no','this','that','it','its','my','your','all','any','which','what','who','how','when','where','why','about','into','through','during','before','after','above','below','between','out','up','down','if','then','than','so','just','also','very','much','more','most','other','some','such','only']);

function extractKeywords(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOPWORDS.has(w));
}

function truncateForOllama(context: string, userQuery: string): { text: string; truncated: boolean } {
  if (context.length <= OLLAMA_MAX_CONTEXT_CHARS) {
    return { text: context, truncated: false };
  }

  // Split context into outline chunks at the "---" separator boundaries.
  // Each chunk typically starts with "# OutlineName" and contains that outline's content.
  const chunks = context.split('\n---\n').filter(c => c.trim());

  // Score each chunk by how many query keywords it contains
  const keywords = extractKeywords(userQuery);
  const scored = chunks.map(chunk => {
    const lower = chunk.toLowerCase();
    const score = keywords.reduce((s, kw) => s + (lower.includes(kw) ? 1 : 0), 0);
    return { chunk, score };
  });

  // Sort by relevance (highest first), then pack up to the character limit
  scored.sort((a, b) => b.score - a.score);

  const packed: string[] = [];
  let totalLen = 0;
  for (const { chunk } of scored) {
    if (totalLen + chunk.length + 5 > OLLAMA_MAX_CONTEXT_CHARS) continue;
    packed.push(chunk);
    totalLen += chunk.length + 5; // +5 for the separator
  }

  const result = packed.join('\n---\n');
  const wasReduced = packed.length < chunks.length;
  return {
    text: wasReduced
      ? result + '\n\n[... remaining outlines truncated for local AI ...]'
      : result,
    truncated: wasReduced,
  };
}

function sseEvent(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'An unknown error occurred';
}

const encoder = new TextEncoder();

/** Send all Ollama tokens through the given controller. */
async function pipeOllama(
  controller: ReadableStreamDefaultController,
  systemPrompt: string,
  fullPrompt: string,
  truncated: boolean,
) {
  // Auto-select best available model (prefers Gemma 4 variants based on system memory)
  const selectedModel = await getBestAvailableModel() || 'gemma4:e4b';

  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: selectedModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: fullPrompt },
      ],
      stream: true,
      think: false, // Disable Gemma 4 reasoning mode — internal thoughts otherwise eat the num_predict budget and leave message.content empty
      options: { temperature: 0.7, num_predict: 2000, num_ctx: 8192 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama failed: ${await response.text()}`);
  }

  if (!response.body) {
    throw new Error('Ollama returned no response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        const token = parsed.message?.content;
        if (token) {
          controller.enqueue(encoder.encode(sseEvent({ token })));
        }
      } catch {
        // Skip malformed lines
      }
    }
  }

  if (buffer.trim()) {
    try {
      const parsed = JSON.parse(buffer);
      const token = parsed.message?.content;
      if (token) {
        controller.enqueue(encoder.encode(sseEvent({ token })));
      }
    } catch {
      // Skip malformed remainder
    }
  }

  if (truncated) {
    controller.enqueue(encoder.encode(
      sseEvent({ token: '\n\n*Note: Using local AI with truncated context. Some outlines may not be included. For full coverage, ensure your cloud AI key is configured.*' })
    ));
  }

  controller.enqueue(encoder.encode(
    sseEvent({ done: true, provider: `Ollama ${selectedModel}` })
  ));
  console.log(`[KnowledgeChat] Streaming response via Ollama (${selectedModel})`);
}

/** Send all Gemini tokens through the given controller. */
async function pipeGemini(
  controller: ReadableStreamDefaultController,
  systemPrompt: string,
  userPrompt: string,
) {
  const result = await ai.generateStream({
    model: 'googleai/gemini-2.0-flash',
    prompt: `${systemPrompt}\n\n${userPrompt}`,
  });

  // Attach a no-op catch so the response promise never becomes an unhandled
  // rejection if the stream itself errors before we reach `await response`.
  result.response.catch(() => {});

  for await (const chunk of result.stream) {
    const token = chunk.text;
    if (token) {
      controller.enqueue(encoder.encode(sseEvent({ token })));
    }
  }

  await result.response;

  controller.enqueue(encoder.encode(
    sseEvent({ done: true, provider: 'Gemini 2.0 Flash' })
  ));
  console.log('[KnowledgeChat] Streaming response via Gemini');
}

function makeStream(
  provider: 'cloud' | 'local' | 'auto',
  systemPrompt: string,
  userPrompt: string,
  ollamaPrompt: string,
  truncated: boolean,
): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      let closed = false;
      const close = () => { if (!closed) { closed = true; controller.close(); } };
      try {
        if (provider === 'cloud') {
          await pipeGemini(controller, systemPrompt, userPrompt);
        } else if (provider === 'local') {
          await pipeOllama(controller, systemPrompt, ollamaPrompt, truncated);
        } else {
          // 'auto': try Gemini, fall back to Ollama
          try {
            await pipeGemini(controller, systemPrompt, userPrompt);
          } catch (geminiErr) {
            console.warn('[KnowledgeChat] Gemini failed, trying Ollama:', errorMessage(geminiErr));
            await pipeOllama(controller, systemPrompt, ollamaPrompt, truncated);
          }
        }
      } catch (err) {
        try {
          controller.enqueue(encoder.encode(
            sseEvent({ error: errorMessage(err) })
          ));
        } catch {
          // Controller may already be errored
        }
      } finally {
        close();
      }
    },
  });
}

// Depth-specific instructions for knowledge chat
const DEPTH_INSTRUCTIONS: Record<AIDepth, string> = {
  quick: 'Be brief and direct. Give a short, focused answer with only the most essential points.',
  standard: 'Be concise but thorough. Cover the main points with appropriate detail.',
  deep: `Provide a comprehensive, detailed analysis. Think deeply about the question:
- Explore multiple angles and perspectives from the content
- Make connections between different sections
- Include relevant context and supporting details
- Consider implications and nuances
- Cite specific sections when referencing information`,
};

export async function POST(request: NextRequest) {
  try {
    const { messages, context, mode, depth = 'standard', aiProvider = 'auto' } = await request.json() as {
      messages: Message[];
      context: string;
      mode: 'current' | 'all';
      depth?: AIDepth;
      aiProvider?: 'cloud' | 'local' | 'auto';
    };

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: 'No messages provided' },
        { status: 400 }
      );
    }

    if (!context) {
      return NextResponse.json(
        { error: 'No outline context provided' },
        { status: 400 }
      );
    }

    const depthInstruction = DEPTH_INSTRUCTIONS[depth];

    const systemPrompt = mode === 'all'
      ? `You are querying the user's personal knowledge base — their "second brain" of structured outlines.
Answer based ONLY on the provided outline content. If the information isn't in the outlines, say so clearly.
Reference specific outline names and section numbers when possible.
Make connections across different outlines when relevant — this is the key advantage of querying all outlines at once.

${depthInstruction}

Use markdown formatting for clarity.`
      : `You are querying a single outline from the user's knowledge base.
Answer based ONLY on the provided outline content. If the information isn't there, say so clearly.
Reference specific section numbers when possible.

${depthInstruction}

Use markdown formatting for clarity.`;

    // Build conversation history
    const conversationHistory = messages.map(m =>
      `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
    ).join('\n\n');

    const userPrompt = `OUTLINE CONTENT:\n${context}\n\nConversation:\n${conversationHistory}\n\nProvide a helpful, clear response grounded in the outline content above.`;

    // Prepare Ollama prompt (may or may not be used depending on provider)
    // Pass the latest user message as the query for relevance-based truncation
    const latestUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';
    const { text: truncatedContext, truncated } = truncateForOllama(context, latestUserMessage);
    const ollamaPrompt = `OUTLINE CONTENT:\n${truncatedContext}\n\nConversation:\n${conversationHistory}\n\nProvide a helpful, clear response grounded in the outline content above.`;
    if (truncated && (aiProvider === 'local' || aiProvider === 'auto')) {
      console.log(`[KnowledgeChat] Context truncated from ${context.length} to ${truncatedContext.length} chars for Ollama`);
    }

    const stream = makeStream(aiProvider, systemPrompt, userPrompt, ollamaPrompt, truncated);
    return new Response(stream, { headers: SSE_HEADERS });
  } catch (error) {
    console.error('Knowledge chat error:', error);
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    );
  }
}
