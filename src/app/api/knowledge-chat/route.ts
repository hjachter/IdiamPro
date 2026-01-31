import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const OLLAMA_BASE_URL = 'http://localhost:11434';

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
      options: { temperature: 0.7, num_predict: 2000 },
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
    const { messages, context, mode } = await request.json() as {
      messages: Message[];
      context: string;
      mode: 'current' | 'all';
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

    // Try Gemini first, fall back to Ollama
    let text: string;
    try {
      const result = await ai.generate({
        model: 'googleai/gemini-2.0-flash-exp',
        prompt: `${systemPrompt}\n\n${userPrompt}`,
      });
      text = result.text;
      console.log('[KnowledgeChat] Response via Gemini');
    } catch (geminiError) {
      console.warn('[KnowledgeChat] Gemini failed, trying Ollama:', (geminiError as Error).message);
      try {
        text = await generateWithOllama(systemPrompt, userPrompt);
        console.log('[KnowledgeChat] Response via Ollama');
      } catch (ollamaError) {
        console.error('[KnowledgeChat] Ollama also failed:', (ollamaError as Error).message);
        return NextResponse.json(
          { error: 'Both cloud and local AI are unavailable. Check your Gemini API key or ensure Ollama is running.' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ response: text });
  } catch (error) {
    console.error('Knowledge chat error:', error);
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    );
  }
}
