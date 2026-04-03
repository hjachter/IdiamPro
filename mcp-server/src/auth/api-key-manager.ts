import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import { randomBytes, createHash } from "crypto";

// ============================================
// Types
// ============================================

export type PlanTier = "free" | "premium" | "pro" | "enterprise";

export interface ApiKey {
  id: string;
  keyHash: string;
  name: string;
  tier: PlanTier;
  createdAt: string;
  lastUsedAt: string | null;
  usageCount: number;
  isActive: boolean;
}

export interface UsageLimits {
  apiCallsPerMonth: number;
  aiGenerationsPerMonth: number;
  aiExpansionsPerMonth: number;
  ingestionsPerMonth: number;
}

export interface KeyStore {
  keys: ApiKey[];
  version: number;
}

// ============================================
// Constants
// ============================================

const KEY_PREFIX = "idm_";
const KEY_LENGTH = 32; // bytes → 64 hex chars
const CONFIG_DIR = join(homedir(), ".idiampro");
const KEYS_FILE = join(CONFIG_DIR, "api-keys.json");

const TIER_LIMITS: Record<PlanTier, UsageLimits> = {
  free: {
    apiCallsPerMonth: 1000,
    aiGenerationsPerMonth: 0,
    aiExpansionsPerMonth: 0,
    ingestionsPerMonth: 0,
  },
  premium: {
    apiCallsPerMonth: 10000,
    aiGenerationsPerMonth: 100,
    aiExpansionsPerMonth: 500,
    ingestionsPerMonth: 50,
  },
  pro: {
    apiCallsPerMonth: 50000,
    aiGenerationsPerMonth: -1, // unlimited
    aiExpansionsPerMonth: -1,
    ingestionsPerMonth: -1,
  },
  enterprise: {
    apiCallsPerMonth: -1,
    aiGenerationsPerMonth: -1,
    aiExpansionsPerMonth: -1,
    ingestionsPerMonth: -1,
  },
};

// ============================================
// ApiKeyManager
// ============================================

export class ApiKeyManager {
  private store: KeyStore | null = null;

  /**
   * Generate a new API key. Returns the raw key (only shown once)
   * and persists the hashed version.
   */
  async generateKey(name: string, tier: PlanTier = "free"): Promise<{ rawKey: string; keyId: string }> {
    const store = await this.loadStore();
    const rawBytes = randomBytes(KEY_LENGTH);
    const rawKey = KEY_PREFIX + rawBytes.toString("hex");
    const keyHash = this.hashKey(rawKey);
    const id = randomBytes(8).toString("hex");

    const apiKey: ApiKey = {
      id,
      keyHash,
      name,
      tier,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      usageCount: 0,
      isActive: true,
    };

    store.keys.push(apiKey);
    await this.saveStore(store);

    return { rawKey, keyId: id };
  }

  /**
   * Validate a raw API key. Returns the key record if valid, null otherwise.
   */
  async validateKey(rawKey: string): Promise<ApiKey | null> {
    if (!rawKey || !rawKey.startsWith(KEY_PREFIX)) return null;

    const store = await this.loadStore();
    const keyHash = this.hashKey(rawKey);
    const key = store.keys.find((k) => k.keyHash === keyHash && k.isActive);

    if (key) {
      key.lastUsedAt = new Date().toISOString();
      key.usageCount++;
      await this.saveStore(store);
    }

    return key ?? null;
  }

  /**
   * List all keys (without hashes, for display).
   */
  async listKeys(): Promise<Omit<ApiKey, "keyHash">[]> {
    const store = await this.loadStore();
    return store.keys.map(({ keyHash, ...rest }) => rest);
  }

  /**
   * Revoke a key by ID.
   */
  async revokeKey(keyId: string): Promise<boolean> {
    const store = await this.loadStore();
    const key = store.keys.find((k) => k.id === keyId);
    if (!key) return false;
    key.isActive = false;
    await this.saveStore(store);
    return true;
  }

  /**
   * Delete a key permanently.
   */
  async deleteKey(keyId: string): Promise<boolean> {
    const store = await this.loadStore();
    const idx = store.keys.findIndex((k) => k.id === keyId);
    if (idx === -1) return false;
    store.keys.splice(idx, 1);
    await this.saveStore(store);
    return true;
  }

  /**
   * Get usage limits for a tier.
   */
  getLimits(tier: PlanTier): UsageLimits {
    return TIER_LIMITS[tier];
  }

  /**
   * Check if a key has exceeded its monthly API call limit.
   */
  async checkRateLimit(rawKey: string): Promise<{ allowed: boolean; remaining: number; limit: number }> {
    const key = await this.validateKey(rawKey);
    if (!key) return { allowed: false, remaining: 0, limit: 0 };

    const limits = this.getLimits(key.tier);
    if (limits.apiCallsPerMonth === -1) {
      return { allowed: true, remaining: -1, limit: -1 };
    }

    // Simple count-based check (resets aren't tracked yet — future enhancement)
    const allowed = key.usageCount <= limits.apiCallsPerMonth;
    const remaining = Math.max(0, limits.apiCallsPerMonth - key.usageCount);

    return { allowed, remaining, limit: limits.apiCallsPerMonth };
  }

  // ============================================
  // Private
  // ============================================

  private hashKey(rawKey: string): string {
    return createHash("sha256").update(rawKey).digest("hex");
  }

  private async loadStore(): Promise<KeyStore> {
    if (this.store) return this.store;

    try {
      const raw = await readFile(KEYS_FILE, "utf-8");
      this.store = JSON.parse(raw) as KeyStore;
    } catch {
      this.store = { keys: [], version: 1 };
    }

    return this.store;
  }

  private async saveStore(store: KeyStore): Promise<void> {
    this.store = store;
    await mkdir(CONFIG_DIR, { recursive: true });
    await writeFile(KEYS_FILE, JSON.stringify(store, null, 2), "utf-8");
  }
}
