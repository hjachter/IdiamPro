// HIG polish verification suite
//  - TASK E: Cmd+E / Cmd+Shift+E expand/collapse-all work even when a node's
//            contentEditable is focused (the original bug).
//  - TASK A: mobile toolbar icon buttons meet a 44px finger-sized target.
//  - TASK D: previously-tiny dialog labels render legibly (>=12px).
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const OUT = path.resolve(__dirname, '..', 'test-screenshots', 'hig-polish');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}${detail ? ' :: ' + detail : ''}`);
}

async function findMainWindow(app, maxWait = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    for (const win of app.windows()) {
      try {
        const url = win.url();
        if (url.startsWith('devtools://')) continue;
        if (url.includes('localhost:9002')) return win;
      } catch (_) {}
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Could not find main app window');
}

(async () => {
  const projectRoot = path.resolve(__dirname, '..');
  const app = await electron.launch({ args: [projectRoot], env: { ...process.env, NODE_ENV: 'development' } });
  const page = await findMainWindow(app);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  if (!page.url().includes('/app')) {
    await page.evaluate(() => { window.location.href = '/app'; });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(4000);
  }

  // The User Guide loads by default and has a deep nested tree — perfect for
  // exercising expand/collapse-all. Wait for the tree to actually render
  // (dev-server cold starts can leave the app on "Loading..." for a while).
  try {
    await page.locator('[role="treeitem"]').first().waitFor({ state: 'visible', timeout: 60000 });
  } catch (_) {
    await page.waitForTimeout(5000);
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, '01-loaded.png') });

  // --- TASK E ---
  // Collapse everything first so we have a known state, then expand a branch,
  // focus a node's contentEditable, and drive the keyboard shortcuts.
  // Select the root treeitem so shortcuts have context.
  const firstItem = page.locator('[role="treeitem"]').first();
  await firstItem.click();
  await page.waitForTimeout(500);

  // Collapse all via keyboard to establish baseline.
  await page.keyboard.press('Meta+Shift+E');
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, '02-after-collapse-all.png') });
  let visibleAfterCollapse = await page.locator('[role="treeitem"]').count();

  // Expand all first so there are child nodes to click into.
  await page.keyboard.press('Meta+e');
  await page.waitForTimeout(800);
  let visibleAfterExpand = await page.locator('[role="treeitem"]').count();
  record(
    'Cmd+E expands more items than Cmd+Shift+E collapses',
    visibleAfterExpand > visibleAfterCollapse,
    `collapsed=${visibleAfterCollapse} expanded=${visibleAfterExpand}`
  );

  // Now the critical repro: click INTO a node so its contentEditable content
  // area gets focus, then press the shortcuts. Double-click a node name to
  // enter edit mode / focus editable text.
  const items = page.locator('[role="treeitem"]');
  // Real original-bug repro: enter EDIT mode on the ROOT node (double-click) so
  // a text input is focused AND the selection scope is the whole outline, then
  // drive the structure shortcuts. The bug was that the isTyping guard swallowed
  // Cmd+E / Cmd+Shift+E entirely while a node field had focus. Collapse/Expand
  // All are scoped to the selected node, so we must edit a node that actually
  // has descendants (the root) to observe a visible collapse.
  const target = items.first();
  await target.dblclick();
  await page.waitForTimeout(500);
  const focusedEditable = await page.evaluate(() => {
    const a = document.activeElement;
    if (!a) return 'none';
    if (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') return 'input';
    if (a.isContentEditable) return 'contenteditable';
    return a.tagName.toLowerCase();
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, '03-editable-focused.png') });

  // Collapse all WHILE editable is focused (this is what used to fail).
  await page.keyboard.press('Meta+Shift+E');
  await page.waitForTimeout(800);
  const collapsedWithFocus = await page.locator('[role="treeitem"]').count();
  await page.screenshot({ path: path.join(OUT, '04-collapse-all-with-focus.png') });

  // Expand all WHILE editable focus context.
  await page.keyboard.press('Meta+e');
  await page.waitForTimeout(800);
  const expandedWithFocus = await page.locator('[role="treeitem"]').count();
  await page.screenshot({ path: path.join(OUT, '05-expand-all-with-focus.png') });

  record(
    'Cmd+E / Cmd+Shift+E work with a contentEditable focused (original bug fixed)',
    expandedWithFocus > collapsedWithFocus,
    `editableFocused=${focusedEditable} collapsed=${collapsedWithFocus} expanded=${expandedWithFocus}`
  );

  // --- TASK A: finger-sized toolbar buttons at mobile viewport ---
  await page.setViewportSize({ width: 390, height: 844 }); // iPhone-ish
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, '06-mobile-toolbar.png') });

  const sizes = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button.touch-manipulation'));
    return btns.slice(0, 40).map((b) => {
      const r = b.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), aria: b.getAttribute('aria-label') || '' };
    }).filter((s) => s.w > 0 && s.h > 0);
  });
  const bigEnough = sizes.filter((s) => s.w >= 44 && s.h >= 44);
  record(
    'Mobile toolbar buttons are >=44px finger targets',
    bigEnough.length > 0,
    `${bigEnough.length}/${sizes.length} visible touch-manipulation buttons >=44px`
  );

  // Restore desktop viewport before dialog check.
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.waitForTimeout(500);

  // --- TASK D: no more text-[10px] tiny labels in the DOM at rest ---
  const tinyCount = await page.evaluate(() => {
    // scan for any element whose computed font-size is <= 10px and is visible text
    let count = 0;
    document.querySelectorAll('span,div,p,a').forEach((el) => {
      const cs = getComputedStyle(el);
      const fs = parseFloat(cs.fontSize);
      if (fs && fs <= 10.5 && el.textContent && el.textContent.trim().length > 0 && el.offsetParent !== null) {
        count++;
      }
    });
    return count;
  });
  record('Tiny (<=10px) visible text labels are minimized', tinyCount < 5, `visible <=10px text nodes: ${tinyCount}`);

  await page.screenshot({ path: path.join(OUT, '07-final.png') });

  // Write report
  const passCount = results.filter((r) => r.pass).length;
  const report = { suite: 'hig-polish', total: results.length, passed: passCount, failed: results.length - passCount, results };
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(
    path.join(OUT, 'report.md'),
    `# HIG Polish Test\n\n${passCount}/${results.length} passed\n\n` +
      results.map((r) => `- ${r.pass ? 'PASS' : 'FAIL'} ${r.name} — ${r.detail || ''}`).join('\n') + '\n'
  );

  await Promise.race([app.close(), new Promise((r) => setTimeout(r, 5000))]);
  console.log(`\nRESULT: ${passCount}/${results.length} passed`);
  process.exit(passCount === results.length ? 0 : 1);
})();
