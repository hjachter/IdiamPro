// "Show Me" NL views test — drives the P3 natural-language filtering feature
// against the running dev server on http://localhost:9002 (web/chromium),
// following the tag-filter-test.js pattern (seed localStorage, no Electron).
//
// Covers the full user journey:
//   1. NL request → visible, editable criteria rows (AI parse MOCKED via the
//      documented window.__nlViewsMockParse test seam — no AI spend).
//   2. 1988 spec presentation: matches + ancestors unfold; other branches are
//      COMPRESSED BUT VISIBLE rows (never hidden), chevron-openable.
//   3. Editing a criterion row updates the result.
//   4. Save as a named view; clear; close; reopen panel; open saved view →
//      criteria restored and re-evaluated against current data.
//   5. LIVE-ness: renaming a node so it matches makes the count/highlight
//      update immediately (a lens over current data, not a snapshot).
//   6. Light + dark screenshots.
//
// Screenshots + report: test-screenshots/nl-views/

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SHOT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'nl-views');
const URL = 'http://localhost:9002/app';

fs.mkdirSync(SHOT_DIR, { recursive: true });

function seedOutline() {
  const aug10 = new Date(2026, 7, 10).getTime();
  const jul2 = new Date(2026, 6, 2).getTime();
  const aug20 = new Date(2026, 7, 20).getTime();
  const mk = (id, name, parentId, childrenIds, extra = {}) => ({
    id, name, content: extra.content || '', type: extra.type || (parentId === null ? 'root' : 'note'),
    parentId, childrenIds, isCollapsed: false, prefix: '',
    metadata: extra.metadata,
  });
  const nodes = {
    root: mk('root', 'Product Plan', null, ['design', 'eng', 'mkt']),
    design: mk('design', 'Design', 'root', ['dhome', 'dlogo', 'mock']),
    dhome: mk('dhome', 'Design homepage', 'design', [], { type: 'task', metadata: { isCompleted: false, tags: ['design'], createdAt: aug10 } }),
    dlogo: mk('dlogo', 'Design logo', 'design', [], { type: 'task', metadata: { isCompleted: true, tags: ['design'], createdAt: jul2 } }),
    mock: mk('mock', 'Mockups', 'design', [], { content: '<p>old sketches</p>' }),
    eng: mk('eng', 'Engineering', 'root', ['apisrv']),
    apisrv: mk('apisrv', 'API server', 'eng', [], { content: '<p>build the backend API</p>' }),
    mkt: mk('mkt', 'Marketing', 'root', ['press', 'blog']),
    press: mk('press', 'Press release', 'mkt', [], { metadata: { tags: ['legal'], createdAt: aug20 } }),
    blog: mk('blog', 'Blog post', 'mkt', []),
  };
  return {
    id: 'nl-views-test-outline',
    name: 'NL Views Test',
    rootNodeId: 'root',
    nodes,
    isGuide: false,
    lastModified: Date.now(),
  };
}

async function visibleNames(page) {
  return await page.evaluate(() => {
    const names = ['Design', 'Design homepage', 'Design logo', 'Mockups', 'Engineering', 'API server', 'Marketing', 'Press release', 'Blog post'];
    const tree = document.querySelector('[role="tree"]');
    const txt = tree ? tree.innerText : '';
    const out = {};
    names.forEach(n => { out[n] = txt.includes(n); });
    return out;
  });
}

async function matchCount(page) {
  const el = await page.$('[data-testid="view-match-count"]');
  if (!el) return null;
  const text = await el.innerText();
  const m = text.match(/Showing (\d+) matching/);
  if (m) return parseInt(m[1], 10);
  if (/No items match/.test(text)) return 0;
  return null;
}

