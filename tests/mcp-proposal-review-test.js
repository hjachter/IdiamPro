// MCP proposal review test (P8 slice B) — proves EXTERNAL AGENT PROPOSALS
// (sidecar files written by the IdeaM MCP server) surface inside the app's
// unified Proposed Changes review engine and that the full loop closes:
// outside AI proposes → owner sees it in the standard review → approve /
// reject / dismiss → the decision is written back to the sidecar.
//
// Coverage:
//   (a) discovery: the Import button shows the quiet dot + "Suggestions (N)"
//       menu entry with the correct count
//   (b) the suggestions list renders each kind with agent label + plain-
//       English description; the STALE one shows the stale notice and offers
//       only Dismiss
//   (c) add    → provisional green Pending node → Approve inserts → Undo works
//   (d) delete → amber "Will delete" marks with blast radius → Reject leaves
//       the data intact
//   (e) rewrite → Before/After comparison → Approve applies the new content
//   (f) move   → sky "Will move" mark + old→new parent card → Approve moves
//   (g) stale rewrite → Dismiss only
//   (h) resolutions land in the sidecar; a fully-resolved sidecar is pruned
//   (i) a _proposed-outlines draft previews and imports as a NEW outline
//
// SAFETY: runs against a TEMP outlines directory via the test-only
// IDEAM_OUTLINES_DIR_OVERRIDE env var — the user's real outlines are never
// touched. NO BACKGROUND TASKS. Foreground synchronous run only.

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { prepareApp, setElectronWindowSize } = require('./_helpers');

const OUT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'mcp-proposal-review');
fs.mkdirSync(OUT_DIR, { recursive: true });

// ── Temp outlines dir + seeded fixtures ──────────────────────────────────────

const TMP_DIR = path.join(os.tmpdir(), 'ideam-mcp-proposal-review');
const OUTLINE_FILE = 'Citrus Plan.idm';
const SIDECAR_FILE = `${OUTLINE_FILE}.proposals.json`;
const DRAFTS_DIR = path.join(TMP_DIR, '_proposed-outlines');
const DRAFTS_INDEX = path.join(DRAFTS_DIR, '_proposals.json');
const DRAFT_FILE = path.join(DRAFTS_DIR, 'Project Notes.idm');

const OUTLINE_ID = 'mcp-test-outline';
const IDS = {
  root: 'n-root', citrus: 'n-citrus', orange: 'n-orange',
  oldIdeas: 'n-oldideas', staleLeaf: 'n-staleleaf',
  launch: 'n-launch', renamed: 'n-renamed',
  moveMe: 'n-moveme', targetSection: 'n-target',
};

function mkNode(id, name, parentId, childrenIds, type, content = '') {
  return { id, name, content, type, parentId, childrenIds, isCollapsed: false, prefix: '' };
}

