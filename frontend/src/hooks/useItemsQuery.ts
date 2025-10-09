/**
 * Items Query Hook
 *
 * TanStack Query hook for fetching batch items
 * Used by ItemSelectionModal
 */

import { useQuery } from '@tanstack/react-query'
import { runsApi } from '@/services/api'
import { BatchItemDTO } from '@/types/api'

/**
 * Fetch items for a batch
 *
 * @param runNo - Production run number
 * @param rowNum - Batch number (RowNum)
 * @param options - Query options
 * @returns Query result with batch items
 */
export function useBatchItems(
  runNo: number | null,
  rowNum: number | null,
  options?: {
    enabled?: boolean
  }
) {
  return useQuery<BatchItemDTO[]>({
    queryKey: ['runs', runNo, 'batches', rowNum, 'items'],
    queryFn: async () => {
      if (!runNo || !rowNum) throw new Error('Run number and batch number are required')
      return runsApi.getBatchItems(runNo, rowNum)
    },
    enabled:
      (options?.enabled ?? true) &&
      runNo !== null &&
      runNo > 0 &&
      rowNum !== null &&
      rowNum > 0,
  })
}
