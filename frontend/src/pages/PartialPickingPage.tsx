/**
 * Partial Picking Page
 *
 * Main picking interface for warehouse operators with:
 * - Weight progress bar with real-time scale updates and tolerance markers
 * - Horizontal header rows for Run/Batch/Item selection
 * - FEFO lot selection with auto-population
 * - Save/Add Lot/View Lots/Print/Exit operations
 * - Complete Run workflow
 *
 * Optimized for 1280x1024 (no scroll) and 1920x1080 (responsive)
 * WCAG 2.2 AA compliant
 */

import { useState } from 'react'
import { usePicking } from '@/contexts/PickingContext'
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
  const smallScale = useWeightScale('small')
  const bigScale = useWeightScale('big')

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
   * Handle Exit button
   */
  const handleExit = () => {
    if (confirm('Are you sure you want to exit?')) {
      // TODO: Navigate to home or logout
      console.log('[PartialPickingPage] Exit clicked')
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
   */
  const handleItemSelect = async (itemKey: string) => {
    setShowItemModal(false)
    clearError()
    try {
      await selectItem(itemKey)
    } catch (error) {
      console.error('[PartialPickingPage] Item selection failed:', error)
    }
  }

  /**
   * Handle Lot selection from modal
   */
  const handleLotSelect = (lot: { lotNo: string; dateExpiry: string; availableQty: number }) => {
    setShowLotModal(false)
    clearError()
    selectLot({
      lotNo: lot.lotNo,
      itemKey: currentItem?.itemKey || '',
      binNo: '',
      locationKey: 'TFC1',
      qtyOnHand: 0,
      qtyCommitSales: 0,
      availableQty: lot.availableQty,
      expiryDate: lot.dateExpiry,
      lotStatus: 'P',
    })
  }

  const formatQuantity = (value?: number | null) => Number(value ?? 0).toFixed(4)
  // Improved label styling - better readability
  const labelClass = 'text-[13px] font-semibold uppercase tracking-[0.18em] text-mocha min-w-[120px]'
  // Enhanced button styles with better shadows and hover effects
  const lookupButtonClass =
    'h-12 min-w-[52px] rounded-full bg-[#ffc107] px-4 text-sm font-bold uppercase tracking-[0.20em] text-coffee shadow-button transition-smooth hover:bg-[#ffa000] hover:shadow-button-hover hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#ffc107] focus-visible:ring-offset-2 disabled:bg-[#f6d9a9]/60 disabled:text-coffee/40 disabled:shadow-none disabled:cursor-not-allowed disabled:hover:scale-100'
  const fetchButtonClass =
    'h-12 min-w-[160px] rounded-full bg-[#ffc107] px-6 text-[12px] font-extrabold uppercase tracking-[0.24em] text-coffee shadow-button transition-smooth hover:bg-[#ffa000] hover:shadow-button-hover hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#ffc107] focus-visible:ring-offset-2 disabled:bg-[#f6d9a9]/60 disabled:text-coffee/40 disabled:shadow-none disabled:cursor-not-allowed disabled:hover:scale-100'
  const actionButtonBase =
    'inline-flex h-12 w-full items-center justify-center rounded-full text-[13px] font-extrabold uppercase tracking-[0.20em] transition-smooth focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-offset-2'
  const primaryButtonClass = `${actionButtonBase} bg-[#ffc107] text-coffee shadow-button hover:bg-[#ffa000] hover:shadow-button-hover hover:scale-[1.02] focus-visible:ring-[#ffc107] disabled:bg-[#f6d9a9]/60 disabled:text-coffee/40 disabled:shadow-none disabled:cursor-not-allowed disabled:hover:scale-100`
  const secondaryButtonClass = `${actionButtonBase} bg-gradient-to-b from-white/15 to-white/5 text-coffee border-2 border-sand/80 shadow-card hover:from-white/25 hover:to-white/15 hover:border-sand hover:scale-[1.01] focus-visible:ring-sand disabled:bg-white/5 disabled:text-coffee/40 disabled:shadow-none disabled:cursor-not-allowed disabled:hover:scale-100`
  const dangerButtonClass = `${actionButtonBase} bg-[#dc3545] text-white shadow-[0_8px_16px_-6px_rgba(220,53,69,0.40)] hover:bg-[#c82333] hover:shadow-[0_12px_24px_-8px_rgba(220,53,69,0.50)] hover:scale-[1.02] focus-visible:ring-[#dc3545] disabled:bg-[#f4c5bf] disabled:text-white/70 disabled:shadow-none disabled:cursor-not-allowed disabled:hover:scale-100`
  const weightRangeLow = currentItem?.weightRangeLow ?? 0
  const weightRangeHigh = currentItem?.weightRangeHigh ?? 0
  const toleranceValue =
    currentItem?.toleranceKG ??
    (currentItem ? Math.max((currentItem.weightRangeHigh - currentItem.weightRangeLow) / 2, 0) : 0)
  const weightInRange =
    currentWeight > 0 && currentWeight >= weightRangeLow && currentWeight <= weightRangeHigh
  const weightFieldClass = weightInRange
    ? 'border-[#2f7a52] bg-[#f2fff5] text-[#2f7a52] shadow-[0_0_0_3px_rgba(47,122,82,0.12)]'
    : currentWeight > 0
      ? 'border-[#d04b3b] bg-[#fff1f1] text-[#d04b3b] shadow-[0_0_0_3px_rgba(208,75,59,0.12)]'
      : 'border-[#e7d7c6] text-coffee'
  const baseBatchItems = currentBatchItems.map((item, index) => ({
    lineId: index + 1,
    itemKey: item.itemKey,
    description: item.description,
    batchNo: currentBatchRowNum || 0,
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
  const batchNumberDisplay = currentBatchRowNum?.toString() ?? ''
  const productionDateDisplay = currentRun?.productionDate || ''
  const availableQtyDisplay = selectedLot ? formatQuantity(selectedLot.availableQty) : '0.0000'
  const handleScaleSelection = (scale: 'small' | 'big') => {
    setSelectedScale(scale)
    setManualWeight(null)
  }

  return (
    <div className="min-h-screen bg-[#f6efe5] px-4 py-4 font-rounded">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4">
        {/* Notifications */}
        {(successMessage || errorMessage || isLoading) && (
          <div className="grid gap-3">
            {successMessage && (
              <div className="rounded-3xl border-2 border-[#2f7a52]/50 bg-gradient-to-br from-[#e8f5e9] to-[#c8f1d6] px-6 py-4 text-[13px] font-bold uppercase tracking-[0.16em] text-[#2f7a52] shadow-card">
                {successMessage}
              </div>
            )}
            {errorMessage && (
              <div className="flex items-center justify-between rounded-3xl border-2 border-[#dc3545]/50 bg-gradient-to-br from-[#ffebee] to-[#ffd9d4] px-6 py-4 text-[13px] font-bold uppercase tracking-[0.16em] text-[#dc3545] shadow-card">
                <span>{errorMessage}</span>
                <button
                  onClick={clearError}
                  aria-label="Clear error"
                  className="ml-4 text-[20px] font-bold text-[#dc3545] transition-smooth hover:scale-110 hover:text-[#b71c1c]"
                >
                  ×
                </button>
              </div>
            )}
            {isLoading && (
              <div className="rounded-3xl border-2 border-[#ffc107]/50 bg-gradient-to-br from-[#fff8e1] to-[#ffeaa7] px-6 py-4 text-[13px] font-bold uppercase tracking-[0.16em] text-[#d99a2f] shadow-card">
                Loading…
              </div>
            )}
          </div>
        )}

        {/* Unified Section: Weight Progress + Header + Form + Table */}
        <section className="grid grid-cols-1 gap-5 rounded-[32px] border-2 border-sand/80 bg-white/95 shadow-panel-enhanced lg:grid-cols-[480px_1fr]">
          {/* Weight Progress Bar with tolerance markers and scale selector */}
          <div className="p-4 lg:col-span-2">
            <WeightProgressBar
              weight={currentWeight}
              targetWeight={currentItem?.totalNeeded ?? 0}
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
              <div className="flex items-center gap-2">
                <Input
                  value={runNumberDisplay}
                  placeholder="Select run"
                  readOnly
                  className="h-12 flex-1 rounded-2xl border-2 border-[#d4c4b3] bg-[#fdfaf7] text-[15px] font-semibold uppercase tracking-[0.16em] text-coffee"
                />
                <Button
                  type="button"
                  onClick={() => setShowRunModal(true)}
                  className={lookupButtonClass}
                  disabled={isLoading}
                  aria-label="Lookup run number"
                >
                  🔍
                </Button>
              </div>

              <label className={labelClass}>FG ItemKey</label>
              <Input
                value={currentRun?.fgItemKey || ''}
                readOnly
                placeholder="Item key"
                className="h-12 rounded-2xl border-2 border-[#d4c4b3] bg-[#fdfaf7] text-[15px] font-semibold uppercase tracking-[0.16em] text-coffee"
              />

              <label className={labelClass}>Description</label>
              <Input
                value={currentRun?.fgDescription || ''}
                readOnly
                placeholder="Description"
                className="h-12 rounded-2xl border-2 border-[#d4c4b3] bg-[#fdfaf7] text-[15px] font-medium text-coffee"
              />
            </div>
          </div>

          {/* Header Row 2: Batch No + Batches + Production Date (Full Width) */}
          <div className="border-b-2 border-sand/60 px-4 pt-2 pb-4 lg:col-span-2">
            <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-[auto_200px_auto_120px_auto_minmax(0,1fr)] md:gap-x-4">
              <label className={labelClass}>Batch No</label>
              <div className="flex items-center gap-2">
                <Input
                  value={batchNumberDisplay}
                  placeholder="Select batch"
                  readOnly
                  className="h-12 flex-1 rounded-2xl border-2 border-[#d4c4b3] bg-[#fdfaf7] text-[15px] font-semibold uppercase tracking-[0.16em] text-coffee"
                />
                <Button
                  type="button"
                  onClick={() => setShowBatchModal(true)}
                  className={lookupButtonClass}
                  disabled={!currentRun || isLoading}
                  aria-label="Lookup batch number"
                >
                  🔍
                </Button>
              </div>

              <label className={labelClass}>Batches</label>
              <div className="flex h-12 items-center rounded-2xl border-2 border-sand/80 bg-[#f9f3ec] px-4 shadow-soft">
                <span className="text-[15px] font-bold text-coffee">
                  {currentRun?.batches.length ?? 0}
                </span>
              </div>

              <label className={labelClass}>Production date</label>
              <div className="flex h-12 items-center rounded-2xl border-2 border-sand/80 bg-[#f9f3ec] px-4 shadow-soft">
                <span className="text-[15px] font-bold text-coffee">
                  {productionDateDisplay || '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Form Section (Left Column) */}
          <div className="flex flex-col p-5">
            <div className="space-y-4">
              {/* Inline layout: label and input on same row */}
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                <label className={labelClass}>Item key</label>
                <Input
                  value={currentItem?.itemKey || ''}
                  placeholder="Select item"
                  readOnly
                  className="h-12 rounded-2xl border-2 border-[#d4c4b3] bg-[#fdfaf7] text-[15px] font-medium uppercase tracking-[0.16em] text-coffee transition-smooth focus-within:border-[#ffc107] input-glow-focus"
                />
                <Button
                  type="button"
                  onClick={() => setShowItemModal(true)}
                  className={lookupButtonClass}
                  disabled={!currentBatchRowNum || isLoading}
                  aria-label="Lookup item key"
                >
                  🔍
                </Button>
              </div>

              {/* Inline layout: label and input on same row */}
              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
                <label className={labelClass}>Description</label>
                <Input
                  value={currentItem?.description || ''}
                  readOnly
                  placeholder="Description"
                  className="h-12 rounded-2xl border-2 border-[#d4c4b3] bg-[#fdfaf7] text-[15px] font-medium text-coffee"
                />
              </div>

              {/* Lot and Bin section - inline layout */}
              <div className="space-y-3">
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                  <label className={labelClass}>Lot No.</label>
                  <Input
                    value={selectedLot?.lotNo || ''}
                    placeholder="Auto-selected (FEFO)"
                    readOnly
                    className="h-12 rounded-2xl border-2 border-[#d4c4b3] bg-[#fdfaf7] text-[15px] font-medium text-coffee"
                  />
                  <Button
                    type="button"
                    onClick={() => setShowLotModal(true)}
                    className={lookupButtonClass}
                    disabled={!currentItem || isLoading}
                    aria-label="Override lot number"
                  >
                    🔍
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl border-2 border-sand/80 bg-[#f9f3ec] px-4 py-3 shadow-soft">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.20em] text-mocha/60">
                      SOH
                    </span>
                    <p className="text-[15px] font-bold text-coffee">{availableQtyDisplay} KG</p>
                  </div>
                  <div className="rounded-2xl border-2 border-sand/80 bg-[#f9f3ec] px-4 py-3 shadow-soft">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.20em] text-mocha/60">
                      Expiry
                    </span>
                    <p className="text-[15px] font-bold text-coffee">
                      {selectedLot?.expiryDate || '—'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                <label className={labelClass}>Bin No.</label>
                <Input
                  value={selectedLot?.binNo || ''}
                  placeholder="Auto from lot"
                  readOnly
                  className="h-12 rounded-2xl border-2 border-[#d4c4b3] bg-[#fdfaf7] text-[15px] font-medium text-coffee"
                />
                <Button
                  type="button"
                  onClick={() => setShowBinModal(true)}
                  className={lookupButtonClass}
                  disabled={!currentItem || isLoading}
                  aria-label="Lookup bin number"
                >
                  🔍
                </Button>
              </div>

              {/* Weight section - inline with Fetch button */}
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                <label className={labelClass}>Weight</label>
                <Input
                  value={formatQuantity(currentWeight)}
                  readOnly
                  className={`h-12 rounded-2xl border-2 bg-[#fdfaf7] font-mono text-[17px] font-bold tracking-wider transition-smooth ${weightFieldClass}`}
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
              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
                <label className={labelClass}>Weight range</label>
                <div className="flex items-center gap-3">
                  <Input
                    value={formatQuantity(weightRangeLow)}
                    readOnly
                    className="h-12 flex-1 rounded-2xl border-2 border-[#d4c4b3] bg-[#fdfaf7] font-mono text-[15px] font-semibold text-coffee"
                  />
                  <span className="text-[13px] font-semibold uppercase tracking-[0.16em] text-mocha/60">
                    to
                  </span>
                  <Input
                    value={formatQuantity(weightRangeHigh)}
                    readOnly
                    className="h-12 flex-1 rounded-2xl border-2 border-[#d4c4b3] bg-[#fdfaf7] font-mono text-[15px] font-semibold text-coffee"
                  />
                </div>
              </div>

              {/* Total needed - inline */}
              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
                <label className={labelClass}>Total needed</label>
                <Input
                  value={formatQuantity(currentItem?.totalNeeded)}
                  readOnly
                  className="h-12 rounded-2xl border-2 border-[#d4c4b3] bg-[#fdfaf7] font-mono text-[15px] font-semibold text-coffee"
                />
              </div>

              {/* Remaining qty - inline */}
              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
                <label className={labelClass}>Remaining qty</label>
                <Input
                  value={formatQuantity(currentItem?.remainingQty)}
                  readOnly
                  className="h-12 rounded-2xl border-2 border-[#d4c4b3] bg-[#fdfaf7] font-mono text-[15px] font-semibold text-coffee"
                />
              </div>
            </div>

            {selectedLot && (
              <div className="mt-6 rounded-2xl border-2 border-[#f0b429]/40 bg-gradient-to-br from-[#ffeaa7] to-[#f7d794] px-6 py-4 text-[13px] font-bold uppercase tracking-[0.18em] text-coffee shadow-card">
                Lot {selectedLot.lotNo} · Bin {selectedLot.binNo || '—'} · Available{' '}
                {availableQtyDisplay} KG
              </div>
            )}

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
                onClick={handleExit}
                disabled={isLoading}
                className={dangerButtonClass}
              >
                Exit
              </Button>
            </div>
          </div>

          {/* Table Section (Right Column) */}
          <div className="flex flex-col p-5">
            <BatchTicketGrid
              items={gridItems}
              filter={gridFilter}
              onFilterChange={setGridFilter}
              pendingCount={pendingCount}
              pickedCount={pickedCount}
              onItemClick={item => handleItemSelect(item.itemKey)}
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
        onSelect={batch => handleBatchSelect(batch.rowNum)}
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
        targetQty={currentItem?.totalNeeded}
      />
      <BinSelectionModal
        open={showBinModal}
        onOpenChange={setShowBinModal}
        onSelect={bin => console.log('[PartialPickingPage] Bin selected:', bin)}
        lotNo={selectedLot?.lotNo}
      />
    </div>
  )
}
