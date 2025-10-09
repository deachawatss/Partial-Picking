/**
 * Batches Query Hook
 *
 * TanStack Query hook for fetching batch numbers from run details
 * Used by BatchSelectionModal
 */

import { useQuery } from '@tanstack/react-query'
import { runsApi } from '@/services/api'
import { RunDetailsResponse } from '@/types/api'

/**
 * Fetch batches for a run
 *
 * Returns the run details which includes the batches array.
 * The modal can extract the batches from the response.
 *
 * @param runNo - Production run number
 * @param options - Query options
 * @returns Query result with run details containing batches
 */
export function useBatches(
  runNo: number | null,
  options?: {
    enabled?: boolean
  }
) {
  return useQuery<RunDetailsResponse>({
    queryKey: ['runs', runNo, 'details'],
    queryFn: () => {
      if (!runNo) throw new Error('Run number is required')
      return runsApi.getRunDetails(runNo)
    },
    enabled: (options?.enabled ?? true) && runNo !== null && runNo > 0,
    select: (data) => data, // Can select only batches array if needed: (data) => data.batches
  })
}
