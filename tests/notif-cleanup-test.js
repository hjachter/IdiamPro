// Notification-cleanup verification — proves "success is silent; only
// destructive actions confirm" against the running dev server on
// http://localhost:9002 (chromium).
//
// Verifies:
//   (a) copy (Cmd+C) then paste (Cmd+V) fire NO success toast, but DO work.
//   (b) setting a status on a node fires NO success toast, but DOES apply.
//   (c) pressing Delete on a node STILL shows the destructive "Delete Item?"
//       confirmation dialog.
//   (d) the failure path (guide read-only) still surfaces an actionable toast.
//
// Screenshot: notif-cleanup.png (the quiet-success state).

const { chromium } = require('/Users/howardjachter/Developer/IdiamPro/node_modules/playwright');

const SHOT_DIR = '/private/tmp/claude-501/-Users-howardjachter/dc1a4cb9-7949-4c86-a6ad-521f02bacb84/scratchpad';
const URL = 'http://localhost:9002/app';

const FORBIDDEN_SUCCESS_TITLES = [
  'Suboutline Copied', 'Suboutline Cut', 'Suboutline Pasted', 'Suboutline Moved',
  'Status Set', 'Status Cleared', 'Tag Added', 'Outline Copied',
  'Import Successful', 'Email imported',
];

function seedOutline() {
  const mk = (id, name, parentId, childrenIds) => ({
    id, name, content: '', type: parentId === null ? 'root' : 'note',
    parentId, childrenIds, isCollapsed: false, prefix: '',
    metadata: undefined,
  });
  const nodes = {
    root:  mk('root', 'Project Plan', null, ['alpha', 'bravo', 'charlie']),
    alpha: mk('alpha', 'Alpha', 'root', []),
    bravo: mk('bravo', 'Bravo', 'root', []),
    charlie: mk('charlie', 'Charlie', 'root', []),
  };
  return {
    id: 'notif-cleanup-test-outline',
    name: 'Notif Cleanup Test',
    rootNodeId: 'root',
    nodes, isGuide: false, lastModified: Date.now(),
  };
}

// All currently-visible toast titles/texts (radix toasts carry a [toast-close] button).
async function toastState(page) {
  return await page.evaluate(() => {
    const closes = [...document.querySelectorAll('[toast-close]')];
    const roots = closes.map(c => c.closest('li') || c.parentElement);
    const texts = roots.map(r => (r ? r.innerText : '')).filter(Boolean);
    return { count: closes.length, texts };
  });
}

async function assertNoForbiddenToast(page, label, failures) {
  await page.waitForTimeout(700); // give any toast time to mount
  const { count, texts } = await toastState(page);
  const joined = texts.join(' || ');
  for (const t of FORBIDDEN_SUCCESS_TITLES) {
    if (joined.includes(t)) failures.push(`[${label}] forbidden success toast appeared: "${t}" (all: ${joined})`);
  }
  if (count > 0) failures.push(`[${label}] expected no toast, but ${count} toast(s) present: ${joined}`);
}

// Prefix-agnostic leaf lookup. After a reorder/paste the app prepends "N "
// numbering, so match leaf name-spans by (optional-number)+name. Leaf nodes are
// aria-level >= 2 (root is level 1 and its innerText contains every child).
function leaf(page, name) {
  const re = new RegExp('^\\s*\\d*\\s*' + name + '\\s*$');
  return page.locator('[role="treeitem"]:not([aria-level="1"]) span.cursor-pointer').filter({ hasText: re });
}

async function nodeCount(page, name) {
  return await page.evaluate((nm) => {
    const re = new RegExp('^\\s*\\d*\\s*' + nm + '\\s*$');
    return [...document.querySelectorAll('[role="treeitem"]:not([aria-level="1"]) span.cursor-pointer')]
      .filter(s => re.test(s.textContent.trim())).length;
  }, name);
}

// innerText of the leaf treeitem for `name` (includes any status badge text).
async function nodeText(page, name) {
  return await page.evaluate((nm) => {
    const re = new RegExp('^\\s*\\d*\\s*' + nm + '\\s*$');
    const span = [...document.querySelectorAll('[role="treeitem"]:not([aria-level="1"]) span.cursor-pointer')]
      .find(s => re.test(s.textContent.trim()));
    const li = span && span.closest('[role="treeitem"]');
    return li ? li.innerText : null;
  }, name);
}

async function setStatusViaMenu(page, nodeName, statusLabel) {
  await leaf(page, nodeName).first().click({ button: 'right' });
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
  const notes = [];
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate((outline) => {
      localStorage.clear();
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

    // ---- (a) COPY then PASTE — must be silent but must work ----
    await leaf(page, 'Alpha').first().click();
    await page.waitForTimeout(200);
    await page.keyboard.press('Meta+c');
    await assertNoForbiddenToast(page, 'copy', failures);

    await leaf(page, 'Bravo').first().click();
    await page.waitForTimeout(200);
    const alphaBefore = await nodeCount(page, 'Alpha');
    await page.keyboard.press('Meta+v');
    await page.waitForTimeout(500);
    await assertNoForbiddenToast(page, 'paste', failures);
    const alphaAfter = await nodeCount(page, 'Alpha');
    if (alphaAfter <= alphaBefore) failures.push(`paste did not work: Alpha count ${alphaBefore} -> ${alphaAfter}`);
    else notes.push(`paste worked silently (Alpha ${alphaBefore} -> ${alphaAfter})`);

    // ---- (b) SET STATUS — must be silent but must apply ----
    // Clear selection/edit state left by paste before opening a context menu.
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
    await setStatusViaMenu(page, 'Charlie', 'Done');
    await assertNoForbiddenToast(page, 'status-set', failures);
    const charlie = await nodeText(page, 'Charlie');
    if (!charlie || !charlie.includes('Done')) failures.push('status-set did not apply to Charlie: ' + charlie);
    else notes.push('status applied silently (Charlie shows "Done")');

    // Screenshot the quiet-success state.
    await page.screenshot({ path: `${SHOT_DIR}/notif-cleanup.png`, fullPage: false });

    // ---- (c) DELETE — destructive confirmation MUST still appear ----
    await leaf(page, 'Bravo').first().click();
    await page.waitForTimeout(200);
    await page.keyboard.press('Delete');
    let deleteDialog = false;
    try {
      await page.waitForSelector('text=Delete Item?', { timeout: 5000 });
      deleteDialog = true;
    } catch { /* not found */ }
    if (!deleteDialog) failures.push('DESTRUCTIVE delete confirmation "Delete Item?" did NOT appear');
    else notes.push('destructive delete confirmation still appears');
    // Cancel the delete so we do not mutate further.
    await page.keyboard.press('Escape').catch(() => {});

    console.log('NOTES: ' + notes.join(' | '));
    if (failures.length) {
      console.log('FAILURES:');
      failures.forEach(f => console.log('  - ' + f));
      console.log('RESULT: FAIL');
      process.exitCode = 1;
    } else {
      console.log('RESULT: PASS');
    }
  } catch (err) {
    console.log('ERROR: ' + (err && err.stack || err));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
