/**
 * Lots API Service
 *
 * Service methods for lot management endpoints:
 * - getAvailableLots: GET /api/lots/available
 *
 * Constitutional Requirement: Contract-first development
 * Matches specs/001-i-have-an/contracts/openapi.yaml lots endpoints
 */

import { apiClient } from './client'
import { LotsResponse, LotAvailabilityDTO } from '@/types/api'

/**
 * Get available lots for item (FEFO sorted, TFC1 PARTIAL bins only)
 *
 * OpenAPI Operation: GET /api/lots/available
 * Retrieve available lots for picking with FEFO algorithm:
 * - Filter: Location='TFC1', User1='WHTFC1', User4='PARTIAL' (511 bins)
 * - Available Qty = QtyOnHand - QtyCommitSales > 0
 * - Sort: DateExpiry ASC, then LocationKey ASC (FEFO)
 *
 * Returns only lots with available quantity in TFC1 PARTIAL bins.
 *
 * @param itemKey - Item key/SKU
 * @param minQty - Optional minimum available quantity required
 * @returns Promise<LotAvailabilityDTO[]> - FEFO sorted lots with availability
 * @throws ErrorResponse - On network error
 */
export async function getAvailableLots(
  itemKey: string,
  minQty?: number
): Promise<LotAvailabilityDTO[]> {
  const params: Record<string, string | number> = {
    itemKey,
  }

  // Add minQty only if provided (optional parameter)
  if (minQty !== undefined && minQty > 0) {
    params.minQty = minQty
  }

  const response = await apiClient.get<LotsResponse>('/lots/available', { params })
  return response.data.lots
}

/**
 * Lots API Service Object
 * Provides all lot-related API methods
 */
export const lotsApi = {
  getAvailableLots,
}

export default lotsApi