function seedTempDir() {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  fs.mkdirSync(DRAFTS_DIR, { recursive: true });

  const outline = {
    id: OUTLINE_ID,
    name: 'Citrus Plan',
    rootNodeId: IDS.root,
    lastModified: Date.now(),
    nodes: {
      [IDS.root]: mkNode(IDS.root, 'Citrus Plan', null, [IDS.citrus, IDS.oldIdeas, IDS.launch, IDS.renamed, IDS.moveMe, IDS.targetSection], 'root'),
      [IDS.citrus]: mkNode(IDS.citrus, 'Citrus', IDS.root, [IDS.orange], 'chapter'),
      [IDS.orange]: mkNode(IDS.orange, 'Orange', IDS.citrus, [], 'document'),
      [IDS.oldIdeas]: mkNode(IDS.oldIdeas, 'Old ideas', IDS.root, [IDS.staleLeaf], 'chapter'),
      [IDS.staleLeaf]: mkNode(IDS.staleLeaf, 'Stale leaf', IDS.oldIdeas, [], 'document'),
      [IDS.launch]: mkNode(IDS.launch, 'Launch week', IDS.root, [], 'document', '<p>Old body</p>'),
      [IDS.renamed]: mkNode(IDS.renamed, 'Renamed since', IDS.root, [], 'document', '<p>Current body</p>'),
      [IDS.moveMe]: mkNode(IDS.moveMe, 'Move me', IDS.root, [], 'document'),
      [IDS.targetSection]: mkNode(IDS.targetSection, 'Target section', IDS.root, [], 'document'),
    },
  };
  fs.writeFileSync(path.join(TMP_DIR, OUTLINE_FILE), JSON.stringify(outline, null, 2));

  const now = new Date().toISOString();
  const base = { createdAt: now, agent: 'Claude Desktop', outlineFileName: OUTLINE_FILE, status: 'pending' };
  const sidecar = [
    { ...base, id: 'prop-add', kind: 'add_node', targetNodeId: IDS.citrus,
      targetNodePath: 'Citrus Plan > Citrus',
      payload: { parentId: IDS.citrus, name: 'Lemon', content: '<p>A sour one</p>', position: null } },
    { ...base, id: 'prop-rewrite', kind: 'rewrite_node', targetNodeId: IDS.launch,
      targetNodePath: 'Citrus Plan > Launch week',
      payload: { content: '<p>New body</p>', previous: { name: 'Launch week', content: '<p>Old body</p>' } } },
    { ...base, id: 'prop-delete', kind: 'delete_node', targetNodeId: IDS.oldIdeas,
      targetNodePath: 'Citrus Plan > Old ideas',
      payload: { nodeName: 'Old ideas', descendantCount: 1 } },
    { ...base, id: 'prop-stale', kind: 'rewrite_node', targetNodeId: IDS.renamed,
      targetNodePath: 'Citrus Plan > Renamed since',
      payload: { content: '<p>Never applies</p>', previous: { name: 'Renamed since', content: '<p>Snapshot that no longer matches</p>' } } },
    { ...base, id: 'prop-move', kind: 'move_node', targetNodeId: IDS.moveMe,
      targetNodePath: 'Citrus Plan > Move me',
      payload: { newParentId: IDS.targetSection, newParentPath: 'Citrus Plan > Target section', position: 0, previousParentId: IDS.root } },
  ];
  fs.writeFileSync(path.join(TMP_DIR, SIDECAR_FILE), JSON.stringify(sidecar, null, 2));

  const draft = {
    id: 'draft-project-notes',
    name: 'Project Notes',
    rootNodeId: 'pn-root',
    nodes: {
      'pn-root': mkNode('pn-root', 'Project Notes', null, ['pn-a', 'pn-b'], 'root'),
      'pn-a': mkNode('pn-a', 'Meeting notes', 'pn-root', [], 'document'),
      'pn-b': mkNode('pn-b', 'Action items', 'pn-root', [], 'document'),
    },
  };
  fs.writeFileSync(DRAFT_FILE, JSON.stringify(draft, null, 2));
  fs.writeFileSync(DRAFTS_INDEX, JSON.stringify([
    { id: 'prop-new-outline', createdAt: now, agent: 'Claude Desktop', kind: 'new_outline',
      outlineFileName: 'Project Notes.idm', targetNodeId: null, targetNodePath: null,
      payload: { name: 'Project Notes', draftFileName: 'Project Notes.idm', draftFolder: '_proposed-outlines', rootNodeId: 'pn-root' },
      status: 'pending' },
  ], null, 2));
}

function readSidecar(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch { return null; }
}

// Poll for a disk condition (resolutions are written fire-and-forget).
async function waitForDisk(checkFn, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { if (checkFn()) return true; } catch {}
    await new Promise(r => setTimeout(r, 300));
  }
  try { return !!checkFn(); } catch { return false; }
}

// ── Report plumbing ──────────────────────────────────────────────────────────

