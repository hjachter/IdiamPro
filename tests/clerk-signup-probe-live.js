/**
 * Live probe: capture client-side JS errors on the production /signup and /admin/applicants pages.
 * Headless Chromium, hooks console + pageerror + requestfailed, saves screenshots and a report.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'clerk-live');
fs.mkdirSync(OUT_DIR, { recursive: true });

function newCapture() {
  return { consoleMsgs: [], pageErrors: [], requestFailures: [] };
}

function attachListeners(page, cap) {
  page.on('console', (msg) => {
    cap.consoleMsgs.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    cap.pageErrors.push(`${err.name}: ${err.message}\n${err.stack || ''}`);
  });
  page.on('requestfailed', (req) => {
    cap.requestFailures.push(`${req.method()} ${req.url()} -> ${req.failure()?.errorText}`);
  });
}

async function visit(browser, url, screenshotName, cap) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  attachListeners(page, cap);

  let status = 'n/a';
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    status = resp ? resp.status() : 'n/a';
  } catch (e) {
    cap.pageErrors.push(`NAV ERROR: ${e.message}`);
  }

  // Give React time to mount + throw, and lazy chunks time to load
  await new Promise((r) => setTimeout(r, 6000));

  const bodyText = await page.evaluate(() => document.body.innerText || '').catch(() => '');
  const screenshotPath = path.join(OUT_DIR, screenshotName);
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});

  await ctx.close();
  return { status, bodyText, screenshotPath };
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  const signupCap = newCapture();
  const signupResult = await visit(
    browser,
    'https://2ndbrainware.com/signup',
    'signup.png',
    signupCap
  );

  const adminCap = newCapture();
  const adminResult = await visit(
    browser,
    'https://2ndbrainware.com/admin/applicants',
    'admin.png',
    adminCap
  );

  await browser.close();

  const lines = [];
  const push = (s) => lines.push(s);

  push('# Clerk Live Probe Report');
  push('');
  push(`Date: ${new Date().toISOString()}`);
  push('');
  push('## /signup');
  push(`- HTTP status: ${signupResult.status}`);
  push(`- Screenshot: ${signupResult.screenshotPath}`);
  push('');
  push('### Body text (first 800 chars)');
  push('```');
  push(signupResult.bodyText.slice(0, 800));
  push('```');
  push('');
  push(`### Page errors (${signupCap.pageErrors.length})`);
  signupCap.pageErrors.forEach((e, i) => {
    push(`#### Error ${i}`);
    push('```');
    push(e);
    push('```');
  });
  push('');
  push(`### Console messages (${signupCap.consoleMsgs.length})`);
  push('```');
  signupCap.consoleMsgs.forEach((m) => push(m));
  push('```');
  push('');
  push(`### Request failures (${signupCap.requestFailures.length})`);
  push('```');
  signupCap.requestFailures.forEach((r) => push(r));
  push('```');
  push('');
  push('## /admin/applicants');
  push(`- HTTP status: ${adminResult.status}`);
  push(`- Screenshot: ${adminResult.screenshotPath}`);
  push('');
  push('### Body text (first 800 chars)');
  push('```');
  push(adminResult.bodyText.slice(0, 800));
  push('```');
  push('');
  push(`### Page errors (${adminCap.pageErrors.length})`);
  adminCap.pageErrors.forEach((e, i) => {
    push(`#### Error ${i}`);
    push('```');
    push(e);
    push('```');
  });
  push('');
  push(`### Console messages (${adminCap.consoleMsgs.length})`);
  push('```');
  adminCap.consoleMsgs.forEach((m) => push(m));
  push('```');
  push('');
  push(`### Request failures (${adminCap.requestFailures.length})`);
  push('```');
  adminCap.requestFailures.forEach((r) => push(r));
  push('```');

  const reportPath = path.join(OUT_DIR, 'report.md');
  fs.writeFileSync(reportPath, lines.join('\n'));

  // Also stream to stdout for the agent
  console.log(lines.join('\n'));
  console.log(`\n\n=== Report written to ${reportPath} ===`);
})().catch((e) => {
  console.error('Probe crashed:', e);
  process.exit(1);
});
