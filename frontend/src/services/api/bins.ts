/**
 * Bins API Service
 *
 * Service methods for bin management endpoints:
 * - getBins: GET /api/bins
 *
 * Constitutional Requirement: Contract-first development
 * Matches specs/001-i-have-an/contracts/openapi.yaml bins endpoints
 */

import { apiClient } from './client'
import { BinsResponse, BinDTO, BinLotsResponse, BinLotInventoryDTO } from '@/types/api'

/**
 * Get TFC1 PARTIAL bins (511 bins total)
 *
 * OpenAPI Operation: GET /api/bins
 * Retrieve all bins matching project scope filters:
 * - Location = 'TFC1'
 * - User1 = 'WHTFC1'
 * - User4 = 'PARTIAL'
 *
 * Optional filters: aisle, row, rack
 *
 * @param filters - Optional filter parameters
 * @returns Promise<BinDTO[]> - List of bins matching filters
 * @throws ErrorResponse - On network error
 */
export async function getBins(filters?: {
  aisle?: string
  row?: string
  rack?: string
}): Promise<BinDTO[]> {
  const params: Record<string, string> = {}

  // Add filters only if provided
  if (filters?.aisle) params.aisle = filters.aisle
  if (filters?.row) params.row = filters.row
  if (filters?.rack) params.rack = filters.rack

  const response = await apiClient.get<BinsResponse>('/bins', { params })
  return response.data.bins
}

/**
 * Get bins for a specific lot and item (bin override workflow)
 *
 * OpenAPI Operation: GET /api/bins/lot/{lotNo}/{itemKey}
 * Retrieve bins that contain inventory for a specific lot and item.
 * Used for manual bin override: when user selects a lot, they can choose
 * a different bin that contains inventory for the same lot.
 *
 * Returns bins with inventory details:
 * - BinNo, DateExpiry, QtyOnHand, QtyCommitSales, AvailableQty, PackSize
 *
 * @param lotNo - Lot number
 * @param itemKey - Item SKU
 * @returns Promise<BinLotInventoryDTO[]> - List of bins with inventory for the lot
 * @throws ErrorResponse - On network error
 */
export async function getBinsForLot(
  lotNo: string,
  itemKey: string
): Promise<BinLotInventoryDTO[]> {
  const response = await apiClient.get<BinLotsResponse>(`/bins/lot/${lotNo}/${itemKey}`)
  return response.data.bins
}

/**
 * Get specific bin by bin number (manual input workflow)
 *
 * OpenAPI Operation: GET /api/bins/{binNo}
 * Retrieve specific bin when user manually scans/types bin number and presses Enter
 * Validates bin exists in TFC1 PARTIAL area
 *
 * @param binNo - Bin number to look up
 * @returns Promise<BinDTO> - Bin details if found
 * @throws ErrorResponse - 404 if bin not found or not in PARTIAL area
 */
export async function getBinByNumber(binNo: string): Promise<BinDTO> {
  const response = await apiClient.get<{ bin: BinDTO }>(`/bins/${binNo}`)
  return response.data.bin
}

/**
 * Bins API Service Object
 * Provides all bin-related API methods
 */
export const binsApi = {
  getBins,
  getBinsForLot,
  getBinByNumber,
}

export default binsApi
