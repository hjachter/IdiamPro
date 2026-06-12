/**
 * Storage adapter — thin key/value layer that picks its backend at runtime.
 *
 * Why this exists:
 *   IdiamPro's server-side JSON stores (applicants, feedback, beta-pro grants,
 *   unsubscribe tokens) were originally written to `.idiampro/*.json` under
 *   `process.cwd()`. That works in Electron (writable repo root) but FAILS on
 *   Vercel serverless — `process.cwd()` resolves to `/var/task` which is
 *   read-only at runtime. The applicant signup endpoint started returning
 *   `ENOENT: no such file or directory, mkdir '/var/task/.idiampro'` on
 *   2026-06-11 and blocked production signups.
 *
 *   This adapter introduces a single seam that every store calls through. At
 *   runtime it inspects env vars and picks one of three backends:
 *
 *     1. Vercel KV / Upstash Redis (production) — when both
 *        `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set. We use the
 *        `@vercel/kv` SDK, which speaks Redis over HTTP.
 *     2. File-based JSON (Electron / dev / test) — when KV env vars are
 *        absent AND `process.cwd()` is writable. Each key becomes a separate
 *        `.idiampro/<sanitized-key>.json` file with atomic-rename writes.
 *     3. No-op stub (degraded production) — when neither KV is provisioned
 *        nor the filesystem is writable. Writes are dropped with a warning;
 *        reads return null. Prevents 500s while making the misconfiguration
 *        visible in logs.
 *
 * Callers don't pick the backend — they call `storage.get`, `storage.set`,
 * `storage.delete`, `storage.list`. The seam is intentionally narrow so
 * future moves (Postgres, Cloudflare KV, etc.) require only a new branch in
 * this one file.
 *
 * Key naming convention (used by the stores that call this adapter):
 *   - `applicant:<id>`              one record
 *   - `applicants:all`              set/index of applicant ids
 *   - `feedback:<id>`               one record
 *   - `feedback:all`                set/index of feedback ids
 *   - `pro-grant:<userId>`          one grant record
 *   - `unsubscribe:<userId>`        one unsubscribe record
 *   - `unsubscribes:all`            set/index of unsubscribed user ids
 *
 * The `list(prefix)` operation enumerates members of the index set whose key
 * is `<prefix>:all`. We use Redis SET semantics (SADD/SMEMBERS/SREM) via
 * the `@vercel/kv` SDK; the file backend models the same operations on
 * disk.
 */

import { promises as fs } from 'fs';
import { dirname, join } from 'path';

// ---------------------------------------------------------------------------
// Public adapter shape
// ---------------------------------------------------------------------------

export interface StorageAdapter {
  /** Read a JSON value at `key`, or null if absent. */
  get<T>(key: string): Promise<T | null>;
  /** Write a JSON value at `key`. Overwrites. */
  set<T>(key: string, value: T): Promise<void>;
  /** Delete the key. No-op if absent. */
  delete(key: string): Promise<void>;
  /**
   * Append `member` to the set indexed by `setKey`. Idempotent.
   * Use this together with `setMembers` to enumerate records by prefix.
   */
  setAdd(setKey: string, member: string): Promise<void>;
  /** Remove `member` from the set indexed by `setKey`. Idempotent. */
  setRemove(setKey: string, member: string): Promise<void>;
  /** Return all members of the set indexed by `setKey`. */
  setMembers(setKey: string): Promise<string[]>;
  /** Human-readable backend label for diagnostics. */
  readonly backend: 'kv' | 'file' | 'stub';
}

// ---------------------------------------------------------------------------
// Backend selection
// ---------------------------------------------------------------------------

let cached: StorageAdapter | null = null;

/** Return the singleton adapter, lazily resolved on first use. */
export function getStorage(): StorageAdapter {
  if (cached) return cached;
  cached = resolveBackend();
  // eslint-disable-next-line no-console
  console.info(`[storage] using backend: ${cached.backend}`);
  return cached;
}

/** Test-only: reset the cached singleton so the next call re-resolves. */
export function _resetStorageForTest(): void {
  cached = null;
}

function resolveBackend(): StorageAdapter {
  const kvUrl = (process.env.KV_REST_API_URL ?? '').trim();
  const kvToken = (process.env.KV_REST_API_TOKEN ?? '').trim();
  if (kvUrl.length > 0 && kvToken.length > 0) {
    try {
      return createKvAdapter();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[storage] KV env vars present but client init failed:', err);
      // Fall through to file/stub.
    }
  }
  if (isFilesystemWritable()) {
    return createFileAdapter();
  }
  return createStubAdapter();
}

/**
 * Heuristic: in Vercel serverless the cwd (`/var/task`) is read-only. We
 * check by attempting to `mkdir` the data dir; if it succeeds (or already
 * exists), the FS is usable.
 */
