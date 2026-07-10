/**
 * Backup Health Check Test (2026-07-10).
 *
 * Verifies the always-on backup watchdog (src/lib/health/backup-health.ts +
 * src/components/backup-health-watcher.tsx):
 *
 *   A. HAPPY PATH (backups healthy) — take a real manual backup of a THROWAWAY
 *      outline and confirm the success toast appears and NO "automatic backups
 *      aren't saving" warning is raised. The watchdog must stay silent when
 *      everything works (no nagging).
 *
 *   B. FAILURE PATH (backup silently fails) — flip the test hook
 *      window.__IDM_SIMULATE_BACKUP_FAILURE = true (which makes createSnapshot
 *      report a failure WITHOUT writing or risking any data), trigger a backup,
 *      and confirm the LOUD, persistent warning toast appears — and that it is
 *      dismissible.
 *
 * DATA SAFETY: never touches a real outline. A fresh "ZZ Backup Health" outline
 * is created for the whole run; its snapshot lands in that outline's own
 * isolated .backups folder.
 *
 * Screenshots -> test-screenshots/backup-health/
 * Report      -> test-screenshots/backup-health/report.{json,md}
 * Non-zero exit on hard failure.
 */

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

let electronApp;
let page;

const SCREENSHOT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'backup-health');
const results = {};

function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }

