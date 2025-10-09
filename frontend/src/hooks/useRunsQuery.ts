/**
 * Runs Query Hook
 *
 * TanStack Query hook for fetching run details
 * Used by RunSelectionModal for manual run number lookup
 */

import { useQuery } from '@tanstack/react-query'
import { runsApi } from '@/services/api'
import { RunDetailsResponse, RunListResponse } from '@/types/api'

/**
 * Fetch paginated list of production runs
 *
 * Used by Run Search Modal for displaying all available runs
 *
 * @param limit - Records per page (default 10, max 100)
 * @param offset - Records to skip (default 0)
 * @param options - Query options
 * @returns Query result with paginated runs list
 */
export function useRunsList(
  limit: number = 10,
  offset: number = 0,
  options?: {
    enabled?: boolean
  }
) {
  return useQuery<RunListResponse>({
    queryKey: ['runs', 'list', limit, offset],
    queryFn: () => runsApi.listRuns(limit, offset),
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60, // 1 minute (runs list should be relatively fresh)
    retry: 2,
  })
}

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
