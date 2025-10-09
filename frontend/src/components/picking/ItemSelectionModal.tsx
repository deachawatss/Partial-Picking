import { useMemo } from 'react'
import { useBatchItems } from '@/hooks/useItemsQuery'
import type { BatchItemDTO } from '@/types/api'

interface PickItem {
  lineId: number
  itemKey: string
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
  batchNo: number | null
}

export function ItemSelectionModal({
  open,
  onOpenChange,
  onSelect,
  runNo,
  batchNo,
}: ItemSelectionModalProps) {
  const { data: batchItems, isLoading, error } = useBatchItems(runNo, batchNo, {
    enabled: open && !!runNo && !!batchNo
  })

  // Map BatchItemDTO to PickItem
  const items = useMemo<PickItem[]>(() => {
    if (!batchItems) return []

    return batchItems.map((item, index) => ({
      lineId: index + 1, // Generate lineId from index
      itemKey: item.itemKey,
      description: item.description,
      targetQty: item.totalNeeded,
      pickedQty: item.pickedQty,
      balance: item.remainingQty,
      status: item.status === 'Allocated' ? 'picked' : 'unpicked',
    }))
  }, [batchItems])

  const handleSelect = (item: PickItem) => {
    onSelect(item)
    onOpenChange(false)
  }

  const handleClose = () => {
    onOpenChange(false)
  }

  const getStatusClass = (status: string) => {
    if (status === 'picked') return 'modal-status-completed'
    if (status === 'error') return 'modal-status-default'
    return 'modal-status-new'
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
              Select Item {runNo && batchNo && `(Run: ${runNo}, Batch: ${batchNo})`}
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
              <p className="modal-empty-text">No items found</p>
              <p className="modal-empty-hint">
                {runNo && batchNo
                  ? `Batch ${batchNo} has no items`
                  : 'Please select a run and batch first'}
              </p>
            </div>
          )}

          {/* Items Table */}
          {!isLoading && !error && items.length > 0 && (
            <div className="modal-table-container">
              <table className="modal-table">
                <thead>
                  <tr>
                    <th>Item Key</th>
                    <th>Description</th>
                    <th className="text-center">Target (kg)</th>
                    <th className="text-center">Picked (kg)</th>
                    <th className="text-center">Balance (kg)</th>
                    <th className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.lineId} onClick={() => handleSelect(item)}>
                      <td>
                        <strong>{item.itemKey}</strong>
                      </td>
                      <td title={item.description}>{item.description}</td>
                      <td className="text-center">{item.targetQty.toFixed(3)}</td>
                      <td className="text-center">{item.pickedQty.toFixed(3)}</td>
                      <td
                        className="text-center"
                        style={{
                          color: item.balance > 0 ? '#2B1C14' : '#2E7D32',
                          fontWeight: item.balance === 0 ? 'bold' : 'normal',
                        }}
                      >
                        {item.balance.toFixed(3)}
                      </td>
                      <td className="text-center">
                        <span className={`modal-status-badge ${getStatusClass(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
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
                Showing {items.length} item{items.length !== 1 ? 's' : ''}
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
