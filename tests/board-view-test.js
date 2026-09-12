// BOARD VIEW test (P4 prototype, 2026-09-11) — proves the kanban board is a
// live PROJECTION of the outline, not a second data model:
//
//   (a) right-click a node → "Board View" opens; children render as columns
//       with correct headers + counts; grandchildren render as cards; an
//       empty column shows its drop-zone placeholder
//   (b) dragging a card to another column REPARENTS the node — verified in
//       the OUTLINE TREE (DOM ancestry) and on DISK (the autosaved .idm's
//       parentId/childrenIds — the single source of truth)
//   (c) Cmd+Z undoes the move — the card returns to its original column in
//       tree + disk
//   (d) opening Board View on a leaf node shows the friendly empty state
//   (e) light + dark screenshots for visual inspection
//
// SAFETY: runs against a TEMP outlines directory (IDEAM_OUTLINES_DIR_OVERRIDE)
// AND an ISOLATED Electron user-data dir (--user-data-dir), so the user's real
// outlines, localStorage, and any concurrently-running dev Electron instance
// are never touched. NO BACKGROUND TASKS — foreground synchronous run only.

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { prepareApp, setElectronWindowSize } = require('./_helpers');

const OUT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'board-view');
fs.mkdirSync(OUT_DIR, { recursive: true });

const TMP_DIR = path.join(os.tmpdir(), 'ideam-board-view-test');
const PROFILE_DIR = path.join(os.tmpdir(), 'ideam-board-view-test-profile');
const OUTLINE_ID = 'board-view-test-outline';
const OUTLINE_FILE = 'Board Demo.idm';

const IDS = {
  root: 'b-root',
  todo: 'b-todo',
  doing: 'b-doing',
  done: 'b-done',
  card1: 'b-card1',
  card2: 'b-card2',
  card3: 'b-card3',
};

function mkNode(id, name, parentId, childrenIds, type, metadata) {
  const n = { id, name, content: '', type, parentId, childrenIds, isCollapsed: false, prefix: '' };
  if (metadata) n.metadata = metadata;
  return n;
}

function seedTempDirs() {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });
  fs.mkdirSync(PROFILE_DIR, { recursive: true });

  const outline = {
    id: OUTLINE_ID,
    name: 'Board Demo',
    rootNodeId: IDS.root,
    lastModified: Date.now(),
    nodes: {
      [IDS.root]: mkNode(IDS.root, 'Board Demo', null, [IDS.todo, IDS.doing, IDS.done], 'root'),
      [IDS.todo]: mkNode(IDS.todo, 'To Do', IDS.root, [IDS.card1, IDS.card2], 'chapter'),
      [IDS.doing]: mkNode(IDS.doing, 'Doing', IDS.root, [IDS.card3], 'chapter'),
      [IDS.done]: mkNode(IDS.done, 'Done', IDS.root, [], 'document'),
      [IDS.card1]: mkNode(IDS.card1, 'Card One', IDS.todo, [], 'document',
        { tags: ['urgent'], color: 'red' }),
      [IDS.card2]: mkNode(IDS.card2, 'Card Two', IDS.todo, [], 'document'),
      [IDS.card3]: mkNode(IDS.card3, 'Card Three', IDS.doing, [], 'document'),
    },
  };
  fs.writeFileSync(path.join(TMP_DIR, OUTLINE_FILE), JSON.stringify(outline, null, 2));
}

// Read the autosaved outline back off disk — the single source of truth.
function readOutlineFromDisk() {
  // The app may rename the file on save (name-derived); scan all .idm files
  // for our outline id.
  for (const f of fs.readdirSync(TMP_DIR)) {
    if (!f.endsWith('.idm')) continue;
    try {
      const o = JSON.parse(fs.readFileSync(path.join(TMP_DIR, f), 'utf-8'));
      if (o && o.id === OUTLINE_ID) return o;
    } catch {}
  }
  return null;
}

async function waitFor(checkFn, timeoutMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { if (await checkFn()) return true; } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  try { return !!(await checkFn()); } catch { return false; }
}

