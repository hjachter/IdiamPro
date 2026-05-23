# Ollama Slowdown Investigation — 2026-05-22

> Done while Howard was away. **Nothing in the codebase or on the machine was changed** — this is research only. Read it when you wake, decide what to apply, and tell me to do it.

---

## Bottom line (TL;DR)

Three independent factors combine to explain the recent dev-machine slowdown:

1. **IdiamPro switched the default local-AI model from llama3.2 (~2 GB) to Gemma 4 (`gemma4:e4b`, ~5–7 GB at runtime).** That happened on **2026-04-10** in commit `3625bfc`. It roughly doubles the Ollama memory footprint whenever Local AI is actively used.

2. **Ollama 0.24.0 on a 16 GB Mac under memory pressure is unstable.** macOS SIGKILLs the Ollama process when free RAM gets tight. The Ollama menu-bar app immediately respawns it. Each respawn does heavy cold-start work (Metal GPU discovery, scanning 18 model blobs, reading tensor headers). **The earlier session's Ollama log shows 30+ kill/respawn cycles in 14 minutes today** (between 13:20 and 13:34). That respawn loop is what was eating CPU/RAM, not steady-state Ollama.

3. **A corrupted model blob in `~/.ollama/models/blobs/` triggers an `unexpected EOF` error on every cold start.** That makes each respawn cycle noisier and slightly slower. The specific blob is not the wizard-vicuna model (its 7.3 GB blob is intact); could be from `llama2` or `llama3.2`. Not yet pinpointed.

**IdiamPro does not "ping" Ollama in the background.** Verified by code inspection AND by direct observation of Ollama's HTTP request log: while the IdiamPro Electron app sat idle, Ollama received exactly zero requests from it. There is no startup pinging to remove.

---

## Your specific questions, answered

### 1. "Has Ollama itself gotten heavier? Would that impact many users?"

Yes, somewhat — but on this specific machine the bigger problem is the kill/respawn loop, not idle heaviness.

Evidence:
- Idle Ollama 0.24.0 with no models loaded: ~2.7 GB RSS, ~16% CPU. Meaningful baseline overhead.
- Ollama allocates 11.8 GiB of unified-memory as Metal VRAM headroom for inference up front.
- Public issue ollama/ollama#10114 — "Ollama not freeing and eventually running out of memory" — is widely reported and still open. This applies broadly to Ollama users, not just IdiamPro users.

Verdict: anyone on Ollama 0.24.x sees a few-GB idle footprint, but that alone doesn't bog a machine. The multiplier on Howard's machine is the respawn loop, which is specific to systems where Ollama can't comfortably fit alongside other apps.

### 2. "Test by removing the IdiamPro Ollama pinging."

Tested. **There is no pinging to remove.** The actual call structure:

| Function | Cost | When it runs |
|---|---|---|
| `isOllamaAvailable()` | light (`/api/tags`) | Only when Settings dialog opens, or as a fallback after Gemini rate-limit retries fail |
| `checkOllamaStatusAction()` | light (`/api/tags` + `/api/ps`) | Only when Settings dialog opens |
| `getBestAvailableModel()` | light (`/api/tags`) | Only just before a generate/chat call |
| `generateWithOllama()` | **heavy — loads model into RAM** | Only when user triggers an AI action |

Confirmed empirically: while the IdiamPro Electron app was running idle, Ollama's own request log recorded zero requests from it.

So IdiamPro's "pinging" is not the cause of background Ollama load. However, **IdiamPro is indirectly responsible** by having switched the default model to a much heavier one in April — see point 1 in the TL;DR.

### 3. "Will our users see this?"

For **most users: no.** Default provider is Gemini 3.5 Flash (cloud). Ollama is never contacted unless the user opts into Local AI.

For users who opt into Local AI:

