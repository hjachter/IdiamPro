/**
 * JSON.parse with a try/catch built in. Returns `fallback` (default null) when
 * the input can't be parsed instead of throwing. Use this everywhere we read
 * untrusted JSON (localStorage values, API responses, file imports).
 */
export function safeJsonParse<T = unknown>(text: string | null | undefined, fallback: T | null = null): T | null {
  if (text === null || text === undefined || text === '') return fallback;
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    console.warn('safeJsonParse: failed to parse JSON', err);
    return fallback;
  }
}
