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
  // Good balance of quality and speed (Gemma 4 E4B - multimodal, ~3-4GB RAM)
  default: 'gemma4:e4b',
  // Faster, lighter models (Gemma 4 E2B - mobile-friendly, ~1.5GB RAM)
  fast: 'gemma4:e2b',
  // Higher quality (Gemma 4 26B MoE - 16GB+ RAM, fast despite size)
  quality: 'gemma4:26b',
  // Maximum quality (Gemma 4 31B Dense - 24GB+ RAM)
  premium: 'gemma4:31b',
  // Legacy fallback for low-memory systems
  legacy: 'llama3.2',
  // Code-focused
  code: 'codellama',
} as const;

// Memory requirements (approximate, in GB) for each Gemma 4 variant
export const MODEL_MEMORY_REQUIREMENTS: Record<string, number> = {
  'gemma4:e2b': 1.5,
  'gemma4:e4b': 4,
  'gemma4:26b': 16,
  'gemma4:31b': 24,
  'llama3.2': 3,
};

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
 * Estimate available system memory in GB.
 * Returns a conservative estimate. Falls back to 8GB if detection fails.
 */
function getAvailableMemoryGB(): number {
  try {
    // In Electron/Node, navigator.deviceMemory is available in some contexts
    if (typeof navigator !== 'undefined' && 'deviceMemory' in navigator) {
      return (navigator as any).deviceMemory || 8;
    }
    // In Node.js context (server-side actions), use os module
    if (typeof process !== 'undefined' && process.versions?.node) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const os = require('os');
      return Math.round(os.totalmem() / (1024 ** 3));
    }
  } catch {
    // Detection failed
  }
  return 8; // Conservative default
}

/**
 * Get the best available model from installed models.
 * Prefers Gemma 4 variants over llama3.2, with hardware-aware selection
 * based on available system memory.
 *
 * IMPORTANT — RAM headroom rule (fixed 2026-05-22 after the Howard / 16-GB-Mac
 * incident): each bracket requires the user's machine to have AT LEAST ~2× the
 * preferred model's RAM footprint. Picking a 16-GB model on a 16-GB machine
 * leaves zero room for the OS / browser / IdeaM itself, which on Apple
 * Silicon triggers macOS's memory-pressure killer to SIGKILL Ollama, sending
 * it into a respawn loop that bogs the whole system. Never advance a tier
 * unless the headroom is real.
 */
export async function getBestAvailableModel(): Promise<string | null> {
  const models = await getOllamaModels();
  if (models.length === 0) return null;

  const availableMemoryGB = getAvailableMemoryGB();

  // Build priority list based on available memory, with ~2× headroom over
  // the model's runtime footprint (see RAM headroom rule in the docblock).
  let priority: string[];

  if (availableMemoryGB >= 40) {
    // Workstation-class: 31B Dense (~24 GB) fits with substantial headroom
    priority = ['gemma4:31b', 'gemma4:26b', 'gemma4:e4b', 'gemma4:e2b', 'llama3.2', 'llama3.1', 'llama3', 'mistral', 'phi3', 'phi'];
  } else if (availableMemoryGB >= 24) {
    // Power user: 26B MoE (~16 GB) fits with ~8 GB headroom for the OS/apps
    priority = ['gemma4:26b', 'gemma4:e4b', 'gemma4:e2b', 'llama3.2', 'llama3.1', 'llama3', 'mistral', 'phi3', 'phi'];
  } else if (availableMemoryGB >= 8) {
    // Standard (covers the very common 16-GB tier): E4B (~4 GB) is the
    // largest variant that leaves real headroom on a 16-GB machine.
    priority = ['gemma4:e4b', 'gemma4:e2b', 'llama3.2', 'llama3.1', 'llama3', 'mistral', 'phi3', 'phi'];
  } else {
    // Low memory: prefer lightest models
    priority = ['gemma4:e2b', 'llama3.2', 'phi3', 'phi', 'gemma4:e4b'];
  }

  for (const preferred of priority) {
    const found = models.find(m => m.name.startsWith(preferred));
    if (found) {
      console.log(`[Ollama] Selected model: ${found.name} (system memory: ${availableMemoryGB}GB)`);
      return found.name;
    }
  }

  // Return first available model if none in priority list
  return models[0]?.name || null;
}

/**
 * Check if any Gemma 4 variant is installed
 */
export async function hasGemma4(): Promise<boolean> {
  const models = await getOllamaModels();
  return models.some(m => m.name.startsWith('gemma4'));
}

/**
 * Get the recommended Gemma 4 variant for this system.
 * Brackets follow the same 2× headroom rule as getBestAvailableModel — see
 * its docblock for why this matters on memory-tight Apple Silicon machines.
 */