function isFilesystemWritable(): boolean {
  try {
    const probe = join(process.cwd(), '.idiampro');
    // Synchronous existsSync-ish probe via mkdir + ignore-EEXIST. Done sync to
    // keep resolveBackend simple; this runs once per process.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fsSync = require('fs') as typeof import('fs');
    try {
      fsSync.mkdirSync(probe, { recursive: true });
      return true;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      // EEXIST means directory already there — writable enough for our needs.
      if (code === 'EEXIST') return true;
      return false;
    }
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Vercel KV backend
// ---------------------------------------------------------------------------

function createKvAdapter(): StorageAdapter {
  // Lazy import: only pulled into the bundle when KV env vars are set.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const kvMod = require('@vercel/kv') as typeof import('@vercel/kv');
  const { kv } = kvMod;

  return {
    backend: 'kv',
    async get<T>(key: string): Promise<T | null> {
      const value = await kv.get<T>(key);
      return (value ?? null) as T | null;
    },
    async set<T>(key: string, value: T): Promise<void> {
      await kv.set(key, value);
    },
    async delete(key: string): Promise<void> {
      await kv.del(key);
    },
    async setAdd(setKey: string, member: string): Promise<void> {
      await kv.sadd(setKey, member);
    },
    async setRemove(setKey: string, member: string): Promise<void> {
      await kv.srem(setKey, member);
    },
    async setMembers(setKey: string): Promise<string[]> {
      const members = await kv.smembers(setKey);
      // smembers returns string[] for string sets.
      return (members ?? []).map((m) => String(m));
    },
  };
}

// ---------------------------------------------------------------------------
// File backend (Electron / dev / test)
// ---------------------------------------------------------------------------

function sanitizeKey(key: string): string {
  // Map "applicant:abc-123" -> "applicant__abc-123" so it's a valid filename
  // on every platform. We never read these names back; the key is the
  // source of truth.
  return key.replace(/[^a-zA-Z0-9._-]/g, '__');
}

function resolveDataDir(): string {
  const override = (process.env.IDIAMPRO_DATA_DIR ?? '').trim();
  if (override.length > 0) return override;
  return join(process.cwd(), '.idiampro');
}

function pathForKey(key: string): string {
  return join(resolveDataDir(), `${sanitizeKey(key)}.json`);
}

function pathForSet(setKey: string): string {
  return join(resolveDataDir(), `${sanitizeKey(setKey)}.set.json`);
}

async function readJsonSafe<T>(path: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(path, 'utf8');
    return JSON.parse(raw) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    // eslint-disable-next-line no-console
    console.warn(`[storage/file] could not read ${path}:`, err);
    return null;
  }
}

async function writeJsonAtomic(path: string, data: unknown): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, path);
}

function createFileAdapter(): StorageAdapter {
  return {
    backend: 'file',
    async get<T>(key: string): Promise<T | null> {
      return readJsonSafe<T>(pathForKey(key));
    },
    async set<T>(key: string, value: T): Promise<void> {
      await writeJsonAtomic(pathForKey(key), value);
    },
    async delete(key: string): Promise<void> {
      try {
        await fs.unlink(pathForKey(key));
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      }
    },
    async setAdd(setKey: string, member: string): Promise<void> {
      const path = pathForSet(setKey);
      const members = (await readJsonSafe<string[]>(path)) ?? [];
      if (!members.includes(member)) {
        members.push(member);
        await writeJsonAtomic(path, members);
      }
    },
    async setRemove(setKey: string, member: string): Promise<void> {
      const path = pathForSet(setKey);
      const members = (await readJsonSafe<string[]>(path)) ?? [];
      const next = members.filter((m) => m !== member);
      if (next.length !== members.length) {
        await writeJsonAtomic(path, next);
      }
    },
    async setMembers(setKey: string): Promise<string[]> {
      const path = pathForSet(setKey);
      return (await readJsonSafe<string[]>(path)) ?? [];
    },
  };
}

// ---------------------------------------------------------------------------
// Stub backend — degraded production safety net
// ---------------------------------------------------------------------------

function createStubAdapter(): StorageAdapter {
  let warned = false;
  const warn = (op: string) => {
    if (warned) return;
    warned = true;
    // eslint-disable-next-line no-console
    console.warn(
      `[storage/stub] No persistent storage available (KV not provisioned, filesystem not writable). ` +
        `Operation "${op}" will be a no-op. Provision Vercel KV (Storage tab) and redeploy to enable persistence.`,
    );
  };
  return {
    backend: 'stub',
    async get(): Promise<null> {
      warn('get');
      return null;
    },
    async set(): Promise<void> {
      warn('set');
    },
    async delete(): Promise<void> {
      warn('delete');
    },
    async setAdd(): Promise<void> {
      warn('setAdd');
    },
    async setRemove(): Promise<void> {
      warn('setRemove');
    },
    async setMembers(): Promise<string[]> {
      warn('setMembers');
      return [];
    },
  };
}
