// Shared Playwright test helpers for IdiamPro's Electron suites.
//
// Two robustness fixes live here so every suite can reuse them instead of
// re-implementing (and drifting):
//
//   1. dismissWelcomeShowcase(page) — the first-run "What you can make here"
//      panel (src/components/welcome-showcase.tsx) opens over the app on a
//      fresh launch and blocks clicks. Call this right after the app window
//      is ready. It clicks Skip if the panel is up, and marks the localStorage
//      "seen" flag so it can't re-open on a later re-render.
//
//   2. waitForAppReady(page) — the invite/sign-in gate (src/components/
//      app-gate.tsx) renders a bare "Loading…" screen while it checks the
//      dev Clerk session. Roughly 1 in 3 launches stalls there on the dev
//      rate limit. This waits (with a bounded retry) for the real app shell
//      to appear before the suite starts driving the UI.
//
// Both helpers are defensive: any internal failure is swallowed so a suite is
// never made *more* fragile by calling them.

const WELCOME_SEEN_KEY = 'onboarding:welcomeShowcaseSeen';

async function dismissWelcomeShowcase(page, { timeoutMs = 4000 } = {}) {
  try {
    const panel = page.locator('[data-testid="welcome-showcase"]');
    // Give it a brief window to appear (it mounts after hydration).
    await panel
      .first()
      .waitFor({ state: 'visible', timeout: timeoutMs })
      .catch(() => {});

    const visible = await panel
      .first()
      .isVisible()
      .catch(() => false);

    if (visible) {
      // The persistent opt-out button (renamed 2026-07-16 from "Skip" to
      // "Don't show this again"); fall back to the older testid, then Escape.
      const optOut = page.locator(
        '[data-testid="welcome-showcase-dont-show"], [data-testid="welcome-showcase-skip"]',
      );
      if ((await optOut.count().catch(() => 0)) > 0) {
        await optOut.first().click().catch(() => {});
      } else {
        await page.keyboard.press('Escape').catch(() => {});
      }
      await panel
        .first()
        .waitFor({ state: 'hidden', timeout: 4000 })
        .catch(() => {});
    }
  } catch {
    /* non-fatal — never let panel-dismiss break a suite */
  }

  // Belt-and-suspenders: mark it seen so it cannot re-open mid-test.
  await page
    .evaluate((key) => {
      try {
        window.localStorage.setItem(key, 'true');
      } catch {}
    }, WELCOME_SEEN_KEY)
    .catch(() => {});
}

async function waitForAppReady(page, { timeoutMs = 45000 } = {}) {
  const start = Date.now();
  // The gate shows exactly the text "Loading…" and nothing else. We consider
  // the app ready once that gate is gone AND some real chrome is present.
  while (Date.now() - start < timeoutMs) {
    try {
      const gateOnly = await page
        .evaluate(() => {
          const body = document.body ? document.body.innerText.trim() : '';
          // The bare gate screen is just the loading glyph.
          return body === 'Loading…' || body === 'Loading...';
        })
        .catch(() => true);

      if (!gateOnly) {
        // Real UI present — one more guard: the outline app root / a toolbar
        // button / the editor should exist.
        const hasChrome = await page
          .evaluate(() => {
            return (
              document.querySelector('[data-testid], button, [role="toolbar"], main, aside') !==
              null
            );
          })
          .catch(() => false);
        if (hasChrome) return true;
      }
    } catch {
      /* transient during navigation — keep polling */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  // Don't throw — let the suite's own selectors report the real failure, but
  // note it so logs are diagnosable.
  console.log('  [waitForAppReady] gate did not clear within', timeoutMs, 'ms');
  return false;
}

// Open the Settings dialog reliably across viewport widths. On narrower
// windows the visible Settings button collapses into the toolbar "More" (⋯)
// overflow menu (src/components/outline-pane.tsx, 2026-07-10), so a plain
// click on the hidden button fails. This tries the real overflow path first,
// then falls back to firing the app's own canonical hidden trigger — the same
// element the overflow menu item clicks — which is viewport-independent.
async function openSettings(page) {
  // Attempt 1: drive the actual UI — open "More tools" then click Settings.
  try {
    const more = page.locator('[aria-label="More tools"]');
    if ((await more.count().catch(() => 0)) > 0 && (await more.first().isVisible().catch(() => false))) {
      await more.first().click().catch(() => {});
      await page.waitForTimeout(300);
      const item = page.locator('[role="menuitem"]:has-text("Settings")');
      if ((await item.count().catch(() => 0)) > 0) {
        await item.first().click().catch(() => {});
      }
    }
  } catch {}

  // If a Settings dialog is now open, we're done.
  const settingsOpen = async () =>
    (await page.locator('[role="dialog"]:has-text("Subscription Plan"), [role="dialog"]:has-text("Theme")').count().catch(() => 0)) > 0;

  await page.waitForTimeout(400);
  if (await settingsOpen()) return true;

  // Attempt 2: fire the app's canonical hidden trigger directly. This is the
  // exact element the overflow menu item activates, so it opens the same
  // dialog regardless of whether the button is currently painted.
  await page
    .evaluate(() => {
      const btn = document.querySelector('[data-settings-trigger]');
      if (btn) btn.click();
    })
    .catch(() => {});
  await page.waitForTimeout(600);
  return settingsOpen();
}

// Resize the Electron window. A wide window keeps every toolbar button inline
// (the 2026-07-10 responsive toolbar collapses lower-priority buttons — Help,
// Settings, Smart Tools, etc. — into a "More" overflow menu on narrow widths,
// which breaks tests that expect those buttons directly in the toolbar). Call
// with a wide size right after launch to opt out of overflow for a suite.
async function setElectronWindowSize(electronApp, w = 1500, h = 950) {
  try {
    await electronApp.evaluate(({ BrowserWindow }, size) => {
      const win =
        BrowserWindow.getAllWindows().find(
          (x) => !x.webContents.getURL().startsWith('devtools://')
        ) || BrowserWindow.getAllWindows()[0];
      if (win) win.setSize(size.w, size.h);
    }, { w, h });
  } catch {
    /* non-fatal */
  }
}

// Convenience: run both, in the right order, after the window is found.
async function prepareApp(page, opts = {}) {
  await waitForAppReady(page, opts);
  await dismissWelcomeShowcase(page, opts);
}

module.exports = {
  dismissWelcomeShowcase,
  waitForAppReady,
  prepareApp,
  openSettings,
  setElectronWindowSize,
  WELCOME_SEEN_KEY,
};
