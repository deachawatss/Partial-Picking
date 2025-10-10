/**
 * Picking API Service
 *
 * Service methods for picking operations endpoints:
 * - savePick: POST /api/picks
 * - unpickItem: DELETE /api/picks/{runNo}/{rowNum}/{lineId}
 *
 * Constitutional Requirement: Contract-first development
 * Matches specs/001-i-have-an/contracts/openapi.yaml picking endpoints
 */

import { apiClient } from './client'
import {
  PendingItemsResponse,
  PickRequest,
  PickResponse,
  PickedLotsResponse,
  UnpickResponse,
} from '@/types/api'

/**
 * Execute 4-phase atomic picking transaction
 *
 * OpenAPI Operation: POST /api/picks
 * Save picked item with 4-phase atomic transaction:
 *
 * Phase 1: Lot allocation (Cust_PartialLotPicked record creation)
 * Phase 2: Weight update (cust_PartialPicked.PickedPartialQty, ItemBatchStatus, PickingDate, ModifiedBy)
 * Phase 3: Transaction recording (LotTransaction with TransactionType=5)
 * Phase 4: Inventory commitment (LotMaster.QtyCommitSales increment)
 *
 * All phases execute atomically with rollback on failure.
 *
 * @param request - Pick request with run, item, lot, bin, weight, workstation
 * @returns Promise<PickResponse> - Pick details with lot transaction number
 * @throws ErrorResponse - On validation error (400) or weight tolerance error
 *
 * Error Examples:
 * - VALIDATION_WEIGHT_OUT_OF_TOLERANCE: Weight outside acceptable range
 * - BUSINESS_ITEM_ALREADY_PICKED: Item already picked for this batch
 */
export async function savePick(request: PickRequest): Promise<PickResponse> {
  const response = await apiClient.post<PickResponse>('/picks', request)
  return response.data
}

/**
 * Unpick item (reset to 0 while preserving audit trail)
 *
 * OpenAPI Operation: DELETE /api/picks/{runNo}/{rowNum}/{lineId}
 * Execute unpick workflow atomically:
 * 1. Reset PickedPartialQty to 0
 * 2. Delete Cust_PartialLotPicked records
 * 3. Delete LotTransaction records
 * 4. Decrement LotMaster.QtyCommitSales
 *
 * Audit trail preserved: ItemBatchStatus, PickingDate, ModifiedBy remain unchanged
 *
 * @param runNo - Production run number
 * @param rowNum - Batch number (row number)
 * @param lineId - Item line identifier
 * @param workstationId - Workstation identifier (e.g., WS3)
 * @returns Promise<UnpickResponse> - Unpick confirmation with reset details
 * @throws ErrorResponse - On not found (404) or network error
 */
export async function unpickItem(
  runNo: number,
  rowNum: number,
  lineId: number,
  workstationId: string
): Promise<UnpickResponse> {
  const response = await apiClient.delete<UnpickResponse>(`/picks/${runNo}/${rowNum}/${lineId}`, {
    data: { workstationId },
  })
  return response.data
}

/**
 * Get all picked lots for a run (for View Lots Modal)
 *
 * OpenAPI Operation: GET /api/picks/run/{runNo}/lots
 * Fetches all picked lots for the specified production run.
 * Used in View Lots Modal to display picked items with delete capability.
 *
 * Returns:
 * - Batch No, Lot No, Item Key, Location Key, Expiry Date (DD/MM/YYYY)
 * - Qty Received, Bin No, Pack Size
 * - Row Num, Line ID (for composite key operations)
 *
 * @param runNo - Production run number
 * @returns Promise<PickedLotsResponse> - List of picked lots with run info
 * @throws ErrorResponse - On not found (404) or query error
 */
export async function getPickedLotsForRun(runNo: number): Promise<PickedLotsResponse> {
  const response = await apiClient.get<PickedLotsResponse>(`/picks/run/${runNo}/lots`)
  return response.data
}

/**
 * Get all pending (unpicked or partially picked) items for a run
 *
 * OpenAPI Operation: GET /api/picks/run/{runNo}/pending
 * Fetches items where PickedPartialQty < ToPickedPartialQty.
 * Used in View Lots Modal - Pending Tab to display items still needing to be picked.
 *
 * Returns:
 * - Batch No, Item Key, To Picked Qty
 * - Row Num, Line ID (for composite key operations)
 *
 * @param runNo - Production run number
 * @returns Promise<PendingItemsResponse> - List of pending items with run info
 * @throws ErrorResponse - On query error
 */
export async function getPendingItemsForRun(runNo: number): Promise<PendingItemsResponse> {
  const response = await apiClient.get<PendingItemsResponse>(`/picks/run/${runNo}/pending`)
  return response.data
}

/**
 * Picking API Service Object
 * Provides all picking-related API methods
 */
export const pickingApi = {
  savePick,
  unpickItem,
  getPickedLotsForRun,
  getPendingItemsForRun,
}

export default pickingApi