| RAM | Risk | Reason |
|---|---|---|
| ≥32 GB | Negligible | Plenty of headroom |
| 24–31 GB | Low | Only under heavy multitasking |
| 16 GB (like Howard's) | **Meaningful** | Likely to see slowdowns; can trigger the kill/respawn loop |
| ≤8 GB | High; app should warn | Even smallest Gemma 4 variant is tight |

There is also a **separate IdiamPro bug** that makes things worse for users with 16–23 GB RAM if they install `gemma4:26b` (see "The fixable IdiamPro bug" below). Howard doesn't have that variant installed, so the bug isn't biting him today — but it's a landmine for users.

---

## The fixable IdiamPro bug worth applying

**File:** `src/lib/ollama-service.ts` lines 148–157.

The `getBestAvailableModel()` priority brackets:

```
≥24 GB  → gemma4:31b (24 GB) first
≥16 GB  → gemma4:26b (16 GB) first   ← problem
≥8  GB  → gemma4:e4b (4 GB) first
<8  GB  → gemma4:e2b (1.5 GB) first
```

The 16 GB bracket prefers a model that itself needs 16 GB — leaving zero RAM for the OS, browser, IdiamPro, anything. On a 16 GB Mac with `gemma4:26b` installed, every AI use would push the system into the kill/respawn loop. Same shape of problem at the ≥24 GB tier (24 GB model on 24 GB machine = no headroom).

**Proposed fix — require ~2× headroom over model size before preferring a larger variant:**

```
<8 GB   → gemma4:e2b (1.5 GB)
8–23 GB → gemma4:e4b (4 GB)        ← was 8–15
24–39 GB → gemma4:26b (16 GB)      ← was 16–23
≥40 GB  → gemma4:31b (24 GB)       ← was ≥24
```

Roughly one file, six lines. I have not applied this — say the word.

---

## What I did and didn't change

**Didn't change:**
- No source code edits.
- No Ollama config edits.
- No models deleted.
- No commits, no pushes.

**Did:**
- Quit Ollama (twice — it auto-relaunched once via menu-bar app).
- Killed the leftover `ollama runner` subprocess that was holding `gemma4:e4b` warm after my test generation.
- Saved a memory: "trust user's hypothesis first" — you correctly suspected Ollama from the start; I was off-track blaming macOS daemons.
- Wrote this report.

**State now:**
- Ollama: fully off.
- IdiamPro Electron app: still running (you saw it earlier).
- Dev server on port 9002: still up (per your earlier "leave it").
- Machine load was 41 → ~13 and dropping as I wrote this.

---

## Open items for your review

1. **Apply the `getBestAvailableModel()` bracket fix above.** Tiny, safe, helps a real user segment.
2. **Disable Ollama's auto-launch at login.** Open the Ollama menu-bar icon → preferences → uncheck "Open at Login." That stops the respawn loop from restarting itself on next reboot.
3. **Find and clear the corrupted model blob.** Simplest: `ollama rm llama2` and `ollama rm wizard-vicuna` (both old, unlikely to be needed). Re-pull anything you actually use.
4. **Optional:** report the kill/respawn-loop pattern to Ollama upstream — it's relevant to other 16 GB Mac users.

---

## Methodology / evidence trail

- Git log mining: 7 Ollama-related commits identified, dated 2026-01-31 to 2026-05-21.
- Code inspection: `src/lib/ollama-service.ts`, `src/components/settings-dialog.tsx`, `src/app/actions.ts`, `src/components/outline-pro.tsx`.
- Live A/B/C test of Ollama memory:
  - **A (idle, no model loaded):** 16% CPU, 2.7 GB RSS.
  - **B (during `gemma4:e4b` generation, 42 s):** CPU 1.9% → 73%, RSS 0 → 680 MB, **Ollama PID changed mid-test** (process killed and respawned during the generation).
  - **C (after explicit unload via `keep_alive:0`):** Ollama PID changed **two more times** in the next 30 seconds; RSS rebuilt to 2.2 GB even with no model loaded.
- Cross-check via `~/.ollama/logs/server.log`: 30+ `"signal: killed"` events between 13:20 and 13:34 today — the macOS memory-pressure killer in action.

---

*— Claude, 2026-05-22, while you slept.*
