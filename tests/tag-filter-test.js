// Tag-filter feature test — drives the new "Filter by tag" control against the
// running dev server on http://localhost:9002 (web/chromium).
//
// Seeds a small outline with tags on some nodes, opens the tag filter, selects
// a tag, and asserts ONLY the tagged nodes (plus their ancestors) show; then
// clears the filter and asserts the full outline returns.
//
// Screenshots: filter-by-tag.png (filtered) and filter-cleared.png (cleared).

const { chromium } = require('/Users/howardjachter/Developer/IdiamPro/node_modules/playwright');

const SHOT_DIR = '/private/tmp/claude-501/-Users-howardjachter/dc1a4cb9-7949-4c86-a6ad-521f02bacb84/scratchpad';
const URL = 'http://localhost:9002/app';

function seedOutline() {
  const mk = (id, name, parentId, childrenIds, tags) => ({
    id, name, content: '', type: parentId === null ? 'root' : 'note',
    parentId, childrenIds, isCollapsed: false, prefix: '',
    metadata: tags ? { tags } : undefined,
  });
  const nodes = {
    root:  mk('root', 'Project Plan', null, ['design', 'dev', 'mkt']),
    design: mk('design', 'Design', 'root', ['wire', 'mock']),
    wire:  mk('wire', 'Wireframes', 'design', [], ['urgent']),
    mock:  mk('mock', 'Mockups', 'design', []),
    dev:   mk('dev', 'Development', 'root', ['api', 'fe']),
    api:   mk('api', 'API', 'dev', [], ['urgent']),
    fe:    mk('fe', 'Frontend', 'dev', []),
    mkt:   mk('mkt', 'Marketing', 'root', [], ['later']),
  };
  return {
    id: 'tag-filter-test-outline',
    name: 'Tag Filter Test',
    rootNodeId: 'root',
    nodes,
    isGuide: false,
    lastModified: Date.now(),
  };
}

async function visibleTexts(page) {
  return await page.evaluate(() => {
    const names = ['Design', 'Wireframes', 'Mockups', 'Development', 'API', 'Frontend', 'Marketing'];
    const tree = document.querySelector('[role="tree"]') || document.body;
    const txt = tree.innerText;
    const out = {};
    names.forEach(n => { out[n] = txt.includes(n); });
    return out;
  });
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const failures = [];
  try {
    // 1) Load origin, seed storage, reload so the app picks it up.
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate((outline) => {
      localStorage.setItem('outline-pro-data', JSON.stringify({ outlines: [outline] }));
      localStorage.setItem('idiampro-current-outline-id', outline.id);
    }, seedOutline());
    await page.goto(URL, { waitUntil: 'domcontentloaded' });

    // Wait for the seeded outline to render.
    await page.waitForSelector('[role="tree"]', { timeout: 30000 });
    await page.waitForFunction(() => document.body.innerText.includes('Wireframes'), null, { timeout: 30000 });

    // Dismiss any first-run / onboarding modal overlay that would intercept clicks.
    for (let i = 0; i < 4; i++) {
      const overlay = await page.$('div[data-state="open"][aria-hidden="true"]');
      if (!overlay) break;
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }

    // Baseline: everything visible.
    const base = await visibleTexts(page);
    for (const n of Object.keys(base)) {
      if (!base[n]) failures.push(`Baseline: expected "${n}" visible but it was not`);
    }

    // 2) Open the tag filter and select "urgent".
    await page.click('[data-testid="tag-filter-toggle"]');
    await page.waitForSelector('[data-testid="tag-filter-panel"]', { timeout: 10000 });
    // Click the "urgent" chip inside the panel.
    await page.click('[data-testid="tag-filter-panel"] >> text=urgent');
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOT_DIR}/filter-by-tag.png`, fullPage: false });

    const filtered = await visibleTexts(page);
    // Should show: Design, Wireframes, Development, API (matches + ancestors).
    ['Design', 'Wireframes', 'Development', 'API'].forEach(n => {
      if (!filtered[n]) failures.push(`Filtered: expected "${n}" visible but it was hidden`);
    });
    // Should hide: Mockups, Frontend, Marketing (non-matching, non-ancestor).
    ['Mockups', 'Frontend', 'Marketing'].forEach(n => {
      if (filtered[n]) failures.push(`Filtered: expected "${n}" hidden but it was visible`);
    });

    // 3) Clear the filter.
    await page.click('[data-testid="tag-filter-clear"]');
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOT_DIR}/filter-cleared.png`, fullPage: false });

    const cleared = await visibleTexts(page);
    for (const n of Object.keys(cleared)) {
      if (!cleared[n]) failures.push(`Cleared: expected "${n}" visible again but it was hidden`);
    }

    console.log('VISIBLE_BASELINE', JSON.stringify(base));
    console.log('VISIBLE_FILTERED', JSON.stringify(filtered));
    console.log('VISIBLE_CLEARED', JSON.stringify(cleared));
  } catch (e) {
    failures.push('EXCEPTION: ' + (e && e.message ? e.message : String(e)));
    try { await page.screenshot({ path: `${SHOT_DIR}/filter-error.png` }); } catch {}
  } finally {
    await browser.close();
  }

  if (failures.length) {
    console.log('RESULT: FAIL');
    failures.forEach(f => console.log('  - ' + f));
    process.exit(1);
  } else {
    console.log('RESULT: PASS — tag filter shows matches+ancestors, clear restores full outline');
    process.exit(0);
  }
})();
