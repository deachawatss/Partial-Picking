/**
 * Lots Query Hook
 *
 * TanStack Query hook for fetching available lots (FEFO sorted)
 * Used by LotSelectionModal
 */

import { useQuery } from '@tanstack/react-query'
import { lotsApi } from '@/services/api'
import { LotAvailabilityDTO } from '@/types/api'

/**
 * Fetch available lots for an item (FEFO sorted)
 *
 * Returns lots sorted by expiry date (First Expired, First Out)
 * Only includes TFC1 PARTIAL bins with available quantity
 * Includes PackSize from cust_PartialPicked for the specific run/batch
 *
 * @param itemKey - Item SKU/key
 * @param runNo - Production run number (required for PackSize lookup)
 * @param rowNum - Batch row number (required for PackSize lookup)
 * @param minQty - Optional minimum available quantity
 * @param options - Query options
 * @returns Query result with FEFO sorted lots (includes packSize)
 */
export function useAvailableLots(
  itemKey: string | null,
  runNo: number | null,
  rowNum: number | null,
  minQty?: number,
  options?: {
    enabled?: boolean
  }
) {
  return useQuery<LotAvailabilityDTO[]>({
    queryKey: ['lots', 'available', itemKey, runNo, rowNum, minQty],
    queryFn: () => {
      if (!itemKey) throw new Error('Item key is required')
      if (!runNo) throw new Error('Run number is required')
      if (!rowNum) throw new Error('Row number is required')
      return lotsApi.getAvailableLots(itemKey, runNo, rowNum, minQty)
    },
    enabled: (options?.enabled ?? true) && !!itemKey && itemKey.length > 0 && !!runNo && !!rowNum,
    staleTime: 1000 * 60 * 2, // 2 minutes (inventory changes frequently)
  })
}
