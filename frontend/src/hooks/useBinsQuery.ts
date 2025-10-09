/**
 * Bins Query Hook
 *
 * TanStack Query hook for fetching TFC1 PARTIAL bins
 * Used by BinSelectionModal
 */

import { useQuery } from '@tanstack/react-query'
import { binsApi } from '@/services/api'
import { BinDTO } from '@/types/api'
import { useMemo } from 'react'

/**
 * Fetch all TFC1 PARTIAL bins (511 bins)
 *
 * Supports client-side search by bin number, aisle, row, or rack
 *
 * @param searchTerm - Optional search term for filtering bins
 * @param options - Query options
 * @returns Query result with filtered bins
 */
export function useBins(
  searchTerm?: string,
  options?: {
    enabled?: boolean
  }
) {
  const query = useQuery<BinDTO[]>({
    queryKey: ['bins'],
    queryFn: () => binsApi.getBins(),
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60 * 30, // 30 minutes (bin data rarely changes)
  })

  // Client-side filtering by search term
  const filteredBins = useMemo(() => {
    if (!query.data || !searchTerm || searchTerm.trim() === '') {
      return query.data ?? []
    }

    const term = searchTerm.toLowerCase().trim()

    return query.data.filter((bin) => {
      return (
        bin.binNo.toLowerCase().includes(term) ||
        bin.aisle?.toLowerCase().includes(term) ||
        bin.row?.toLowerCase().includes(term) ||
        bin.rack?.toLowerCase().includes(term) ||
        bin.description?.toLowerCase().includes(term)
      )
    })
  }, [query.data, searchTerm])

  return {
    ...query,
    data: filteredBins,
  }
}
