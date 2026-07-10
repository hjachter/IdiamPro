// Verify the fix: for a TOP-of-document selection the bubble menu now paints
// ABOVE the sticky toolbar (z-50) so its buttons are clickable, and the new
// Underline bubble button applies underline. Uses NORMAL clicks (no force) so
// occlusion would still fail the test if unfixed.
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const SHOT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'editor-audit');
fs.mkdirSync(SHOT_DIR, { recursive: true });
process.on('unhandledRejection', () => {});
let app, page;

async function findMain(a) {
  const start = Date.now();
  while (Date.now() - start < 30000) {
    for (const w of a.windows()) { try { const u = w.url(); if (!u.startsWith('devtools://') && u.includes('localhost:9002')) return w; } catch {} }
    await new Promise(r => setTimeout(r, 800));
  }
  throw new Error('no window');
}
async function dismiss() {
  for (let i = 0; i < 4; i++) {
    const o = page.locator('div[data-state="open"].fixed.inset-0').first();
    if (!(await o.isVisible().catch(()=>false))) break;
    const b = page.locator('button:has-text("Got it"),button:has-text("Get started"),[aria-label="Close"]').first();
    if (await b.isVisible().catch(()=>false)) await b.click().catch(()=>{}); else await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }
  await page.evaluate(() => document.querySelectorAll('[data-testid="discovery-toast-stack"]').forEach(e=>e.remove())).catch(()=>{});
}
async function html() { return await page.evaluate(() => document.querySelector('.tiptap').innerHTML); }

(async () => {
  const root = path.resolve(__dirname, '..');
  app = await electron.launch({ args: [root], env: { ...process.env, NODE_ENV: 'development' } });
  page = await findMain(app);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
  await page.evaluate(() => { try { localStorage.setItem('discovery:professionalMode','true'); } catch {} });
  const newBtn = page.locator('button:has-text("New Outline")').first();
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    if (!page.url().includes('/app')) { await page.evaluate(()=>{window.location.href='/app';}).catch(()=>{}); await page.waitForLoadState('domcontentloaded').catch(()=>{}); }
    try { await newBtn.waitFor({ state:'visible', timeout: 8000 }); break; } catch { await page.evaluate(()=>{window.location.href='/app';}).catch(()=>{}); await page.waitForTimeout(1500); }
  }
  await dismiss();
  await page.locator('button:has-text("New Outline")').first().click();
  await page.waitForTimeout(1500);
  await dismiss();
  await page.locator('[role="treeitem"]').first().click();
  await page.waitForTimeout(800);
  await dismiss();

  const ed = page.locator('.tiptap').first();
  await ed.click({ position: { x: 60, y: 12 } });
  await page.waitForTimeout(300);
  // ONE short paragraph at the very top of the editor (the occlusion-prone case)
  await page.keyboard.type('Format this top line please');
  await page.waitForTimeout(300);
  await dismiss();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(SHOT_DIR, 'fix-top-bubble.png'), fullPage: true });

  const results = {};
  // Underline via bubble (NORMAL click)
  try { await page.locator('[aria-label="Underline"]').first().click({ timeout: 4000 }); } catch (e) { console.log('underline click err', e.message.split('\n')[0]); }
  await page.waitForTimeout(350);
  let h = await html();
  results.underlineBubble = /<u>/.test(h);
  // toggle off
  try { await page.locator('[aria-label="Underline"]').first().click({ timeout: 4000 }); } catch {}
  await page.waitForTimeout(250);

  // Bold via bubble (NORMAL click) on top-of-doc selection
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.waitForTimeout(400);
  try { await page.locator('[aria-label="Bold"]').first().click({ timeout: 4000 }); } catch (e) { console.log('bold click err', e.message.split('\n')[0]); }
  await page.waitForTimeout(350);
  h = await html();
  results.boldBubbleTop = /<strong>/.test(h);

  // Heading via bubble (NORMAL click)
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.waitForTimeout(400);
  try { await page.locator('[aria-label="Heading 2"]').first().click({ timeout: 4000 }); } catch (e) { console.log('h2 click err', e.message.split('\n')[0]); }
  await page.waitForTimeout(350);
  h = await html();
  results.h2BubbleTop = /<h2/.test(h);

  await page.screenshot({ path: path.join(SHOT_DIR, 'fix-after-format.png'), fullPage: true });
  console.log('RESULTS', JSON.stringify(results));
  console.log('final HTML:', (await html()).slice(0, 200));
  try { await Promise.race([app.close(), new Promise(r=>setTimeout(r,4000))]); } catch {}
  process.exit(0);
})();
