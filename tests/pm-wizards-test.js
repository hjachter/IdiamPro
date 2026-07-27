// Project-management REPORT wizards test — PURE LOGIC, NO AI.
// Drives the "Project Management" report group inside the Wizards gallery
// against the running dev server on http://localhost:9002 (chromium).
//
// Verifies (with the Project Management capability ON):
//   • the PM report group is visible in the Wizards gallery
//   • "What's Blocking Me" produces a note listing the blocked task + its blocker
//   • "Completed" produces a note listing the Done tasks
//   • no existing task is modified (statuses unchanged after running reports)
//
// Screenshot: pm-wizards.png

const { chromium } = require('/Users/howardjachter/Developer/IdiamPro/node_modules/playwright');

const SHOT_DIR = '/private/tmp/claude-501/-Users-howardjachter/dc1a4cb9-7949-4c86-a6ad-521f02bacb84/scratchpad';
const URL = 'http://localhost:9002/app';

function seedOutline() {
  const mk = (id, name, parentId, childrenIds, tags, prerequisites) => ({
    id, name, content: '', type: parentId === null ? 'root' : 'task',
    parentId, childrenIds, isCollapsed: false, prefix: '',
    metadata: (tags || prerequisites) ? { tags, prerequisites } : undefined,
  });
  const nodes = {
    root: mk('root', 'PM Wizards Test', null, ['t1', 't2', 't3', 't4'], undefined, undefined),
    t1: mk('t1', 'Design API', 'root', [], ['Done'], undefined),
    t2: mk('t2', 'Build backend', 'root', [], ['In progress'], ['t1']),
    // t3 depends on t2 (In progress, NOT Done) -> blocked by "Build backend".
    t3: mk('t3', 'Ship release', 'root', [], ['Not started'], ['t2']),
    t4: mk('t4', 'Write tests', 'root', [], ['Done'], undefined),
  };
  return {
    id: 'pm-wizards-test-outline',
    name: 'PM Wizards Test',
    rootNodeId: 'root',
    nodes, isGuide: false, lastModified: Date.now(),
  };
}

async function openWizards(page) {
  await page.click('[aria-label="AI menu"]');
  await page.waitForSelector('[role="menu"]', { timeout: 8000 });
  await page.getByRole('menuitem', { name: 'Wizards' }).click();
  await page.waitForSelector('[data-testid="pm-report-blocking"]', { timeout: 8000 });
}

// Read the current outline back from localStorage and return the content of any
// note whose name starts with `titlePrefix` (the generated report node).
async function reportContent(page, titlePrefix) {
  return await page.evaluate((prefix) => {
    const raw = localStorage.getItem('outline-pro-data');
    if (!raw) return null;
    const data = JSON.parse(raw);
    const outline = (data.outlines || []).find(o => o.id === 'pm-wizards-test-outline');
    if (!outline) return null;
    const node = Object.values(outline.nodes).find(n => (n.name || '').startsWith(prefix));
    return node ? node.content : null;
  }, titlePrefix);
}

async function taskStatuses(page) {
  return await page.evaluate(() => {
    const raw = localStorage.getItem('outline-pro-data');
    const data = JSON.parse(raw);
    const outline = data.outlines.find(o => o.id === 'pm-wizards-test-outline');
    const pick = (id) => (outline.nodes[id].metadata && outline.nodes[id].metadata.tags) || [];
    return { t1: pick('t1'), t2: pick('t2'), t3: pick('t3'), t4: pick('t4') };
  });
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
      // Turn the Project Management capability ON (+ consent) so the report group shows.
      localStorage.setItem('capabilities.projectManagement.enabled', 'true');
      localStorage.setItem('capabilities.projectManagement.consent', 'granted');
    }, seedOutline());
    await page.goto(URL, { waitUntil: 'domcontentloaded' });

    await page.waitForSelector('[role="tree"]', { timeout: 30000 });
    await page.waitForFunction(() => document.body.innerText.includes('Ship release'), null, { timeout: 30000 });

    // Dismiss any onboarding overlay.
    for (let i = 0; i < 4; i++) {
      const overlay = await page.$('div[data-state="open"][aria-hidden="true"]');
      if (!overlay) break;
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }

    // 1) Open Wizards; the PM report group must be visible.
    await openWizards(page);
    await page.screenshot({ path: `${SHOT_DIR}/pm-wizards.png`, fullPage: false });

    // 2) Run "What's Blocking Me".
    await page.click('[data-testid="pm-report-blocking"]');
    await page.waitForTimeout(800);
    const blockingName = await page.evaluate(() =>
      [...document.querySelectorAll('[role="treeitem"] span')].some(s => /What's Blocking Me/.test(s.textContent)));
    if (!blockingName) failures.push('"What\'s Blocking Me" report node was not created in the outline tree');
    const blockingBody = await reportContent(page, "What's Blocking Me");
    if (!blockingBody || !blockingBody.includes('Ship release')) failures.push('Blocking report should list the blocked task "Ship release"; got: ' + blockingBody);
    if (!blockingBody || !blockingBody.includes('Build backend')) failures.push('Blocking report should name the blocker "Build backend"; got: ' + blockingBody);

    // 3) Run "Completed".
    await openWizards(page);
    await page.click('[data-testid="pm-report-completed"]');
    await page.waitForTimeout(800);
    const completedBody = await reportContent(page, 'Completed —');
    if (!completedBody || !completedBody.includes('Design API')) failures.push('Completed report should list Done task "Design API"; got: ' + completedBody);
    if (!completedBody || !completedBody.includes('Write tests')) failures.push('Completed report should list Done task "Write tests"; got: ' + completedBody);
    if (completedBody && completedBody.includes('Ship release')) failures.push('Completed report must NOT list the not-Done "Ship release"');

    // 4) Reports must NOT modify existing tasks — statuses unchanged.
    const st = await taskStatuses(page);
    if (!st.t1.includes('Done')) failures.push('Task t1 status changed (should still be Done)');
    if (!st.t2.includes('In progress')) failures.push('Task t2 status changed (should still be In progress)');
    if (!st.t3.includes('Not started')) failures.push('Task t3 status changed (should still be Not started)');
    if (!st.t4.includes('Done')) failures.push('Task t4 status changed (should still be Done)');

    await page.screenshot({ path: `${SHOT_DIR}/pm-wizards-done.png`, fullPage: false });
  } catch (e) {
    failures.push('EXCEPTION: ' + (e && e.message ? e.message : String(e)));
    try { await page.screenshot({ path: `${SHOT_DIR}/pm-wizards-error.png` }); } catch {}
  } finally {
    await browser.close();
  }

  if (failures.length) {
    console.log('RESULT: FAIL');
    failures.forEach(f => console.log('  - ' + f));
    process.exit(1);
  } else {
    console.log('RESULT: PASS — PM report group visible; Blocking + Completed reports correct; no tasks modified');
    process.exit(0);
  }
})();
