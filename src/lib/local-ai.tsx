'use client';

/**
 * Local AI (Ollama) client-side helpers.
 *
 * These live in the renderer so we can: (1) detect whether the local AI engine
 * is reachable BEFORE we fire off a server action that would otherwise
 * dead-end, (2) show a calm, one-click "Start Local AI" notice instead of a
 * raw error, and (3) auto-start Ollama on launch for users who depend on local
 * AI (provider === 'local').
 *
 * Scope guard: none of this fires for pure-cloud users. The guard only trips
 * when the user has explicitly chosen the "Local" provider, and the boot
 * auto-start is likewise gated on provider === 'local'. Cloud/Auto keep their
 * own server-side cloud-first behavior untouched.
 */

import React from 'react';
import { toast } from '@/hooks/use-toast';
import { ToastAction, type ToastActionElement } from '@/components/ui/toast';

const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434';
const OLLAMA_INSTALLER_URL = 'https://ollama.com/download';

/**
 * The Ollama base URL. Defaults to localhost:11434 but honors a
 * `localStorage.ollamaBaseUrl` override so power users can point at a remote
 * Ollama — and so tests can simulate "down" via a dead port without touching
 * the user's real Ollama.
 */
export function getOllamaBaseUrl(): string {
  if (typeof window === 'undefined') return DEFAULT_OLLAMA_BASE_URL;
  try {
    const override = localStorage.getItem('ollamaBaseUrl');
    if (override && override.trim()) return override.trim().replace(/\/+$/, '');
  } catch {
    /* localStorage blocked — fall through to default */
  }
  return DEFAULT_OLLAMA_BASE_URL;
}

export type AIProviderSetting = 'cloud' | 'local' | 'auto';

export function getAIProviderSetting(): AIProviderSetting {
  if (typeof window === 'undefined') return 'cloud';
  try {
    const v = localStorage.getItem('aiProvider');
    if (v === 'local' || v === 'auto' || v === 'cloud') return v;
  } catch {
    /* ignore */
  }
  return 'cloud';
}

function isElectron(): boolean {
  return typeof window !== 'undefined' && !!(window as unknown as { electronAPI?: { isElectron?: boolean } }).electronAPI?.isElectron;
}

type ElectronAPI = {
  isElectron?: boolean;
  startOllama?: () => Promise<{ ok: boolean; error?: string }>;
  checkOllamaInstallation?: () => Promise<{ installed: boolean; platform: string }>;
  openExternal?: (url: string) => Promise<unknown>;
};

function getElectronAPI(): ElectronAPI | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { electronAPI?: ElectronAPI }).electronAPI ?? null;
}

