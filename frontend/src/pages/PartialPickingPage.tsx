/**
 * Partial Picking Page
 *
 * Main picking interface for warehouse operators with:
 * - Weight progress bar with real-time scale updates (T073-T075)
 * - Run/Batch/Item selection modals with search
 * - FEFO lot selection with auto-population
 * - Save Pick/Unpick operations
 * - Complete Run workflow
 *
 * T069: Wired with PickingContext for complete API integration
 * T075: Integrated with useWeightScale for dual scale WebSocket support
 */

import { useState } from 'react'
import { usePicking } from '@/contexts/PickingContext'
import { useWeightScale } from '@/hooks/useWeightScale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { WeightProgressBar } from '@/components/picking/WeightProgressBar'
import { RunSelectionModal } from '@/components/picking/RunSelectionModal'
import { BatchSelectionModal } from '@/components/picking/BatchSelectionModal'
import { ItemSelectionModal } from '@/components/picking/ItemSelectionModal'
import { LotSelectionModal } from '@/components/picking/LotSelectionModal'
import { BinSelectionModal } from '@/components/picking/BinSelectionModal'
import { BatchTicketGrid } from '@/components/picking/BatchTicketGrid'

export function PartialPickingPage() {
  // T069: Picking context with real API integration
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
    setWorkstation,
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

  // T075: Dual scale WebSocket integration
  const [selectedScale, setSelectedScale] = useState<'small' | 'big'>('small')
  const smallScale = useWeightScale('small')
  const bigScale = useWeightScale('big')

  // Get current scale based on selection
  const currentScale = selectedScale === 'small' ? smallScale : bigScale

  // Weight input state (can be manually entered or auto-populated from scale)
  const [manualWeight, setManualWeight] = useState<number | null>(null)
  const currentWeight = manualWeight !== null ? manualWeight : currentScale.weight

  // Success notification state
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  /**
   * T069: Handle Save Pick button
   * T075: Uses weight from WebSocket scale (auto-populated or manual)
   * Calls PickingContext.savePick() → POST /api/picks
   */
  const handleSavePick = async () => {
    try {
      await savePick(currentWeight)

      // Show success notification
      setSuccessMessage('Pick saved successfully!')
      setTimeout(() => setSuccessMessage(null), 3000)

      // Clear manual weight after successful pick
      setManualWeight(null)
    } catch (error) {
      // Error is handled in context and displayed in errorMessage
      console.error('[PartialPickingPage] Save pick failed:', error)
    }
  }

  /**
   * T075: Handle Use Weight button from progress bar
   * Auto-populate weight input when scale reading is stable and in range
   */
  const handleUseWeight = (weight: number) => {
    setManualWeight(weight)
    setSuccessMessage(
      `Weight ${weight.toFixed(3)} kg captured from ${selectedScale.toUpperCase()} scale`
    )
    setTimeout(() => setSuccessMessage(null), 2000)
  }

  /**
   * T075: Handle Tare button
   * Reset manual weight input
   */
  const handleTare = () => {
    setManualWeight(null)
  }

  /**
   * T069: Handle Unpick button
   * Calls PickingContext.unpickItem() → DELETE /api/picks/{runNo}/{rowNum}/{lineId}
   */
  const handleUnpick = async () => {
    if (!currentItem) {
      return
    }

    if (!confirm(`Are you sure you want to unpick ${currentItem.itemKey}?`)) {
      return
    }

    try {
      // Find lineId for current item
      const lineId = currentBatchItems.findIndex(i => i.itemKey === currentItem.itemKey) + 1

      if (lineId === 0) {
        alert('Item not found in batch items')
        return
      }

      await unpickItem(lineId)

      // Show success notification
      setSuccessMessage('Item unpicked successfully!')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (error) {
      // Error is handled in context
      console.error('[PartialPickingPage] Unpick failed:', error)
    }
  }

  /**
   * T069: Handle Complete Run button
   * Calls PickingContext.completeRun() → POST /api/runs/{runNo}/complete
   */
  const handleCompleteRun = async () => {
    if (!currentRun) {
      return
    }

    if (!confirm(`Complete run ${currentRun.runNo} and assign pallet?`)) {
      return
    }

    try {
      await completeRun()

      // Show success notification with pallet ID (from response)
      setSuccessMessage(`Run ${currentRun.runNo} completed successfully! Status: PRINT`)
      setTimeout(() => setSuccessMessage(null), 5000)
    } catch (error) {
      // Error is handled in context
      console.error('[PartialPickingPage] Complete run failed:', error)
    }
  }

  /**
   * T069: Handle Run selection from modal
   * Calls PickingContext.selectRun() → GET /api/runs/{runNo}
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
   * T069: Handle Batch selection from modal
   * Calls PickingContext.selectBatch() → GET /api/runs/{runNo}/batches/{rowNum}/items
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
   * T069: Handle Item selection from modal or grid click
   * Calls PickingContext.selectItem() → GET /api/lots/available?itemKey={itemKey}
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
   * T069: Handle Lot selection from modal
   * Manual lot override (FEFO lot auto-selected by default)
   */
  const handleLotSelect = (lot: { lotNo: string; dateExpiry: string; availableQty: number }) => {
    setShowLotModal(false)
    clearError()

    // Convert to LotAvailabilityDTO format
    selectLot({
      lotNo: lot.lotNo,
      itemKey: currentItem?.itemKey || '',
      binNo: '', // Will be selected in bin modal
      locationKey: 'TFC1',
      qtyOnHand: 0,
      qtyCommitSales: 0,
      availableQty: lot.availableQty,
      expiryDate: lot.dateExpiry, // Convert from dateExpiry to expiryDate
      lotStatus: 'P',
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* T075: Weight Progress Bar with WebSocket integration */}
      <WeightProgressBar
        scaleType={selectedScale}
        targetWeight={currentItem?.totalNeeded || 0}
        tolerance={currentItem?.toleranceKG || 1.0}
        onTare={handleTare}
        onUseWeight={handleUseWeight}
      />

      {/* Header Row 1: Run No, FG Item, Scale Switcher */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        {/* Run No */}
        <div className="space-y-2">
          <Label htmlFor="runNo">Run No</Label>
          <div className="flex gap-2">
            <Input
              id="runNo"
              type="text"
              value={currentRun?.runNo || ''}
              className="flex-1 bg-gray-100"
              placeholder="Select Run"
              readOnly
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowRunModal(true)}
              aria-label="Lookup run number"
              className="min-h-[44px]"
              disabled={isLoading}
            >
              🔍
            </Button>
          </div>
        </div>

        {/* FG ItemKey */}
        <div className="space-y-2">
          <Label>FG ItemKey</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="text"
              value={currentRun?.fgItemKey || ''}
              readOnly
              placeholder="Item Key"
              className="bg-gray-100"
            />
            <Input
              type="text"
              value={currentRun?.fgDescription || ''}
              readOnly
              placeholder="Description"
              className="bg-gray-100"
            />
          </div>
        </div>

        {/* T075: Scale Switcher with connection status */}
        <div className="space-y-2">
          <Label>Scale Type</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={selectedScale === 'small' ? 'default' : 'outline'}
              onClick={() => setSelectedScale('small')}
              className={`flex-1 min-h-[44px] ${
                selectedScale === 'small'
                  ? 'bg-[#8B4513] hover:bg-[#A0522D]'
                  : 'bg-white hover:bg-gray-100 text-gray-900'
              }`}
              title={smallScale.online ? 'Small scale online' : 'Small scale offline'}
            >
              SMALL {smallScale.online ? '🟢' : '🔴'}
            </Button>
            <Button
              type="button"
              variant={selectedScale === 'big' ? 'default' : 'outline'}
              onClick={() => setSelectedScale('big')}
              className={`flex-1 min-h-[44px] ${
                selectedScale === 'big'
                  ? 'bg-[#8B4513] hover:bg-[#A0522D]'
                  : 'bg-white hover:bg-gray-100 text-gray-900'
              }`}
              title={bigScale.online ? 'Big scale online' : 'Big scale offline'}
            >
              BIG {bigScale.online ? '🟢' : '🔴'}
            </Button>
          </div>
          {/* Display both scale weights */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className={`p-2 rounded ${smallScale.online ? 'bg-green-50' : 'bg-gray-50'}`}>
              <div className="font-medium">Small: {smallScale.weight.toFixed(3)} kg</div>
              <div className="text-gray-600">{smallScale.stable ? '⚖️ Stable' : '⏳ Unstable'}</div>
            </div>
            <div className={`p-2 rounded ${bigScale.online ? 'bg-green-50' : 'bg-gray-50'}`}>
              <div className="font-medium">Big: {bigScale.weight.toFixed(3)} kg</div>
              <div className="text-gray-600">{bigScale.stable ? '⚖️ Stable' : '⏳ Unstable'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Header Row 2: Batch No, Batches Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {/* Batch No */}
        <div className="space-y-2">
          <Label htmlFor="batchNo">Batch No</Label>
          <div className="flex gap-2">
            <Input
              id="batchNo"
              type="text"
              value={currentBatchRowNum || ''}
              placeholder="Select Batch"
              className="flex-1 bg-gray-100"
              readOnly
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowBatchModal(true)}
              aria-label="Lookup batch number"
              className="min-h-[44px]"
              disabled={!currentRun || isLoading}
            >
              🔍
            </Button>
          </div>
        </div>

        {/* Batches Info */}
        <div className="space-y-2">
          <Label>Batches</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="text"
              value={currentRun?.batches.join(', ') || ''}
              readOnly
              placeholder="Available Batches"
              className="bg-gray-100"
            />
            <Input
              type="text"
              value={currentRun?.productionDate || ''}
              readOnly
              placeholder="Production Date"
              className="bg-gray-100"
            />
          </div>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {successMessage}
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <div className="flex justify-between items-start">
            <span>{errorMessage}</span>
            <button
              onClick={clearError}
              className="text-red-500 hover:text-red-700 font-bold ml-4"
              aria-label="Clear error"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-700">
          Loading...
        </div>
      )}

      {/* Main Content: Form and Batch Ticket Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        {/* Form Column (Left) */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-bold mb-4">Item Details</h2>
          <div className="space-y-4">
            {/* Item Key */}
            <div className="space-y-2">
              <Label htmlFor="itemKey">Item Key</Label>
              <div className="flex gap-2">
                <Input
                  id="itemKey"
                  type="text"
                  value={currentItem?.itemKey || ''}
                  placeholder="Select Item"
                  className="flex-1 bg-gray-100"
                  readOnly
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowItemModal(true)}
                  aria-label="Lookup item key"
                  className="min-h-[44px]"
                  disabled={!currentBatchRowNum || isLoading}
                >
                  🔍
                </Button>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                type="text"
                value={currentItem?.description || ''}
                readOnly
                className="bg-gray-100"
              />
            </div>

            {/* Quantities */}
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2">
                <Label>Target (kg)</Label>
                <Input
                  type="text"
                  value={currentItem?.totalNeeded.toFixed(2) || '0.00'}
                  readOnly
                  className="bg-gray-100"
                />
              </div>
              <div className="space-y-2">
                <Label>Picked (kg)</Label>
                <Input
                  type="text"
                  value={currentItem?.pickedQty.toFixed(2) || '0.00'}
                  readOnly
                  className="bg-gray-100"
                />
              </div>
              <div className="space-y-2">
                <Label>Remaining (kg)</Label>
                <Input
                  type="text"
                  value={currentItem?.remainingQty.toFixed(2) || '0.00'}
                  readOnly
                  className="bg-gray-100"
                />
              </div>
            </div>

            {/* Weight Range */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Weight Low (kg)</Label>
                <Input
                  type="text"
                  value={currentItem?.weightRangeLow.toFixed(3) || '0.000'}
                  readOnly
                  className="bg-gray-100"
                />
              </div>
              <div className="space-y-2">
                <Label>Weight High (kg)</Label>
                <Input
                  type="text"
                  value={currentItem?.weightRangeHigh.toFixed(3) || '0.000'}
                  readOnly
                  className="bg-gray-100"
                />
              </div>
            </div>

            {/* Lot No (FEFO auto-selected) */}
            <div className="space-y-2">
              <Label htmlFor="lotNo">Lot No (FEFO)</Label>
              <div className="flex gap-2">
                <Input
                  id="lotNo"
                  type="text"
                  value={selectedLot?.lotNo || ''}
                  placeholder="Auto-selected by FEFO"
                  readOnly
                  className="flex-1 bg-gray-100"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowLotModal(true)}
                  aria-label="Override FEFO lot"
                  className="min-h-[44px]"
                  disabled={!currentItem || isLoading}
                >
                  🔍
                </Button>
              </div>
              {selectedLot && (
                <p className="text-xs text-gray-600">
                  Expiry: {selectedLot.expiryDate} | Available:{' '}
                  {selectedLot.availableQty.toFixed(2)} kg | Bin: {selectedLot.binNo}
                </p>
              )}
            </div>

            {/* Bin No (from selected lot) */}
            <div className="space-y-2">
              <Label htmlFor="binNo">Bin No</Label>
              <Input
                id="binNo"
                type="text"
                value={selectedLot?.binNo || ''}
                placeholder="From selected lot"
                readOnly
                className="bg-gray-100"
              />
            </div>

            {/* T075: Manual Weight Input (with auto-populate from scale) */}
            <div className="space-y-2">
              <Label htmlFor="weightInput">Weight (kg)</Label>
              <Input
                id="weightInput"
                type="number"
                step="0.001"
                value={currentWeight.toFixed(3)}
                onChange={e => setManualWeight(parseFloat(e.target.value) || 0)}
                placeholder="Weight in kg"
                className="text-lg font-mono"
              />
              <p className="text-xs text-gray-600">
                {manualWeight !== null
                  ? 'Manual entry'
                  : currentScale.online
                    ? `Live from ${selectedScale.toUpperCase()} scale ${currentScale.stable ? '(stable)' : '(unstable)'}`
                    : 'Scale offline - manual entry required'}
              </p>
            </div>

            {/* T075: Action Buttons - disable if scale offline */}
            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                onClick={handleSavePick}
                disabled={
                  isLoading ||
                  !currentItem ||
                  !selectedLot ||
                  !currentWeight ||
                  !currentScale.online
                }
                className="flex-1 min-h-[44px] bg-green-600 hover:bg-green-700"
                title={
                  !currentScale.online
                    ? `${selectedScale.toUpperCase()} scale offline - cannot save pick`
                    : 'Save pick'
                }
              >
                {isLoading ? 'Saving...' : 'Save Pick'}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleUnpick}
                disabled={isLoading || !currentItem || currentItem.pickedQty === 0}
                className="flex-1 min-h-[44px]"
              >
                Unpick
              </Button>
            </div>

            {/* Complete Run Button */}
            <Button
              type="button"
              onClick={handleCompleteRun}
              disabled={isLoading || !currentRun || currentRun.status === 'PRINT'}
              className="w-full min-h-[44px] bg-[#FF8C00] hover:bg-[#FF7F00]"
            >
              {currentRun?.status === 'PRINT' ? 'Run Completed' : 'Complete Run'}
            </Button>
          </div>
        </div>

        {/* Batch Ticket Grid (Right) - T069: Use real batch items from context */}
        <BatchTicketGrid
          items={currentBatchItems.map(item => ({
            lineId: currentBatchItems.indexOf(item) + 1,
            itemKey: item.itemKey,
            description: item.description,
            targetQty: item.totalNeeded,
            pickedQty: item.pickedQty,
            balance: item.remainingQty,
            batchNo: currentBatchRowNum || 0,
            allergens: item.allergen,
            status: item.status === 'Allocated' ? 'picked' : 'unpicked',
          }))}
          onItemClick={item => {
            // Click on grid item to select it
            handleItemSelect(item.itemKey)
          }}
        />
      </div>

      {/* Modals - T069: Wire with context handlers */}
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