async function dismissOverlays(page) {
  for (let i = 0; i < 4; i++) {
    const overlay = await page.$('div[data-state="open"][aria-hidden="true"]');
    if (!overlay) break;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
}

async function openShowMePanel(page) {
  await page.click('[aria-label="AI menu"]');
  await page.waitForSelector('[data-testid="ai-menu-show-me"]', { timeout: 10000 });
  await page.click('[data-testid="ai-menu-show-me"]');
  await page.waitForSelector('[data-testid="view-panel"]', { timeout: 10000 });
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // Test seam: mock the NL→criteria AI parse so the suite spends nothing and
  // is deterministic. The real parse path is the same code minus this hook.
  await context.addInitScript(() => {
    window.__nlViewsMockParse = (request) => ({
      matchMode: 'all',
      criteria: [
        { field: 'anyText', operator: 'contains', value: 'design' },
        { field: 'completed', operator: 'is', value: 'no' },
      ],
    });
    try { window.localStorage.setItem('onboarding:welcomeShowcaseSeen', 'true'); } catch {}
  });
  const page = await context.newPage();
  const failures = [];
  const results = [];
  const step = (name, ok, detail) => {
    results.push({ name, ok, detail: detail || '' });
    if (!ok) failures.push(`${name}${detail ? ' — ' + detail : ''}`);
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ' — ' + detail : ''}`);
  };

  try {
    // 1) Seed and load.
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate((outline) => {
      localStorage.setItem('outline-pro-data', JSON.stringify({ outlines: [outline] }));
      localStorage.setItem('idiampro-current-outline-id', outline.id);
      localStorage.removeItem('ideam-saved-views-v1');
    }, seedOutline());
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[role="tree"]', { timeout: 30000 });
    await page.waitForFunction(() => document.body.innerText.includes('Blog post'), null, { timeout: 30000 });
    await dismissOverlays(page);
    step('Seeded outline renders', true);

    // 2) Open the Show Me panel from the AI menu.
    await openShowMePanel(page);
    step('Show Me panel opens from AI menu', true);

    // 3) NL request → criteria rows (mocked parse; noted in report).
    await page.fill('[data-testid="view-nl-input"]', 'show me unfinished design work');
    await page.press('[data-testid="view-nl-input"]', 'Enter');
    await page.waitForSelector('[data-testid="view-row"]', { timeout: 10000 });
    await page.waitForTimeout(600);
    const rowCount = await page.locator('[data-testid="view-row"]').count();
    step('NL request produced criteria rows', rowCount === 2, `rows=${rowCount} (AI parse MOCKED via test seam)`);

    const row0Field = await page.locator('[data-testid="view-row"]').nth(0).locator('[data-testid="view-row-field"]').inputValue();
    const row0Value = await page.locator('[data-testid="view-row"]').nth(0).locator('[data-testid="view-row-value"]').inputValue();
    const row1Field = await page.locator('[data-testid="view-row"]').nth(1).locator('[data-testid="view-row-field"]').inputValue();
    step('Criteria rows are visible and inspectable',
      row0Field === 'anyText' && row0Value === 'design' && row1Field === 'completed',
      `row0=${row0Field}:"${row0Value}" row1=${row1Field}`);

    // Matches: "Design" (branch, name contains design, not completed) +
    // "Design homepage" (task, not completed). "Design logo" is completed.
    const count1 = await matchCount(page);
    step('Live match count shows 2', count1 === 2, `count=${count1}`);

    // 4) 1988 spec presentation: matches + ancestors unfold; other branches
    // COMPRESSED BUT VISIBLE (rows remain; children folded away).
    const vis1 = await visibleNames(page);
    const compressOk =
      vis1['Design'] && vis1['Design homepage'] &&      // match branch open
      vis1['Engineering'] && vis1['Marketing'] &&        // non-match rows STILL VISIBLE (never hidden)
      !vis1['API server'] && !vis1['Press release'] && !vis1['Blog post']; // their children folded
    step('1988 reshape: matches unfold, other branches compressed but visible', compressOk, JSON.stringify(vis1));

    // Chevron-openable: expand Marketing manually — search/view must never block navigation.
    await page.evaluate(() => {
      const span = Array.from(document.querySelectorAll('[role="tree"] span'))
        .find(s => s.innerText.trim().endsWith('Marketing'));
      const li = span && span.closest('li');
      const chevron = li && li.querySelector('button[aria-label="Expand"]');
      if (chevron) chevron.click();
    });
    await page.waitForTimeout(500);
    const vis1b = await visibleNames(page);
    step('Compressed branch is chevron-openable (navigation never blocked)', vis1b['Blog post'] === true, JSON.stringify(vis1b));

    await page.screenshot({ path: `${SHOT_DIR}/1-nl-interpreted-light.png` });

    // 5) EDIT a criterion row → results update.
    await page.locator('[data-testid="view-row"]').nth(0).locator('[data-testid="view-row-value"]').fill('API');
    await page.waitForTimeout(700);
    const count2 = await matchCount(page);
    const vis2 = await visibleNames(page);
    step('Editing a criterion updates the result', count2 === 1 && vis2['API server'] === true, `count=${count2} apiVisible=${vis2['API server']}`);
    await page.screenshot({ path: `${SHOT_DIR}/2-criterion-edited-light.png` });

    // 6) Save as a named view.
    await page.fill('[data-testid="view-save-name"]', 'Open API work');
    await page.click('[data-testid="view-save-btn"]');
    await page.waitForSelector('[data-testid="view-saved-chip"]', { timeout: 5000 });
    step('View saved as named chip', true);

    // 7) Clear, close, reopen panel, reopen saved view → re-evaluates.
    await page.click('[data-testid="view-clear"]');
    await page.waitForTimeout(400);
    const rowsAfterClear = await page.locator('[data-testid="view-row"]').count();
    step('Clear removes criteria rows', rowsAfterClear === 0, `rows=${rowsAfterClear}`);
    await page.click('[data-testid="view-close"]');
    await page.waitForTimeout(300);
    const panelGone = (await page.locator('[data-testid="view-panel"]').count()) === 0;
    step('Panel closes', panelGone);

    await openShowMePanel(page);
    await page.waitForSelector('[data-testid="view-saved-chip"]', { timeout: 5000 });
    await page.click('[data-testid="view-saved-chip"]');
    await page.waitForTimeout(700);
    const rowsReopened = await page.locator('[data-testid="view-row"]').count();
    const count3 = await matchCount(page);
    step('Saved view reopens and re-evaluates against current data', rowsReopened === 2 && count3 === 1, `rows=${rowsReopened} count=${count3}`);
    await page.screenshot({ path: `${SHOT_DIR}/3-saved-view-reopened-light.png` });

    // 8) LIVE-ness: rename "Blog post" → "API blog post"; the open view's
    // count/highlights must update immediately (lens, not snapshot).
    const blogVisible = await page.evaluate(() => document.querySelector('[role="tree"]').innerText.includes('Blog post'));
    if (!blogVisible) {
      // Marketing may be folded again by the saved-view reshape — reopen it
      // via its own chevron (perfectly legal under the 1988 spec).
      await page.evaluate(() => {
        const span = Array.from(document.querySelectorAll('[role="tree"] span'))
          .find(s => s.innerText.trim().endsWith('Marketing'));
        const li = span && span.closest('li');
        const chevron = li && li.querySelector('button[aria-label="Expand"]');
        if (chevron) chevron.click();
      });
      await page.waitForTimeout(400);
    }
    await page.locator('[role="tree"] >> text=Blog post').first().dblclick();
    await page.waitForTimeout(400);
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+a' : 'Control+a');
    await page.keyboard.type('API blog post');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);
    const count4 = await matchCount(page);
    const highlighted = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('[role="tree"] span'))
        .filter(s => s.className && String(s.className).includes('bg-yellow-100'))
        .map(s => s.innerText.trim());
    });
    const liveOk = count4 === 2 && highlighted.some(t => t.includes('API blog post'));
    step('LIVE-ness: new matching item is counted + highlighted immediately', liveOk, `count=${count4} highlighted=${JSON.stringify(highlighted)}`);
    await page.screenshot({ path: `${SHOT_DIR}/4-liveness-light.png` });

    // 9) Dark mode screenshot.
    await page.evaluate(() => { try { localStorage.setItem('theme', 'dark'); } catch {} });
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[role="tree"]', { timeout: 30000 });
    await dismissOverlays(page);
    await openShowMePanel(page);
    await page.waitForSelector('[data-testid="view-saved-chip"]', { timeout: 5000 }).catch(() => {});
    const chipDark = await page.locator('[data-testid="view-saved-chip"]').count();
    if (chipDark > 0) {
      await page.click('[data-testid="view-saved-chip"]');
      await page.waitForTimeout(700);
    }
    step('Saved view persists across reload (dark mode)', chipDark > 0, `chips=${chipDark}`);
    await page.screenshot({ path: `${SHOT_DIR}/5-panel-dark.png` });
  } catch (e) {
    failures.push('EXCEPTION: ' + (e && e.message ? e.message : String(e)));
    try { await page.screenshot({ path: `${SHOT_DIR}/error.png` }); } catch {}
  } finally {
    await browser.close();
  }

  const report = {
    suite: 'nl-views',
    ranAt: new Date().toISOString(),
    aiParse: 'MOCKED via window.__nlViewsMockParse test seam (no AI spend; deterministic)',
    results,
    failures,
    pass: failures.length === 0,
  };
  fs.writeFileSync(path.join(SHOT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(SHOT_DIR, 'report.md'),
    `# NL Views (Show Me) test\n\n${report.pass ? 'PASS' : 'FAIL'} — ${new Date().toISOString()}\n\n` +
    results.map(r => `- ${r.ok ? '✅' : '❌'} ${r.name}${r.detail ? ` (${r.detail})` : ''}`).join('\n') +
    (failures.length ? `\n\n## Failures\n${failures.map(f => `- ${f}`).join('\n')}` : '') + '\n');

  if (failures.length) {
    console.log('RESULT: FAIL');
    failures.forEach(f => console.log('  - ' + f));
    process.exit(1);
  } else {
    console.log('RESULT: PASS — NL → editable criteria → live reshaped view → saved view reopen all verified');
    process.exit(0);
  }
})();
