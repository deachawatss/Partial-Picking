/**
 * Partial Picking Page
 *
 * Main picking interface for warehouse operators with:
 * - Weight progress bar with real-time scale updates and tolerance markers
 * - Horizontal header rows for Run/Batch/Item selection
 * - FEFO lot selection with auto-population
 * - Save/Add Lot/View Lots/Print/Logout operations
 * - Complete Run workflow
 *
 * Optimized for 1280x1024 (no scroll) and 1920x1080 (responsive)
 * WCAG 2.2 AA compliant
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { usePicking } from '@/hooks/use-picking'
import { useAuth } from '@/hooks/use-auth'
import { useWeightScale } from '@/hooks/useWeightScale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { WeightProgressBar } from '@/components/picking/WeightProgressBar'
import { RunSelectionModal } from '@/components/picking/RunSelectionModal'
import { BatchSelectionModal } from '@/components/picking/BatchSelectionModal'
import { ItemSelectionModal } from '@/components/picking/ItemSelectionModal'
import { LotSelectionModal } from '@/components/picking/LotSelectionModal'
import { BinSelectionModal } from '@/components/picking/BinSelectionModal'
import { ViewLotsModal } from '@/components/picking/ViewLotsModal'
import { BatchTicketGrid } from '@/components/picking/BatchTicketGrid'
import { NumericKeyboard } from '@/components/picking/NumericKeyboard'
import { usePickedLots } from '@/hooks/usePickedLotsQuery'
import { printLabels } from '@/utils/printLabel'
import { printBatchSummary } from '@/utils/printBatchSummary'
import { getLotByNumber } from '@/services/api/lots'
import { getBinByNumber } from '@/services/api/bins'
import { getBatchSummary } from '@/services/api/runs'
import { getErrorMessage } from '@/services/api/client'

export function PartialPickingPage() {
  // Navigation and auth
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  // Picking context with real API integration
  const {
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
    savePick,
    unpickItem,

    clearError,
  } = usePicking()

  // Modal states
  const [showRunModal, setShowRunModal] = useState(false)
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [showItemModal, setShowItemModal] = useState(false)
  const [showLotModal, setShowLotModal] = useState(false)
  const [showBinModal, setShowBinModal] = useState(false)
  const [showViewLotsModal, setShowViewLotsModal] = useState(false)
  const [showKeyboard, setShowKeyboard] = useState(false)
  const [keyboardKey, setKeyboardKey] = useState(0)  // Force remount on open

  // Dual scale WebSocket integration
  const [selectedScale, setSelectedScale] = useState<'small' | 'big'>('small')
  const smallScale = useWeightScale('small', { debug: true })
  const bigScale = useWeightScale('big', { debug: true })

  // Get current scale based on selection
  const currentScale = selectedScale === 'small' ? smallScale : bigScale

  // Weight input state (can be manually entered or auto-populated from scale)
  const [manualWeight, setManualWeight] = useState<number | null>(null)
  const [isManualEntryActive, setIsManualEntryActive] = useState(false)
  const [frozenWeight, setFrozenWeight] = useState<number>(0)

  const currentWeight = isManualEntryActive
    ? frozenWeight  // Use frozen weight during manual entry
    : (manualWeight !== null ? manualWeight : currentScale.weight)

  const scaleStatuses = {
    small: { online: smallScale.online, stable: smallScale.stable },
    big: { online: bigScale.online, stable: bigScale.stable },
  }

  // Success notification state
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [gridFilter, setGridFilter] = useState<'pending' | 'picked'>('pending')

  // Fetch picked lots for delete all and re-print operations
  const { data: pickedLotsData } = usePickedLots(currentRun?.runNo || null, {
    enabled: !!currentRun?.runNo,
  })

  // Run No manual input state
  const [runInputValue, setRunInputValue] = useState('')
  const [previousRunValue, setPreviousRunValue] = useState('')
  const [isRunFieldActive, setIsRunFieldActive] = useState(false)
  const [isSearchButtonClicked, setIsSearchButtonClicked] = useState(false)

  // Lot No manual input state
  const [lotInputValue, setLotInputValue] = useState('')
  const [previousLotValue, setPreviousLotValue] = useState('')
  const [isLotFieldActive, setIsLotFieldActive] = useState(false)
  const [isLotSearchButtonClicked, setIsLotSearchButtonClicked] = useState(false)

  // Bin No manual input state
  const [binInputValue, setBinInputValue] = useState('')
  const [previousBinValue, setPreviousBinValue] = useState('')
  const [isBinFieldActive, setIsBinFieldActive] = useState(false)
  const [isBinSearchButtonClicked, setIsBinSearchButtonClicked] = useState(false)

  // Sync runInputValue with currentRun
  useEffect(() => {
    if (currentRun?.runNo) {
      setRunInputValue(currentRun.runNo.toString())
    } else {
      setRunInputValue('')
    }
  }, [currentRun?.runNo])

  // Sync lotInputValue with selectedLot
  useEffect(() => {
    if (selectedLot?.lotNo) {
      setLotInputValue(selectedLot.lotNo)
    } else {
      setLotInputValue('')
    }
  }, [selectedLot?.lotNo])

  // Sync binInputValue with selectedLot
  useEffect(() => {
    if (selectedLot?.binNo) {
      setBinInputValue(selectedLot.binNo)
    } else {
      setBinInputValue('')
    }
  }, [selectedLot?.binNo])

  /**
   * Handle Run field click - clear for manual input/scanning
   */
  const handleRunFieldClick = () => {
    setPreviousRunValue(runInputValue)
    setIsRunFieldActive(true)
    setRunInputValue('')
  }

  /**
   * Handle Run field blur - restore previous value if empty and not searching
   */
  const handleRunFieldBlur = () => {
    const currentValue = runInputValue.trim()

    // Skip restoration if user is clicking search button
    if (isSearchButtonClicked) {
      setIsRunFieldActive(false)
      setPreviousRunValue('')
      return
    }

    // Restore previous value if field is empty
    if (isRunFieldActive && !currentValue) {
      setRunInputValue(previousRunValue)
    }

    setIsRunFieldActive(false)
    setPreviousRunValue('')
  }

  /**
   * Handle search button mouse down - prevent blur restoration
   */
  const handleSearchButtonMouseDown = () => {
    setIsSearchButtonClicked(true)
  }

  /**
   * Handle Run field key down - trigger search on Enter
   */
  const handleRunFieldKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleRunSearch(false)
    }
  }

  /**
   * Handle Run search - open modal or perform direct search
   */
  const handleRunSearch = async (fromButton: boolean) => {
    // Reset all field interaction states
    setIsSearchButtonClicked(false)
    setIsRunFieldActive(false)
    setPreviousRunValue('')

    // Always open modal when clicked via Search button
    if (fromButton) {
      setShowRunModal(true)
      return
    }

    // Enter key behavior: process input field value for direct lookup
    const runNumber = runInputValue.trim()

    // Show modal if run number field is blank
    if (!runNumber) {
      setShowRunModal(true)
      return
    }

    // Direct search with entered run number
    clearError()
    try {
      await selectRun(parseInt(runNumber, 10))
    } catch (error) {
      console.error('[PartialPickingPage] Direct run search failed:', error)
    }
  }

  /**
   * Handle Lot field click - clear for manual input/scanning
   */
  const handleLotFieldClick = () => {
    setPreviousLotValue(lotInputValue)
    setIsLotFieldActive(true)
    setLotInputValue('')
  }

  /**
   * Handle Lot field blur - restore previous value if empty and not searching
   */
  const handleLotFieldBlur = () => {
    const currentValue = lotInputValue.trim()

    // Skip restoration if user is clicking search button
    if (isLotSearchButtonClicked) {
      setIsLotFieldActive(false)
      setPreviousLotValue('')
      return
    }

    // Restore previous value if field is empty
    if (isLotFieldActive && !currentValue) {
      setLotInputValue(previousLotValue)
    }

    setIsLotFieldActive(false)
    setPreviousLotValue('')
  }

  /**
   * Handle Lot search button mouse down - prevent blur restoration
   */
  const handleLotSearchButtonMouseDown = () => {
    setIsLotSearchButtonClicked(true)
  }

  /**
   * Handle Lot field key down - trigger search on Enter
   */
  const handleLotFieldKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleLotSearch(false)
    }
  }

  /**
   * Handle Lot search - open modal or perform direct search
   */
  const handleLotSearch = async (fromButton: boolean) => {
    // Always open modal when clicked via Search button
    if (fromButton) {
      // DON'T reset states yet - let blur handler use them
      if (!currentItem) {
        alert('Please select an item first')
        // Reset states before returning on error
        setIsLotSearchButtonClicked(false)
        setIsLotFieldActive(false)
        setPreviousLotValue('')
        return
      }
      setShowLotModal(true)
      return  // States will be cleaned up when modal closes
    }

    // Reset field interaction states for direct search (Enter key)
    setIsLotSearchButtonClicked(false)
    setIsLotFieldActive(false)
    setPreviousLotValue('')

    // Enter key behavior: process input field value for direct lookup
    const lotNumber = lotInputValue.trim()

    // Show modal if lot number field is blank
    if (!lotNumber) {
      if (!currentItem) {
        alert('Please select an item first')
        return
      }
      setShowLotModal(true)
      return
    }

    // Validate required data
    if (!currentItem) {
      alert('Please select an item first')
      return
    }
    if (!currentRun) {
      alert('Please select a run first')
      return
    }
    if (!currentBatchRowNum) {
      alert('Please select a batch first')
      return
    }

    // Direct search with entered lot number
    clearError()
    try {
      const lot = await getLotByNumber(
        lotNumber,
        currentItem.itemKey,
        currentRun.runNo,
        currentBatchRowNum
      )

      // Auto-populate lot data
      selectLot({
        lotNo: lot.lotNo,
        itemKey: lot.itemKey,
        binNo: lot.binNo,
        locationKey: lot.locationKey,
        qtyOnHand: lot.qtyOnHand,
        qtyCommitSales: lot.qtyCommitSales,
        availableQty: lot.availableQty,
        expiryDate: lot.expiryDate,
        lotStatus: lot.lotStatus,
        packSize: lot.packSize,
      })
    } catch (error) {
      console.error('[PartialPickingPage] Direct lot search failed:', error)

      // Restore previous value on error (don't keep wrong input)
      setLotInputValue(previousLotValue || selectedLot?.lotNo || '')

      alert(getErrorMessage(error) || `Lot '${lotNumber}' not found for this item`)
    }
  }

  /**
   * Handle Bin field click - clear for manual input/scanning
   */
  const handleBinFieldClick = () => {
    setPreviousBinValue(binInputValue)
    setIsBinFieldActive(true)
    setBinInputValue('')
  }

  /**
   * Handle Bin field blur - restore previous value if empty and not searching
   */
  const handleBinFieldBlur = () => {
    const currentValue = binInputValue.trim()

    // Skip restoration if user is clicking search button
    if (isBinSearchButtonClicked) {
      setIsBinFieldActive(false)
      setPreviousBinValue('')
      return
    }

    // Restore previous value if field is empty
    if (isBinFieldActive && !currentValue) {
      setBinInputValue(previousBinValue)
    }

    setIsBinFieldActive(false)
    setPreviousBinValue('')
  }

  /**
   * Handle Bin search button mouse down - prevent blur restoration
   */
  const handleBinSearchButtonMouseDown = () => {
    setIsBinSearchButtonClicked(true)
  }

  /**
   * Handle Bin field key down - trigger search on Enter
   */
  const handleBinFieldKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleBinSearch(false)
    }
  }

  /**
   * Handle Bin search - open modal or perform direct search
   */
  const handleBinSearch = async (fromButton: boolean) => {
    // Always open modal when clicked via Search button
    if (fromButton) {
      // DON'T reset states yet - let blur handler use them
      if (!currentItem) {
        alert('Please select an item first')
        // Reset states before returning on error
        setIsBinSearchButtonClicked(false)
        setIsBinFieldActive(false)
        setPreviousBinValue('')
        return
      }
      setShowBinModal(true)
      return  // States will be cleaned up when modal closes
    }

    // Reset field interaction states for direct search (Enter key)
    setIsBinSearchButtonClicked(false)
    setIsBinFieldActive(false)
    setPreviousBinValue('')

    // Enter key behavior: process input field value for direct lookup
    const binNumber = binInputValue.trim()

    // Show modal if bin number field is blank
    if (!binNumber) {
      if (!currentItem) {
        alert('Please select an item first')
        return
      }
      setShowBinModal(true)
      return
    }

    // Validate required data
    if (!currentItem) {
      alert('Please select an item first')
      return
    }

    // Direct search with entered bin number
    clearError()
    try {
      const bin = await getBinByNumber(binNumber)

      // Update the selected lot with the new bin (if lot already selected)
      if (selectedLot) {
        selectLot({
          ...selectedLot,
          binNo: bin.binNo,
        })
      } else {
        alert('Please select a lot first before changing the bin')
      }
    } catch (error) {
      console.error('[PartialPickingPage] Direct bin search failed:', error)

      // Restore previous value on error (don't keep wrong input)
      setBinInputValue(previousBinValue || selectedLot?.binNo || '')

      alert(getErrorMessage(error) || `Bin '${binNumber}' not found in TFC1 PARTIAL area`)
    }
  }

  /**
   * Handle Save Pick button
   * Determines weight source for CUSTOM1 audit trail:
   * - 'manual': User entered weight via numeric keyboard
   * - 'automatic': Weight from scale (FETCH WEIGHT button)
   */
  const handleSavePick = async () => {
    try {
      // Determine weight source based on whether weight was manually entered
      const weightSource: 'automatic' | 'manual' = manualWeight !== null ? 'manual' : 'automatic'

      console.log('[PartialPickingPage] Saving pick with weight source:', {
        weight: currentWeight,
        weightSource,
        isManualEntry: manualWeight !== null,
      })

      await savePick(currentWeight, weightSource)

      // Auto-print individual label after successful pick
      if (currentItem && selectedLot) {
        const now = new Date()
        printLabels([{
          itemKey: currentItem.itemKey,
          qtyReceived: currentWeight,
          batchNo: currentItem.batchNo,
          lotNo: selectedLot.lotNo,
          picker: user?.username || 'UNKNOWN',
          date: now.toLocaleDateString('en-GB'), // DD/MM/YYYY
          time: now.toLocaleTimeString('en-US'), // HH:MM:SSAM/PM
        }])
      }

      setSuccessMessage('Pick saved and label printed!')
      setTimeout(() => setSuccessMessage(null), 3000)
      setManualWeight(null)
    } catch (error) {
      console.error('[PartialPickingPage] Save pick failed:', error)
    }
  }

  /**
   * Handle Add Lot button
   * Directly executes the pick with current weight and auto-selected lot
   */
  const handleAddLot = async () => {
    if (!currentItem) {
      alert('Please select an item first')
      return
    }
    if (!selectedLot) {
      alert('Please select a lot first')
      return
    }

    // VALIDATION: Ensure display values match business logic values
    // Prevents accidental picks when user typed but didn't press Enter
    if (lotInputValue.trim() !== selectedLot.lotNo) {
      alert('Lot number has been modified. Please press Enter to validate the new lot or click the Search button.')
      return
    }

    if (binInputValue.trim() !== selectedLot.binNo) {
      alert('Bin number has been modified. Please press Enter to validate the new bin or click the Search button.')
      return
    }

    // Execute pick directly (same as SAVE button)
    await handleSavePick()
  }

  /**
   * Handle View Lots button
   */
  const handleViewLots = () => {
    if (!currentRun) {
      alert('Please select a run first')
      return
    }
    setShowViewLotsModal(true)
  }

  /**
   * Handle Delete single lot from View Lots modal
   */
  const handleDeleteLot = async (lotTranNo: number, rowNum: number, lineId: number) => {
    if (!confirm('Are you sure you want to delete this lot?')) return

    try {
      await unpickItem(lineId, rowNum)
      setSuccessMessage('Lot deleted successfully!')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (error) {
      console.error('[PartialPickingPage] Delete lot failed:', error)
    }
  }

  /**
   * Handle Delete all lots from View Lots modal
   */
  const handleDeleteAllLots = async () => {
    if (!pickedLotsData || pickedLotsData.pickedLots.length === 0) {
      alert('No picked lots to delete')
      return
    }

    const totalCount = pickedLotsData.pickedLots.length
    const confirmed = window.confirm(
      `Delete ALL ${totalCount} picked lot(s)? This will restore inventory and cannot be undone.`
    )

    if (!confirmed) return

    try {
      // Delete each lot sequentially
      for (const lot of pickedLotsData.pickedLots) {
        await unpickItem(lot.lineId, lot.rowNum)
      }

      setSuccessMessage(`Successfully deleted ${totalCount} picked lot(s)`)
      setTimeout(() => setSuccessMessage(null), 3000)
      setShowViewLotsModal(false)
    } catch (error) {
      console.error('[PartialPickingPage] Delete all lots failed:', error)
      alert('Failed to delete some lots. Please try again.')
    }
  }

  /**
   * Handle Re-Print from View Lots modal
   */
  const handleRePrint = async () => {
    if (!pickedLotsData || pickedLotsData.pickedLots.length === 0) {
      alert('No picked lots to print')
      return
    }

    try {
      // Format picked lots data for labels
      const labelData = pickedLotsData.pickedLots.map((lot) => ({
        itemKey: lot.itemKey,
        qtyReceived: lot.qtyReceived,
        batchNo: lot.batchNo,
        lotNo: lot.lotNo,
        picker: workstationId || 'UNKNOWN',
        date: lot.recDate ? new Date(lot.recDate).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB'),
        time: lot.recDate ? new Date(lot.recDate).toLocaleTimeString('en-US') : new Date().toLocaleTimeString('en-US'),
      }))

      // Print all labels
      await printLabels(labelData)

      setSuccessMessage(`Printing ${labelData.length} label(s)...`)
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (error) {
      console.error('[PartialPickingPage] Re-print failed:', error)
      alert('Failed to print labels. Please try again.')
    }
  }

  /**
   * Handle Print button
   * Fetches batch summary data and prints 4×4" thermal labels
   * Only enabled when run status is 'PRINT' (all items picked)
   */
  const handlePrint = async () => {
    if (!currentRun) {
      alert('No run selected')
      return
    }

    // Validate run status (should be 'PRINT' for button to be enabled)
    if (currentRun.status !== 'PRINT') {
      alert('Cannot print. All items must be picked first (Status must be PRINT)')
      return
    }

    try {
      // Fetch batch summary data from API
      const summary = await getBatchSummary(currentRun.runNo)

      // Print batch summary labels (4×4" format)
      printBatchSummary(summary)

      setSuccessMessage('Printing batch summary labels...')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (error) {
      console.error('[PartialPickingPage] Print batch summary failed:', error)
      alert(getErrorMessage(error) || 'Failed to fetch batch summary data')
    }
  }

  /**
   * Handle Logout button
   */
  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      logout()
      navigate('/login')
    }
  }

  /**
   * Handle Run selection from modal
   * Wrapped with useCallback to maintain stable reference for modal callback
   * Accepts full run object to avoid inline arrow function in modal callback
   */
  const handleRunSelect = useCallback(async (run: RunDetailsResponse) => {
    setShowRunModal(false)
    clearError()

    // Force sync run input value immediately (don't rely on useEffect)
    // This fixes the bug where selecting the same run doesn't trigger useEffect
    setRunInputValue(run.runNo.toString())

    try {
      await selectRun(run.runNo)
    } catch (error) {
      console.error('[PartialPickingPage] Run selection failed:', error)
    }
  }, [clearError, selectRun])

  /**
   * Handle Batch selection from modal
   */
  const handleBatchSelect = async (rowNum: number) => {
    setShowBatchModal(false)
    clearError()
    try {
      await selectBatch(rowNum)
    } catch (error) {
      console.error('[PartialPickingPage] Batch selection failed:', error)
    }
  }

  /**
   * Handle Item selection from modal or grid click
   * Now accepts both itemKey and batchNo to select specific row
   * Always switches to "Pending to Picked" tab when selecting an item
   */
  const handleItemSelect = async (itemKey: string, batchNo?: string) => {
    // DEFENSIVE LOGGING: Verify parameters received from grid click
    console.log('[PartialPickingPage] handleItemSelect called with:', {
      itemKey,
      batchNo,
      batchNoType: typeof batchNo,
      batchNoIsTruthy: !!batchNo,
    })

    // Always switch to "Pending to Picked" tab when selecting an item
    // This ensures users can see and pick the selected item
    setGridFilter('pending')

    setShowItemModal(false)
    clearError()
    try {
      // If batchNo provided, select that specific item
      // Otherwise, select first item with that key (for modal compatibility)
      await selectItem(itemKey, batchNo)
    } catch (error) {
      console.error('[PartialPickingPage] Item selection failed:', error)
    }
  }

  /**
   * Handle Lot selection from modal
   */
  const handleLotSelect = (lot: {
    lotNo: string
    binNo: string
    dateExpiry: string
    qtyOnHand: number
    qtyCommitSales: number
    availableQty: number
    packSize: number
    bagsAvailable: number
  }) => {
    setShowLotModal(false)
    clearError()

    // Force sync input values immediately (don't rely on useEffect)
    // This fixes the bug where selecting the same lot doesn't trigger useEffect
    setLotInputValue(lot.lotNo)
    setBinInputValue(lot.binNo)

    selectLot({
      lotNo: lot.lotNo,
      itemKey: currentItem?.itemKey || '',
      binNo: lot.binNo, // Auto-populate from selected lot
      locationKey: 'TFC1',
      qtyOnHand: lot.qtyOnHand,
      qtyCommitSales: lot.qtyCommitSales,
      availableQty: lot.availableQty,
      expiryDate: lot.dateExpiry,
      lotStatus: 'P',
      packSize: lot.packSize, // Include packSize
    })
  }

  /**
   * Handle Bin selection from modal (manual override)
   */
  const handleBinSelect = (bin: {
    binNo: string
    expiryDate: string
    qtyOnHand: number
    qtyCommitSales: number
    availableQty: number
    packSize: number
    bagsAvailable: number
  }) => {
    setShowBinModal(false)
    clearError()

    // Force sync bin input value immediately (don't rely on useEffect)
    // This fixes the bug where selecting the same bin doesn't trigger useEffect
    setBinInputValue(bin.binNo)

    // Update the selected lot with the new bin
    if (selectedLot) {
      selectLot({
        ...selectedLot,
        binNo: bin.binNo, // Override bin number
      })
    }
  }

  const formatQuantity = (value?: number | null) => Number(value ?? 0).toFixed(4)
  // Elegant Industrial label styling - Poppins SemiBold (using semantic class)
  const labelClass = 'picking-label-inline'
  // Enhanced button styles with semantic classes
  const lookupButtonInsideInputClass = 'picking-btn-lookup-inline'
  const fetchButtonClass = 'h-12 min-w-[160px] rounded-lg bg-brand-primary hover:bg-accent-gold px-6 text-sm font-semibold uppercase tracking-wide text-white shadow-button btn-scale-hover button-pulse-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-offset-2 disabled:bg-border-main disabled:text-text-primary/40 disabled:shadow-none disabled:cursor-not-allowed disabled:hover:scale-100'
  const primaryButtonClass = 'picking-btn-action-primary'
  const secondaryButtonClass = 'picking-btn-action-secondary'
  const dangerButtonClass = 'picking-btn-action-danger'

  // Weight range values from backend (used for progress bar and validation)
  const weightRangeLow = currentItem?.weightRangeLow ?? 30
  const weightRangeHigh = currentItem?.weightRangeHigh ?? 32
  const weightInRange =
    currentWeight > 0 && currentWeight >= weightRangeLow && currentWeight <= weightRangeHigh
  const weightFieldClass = weightInRange
    ? 'border-accent-green bg-accent-green/5 text-accent-green shadow-[0_0_0_3px_rgba(63,125,62,0.12)]'
    : currentWeight > 0
      ? 'border-danger bg-danger/5 text-danger shadow-[0_0_0_3px_rgba(198,40,40,0.12)]'
      : 'border-border-main bg-surface text-text-primary'

  // Check if live scale weight (before Fetch) is within range
  const scaleWeightInRange =
    currentScale.weight > 0 &&
    currentScale.weight >= weightRangeLow &&
    currentScale.weight <= weightRangeHigh

  // Validation: Check if display values match business logic values
  // Prevents accidental picks when user typed but didn't press Enter
  const lotMatchesSelection = !selectedLot || lotInputValue.trim() === selectedLot.lotNo
  const binMatchesSelection = !selectedLot || binInputValue.trim() === selectedLot.binNo

  // Visual indicators for validation state (yellow warning when mismatch)
  const lotFieldClass = !lotMatchesSelection
    ? 'h-12 rounded-lg border-2 border-[#F59E0B] bg-[#FEF3C7] pr-[53px] text-base uppercase tracking-wide text-text-primary shadow-[0_0_0_3px_rgba(245,158,11,0.15)] placeholder:text-sm'
    : 'h-12 rounded-lg border-2 border-border-main bg-surface pr-[53px] text-base uppercase tracking-wide text-text-primary placeholder:text-sm'

  const binFieldClass = !binMatchesSelection
    ? 'h-12 rounded-lg border-2 border-[#F59E0B] bg-[#FEF3C7] pr-[53px] text-base uppercase tracking-wide text-text-primary shadow-[0_0_0_3px_rgba(245,158,11,0.15)] placeholder:text-sm'
    : 'h-12 rounded-lg border-2 border-border-main bg-surface pr-[53px] text-base uppercase tracking-wide text-text-primary placeholder:text-sm'

  // Sort items by quantity descending (pick largest first), then BatchNo descending
  // This matches official app behavior for efficient warehouse picking
  const sortedBatchItems = [...currentBatchItems].sort((a, b) => {
    // Primary: Sort by totalNeeded (Partial KG) descending (largest first)
    const qtyCompare = b.totalNeeded - a.totalNeeded
    if (qtyCompare !== 0) return qtyCompare

    // Secondary: Sort by BatchNo descending (850417 before 850416)
    return b.batchNo.localeCompare(a.batchNo)
  })

  const baseBatchItems = sortedBatchItems.map((item, index) => ({
    lineId: index + 1,
    itemKey: item.itemKey,
    description: item.description,
    batchNo: item.batchNo,
    targetQty: item.totalNeeded,
    pickedQty: item.pickedQty,
    balance: item.remainingQty,
    allergens: item.allergen,
    status: item.pickedQty > 0 ? ('picked' as const) : ('unpicked' as const),
  }))
  const pendingGridItems = baseBatchItems.filter(item => item.status !== 'picked')
  const pickedGridItems = baseBatchItems.filter(item => item.status === 'picked')
  const gridItems = gridFilter === 'pending' ? pendingGridItems : pickedGridItems
  const pendingCount = pendingGridItems.length
  const pickedCount = pickedGridItems.length
  const batchNumberDisplay = currentItem?.batchNo || currentBatchItems[0]?.batchNo || ''
  const productionDateDisplay = currentRun?.productionDate || ''
  const availableQtyDisplay = currentItem ? formatQuantity(currentItem.totalAvailableSOH) : '0.0000'
  const handleScaleSelection = (scale: 'small' | 'big') => {
    setSelectedScale(scale)
    setManualWeight(null)
  }

  const handleGridItemClick = (item: { itemKey: string; batchNo: string }) => {
    handleItemSelect(item.itemKey, item.batchNo)
  }

  return (
    <div className="min-h-screen bg-bg-main px-4 py-4 font-body">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4">
        {/* Notifications */}
        {(successMessage || errorMessage || isLoading) && (
          <div className="grid gap-3">
            {successMessage && (
              <div className="toast-success rounded-lg border-2 border-accent-green/30 px-6 py-4 text-sm font-semibold tracking-wide shadow-button-green">
                {successMessage}
              </div>
            )}
            {errorMessage && (
              <div className="flex items-center justify-between rounded-lg border-2 border-danger/30 bg-gradient-to-br from-[#FFEBE9] to-[#FFDAD6] px-6 py-4 text-sm font-semibold tracking-wide text-danger shadow-card">
                <span>{errorMessage}</span>
                <button
                  onClick={clearError}
                  aria-label="Clear error"
                  className="ml-4 text-xl font-bold text-danger transition-smooth hover:scale-110 hover:text-[#A01F1F]"
                >
                  ×
                </button>
              </div>
            )}
            {isLoading && (
              <div className="rounded-lg border-2 border-accent-gold/30 bg-gradient-to-br from-[#FFF9EC] to-[#FFEDC4] px-6 py-4 text-sm font-semibold tracking-wide text-brand-primary shadow-card">
                Loading…
              </div>
            )}
          </div>
        )}

        {/* Unified Section: Weight Progress + Header + Form + Table */}
        <section className="grid grid-cols-1 gap-3 rounded-lg border-2 border-border-main bg-surface shadow-soft lg:grid-cols-[9fr_11fr]">
          {/* Weight Progress Bar with tolerance markers and scale selector */}
          <div className="p-4 lg:col-span-2">
            <WeightProgressBar
              weight={currentWeight}
              weightRangeLow={weightRangeLow}
              weightRangeHigh={weightRangeHigh}
              selectedScale={selectedScale}
              onScaleChange={handleScaleSelection}
              scaleStatuses={scaleStatuses}
              workstationLabel={workstationId || undefined}
            />
          </div>

          {/* Header Row 1: Run No + FG ItemKey + Description (Full Width) */}
          <div className="px-4 pt-4 pb-2 lg:col-span-2">
            <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-[auto_200px_auto_minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-x-4">
              <label className={labelClass}>Run No</label>
              <div className="relative">
                <Input
                  value={runInputValue}
                  onChange={e => setRunInputValue(e.target.value)}
                  onClick={handleRunFieldClick}
                  onBlur={handleRunFieldBlur}
                  onKeyDown={handleRunFieldKeyDown}
                  placeholder="ENTER RUNNO"
                  className="h-12 rounded-lg border-2 border-border-main bg-surface pr-[53px] text-base uppercase tracking-wide text-text-primary placeholder:text-sm"
                />
                <Button
                  type="button"
                  onMouseDown={handleSearchButtonMouseDown}
                  onClick={() => handleRunSearch(true)}
                  className={lookupButtonInsideInputClass}
                  disabled={isLoading}
                  aria-label="Lookup run number"
                >
                  <Search className="w-5 h-5" strokeWidth={2.5} />
                </Button>
              </div>

              <label className={labelClass}>FG ItemKey</label>
              <Input
                value={currentRun?.fgItemKey || ''}
                readOnly
                placeholder="Item key"
                className="h-12 rounded-lg border-2 border-border-main bg-bg-main text-base uppercase tracking-wide text-text-primary placeholder:text-sm"
              />

              <label className={labelClass}>Description</label>
              <Input
                value={currentRun?.fgDescription || ''}
                readOnly
                placeholder="Description"
                className="h-12 rounded-lg border-2 border-border-main bg-bg-main text-base text-text-primary placeholder:text-sm"
              />
            </div>
          </div>

          {/* Header Row 2: Batch No + Batches + Production Date (Full Width) */}
          <div className="border-b-2 border-border-main px-4 pt-2 pb-4 lg:col-span-2">
            <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-[auto_200px_auto_120px_auto_minmax(0,1fr)] md:gap-x-4">
              <label className={labelClass}>Batch No</label>
              <Input
                value={batchNumberDisplay}
                readOnly
                placeholder="Auto from items"
                className="h-12 rounded-lg border-2 border-border-main bg-bg-main text-base uppercase tracking-wide text-text-primary placeholder:text-sm"
              />

              <label className={labelClass}>Batches</label>
              <div className="flex h-12 items-center rounded-lg border-2 border-border-main bg-bg-main px-4 shadow-soft">
                <span className="text-base font-bold text-text-primary">
                  {currentRun?.batches.length ?? 0}
                </span>
              </div>

              <label className={labelClass}>Production date</label>
              <div className="flex h-12 items-center rounded-lg border-2 border-border-main bg-bg-main px-4 shadow-soft">
                <span className="text-base font-bold text-text-primary">
                  {productionDateDisplay || '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Form Section (Left Column) */}
          <div className="flex flex-col p-5">
            <div className="space-y-4">
              {/* Inline layout: label and input on same row */}
              <div className="grid grid-cols-[130px_minmax(0,1fr)] items-center gap-3">
                <label className={labelClass}>Item key</label>
                <div className="relative">
                  <Input
                    value={currentItem?.itemKey || ''}
                    placeholder="Select item"
                    readOnly
                    className="h-12 rounded-lg border-2 border-border-main bg-surface pr-[53px] text-base uppercase tracking-wide text-text-primary transition-smooth focus-within:border-accent-gold input-glow-focus placeholder:text-sm"
                  />
                  <Button
                    type="button"
                    onClick={() => setShowItemModal(true)}
                    className={lookupButtonInsideInputClass}
                    disabled={!currentBatchRowNum || isLoading}
                    aria-label="Lookup item key"
                  >
                    <Search className="w-5 h-5" strokeWidth={2.5} />
                  </Button>
                </div>
              </div>

              {/* Inline layout: label and input on same row */}
              <div className="grid grid-cols-[130px_minmax(0,1fr)] items-center gap-3">
                <label className={labelClass}>Description</label>
                <Input
                  value={currentItem?.description || ''}
                  readOnly
                  placeholder="Description"
                  className="h-12 rounded-lg border-2 border-border-main bg-surface text-base text-text-primary placeholder:text-sm"
                />
              </div>

              {/* Lot No. - inline with SOH label */}
              <div className="grid grid-cols-[130px_1fr_212px] items-center gap-3">
                <label className={labelClass}>Lot No.</label>
                <div className="relative">
                  <Input
                    value={lotInputValue}
                    onChange={e => setLotInputValue(e.target.value)}
                    onClick={handleLotFieldClick}
                    onBlur={handleLotFieldBlur}
                    onKeyDown={handleLotFieldKeyDown}
                    placeholder="ENTER LOTNO"
                    className={lotFieldClass}
                  />
                  <Button
                    type="button"
                    onMouseDown={handleLotSearchButtonMouseDown}
                    onClick={() => handleLotSearch(true)}
                    className={lookupButtonInsideInputClass}
                    disabled={!currentItem || isLoading}
                    aria-label="Lookup lot number"
                  >
                    <Search className="w-5 h-5" strokeWidth={2.5} />
                  </Button>
                </div>
                <span className="text-center text-sm font-semibold uppercase tracking-wider text-text-primary/60">SOH</span>
              </div>

              {/* Bin No. - inline with SOH value and UOM fields */}
              <div className="grid grid-cols-[130px_1fr_120px_80px] items-center gap-3">
                <label className={labelClass}>Bin No.</label>
                <div className="relative">
                  <Input
                    value={binInputValue}
                    onChange={e => setBinInputValue(e.target.value)}
                    onClick={handleBinFieldClick}
                    onBlur={handleBinFieldBlur}
                    onKeyDown={handleBinFieldKeyDown}
                    placeholder="ENTER BINNO"
                    className={binFieldClass}
                  />
                  <Button
                    type="button"
                    onMouseDown={handleBinSearchButtonMouseDown}
                    onClick={() => handleBinSearch(true)}
                    className={lookupButtonInsideInputClass}
                    disabled={!currentItem || isLoading}
                    aria-label="Lookup bin number"
                  >
                    <Search className="w-5 h-5" strokeWidth={2.5} />
                  </Button>
                </div>
                <Input
                  value={availableQtyDisplay}
                  readOnly
                  className="h-12 rounded-lg border-2 border-border-main bg-bg-main text-base font-semibold tabular-nums text-text-primary"
                />
                <Input
                  value="KG"
                  readOnly
                  className="h-12 rounded-lg border-2 border-border-main bg-bg-main text-base font-semibold text-text-primary"
                />
              </div>

              {/* Weight section - inline with Fetch button */}
              <div className="grid grid-cols-[130px_minmax(0,1fr)_auto] items-center gap-3">
                <label className={labelClass}>Weight</label>
                <Input
                  value={formatQuantity(currentWeight)}
                  readOnly
                  onClick={() => {
                    setFrozenWeight(currentWeight)  // Freeze current weight
                    setIsManualEntryActive(true)
                    setKeyboardKey(prev => prev + 1)  // Force remount with fresh state
                    setShowKeyboard(true)
                  }}
                  className={`h-12 rounded-lg border-2 font-body text-xl font-semibold tabular-nums tracking-tight transition-smooth cursor-pointer hover:border-accent-gold ${weightFieldClass}`}
                  title="Click to enter weight manually"
                />
                <Button
                  type="button"
                  onClick={() => setManualWeight(currentScale.weight)}
                  disabled={!currentScale.online || !scaleWeightInRange}
                  className={fetchButtonClass}
                >
                  Fetch weight
                </Button>
              </div>

              {/* Weight range section - inline */}
              <div className="grid grid-cols-[130px_minmax(0,1fr)] items-center gap-3">
                <label className={labelClass}>Weight range</label>
                <div className="flex items-center gap-3">
                  <Input
                    value={formatQuantity(weightRangeLow)}
                    readOnly
                    className="h-12 flex-1 rounded-lg border-2 border-border-main bg-bg-main font-body text-base font-medium tabular-nums text-text-primary"
                  />
                  <span className="text-sm font-semibold uppercase tracking-wide text-text-primary/60">
                    to
                  </span>
                  <Input
                    value={formatQuantity(weightRangeHigh)}
                    readOnly
                    className="h-12 flex-1 rounded-lg border-2 border-border-main bg-bg-main font-body text-base font-medium tabular-nums text-text-primary"
                  />
                </div>
              </div>

              {/* Total needed - inline */}
              <div className="grid grid-cols-[130px_minmax(0,1fr)] items-center gap-3">
                <label className={labelClass}>Total needed</label>
                <Input
                  value={formatQuantity(currentItem?.totalNeeded)}
                  readOnly
                  className="h-12 rounded-lg border-2 border-border-main bg-bg-main font-body text-base font-medium tabular-nums text-text-primary"
                />
              </div>

              {/* Remaining qty - inline */}
              <div className="grid grid-cols-[130px_minmax(0,1fr)] items-center gap-3">
                <label className={labelClass}>Remaining qty</label>
                <Input
                  value={formatQuantity(currentItem?.remainingQty)}
                  readOnly
                  className="h-12 rounded-lg border-2 border-border-main bg-bg-main font-body text-base font-medium tabular-nums text-text-primary"
                />
              </div>
            </div>

            {/* 4 Button Layout - SAVE button removed (ADD LOT performs complete pick) */}
            <div className="mt-6 grid gap-3">
              <div className="grid gap-3 md:grid-cols-2">
                <Button
                  type="button"
                  onClick={handleAddLot}
                  disabled={
                    isLoading ||
                    !currentItem ||
                    !selectedLot ||
                    !currentScale.online ||
                    !weightInRange ||
                    !lotMatchesSelection ||
                    !binMatchesSelection
                  }
                  className={primaryButtonClass}
                >
                  {isLoading ? 'Saving…' : 'Add Lot'}
                </Button>
                <Button
                  type="button"
                  onClick={handleViewLots}
                  disabled={isLoading}
                  className={secondaryButtonClass}
                >
                  View Lots
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Button
                  type="button"
                  onClick={handlePrint}
                  disabled={isLoading || !currentRun || currentRun.status !== 'PRINT'}
                  className={secondaryButtonClass}
                  title={
                    !currentRun
                      ? 'No run selected'
                      : currentRun.status !== 'PRINT'
                        ? 'Complete all picks first (Status must be PRINT)'
                        : 'Print batch summary labels'
                  }
                >
                  Print
                </Button>
                <Button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoading}
                  className={dangerButtonClass}
                >
                  Logout
                </Button>
              </div>
            </div>
          </div>

          {/* Table Section (Right Column) */}
          <div className="flex h-full flex-col p-5">
            <BatchTicketGrid
              items={gridItems}
              filter={gridFilter}
              onFilterChange={setGridFilter}
              pendingCount={pendingCount}
              pickedCount={pickedCount}
              selectedRowKey={currentItem ? `${currentItem.itemKey}-${currentItem.batchNo}` : null}
              onItemClick={handleGridItemClick}
            />
          </div>
        </section>
      </div>

      <RunSelectionModal
        open={showRunModal}
        onOpenChange={setShowRunModal}
        onSelect={handleRunSelect}
      />
      <BatchSelectionModal
        open={showBatchModal}
        onOpenChange={setShowBatchModal}
        onSelect={batchNo => handleBatchSelect(batchNo)}
        runNo={currentRun?.runNo}
      />
      <ItemSelectionModal
        open={showItemModal}
        onOpenChange={setShowItemModal}
        onSelect={item => handleItemSelect(item.itemKey)}
        runNo={currentRun?.runNo}
        batchNo={null}
      />
      <LotSelectionModal
        open={showLotModal}
        onOpenChange={(open) => {
          setShowLotModal(open)
          // Clean up interaction states when modal closes
          if (!open) {
            setIsLotSearchButtonClicked(false)
            setIsLotFieldActive(false)
            setPreviousLotValue('')
          }
        }}
        onSelect={handleLotSelect}
        itemKey={currentItem?.itemKey}
        runNo={currentRun?.runNo || null}
        rowNum={currentBatchRowNum}
        targetQty={currentItem?.totalNeeded}
      />
      <BinSelectionModal
        open={showBinModal}
        onOpenChange={(open) => {
          setShowBinModal(open)
          // Clean up interaction states when modal closes
          if (!open) {
            setIsBinSearchButtonClicked(false)
            setIsBinFieldActive(false)
            setPreviousBinValue('')
          }
        }}
        onSelect={handleBinSelect}
        lotNo={selectedLot?.lotNo || null}
        itemKey={currentItem?.itemKey || null}
      />
      <NumericKeyboard
        key={keyboardKey}  // Force remount with fresh state on each open
        open={showKeyboard}
        onOpenChange={(open) => {
          setShowKeyboard(open)
          if (!open) {
            setIsManualEntryActive(false)  // Clear manual entry mode when closing
          }
        }}
        onConfirm={(weight) => {
          setManualWeight(weight)
          setIsManualEntryActive(false)  // Clear manual entry mode after confirming
        }}
        currentValue={0}  // Always start blank for easy entry
        minValue={weightRangeLow}
        maxValue={weightRangeHigh}
      />
      <ViewLotsModal
        open={showViewLotsModal}
        onOpenChange={setShowViewLotsModal}
        runNo={currentRun?.runNo || null}
        onDelete={handleDeleteLot}
        onDeleteAll={handleDeleteAllLots}
        onRePrint={handleRePrint}
      />
    </div>
  )
}
