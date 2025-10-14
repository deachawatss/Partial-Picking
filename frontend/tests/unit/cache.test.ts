/**
 * Cache Service Unit Tests
 *
 * Tests IndexedDB caching functionality:
 * - Cache run data
 * - Retrieve cached run
 * - FIFO eviction (last 5 runs)
 * - Cache statistics
 * - Clear cache
 *
 * Constitutional Requirement: Last 5 runs cached (FIFO eviction)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  cacheRun,
  clearCache,
  getCacheStats,
} from '@/services/cache';
import { RunDetailsResponse, BatchItemDTO } from '@/types/api';

/**
 * Mock run data generator
 */
function createMockRunData(runNo: number): RunDetailsResponse {
  return {
    runNo,
    fgItemKey: `FG-${runNo}`,
    fgDescription: `Test FG Item ${runNo}`,
    batches: [1, 2, 3],
    productionDate: '2025-01-15',
    status: 'NEW',
    noOfBatches: 3
  };
}

/**
 * Mock batch items generator
 */
function createMockBatchItems(runNo: number): BatchItemDTO[] {
  return [
    {
      itemKey: `ITEM-${runNo}-1`,
      description: 'Test Item 1',
      totalNeeded: 10.5,
      pickedQty: 0,
      remainingQty: 10.5,
      weightRangeLow: 10.0,
      weightRangeHigh: 11.0,
      toleranceKG: 0.5,
      allergen: 'None',
      status: null
    },
    {
      itemKey: `ITEM-${runNo}-2`,
      description: 'Test Item 2',
      totalNeeded: 25.0,
      pickedQty: 0,
      remainingQty: 25.0,
      weightRangeLow: 24.5,
      weightRangeHigh: 25.5,
      toleranceKG: 0.5,
      allergen: 'Dairy',
      status: null
    }
  ];
}

describe('Cache Service', () => {
  // Clear cache before each test
  beforeEach(async () => {
    await clearCache();
  });

  // Clear cache after all tests
  afterEach(async () => {
    await clearCache();
  });

  describe('cacheRun', () => {
    it('should cache run data successfully', async () => {
      const runNo = 12345;
      const runData = createMockRunData(runNo);
      const batchItems = createMockBatchItems(runNo);

      await cacheRun(runNo, runData, batchItems);

      expect(cached).toBeDefined();
      expect(cached?.runNo).toBe(runNo);
      expect(cached?.runData).toEqual(runData);
      expect(cached?.batchItems).toEqual(batchItems);
      expect(cached?.cachedAt).toBeGreaterThan(0);
    });

    it('should update existing cached run', async () => {
      const runNo = 12345;
      const runData1 = createMockRunData(runNo);
      const batchItems1 = createMockBatchItems(runNo);

      // Cache first time
      await cacheRun(runNo, runData1, batchItems1);
      const cachedAt1 = cached1?.cachedAt || 0;

      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      // Cache again with updated data
      const runData2 = { ...runData1, status: 'PRINT' as const };
      await cacheRun(runNo, runData2, batchItems1);

      expect(cached2?.runData.status).toBe('PRINT');
      expect(cached2?.cachedAt).toBeGreaterThan(cachedAt1);
    });
  });

  describe('getCachedRun', () => {
    it('should retrieve cached run', async () => {
      const runNo = 12345;
      const runData = createMockRunData(runNo);
      const batchItems = createMockBatchItems(runNo);

      await cacheRun(runNo, runData, batchItems);

      expect(cached).toBeDefined();
      expect(cached?.runNo).toBe(runNo);
    });

    it('should return undefined for non-existent run', async () => {
      expect(cached).toBeUndefined();
    });
  });

  describe('listCachedRuns', () => {
    it('should list all cached runs sorted by newest first', async () => {
      const runs = [12345, 12346, 12347];

      for (const runNo of runs) {
        await cacheRun(runNo, createMockRunData(runNo), createMockBatchItems(runNo));
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      expect(cachedRuns).toHaveLength(3);

      // Should be sorted newest first
      expect(cachedRuns[0].runNo).toBe(12347);
      expect(cachedRuns[1].runNo).toBe(12346);
      expect(cachedRuns[2].runNo).toBe(12345);
    });

    it('should return empty array when cache is empty', async () => {
      expect(cachedRuns).toEqual([]);
    });
  });

  describe('FIFO Eviction (Constitutional Requirement)', () => {
    it('should keep only last 5 runs (FIFO eviction)', async () => {
      // Cache 7 runs (exceeds limit of 5)
      const runs = [12345, 12346, 12347, 12348, 12349, 12350, 12351];

      for (const runNo of runs) {
        await cacheRun(runNo, createMockRunData(runNo), createMockBatchItems(runNo));
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }


      // Should only have 5 runs
      expect(cachedRuns).toHaveLength(5);

      // Should keep newest 5 runs (12347-12351)
      const cachedRunNos = cachedRuns.map(r => r.runNo).sort((a, b) => a - b);
      expect(cachedRunNos).toEqual([12347, 12348, 12349, 12350, 12351]);

      // Oldest runs should be evicted
      expect(run12345).toBeUndefined();
      expect(run12346).toBeUndefined();
    });

    it('should evict oldest run when adding 6th run', async () => {
      // Cache exactly 5 runs
      const runs = [12345, 12346, 12347, 12348, 12349];

      for (const runNo of runs) {
        await cacheRun(runNo, createMockRunData(runNo), createMockBatchItems(runNo));
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Verify we have 5 runs
      expect(cachedRuns).toHaveLength(5);

      // Add 6th run
      await cacheRun(12350, createMockRunData(12350), createMockBatchItems(12350));

      // Should still have only 5 runs
      expect(cachedRuns).toHaveLength(5);

      // Oldest run (12345) should be evicted
      expect(oldestRun).toBeUndefined();

      // Newest run should exist
      expect(newestRun).toBeDefined();
    });
  });

  describe('clearCache', () => {
    it('should clear all cached runs', async () => {
      // Cache some runs
      const runs = [12345, 12346, 12347];
      for (const runNo of runs) {
        await cacheRun(runNo, createMockRunData(runNo), createMockBatchItems(runNo));
      }

      // Verify runs are cached
      expect(cachedRuns.length).toBeGreaterThan(0);

      // Clear cache
      await clearCache();

      // Verify cache is empty
      expect(cachedRuns).toEqual([]);
    });
  });

  describe('getCacheStats', () => {
    it('should return correct cache statistics', async () => {
      // Cache 3 runs
      const runs = [12345, 12346, 12347];
      for (const runNo of runs) {
        await cacheRun(runNo, createMockRunData(runNo), createMockBatchItems(runNo));
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const stats = await getCacheStats();

      expect(stats.count).toBe(3);
      expect(stats.maxSize).toBe(5);
      expect(stats.oldestCachedAt).toBeDefined();
      expect(stats.newestCachedAt).toBeDefined();
      expect(stats.totalSizeKB).toBeGreaterThan(0);

      // Newest should be later than oldest
      expect(stats.newestCachedAt! > stats.oldestCachedAt!).toBe(true);
    });

    it('should return zero stats for empty cache', async () => {
      const stats = await getCacheStats();

      expect(stats.count).toBe(0);
      expect(stats.maxSize).toBe(5);
      expect(stats.oldestCachedAt).toBeUndefined();
      expect(stats.newestCachedAt).toBeUndefined();
      expect(stats.totalSizeKB).toBe(0);
    });
  });
});
