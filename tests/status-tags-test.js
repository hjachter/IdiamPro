// Status-tag feature test — drives the reserved status set + context-menu
// assignment against the running dev server on http://localhost:9002 (chromium).
//
// Verifies: set a status on ONE node via the context menu; setting a different
// status REPLACES the old one (mutual exclusivity); bulk-set a status on a
// multiselection; and that statuses are filterable via the tag filter.
//
// Screenshot: status-tags.png

const { chromium } = require('/Users/howardjachter/Developer/IdiamPro/node_modules/playwright');

const SHOT_DIR = '/private/tmp/claude-501/-Users-howardjachter/dc1a4cb9-7949-4c86-a6ad-521f02bacb84/scratchpad';
const URL = 'http://localhost:9002/app';

function seedOutline() {
  const mk = (id, name, parentId, childrenIds) => ({
    id, name, content: '', type: parentId === null ? 'root' : 'note',
    parentId, childrenIds, isCollapsed: false, prefix: '',
    metadata: undefined,
  });
  const nodes = {
    root:  mk('root', 'Project Plan', null, ['alpha', 'bravo', 'charlie', 'delta']),
    alpha: mk('alpha', 'Alpha', 'root', []),
    bravo: mk('bravo', 'Bravo', 'root', []),
    charlie: mk('charlie', 'Charlie', 'root', []),
    delta: mk('delta', 'Delta', 'root', []),
  };
  return {
    id: 'status-tags-test-outline',
    name: 'Status Tags Test',
    rootNodeId: 'root',
    nodes, isGuide: false, lastModified: Date.now(),
  };
}

// Return the innerText of the leaf treeitem whose name span exactly matches `name`.
async function nodeText(page, name) {
  return await page.evaluate((nm) => {
    const spans = [...document.querySelectorAll('[role="treeitem"] span')];
    const span = spans.find(s => s.textContent.trim() === nm);
    if (!span) return null;
    const li = span.closest('[role="treeitem"]');
    return li ? li.innerText : null;
  }, name);
}

async function setStatusViaMenu(page, nodeName, statusLabel) {
  await page.getByText(nodeName, { exact: true }).click({ button: 'right' });
  await page.waitForSelector('[role="menu"]', { timeout: 8000 });
  await page.getByRole('menuitem', { name: 'Status' }).hover();
  await page.waitForTimeout(350);
  await page.getByRole('menuitem', { name: statusLabel, exact: true }).click();
  await page.waitForTimeout(500);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const failures = [];
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate((outline) => {
      localStorage.setItem('outline-pro-data', JSON.stringify({ outlines: [outline] }));
      localStorage.setItem('idiampro-current-outline-id', outline.id);
    }, seedOutline());
    await page.goto(URL, { waitUntil: 'domcontentloaded' });

    await page.waitForSelector('[role="tree"]', { timeout: 30000 });
    await page.waitForFunction(() => document.body.innerText.includes('Alpha'), null, { timeout: 30000 });

    // Dismiss any onboarding overlay.
    for (let i = 0; i < 4; i++) {
      const overlay = await page.$('div[data-state="open"][aria-hidden="true"]');
      if (!overlay) break;
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }

    // 1) Single node: set "In progress" on Alpha.
    await setStatusViaMenu(page, 'Alpha', 'In progress');
    let alpha = await nodeText(page, 'Alpha');
    if (!alpha || !alpha.includes('In progress')) failures.push('Alpha should show "In progress" after single set; got: ' + alpha);

    // 2) Mutual exclusivity: set "Done" on Alpha, must REPLACE "In progress".
    await setStatusViaMenu(page, 'Alpha', 'Done');
    alpha = await nodeText(page, 'Alpha');
    if (!alpha || !alpha.includes('Done')) failures.push('Alpha should show "Done" after replace; got: ' + alpha);
    if (alpha && alpha.includes('In progress')) failures.push('Mutual exclusivity FAILED: Alpha still shows "In progress" alongside "Done"');

    // 3) Bulk: multi-select Bravo + Charlie (Meta+click), then set "Not started".
    await page.getByText('Bravo', { exact: true }).click({ modifiers: ['Meta'] });
    await page.getByText('Charlie', { exact: true }).click({ modifiers: ['Meta'] });
    await page.waitForTimeout(300);
    // Right-click one of the selected nodes and apply status → should hit BOTH.
    await setStatusViaMenu(page, 'Bravo', 'Not started');
    const bravo = await nodeText(page, 'Bravo');
    const charlie = await nodeText(page, 'Charlie');
    if (!bravo || !bravo.includes('Not started')) failures.push('Bravo should show "Not started" after bulk set; got: ' + bravo);
    if (!charlie || !charlie.includes('Not started')) failures.push('Charlie (bulk) should show "Not started"; got: ' + charlie);

    // Clear the multiselection so the filter test is clean.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    await page.screenshot({ path: `${SHOT_DIR}/status-tags.png`, fullPage: false });

    // 4) Filter by status: open tag filter, pick "Done" → only Alpha (+root) shows.
    await page.click('[data-testid="tag-filter-toggle"]');
    await page.waitForSelector('[data-testid="tag-filter-panel"]', { timeout: 10000 });
    await page.click('[data-testid="tag-filter-panel"] >> text=Done');
    await page.waitForTimeout(700);

    const vis = await page.evaluate(() => {
      const tree = document.querySelector('[role="tree"]') || document.body;
      const txt = tree.innerText;
      return { Alpha: txt.includes('Alpha'), Bravo: txt.includes('Bravo'), Charlie: txt.includes('Charlie'), Delta: txt.includes('Delta') };
    });
    if (!vis.Alpha) failures.push('Filter "Done": Alpha should be visible');
    if (vis.Bravo) failures.push('Filter "Done": Bravo should be hidden');
    if (vis.Delta) failures.push('Filter "Done": Delta should be hidden');

    await page.screenshot({ path: `${SHOT_DIR}/status-tags-filtered.png`, fullPage: false });
    console.log('FILTER_VISIBLE', JSON.stringify(vis));
  } catch (e) {
    failures.push('EXCEPTION: ' + (e && e.message ? e.message : String(e)));
    try { await page.screenshot({ path: `${SHOT_DIR}/status-tags-error.png` }); } catch {}
  } finally {
    await browser.close();
  }

  if (failures.length) {
    console.log('RESULT: FAIL');
    failures.forEach(f => console.log('  - ' + f));
    process.exit(1);
  } else {
    console.log('RESULT: PASS — status set (single + bulk), mutual exclusivity, and status filtering all work');
    process.exit(0);
  }
})();
