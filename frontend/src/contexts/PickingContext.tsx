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

import { createContext, useContext, useState, ReactNode } from 'react'
import { runsApi, pickingApi, lotsApi } from '@/services/api'
import { getErrorMessage } from '@/services/api/client'
import { RunDetailsResponse, BatchItemDTO, LotAvailabilityDTO, PickRequest } from '@/types/api'

// Context state types
interface PickingContextType {
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
  selectItem: (itemKey: string) => Promise<void>
  selectLot: (lot: LotAvailabilityDTO) => void
  setWorkstation: (workstationId: string) => void

  // Action methods
  savePick: (weight: number) => Promise<void>
  unpickItem: (lineId: number) => Promise<void>
  completeRun: () => Promise<void>

  // Reset methods
  clearSelections: () => void
  clearError: () => void
}

const PickingContext = createContext<PickingContextType | undefined>(undefined)

interface PickingProviderProps {
  children: ReactNode
}

export function PickingProvider({ children }: PickingProviderProps) {
  // State
  const [currentRun, setCurrentRun] = useState<RunDetailsResponse | null>(null)
  const [currentBatchRowNum, setCurrentBatchRowNum] = useState<number | null>(null)
  const [currentBatchItems, setCurrentBatchItems] = useState<BatchItemDTO[]>([])
  const [currentItem, setCurrentItem] = useState<BatchItemDTO | null>(null)
  const [selectedLot, setSelectedLot] = useState<LotAvailabilityDTO | null>(null)
  const [workstationId, setWorkstationId] = useState<string>('WS3') // Default workstation

  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  /**
   * T068: Select run and load run details
   * Calls GET /api/runs/{runNo}
   */
  const selectRun = async (runNo: number): Promise<void> => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      console.log('[Picking] Loading run details:', runNo)

      // Call API to get run details
      const runDetails = await runsApi.getRunDetails(runNo)

      console.log('[Picking] Run loaded:', {
        runNo: runDetails.runNo,
        fgItemKey: runDetails.fgItemKey,
        batches: runDetails.batches,
      })

      // Update state
      setCurrentRun(runDetails)

      // Reset downstream selections
      setCurrentBatchRowNum(null)
      setCurrentBatchItems([])
      setCurrentItem(null)
      setSelectedLot(null)
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
  }

  /**
   * T068: Select batch and load batch items
   * Calls GET /api/runs/{runNo}/batches/{rowNum}/items
   */
  const selectBatch = async (rowNum: number): Promise<void> => {
    if (!currentRun) {
      setErrorMessage('Please select a run first')
      return
    }

    setIsLoading(true)
    setErrorMessage(null)

    try {
      console.log('[Picking] Loading batch items:', { runNo: currentRun.runNo, rowNum })

      // Call API to get batch items
      const items = await runsApi.getBatchItems(currentRun.runNo, rowNum)

      console.log('[Picking] Batch items loaded:', {
        count: items.length,
        items: items.map(i => i.itemKey),
      })

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
  }

  /**
   * T068: Select item and auto-load FEFO lots
   * Calls GET /api/lots/available?itemKey={itemKey}&minQty={remainingQty}
   */
  const selectItem = async (itemKey: string): Promise<void> => {
    if (!currentRun || currentBatchRowNum === null) {
      setErrorMessage('Please select a run and batch first')
      return
    }

    // Find item in current batch items
    const item = currentBatchItems.find(i => i.itemKey === itemKey)
    if (!item) {
      setErrorMessage('Item not found in current batch')
      return
    }

    setIsLoading(true)
    setErrorMessage(null)

    try {
      console.log('[Picking] Loading FEFO lots for item:', itemKey)

      // Call API to get available lots (FEFO sorted)
      // Use remainingQty as minQty to filter lots
      const lots = await lotsApi.getAvailableLots(itemKey, item.remainingQty)

      console.log('[Picking] FEFO lots loaded:', {
        count: lots.length,
        firstLot: lots[0]?.lotNo,
        firstExpiry: lots[0]?.expiryDate,
      })

      // Update state
      setCurrentItem(item)

      // Auto-select first FEFO lot if available
      if (lots.length > 0) {
        const fefoLot = lots[0]
        console.log('[Picking] Auto-selected FEFO lot:', {
          lotNo: fefoLot.lotNo,
          binNo: fefoLot.binNo,
          expiryDate: fefoLot.expiryDate,
          availableQty: fefoLot.availableQty,
        })
        setSelectedLot(fefoLot)
      } else {
        console.warn('[Picking] No available lots found for item:', itemKey)
        setSelectedLot(null)
        setErrorMessage(`No available lots found for ${itemKey} with sufficient quantity`)
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
  }

  /**
   * T068: Manually select a lot (override FEFO)
   */
  const selectLot = (lot: LotAvailabilityDTO): void => {
    console.log('[Picking] Manually selected lot:', {
      lotNo: lot.lotNo,
      binNo: lot.binNo,
      expiryDate: lot.expiryDate,
    })
    setSelectedLot(lot)
    setErrorMessage(null)
  }

  /**
   * T068: Set workstation ID
   */
  const setWorkstation = (id: string): void => {
    console.log('[Picking] Set workstation:', id)
    setWorkstationId(id)
  }

  /**
   * T068: Save pick with 4-phase atomic transaction
   * Calls POST /api/picks
   */
  const savePick = async (weight: number): Promise<void> => {
    // Validation
    if (!currentRun || currentBatchRowNum === null || !currentItem || !selectedLot) {
      setErrorMessage('Please complete all selections before saving pick')
      return
    }

    setIsLoading(true)
    setErrorMessage(null)

    try {
      console.log('[Picking] Saving pick:', {
        runNo: currentRun.runNo,
        rowNum: currentBatchRowNum,
        itemKey: currentItem.itemKey,
        lotNo: selectedLot.lotNo,
        binNo: selectedLot.binNo,
        weight,
        workstationId,
      })

      // Find lineId for this item (based on batch items array index + 1)
      const lineId = currentBatchItems.findIndex(i => i.itemKey === currentItem.itemKey) + 1

      if (lineId === 0) {
        throw new Error('Item not found in batch items')
      }

      // Build pick request matching OpenAPI spec
      const pickRequest: PickRequest = {
        runNo: currentRun.runNo,
        rowNum: currentBatchRowNum,
        lineId,
        lotNo: selectedLot.lotNo,
        binNo: selectedLot.binNo,
        weight,
        workstationId,
      }

      // Call API to save pick (4-phase atomic transaction)
      const pickResponse = await pickingApi.savePick(pickRequest)

      console.log('[Picking] Pick saved successfully:', {
        lotTranNo: pickResponse.lotTranNo,
        pickedQty: pickResponse.pickedQty,
        status: pickResponse.status,
      })

      // Refresh batch items to show updated picked quantities
      await selectBatch(currentBatchRowNum)

      // Clear current item and lot selections (keep batch loaded for next item)
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
  }

  /**
   * T068: Unpick item (reset to 0, preserve audit trail)
   * Calls DELETE /api/picks/{runNo}/{rowNum}/{lineId}
   */
  const unpickItem = async (lineId: number): Promise<void> => {
    if (!currentRun || currentBatchRowNum === null) {
      setErrorMessage('No run or batch selected')
      return
    }

    setIsLoading(true)
    setErrorMessage(null)

    try {
      console.log('[Picking] Unpicking item:', {
        runNo: currentRun.runNo,
        rowNum: currentBatchRowNum,
        lineId,
        workstationId,
      })

      // Call API to unpick item
      const unpickResponse = await pickingApi.unpickItem(
        currentRun.runNo,
        currentBatchRowNum,
        lineId,
        workstationId
      )

      console.log('[Picking] Item unpicked successfully:', {
        itemKey: unpickResponse.itemKey,
        pickedQty: unpickResponse.pickedQty, // Should be 0
        status: unpickResponse.status, // Preserved for audit
      })

      // Refresh batch items to show updated picked quantities
      await selectBatch(currentBatchRowNum)

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
  }

  /**
   * T068: Complete run and assign pallet
   * Calls POST /api/runs/{runNo}/complete
   */
  const completeRun = async (): Promise<void> => {
    if (!currentRun) {
      setErrorMessage('No run selected')
      return
    }

    setIsLoading(true)
    setErrorMessage(null)

    try {
      console.log('[Picking] Completing run:', {
        runNo: currentRun.runNo,
        workstationId,
      })

      // Call API to complete run
      const completeResponse = await runsApi.completeRun(currentRun.runNo, workstationId)

      console.log('[Picking] Run completed successfully:', {
        palletId: completeResponse.palletId,
        status: completeResponse.status,
        completedAt: completeResponse.completedAt,
      })

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
  }

  /**
   * Clear all selections and reset state
   */
  const clearSelections = (): void => {
    console.log('[Picking] Clearing all selections')
    setCurrentRun(null)
    setCurrentBatchRowNum(null)
    setCurrentBatchItems([])
    setCurrentItem(null)
    setSelectedLot(null)
    setErrorMessage(null)
  }

  /**
   * Clear error message
   */
  const clearError = (): void => {
    setErrorMessage(null)
  }

  return (
    <PickingContext.Provider
      value={{
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
      }}
    >
      {children}
    </PickingContext.Provider>
  )
}

export function usePicking(): PickingContextType {
  const context = useContext(PickingContext)
  if (context === undefined) {
    throw new Error('usePicking must be used within a PickingProvider')
  }
  return context
}
