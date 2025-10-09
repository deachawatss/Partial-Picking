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
 *
 * @param itemKey - Item SKU/key
 * @param minQty - Optional minimum available quantity
 * @param options - Query options
 * @returns Query result with FEFO sorted lots
 */
export function useAvailableLots(
  itemKey: string | null,
  minQty?: number,
  options?: {
    enabled?: boolean
  }
) {
  return useQuery<LotAvailabilityDTO[]>({
    queryKey: ['lots', 'available', itemKey, minQty],
    queryFn: () => {
      if (!itemKey) throw new Error('Item key is required')
      return lotsApi.getAvailableLots(itemKey, minQty)
    },
    enabled: (options?.enabled ?? true) && !!itemKey && itemKey.length > 0,
    staleTime: 1000 * 60 * 2, // 2 minutes (inventory changes frequently)
  })
}
