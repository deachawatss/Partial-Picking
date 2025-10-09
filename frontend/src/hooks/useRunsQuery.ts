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
 * Fetch paginated list of production runs with optional search
 *
 * Used by Run Search Modal for displaying and filtering available runs
 *
 * @param limit - Records per page (default 10, max 100)
 * @param offset - Records to skip (default 0)
 * @param search - Optional search query to filter by RunNo, FormulaId, or FormulaDesc
 * @param options - Query options
 * @returns Query result with paginated runs list
 */
export function useRunsList(
  limit: number = 10,
  offset: number = 0,
  search?: string,
  options?: {
    enabled?: boolean
  }
) {
  return useQuery<RunListResponse>({
    queryKey: ['runs', 'list', limit, offset, search],
    queryFn: () => runsApi.listRuns(limit, offset, search),
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 30, // 30 seconds (shorter for search results)
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
