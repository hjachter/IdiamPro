/**
 * Ollama Local LLM Service
 *
 * Provides integration with Ollama for local AI inference.
 * Ollama runs on localhost:11434 by default and provides an API
 * compatible with OpenAI's format.
 */

const OLLAMA_BASE_URL = 'http://localhost:11434';

// Recommended models for different tasks
export const OLLAMA_MODELS = {
  // Good balance of quality and speed
  default: 'llama3.2',
  // Faster, lighter models
  fast: 'phi3',
  // Higher quality (requires more RAM)
  quality: 'llama3.1',
  // Code-focused
  code: 'codellama',
} as const;

export interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
}

export interface OllamaGenerateOptions {
  model?: string;
  prompt: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface OllamaResponse {
  model: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

/**
 * Check if Ollama is running and available
 */
export async function isOllamaAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000); // 2 second timeout

    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Get list of installed Ollama models
 */
export async function getOllamaModels(): Promise<OllamaModel[]> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (!response.ok) {
      throw new Error('Failed to fetch Ollama models');
    }
    const data = await response.json();
    return data.models || [];
  } catch (error) {
    console.warn('[Ollama] Failed to get models:', error);
    return [];
  }
}

/**
 * Check if a specific model is installed
 */
export async function hasModel(modelName: string): Promise<boolean> {
  const models = await getOllamaModels();
  return models.some(m => m.name.startsWith(modelName));
}

/**
 * Get the best available model from installed models
 */
export async function getBestAvailableModel(): Promise<string | null> {
  const models = await getOllamaModels();
  if (models.length === 0) return null;

  // Priority order for model selection
  const priority = ['llama3.2', 'llama3.1', 'llama3', 'mistral', 'phi3', 'phi'];

  for (const preferred of priority) {
    const found = models.find(m => m.name.startsWith(preferred));
    if (found) return found.name;
  }

  // Return first available model if none in priority list
  return models[0]?.name || null;
}

/**
 * Generate text using Ollama (non-streaming)
 */
export async function generateWithOllama(options: OllamaGenerateOptions): Promise<string> {
  const model = options.model || await getBestAvailableModel();

  if (!model) {
    throw new Error('No Ollama models installed. Please install a model with: ollama pull llama3.2');
  }

  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt: options.prompt,
      system: options.system,
      stream: false,
      options: {
        temperature: options.temperature ?? 0.7,
        num_predict: options.maxTokens ?? 2000,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ollama generation failed: ${error}`);
  }

  const data: OllamaResponse = await response.json();
  return data.response;
}

/**
 * Generate text using Ollama with streaming
 */
export async function* generateWithOllamaStream(
  options: OllamaGenerateOptions
): AsyncGenerator<string, void, unknown> {
  const model = options.model || await getBestAvailableModel();

  if (!model) {
    throw new Error('No Ollama models installed. Please install a model with: ollama pull llama3.2');
  }

  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt: options.prompt,
      system: options.system,
      stream: true,
      options: {
        temperature: options.temperature ?? 0.7,
        num_predict: options.maxTokens ?? 2000,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ollama generation failed: ${error}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        const data: OllamaResponse = JSON.parse(line);
        if (data.response) {
          yield data.response;
        }
      } catch {
        // Skip invalid JSON lines
      }
    }
  }
}

/**
 * Chat completion using Ollama (OpenAI-compatible format)
 */
export async function chatWithOllama(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options?: { model?: string; temperature?: number; maxTokens?: number }
): Promise<string> {
  const model = options?.model || await getBestAvailableModel();

  if (!model) {
    throw new Error('No Ollama models installed. Please install a model with: ollama pull llama3.2');
  }

  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      options: {
        temperature: options?.temperature ?? 0.7,
        num_predict: options?.maxTokens ?? 2000,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ollama chat failed: ${error}`);
  }

  const data = await response.json();
  return data.message?.content || '';
}

/**
 * Pull/download a model (returns progress updates)
 */
export async function* pullModel(modelName: string): AsyncGenerator<{ status: string; completed?: number; total?: number }, void, unknown> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/pull`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: modelName, stream: true }),
  });

  if (!response.ok) {
    throw new Error(`Failed to pull model: ${await response.text()}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        yield {
          status: data.status,
          completed: data.completed,
          total: data.total,
        };
      } catch {
        // Skip invalid JSON
      }
    }
  }
}
