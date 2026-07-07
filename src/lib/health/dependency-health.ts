/**
 * Centralized dependency HEALTH MONITOR — server-side only.
 *
 * `checkAllDependencies()` runs a battery of TRIVIALLY CHEAP reachability /
 * auth probes against the app's OWN third-party dependencies (our keys, never
 * a user's BYOK key) and returns a normalized status board. It powers two
 * surfaces:
 *
 *   1. The admin console at /admin/health (live board + "Run check now").
 *   2. The hourly cron at /api/cron/dependency-health, which privately emails
 *      Howard when a dependency goes 'down' or 'degraded'.
 *
 * DESIGN RULES (do not violate):
 *   - PRIVATE-FIRST: this is admin/back-office only. It NEVER broadcasts
 *     status to end users and NEVER runs on a user's machine.
 *   - CHEAP CHECKS ONLY: every probe is a reachability / auth ping — a free
 *     "list" / "status" / "verify" style call or a lightweight authenticated
 *     GET. NEVER an AI generation or anything that spends tokens / money.
 *   - FULLY ENV-GATED + FAILURE-ISOLATED: if a dependency's key/config is
 *     unset the probe returns 'not_configured' (skip, never error). Each probe
 *     has its own short timeout and its own try/catch — one failing check can
 *     never break the sweep.
 *
 * Because the probes read server-only secrets (CLERK_SECRET_KEY,
 * STRIPE_SECRET_KEY, SMTP_PASS, GEMINI_API_KEY, ...) this module must only ever
 * run server-side. The admin page reaches it through an API route; it is never
 * imported into a client bundle.
 */

import nodemailer from 'nodemailer';

export type HealthStatus = 'ok' | 'degraded' | 'down' | 'not_configured';

export type HealthCategory =
  | 'Storage'
  | 'AI'
  | 'Auth'
  | 'Billing'
  | 'Email'
  | 'Monitoring';

export interface DependencyHealth {
  /** Human-readable dependency name, e.g. "Google Gemini". */
  name: string;
  /** Grouping bucket for the board. */
  category: HealthCategory;
  /** Normalized health state. */
  status: HealthStatus;
  /** Round-trip time of the probe in milliseconds (0 when skipped). */
  latencyMs: number;
  /** Short plain-language explanation of the result. */
  detail: string;
  /** ISO 8601 timestamp of when this probe ran. */
  checkedAt: string;
}

/** Default per-probe timeout — a few seconds, so the whole sweep stays snappy. */
const PROBE_TIMEOUT_MS = 5000;

function env(name: string): string {
  return (process.env[name] ?? '').trim();
}

/**
 * `fetch` with an AbortController deadline. Returns the Response, or throws
 * on network error / timeout. The caller decides how to map that to a status.
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = PROBE_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Map an HTTP response to a health status for an AUTHENTICATED probe (where we
 * expect a 2xx and a 401/403 means our own key is bad → that IS a real
 * outage for us).
 */
function statusFromAuthedResponse(res: Response): { status: HealthStatus; detail: string } {
  if (res.ok) {
    return { status: 'ok', detail: `Reachable, key accepted (HTTP ${res.status}).` };
  }
  if (res.status === 401 || res.status === 403) {
    return { status: 'down', detail: `Auth rejected (HTTP ${res.status}) — check our API key.` };
  }
  if (res.status === 429) {
    return { status: 'degraded', detail: `Rate limited (HTTP 429) — reachable but throttled.` };
  }
  if (res.status >= 500) {
    return { status: 'degraded', detail: `Provider error (HTTP ${res.status}) — service having issues.` };
  }
  return { status: 'degraded', detail: `Unexpected response (HTTP ${res.status}).` };
}

/**
 * Run one probe with uniform timing, try/catch isolation, and a "not
 * configured" short-circuit. `probe` should throw on hard failure; a thrown
 * error becomes 'down'.
 */
async function runProbe(
  name: string,
  category: HealthCategory,
  configured: boolean,
  notConfiguredDetail: string,
  probe: () => Promise<{ status: HealthStatus; detail: string }>,
): Promise<DependencyHealth> {
  const checkedAt = new Date().toISOString();
  if (!configured) {
    return { name, category, status: 'not_configured', latencyMs: 0, detail: notConfiguredDetail, checkedAt };
  }
  const started = Date.now();
  try {
    const { status, detail } = await probe();
    return { name, category, status, latencyMs: Date.now() - started, detail, checkedAt };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const timedOut = /abort/i.test(message);
    return {
      name,
      category,
      status: 'down',
      latencyMs: Date.now() - started,
      detail: timedOut ? `No response within ${PROBE_TIMEOUT_MS / 1000}s (timeout).` : `Unreachable: ${message}`,
      checkedAt,
    };
  }
}

