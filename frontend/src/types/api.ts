/**
 * API Type Definitions
 * Generated from specs/001-i-have-an/contracts/openapi.yaml
 *
 * IMPORTANT: These types match the OpenAPI contract exactly.
 * Field names use camelCase as specified in the OpenAPI spec.
 */

// ============================================================================
// REQUEST TYPES
// ============================================================================

export interface LoginRequest {
  username: string
  password: string
}

export interface PickRequest {
  runNo: number
  rowNum: number
  lineId: number
  lotNo: string
  binNo: string
  weight: number
  weightSource: 'automatic' | 'manual'
  workstationId: string
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface LoginResponse {
  token: string
  user: UserDTO
}

export interface UserDTO {
  userid: number
  username: string
  firstName?: string | null
  lastName?: string | null
  department?: string | null
  authSource: 'LOCAL' | 'LDAP'
  permissions?: string[]
}

export interface RunListResponse {
  runs: RunListItemDTO[]
  pagination: PaginationDTO
}

export interface RunListItemDTO {
  runNo: number
  formulaId: string
  formulaDesc: string
  status: 'NEW' | 'PRINT'
  batchCount: number
}

export interface PaginationDTO {
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export interface RunDetailsResponse {
  runNo: number
  fgItemKey: string
  fgDescription: string
  batches: number[]
  productionDate: string
  status: 'NEW' | 'PRINT'
  noOfBatches: number
}

export interface BatchItemsResponse {
  items: BatchItemDTO[]
}

export interface BatchItemDTO {
  itemKey: string
  batchNo: string
  rowNum: number
  lineId: number
  description: string
  totalNeeded: number
  pickedQty: number
  remainingQty: number
  weightRangeLow: number
  weightRangeHigh: number
  toleranceKG: number
  allergen: string
  status?: 'Allocated' | null
  totalAvailableSOH: number
}

export interface PickResponse {
  runNo: number
  rowNum: number
  lineId: number
  itemKey: string
  lotNo: string
  binNo: string
  pickedQty: number
  targetQty: number
  status: 'Allocated'
  pickingDate: string
  lotTranNo: number
}

export interface LotAvailabilityDTO {
  lotNo: string
  itemKey: string
  binNo: string
  locationKey: 'TFC1'
  qtyOnHand: number
  qtyCommitSales: number
  availableQty: number
  expiryDate: string
  lotStatus: 'P' | 'H' | 'C'
  aisle?: string | null
  row?: string | null
  rack?: string | null
  packSize: number
}

export interface BinDTO {
  location: 'TFC1'
  binNo: string
  description?: string | null
  aisle?: string | null
  row?: string | null
  rack?: string | null
  user1: 'WHTFC1'
  user4: 'PARTIAL'
}

export interface BinContentsDTO {
  bin: BinDTO
  lots: BinLotDTO[]
}

export interface BinLotDTO {
  lotNo: string
  itemKey: string
  qtyOnHand: number
  expiryDate: string
}

export interface BinLotInventoryDTO {
  binNo: string
  expiryDate: string
  qtyOnHand: number
  qtyCommitSales: number
  availableQty: number
  packSize: number
}

export interface WorkstationDTO {
  workstationId: string
  workstationName: string
  smallScaleId?: string | null
  bigScaleId?: string | null
  status: 'Active' | 'Inactive'
  smallScale?: WeightScaleDTO
  bigScale?: WeightScaleDTO
}

export interface WeightScaleDTO {
  scaleId: string
  scaleType: 'SMALL' | 'BIG'
  comPort: string
  baudRate: 9600 | 19200 | 38400 | 115200
  capacity?: number | null
  precision?: number | null
  status: 'Active' | 'Inactive'
}

export interface SequenceResponse {
  seqName: string
  seqNum: number
}

export interface CompleteRunResponse {
  runNo: number
  palletId: string
  status: 'PRINT'
  completedAt: string
}

export interface UnpickResponse {
  runNo: number
  rowNum: number
  lineId: number
  itemKey: string
  pickedQty: number
  status: 'Allocated'
  unpickedAt: string
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface ErrorResponse {
  error: {
    code: string
    message: string
    correlationId: string
    details?: Record<string, unknown>
  }
}

// ============================================================================
// API RESPONSE WRAPPERS
// ============================================================================

export interface LotsResponse {
  lots: LotAvailabilityDTO[]
}

export interface BinsResponse {
  bins: BinDTO[]
}

export interface BinLotsResponse {
  bins: BinLotInventoryDTO[]
}

export interface WorkstationsResponse {
  workstations: WorkstationDTO[]
}

// ============================================================================
// PICKED LOTS (View Lots Modal)
// ============================================================================

export interface PickedLotDTO {
  lotTranNo: number
  batchNo: string
  lotNo: string
  itemKey: string
  locationKey: string
  dateExp?: string // DD/MM/YYYY format
  qtyReceived: number
  binNo: string
  packSize: number
  rowNum: number
  lineId: number
}

export interface PickedLotsResponse {
  pickedLots: PickedLotDTO[]
  runNo: number
}

// ============================================================================
// PENDING ITEMS (View Lots Modal - Pending Tab)
// ============================================================================

export interface PendingItemDTO {
  batchNo: string
  itemKey: string
  toPickedQty: number
  rowNum: number
  lineId: number
}

export interface PendingItemsResponse {
  pendingItems: PendingItemDTO[]
  runNo: number
}

// ============================================================================
// BATCH SUMMARY (Batch Summary Print)
// ============================================================================

export interface BatchSummaryResponse {
  batches: BatchSummaryDTO[]
}

export interface BatchSummaryDTO {
  runNo: number
  rowNum: number
  batchNo: string
  formulaId: string
  formulaDesc: string
  productionDate: string // DD/MM/YY format
  pageNum: number
  totalPages: number
  items: BatchSummaryItemDTO[]
}

export interface BatchSummaryItemDTO {
  itemKey: string
  binNo: string
  lotNo: string
  qtyKg: number
}
