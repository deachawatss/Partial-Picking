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

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { usePicking } from '@/contexts/PickingContext'
import { useAuth } from '@/contexts/AuthContext'
import { useWeightScale } from '@/hooks/useWeightScale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { WeightProgressBar } from '@/components/picking/WeightProgressBar'
import { RunSelectionModal } from '@/components/picking/RunSelectionModal'
import { BatchSelectionModal } from '@/components/picking/BatchSelectionModal'
import { ItemSelectionModal } from '@/components/picking/ItemSelectionModal'
import { LotSelectionModal } from '@/components/picking/LotSelectionModal'
import { BinSelectionModal } from '@/components/picking/BinSelectionModal'
import { BatchTicketGrid } from '@/components/picking/BatchTicketGrid'

export function PartialPickingPage() {
  // Navigation and auth
  const navigate = useNavigate()
  const { logout } = useAuth()

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
    completeRun,
    clearError,
  } = usePicking()

  // Modal states
  const [showRunModal, setShowRunModal] = useState(false)
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [showItemModal, setShowItemModal] = useState(false)
  const [showLotModal, setShowLotModal] = useState(false)
  const [showBinModal, setShowBinModal] = useState(false)

  // Dual scale WebSocket integration
  const [selectedScale, setSelectedScale] = useState<'small' | 'big'>('small')
  const smallScale = useWeightScale('small', { debug: true })
  const bigScale = useWeightScale('big', { debug: true })

  // Get current scale based on selection
  const currentScale = selectedScale === 'small' ? smallScale : bigScale

  // Weight input state (can be manually entered or auto-populated from scale)
  const [manualWeight, setManualWeight] = useState<number | null>(null)
  const currentWeight = manualWeight !== null ? manualWeight : currentScale.weight

  const scaleStatuses = {
    small: { online: smallScale.online, stable: smallScale.stable },
    big: { online: bigScale.online, stable: bigScale.stable },
  }

  // Success notification state
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [gridFilter, setGridFilter] = useState<'pending' | 'picked'>('pending')

  /**
   * Handle Save Pick button
   */
  const handleSavePick = async () => {
    try {
      await savePick(currentWeight)
      setSuccessMessage('Pick saved successfully!')
      setTimeout(() => setSuccessMessage(null), 3000)
      setManualWeight(null)
    } catch (error) {
      console.error('[PartialPickingPage] Save pick failed:', error)
    }
  }

  /**
   * Handle Add Lot button
   */
  const handleAddLot = () => {
    if (!currentItem) {
      alert('Please select an item first')
      return
    }
    setShowLotModal(true)
  }

  /**
   * Handle View Lots button
   */
  const handleViewLots = () => {
    // TODO: Implement View Lots modal
    console.log('[PartialPickingPage] View Lots clicked')
  }

  /**
   * Handle Print button
   */
  const handlePrint = () => {
    if (!currentRun) {
      alert('No run selected')
      return
    }
    window.print()
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
   */
  const handleRunSelect = async (runNo: number) => {
    setShowRunModal(false)
    clearError()
    try {
      await selectRun(runNo)
    } catch (error) {
      console.error('[PartialPickingPage] Run selection failed:', error)
    }
  }

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
   */
  const handleItemSelect = async (itemKey: string, batchNo?: string) => {
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

  // Default weight values when no run/item is selected (for progress bar testing)
  const DEFAULT_TARGET_WEIGHT = 31 // KG (center of 30-32 range)
  const DEFAULT_TOLERANCE = 1 // KG (±1 KG gives 30-32 range)

  // Calculate weight values for progress bar
  const targetWeight = currentItem?.totalNeeded ?? DEFAULT_TARGET_WEIGHT
  const toleranceValue = currentItem?.toleranceKG ?? DEFAULT_TOLERANCE
  const weightRangeLow = currentItem?.weightRangeLow ?? (DEFAULT_TARGET_WEIGHT - DEFAULT_TOLERANCE)
  const weightRangeHigh = currentItem?.weightRangeHigh ?? (DEFAULT_TARGET_WEIGHT + DEFAULT_TOLERANCE)
  const weightInRange =
    currentWeight > 0 && currentWeight >= weightRangeLow && currentWeight <= weightRangeHigh
  const weightFieldClass = weightInRange
    ? 'border-accent-green bg-accent-green/5 text-accent-green shadow-[0_0_0_3px_rgba(63,125,62,0.12)]'
    : currentWeight > 0
      ? 'border-danger bg-danger/5 text-danger shadow-[0_0_0_3px_rgba(198,40,40,0.12)]'
      : 'border-border-main text-text-primary'

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
  const runNumberDisplay = currentRun?.runNo?.toString() ?? ''
  const batchNumberDisplay = currentItem?.batchNo || currentBatchItems[0]?.batchNo || ''
  const productionDateDisplay = currentRun?.productionDate || ''
  const availableQtyDisplay = currentItem ? formatQuantity(currentItem.totalAvailableSOH) : '0.0000'
  const handleScaleSelection = (scale: 'small' | 'big') => {
    setSelectedScale(scale)
    setManualWeight(null)
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
              targetWeight={targetWeight}
              tolerance={toleranceValue}
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
                  value={runNumberDisplay}
                  placeholder="Select run"
                  readOnly
                  className="h-12 rounded-lg border-2 border-border-main bg-surface pr-[53px] text-base uppercase tracking-wide text-text-primary"
                />
                <Button
                  type="button"
                  onClick={() => setShowRunModal(true)}
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
                className="h-12 rounded-lg border-2 border-border-main bg-surface text-base uppercase tracking-wide text-text-primary"
              />

              <label className={labelClass}>Description</label>
              <Input
                value={currentRun?.fgDescription || ''}
                readOnly
                placeholder="Description"
                className="h-12 rounded-lg border-2 border-border-main bg-surface text-base text-text-primary"
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
                className="h-12 rounded-lg border-2 border-border-main bg-surface text-base uppercase tracking-wide text-text-primary"
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
                    className="h-12 rounded-lg border-2 border-border-main bg-surface pr-[53px] text-base uppercase tracking-wide text-text-primary transition-smooth focus-within:border-accent-gold input-glow-focus"
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
                  className="h-12 rounded-lg border-2 border-border-main bg-surface text-base text-text-primary"
                />
              </div>

              {/* Lot No. - inline with SOH label */}
              <div className="grid grid-cols-[130px_1fr_212px] items-center gap-3">
                <label className={labelClass}>Lot No.</label>
                <div className="relative">
                  <Input
                    value={selectedLot?.lotNo || ''}
                    placeholder="Auto-selected (FEFO)"
                    readOnly
                    className="h-12 rounded-lg border-2 border-border-main bg-surface pr-[53px] text-base text-text-primary"
                  />
                  <Button
                    type="button"
                    onClick={() => setShowLotModal(true)}
                    className={lookupButtonInsideInputClass}
                    disabled={!currentItem || isLoading}
                    aria-label="Override lot number"
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
                    value={selectedLot?.binNo || ''}
                    placeholder="Auto from lot"
                    readOnly
                    className="h-12 rounded-lg border-2 border-border-main bg-surface pr-[53px] text-base text-text-primary"
                  />
                  <Button
                    type="button"
                    onClick={() => setShowBinModal(true)}
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
                  className={`h-12 rounded-lg border-2 bg-surface font-body text-xl font-semibold tabular-nums tracking-tight transition-smooth ${weightFieldClass}`}
                />
                <Button
                  type="button"
                  onClick={() => setManualWeight(currentScale.weight)}
                  disabled={!currentScale.online}
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
                    className="h-12 flex-1 rounded-lg border-2 border-border-main bg-surface font-body text-base font-medium tabular-nums text-text-primary"
                  />
                  <span className="text-sm font-semibold uppercase tracking-wide text-text-primary/60">
                    to
                  </span>
                  <Input
                    value={formatQuantity(weightRangeHigh)}
                    readOnly
                    className="h-12 flex-1 rounded-lg border-2 border-border-main bg-surface font-body text-base font-medium tabular-nums text-text-primary"
                  />
                </div>
              </div>

              {/* Total needed - inline */}
              <div className="grid grid-cols-[130px_minmax(0,1fr)] items-center gap-3">
                <label className={labelClass}>Total needed</label>
                <Input
                  value={formatQuantity(currentItem?.totalNeeded)}
                  readOnly
                  className="h-12 rounded-lg border-2 border-border-main bg-surface font-body text-base font-medium tabular-nums text-text-primary"
                />
              </div>

              {/* Remaining qty - inline */}
              <div className="grid grid-cols-[130px_minmax(0,1fr)] items-center gap-3">
                <label className={labelClass}>Remaining qty</label>
                <Input
                  value={formatQuantity(currentItem?.remainingQty)}
                  readOnly
                  className="h-12 rounded-lg border-2 border-border-main bg-surface font-body text-base font-medium tabular-nums text-text-primary"
                />
              </div>
            </div>

            {/* 5 Button Layout */}
            <div className="mt-6 grid gap-3">
              <div className="grid gap-3 md:grid-cols-2">
                <Button
                  type="button"
                  onClick={handleAddLot}
                  disabled={isLoading || !currentItem}
                  className={secondaryButtonClass}
                >
                  Add Lot
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
                  disabled={isLoading || !currentRun}
                  className={secondaryButtonClass}
                >
                  Print
                </Button>
                <Button
                  type="button"
                  onClick={handleSavePick}
                  disabled={
                    isLoading ||
                    !currentItem ||
                    !selectedLot ||
                    !currentScale.online ||
                    currentWeight <= 0
                  }
                  className={primaryButtonClass}
                >
                  {isLoading ? 'Saving…' : 'Save'}
                </Button>
              </div>
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

          {/* Table Section (Right Column) */}
          <div className="flex h-full flex-col p-5">
            <BatchTicketGrid
              items={gridItems}
              filter={gridFilter}
              onFilterChange={setGridFilter}
              pendingCount={pendingCount}
              pickedCount={pickedCount}
              selectedRowKey={currentItem ? `${currentItem.itemKey}-${currentItem.batchNo}` : null}
              onItemClick={item => handleItemSelect(item.itemKey, item.batchNo)}
            />
          </div>
        </section>
      </div>

      <RunSelectionModal
        open={showRunModal}
        onOpenChange={setShowRunModal}
        onSelect={run => handleRunSelect(run.runNo)}
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
        batchNo={currentBatchRowNum || undefined}
      />
      <LotSelectionModal
        open={showLotModal}
        onOpenChange={setShowLotModal}
        onSelect={handleLotSelect}
        itemKey={currentItem?.itemKey}
        runNo={currentRun?.runNo || null}
        rowNum={currentBatchRowNum}
        targetQty={currentItem?.totalNeeded}
      />
      <BinSelectionModal
        open={showBinModal}
        onOpenChange={setShowBinModal}
        onSelect={handleBinSelect}
        lotNo={selectedLot?.lotNo || null}
        itemKey={currentItem?.itemKey || null}
      />
    </div>
  )
}