const report = { suite: 'mcp-proposal-review', started: new Date().toISOString(), steps: [], pass: false };
function step(name, ok, extra) {
  report.steps.push({ name, ok, ...(extra || {}) });
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${extra ? ' ' + JSON.stringify(extra) : ''}`);
}

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

async function findMainWindow(app, maxWait = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    for (const win of app.windows()) {
      try {
        const url = win.url();
        if (url.startsWith('devtools://')) continue;
        if (url.includes('localhost:9002')) return win;
      } catch {}
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('Could not find main app window');
}

async function nodePresent(page, name) {
  return (await page.locator(`[role="treeitem"] span:text-is("${name}")`).count()) > 0;
}

async function openSuggestionsList(page) {
  // Import toolbar button → "Suggestions (N)" entry.
  await page.locator('button[aria-label="Import"]').first().click();
  const item = page.locator('[data-testid="menu-agent-suggestions"]');
  await item.first().waitFor({ state: 'visible', timeout: 8000 });
  const label = (await item.first().innerText()).trim();
  await item.first().click();
  try {
    await page.locator('[data-testid="agent-suggestions-dialog"]').waitFor({ state: 'visible', timeout: 8000 });
  } catch (e) {
    await page.screenshot({ path: path.join(OUT_DIR, 'debug-menu-fail.png'), fullPage: true }).catch(() => {});
    const bodySnippet = await page.evaluate(() => document.body.innerText.slice(0, 600)).catch(() => '');
    console.log('DEBUG body after Suggestions click:', JSON.stringify(bodySnippet));
    throw e;
  }
  await page.waitForTimeout(400);
  return label;
}

async function setDark(page, dark) {
  await page.evaluate((d) => {
    document.documentElement.classList.toggle('dark', d);
  }, dark);
  await page.waitForTimeout(350);
}

(async () => {
  let app;
  let restoreOutlineId = null;
  try {
    seedTempDir();
    step('seeded temp outlines dir + sidecars + draft', fs.existsSync(path.join(TMP_DIR, SIDECAR_FILE)));

    const projectRoot = path.resolve(__dirname, '..');
    app = await electron.launch({
      args: [projectRoot],
      env: { ...process.env, NODE_ENV: 'development', IDEAM_OUTLINES_DIR_OVERRIDE: TMP_DIR },
    });
    const page = await findMainWindow(app);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2500);
    if (!page.url().includes('/app')) {
      await page.evaluate(() => { window.location.href = '/app'; });
      await page.waitForLoadState('domcontentloaded');
    }
    await prepareApp(page);

    // Force the seeded outline current (the shared dev profile may remember a
    // different outline id), then reload so boot picks it up cleanly. The
    // previous value is captured and restored at the end so the user's own
    // session isn't left pointing at a test outline.
    const previousOutlineId = await page.evaluate((oid) => {
      const prev = window.localStorage.getItem('idiampro-current-outline-id');
      window.localStorage.setItem('idiampro-current-outline-id', oid);
      return prev;
    }, OUTLINE_ID);
    restoreOutlineId = async () => {
      try {
        await page.evaluate((prev) => {
          if (prev) window.localStorage.setItem('idiampro-current-outline-id', prev);
          else window.localStorage.removeItem('idiampro-current-outline-id');
        }, previousOutlineId);
      } catch {}
    };
    // Use Playwright's own reload so no navigation is left "pending" (a manual
    // window.location.reload() leaves the driver waiting on navigation forever).
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await prepareApp(page);
    await setElectronWindowSize(app, 1500, 950);
    await page.waitForTimeout(1500);

    const outlineLoaded = await nodePresent(page, 'Citrus');
    step('seeded outline "Citrus Plan" is open', outlineLoaded, { outlineLoaded });

    // (a) DISCOVERY — quiet dot on the Import button.
    const dotVisible = await page.locator('[data-testid="agent-suggestions-dot"]').first()
      .waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
    step('discovery: quiet suggestions dot on Import button', dotVisible);
    await page.screenshot({ path: path.join(OUT_DIR, '01-dot-light.png'), fullPage: true });

    // (a) Import menu shows "Suggestions (6)"; list dialog shows all six kinds.
    const menuLabel = await openSuggestionsList(page);
    step('Import menu entry reads "Suggestions (6)"', /Suggestions \(6\)/.test(menuLabel), { menuLabel });

    const dlg = page.locator('[data-testid="agent-suggestions-dialog"]');
    const rowCount = await dlg.locator('li[data-testid^="agent-suggestion-"]').count();
    const dlgText = await dlg.innerText();
    const hasAgentLabel = dlgText.includes('Claude Desktop');
    const hasAddDesc = /suggests adding "Lemon" under "Citrus"/.test(dlgText);
    const hasDeleteDesc = /suggests removing "Old ideas"/.test(dlgText);
    const hasMoveDesc = /suggests moving "Move me" under "Target section"/.test(dlgText);
    const hasNewOutlineDesc = /brand-new outline: "Project Notes"/.test(dlgText);
    const hasStaleNotice = dlgText.includes('The outline changed since this was suggested');
    step('suggestion list: 6 rows, agent label + plain-English descriptions',
      rowCount === 6 && hasAgentLabel && hasAddDesc && hasDeleteDesc && hasMoveDesc && hasNewOutlineDesc,
      { rowCount, hasAgentLabel, hasAddDesc, hasDeleteDesc, hasMoveDesc, hasNewOutlineDesc });
    step('stale suggestion shows the stale notice', hasStaleNotice);

    // (b) stale row = the one containing "Renamed since": Dismiss only.
    const staleRow = dlg.locator('li[data-testid="agent-suggestion-rewrite_node"]', { hasText: 'Renamed since' });
    const staleHasReview = await staleRow.locator('button:has-text("Review")').count();
    const staleHasDismiss = await staleRow.locator('button:has-text("Dismiss")').count();
    step('stale suggestion offers only Dismiss (no Review)', staleHasReview === 0 && staleHasDismiss === 1,
      { staleHasReview, staleHasDismiss });

    await page.screenshot({ path: path.join(OUT_DIR, '02-list-light.png'), fullPage: true });
    await setDark(page, true);
    await page.screenshot({ path: path.join(OUT_DIR, '03-list-dark.png'), fullPage: true });
    await setDark(page, false);

    // (c) ADD — standard green provisional review, Approve inserts, Undo works.
    const addRow = dlg.locator('li[data-testid="agent-suggestion-add_node"]');
    await addRow.locator('button:has-text("Review")').first().click();
    const insertCard = page.locator('[aria-label="Confirm added items"]');
    await insertCard.locator('button:has-text("Add")').first().waitFor({ state: 'visible', timeout: 8000 });
    await page.waitForTimeout(400);
    const lemonProvisional = await nodePresent(page, 'Lemon');
    const pendingBadge = await page.locator('span:text-is("Pending")').count();
    step('add review: provisional "Lemon" with green Pending badge + review card',
      lemonProvisional && pendingBadge >= 1, { lemonProvisional, pendingBadge });
    await page.screenshot({ path: path.join(OUT_DIR, '04-add-review-light.png'), fullPage: true });
    await setDark(page, true);
    await page.screenshot({ path: path.join(OUT_DIR, '05-add-review-dark.png'), fullPage: true });
    await setDark(page, false);

    await insertCard.locator('button:has-text("Add")').first().click();
    await page.waitForTimeout(700);
    const lemonKept = await nodePresent(page, 'Lemon');
    const addApproved = await waitForDisk(() => {
      const sc = readSidecar(path.join(TMP_DIR, SIDECAR_FILE));
      return sc && sc.find(r => r.id === 'prop-add')?.status === 'approved';
    });
    step('add approved: Lemon inserted + sidecar records approved', lemonKept && addApproved, { lemonKept, addApproved });

    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z');
    await page.waitForTimeout(800);
    const lemonUndone = !(await nodePresent(page, 'Lemon'));
    step('undo reverses the approved add', lemonUndone, { lemonUndone });

    // (d) DELETE — amber marks with blast radius; Reject leaves data intact.
    await openSuggestionsList(page);
    await dlg.locator('li[data-testid="agent-suggestion-delete_node"] button:has-text("Review")').first().click();
    const deleteCard = page.locator('[aria-label="Confirm deletion"]');
    await deleteCard.locator('button:has-text("Delete")').first().waitFor({ state: 'visible', timeout: 8000 });
    await page.waitForTimeout(400);
    const willDeleteBadges = await page.locator('span:text-is("Will delete")').count();
    step('delete review: amber "Will delete" marks show the blast radius (target + descendant)',
      willDeleteBadges >= 2, { willDeleteBadges });
    await page.screenshot({ path: path.join(OUT_DIR, '06-delete-review-light.png'), fullPage: true });
    await deleteCard.locator('button:has-text("Keep")').first().click();
    await page.waitForTimeout(600);
    const oldIdeasIntact = await nodePresent(page, 'Old ideas');
    const staleLeafIntact = await nodePresent(page, 'Stale leaf');
    const deleteRejected = await waitForDisk(() => {
      const sc = readSidecar(path.join(TMP_DIR, SIDECAR_FILE));
      return sc && sc.find(r => r.id === 'prop-delete')?.status === 'rejected';
    });
    step('delete rejected: data intact + sidecar records rejected',
      oldIdeasIntact && staleLeafIntact && deleteRejected, { oldIdeasIntact, staleLeafIntact, deleteRejected });

    // (e) REWRITE — Before/After comparison; Approve applies new content.
    await openSuggestionsList(page);
    await dlg.locator('li[data-testid="agent-suggestion-rewrite_node"]', { hasText: 'Launch week' })
      .locator('button:has-text("Review")').first().click();
    const rewriteDlg = page.locator('[data-testid="agent-rewrite-review"]');
    await rewriteDlg.waitFor({ state: 'visible', timeout: 8000 });
    const rwText = await rewriteDlg.innerText();
    const showsBeforeAfter = rwText.includes('Old body') && rwText.includes('New body')
      && /Before/i.test(rwText) && /After/i.test(rwText);
    step('rewrite review: Before/After comparison with old + new content', showsBeforeAfter);
    await page.screenshot({ path: path.join(OUT_DIR, '07-rewrite-review-light.png'), fullPage: true });
    await rewriteDlg.locator('button:has-text("Approve")').first().click();
    await page.waitForTimeout(700);
    const launchContent = await page.evaluate(() => window.__ideamNodeContentByName ? window.__ideamNodeContentByName('Launch week') : null);
    const rewriteApproved = await waitForDisk(() => {
      const sc = readSidecar(path.join(TMP_DIR, SIDECAR_FILE));
      return sc && sc.find(r => r.id === 'prop-rewrite')?.status === 'approved';
    });
    step('rewrite approved: content applied + sidecar records approved',
      launchContent === '<p>New body</p>' && rewriteApproved, { launchContent, rewriteApproved });

    // (f) MOVE — sky "Will move" mark + old→new parent card; Approve moves.
    await openSuggestionsList(page);
    await dlg.locator('li[data-testid="agent-suggestion-move_node"] button:has-text("Review")').first().click();
    const moveCard = page.locator('[aria-label="Confirm move"]');
    await moveCard.locator('button:has-text("Move")').first().waitFor({ state: 'visible', timeout: 8000 });
    await page.waitForTimeout(400);
    const willMoveBadge = await page.locator('span:text-is("Will move")').count();
    const moveCardText = await moveCard.innerText();
    const moveCardExplains = moveCardText.includes('Move me') && moveCardText.includes('Target section');
    step('move review: sky "Will move" mark + card names old→new parent',
      willMoveBadge >= 1 && moveCardExplains, { willMoveBadge, moveCardExplains });
    await page.screenshot({ path: path.join(OUT_DIR, '08-move-review-light.png'), fullPage: true });
    await moveCard.locator('button:has-text("Move")').first().click();
    await page.waitForTimeout(700);
    const moveMeParent = await page.evaluate(() => window.__ideamNodeParentNameByName ? window.__ideamNodeParentNameByName('Move me') : null);
    const moveApproved = await waitForDisk(() => {
      const sc = readSidecar(path.join(TMP_DIR, SIDECAR_FILE));
      return sc && sc.find(r => r.id === 'prop-move')?.status === 'approved';
    });
    step('move approved: "Move me" now under "Target section" + sidecar records approved',
      moveMeParent === 'Target section' && moveApproved, { moveMeParent, moveApproved });

    // (g)+(h) STALE — Dismiss; sidecar becomes fully resolved and is PRUNED.
    await openSuggestionsList(page);
    await dlg.locator('li[data-testid="agent-suggestion-rewrite_node"]', { hasText: 'Renamed since' })
      .locator('button:has-text("Dismiss")').first().click();
    await page.waitForTimeout(600);
    const sidecarPruned = await waitForDisk(() => !fs.existsSync(path.join(TMP_DIR, SIDECAR_FILE)));
    const renamedContent = await page.evaluate(() => window.__ideamNodeContentByName ? window.__ideamNodeContentByName('Renamed since') : null);
    step('stale dismissed: nothing applied + fully-resolved sidecar pruned from disk',
      sidecarPruned && renamedContent === '<p>Current body</p>', { sidecarPruned, renamedContent });
    // Close the (still open) suggestions dialog before the next round.
    await dlg.locator('button:has-text("Close")').first().click().catch(() => {});
    await page.locator('[data-testid="agent-suggestions-dialog"]').waitFor({ state: 'hidden', timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(400);

    // (i) NEW OUTLINE draft — preview + "Add to my outlines" imports it.
    const menuLabel2 = await openSuggestionsList(page);
    step('after resolutions, count drops to the remaining draft: "Suggestions (1)"',
      /Suggestions \(1\)/.test(menuLabel2), { menuLabel2 });
    await dlg.locator('li[data-testid="agent-suggestion-new_outline"] button:has-text("Preview")').first().click();
    const draftDlg = page.locator('[data-testid="agent-draft-preview"]');
    await draftDlg.waitFor({ state: 'visible', timeout: 8000 });
    const draftText = await draftDlg.innerText();
    const draftPreviews = draftText.includes('Project Notes') && draftText.includes('Meeting notes') && draftText.includes('Action items');
    step('draft preview shows name + top-level structure', draftPreviews);
    await page.screenshot({ path: path.join(OUT_DIR, '09-draft-preview-light.png'), fullPage: true });
    await draftDlg.locator('[data-testid="agent-draft-add"]').first().click();
    await page.waitForTimeout(1000);
    const projectNotesOpen = await nodePresent(page, 'Meeting notes');
    const draftResolved = await waitForDisk(() =>
      !fs.existsSync(DRAFTS_INDEX) && !fs.existsSync(DRAFT_FILE)
    );
    step('draft imported as a NEW outline + drafts index pruned + draft file removed',
      projectNotesOpen && draftResolved, { projectNotesOpen, draftResolved });

    await page.screenshot({ path: path.join(OUT_DIR, '10-imported-outline.png'), fullPage: true });

    report.pass = report.steps.every(s => s.ok);
  } catch (e) {
    report.error = String((e && e.stack) || e);
    console.error(report.error);
  } finally {
    report.finished = new Date().toISOString();
    fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    if (restoreOutlineId) { await restoreOutlineId(); }
    if (app) { await Promise.race([app.close().catch(() => {}), new Promise(r => setTimeout(r, 5000))]); }
    console.log(`\n=== mcp-proposal-review: ${report.pass ? 'ALL PASS' : 'FAILURES'} ===`);
    process.exit(report.pass ? 0 : 1);
  }
})();