async function shot(name) {
  ensureDir(SCREENSHOT_DIR);
  try { await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`) }); } catch {}
}

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

async function run(name, fn) {
  console.log(`\n=== ${name} ===`);
  try {
    const r = await fn();
    results[name] = r;
    console.log(name, JSON.stringify(r));
  } catch (e) {
    results[name] = { pass: false, note: 'threw: ' + e.message };
    console.log(name, 'ERROR', e.message);
  }
}

async function launch() {
  const projectRoot = path.resolve(__dirname, '..');
  electronApp = await electron.launch({ args: [projectRoot], env: { ...process.env, NODE_ENV: 'development' } });
  page = await findMainWindow(electronApp);
  page.on('dialog', async (d) => { try { await d.dismiss(); } catch {} });
  page.on('console', (m) => { const t = m.text(); if (/Snapshot|backup|Backup|Simulated/i.test(t)) console.log('[console]', t); });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
  if (!page.url().includes('/app')) {
    await page.evaluate(() => { window.location.href = '/app'; }).catch(()=>{});
    await page.waitForLoadState('domcontentloaded').catch(()=>{});
  }
  // Suppress first-run modals whose overlay would block the toolbar/New Outline.
  await page.evaluate(() => {
    try {
      localStorage.setItem('discovery:professionalMode', 'true');
      localStorage.setItem('onboarding:welcomeShowcaseSeen', 'true');
      localStorage.setItem('onboarding:makeSomethingNudgeFired', 'true');
      localStorage.setItem('idiampro-welcomed', 'true');
    } catch {}
  });
  // Reload so the app boots with those flags already set (no welcome modal).
  await page.reload().catch(()=>{});
  await page.waitForLoadState('domcontentloaded').catch(()=>{});
  await page.waitForTimeout(2500);
  const newBtn = page.locator('button:has-text("New Outline")').first();
  const deadline = Date.now() + 150000;
  let ready = false;
  while (Date.now() < deadline) {
    if (await newBtn.isVisible({ timeout: 1000 }).catch(()=>false)) { ready = true; break; }
    if (!page.url().includes('/app')) {
      await page.evaluate(() => { window.location.href = '/app'; }).catch(()=>{});
      await page.waitForLoadState('domcontentloaded').catch(()=>{});
    }
    await page.waitForTimeout(2000);
  }
  if (!ready) throw new Error('App shell (New Outline) never became visible');
  await page.waitForTimeout(1000);
}

// Open the Backup & Restore dialog on the Backup tab. If it's already open
// (e.g. it stayed open after a prior backup), just switch to the Backup tab.
async function openBackupDialog() {
  const alreadyOpen = await page.locator('button:has-text("Back up now")').first().isVisible().catch(()=>false);
  if (!alreadyOpen) {
    const btn = page.locator('[data-testid="backup-outline-button"]').first();
    await btn.waitFor({ state: 'visible', timeout: 8000 });
    await btn.click();
    await page.waitForTimeout(800);
  }
  const backupTab = page.locator('button[role="tab"]:has-text("Backup")').first();
  if (await backupTab.isVisible().catch(()=>false)) {
    await backupTab.click();
    await page.waitForTimeout(300);
  }
}

async function closeDialog() {
  const closeBtn = page.locator('button[aria-label="Close"]').first();
  if (await closeBtn.isVisible().catch(()=>false)) {
    await closeBtn.click().catch(()=>{});
  }
  await page.waitForTimeout(600);
}

async function clickBackNow() {
  const btn = page.locator('button:has-text("Back up now")').first();
  await btn.waitFor({ state: 'visible', timeout: 6000 });
  await btn.click();
  await page.waitForTimeout(1500);
}

async function warningVisible() {
  return await page.getByText(/backups aren't saving/i).first().isVisible().catch(()=>false);
}

async function main() {
  await launch();
  await shot('00-launched');

  // Create a fresh THROWAWAY outline so we never touch real data.
  await run('0-create-throwaway', async () => {
    await page.locator('button:has-text("New Outline")').first().click();
    await page.waitForTimeout(1500);
    const root = page.locator('[role="treeitem"] span:has-text("Untitled Outline")').first();
    const had = await root.count() > 0;
    if (had) {
      await root.dblclick();
      await page.waitForTimeout(500);
      const input = page.locator('input[type="text"]:visible').first();
      if (await input.isVisible().catch(()=>false)) {
        await input.fill('ZZ Backup Health');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(600);
      }
    }
    await shot('01-throwaway-outline');
    const named = await page.locator('[role="treeitem"] span:has-text("ZZ Backup Health")').count();
    return { pass: named > 0, note: `created=${had} named=${named}` };
  });

  // A. HAPPY PATH — real backup succeeds, watchdog stays silent.
  await run('A-happy-quiet', async () => {
    await openBackupDialog();
    await shot('02-backup-dialog');
    await clickBackNow();
    await shot('03-after-backup');
    const success = await page.getByText(/Backed up:/i).first().isVisible().catch(()=>false);
    const warned = await warningVisible();
    // Close the dialog so the next phase's warning toast is fully interactable.
    await closeDialog();
    return { pass: success && !warned, note: `successToast=${success} falseWarning=${warned}` };
  });

  // B. FAILURE PATH — simulate a silent backup failure, watchdog warns LOUDLY.
  await run('B-failure-loud-warning', async () => {
    await page.evaluate(() => {
      window.__IDM_SIMULATE_BACKUP_FAILURE = true;
    });
    await openBackupDialog();
    await clickBackNow();
    await page.waitForTimeout(1200);
    // Check the warning while the dialog is still open (isVisible ignores
    // occlusion), then screenshot, THEN close the dialog.
    const warnedOpen = await warningVisible();
    await shot('04-failure-warning');
    await closeDialog();
    await page.waitForTimeout(400);
    const warned = warnedOpen || (await warningVisible());
    return { pass: warned, note: `loudWarningShown=${warned}` };
  });

  // B2. The warning must be DISMISSIBLE (persist-until-dismissed, not auto-fade).
  await run('B2-warning-dismissible', async () => {
    const stillThereBefore = await warningVisible();
    // Scope the dismiss to the WARNING toast specifically (each toast has its
    // own "Dismiss notification" close button). Radix renders each toast as an
    // <li> in the viewport.
    const warnToast = page.locator('li').filter({ hasText: /backups aren't saving/i }).first();
    await warnToast.hover().catch(()=>{});
    await page.waitForTimeout(200);
    let clicked = false;
    const closeBtn = warnToast.locator('[toast-close]').first();
    if (await closeBtn.count() > 0) {
      await closeBtn.click({ force: true }).catch(()=>{});
      clicked = true;
    }
    await page.waitForTimeout(900);
    const goneAfter = !(await warningVisible());
    await shot('05-after-dismiss');
    return { pass: stillThereBefore && clicked && goneAfter, note: `before=${stillThereBefore} clicked=${clicked} goneAfter=${goneAfter}` };
  });

  // Clean up the test flag.
  await page.evaluate(() => { try { delete window.__IDM_SIMULATE_BACKUP_FAILURE; } catch {} }).catch(()=>{});

  // Report
  const entries = Object.entries(results);
  const passed = entries.filter(([, r]) => r.pass).length;
  const failed = entries.length - passed;
  const report = {
    suite: 'backup-health',
    when: new Date().toISOString(),
    platform: { platform: os.platform(), arch: os.arch(), node: process.version },
    passed, failed, total: entries.length,
    results,
  };
  ensureDir(SCREENSHOT_DIR);
  fs.writeFileSync(path.join(SCREENSHOT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  const md = [
    `# Backup Health Test`,
    `${report.when}`,
    ``,
    `**${passed}/${entries.length} passed.**`,
    ``,
    ...entries.map(([k, r]) => `- ${r.pass ? 'PASS' : 'FAIL'} — ${k} — ${r.note || ''}`),
  ].join('\n');
  fs.writeFileSync(path.join(SCREENSHOT_DIR, 'report.md'), md);
  console.log(`\n\nRESULT: ${passed}/${entries.length} passed, ${failed} failed`);

  await electronApp.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error('FATAL', e);
  try { await shot('99-fatal'); } catch {}
  try { await electronApp.close(); } catch {}
  process.exit(1);
});
