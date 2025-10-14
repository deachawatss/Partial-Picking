/**
 * Runs API Service
 *
 * Service methods for production run endpoints:
 * - getRunDetails: GET /api/runs/{runNo}
 * - getBatchItems: GET /api/runs/{runNo}/batches/{rowNum}/items
 * - completeRun: POST /api/runs/{runNo}/complete
 *
 * Constitutional Requirements:
 * - Contract-first development (matches openapi.yaml)
 * - Last 5 runs cached offline (FIFO eviction)
 * - Network-first for API (fresh data when online)
 * - Cache fallback when offline
 */

import { apiClient } from './client'
import {
  RunDetailsResponse,
  RunListResponse,
  BatchItemsResponse,
  CompleteRunResponse,
  BatchItemDTO,
} from '@/types/api'
import { cacheRun, getCachedRun } from '@/services/cache'

/**
 * List all production runs with pagination and optional search
 *
 * OpenAPI Operation: GET /api/runs
 *
 * No offline cache support - always fetches fresh data from API
 * Used by Run Search Modal for selecting production runs
 *
 * @param limit - Records per page (default 10, max 100)
 * @param offset - Records to skip (default 0)
 * @param search - Optional search query to filter by RunNo, FormulaId, or FormulaDesc
 * @returns Promise<RunListResponse> - Paginated list of runs
 * @throws ErrorResponse - On network error or API error
 */
export async function listRuns(
  limit: number = 10,
  offset: number = 0,
  search?: string
): Promise<RunListResponse> {
  const params: { limit: number; offset: number; search?: string } = { limit, offset }
  if (search && search.trim() !== '') {
    params.search = search.trim()
  }

  const response = await apiClient.get<RunListResponse>('/runs', { params })
  return response.data
}

/**
 * Get run details with offline cache support
 *
 * OpenAPI Operation: GET /api/runs/{runNo}
 *
 * Caching Strategy:
 * 1. Try to fetch from API (Network-first)
 * 2. On success: Cache the run data + batch items
 * 3. On offline: Return cached data if available
 * 4. On error + cached: Return cached data as fallback
 *
 * Constitutional Requirement: Last 5 runs cached (FIFO eviction)
 *
 * @param runNo - Production run number
 * @returns Promise<RunDetailsResponse> - Run details with batches
 * @throws ErrorResponse - On not found (404) or network error (when offline and no cache)
 */
export async function getRunDetails(runNo: number): Promise<RunDetailsResponse> {
  try {
    // Network-first: Try to fetch from API
    const response = await apiClient.get<RunDetailsResponse>(`/runs/${runNo}`)
    const runData = response.data

    // Fetch batch items for all batches to cache complete run data
    const batchItems: BatchItemDTO[] = []
    for (const batchNum of runData.batches) {
      try {
        const items = await getBatchItems(runNo, batchNum)
        batchItems.push(...items)
      } catch (error) {
        console.warn(`[API] Failed to fetch batch ${batchNum} items for caching:`, error)
      }
    }

    // Cache the run data (async - don't wait)
    cacheRun(runNo, runData, batchItems).catch(error => {
      console.error('[API] Failed to cache run data:', error)
    })

    return runData
  } catch (error) {
    // Check if offline (no network connection)
    if (!navigator.onLine) {
      console.warn(`[API] Offline - attempting to use cached data for run ${runNo}`)

      // Try to retrieve cached data
      const cached = await getCachedRun(runNo)
      if (cached) {
        console.log(`[API] Using cached run data for run ${runNo}`)
        return cached.runData
      } else {
        console.error(`[API] No cached data available for run ${runNo}`)
        throw new Error(`Run ${runNo} not available offline (not cached)`)
      }
    }

    // Online but API error - try cache as fallback
    console.warn(`[API] API error - attempting cache fallback for run ${runNo}:`, error)
    const cached = await getCachedRun(runNo)
    if (cached) {
      console.log(`[API] Using cached run data as fallback for run ${runNo}`)
      return cached.runData
    }

    // No cache available - re-throw error
    throw error
  }
}

/**
 * Get items for batch with offline cache support
 *
 * OpenAPI Operation: GET /api/runs/{runNo}/batches/{rowNum}/items
 *
 * Caching Strategy:
 * 1. Try to fetch from API (Network-first)
 * 2. On offline: Return cached batch items if available
 * 3. On error + cached: Return cached data as fallback
 *
 * Note: Batch items are cached together with run details in getRunDetails()
 *
 * @param runNo - Production run number
 * @param rowNum - Batch number (row number)
 * @returns Promise<BatchItemDTO[]> - Batch items with weight ranges
 * @throws ErrorResponse - On not found (404) or network error (when offline and no cache)
 */
export async function getBatchItems(runNo: number, rowNum: number): Promise<BatchItemDTO[]> {
  try {
    // Network-first: Try to fetch from API
    const response = await apiClient.get<BatchItemsResponse>(
      `/runs/${runNo}/batches/${rowNum}/items`
    )
    return response.data.items
  } catch (error) {
    // Check if offline or API error
    if (!navigator.onLine || error) {
      console.warn(`[API] Attempting to use cached batch items for run ${runNo}, batch ${rowNum}`)

      // Try to retrieve cached run data
      const cached = await getCachedRun(runNo)
      if (cached) {
        // Filter cached batch items by rowNum
        // Note: Batch items don't have rowNum field, so we return all cached items
        // The UI should filter by selected batch
        console.log(`[API] Using cached batch items for run ${runNo}`)
        return cached.batchItems
      } else {
        console.error(`[API] No cached data available for run ${runNo}`)
      }
    }

    // No cache available - re-throw error
    throw error
  }
}

/**
 * Complete run and assign pallet
 *
 * OpenAPI Operation: POST /api/runs/{runNo}/complete
 * Execute run completion workflow when all items in all batches are picked:
 * 1. Get next PT sequence number
 * 2. Update run status from NEW to PRINT
 * 3. Create pallet record (Cust_PartialPalletLotPicked)
 * 4. Trigger batch summary label printing
 *
 * @param runNo - Production run number
 * @param workstationId - Workstation identifier (e.g., WS3)
 * @returns Promise<CompleteRunResponse> - Pallet assignment and status
 * @throws ErrorResponse - On validation error (400), not found (404), or not all items picked
 */
export async function completeRun(
  runNo: number,
  workstationId: string
): Promise<CompleteRunResponse> {
  const response = await apiClient.post<CompleteRunResponse>(`/runs/${runNo}/complete`, {
    workstationId,
  })
  return response.data
}

/**
 * Get ALL items across ALL batches for a run
 *
 * OpenAPI Operation: GET /api/runs/{runNo}/items
 *
 * Used by ItemSelectionModal to show all unpicked items across all batches
 *
 * No offline cache support - always fetches fresh data from API
 *
 * @param runNo - Production run number
 * @returns Promise<BatchItemDTO[]> - All items from all batches
 * @throws ErrorResponse - On not found (404) or network error
 */
export async function getAllRunItems(runNo: number): Promise<BatchItemDTO[]> {
  const response = await apiClient.get<BatchItemsResponse>(`/runs/${runNo}/items`)
  return response.data.items
}

/**
 * Runs API Service Object
 * Provides all run-related API methods
 */
export const runsApi = {
  listRuns,
  getRunDetails,
  getBatchItems,
  getAllRunItems,
  completeRun,
}

export default runsApi
