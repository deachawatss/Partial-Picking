/**
 * IndexedDB Cache Service
 *
 * Implements offline caching strategy for run details and batch items.
 *
 * Constitutional Requirements:
 * - Last 5 runs cached offline (FIFO eviction)
 * - Network-first for API (fresh data when online)
 * - Cache fallback when offline
 * - Cache structure preserves all run metadata
 *
 * Database Schema:
 * - Store: 'runs' (keyPath: 'runNo')
 * - Fields: runNo, runData, batchItems, cachedAt
 *
 * @example
 * ```typescript
 * import { cacheRun, getCachedRun, listCachedRuns } from '@/services/cache';
 *
 * // Cache a run after successful API fetch
 * await cacheRun(12345, runData, batchItems);
 *
 * // Retrieve cached run when offline
 * const cached = await getCachedRun(12345);
 *
 * // List all cached runs
 * const runs = await listCachedRuns();
 * ```
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb'
import { RunDetailsResponse, BatchItemDTO } from '@/types/api'

/**
 * Cache Database Schema
 */
interface CacheDB extends DBSchema {
  runs: {
    key: number // runNo
    value: CachedRun
    indexes: { 'by-cached-at': number }
  }
}

/**
 * Cached Run Data Structure
 */
export interface CachedRun {
  runNo: number
  runData: RunDetailsResponse
  batchItems: BatchItemDTO[]
  cachedAt: number // Unix timestamp
}

/**
 * Database Configuration
 */
const DB_NAME = 'partial-picking-cache'
const DB_VERSION = 1
const STORE_NAME = 'runs'
const MAX_CACHED_RUNS = 5 // Constitutional requirement: Last 5 runs

/**
 * Database connection (lazy-initialized)
 */
let dbPromise: Promise<IDBPDatabase<CacheDB>> | null = null

/**
 * Initialize IndexedDB connection
 *
 * Creates database and object store if they don't exist.
 * Sets up indexes for efficient querying.
 *
 * @returns Promise<IDBPDatabase> - Database connection
 */
function getDB(): Promise<IDBPDatabase<CacheDB>> {
  if (!dbPromise) {
    dbPromise = openDB<CacheDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Create runs store with runNo as primary key
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'runNo' })

          // Create index for sorting by cached timestamp
          store.createIndex('by-cached-at', 'cachedAt')
        }
      },
      blocked() {
        // Database upgrade blocked - close all other tabs
      },
      blocking() {
        // This tab is blocking database upgrade
      },
      terminated() {
        console.error('[Cache] Database connection unexpectedly terminated')
        dbPromise = null // Reset for next attempt
      },
    })
  }

  return dbPromise
}

/**
 * Cache a run with its batch items
 *
 * Stores run details and batch items in IndexedDB.
 * Automatically evicts oldest run if cache exceeds MAX_CACHED_RUNS (5).
 *
 * @param runNo - Run number (primary key)
 * @param runData - Run details from API
 * @param batchItems - Batch items for the run
 *
 * @example
 * ```typescript
 * await cacheRun(12345, runDetailsResponse, batchItemsArray);
 * ```
 */
export async function cacheRun(
  runNo: number,
  runData: RunDetailsResponse,
  batchItems: BatchItemDTO[]
): Promise<void> {
  try {
    const db = await getDB()

    // Create cache entry
    const cacheEntry: CachedRun = {
      runNo,
      runData,
      batchItems,
      cachedAt: Date.now(),
    }

    // Store in IndexedDB
    await db.put(STORE_NAME, cacheEntry)

    // Evict oldest runs if cache exceeds limit
    await evictOldRuns()
  } catch (error) {
    console.error('[Cache] Failed to cache run:', error)
    throw error
  }
}

/**
 * Retrieve cached run by run number
 *
 * Returns cached run data if available, otherwise undefined.
 *
 * @param runNo - Run number to retrieve
 * @returns Promise<CachedRun | undefined> - Cached run or undefined if not found
 *
 * @example
 * ```typescript
 * const cached = await getCachedRun(12345);
 * if (cached) {
 *   console.log('Using cached data:', cached.runData);
 * } else {
 *   console.log('No cache available - fetch from API');
 * }
 * ```
 */
