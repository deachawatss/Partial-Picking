#!/usr/bin/env node

/**
 * Image Optimization Script for PK Frontend
 *
 * This script optimizes images for better web performance.
 * Run this script when image processing tools are available.
 *
 * Requirements:
 * - npm install sharp --save-dev
 *
 * Usage:
 * node scripts/optimize-images.js
 */

const fs = require('fs');
const path = require('path');

// Configuration
const ASSETS_DIR = path.join(__dirname, '../src/assets/images');
const OPTIMIZED_DIR = path.join(__dirname, '../src/assets/images/optimized');

// Image optimization settings
const LOGO_CONFIG = {
  input: 'NWFLogo.jpg',
  outputs: [
    { width: 128, height: 64, suffix: '-128w', format: 'webp' },
    { width: 256, height: 128, suffix: '-256w', format: 'webp' },
    { width: 128, height: 64, suffix: '-128w', format: 'jpeg', quality: 85 },
    { width: 256, height: 128, suffix: '-256w', format: 'jpeg', quality: 85 }
  ]
};

async function optimizeImages() {
  try {
    // Check if sharp is available
    const sharp = require('sharp');

    // Create optimized directory if it doesn't exist
    if (!fs.existsSync(OPTIMIZED_DIR)) {
      fs.mkdirSync(OPTIMIZED_DIR, { recursive: true });
    }

    console.log('🖼️  Optimizing images...');

    const inputPath = path.join(ASSETS_DIR, LOGO_CONFIG.input);

    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input image not found: ${inputPath}`);
    }

    // Optimize logo in multiple formats and sizes
    for (const output of LOGO_CONFIG.outputs) {
      const fileName = `NWFLogo${output.suffix}.${output.format}`;
      const outputPath = path.join(OPTIMIZED_DIR, fileName);

      let pipeline = sharp(inputPath)
        .resize(output.width, output.height, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        });

      if (output.format === 'webp') {
        pipeline = pipeline.webp({ quality: output.quality || 90 });
      } else if (output.format === 'jpeg') {
        pipeline = pipeline.jpeg({ quality: output.quality || 85 });
      }

      await pipeline.toFile(outputPath);

      const stats = fs.statSync(outputPath);
      const originalStats = fs.statSync(inputPath);
      const savings = ((originalStats.size - stats.size) / originalStats.size * 100).toFixed(1);

      console.log(`✅ Created ${fileName} (${stats.size} bytes, ${savings}% smaller)`);
    }

    console.log('🎉 Image optimization complete!');
    console.log('\n📝 Next steps:');
    console.log('1. Update your templates to use the optimized images');
    console.log('2. Use <picture> element with WebP format and JPEG fallback');
    console.log('3. Test the application to ensure images load correctly');

  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND' && error.message.includes('sharp')) {
      console.log('❌ Sharp is not installed. Run: npm install sharp --save-dev');
      console.log('📋 Manual optimization recommended:');
      console.log('1. Resize NWFLogo.jpg to 256x128 pixels (2x for retina displays)');
      console.log('2. Compress to 85% JPEG quality or convert to WebP format');
      console.log('3. Expected file size: ~8-15KB (currently ~54KB)');
      process.exit(1);
    } else {
      console.error('❌ Error optimizing images:', error.message);
      process.exit(1);
    }
  }
}

// Run the optimization
if (require.main === module) {
  optimizeImages();
}

module.exports = { optimizeImages };