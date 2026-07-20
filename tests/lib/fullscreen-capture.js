// tests/lib/fullscreen-capture.js
//
// ALWAYS use this for app screenshots — do NOT resize the page viewport
// (page.setViewportSize) for Electron captures: that resizes the web content
// box but NOT the native OS window, so you get a small/half-screen shot with
// empty margins. The only thing that produces a genuine full-screen, native
// Retina capture is resizing the real BrowserWindow to the display's work area.
//
// This helper exists because the half-screen capture bug recurred many times.
// It is designed so a half-size shot FAILS LOUDLY (throws) instead of shipping.
//
//   const { captureFullScreen } = require('./lib/fullscreen-capture');
//   await captureFullScreen(electronApp, page, '/abs/path/shot.png');
//
// electronApp : the object returned by playwright._electron.launch(...)
// page        : the main BrowserWindow's Playwright page
// outPath     : absolute path for the PNG
// opts.waitMs : settle time after resizing before the screenshot (default 1200)
// opts.fullScreen : also call setFullScreen(true) (default false — off because
//                   macOS true-fullscreen animates to a separate Space and can
//                   hide a custom title bar/toolbar; setBounds(workArea) already
//                   fills the screen and is reliable).
// opts.minWidth : assertion floor for the saved PNG width (default 2000). On a
//                   Retina display a full-screen shot is ~2x the logical width,
//                   so anything under this means the window didn't actually fill
//                   the display and the shot must not be trusted.

const fs = require('fs');

async function fillDisplay(electronApp, { fullScreen = false } = {}) {
  await electronApp.evaluate(({ BrowserWindow, screen }, opts) => {
    const w =
      BrowserWindow.getAllWindows().find(
        (x) => !x.webContents.getURL().includes('devtools')
      ) || BrowserWindow.getAllWindows()[0];
    if (!w) return;
    const { workArea } = screen.getPrimaryDisplay();
    // Set bounds to the full work area, THEN maximize. (Do NOT unmaximize
    // first — on macOS frameless windows that leaves the window at a smaller
    // size and the subsequent maximize doesn't fully re-fill in time, giving a
    // sub-full-resolution capture.)
    w.setBounds({
      x: workArea.x,
      y: workArea.y,
      width: workArea.width,
      height: workArea.height,
    });
    w.maximize();
    if (opts.fullScreen) {
      try { w.setFullScreen(true); } catch {}
    }
  }, { fullScreen }).catch(() => {});
}

// Read a PNG's pixel width from its IHDR chunk (bytes 16-19, big-endian) so we
// can assert full-size without an image library.
function pngPixelWidth(pngPath) {
  const buf = fs.readFileSync(pngPath);
  // PNG signature is 8 bytes; IHDR length(4)+type(4) then width(4) at offset 16.
  if (buf.length < 24) return 0;
  return buf.readUInt32BE(16);
}

async function captureFullScreen(electronApp, page, outPath, opts = {}) {
  // minWidth is a half-screen tripwire, not a fixed target: the true full-
  // screen pixel count varies with the user's display scale (a "More Space"
  // scaled Retina mode yields fewer backing pixels than native 2x). 2000 is
  // safely below any full-screen capture but well above a half/windowed shot.
  const { waitMs = 1200, fullScreen = false, minWidth = 2000 } = opts;

  await fillDisplay(electronApp, { fullScreen });
  await page.waitForTimeout(waitMs);

  // Native device pixel ratio (Retina) — Playwright's Electron screenshot
  // captures at the window's real backing-store resolution; do NOT pass any
  // scale/clip that would downsample.
  await page.screenshot({ path: outPath });

  const width = pngPixelWidth(outPath);
  if (width < minWidth) {
    // One retry with a longer settle in case the bounds hadn't applied yet.
    await fillDisplay(electronApp, { fullScreen });
    await page.waitForTimeout(waitMs + 800);
    await page.screenshot({ path: outPath });
    const retryWidth = pngPixelWidth(outPath);
    if (retryWidth < minWidth) {
      throw new Error(
        `[fullscreen-capture] ${outPath} is only ${retryWidth}px wide ` +
        `(< ${minWidth}px). The native window did not fill the display — ` +
        `this is the half-screen bug. Do NOT ship this shot.`
      );
    }
    return retryWidth;
  }
  return width;
}

module.exports = { captureFullScreen, fillDisplay, pngPixelWidth };
