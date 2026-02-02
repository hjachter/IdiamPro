import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const OLLAMA_BASE_URL = 'http://localhost:11434';
// llama3.2 context window is 128K tokens but quality degrades past ~8K.
// Truncate context to keep total prompt under ~6K tokens (~24K chars).
const OLLAMA_MAX_CONTEXT_CHARS = 24000;

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
};

function truncateForOllama(context: string): { text: string; truncated: boolean } {
  if (context.length <= OLLAMA_MAX_CONTEXT_CHARS) {
    return { text: context, truncated: false };
  }
  const truncated = context.slice(0, OLLAMA_MAX_CONTEXT_CHARS);
  // Cut at last complete section (---) to avoid mid-sentence breaks
  const lastSeparator = truncated.lastIndexOf('\n---\n');
  const cutPoint = lastSeparator > OLLAMA_MAX_CONTEXT_CHARS / 2 ? lastSeparator : OLLAMA_MAX_CONTEXT_CHARS;
  return { text: truncated.slice(0, cutPoint) + '\n\n[... remaining outlines truncated for local AI ...]', truncated: true };
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
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3.2',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: fullPrompt },
      ],
      stream: true,
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
    sseEvent({ done: true, provider: 'Ollama llama3.2' })
  ));
  console.log('[KnowledgeChat] Streaming response via Ollama');
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

export async function POST(request: NextRequest) {
  try {
    const { messages, context, mode, aiProvider = 'auto' } = await request.json() as {
      messages: Message[];
      context: string;
      mode: 'current' | 'all';
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

    const systemPrompt = mode === 'all'
      ? `You are querying the user's personal knowledge base — their "second brain" of structured outlines.
Answer based ONLY on the provided outline content. If the information isn't in the outlines, say so clearly.
Reference specific outline names and section numbers when possible.
Make connections across different outlines when relevant — this is the key advantage of querying all outlines at once.
Be concise but thorough. Use markdown formatting for clarity.`
      : `You are querying a single outline from the user's knowledge base.
Answer based ONLY on the provided outline content. If the information isn't there, say so clearly.
Reference specific section numbers when possible.
Be concise but thorough. Use markdown formatting for clarity.`;

    // Build conversation history
    const conversationHistory = messages.map(m =>
      `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
    ).join('\n\n');

    const userPrompt = `OUTLINE CONTENT:\n${context}\n\nConversation:\n${conversationHistory}\n\nProvide a helpful, clear response grounded in the outline content above.`;

    // Prepare Ollama prompt (may or may not be used depending on provider)
    const { text: truncatedContext, truncated } = truncateForOllama(context);
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