// ---------------------------------------------------------------------------
// Individual probes
// ---------------------------------------------------------------------------

/** Storage / Vercel KV — a real write→read→delete round-trip via the adapter. */
async function checkStorage(): Promise<DependencyHealth> {
  const checkedAt = new Date().toISOString();
  const started = Date.now();
  try {
    // Imported lazily so a storage-module issue can't break the whole sweep at
    // load time, and so this file stays cheap to import elsewhere.
    const { getStorage } = await import('@/lib/storage/adapter');
    const storage = getStorage();
    const backend = storage.backend;
    if (backend === 'stub') {
      return {
        name: 'Storage / Vercel KV',
        category: 'Storage',
        status: 'down',
        latencyMs: Date.now() - started,
        detail: 'No writable store (KV not provisioned and filesystem read-only).',
        checkedAt,
      };
    }
    const probeKey = 'dependency-health:probe';
    const token = `ping-${Date.now()}`;
    await storage.set(probeKey, token);
    const got = await storage.get<string>(probeKey);
    await storage.delete(probeKey);
    const healthy = got === token;
    return {
      name: 'Storage / Vercel KV',
      category: 'Storage',
      status: healthy ? 'ok' : 'down',
      latencyMs: Date.now() - started,
      detail: healthy
        ? `Write→read→delete round-trip OK (backend: ${backend}).`
        : `Round-trip mismatch (backend: ${backend}).`,
      checkedAt,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      name: 'Storage / Vercel KV',
      category: 'Storage',
      status: 'down',
      latencyMs: Date.now() - started,
      detail: `Round-trip failed: ${message}`,
      checkedAt,
    };
  }
}

/** Google Gemini — free models-list call (no generation, no tokens spent). */
function checkGemini(): Promise<DependencyHealth> {
  const key = env('GEMINI_API_KEY');
  return runProbe(
    'Google Gemini',
    'AI',
    key.length > 0,
    'GEMINI_API_KEY not set.',
    async () => {
      const res = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
        { method: 'GET' },
      );
      return statusFromAuthedResponse(res);
    },
  );
}

/** Clerk — cheap authenticated user-count call. */
function checkClerk(): Promise<DependencyHealth> {
  const key = env('CLERK_SECRET_KEY');
  return runProbe(
    'Clerk',
    'Auth',
    key.length > 0,
    'CLERK_SECRET_KEY not set.',
    async () => {
      const res = await fetchWithTimeout('https://api.clerk.com/v1/users/count', {
        method: 'GET',
        headers: { Authorization: `Bearer ${key}` },
      });
      return statusFromAuthedResponse(res);
    },
  );
}

/** Stripe — cheap authenticated balance retrieve (no charge, no side effects). */
function checkStripe(): Promise<DependencyHealth> {
  const key = env('STRIPE_SECRET_KEY');
  return runProbe(
    'Stripe',
    'Billing',
    key.length > 0,
    'STRIPE_SECRET_KEY not set.',
    async () => {
      const res = await fetchWithTimeout('https://api.stripe.com/v1/balance', {
        method: 'GET',
        headers: { Authorization: `Bearer ${key}` },
      });
      return statusFromAuthedResponse(res);
    },
  );
}

/** Email / SMTP — verify the transporter connection without sending anything. */
function checkEmail(): Promise<DependencyHealth> {
  const host = env('SMTP_HOST');
  const user = env('SMTP_USER');
  const pass = env('SMTP_PASS');
  const port = Number.parseInt(env('SMTP_PORT') || '465', 10) || 465;
  const configured = host.length > 0 && user.length > 0 && pass.length > 0;
  return runProbe(
    'Email / SMTP',
    'Email',
    configured,
    'SMTP_HOST / SMTP_USER / SMTP_PASS not set.',
    async () => {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        connectionTimeout: PROBE_TIMEOUT_MS,
        greetingTimeout: PROBE_TIMEOUT_MS,
      });
      // .verify() opens a connection + authenticates, then closes — it does
      // NOT send an email.
      await transporter.verify();
      transporter.close();
      return { status: 'ok', detail: `SMTP connection + auth verified (${host}:${port}).` };
    },
  );
}

