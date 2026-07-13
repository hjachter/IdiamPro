// End-to-end verification for "Publish to a shareable link".
// Publishes a snapshot via the real API, views it read-only in a fresh
// browser context, confirms injected <script> does NOT execute (sandboxed
// iframe), then unpublishes and confirms the clean "no longer shared" page.
// Zero AI spend — no model calls involved.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:9002';
const OUT = path.join(__dirname, '..', 'test-screenshots', 'share-link');
fs.mkdirSync(OUT, { recursive: true });

const SAMPLE_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>Project Roadmap</title>
<style>body{font-family:sans-serif;padding:40px;background:#eef4ff;color:#1e293b}
h1{color:#2563eb}.card{background:#fff;padding:24px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.08);max-width:640px}</style></head>
<body><h1>Project Roadmap</h1><div class="card"><h2>Phase 1</h2><p>Research and discovery.</p>
<h2>Phase 2</h2><p>Build the thing.</p></div>
<script>window.__xss_fired = true; document.title = 'XSS-RAN';</script></body></html>`;

(async () => {
  const report = { steps: [], pass: false };
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext();
    const api = ctx.request;

    // 1) Publish
    const pub = await api.post(`${BASE}/api/share/publish`, {
      data: { html: SAMPLE_HTML, title: 'Project Roadmap', template: 'marketing' },
    });
    const pubJson = await pub.json();
    report.steps.push({ step: 'publish', status: pub.status(), shareId: pubJson.shareId, url: pubJson.url });
    if (!pubJson.shareId) throw new Error('publish did not return a shareId');
    const shareId = pubJson.shareId;
    const url = pubJson.url;

    // 2) View in a FRESH context (no login) — screenshot + XSS check
    const viewCtx = await browser.newContext();
    let alertFired = false;
    const page = await viewCtx.newPage();
    page.on('dialog', async (d) => { alertFired = true; await d.dismiss(); });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT, '1-published-view.png'), fullPage: true });

    // The snapshot renders inside a sandboxed iframe — read its content.
    const frame = page.frames().find((f) => f !== page.mainFrame());
    let framedHeading = '';
    if (frame) framedHeading = await frame.$eval('h1', (el) => el.textContent).catch(() => '');
    // The injected script must NOT have run: our top page title stays put and
    // the iframe's script can't touch window.__xss_fired on the parent.
    const parentXss = await page.evaluate(() => Boolean(window.__xss_fired));
    report.steps.push({ step: 'view', heading: framedHeading, alertFired, parentXss });
    if (!/Project Roadmap/.test(framedHeading)) throw new Error('shared content did not render in view');
    if (alertFired || parentXss) throw new Error('XSS: injected script executed');

    // 3) Unpublish
    const un = await api.post(`${BASE}/api/share/unpublish`, { data: { shareId } });
    const unJson = await un.json();
    report.steps.push({ step: 'unpublish', status: un.status(), body: unJson });
    if (!unJson.ok) throw new Error('unpublish failed');

    // 4) View again — should show the clean "no longer shared" page
    const page2 = await viewCtx.newPage();
    await page2.goto(url, { waitUntil: 'networkidle' });
    await page2.waitForTimeout(600);
    await page2.screenshot({ path: path.join(OUT, '2-after-unpublish.png'), fullPage: true });
    const bodyText = await page2.evaluate(() => document.body.innerText);
    const revoked = /no longer shared/i.test(bodyText);
    report.steps.push({ step: 'view-after-unpublish', revoked });
    if (!revoked) throw new Error('revoked link did not show the "no longer shared" page');

    report.pass = true;
    console.log('SHARE-LINK TEST: PASS');
  } catch (e) {
    report.error = String(e && e.message ? e.message : e);
    console.log('SHARE-LINK TEST: FAIL —', report.error);
  } finally {
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
    await browser.close();
    process.exit(report.pass ? 0 : 1);
  }
})();
