/**
 * Probe: capture client-side JS errors on /signup.
 * Hooks console + pageerror, navigates, waits for React to mount/throw.
 */
const { chromium } = require('playwright');

async function probe(url) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const consoleMsgs = [];
  const pageErrors = [];
  const requestFailures = [];

  page.on('console', (msg) => {
    consoleMsgs.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    pageErrors.push(`${err.name}: ${err.message}\n${err.stack || ''}`);
  });
  page.on('requestfailed', (req) => {
    requestFailures.push(`${req.method()} ${req.url()} -> ${req.failure()?.errorText}`);
  });

  try {
    console.log(`\n=== Navigating to ${url} ===`);
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log(`HTTP ${resp ? resp.status() : 'n/a'}`);
  } catch (e) {
    console.log(`Navigation error: ${e.message}`);
  }

  // Give React time to mount and throw, and lazy chunks time to load
  await new Promise((r) => setTimeout(r, 6000));

  // Look for the error boundary text
  const bodyText = await page.evaluate(() => document.body.innerText || '').catch(() => '');
  const hasBoundary =
    bodyText.includes("Something went wrong") ||
    bodyText.includes("hit an unexpected error") ||
    bodyText.includes("IdiamPro hit");

  console.log(`\n=== Error boundary visible? ${hasBoundary} ===`);
  console.log(`\n=== Body text (first 600 chars) ===\n${bodyText.slice(0, 600)}`);

  console.log(`\n=== Page errors (${pageErrors.length}) ===`);
  pageErrors.forEach((e, i) => console.log(`--- err ${i} ---\n${e}\n`));

  console.log(`\n=== Console messages (${consoleMsgs.length}) ===`);
  consoleMsgs.forEach((m) => console.log(m));

  console.log(`\n=== Request failures (${requestFailures.length}) ===`);
  requestFailures.forEach((r) => console.log(r));

  await browser.close();
}

const target = process.argv[2] || 'https://2ndbrainware.com/signup';
probe(target).catch((e) => {
  console.error('Probe failed:', e);
  process.exit(1);
});
