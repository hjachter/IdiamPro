#!/usr/bin/env node
/**
 * run-all.js — the tiered "TEST EVERYTHING" runner (strategy codified in
 * CLAUDE.md, 2026-07-24).
 *
 *   • DETERMINISTIC suites  → run ONCE.
 *   • NONDETERMINISTIC (AI) → run 5× via lib/ai-invariants.repeat, pass only if
 *                             ALL 5 hold (invariants, not exact output).
 *   • GUARDRAIL suites      → run ADVERSARIALLY (hostile cases live in-suite);
 *                             RELEASE BLOCKERS; financial-safety called out.
 *
 * It NEVER runs `next build` against the live dev server — it uses the running
 * dev server on 9002 (start it yourself first, or via `npm run dev`). If a build
 * is ever needed for a suite, use `npm run build:isolated` (separate output dir).
 *
 * Usage:
 *   node tests/run-all.js            # full tiered run (all manifest suites)
 *   node tests/run-all.js --fast     # quick subset — verify the framework works
 *   FAST=1 node tests/run-all.js     # same as --fast
 *
 * Exits non-zero if ANY suite fails. A guardrail failure is flagged as a RELEASE
 * BLOCKER. The final scorecard always states the financial-safety result.
 */
const { spawnSync } = require('child_process');
const net = require('net');
const path = require('path');
const { MANIFEST, fastSet } = require('./lib/test-manifest');
const { repeat } = require('./lib/ai-invariants');

const ROOT = path.resolve(__dirname, '..');
const FAST = process.argv.includes('--fast') || process.env.FAST === '1';
const DEV_PORT = 9002;

function connectProbe(host) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let done = false;
    const finish = (up) => { if (done) return; done = true; sock.destroy(); resolve(up); };
    sock.setTimeout(1500);
    sock.once('connect', () => finish(true));
    sock.once('timeout', () => finish(false));
    sock.once('error', () => finish(false));
    sock.connect(DEV_PORT, host);
  });
}
async function devServerRunning() {
  const [v4, v6] = await Promise.all([connectProbe('127.0.0.1'), connectProbe('::1')]);
  return v4 || v6;
}

// Run one suite script once; returns { ok, code }.
function runSuiteOnce(file) {
  const res = spawnSync('node', [path.join(ROOT, file)], {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
    timeout: 15 * 60 * 1000,
  });
  const ok = res.status === 0;
  return { ok, code: res.status, out: `${res.stdout || ''}\n${res.stderr || ''}` };
}

async function main() {
  const started = Date.now();
  console.log(`\n=== TIERED TEST RUN ${FAST ? '(--fast subset)' : '(full)'} ===\n`);

  const devUp = await devServerRunning();
  console.log(devUp
    ? `Dev server detected on ${DEV_PORT} — using the LIVE server (no build, no clobber).`
    : `WARNING: no dev server on ${DEV_PORT}. Electron/UI suites may fail — start \`npm run dev\` first.`);

  const suites = FAST ? fastSet() : MANIFEST;
  const scorecard = [];

  for (const entry of suites) {
    const { file, tier, repeats = 1, selfRepeats, blocker } = entry;
    const label = `[${tier}] ${file}`;
    process.stdout.write(`\n▶ ${label}${repeats > 1 ? ` ×${repeats}` : ''} … `);

    let result;
    if (tier === 'nondeterministic' && repeats > 1 && !selfRepeats) {
      // Run N× via the shared repeat helper; ANY failing iteration fails it.
      const r = await repeat(repeats, async (i) => {
        const { ok, code } = runSuiteOnce(file);
        if (!ok) throw new Error(`iteration ${i} exited ${code}`);
        return code;
      });
      result = { ok: r.ok, detail: r.summary, runs: r.total };
    } else {
      const { ok, code } = runSuiteOnce(file);
      result = { ok, detail: ok ? 'passed' : `exited ${code}`, runs: 1 };
    }

    console.log(result.ok ? 'PASS' : 'FAIL');
    scorecard.push({ file, tier, blocker: !!blocker, financialSafety: !!entry.financialSafety, ...result });
  }

  // ── Scorecard ─────────────────────────────────────────────────────────────
  const tiers = ['guardrail', 'nondeterministic', 'deterministic'];
  console.log('\n\n================= TIERED SCORECARD =================');
  for (const t of tiers) {
    const rows = scorecard.filter((s) => s.tier === t);
    if (!rows.length) continue;
    const pass = rows.filter((r) => r.ok).length;
    console.log(`\n${t.toUpperCase()} — ${pass}/${rows.length} passed`);
    for (const r of rows) {
      console.log(`  ${r.ok ? '✓' : '✗'} ${r.file}${r.runs > 1 ? ` (×${r.runs})` : ''} — ${r.detail}`);
    }
  }

  // ── Financial-safety callout (always explicit) ──────────────────────────────
  const fin = scorecard.filter((s) => s.financialSafety);
  const finOk = fin.length > 0 && fin.every((s) => s.ok);
  console.log('\n---------------------------------------------------');
  if (fin.length === 0) {
    console.log('🟠 FINANCIAL-SAFETY: NOT RUN in this scope — do NOT treat as verified.');
  } else if (finOk) {
    console.log('🟠 FINANCIAL-SAFETY: PASS — the server-side AI cost cap held against every adversarial bypass attempt. Company keys unreachable by free/unverified/over-allowance users.');
  } else {
    console.log('🟠 FINANCIAL-SAFETY: FAIL — RELEASE BLOCKER. The AI cost cap did NOT hold. Do not ship.');
  }

  const failed = scorecard.filter((s) => s.ok === false);
  const blockerFail = failed.some((s) => s.blocker);
  const secs = Math.round((Date.now() - started) / 1000);
  console.log('---------------------------------------------------');
  console.log(`\nTOTAL: ${scorecard.length - failed.length}/${scorecard.length} suites passed in ${secs}s.`);
  if (failed.length) {
    console.log(`FAILURES: ${failed.map((f) => f.file).join(', ')}`);
    if (blockerFail) console.log('One or more RELEASE-BLOCKER (guardrail) suites failed.');
    process.exit(1);
  }
  console.log('ALL TIERS GREEN.');
  process.exit(0);
}

main().catch((e) => {
  console.error('run-all crashed:', e);
  process.exit(1);
});
