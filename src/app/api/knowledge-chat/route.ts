import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';

interface Message {
  role: 'user' | 'assistant';
  content: string;
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

    // Generate response using Gemini
    const { text } = await ai.generate({
      model: 'googleai/gemini-2.0-flash-exp',
      prompt: `${systemPrompt}

OUTLINE CONTENT:
${context}

Conversation:
${conversationHistory}

Provide a helpful, clear response grounded in the outline content above.`,
    });

    return NextResponse.json({ response: text });
  } catch (error) {
    console.error('Knowledge chat error:', error);
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    );
  }
}
