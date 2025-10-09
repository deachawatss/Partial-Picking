interface Batch {
  batchNo: number
  rowNum: number
  itemCount: number
  pickedCount: number
  status: string
}

interface BatchSelectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (batch: Batch) => void
  runNo?: number
}

export function BatchSelectionModal({
  open,
  onOpenChange,
  onSelect,
  runNo,
}: BatchSelectionModalProps) {
  // Mock data - will be replaced with API call in Phase 3.4 (T065)
  const mockBatches: Batch[] = [
    {
      batchNo: 1,
      rowNum: 1,
      itemCount: 10,
      pickedCount: 5,
      status: 'In Progress',
    },
    {
      batchNo: 2,
      rowNum: 2,
      itemCount: 8,
      pickedCount: 0,
      status: 'Pending',
    },
    {
      batchNo: 3,
      rowNum: 3,
      itemCount: 12,
      pickedCount: 12,
      status: 'Completed',
    },
  ]

  const handleSelect = (batch: Batch) => {
    onSelect(batch)
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
            <span>📦</span>
            <span>Select Batch {runNo && `(Run: ${runNo})`}</span>
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

        {/* Batch Cards */}
        <div className="modal-content">
          {mockBatches.length === 0 ? (
            <div className="modal-empty-state">
              <div className="modal-empty-icon">📋</div>
              <p className="modal-empty-text">No batches found</p>
              <p className="modal-empty-hint">There are no batches for this run</p>
            </div>
          ) : (
            <div className="modal-results-list">
              {mockBatches.map((batch) => (
                <button
                  key={batch.batchNo}
                  type="button"
                  className="modal-batch-item"
                  onClick={() => handleSelect(batch)}
                >
                  <div>
                    <div className="modal-batch-label">Batch {batch.batchNo}</div>
                    <div style={{ marginTop: '4px', fontSize: '0.875rem', color: '#5B4A3F' }}>
                      {batch.itemCount} items • {batch.pickedCount}/{batch.itemCount} picked • {batch.status}
                    </div>
                  </div>
                  <div className="modal-batch-arrow">→</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {mockBatches.length > 0 && (
          <div className="modal-footer">
            <div className="modal-footer-left">
              <p className="modal-footer-info">
                Showing {mockBatches.length} batch{mockBatches.length !== 1 ? 'es' : ''}
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
