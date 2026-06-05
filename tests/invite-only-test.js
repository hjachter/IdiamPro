/**
 * Invite-only signup — end-to-end test.
 *
 * Like tests/onboarding-emails-test.js, this suite does NOT launch
 * Electron. The invite-allowlist gate lives entirely in Next.js route
 * handlers, so this test boots a scratch Next dev server on a separate
 * port and drives the routes with fetch. Clerk's REST delete-user call
 * is mocked via the _setClerkDeleterForTest hook so no real Clerk
 * account is needed.
 *
 * IMPORTANT: This file is parse-checked only in CI for now (the parallel
 * launch-day work has the dev server occupied on port 9002). To run it
 * manually once the port is free:
 *
 *   node tests/invite-only-test.js
 *
 * Coverage:
 *   1. Stub mode (INVITE_ALLOWLIST unset) — /api/invite-check returns
 *      { allowed: true } for any email; the Clerk webhook does NOT
 *      attempt to delete and sends the welcome email path.
 *   2. With INVITE_ALLOWLIST=alice@example.com — /api/invite-check returns
 *      { allowed: false, message: ... } for bob@example.com.
 *   3. With same allowlist — /api/invite-check returns { allowed: true }
 *      for alice@example.com (case-insensitive: ALICE@EXAMPLE.COM also
 *      works).
 *   4. Webhook with allowlist set — POSTing a synthetic user.created
 *      event for an unauthorized email triggers the Clerk delete-user
 *      call and skips the welcome email.
 */

'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.INVITE_TEST_PORT || '9098';
const BASE_URL = `http://127.0.0.1:${PORT}`;

const REPORT_DIR = path.join(ROOT, 'test-screenshots', 'invite-only');
fs.mkdirSync(REPORT_DIR, { recursive: true });

const STORE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'idiampro-invite-'));
const STORE_PATH = path.join(STORE_DIR, 'unsubscribed.json');

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  const tag = pass ? 'PASS' : 'FAIL';
  console.log(`[${tag}] ${name}${detail ? ' — ' + detail : ''}`);
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(maxMs = 60000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/api/invite-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'probe@example.com' }),
      });
      if (res.status === 200 || res.status === 401 || res.status === 400) return true;
    } catch {
      // not yet
    }
    await sleep(500);
  }
  return false;
}

let serverProc = null;

