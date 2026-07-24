#!/usr/bin/env node
/**
 * guard-build.js — the ".next clobber" gremlin killer.
 *
 * PROBLEM (has repeatedly broken the live app): running `next build` writes the
 * shared `.next` directory that the running dev server (`npm run dev`, port
 * 9002) and the Electron shell serve from. A test-time or CI build mid-session
 * overwrites `.next` and leaves the live app serving broken / 404 assets.
 *
 * DURABLE FIX: this guard refuses to run a `.next`-writing `next build` while a
 * dev server is detected on port 9002 UNLESS the build is redirected to a
 * SEPARATE output directory via NEXT_DIST_DIR (see next.config.ts distDir).
 *
 *   - Production / CI (Vercel): no dev server on 9002 → build runs normally,
 *     output goes to `.next` exactly as before.
 *   - Local, dev server up, want a build: use `npm run build:isolated`, which
 *     sets NEXT_DIST_DIR=.next-isolated so the live `.next` is never touched.
 *   - Local, dev server up, plain `npm run build` into `.next`: BLOCKED with a
 *     clear message so the live app can't be clobbered by accident.
 *
 * Usage: node scripts/guard-build.js   (invoked by the `build` npm script)
 */
const net = require('net');
const { spawnSync } = require('child_process');

const DEV_PORT = 9002;
const LIVE_DIST = '.next';
const distDir = process.env.NEXT_DIST_DIR || LIVE_DIST;
const isolated = distDir !== LIVE_DIST;

// Detect a listener on the dev port by trying to CONNECT to it. A connect
// probe is robust regardless of which interface the server bound to — the dev
// server listens on IPv6 `*:9002`, so a bind-based check on 127.0.0.1 would
// miss it entirely (that gap once let a build clobber the live `.next`). We
// probe both IPv4 and IPv6 loopback; a success on either means it's up.
function connectProbe(host) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let done = false;
    const finish = (up) => {
      if (done) return;
      done = true;
      sock.destroy();
      resolve(up);
    };
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

async function main() {
  const running = await devServerRunning();

  if (running && !isolated) {
    console.error(
      '\n[guard-build] REFUSING to run `next build` into `.next`.\n' +
        `  A dev server is live on port ${DEV_PORT}; building into \`.next\` would\n` +
        '  overwrite the assets it is serving and break the live app.\n\n' +
        '  Do ONE of these instead:\n' +
        '    • Build without touching the live app:   npm run build:isolated\n' +
        '      (outputs to `.next-isolated`; the live `.next` is untouched)\n' +
        '    • Or stop the dev server first, then:     npm run build\n',
    );
    process.exit(2);
  }

  if (isolated) {
    console.log(`[guard-build] Isolated build → output dir "${distDir}" (live \`.next\` untouched).`);
  } else {
    console.log('[guard-build] No dev server on 9002 — building into `.next` normally.');
  }

  const res = spawnSync('npx', ['next', 'build'], {
    stdio: 'inherit',
    env: process.env,
  });
  process.exit(res.status == null ? 1 : res.status);
}

main().catch((e) => {
  console.error('[guard-build] failed:', e);
  process.exit(1);
});
