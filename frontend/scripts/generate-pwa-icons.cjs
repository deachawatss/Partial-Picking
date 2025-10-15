#!/usr/bin/env node

/**
 * Generate PWA Icons Script
 *
 * Reads the 512x512 source icon and generates all required PWA icon sizes:
 * - pwa-192x192.png (Android home screen)
 * - apple-touch-icon.png (iOS home screen - 180x180)
 * - favicon-32x32.png (Browser tab)
 *
 * Usage: node frontend/scripts/generate-pwa-icons.js
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const publicDir = path.join(__dirname, '..', 'public');
const sourceIcon = path.join(publicDir, 'pwa-512x512.png');

const icons = [
  { input: sourceIcon, output: 'pwa-192x192.png', size: '192x192' },
  { input: sourceIcon, output: 'apple-touch-icon.png', size: '180x180' },
  { input: sourceIcon, output: 'favicon-32x32.png', size: '32x32' },
];

async function checkImageMagick() {
  try {
    await execAsync('which convert');
    return 'convert';
  } catch (error) {
    try {
      await execAsync('which magick');
      return 'magick';
    } catch (error2) {
      return null;
    }
  }
}

async function generateWithImageMagick(tool) {
  console.log(`✨ Using ${tool} to generate icons...\n`);

  for (const icon of icons) {
    const outputPath = path.join(publicDir, icon.output);
    const command = tool === 'convert'
      ? `convert "${icon.input}" -resize ${icon.size} "${outputPath}"`
      : `magick "${icon.input}" -resize ${icon.size} "${outputPath}`;

    try {
      await execAsync(command);
      const stats = fs.statSync(outputPath);
      console.log(`✅ Generated ${icon.output} (${icon.size}) - ${(stats.size / 1024).toFixed(1)}KB`);
    } catch (error) {
      console.error(`❌ Failed to generate ${icon.output}:`, error.message);
    }
  }
}

async function generateWithSharp() {
  console.log('✨ Using sharp to generate icons...\n');

  try {
    const sharp = require('sharp');

    for (const icon of icons) {
      const outputPath = path.join(publicDir, icon.output);
      const size = parseInt(icon.size.split('x')[0]);

      await sharp(icon.input)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(outputPath);

      const stats = fs.statSync(outputPath);
      console.log(`✅ Generated ${icon.output} (${icon.size}) - ${(stats.size / 1024).toFixed(1)}KB`);
    }
  } catch (error) {
    throw new Error(`sharp library error: ${error.message}`);
  }
}

async function main() {
  console.log('🎨 PWA Icon Generator\n');
  console.log('Source:', sourceIcon);

  // Check if source file exists
  if (!fs.existsSync(sourceIcon)) {
    console.error(`❌ Error: Source icon not found at ${sourceIcon}`);
    process.exit(1);
  }

  console.log(`✓ Source icon found (${(fs.statSync(sourceIcon).size / 1024).toFixed(1)}KB)\n`);

  // Try sharp first (if installed)
  try {
    await generateWithSharp();
    console.log('\n🎉 All icons generated successfully using sharp!');
    return;
  } catch (error) {
    console.log('⚠ sharp not available, trying ImageMagick...');
  }

  // Try ImageMagick
  const imageMagickTool = await checkImageMagick();
  if (imageMagickTool) {
    await generateWithImageMagick(imageMagickTool);
    console.log('\n🎉 All icons generated successfully using ImageMagick!');
    return;
  }

  // No tools available
  console.error('\n❌ Error: No image processing tools available!');
  console.error('\nPlease install one of the following:');
  console.error('  1. npm install sharp (recommended)');
  console.error('  2. sudo apt-get install imagemagick (Linux)');
  console.error('  3. brew install imagemagick (macOS)');
  console.error('\nOr use the browser-based generator at: http://localhost:6060/generate-icons.html');
  process.exit(1);
}

main().catch(error => {
  console.error('❌ Unexpected error:', error.message);
  process.exit(1);
});