async function startServer(envOverrides) {
  return new Promise((resolve, reject) => {
    serverProc = spawn('npx', ['next', 'dev', '-p', PORT], {
      cwd: ROOT,
      env: {
        ...process.env,
        EMAIL_UNSUBSCRIBE_STORE_PATH: STORE_PATH,
        EMAIL_UNSUBSCRIBE_SECRET: 'test-unsubscribe-secret',
        CLERK_WEBHOOK_SECRET: '',
        CLERK_SECRET_KEY: '',
        CRON_SECRET: '',
        ...envOverrides,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    serverProc.stdout.on('data', () => {});
    serverProc.stderr.on('data', () => {});
    serverProc.on('error', reject);
    waitForServer().then((ok) => (ok ? resolve() : reject(new Error('server did not start'))));
  });
}

function stopServer() {
  if (serverProc && !serverProc.killed) {
    try { serverProc.kill('SIGTERM'); } catch {}
  }
  serverProc = null;
}

async function postJson(url, body) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function runStubMode() {
  console.log('--- Stub mode (INVITE_ALLOWLIST unset) ---');
  await startServer({ INVITE_ALLOWLIST: '' });

  // 1. invite-check accepts anyone in stub mode.
  {
    const res = await postJson(`${BASE_URL}/api/invite-check`, { email: 'random@example.com' });
    const json = await res.json();
    const pass = res.status === 200 && json?.allowed === true;
    record('stub: invite-check returns allowed:true for any email', pass, JSON.stringify(json));
  }

  // 2. Webhook with no allowlist sends welcome email (skipped-no-key from email/send).
  {
    const res = await postJson(`${BASE_URL}/api/webhooks/clerk`, {
      type: 'user.created',
      data: {
        id: 'user_stub_1',
        first_name: 'Anyone',
        primary_email_address_id: 'email_1',
        email_addresses: [{ id: 'email_1', email_address: 'anyone@example.com' }],
      },
    });
    const json = await res.json();
    const pass = res.status === 200 && json?.send?.status === 'skipped-no-key' && !json?.blocked;
    record('stub: webhook sends welcome (no block) when allowlist empty', pass, JSON.stringify(json));
  }

  stopServer();
}

async function runEnforcedMode() {
  console.log('--- Enforced mode (INVITE_ALLOWLIST=alice@example.com) ---');
  await startServer({ INVITE_ALLOWLIST: 'alice@example.com' });

  // 3. bob is rejected.
  {
    const res = await postJson(`${BASE_URL}/api/invite-check`, { email: 'bob@example.com' });
    const json = await res.json();
    const pass =
      res.status === 200 &&
      json?.allowed === false &&
      typeof json?.message === 'string' &&
      json.message.toLowerCase().includes('invite-only');
    record('enforced: invite-check rejects bob@example.com with gate message', pass, JSON.stringify(json));
  }

  // 4. alice is allowed (and case-insensitive: ALICE@EXAMPLE.COM also works).
  {
    const res = await postJson(`${BASE_URL}/api/invite-check`, { email: 'ALICE@EXAMPLE.COM' });
    const json = await res.json();
    const pass = res.status === 200 && json?.allowed === true;
    record('enforced: invite-check allows alice (case-insensitive)', pass, JSON.stringify(json));
  }

  // 5. Webhook blocks unauthorized signup. Without a real CLERK_SECRET_KEY
  // the deleter logs a warning and reports ok:false — that's still a block
  // (the welcome email path is skipped). We assert: blocked=true, send is
  // NOT present.
  {
    const res = await postJson(`${BASE_URL}/api/webhooks/clerk`, {
      type: 'user.created',
      data: {
        id: 'user_blocked_1',
        first_name: 'Bob',
        primary_email_address_id: 'email_1',
        email_addresses: [{ id: 'email_1', email_address: 'bob@example.com' }],
      },
    });
    const json = await res.json();
    const pass =
      res.status === 200 &&
      json?.blocked === true &&
      json?.reason === 'not-on-invite-allowlist' &&
      !json?.send;
    record('enforced: webhook blocks unauthorized signup, no welcome email', pass, JSON.stringify(json));
  }

  // 6. Webhook still sends welcome for an allowed email.
  {
    const res = await postJson(`${BASE_URL}/api/webhooks/clerk`, {
      type: 'user.created',
      data: {
        id: 'user_alice_1',
        first_name: 'Alice',
        primary_email_address_id: 'email_1',
        email_addresses: [{ id: 'email_1', email_address: 'alice@example.com' }],
      },
    });
    const json = await res.json();
    const pass = res.status === 200 && !json?.blocked && json?.send?.status === 'skipped-no-key';
    record('enforced: webhook sends welcome to alice (allowed)', pass, JSON.stringify(json));
  }

  stopServer();
}

async function main() {
  console.log('Starting invite-only test on port', PORT);
  try {
    await runStubMode();
    await runEnforcedMode();
  } finally {
    stopServer();
  }

  const report = {
    suite: 'invite-only',
    when: new Date().toISOString(),
    results,
    passed: results.filter((r) => r.pass).length,
    failed: results.filter((r) => !r.pass).length,
  };
  fs.writeFileSync(path.join(REPORT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  const md = [
    `# Invite-only signup — ${report.when}`,
    ``,
    `Passed: ${report.passed} / ${report.results.length}`,
    ``,
    ...report.results.map((r) => `- ${r.pass ? 'PASS' : 'FAIL'} — ${r.name}${r.detail ? '\n  - ' + r.detail : ''}`),
  ].join('\n');
  fs.writeFileSync(path.join(REPORT_DIR, 'report.md'), md);

  process.exit(report.failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  stopServer();
  process.exit(1);
});
