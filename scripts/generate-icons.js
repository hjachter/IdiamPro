const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '../public/icons/icon.svg');
const outputDir = path.join(__dirname, '../public/icons');

const sizes = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-180.png', size: 180 },
  { name: 'favicon-32.png', size: 32 },
  { name: 'favicon-16.png', size: 16 }
];

async function generateIcons() {
  console.log('Generating PWA icons...');

  for (const { name, size } of sizes) {
    const outputPath = path.join(outputDir, name);

    await sharp(svgPath)
      .resize(size, size)
      .png()
      .toFile(outputPath);

    console.log(`✓ Generated ${name} (${size}x${size})`);
  }

  console.log('\nAll icons generated successfully!');
}

generateIcons().catch(console.error);