/** OpenAI — free models-list call (auth reachability, no generation). */
function checkOpenAI(): Promise<DependencyHealth> {
  const key = env('OPENAI_API_KEY');
  return runProbe(
    'OpenAI',
    'AI',
    key.length > 0,
    'OPENAI_API_KEY not set.',
    async () => {
      const res = await fetchWithTimeout('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: { Authorization: `Bearer ${key}` },
      });
      return statusFromAuthedResponse(res);
    },
  );
}

/** OpenRouter — cheap authenticated key-info call (no generation). */
function checkOpenRouter(): Promise<DependencyHealth> {
  const key = env('OPENROUTER_API_KEY');
  return runProbe(
    'OpenRouter',
    'AI',
    key.length > 0,
    'OPENROUTER_API_KEY not set.',
    async () => {
      const res = await fetchWithTimeout('https://openrouter.ai/api/v1/auth/key', {
        method: 'GET',
        headers: { Authorization: `Bearer ${key}` },
      });
      return statusFromAuthedResponse(res);
    },
  );
}

/** AssemblyAI — cheap authenticated transcript-list call (no transcription). */
function checkAssemblyAI(): Promise<DependencyHealth> {
  const key = env('ASSEMBLYAI_API_KEY');
  return runProbe(
    'AssemblyAI',
    'AI',
    key.length > 0,
    'ASSEMBLYAI_API_KEY not set.',
    async () => {
      const res = await fetchWithTimeout('https://api.assemblyai.com/v2/transcript?limit=1', {
        method: 'GET',
        headers: { Authorization: key },
      });
      return statusFromAuthedResponse(res);
    },
  );
}

/**
 * RevenueCat — REACHABILITY ONLY. A cheap authenticated check needs a
 * subscriber id / project id we don't have handy here, so we only confirm the
 * host answers (DNS + TLS + HTTP). Any HTTP response counts as reachable.
 */
function checkRevenueCat(): Promise<DependencyHealth> {
  const key = env('REVENUECAT_API_KEY');
  return runProbe(
    'RevenueCat',
    'Billing',
    key.length > 0,
    'REVENUECAT_API_KEY not set.',
    async () => {
      const res = await fetchWithTimeout('https://api.revenuecat.com/v1/subscribers/health-probe', {
        method: 'GET',
        headers: { Authorization: `Bearer ${key}` },
      });
      // We don't assert on auth here (no real subscriber id). Any answer means
      // the service is up.
      return { status: 'ok', detail: `Host reachable (HTTP ${res.status}). Reachability only — not auth-verified.` };
    },
  );
}

/**
 * Sentry — REACHABILITY ONLY. There is no cheap authenticated status endpoint
 * without a management auth token, so we just confirm the ingest host from the
 * DSN answers. We never send an event.
 */
function checkSentry(): Promise<DependencyHealth> {
  const dsn = env('SENTRY_DSN') || env('NEXT_PUBLIC_SENTRY_DSN');
  let host = '';
  try {
    if (dsn) host = new URL(dsn).host;
  } catch {
    host = '';
  }
  return runProbe(
    'Sentry',
    'Monitoring',
    host.length > 0,
    'SENTRY_DSN not set.',
    async () => {
      const res = await fetchWithTimeout(`https://${host}/api/`, { method: 'GET' });
      return { status: 'ok', detail: `Ingest host reachable (HTTP ${res.status}). Reachability only.` };
    },
  );
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Run every dependency probe in parallel and return the board. Probes are
 * fully isolated: a thrown probe still resolves to a 'down' row, so the sweep
 * always returns one row per dependency.
 */
export async function checkAllDependencies(): Promise<DependencyHealth[]> {
  return Promise.all([
    checkStorage(),
    checkGemini(),
    checkClerk(),
    checkStripe(),
    checkEmail(),
    checkOpenAI(),
    checkOpenRouter(),
    checkAssemblyAI(),
    checkRevenueCat(),
    checkSentry(),
  ]);
}

/** True when the row represents a problem worth alerting Howard about. */
export function isBadStatus(status: HealthStatus): boolean {
  return status === 'down' || status === 'degraded';
}
