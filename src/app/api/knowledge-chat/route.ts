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

async function generateWithOllama(systemPrompt: string, fullPrompt: string): Promise<string> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3.2',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: fullPrompt },
      ],
      stream: false,
      options: { temperature: 0.7, num_predict: 2000, num_ctx: 8192 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama failed: ${await response.text()}`);
  }

  const data = await response.json();
  return data.message?.content || '';
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

    // Route to the correct AI provider based on user preference
    let text: string;
    let provider: string;

    const tryGemini = async () => {
      const result = await ai.generate({
        model: 'googleai/gemini-2.0-flash',
        prompt: `${systemPrompt}\n\n${userPrompt}`,
      });
      provider = 'Gemini 2.0 Flash';
      console.log('[KnowledgeChat] Response via Gemini');
      return result.text;
    };

    const tryOllama = async () => {
      const { text: truncatedContext, truncated } = truncateForOllama(context);
      const ollamaPrompt = `OUTLINE CONTENT:\n${truncatedContext}\n\nConversation:\n${conversationHistory}\n\nProvide a helpful, clear response grounded in the outline content above.`;
      if (truncated) {
        console.log(`[KnowledgeChat] Context truncated from ${context.length} to ${truncatedContext.length} chars for Ollama`);
      }
      let result = await generateWithOllama(systemPrompt, ollamaPrompt);
      provider = 'Ollama llama3.2';
      if (truncated) {
        result += '\n\n*Note: Using local AI with truncated context. Some outlines may not be included. For full coverage, ensure your cloud AI key is configured.*';
      }
      console.log('[KnowledgeChat] Response via Ollama');
      return result;
    };

    try {
      if (aiProvider === 'cloud') {
        text = await tryGemini();
      } else if (aiProvider === 'local') {
        text = await tryOllama();
      } else {
        // 'auto': try Gemini first, fall back to Ollama
        try {
          text = await tryGemini();
        } catch (geminiError) {
          console.warn('[KnowledgeChat] Gemini failed, trying Ollama:', (geminiError as Error).message);
          text = await tryOllama();
        }
      }
    } catch (error) {
      console.error('[KnowledgeChat] AI generation failed:', (error as Error).message);
      const hint = aiProvider === 'cloud'
        ? 'Check your Gemini API key.'
        : aiProvider === 'local'
        ? 'Ensure Ollama is running (ollama serve).'
        : 'Both cloud and local AI are unavailable. Check your Gemini API key or ensure Ollama is running.';
      return NextResponse.json(
        { error: hint },
        { status: 500 }
      );
    }

    return NextResponse.json({ response: text, provider });
  } catch (error) {
    console.error('Knowledge chat error:', error);
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    );
  }
}