/** Is the local AI engine (Ollama) responding right now? */
export async function isLocalAIReachable(timeoutMs = 2500): Promise<boolean> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${getOllamaBaseUrl()}/api/tags`, { signal: controller.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

async function isOllamaInstalled(): Promise<boolean> {
  const api = getElectronAPI();
  if (!api?.checkOllamaInstallation) return false;
  try {
    const r = await api.checkOllamaInstallation();
    return !!r?.installed;
  } catch {
    return false;
  }
}

/**
 * Ask the main process to start Ollama, then poll until it responds (default
 * ~10s). Returns { ok } once reachable, or a reason if it never came up.
 */
export async function startLocalAIEngine(pollMs = 10000): Promise<{ ok: boolean; reason?: string }> {
  const api = getElectronAPI();
  if (!isElectron() || !api?.startOllama) {
    return { ok: false, reason: 'not-desktop' };
  }
  try {
    await api.startOllama();
  } catch {
    /* Even if the launch call throws, poll below — it may still be coming up. */
  }
  const deadline = Date.now() + pollMs;
  // First check immediately, then poll every second until the deadline.
  if (await isLocalAIReachable(1500)) return { ok: true };
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await isLocalAIReachable(1500)) return { ok: true };
  }
  return { ok: false, reason: 'timeout' };
}

function openExternal(url: string): void {
  const api = getElectronAPI();
  if (api?.openExternal) {
    void api.openExternal(url);
  } else if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener');
  }
}

// Prevents a burst of local-AI calls from stacking identical notices.
let noticeCooldownUntil = 0;

/**
 * Show the calm "Local AI isn't running" notice with the right call to action:
 *  - Desktop + Ollama installed → "Start Local AI" (launches + retries).
 *  - Desktop + not installed    → "Install" (opens the installer page).
 *  - Web build                  → guidance only (can't spawn processes).
 * Every variant also points the user to Settings › AI Provider as a cloud escape.
 */
export async function notifyLocalAIDown(opts?: { onRetry?: () => void }): Promise<void> {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (now < noticeCooldownUntil) return;
  noticeCooldownUntil = now + 4000;

  const desktop = isElectron();
  const installed = desktop ? await isOllamaInstalled() : false;

  let action: ToastActionElement | undefined;
  let description: React.ReactNode;

  if (desktop && installed) {
    description = 'Your on-device AI engine isn’t responding. Start it, or switch to Cloud in Settings › AI Provider.';
    action = (
      <ToastAction
        altText="Start Local AI"
        onClick={() => {
          toast({
            title: 'Starting Local AI…',
            description: 'Waking up your on-device engine — one moment.',
            duration: 15000,
          });
          void startLocalAIEngine().then((res) => {
            if (res.ok) {
              toast({
                title: 'Local AI ready',
                description: 'Your on-device engine is running — retrying your request…',
                duration: 6000,
              });
              opts?.onRetry?.();
            } else {
              toast({
                title: 'Couldn’t start Local AI',
                description:
                  'The on-device engine didn’t come up. Open the Ollama app manually, or switch to Cloud in Settings › AI Provider.',
              });
            }
          });
        }}
      >
        Start Local AI
      </ToastAction>
    );
  } else if (desktop && !installed) {
    description = 'The on-device AI engine (Ollama) isn’t installed. Install it to run AI on your machine, or switch to Cloud in Settings › AI Provider.';
    action = (
      <ToastAction altText="Install the local AI engine" onClick={() => openExternal(OLLAMA_INSTALLER_URL)}>
        Install
      </ToastAction>
    );
  } else {
    description = 'Local AI runs only in the desktop app. On the web, switch to Cloud in Settings › AI Provider.';
  }

  toast({
    title: 'Local AI isn’t running',
    description,
    action,
  });
}

/**
 * Gate a local-AI action. Returns true if it's safe to proceed. Only trips when
 * the user explicitly chose the "Local" provider AND the engine is unreachable
 * — in which case it shows the calm notice and returns false so the caller can
 * abort instead of dead-ending. Cloud/Auto always return true (their cloud-first
 * paths and server-side fallback are unchanged).
 */
export async function guardLocalAIReady(opts?: { onRetry?: () => void }): Promise<boolean> {
  if (getAIProviderSetting() !== 'local') return true;
  if (await isLocalAIReachable()) return true;
  await notifyLocalAIDown({ onRetry: opts?.onRetry });
  return false;
}

/**
 * Fired once on app launch (desktop only). If the user depends on local AI
 * (provider === 'local') and the engine isn't up, quietly start it — no dialog,
 * no blocking. This is the "Ollama isn't running after a reboot" fix. No-op for
 * Cloud/Auto users and on the web build.
 */
export async function autoStartLocalAIOnBoot(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!isElectron()) return;
  if (getAIProviderSetting() !== 'local') return;
  if (await isLocalAIReachable()) return;
  if (!(await isOllamaInstalled())) return;
  const api = getElectronAPI();
  try {
    await api?.startOllama?.();
    // Best-effort: no toast, no await on readiness. If the user then invokes a
    // local action before it's up, the guard notice covers them.
  } catch {
    /* silent — boot must never block on this */
  }
}