const report = { suite: 'board-view', started: new Date().toISOString(), steps: [], pass: false };
function step(name, ok, extra) {
  report.steps.push({ name, ok, ...(extra || {}) });
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${extra ? ' ' + JSON.stringify(extra) : ''}`);
}

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

async function findMainWindow(app, maxWait = 45000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    for (const win of app.windows()) {
      try {
        const url = win.url();
        if (url.startsWith('devtools://')) continue;
        if (url.includes('localhost:9002')) return win;
      } catch {}
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Could not find main app window');
}

// Open Board View on the tree node with the given name via its context menu.
async function openBoardOn(page, nodeName) {
  const node = page.locator(`[role="treeitem"] span:text-is("${nodeName}")`).first();
  await node.waitFor({ state: 'visible', timeout: 8000 });
  await node.click({ button: 'right' });
  const item = page.locator('[role="menuitem"]:has-text("Board View")');
  await item.first().waitFor({ state: 'visible', timeout: 8000 });
  await item.first().click();
  await page.locator('[data-testid="board-view"]').waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForTimeout(400);
}

async function closeBoard(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page
    .locator('[data-testid="board-view"]')
    .waitFor({ state: 'hidden', timeout: 5000 })
    .catch(() => {});
  await page.waitForTimeout(300);
}

// Snapshot of the board's column → cards structure, straight from the DOM.
async function readBoardStructure(page) {
  return page.evaluate(() => {
    const out = [];
    document.querySelectorAll('[data-board-column]').forEach((col) => {
      const name = col.querySelector('span')?.textContent?.trim() || '';
      const count = col.querySelector('[data-board-column-count]')?.textContent?.trim() || '';
      const cards = Array.from(col.querySelectorAll('[data-board-card]')).map((c) =>
        (c.textContent || '').trim()
      );
      const hasEmptyZone = !!col.querySelector('[data-board-column-empty]');
      out.push({ name, count, cards, hasEmptyZone });
    });
    return out;
  });
}

// In the OUTLINE TREE, is the node named `childName` rendered inside the
// subtree of the treeitem named `parentName`? (DOM ancestry mirrors hierarchy.)
async function treeNodeUnder(page, childName, parentName) {
  return page.evaluate(({ childName, parentName }) => {
    // Node rows may carry a numbering prefix inside the name span (e.g.
    // "2.2Card Two" after a structural change), so match with the leading
    // numbering stripped as well as the exact text.
    const matches = (s, name) => {
      const t = s.textContent?.trim() || '';
      return t === name || t.replace(/^[\d.]+\s*/, '') === name;
    };
    const spans = Array.from(document.querySelectorAll('[role="treeitem"] span'));
    const childSpan = spans.find((s) => matches(s, childName));
    const parentSpan = spans.find((s) => matches(s, parentName));
    if (!childSpan || !parentSpan) return false;
    const childLi = childSpan.closest('[role="treeitem"]');
    const parentLi = parentSpan.closest('[role="treeitem"]');
    if (!childLi || !parentLi || childLi === parentLi) return false;
    // A treeitem's <li> contains its children's nested <ul role="group">, so
    // DOM containment mirrors outline hierarchy.
    return parentLi.contains(childLi);
  }, { childName, parentName });
}

// Synthetic HTML5 drag of a board card onto a board column's open space.
async function dragCardToColumn(page, cardId, columnId) {
  return page.evaluate(({ cardId, columnId }) => {
    const card = document.querySelector(`[data-board-card][data-node-id="${cardId}"]`);
    const col = document.querySelector(`[data-board-column][data-node-id="${columnId}"]`);
    if (!card || !col) return { ok: false, reason: 'element not found' };
    const dt = new DataTransfer();
    const rect = col.getBoundingClientRect();
    const opts = {
      bubbles: true,
      cancelable: true,
      dataTransfer: dt,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height - 20,
    };
    card.dispatchEvent(new DragEvent('dragstart', opts));
    col.dispatchEvent(new DragEvent('dragover', opts));
    col.dispatchEvent(new DragEvent('drop', opts));
    card.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: dt }));
    return { ok: true };
  }, { cardId, columnId });
}

async function setDark(page, dark) {
  await page.evaluate((d) => {
    document.documentElement.classList.toggle('dark', d);
  }, dark);
  await page.waitForTimeout(350);
}

(async () => {
  let app;
  try {
    seedTempDirs();
    step('seeded temp outlines dir + isolated profile', fs.existsSync(path.join(TMP_DIR, OUTLINE_FILE)));

    const projectRoot = path.resolve(__dirname, '..');
    app = await electron.launch({
      args: [projectRoot, `--user-data-dir=${PROFILE_DIR}`],
      env: {
        ...process.env,
        NODE_ENV: 'development',
        IDEAM_OUTLINES_DIR_OVERRIDE: TMP_DIR,
      },
    });
    const page = await findMainWindow(app);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2500);
    if (!page.url().includes('/app')) {
      await page.evaluate(() => { window.location.href = '/app'; });
      await page.waitForLoadState('domcontentloaded');
    }
    await prepareApp(page);

    // Make the seeded outline current, then reload so boot picks it up.
    await page.evaluate((oid) => {
      window.localStorage.setItem('idiampro-current-outline-id', oid);
    }, OUTLINE_ID);
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await prepareApp(page);
    await setElectronWindowSize(app, 1500, 950);
    await page.waitForTimeout(1500);

    const outlineLoaded = await waitFor(async () =>
      (await page.locator('[role="treeitem"] span:text-is("To Do")').count()) > 0
    );
    step('seeded outline "Board Demo" is open', outlineLoaded);
    if (!outlineLoaded) {
      await page.screenshot({ path: path.join(OUT_DIR, 'debug-no-outline.png'), fullPage: true });
      throw new Error('Seeded outline did not load');
    }

    // ── (a) Open Board View on the root; verify columns + cards + counts ──
    await openBoardOn(page, 'Board Demo');
    let board = await readBoardStructure(page);
    const colNames = board.map((c) => c.name);
    const todo = board.find((c) => c.name === 'To Do');
    const doing = board.find((c) => c.name === 'Doing');
    const done = board.find((c) => c.name === 'Done');
    step('board shows 3 columns in outline order', JSON.stringify(colNames) === JSON.stringify(['To Do', 'Doing', 'Done']), { colNames });
    step('To Do column: 2 cards (Card One, Card Two), count badge "2"',
      !!todo && todo.count === '2' && todo.cards.length === 2 &&
      todo.cards[0].includes('Card One') && todo.cards[1].includes('Card Two'),
      { todo });
    step('card chrome: Card One shows its tag', !!todo && /urgent/.test(todo.cards[0]), {});
    step('Doing column: 1 card (Card Three), count badge "1"',
      !!doing && doing.count === '1' && doing.cards.length === 1 && doing.cards[0].includes('Card Three'),
      { doing });
    step('Done column: empty, shows drop-zone placeholder',
      !!done && done.count === '0' && done.cards.length === 0 && done.hasEmptyZone,
      { done });

    await page.screenshot({ path: path.join(OUT_DIR, '01-board-light.png'), fullPage: true });

    // ── (b) Drag Card Two → Doing; board updates live ──
    const dragRes = await dragCardToColumn(page, IDS.card2, IDS.doing);
    step('synthetic drag dispatched', dragRes.ok, dragRes);
    const boardUpdated = await waitFor(async () => {
      const b = await readBoardStructure(page);
      const d = b.find((c) => c.name === 'Doing');
      const t = b.find((c) => c.name === 'To Do');
      return !!d && !!t && d.count === '2' && t.count === '1' &&
        d.cards.some((c) => c.includes('Card Two'));
    }, 8000);
    step('board updates live: Card Two now in Doing (2), To Do down to 1', boardUpdated);
    await page.screenshot({ path: path.join(OUT_DIR, '02-after-drag-light.png'), fullPage: true });

    // ── (b) SWITCH TO THE OUTLINE VIEW: the node actually reparented ──
    await closeBoard(page);
    const treeMoved = await waitFor(async () => {
      const underDoing = await treeNodeUnder(page, 'Card Two', 'Doing');
      const underTodo = await treeNodeUnder(page, 'Card Two', 'To Do');
      return underDoing && !underTodo;
    }, 8000);
    step('outline tree: Card Two now nested under Doing (not To Do)', treeMoved);
    await page.screenshot({ path: path.join(OUT_DIR, '03-outline-after-drag.png'), fullPage: true });

    // Disk (autosave) — the .idm on disk is the single source of truth.
    const diskMoved = await waitFor(() => {
      const o = readOutlineFromDisk();
      return !!o &&
        o.nodes[IDS.card2] && o.nodes[IDS.card2].parentId === IDS.doing &&
        o.nodes[IDS.doing].childrenIds.includes(IDS.card2) &&
        !o.nodes[IDS.todo].childrenIds.includes(IDS.card2);
    }, 15000);
    step('disk: autosaved .idm shows Card Two reparented under Doing', diskMoved);

    // ── (c) Cmd+Z returns the card ──
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z');
    const undone = await waitFor(async () => {
      const under = await treeNodeUnder(page, 'Card Two', 'To Do');
      const gone = await treeNodeUnder(page, 'Card Two', 'Doing');
      return under && !gone;
    }, 8000);
    step('Cmd+Z: Card Two back under To Do in the outline tree', undone);
    const diskUndone = await waitFor(() => {
      const o = readOutlineFromDisk();
      return !!o &&
        o.nodes[IDS.card2] && o.nodes[IDS.card2].parentId === IDS.todo &&
        o.nodes[IDS.todo].childrenIds.includes(IDS.card2);
    }, 15000);
    step('disk: undo persisted — Card Two back under To Do', diskUndone);

    // Board reflects the undo too (reopen it — it reads the live outline).
    await openBoardOn(page, 'Board Demo');
    board = await readBoardStructure(page);
    const todoAfterUndo = board.find((c) => c.name === 'To Do');
    step('reopened board reflects the undo (To Do back to 2 cards)',
      !!todoAfterUndo && todoAfterUndo.count === '2', { todoAfterUndo });
    await closeBoard(page);

    // ── (d) Empty state: Board View on a leaf node ──
    await openBoardOn(page, 'Card One');
    const emptyVisible = await page
      .locator('[data-testid="board-empty-state"]')
      .isVisible()
      .catch(() => false);
    const emptyText = await page
      .locator('[data-testid="board-empty-state"]')
      .innerText()
      .catch(() => '');
    step('leaf node: friendly empty state renders',
      emptyVisible && /no sub-sections yet/i.test(emptyText), { emptyText: emptyText.slice(0, 120) });
    await page.screenshot({ path: path.join(OUT_DIR, '04-empty-state-light.png'), fullPage: true });
    await closeBoard(page);

    // ── (e) Dark mode ──
    await setDark(page, true);
    await openBoardOn(page, 'Board Demo');
    await page.screenshot({ path: path.join(OUT_DIR, '05-board-dark.png'), fullPage: true });
    await closeBoard(page);
    await setDark(page, false);

    report.pass = report.steps.every((s) => s.ok);
  } catch (err) {
    console.error('SUITE ERROR:', err && err.message);
    report.error = String((err && err.message) || err);
    report.pass = false;
  } finally {
    try { if (app) await app.close(); } catch {}
  }

  report.finished = new Date().toISOString();
  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  const md = [
    `# Board View test — ${report.pass ? 'PASS' : 'FAIL'}`,
    '',
    ...report.steps.map((s) => `- ${s.ok ? '✅' : '❌'} ${s.name}`),
    report.error ? `\nSuite error: ${report.error}` : '',
  ].join('\n');
  fs.writeFileSync(path.join(OUT_DIR, 'report.md'), md);
  console.log(`\n${report.pass ? 'ALL PASS' : 'FAILURES PRESENT'} — report written to ${OUT_DIR}`);
  process.exit(report.pass ? 0 : 1);
})();
