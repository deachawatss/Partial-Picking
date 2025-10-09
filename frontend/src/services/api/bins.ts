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
import { BinsResponse, BinDTO } from '@/types/api'

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
 * Bins API Service Object
 * Provides all bin-related API methods
 */
export const binsApi = {
  getBins,
}

export default binsApi
