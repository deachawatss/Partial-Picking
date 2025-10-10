/**
 * Picked Lots Query Hook
 *
 * TanStack Query hook for fetching picked lots for a run
 * Used by ViewLotsModal
 */

import { useQuery } from '@tanstack/react-query'
import { pickingApi } from '@/services/api'
import { PickedLotsResponse } from '@/types/api'

/**
 * Fetch all picked lots for a production run
 *
 * Returns all picked lots with batch, lot, item, and bin information.
 * Used in View Lots Modal to display picked items with delete capability.
 *
 * @param runNo - Production run number
 * @param options - Query options
 * @returns Query result with picked lots (sorted by batch and lot)
 */
export function usePickedLots(
  runNo: number | null,
  options?: {
    enabled?: boolean
  }
) {
  return useQuery<PickedLotsResponse>({
    queryKey: ['picks', 'run', runNo, 'lots'],
    queryFn: () => {
      if (!runNo) throw new Error('Run number is required')
      return pickingApi.getPickedLotsForRun(runNo)
    },
    enabled: (options?.enabled ?? true) && !!runNo,
    staleTime: 1000 * 30, // 30 seconds (refetch when modal reopens)
    refetchOnWindowFocus: true, // Refetch when user returns to window
  })
}