export function getRecommendedGemma4Variant(): string {
  const memoryGB = getAvailableMemoryGB();
  if (memoryGB >= 40) return 'gemma4:31b';
  if (memoryGB >= 24) return 'gemma4:26b';
  if (memoryGB >= 8)  return 'gemma4:e4b';
  return 'gemma4:e2b';
}

/**
 * Friendly, user-facing message shown when the on-device model keeps returning
 * a blank result even after retries. Deliberately actionable (try again / switch
 * provider) and never a raw error dump. The wizards + dialogs surface this.
 */
export const ON_DEVICE_EMPTY_MESSAGE =
  "Couldn't generate that — please try again, or switch AI provider in Settings.";

/**
 * How many times we attempt an on-device generation before giving up. BOUNDED
 * on purpose (1 initial try + 2 retries). Raw gemma4:e4b intermittently returns
 * a completely EMPTY completion (~1 in 5 for some prompts); a blank draft must
 * never reach the user, so an empty/whitespace-only result is treated as a
 * FAILED generation and retried within this cap — never beyond it.
 */
const MAX_GENERATION_ATTEMPTS = 3;

/** Marks an attempt that produced no usable text, so we retry rather than fail. */
class EmptyGenerationError extends Error {
  constructor() {
    super('on-device model returned an empty completion');
    this.name = 'EmptyGenerationError';
  }
}

/**
 * Generate text using Ollama (non-streaming).
 *
 * SHARED empty-guard + bounded retry (2026-07-24): every wizard (email, social,
 * summarize, Your Voice, inbound extraction, translate, reformat, …) funnels
 * through here, so the blank-draft protection lives here ONCE. An empty or
 * whitespace-only completion is a failed generation, not content — we retry it
 * within MAX_GENERATION_ATTEMPTS (nudging temperature up on retries so a
 * deterministic temp-0 blank actually explores a different completion). If it is
 * STILL blank after the cap, we throw a clear, friendly message instead of
 * returning an empty string — so a blank result can never silently succeed.
 */
export async function generateWithOllama(options: OllamaGenerateOptions): Promise<string> {
  const model = options.model || await getBestAvailableModel();

  if (!model) {
    throw new Error('No Ollama models installed. Please install a model with: ollama pull gemma4:e4b (or ollama pull llama3.2 for low-memory systems)');
  }

  const baseTemp = options.temperature ?? 0.7;
  let sawEmpty = false;
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    // First attempt honors the caller's temperature (keeps temp-0 verifier
    // calls deterministic). Retries nudge it up so a repeated blank actually
    // samples a different completion rather than reproducing the same empty one.
    const temperature = attempt === 0 ? baseTemp : Math.max(baseTemp, 0.4);
    try {
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
          think: false, // Disable Gemma 4 reasoning mode — it consumes the token budget and leaves content empty
          options: {
            temperature,
            num_predict: options.maxTokens ?? 2000,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama generation failed: ${error}`);
      }

      const data: OllamaResponse = await response.json();
      const text = data.response ?? '';
      if (text.trim().length === 0) {
        // Empty/whitespace-only completion = a FAILED generation. Retry it.
        sawEmpty = true;
        throw new EmptyGenerationError();
      }
      return text;
    } catch (err) {
      lastError = err;
      // Brief backoff before retrying (bounded).
      if (attempt < MAX_GENERATION_ATTEMPTS - 1) {
        await new Promise((res) => setTimeout(res, 400 * (attempt + 1)));
      }
    }
  }

  // Exhausted the retry cap. A persistent blank becomes a friendly, actionable
  // message; any other transport error propagates as before so callers can
  // classify it (availability, billing fallback, etc.).
  if (sawEmpty && lastError instanceof EmptyGenerationError) {
    throw new Error(ON_DEVICE_EMPTY_MESSAGE);
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`Ollama generation failed: ${String(lastError)}`);
}

/**
 * Generate text using Ollama with streaming
 */
export async function* generateWithOllamaStream(
  options: OllamaGenerateOptions
): AsyncGenerator<string, void, unknown> {
  const model = options.model || await getBestAvailableModel();

  if (!model) {
    throw new Error('No Ollama models installed. Please install a model with: ollama pull gemma4:e4b (or ollama pull llama3.2 for low-memory systems)');
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
      think: false, // See note in generateWithOllama
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
    throw new Error('No Ollama models installed. Please install a model with: ollama pull gemma4:e4b (or ollama pull llama3.2 for low-memory systems)');
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
      think: false, // See note in generateWithOllama
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
