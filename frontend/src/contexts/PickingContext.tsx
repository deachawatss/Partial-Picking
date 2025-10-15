/**
 * Picking Context
 *
 * Manages picking workflow state and integrates with backend APIs:
 * - Run selection with auto-populated FG details
 * - Batch selection with item list loading
 * - Item selection with FEFO lot loading
 * - Pick/Unpick operations with 4-phase atomic transactions
 * - Run completion with pallet assignment
 *
 * Constitutional Requirement: Contract-first development
 * Integrates with specs/001-i-have-an/contracts/openapi.yaml endpoints
 */

import { createContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react'
import { runsApi, pickingApi, lotsApi } from '@/services/api'
import { getErrorMessage } from '@/services/api/client'
import { RunDetailsResponse, BatchItemDTO, LotAvailabilityDTO, PickRequest } from '@/types/api'
import { useAuth } from '@/hooks/use-auth'

// Context state types
export interface PickingContextType {
  // Current selections
  currentRun: RunDetailsResponse | null
  currentBatchRowNum: number | null
  currentBatchItems: BatchItemDTO[]
  currentItem: BatchItemDTO | null
  selectedLot: LotAvailabilityDTO | null
  workstationId: string

  // Loading and error states
  isLoading: boolean
  errorMessage: string | null

  // Selection methods
  selectRun: (runNo: number) => Promise<void>
  selectBatch: (rowNum: number) => Promise<void>
  selectItem: (itemKey: string, batchNo?: string) => Promise<void>
  selectLot: (lot: LotAvailabilityDTO) => void
  setWorkstation: (workstationId: string) => void

  // Action methods
  savePick: (weight: number, weightSource: 'automatic' | 'manual') => Promise<void>
  unpickItem: (lineId: number, rowNum?: number) => Promise<void>
  completeRun: () => Promise<void>

  // Reset methods
  clearSelections: () => void
  clearError: () => void
}

// React Context must be exported for hook consumption (see hooks/use-picking.ts)
// Fast Refresh architectural limitation: Context + Provider in same file is standard React pattern
// eslint-disable-next-line react-refresh/only-export-components
export const PickingContext = createContext<PickingContextType | undefined>(undefined)

interface PickingProviderProps {
  children: ReactNode
}

export function PickingProvider({ children }: PickingProviderProps) {
  // Get authenticated user for workstation ID
  const { user } = useAuth()

  // State
  const [currentRun, setCurrentRun] = useState<RunDetailsResponse | null>(null)
  const [currentBatchRowNum, setCurrentBatchRowNum] = useState<number | null>(null)
  const [currentBatchItems, setCurrentBatchItems] = useState<BatchItemDTO[]>([])
  const [currentItem, setCurrentItem] = useState<BatchItemDTO | null>(null)
  const [selectedLot, setSelectedLot] = useState<LotAvailabilityDTO | null>(null)
  // Use logged-in username truncated to 8 characters (database constraint: RecUserid/ModifiedBy)
  // Example: "deachawat" (9 chars) → "deachawa" (8 chars)
  // Fallback to "ERROR" if no authenticated user (per explicit requirement)
  const [workstationId, setWorkstationId] = useState<string>(() => {
    if (user?.username) {
      return user.username.substring(0, 8)
    }
    return 'ERROR' // Fallback if no user authenticated
  })

  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Update workstation ID when user changes (login/logout)
  useEffect(() => {
    if (user?.username) {
      const truncatedUsername = user.username.substring(0, 8)
      setWorkstationId(truncatedUsername)
    } else {
      setWorkstationId('ERROR')
    }
  }, [user])

  /**
   * T068: Select run and load run details
   * Calls GET /api/runs/{runNo}
   */
  const selectRun = useCallback(async (runNo: number): Promise<void> => {
    setIsLoading(true)
    setErrorMessage(null)

    // Clear previous run's selections immediately to prevent stale UI
    setCurrentItem(null)
    setSelectedLot(null)
    setCurrentBatchItems([])

    try {
      // Call API to get run details
      const runDetails = await runsApi.getRunDetails(runNo)

      // Update state
      setCurrentRun(runDetails)

      // Load items from ALL batches in the run
      if (runDetails.batches.length > 0) {
        try {
          // Load items from all batches and combine them
          const allItemsPromises = runDetails.batches.map(batchRowNum =>
            runsApi.getBatchItems(runDetails.runNo, batchRowNum)
          )

          const allBatchItems = await Promise.all(allItemsPromises)
          const combinedItems = allBatchItems.flat()

          // Sort items by quantity descending (pick largest first), then BatchNo descending
          // This matches official app behavior for efficient warehouse picking
          const sortedItems = [...combinedItems].sort((a, b) => {
            // Primary: Sort by totalNeeded (Partial KG) descending (largest first)
            const qtyCompare = b.totalNeeded - a.totalNeeded
            if (qtyCompare !== 0) return qtyCompare

            // Secondary: Sort by BatchNo descending (850417 before 850416)
            return b.batchNo.localeCompare(a.batchNo)
          })

          setCurrentBatchRowNum(runDetails.batches[0])
          setCurrentBatchItems(sortedItems)

          // Filter for FULLY UNPICKED items only (not partially picked)
          const unpickedItems = sortedItems.filter(item => item.pickedQty === 0)

          // Auto-select first fully unpicked item (highest quantity that needs picking)
          if (unpickedItems.length > 0) {
            const firstUnpickedItem = unpickedItems[0]

            try {
              // Load FEFO lots for first unpicked item
              const itemBatchRowNum = firstUnpickedItem.rowNum
              const lots = await lotsApi.getAvailableLots(
                firstUnpickedItem.itemKey,
                runDetails.runNo,
                itemBatchRowNum,
                firstUnpickedItem.totalNeeded
              )

              // Set current item
              setCurrentItem(firstUnpickedItem)

              // Auto-select first FEFO lot if available
              if (lots.length > 0) {
                setSelectedLot(lots[0])
              } else {
                setSelectedLot(null)
              }
            } catch (lotError) {
              // Still set the item even if lot loading fails
              setCurrentItem(firstUnpickedItem)
              setSelectedLot(null)
            }
          } else {
            // Don't auto-select anything when all items are picked
            setCurrentItem(null)
            setSelectedLot(null)
          }
        } catch (batchError) {
          // Don't fail the entire run selection if batch loading fails
          setCurrentBatchRowNum(null)
          setCurrentBatchItems([])
        }
      } else {
        // No batches in run, reset downstream
        setCurrentBatchRowNum(null)
        setCurrentBatchItems([])
        setCurrentItem(null)
        setSelectedLot(null)
      }
    } catch (error) {
      const message = getErrorMessage(error)
      console.error('[Picking] Failed to load run:', message)
      setErrorMessage(message)

      // Clear state on error
      setCurrentRun(null)
      setCurrentBatchRowNum(null)
      setCurrentBatchItems([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * T068: Select batch and load batch items
   * Calls GET /api/runs/{runNo}/batches/{rowNum}/items
   */
  const selectBatch = useCallback(async (rowNum: number): Promise<void> => {
    if (!currentRun) {
      setErrorMessage('Please select a run first')
      return
    }

    setIsLoading(true)
    setErrorMessage(null)

    try {
      // Call API to get batch items
      const items = await runsApi.getBatchItems(currentRun.runNo, rowNum)

      // Update state
      setCurrentBatchRowNum(rowNum)
      setCurrentBatchItems(items)

      // Reset downstream selections
      setCurrentItem(null)
      setSelectedLot(null)
    } catch (error) {
      const message = getErrorMessage(error)
      console.error('[Picking] Failed to load batch items:', message)
      setErrorMessage(message)

      // Clear state on error
      setCurrentBatchRowNum(null)
      setCurrentBatchItems([])
    } finally {
      setIsLoading(false)
    }
  }, [currentRun])

  /**
   * T068: Select item and auto-load FEFO lots
   * Calls GET /api/lots/available?itemKey={itemKey}&minQty={totalNeeded}
   */
  const selectItem = useCallback(async (itemKey: string, batchNo?: string): Promise<void> => {
    if (!currentRun) {
      setErrorMessage('Please select a run first')
      return
    }

    // Find specific item by itemKey AND batchNo (for individual row selection)
    // If batchNo not provided, find first item with matching itemKey (for modal compatibility)
    const item = currentBatchItems.find(i =>
      i.itemKey === itemKey && (!batchNo || i.batchNo === batchNo)
    )

    if (!item) {
      console.error('[Picking] Item NOT FOUND! Search criteria:', { itemKey, batchNo })
      setErrorMessage(`Item ${itemKey} ${batchNo ? `(batch ${batchNo})` : ''} not found in current batch`)
      return
    }

    setIsLoading(true)
    setErrorMessage(null)

    try {
      // Use the item's actual rowNum (batch row number from database)
      const itemBatchRowNum = item.rowNum

      // Call API to get available lots (FEFO sorted with PackSize)
      // Use item's specific batch number for correct PackSize lookup
      const lots = await lotsApi.getAvailableLots(
        itemKey,
        currentRun.runNo,
        itemBatchRowNum,
        item.totalNeeded
      )

      // Update state
      setCurrentItem(item)

      // Auto-select first FEFO lot if available
      if (lots.length > 0) {
        const fefoLot = lots[0]
        setSelectedLot(fefoLot)
      } else {
        setSelectedLot(null)
      }
    } catch (error) {
      const message = getErrorMessage(error)
      console.error('[Picking] Failed to load FEFO lots:', message)
      setErrorMessage(message)

      // Set item but clear lot on error
      setCurrentItem(item)
      setSelectedLot(null)
    } finally {
      setIsLoading(false)
    }
  }, [currentRun, currentBatchItems])

  /**
   * T068: Manually select a lot (override FEFO)
   */
  const selectLot = useCallback((lot: LotAvailabilityDTO): void => {
    setSelectedLot(lot)
    setErrorMessage(null)
  }, [])

  /**
   * T068: Set workstation ID
   */
  const setWorkstation = useCallback((id: string): void => {
    setWorkstationId(id)
  }, [])

  /**
   * T068: Save pick with 4-phase atomic transaction + CUSTOM1 audit trail
   * Calls POST /api/picks
   *
   * @param weight - Weight from scale or manual entry
   * @param weightSource - 'automatic' (from scale/FETCH WEIGHT) or 'manual' (numeric keyboard)
   */
  const savePick = useCallback(async (weight: number, weightSource: 'automatic' | 'manual'): Promise<void> => {
    // Validation
    if (!currentRun || !currentItem || !selectedLot) {
      setErrorMessage('Please complete all selections before saving pick')
      return
    }

    setIsLoading(true)
    setErrorMessage(null)

    try {
      // Use the item's actual rowNum (batch row number from database)
      const itemBatchRowNum = currentItem.rowNum

      // Use the item's actual lineId from database (not calculated)
      const lineId = currentItem.lineId

      if (!lineId) {
        throw new Error('LineId missing from item data')
      }

      // Build pick request matching OpenAPI spec
      const pickRequest: PickRequest = {
        runNo: currentRun.runNo,
        rowNum: itemBatchRowNum,
        lineId,
        lotNo: selectedLot.lotNo,
        binNo: selectedLot.binNo,
        weight,
        weightSource, // CUSTOM1 audit trail: 'MANUAL' when manual, NULL when automatic
        workstationId,
      }

      // Call API to save pick (4-phase atomic transaction)
      await pickingApi.savePick(pickRequest)

      // Refresh all batch items to show updated picked quantities
      await selectRun(currentRun.runNo)

      // Clear current item and lot selections (keep batches loaded for next item)
      setCurrentItem(null)
      setSelectedLot(null)
    } catch (error) {
      const message = getErrorMessage(error)
      console.error('[Picking] Failed to save pick:', message)
      setErrorMessage(message)
      throw error // Re-throw for UI to handle
    } finally {
      setIsLoading(false)
    }
  }, [currentRun, currentItem, selectedLot, workstationId, selectRun])

  /**
   * T068: Unpick item (reset to 0, preserve audit trail)
   * Calls DELETE /api/picks/{runNo}/{rowNum}/{lineId}
   *
   * Note: This function expects lineId within a specific batch.
   * For multi-batch runs, ensure the caller provides the correct batch context.
   */
  const unpickItem = useCallback(async (lineId: number, rowNum?: number): Promise<void> => {
    if (!currentRun) {
      setErrorMessage('No run selected')
      return
    }

    // Use provided rowNum or fall back to currentBatchRowNum
    const batchRowNum = rowNum ?? currentBatchRowNum
    if (batchRowNum === null) {
      setErrorMessage('No batch context for unpick operation')
      return
    }

    setIsLoading(true)
    setErrorMessage(null)

    try {
      // Call API to unpick item
      await pickingApi.unpickItem(
        currentRun.runNo,
        batchRowNum,
        lineId,
        workstationId
      )

      // Refresh all batch items to show updated picked quantities
      await selectRun(currentRun.runNo)

      // Clear current item and lot selections
      setCurrentItem(null)
      setSelectedLot(null)
    } catch (error) {
      const message = getErrorMessage(error)
      console.error('[Picking] Failed to unpick item:', message)
      setErrorMessage(message)
      throw error // Re-throw for UI to handle
    } finally {
      setIsLoading(false)
    }
  }, [currentRun, currentBatchRowNum, workstationId, selectRun])

  /**
   * T068: Complete run and assign pallet
   * Calls POST /api/runs/{runNo}/complete
   */
  const completeRun = useCallback(async (): Promise<void> => {
    if (!currentRun) {
      setErrorMessage('No run selected')
      return
    }

    setIsLoading(true)
    setErrorMessage(null)

    try {
      // Call API to complete run
      await runsApi.completeRun(currentRun.runNo, workstationId)

      // Update run status in state
      setCurrentRun({
        ...currentRun,
        status: 'PRINT',
      })
    } catch (error) {
      const message = getErrorMessage(error)
      console.error('[Picking] Failed to complete run:', message)
      setErrorMessage(message)
      throw error // Re-throw for UI to handle
    } finally {
      setIsLoading(false)
    }
  }, [currentRun, workstationId])

  /**
   * Clear all selections and reset state
   */
  const clearSelections = useCallback((): void => {
    setCurrentRun(null)
    setCurrentBatchRowNum(null)
    setCurrentBatchItems([])
    setCurrentItem(null)
    setSelectedLot(null)
    setErrorMessage(null)
  }, [])

  /**
   * Clear error message
   */
  const clearError = useCallback((): void => {
    setErrorMessage(null)
  }, [])

  // Memoize context value to prevent unnecessary re-renders
  // MUST include ALL dependencies (state AND functions) to prevent re-render loops
  const contextValue = useMemo(
    () => ({
      currentRun,
      currentBatchRowNum,
      currentBatchItems,
      currentItem,
      selectedLot,
      workstationId,
      isLoading,
      errorMessage,
      selectRun,
      selectBatch,
      selectItem,
      selectLot,
      setWorkstation,
      savePick,
      unpickItem,
      completeRun,
      clearSelections,
      clearError,
    }),
    [
      // State values
      currentRun,
      currentBatchRowNum,
      currentBatchItems,
      currentItem,
      selectedLot,
      workstationId,
      isLoading,
      errorMessage,
      // Functions (already memoized with useCallback)
      selectRun,
      selectBatch,
      selectItem,
      selectLot,
      setWorkstation,
      savePick,
      unpickItem,
      completeRun,
      clearSelections,
      clearError,
    ]
  )

  return (
    <PickingContext.Provider value={contextValue}>
      {children}
    </PickingContext.Provider>
  )
}
