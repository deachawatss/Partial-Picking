import { useState } from 'react'
import { useBins } from '@/hooks/useBinsQuery'
import type { BinDTO } from '@/types/api'

interface BinSelectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (bin: BinDTO) => void
  lotNo?: string
}

export function BinSelectionModal({ open, onOpenChange, onSelect, lotNo }: BinSelectionModalProps) {
  const [searchTerm, setSearchTerm] = useState('')

  // Fetch all TFC1 PARTIAL bins with client-side search
  const { data: bins, isLoading, error } = useBins(searchTerm, { enabled: open })

  const handleSelect = (bin: BinDTO) => {
    onSelect(bin)
    onOpenChange(false)
    setSearchTerm('')
  }

  const handleClose = () => {
    onOpenChange(false)
    setSearchTerm('')
  }

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header - Brown Gradient */}
        <div className="modal-header-brown">
          <h3 className="modal-title">
            <span>📍</span>
            <span>Select Bin</span>
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

        {/* Lot Context Bar */}
        {lotNo && (
          <div className="modal-item-context">
            <span className="modal-context-label">Lot:</span>
            <span className="modal-context-value">{lotNo}</span>
            <span className="modal-context-label">• TFC1 PARTIAL Bins Only</span>
          </div>
        )}

        {/* Search Section */}
        <div className="modal-search">
          <div className="modal-search-input-wrapper">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search bin number..."
              className="modal-search-input"
              autoFocus
            />
            <div className="modal-search-icon">
              <span>🔍</span>
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="modal-content">
          {/* Error State */}
          {error && (
            <div className="modal-empty-state">
              <div className="modal-empty-icon">⚠️</div>
              <p className="modal-empty-text">Error loading bins</p>
              <p className="modal-empty-hint">
                Could not load TFC1 PARTIAL bins. Please try again.
              </p>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="modal-empty-state">
              <div className="modal-empty-icon">⏳</div>
              <p className="modal-empty-text">Loading bins...</p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && bins && bins.length === 0 && (
            <div className="modal-empty-state">
              <div className="modal-empty-icon">📦</div>
              <p className="modal-empty-text">
                {searchTerm ? 'No bins found' : 'No bins available'}
              </p>
              <p className="modal-empty-hint">
                {searchTerm ? 'Try a different search term' : 'No TFC1 PARTIAL bins found'}
              </p>
            </div>
          )}

          {/* Bins List */}
          {!isLoading && !error && bins && bins.length > 0 && (
            <div className="modal-results-list">
              {bins.map((bin) => (
                <button
                  key={bin.binNo}
                  type="button"
                  className="modal-batch-item"
                  onClick={() => handleSelect(bin)}
                >
                  <div>
                    <div className="modal-batch-label">{bin.binNo}</div>
                    <div style={{ marginTop: '4px', fontSize: '0.875rem', color: '#5B4A3F' }}>
                      {bin.description && <span>{bin.description} • </span>}
                      {bin.aisle && bin.row && bin.rack && (
                        <span>Aisle {bin.aisle} • Row {bin.row} • Rack {bin.rack}</span>
                      )}
                      {(!bin.aisle || !bin.row || !bin.rack) && (
                        <span>Location: {bin.location} • {bin.user1} • {bin.user4}</span>
                      )}
                    </div>
                  </div>
                  <div className="modal-batch-arrow">→</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {!isLoading && !error && bins && bins.length > 0 && (
          <div className="modal-footer">
            <div className="modal-footer-left">
              <p className="modal-footer-info">
                Showing {bins.length} bin{bins.length !== 1 ? 's' : ''}
                {searchTerm && ' (filtered)'}
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