export async function getCachedRun(runNo: number): Promise<CachedRun | undefined> {
  try {
    const db = await getDB()
    const cached = await db.get(STORE_NAME, runNo)

    return cached
  } catch (error) {
    console.error('[Cache] Failed to retrieve cached run:', error)
    return undefined
  }
}

/**
 * List all cached runs
 *
 * Returns all cached runs sorted by cached timestamp (newest first).
 *
 * @returns Promise<CachedRun[]> - Array of cached runs
 *
 * @example
 * ```typescript
 * const allCached = await listCachedRuns();
 * console.log(`${allCached.length} runs cached`);
 * ```
 */
export async function listCachedRuns(): Promise<CachedRun[]> {
  try {
    const db = await getDB()
    const runs = await db.getAllFromIndex(STORE_NAME, 'by-cached-at')

    // Sort newest first
    runs.sort((a, b) => b.cachedAt - a.cachedAt)

    return runs
  } catch (error) {
    console.error('[Cache] Failed to list cached runs:', error)
    return []
  }
}

/**
 * Evict oldest runs if cache exceeds limit
 *
 * Constitutional requirement: Only keep last 5 runs (FIFO eviction).
 * Automatically called after caching a new run.
 *
 * @private
 */
async function evictOldRuns(): Promise<void> {
  try {
    const db = await getDB()
    const allRuns = await db.getAllFromIndex(STORE_NAME, 'by-cached-at')

    // If cache exceeds limit, delete oldest runs
    if (allRuns.length > MAX_CACHED_RUNS) {
      // Sort by oldest first
      allRuns.sort((a, b) => a.cachedAt - b.cachedAt)

      // Calculate how many to delete
      const toDelete = allRuns.length - MAX_CACHED_RUNS

      // Delete oldest runs
      for (let i = 0; i < toDelete; i++) {
        const runToDelete = allRuns[i]
        await db.delete(STORE_NAME, runToDelete.runNo)
      }
    }
  } catch (error) {
    console.error('[Cache] Failed to evict old runs:', error)
  }
}

/**
 * Clear all cached runs
 *
 * Deletes all cached data from IndexedDB.
 * Useful for testing or manual cache reset.
 *
 * @example
 * ```typescript
 * await clearCache();
 * console.log('All cached runs cleared');
 * ```
 */
export async function clearCache(): Promise<void> {
  try {
    const db = await getDB()
    await db.clear(STORE_NAME)
  } catch (error) {
    console.error('[Cache] Failed to clear cache:', error)
    throw error
  }
}

/**
 * Get cache statistics
 *
 * Returns information about current cache state.
 *
 * @returns Promise<CacheStats> - Cache statistics
 *
 * @example
 * ```typescript
 * const stats = await getCacheStats();
 * console.log(`Cache: ${stats.count}/${stats.maxSize} runs (${stats.totalSizeKB} KB)`);
 * ```
 */
export interface CacheStats {
  count: number
  maxSize: number
  oldestCachedAt?: number
  newestCachedAt?: number
  totalSizeKB: number
}

export async function getCacheStats(): Promise<CacheStats> {
  try {
    const runs = await listCachedRuns()

    // Calculate approximate cache size
    const totalSizeKB = Math.round(JSON.stringify(runs).length / 1024)

    return {
      count: runs.length,
      maxSize: MAX_CACHED_RUNS,
      oldestCachedAt: runs.length > 0 ? runs[runs.length - 1].cachedAt : undefined,
      newestCachedAt: runs.length > 0 ? runs[0].cachedAt : undefined,
      totalSizeKB,
    }
  } catch (error) {
    console.error('[Cache] Failed to get cache stats:', error)
    return {
      count: 0,
      maxSize: MAX_CACHED_RUNS,
      totalSizeKB: 0,
    }
  }
}
