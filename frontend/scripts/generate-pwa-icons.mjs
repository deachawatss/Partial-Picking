#!/usr/bin/env node
/**
 * PWA Icon Generator
 * Generates 192x192 and 512x512 PNG icons for the PWA manifest
 */

import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

// Color scheme (Tailwind sky-500)
const BG_COLOR = { r: 14, g: 165, b: 233, a: 255 }; // #0ea5e9
const TEXT_COLOR = { r: 255, g: 255, b: 255, a: 255 }; // white

function createIcon(size) {
  const png = new PNG({ width: size, height: size });

  // Fill background
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      png.data[idx] = BG_COLOR.r;
      png.data[idx + 1] = BG_COLOR.g;
      png.data[idx + 2] = BG_COLOR.b;
      png.data[idx + 3] = BG_COLOR.a;
    }
  }

  // Simple "PP" text pattern (centered squares representing text)
  const textSize = Math.floor(size * 0.3);
  const gap = Math.floor(size * 0.08);
  const centerX = Math.floor(size / 2);
  const centerY = Math.floor(size / 2);

  // Left "P"
  const p1StartX = centerX - textSize - gap / 2;
  const p1StartY = centerY - textSize / 2;
  drawP(png, p1StartX, p1StartY, textSize, TEXT_COLOR);

  // Right "P"
  const p2StartX = centerX + gap / 2;
  const p2StartY = centerY - textSize / 2;
  drawP(png, p2StartX, p2StartY, textSize, TEXT_COLOR);

  return png;
}

function drawP(png, startX, startY, size, color) {
  const strokeWidth = Math.max(2, Math.floor(size * 0.15));
  const width = png.width;

  // Vertical stem
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < strokeWidth; x++) {
      const px = startX + x;
      const py = startY + y;
      if (px >= 0 && px < width && py >= 0 && py < png.height) {
        const idx = (width * py + px) << 2;
        png.data[idx] = color.r;
        png.data[idx + 1] = color.g;
        png.data[idx + 2] = color.b;
        png.data[idx + 3] = color.a;
      }
    }
  }

  // Top horizontal bar
  const barWidth = Math.floor(size * 0.6);
  for (let x = 0; x < barWidth; x++) {
    for (let y = 0; y < strokeWidth; y++) {
      const px = startX + x;
      const py = startY + y;
      if (px >= 0 && px < width && py >= 0 && py < png.height) {
        const idx = (width * py + px) << 2;
        png.data[idx] = color.r;
        png.data[idx + 1] = color.g;
        png.data[idx + 2] = color.b;
        png.data[idx + 3] = color.a;
      }
    }
  }

  // Middle horizontal bar
  const midY = Math.floor(size * 0.4);
  for (let x = 0; x < barWidth; x++) {
    for (let y = 0; y < strokeWidth; y++) {
      const px = startX + x;
      const py = startY + midY + y;
      if (px >= 0 && px < width && py >= 0 && py < png.height) {
        const idx = (width * py + px) << 2;
        png.data[idx] = color.r;
        png.data[idx + 1] = color.g;
        png.data[idx + 2] = color.b;
        png.data[idx + 3] = color.a;
      }
    }
  }

  // Right vertical bar (top half only)
  const rightX = barWidth - strokeWidth;
  const halfSize = Math.floor(size * 0.4) + strokeWidth;
  for (let y = 0; y < halfSize; y++) {
    for (let x = 0; x < strokeWidth; x++) {
      const px = startX + rightX + x;
      const py = startY + y;
      if (px >= 0 && px < width && py >= 0 && py < png.height) {
        const idx = (width * py + px) << 2;
        png.data[idx] = color.r;
        png.data[idx + 1] = color.g;
        png.data[idx + 2] = color.b;
        png.data[idx + 3] = color.a;
      }
    }
  }
}

// Generate 192x192 icon
const icon192 = createIcon(192);
const icon192Path = path.join(publicDir, 'pwa-192x192.png');
icon192.pack().pipe(fs.createWriteStream(icon192Path));
console.log('Generated pwa-192x192.png');

// Generate 512x512 icon
const icon512 = createIcon(512);
const icon512Path = path.join(publicDir, 'pwa-512x512.png');
icon512.pack().pipe(fs.createWriteStream(icon512Path));
console.log('Generated pwa-512x512.png');

// Also create favicon
const favicon = createIcon(32);
const faviconPath = path.join(publicDir, 'favicon.ico'); // Actually PNG, but named .ico
favicon.pack().pipe(fs.createWriteStream(faviconPath));
console.log('Generated favicon.ico');

console.log('\nPWA icons generated successfully!');
