/**
 * Runs Query Hook
 *
 * TanStack Query hook for fetching run details
 * Used by RunSelectionModal for manual run number lookup
 */

import { useQuery } from '@tanstack/react-query'
import { runsApi } from '@/services/api'
import { RunDetailsResponse } from '@/types/api'

/**
 * Fetch run details by run number
 *
 * @param runNo - Production run number to fetch
 * @param options - Query options
 * @returns Query result with run details
 */
export function useRunDetails(
  runNo: number | null,
  options?: {
    enabled?: boolean
  }
) {
  return useQuery<RunDetailsResponse>({
    queryKey: ['runs', runNo],
    queryFn: () => {
      if (!runNo) throw new Error('Run number is required')
      return runsApi.getRunDetails(runNo)
    },
    enabled: (options?.enabled ?? true) && runNo !== null && runNo > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  })
}
