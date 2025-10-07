/**
 * Frontend Bundle Size Performance Test
 *
 * Constitutional Requirement: <500KB gzipped total bundle size
 *
 * Tests:
 * - Measure production build output
 * - Calculate gzipped sizes for main.js and vendor.js
 * - Verify total bundle size <500KB
 * - Generate bundle analysis report
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { gzipSync } from 'zlib';

const CONSTITUTIONAL_LIMIT_KB = 500;
const DIST_DIR = join(process.cwd(), 'dist');

interface BundleMetrics {
  file: string;
  sizeRaw: number;
  sizeGzip: number;
  sizeRawKB: number;
  sizeGzipKB: number;
}

interface BundleReport {
  bundles: BundleMetrics[];
  totalRawKB: number;
  totalGzipKB: number;
  passesRequirement: boolean;
  limitKB: number;
}

function formatBytes(bytes: number): string {
  return (bytes / 1024).toFixed(2);
}

function getBundleMetrics(filePath: string): BundleMetrics {
  const content = readFileSync(filePath);
  const sizeRaw = content.length;
  const sizeGzip = gzipSync(content).length;

  return {
    file: filePath.replace(DIST_DIR + '/', ''),
    sizeRaw,
    sizeGzip,
    sizeRawKB: parseFloat(formatBytes(sizeRaw)),
    sizeGzipKB: parseFloat(formatBytes(sizeGzip)),
  };
}

function findJavaScriptFiles(dir: string, files: string[] = []): string[] {
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      findJavaScriptFiles(fullPath, files);
    } else if (entry.endsWith('.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

function analyzeBundleSize(): BundleReport {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║      FRONTEND BUNDLE SIZE PERFORMANCE TEST                  ║');
  console.log('║      Constitutional Requirement: <500KB gzipped             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  console.log(`Analyzing bundles in: ${DIST_DIR}\n`);

  const jsFiles = findJavaScriptFiles(DIST_DIR);
  const bundles: BundleMetrics[] = [];

  console.log('Bundle Files Found:');
  console.log('─────────────────────────────────────────────────────────────');

  for (const file of jsFiles) {
    const metrics = getBundleMetrics(file);
    bundles.push(metrics);

    console.log(`\nFile: ${metrics.file}`);
    console.log(`  Raw Size:    ${metrics.sizeRawKB} KB`);
    console.log(`  Gzip Size:   ${metrics.sizeGzipKB} KB`);
  }

  const totalRawKB = bundles.reduce((sum, b) => sum + b.sizeRawKB, 0);
  const totalGzipKB = bundles.reduce((sum, b) => sum + b.sizeGzipKB, 0);
  const passesRequirement = totalGzipKB < CONSTITUTIONAL_LIMIT_KB;

  console.log('\n═════════════════════════════════════════════════════════════');
  console.log('TOTAL BUNDLE SIZE SUMMARY');
  console.log('═════════════════════════════════════════════════════════════');
  console.log(`Total Raw Size:      ${totalRawKB.toFixed(2)} KB`);
  console.log(`Total Gzip Size:     ${totalGzipKB.toFixed(2)} KB`);
  console.log(`Constitutional Limit: ${CONSTITUTIONAL_LIMIT_KB} KB`);
  console.log(`Difference:          ${(CONSTITUTIONAL_LIMIT_KB - totalGzipKB).toFixed(2)} KB`);
  console.log('─────────────────────────────────────────────────────────────');

  if (passesRequirement) {
    console.log('RESULT: ✅ PASS - Bundle size within constitutional limit');
  } else {
    console.log('RESULT: ❌ FAIL - Bundle size exceeds constitutional limit');
  }

  console.log('═════════════════════════════════════════════════════════════\n');

  return {
    bundles,
    totalRawKB,
    totalGzipKB,
    passesRequirement,
    limitKB: CONSTITUTIONAL_LIMIT_KB,
  };
}

function generateDetailedReport(report: BundleReport): void {
  console.log('DETAILED BUNDLE BREAKDOWN');
  console.log('─────────────────────────────────────────────────────────────\n');

  // Sort by gzipped size (largest first)
  const sorted = [...report.bundles].sort((a, b) => b.sizeGzipKB - a.sizeGzipKB);

  console.log('File                                  | Raw (KB) | Gzip (KB) | % of Total');
  console.log('────────────────────────────────────────────────────────────────────────');

  for (const bundle of sorted) {
    const percentage = ((bundle.sizeGzipKB / report.totalGzipKB) * 100).toFixed(1);
    const fileName = bundle.file.padEnd(37);
    const rawSize = bundle.sizeRawKB.toFixed(2).padStart(8);
    const gzipSize = bundle.sizeGzipKB.toFixed(2).padStart(9);
    const pct = percentage.padStart(6);

    console.log(`${fileName} | ${rawSize} | ${gzipSize} | ${pct}%`);
  }

  console.log('────────────────────────────────────────────────────────────────────────');
  console.log(
    `TOTAL                                 | ${report.totalRawKB.toFixed(2).padStart(8)} | ${report.totalGzipKB.toFixed(2).padStart(9)} | 100.0%`
  );
  console.log('\n');
}

// Export for use in tests
export { analyzeBundleSize, BundleReport, BundleMetrics };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const report = analyzeBundleSize();
    generateDetailedReport(report);

    if (!report.passesRequirement) {
      console.error(
        `\n❌ Bundle size test FAILED: ${report.totalGzipKB.toFixed(2)} KB > ${report.limitKB} KB\n`
      );
      process.exit(1);
    } else {
      console.log(
        `\n✅ Bundle size test PASSED: ${report.totalGzipKB.toFixed(2)} KB < ${report.limitKB} KB\n`
      );
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Error analyzing bundle:', error);
    console.error('\nMake sure to run `npm run build` first!\n');
    process.exit(1);
  }
}
