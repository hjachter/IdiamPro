/**
 * bug-report-test.js — Playwright suite for the in-app Report Issue feature.
 *
 * Covers (extended 2026-06-25):
 *   1. Toolbar entry: button visible, opens dialog, submits cleanly.
 *   2. Help-menu entry: opens the SAME dialog from the More tools overflow.
 *   3. Real submission path: submit a bug via the toolbar entry to the live
 *      API (POST /api/bugs/submit), confirm the admin list shows it.
 *   4. Progress notes admin flow: open the bug detail, edit progress notes,
 *      save, reload the page, confirm the notes persisted.
 *
 * The first scenario (toolbar entry + form mechanics) still uses a route
 * intercept so it never depends on email/SMTP being configured.
 * The "real submission" scenario does NOT intercept — it walks through the
 * live API/storage stack so the admin-list and progress-notes verification
 * has a real record to operate on.
 */

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const REPORT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'bug-report');
if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

const results = [];
function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' (' + detail + ')' : ''}`);
}

let electronApp;
let page;

async function findMainWindow(electronApp, maxWait = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    for (const win of electronApp.windows()) {
      try {
        const url = win.url();
        if (url.startsWith('devtools://')) continue;
        if (url.includes('localhost:9002')) return win;
      } catch { /* ignore */ }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Could not find main app window');
}

async function shoot(name) {
  try {
    await page.screenshot({ path: path.join(REPORT_DIR, `${name}.png`), fullPage: false });
  } catch (err) {
    console.warn(`screenshot failed for ${name}:`, err.message);
  }
}

const TOOLBAR_DESC_TEXT =
  'Something is wrong with the outline pane when I click rapidly.';
const HELP_MENU_DESC_TEXT =
  'Opened from the Help menu — same dialog wired through the overflow entry.';
const LIVE_SUBMIT_DESC_TEXT =
  'Live end-to-end submission for the admin/progress-notes test path.';
const PROGRESS_NOTES_TEXT =
  'Looked at the reproduction, suspect a stale event handler; need to check OutlinePane click delegation.';

async function dismissAllToasts() {
  // Close any visible toast so it doesn't obscure dialogs / menus.
  // The Radix Toast close button isn't always reachable by aria-label, so
  // also nuke the entire notification region from the DOM as a fallback.
  try {
    const closeBtns = page.locator(
      'li[data-radix-collection-item] button[toast-close], li[data-radix-collection-item] button:has(svg)',
    );
    const count = await closeBtns.count();
    for (let i = 0; i < count; i++) {
      const btn = closeBtns.nth(i);
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ force: true }).catch(() => {});
      }
    }
  } catch { /* ignore */ }
  // Brute-force fallback: remove every existing toast LI from the
  // notification region so they can't intercept pointer events. We
  // leave the region itself alone so future toasts can still render.
  try {
    await page.evaluate(() => {
      const region = document.querySelector('[aria-label="Notifications (F8)"]');
      if (!region) return;
      region.querySelectorAll('li[data-radix-collection-item]').forEach((li) => {
        li.remove();
      });
    });
  } catch { /* ignore */ }
}

async function main() {
  console.log('Launching Electron...');
  electronApp = await electron.launch({
    args: [path.resolve(__dirname, '..')],
    env: { ...process.env, NODE_ENV: 'development' },
  });

  page = await findMainWindow(electronApp);
  page.on('dialog', (d) => { d.dismiss().catch(() => {}); });

  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2500);

  if (!page.url().includes('/app')) {
    console.log('Navigating to /app...');
    await page.evaluate(() => { window.location.href = '/app'; });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3500);
  }

  // ----- Scenario A — toolbar button with intercepted submit ----------------

  // Intercept the first submit so this scenario never depends on email/SMTP.
  let interceptedPayload = null;
  await page.route('**/api/bugs/submit', async (route, request) => {
    try {
      interceptedPayload = JSON.parse(request.postData() ?? '{}');
    } catch {
      interceptedPayload = null;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, bugId: 'test-bug-id-toolbar' }),
    });
  });

  await page.waitForTimeout(1500);
  await shoot('01-app-loaded');
  const toolbarButton = page.locator('[data-testid="report-issue-button"]').first();
  const toolbarVisible = await toolbarButton.isVisible().catch(() => false);
  record('Report Issue button is visible in the toolbar', toolbarVisible);
  if (!toolbarVisible) {
    const toolbarSnippet = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button[aria-label]')).map(
        (b) => b.getAttribute('aria-label'),
      );
      return buttons.slice(0, 60).join(' | ');
    });
    console.log('Diagnostic — visible aria-labels:', toolbarSnippet);
    await teardown();
    finishAndExit();
    return;
  }

  await toolbarButton.click();
  await page.waitForTimeout(500);
  const dialog = page.locator('[data-testid="report-issue-dialog"]').first();
  const dialogOpen = await dialog.isVisible().catch(() => false);
  record('Toolbar button opens the report dialog', dialogOpen);
  await shoot('02-toolbar-dialog-open');

  const descA = page.locator('[data-testid="bug-description"]').first();
  await descA.fill(TOOLBAR_DESC_TEXT);
  const ctxA = page.locator('[data-testid="bug-context"]').first();
  await ctxA.fill('I was trying to drag a node into a new parent.');
  await shoot('03-toolbar-form-filled');

  const submitA = page.locator('[data-testid="bug-submit"]').first();
  const submitAEnabled = await submitA.isEnabled().catch(() => false);
  record('Send report enables once description is valid (toolbar)', submitAEnabled);
  await submitA.click();
  await page.waitForTimeout(1000);

  const payloadOk =
    interceptedPayload &&
    typeof interceptedPayload.description === 'string' &&
    interceptedPayload.description.length >= 10 &&
    ['fyi', 'annoying', 'blocking'].includes(interceptedPayload.severity);
  record(
    'Toolbar submit POSTs a well-formed payload to /api/bugs/submit',
    Boolean(payloadOk),
    JSON.stringify(interceptedPayload ?? {}).slice(0, 200),
  );

  const toastA = page.getByText('Thanks — Howard will look at this.', { exact: false }).first();
  const toastAVisible = await toastA.isVisible({ timeout: 5000 }).catch(() => false);
  record('Toolbar submit shows success toast', toastAVisible);
  await shoot('04-toolbar-after-submit');

  await page.waitForTimeout(500);
  const toolbarDialogStillOpen = await dialog.isVisible().catch(() => false);
  record('Toolbar dialog closes after successful submission', !toolbarDialogStillOpen);

  await dismissAllToasts();
  await page.waitForTimeout(300);

  // ----- Scenario B — Help-menu entry opens the SAME dialog -----------------
  // The "More tools" overflow button is gated to phone/tablet widths in the
  // production layout, but the dropdown is implemented as a Radix component
  // so we open it directly by triggering its known menu item via aria. Easier:
  // shrink the viewport so the overflow becomes the active container, OR look
  // for the menu item by test id regardless of visibility.
  //
  // The menu item only renders inside the Radix dropdown when it's open. The
  // most reliable cross-width approach is: resize so the overflow menu is
  // present in the toolbar, click it open, then click the report-issue menu
  // item.

  await page.setViewportSize({ width: 600, height: 900 }); // forces phone tier
  await page.waitForTimeout(500);

  // The overflow trigger has aria-label "More tools" per the toolbar code.
  const overflow = page.locator('button[aria-label*="More tools" i]').first();
  let overflowVisible = await overflow.isVisible().catch(() => false);
  if (!overflowVisible) {
    // Fallback: it might be labeled MoreHorizontal-only — try the icon's
    // parent button on the right-hand side.
    const fallback = page.locator('button:has(svg.lucide-more-horizontal), button:has(svg[class*="more-horizontal"])').first();
    overflowVisible = await fallback.isVisible().catch(() => false);
    if (overflowVisible) await fallback.click();
  } else {
    await overflow.click();
  }
  await page.waitForTimeout(500);
  await shoot('05-help-menu-open');

  const menuItem = page.locator('[data-testid="report-issue-menu-item"]').first();
  const menuItemVisible = await menuItem.isVisible().catch(() => false);
  record('Report Issue item is present in the Help / More tools menu', menuItemVisible);

  if (menuItemVisible) {
    // The Radix dropdown can render partially below the viewport at narrow
    // widths in Electron, even though aria reports it visible. Dispatch
    // the click directly on the underlying element to bypass viewport
    // checks. The onSelect handler in ReportIssueMenuItem opens the dialog.
    await menuItem.evaluate((el) => el.click());
    await page.waitForTimeout(500);
    const dialogB = page.locator('[data-testid="report-issue-dialog"]').first();
    const dialogBOpen = await dialogB.isVisible().catch(() => false);
    record('Help-menu entry opens the same report dialog', dialogBOpen);
    await shoot('06-help-menu-dialog-open');

    // Fill out something and submit (still intercepted route from earlier).
    if (dialogBOpen) {
      const descB = page.locator('[data-testid="bug-description"]').first();
      await descB.fill(HELP_MENU_DESC_TEXT);
      const submitB = page.locator('[data-testid="bug-submit"]').first();
      await submitB.click();
      await page.waitForTimeout(1000);
      const helpMenuPayloadOk =
        interceptedPayload &&
        interceptedPayload.description === HELP_MENU_DESC_TEXT;
      record(
        'Help-menu submit reuses the same submit pipeline',
        Boolean(helpMenuPayloadOk),
      );
      await shoot('07-help-menu-after-submit');
      await dismissAllToasts();
    }
  } else {
    record('Help-menu entry opens the same report dialog', false, 'menu item not visible');
    record('Help-menu submit reuses the same submit pipeline', false, 'menu item not visible');
  }

  await page.setViewportSize({ width: 1400, height: 900 }); // back to desktop
  await page.waitForTimeout(400);

  // ----- Scenario C — real end-to-end submission for admin path -------------
  // Stop intercepting so this one goes through the real API + storage.
  await page.unroute('**/api/bugs/submit');

  await toolbarButton.click();
  await page.waitForTimeout(500);
  const descC = page.locator('[data-testid="bug-description"]').first();
  await descC.fill(LIVE_SUBMIT_DESC_TEXT);
  const submitC = page.locator('[data-testid="bug-submit"]').first();
  await submitC.click();
  // Real submit — give the server a moment to persist + (best-effort) email.
  await page.waitForTimeout(2500);
  const toastC = page.getByText('Thanks — Howard will look at this.', { exact: false }).first();
  const liveToastVisible = await toastC.isVisible({ timeout: 5000 }).catch(() => false);
  record('Live submission to the real API succeeds', liveToastVisible);
  await shoot('08-live-submit');
  await dismissAllToasts();

  // ----- Scenario D — admin list + progress-notes round-trip --------------
  // Electron's main window is held to /app by the Capacitor-style app
  // shell; navigating it to /admin/bugs gets intercepted. Rather than
  // fight that, we open the admin page in a SECOND Playwright browser
  // window (chromium) hitting the same dev server. Same admin gate
  // (localStorage flag + matching header), same API, same end-to-end path.
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const adminCtx = await browser.newContext();
  // Seed the admin flag in the second context's storage before the page
  // loads, so the gate evaluates "true" on first render.
  await adminCtx.addInitScript(() => {
    try { window.localStorage.setItem('isAdmin', 'true'); } catch { /* ignore */ }
  });
  const adminPage = await adminCtx.newPage();
  await adminPage.goto('http://localhost:9002/admin/bugs', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await adminPage.waitForTimeout(3500);
  try {
    await adminPage.screenshot({
      path: path.join(REPORT_DIR, '09-admin-bugs-list.png'),
      fullPage: false,
    });
  } catch { /* ignore */ }

  const liveRow = adminPage.locator('[data-testid="bug-row"]', {
    hasText: LIVE_SUBMIT_DESC_TEXT.slice(0, 40),
  }).first();
  const liveRowVisible = await liveRow.isVisible({ timeout: 8000 }).catch(() => false);
  record('Admin bugs page lists the newly submitted report', liveRowVisible);

  if (liveRowVisible) {
    const viewDetails = liveRow.locator('button', { hasText: 'View details' }).first();
    await viewDetails.click();
    await adminPage.waitForTimeout(1500);
    try {
      await adminPage.screenshot({
        path: path.join(REPORT_DIR, '10-admin-detail-open.png'),
        fullPage: false,
      });
    } catch { /* ignore */ }

    const notesArea = adminPage.locator('[data-testid="bug-progress-notes"]').first();
    const notesAreaVisible = await notesArea.isVisible({ timeout: 5000 }).catch(() => false);
    record('Progress notes textarea is present in admin detail panel', notesAreaVisible);

    if (notesAreaVisible) {
      await notesArea.fill(PROGRESS_NOTES_TEXT);
      const saveBtn = adminPage.locator('[data-testid="bug-progress-notes-save"]').first();
      await saveBtn.click();
      await adminPage.waitForTimeout(1500);
      try {
        await adminPage.screenshot({
          path: path.join(REPORT_DIR, '11-admin-progress-notes-saved.png'),
          fullPage: false,
        });
      } catch { /* ignore */ }

      // Reload the admin page and confirm the value persisted.
      await adminPage.goto('http://localhost:9002/admin/bugs', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await adminPage.waitForTimeout(3000);
      const liveRowAfter = adminPage.locator('[data-testid="bug-row"]', {
        hasText: LIVE_SUBMIT_DESC_TEXT.slice(0, 40),
      }).first();
      const stillThere = await liveRowAfter.isVisible({ timeout: 5000 }).catch(() => false);
      if (stillThere) {
        const viewAgain = liveRowAfter.locator('button', { hasText: 'View details' }).first();
        await viewAgain.click();
        await adminPage.waitForTimeout(1500);
        const notesAreaAfter = adminPage.locator('[data-testid="bug-progress-notes"]').first();
        const reloadedVal = await notesAreaAfter.inputValue().catch(() => '');
        record(
          'Progress notes persist across reload',
          reloadedVal === PROGRESS_NOTES_TEXT,
          reloadedVal.slice(0, 80),
        );
        try {
          await adminPage.screenshot({
            path: path.join(REPORT_DIR, '12-admin-progress-notes-after-reload.png'),
            fullPage: false,
          });
        } catch { /* ignore */ }
      } else {
        record('Progress notes persist across reload', false, 'row missing after reload');
      }
    } else {
      record('Progress notes persist across reload', false, 'notes textarea not visible');
    }
  } else {
    record('Progress notes textarea is present in admin detail panel', false, 'no row to open');
    record('Progress notes persist across reload', false, 'no row to open');
  }

  await browser.close().catch(() => {});

  await teardown();
  finishAndExit();
}

async function teardown() {
  if (!electronApp) return;
  await Promise.race([
    electronApp.close().catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);
}

function finishAndExit() {
  const report = {
    suite: 'bug-report',
    when: new Date().toISOString(),
    results,
    passed: results.filter((r) => r.pass).length,
    failed: results.filter((r) => !r.pass).length,
  };
  fs.writeFileSync(path.join(REPORT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  const md = [
    `# Bug report UI — ${report.when}`,
    ``,
    `Passed: ${report.passed} / ${report.results.length}`,
    ``,
    ...report.results.map((r) => `- ${r.pass ? 'PASS' : 'FAIL'} — ${r.name}${r.detail ? '\n  - ' + r.detail : ''}`),
  ].join('\n');
  fs.writeFileSync(path.join(REPORT_DIR, 'report.md'), md);
  process.exit(report.failed === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  try {
    await shoot('99-fatal');
  } catch { /* ignore */ }
  await teardown();
  process.exit(1);
});
