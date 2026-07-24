// Renders public/og/og-preview.html to a crisp 1200x630 PNG.
// Usage: node scripts/og/render-og.js [outputPath]
const { chromium } = require('playwright');
const sharp = require('sharp');
const path = require('path');

(async () => {
  const htmlPath = path.resolve(__dirname, '../../public/og/og-preview.html');
  const out = process.argv[2] || path.resolve(__dirname, '../../public/og-image.png');

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 2, // supersample at 2x, then downscale to exactly 1200x630
  });
  await page.goto('file://' + htmlPath, { waitUntil: 'networkidle' });
  // Ensure webfonts are ready before snapping.
  try { await page.evaluate(() => document.fonts.ready); } catch (e) {}
  await page.waitForTimeout(400);

  const card = await page.$('#card');
  const buf = await card.screenshot({ type: 'png' }); // 2400x1260
  await browser.close();

  await sharp(buf)
    .resize(1200, 630, { fit: 'fill', kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log('Wrote', out);
})();
