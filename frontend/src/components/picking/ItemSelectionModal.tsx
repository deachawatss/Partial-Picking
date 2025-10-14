import { useMemo } from 'react'
import { useBatchItems, useAllRunItems } from '@/hooks/useItemsQuery'

interface PickItem {
  lineId: number
  itemKey: string
  batchNo: string
  description: string
  targetQty: number
  pickedQty: number
  balance: number
  status: 'unpicked' | 'picked' | 'error'
}

interface ItemSelectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (item: PickItem) => void
  runNo: number | null
  batchNo: number | null  // null = show all items across all batches
}

export function ItemSelectionModal({
  open,
  onOpenChange,
  onSelect,
  runNo,
  batchNo,
}: ItemSelectionModalProps) {
  // Query: If batchNo provided, get items for that batch only
  //        If batchNo is null, get ALL items across ALL batches
  const { data: specificBatchItems, isLoading: isLoadingBatch, error: errorBatch } = useBatchItems(
    runNo,
    batchNo,
    {
      enabled: open && !!runNo && batchNo !== null,
    }
  )
  const { data: allRunItems, isLoading: isLoadingAll, error: errorAll } = useAllRunItems(runNo, {
    enabled: open && !!runNo && batchNo === null,
  })

  // Use appropriate data source based on whether batchNo was provided
  const batchItems = batchNo === null ? allRunItems : specificBatchItems
  const isLoading = batchNo === null ? isLoadingAll : isLoadingBatch
  const error = batchNo === null ? errorAll : errorBatch

  // Map BatchItemDTO to PickItem - Filter to only show unpicked items
  const items = useMemo<PickItem[]>(() => {
    if (!batchItems) return []

    return batchItems
      .filter((item) => item.pickedQty === 0) // Only show unpicked items (pickedQty = 0)
      .map((item, index) => ({
        lineId: index + 1, // Generate lineId from index
        itemKey: item.itemKey,
        batchNo: item.batchNo,
        description: item.description,
        targetQty: item.totalNeeded,
        pickedQty: item.pickedQty,
        balance: item.remainingQty,
        status: 'unpicked', // All items shown are unpicked
      }))
  }, [batchItems])

  // Count unique batches when showing all items
  const batchCount = useMemo(() => {
    if (!batchItems) return 0
    const uniqueBatches = new Set(batchItems.map(item => item.batchNo))
    return uniqueBatches.size
  }, [batchItems])

  const handleSelect = (item: PickItem) => {
    onSelect(item)
    onOpenChange(false)
  }

  const handleClose = () => {
    onOpenChange(false)
  }


  if (!open) return null

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header - Brown Gradient */}
        <div className="modal-header-brown">
          <h3 className="modal-title">
            <span>📝</span>
            <span>
              Select Item{' '}
              {runNo &&
                (batchNo !== null
                  ? batchItems?.[0]?.batchNo && `(Run: ${runNo}, Batch: ${batchItems[0].batchNo})`
                  : `(Run: ${runNo})`)}
            </span>
          </h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={handleClose}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {/* Results Section */}
        <div className="modal-content">
          {/* Error State */}
          {error && (
            <div className="modal-empty-state">
              <div className="modal-empty-icon">⚠️</div>
              <p className="modal-empty-text">Error loading items</p>
              <p className="modal-empty-hint">
                Could not load items for run {runNo}, batch {batchNo}. Please try again.
              </p>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="modal-empty-state">
              <div className="modal-empty-icon">⏳</div>
              <p className="modal-empty-text">Loading items...</p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && items.length === 0 && (
            <div className="modal-empty-state">
              <div className="modal-empty-icon">📋</div>
              <p className="modal-empty-text">No unpicked items</p>
              <p className="modal-empty-hint">
                {runNo && batchNo !== null
                  ? `All items in batch ${batchNo} have been picked`
                  : runNo
                    ? `All items in run ${runNo} have been picked`
                    : 'Please select a run first'}
              </p>
            </div>
          )}

          {/* Items Table */}
          {!isLoading && !error && items.length > 0 && (
            <div className="modal-table-container">
              <table className="modal-table">
                <thead>
                  <tr>
                    <th className="text-center">Line</th>
                    {batchNo === null && <th className="text-center">Batch No</th>}
                    <th>Item Key</th>
                    <th>Description</th>
                    <th className="text-center">Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.lineId} onClick={() => handleSelect(item)}>
                      <td className="text-center">
                        <strong>{index + 1}</strong>
                      </td>
                      {batchNo === null && (
                        <td className="text-center">
                          <strong>{item.batchNo}</strong>
                        </td>
                      )}
                      <td>
                        <strong>{item.itemKey}</strong>
                      </td>
                      <td className="text-left" title={item.description}>
                        {item.description}
                      </td>
                      <td className="text-center">KG</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {!isLoading && !error && items.length > 0 && (
          <div className="modal-footer">
            <div className="modal-footer-left">
              <p className="modal-footer-info">
                Showing {items.length} unpicked item{items.length !== 1 ? 's' : ''}
                {batchNo === null && batchCount > 1 && ` across ${batchCount} batches`}
              </p>
            </div>

            <button type="button" onClick={handleClose} className="modal-cancel-btn">
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
