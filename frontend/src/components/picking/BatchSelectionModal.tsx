import { useBatches } from '@/hooks/useBatchesQuery'

interface BatchSelectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (batchNo: number) => void
  runNo: number | null
}

export function BatchSelectionModal({
  open,
  onOpenChange,
  onSelect,
  runNo,
}: BatchSelectionModalProps) {
  const { data: runDetails, isLoading, error } = useBatches(runNo, { enabled: open && !!runNo })

  const batches = runDetails?.batches ?? []

  const handleSelect = (batchNo: number) => {
    onSelect(batchNo)
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
          {/* Error State */}
          {error && (
            <div className="modal-empty-state">
              <div className="modal-empty-icon">⚠️</div>
              <p className="modal-empty-text">Error loading batches</p>
              <p className="modal-empty-hint">
                Could not load batches for run {runNo}. Please try again.
              </p>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="modal-empty-state">
              <div className="modal-empty-icon">⏳</div>
              <p className="modal-empty-text">Loading batches...</p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && batches.length === 0 && (
            <div className="modal-empty-state">
              <div className="modal-empty-icon">📋</div>
              <p className="modal-empty-text">No batches found</p>
              <p className="modal-empty-hint">
                {runNo ? `Run ${runNo} has no batches` : 'Please select a run first'}
              </p>
            </div>
          )}

          {/* Batch List */}
          {!isLoading && !error && batches.length > 0 && (
            <div className="modal-results-list">
              {batches.map((batchNo) => (
                <button
                  key={batchNo}
                  type="button"
                  className="modal-batch-item"
                  onClick={() => handleSelect(batchNo)}
                >
                  <div>
                    <div className="modal-batch-label">Batch {batchNo}</div>
                    {runDetails && (
                      <div style={{ marginTop: '4px', fontSize: '0.875rem', color: '#5B4A3F' }}>
                        Run {runDetails.runNo} • {runDetails.fgItemKey} • {runDetails.status}
                      </div>
                    )}
                  </div>
                  <div className="modal-batch-arrow">→</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {!isLoading && !error && batches.length > 0 && (
          <div className="modal-footer">
            <div className="modal-footer-left">
              <p className="modal-footer-info">
                Showing {batches.length} batch{batches.length !== 1 ? 'es' : ''}
                {runDetails && ` of ${runDetails.noOfBatches} total`}
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
