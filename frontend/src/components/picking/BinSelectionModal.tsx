import { useState } from 'react'

interface Bin {
  binNo: string
  location: string
  user1?: string
  user4?: string
}

interface BinSelectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (bin: Bin) => void
  lotNo?: string
}

export function BinSelectionModal({ open, onOpenChange, onSelect, lotNo }: BinSelectionModalProps) {
  const [searchTerm, setSearchTerm] = useState('')

  // Mock data - will be replaced with API call in Phase 3.4
  // Filter: Only TFC1 PARTIAL bins (Location='TFC1', User1='WHTFC1', User4='PARTIAL')
  const mockBins: Bin[] = [
    { binNo: 'TFC1-PARTIAL-001', location: 'TFC1', user1: 'WHTFC1', user4: 'PARTIAL' },
    { binNo: 'TFC1-PARTIAL-002', location: 'TFC1', user1: 'WHTFC1', user4: 'PARTIAL' },
    { binNo: 'TFC1-PARTIAL-003', location: 'TFC1', user1: 'WHTFC1', user4: 'PARTIAL' },
    { binNo: 'TFC1-PARTIAL-004', location: 'TFC1', user1: 'WHTFC1', user4: 'PARTIAL' },
    { binNo: 'TFC1-PARTIAL-005', location: 'TFC1', user1: 'WHTFC1', user4: 'PARTIAL' },
  ]

  const filteredBins = mockBins.filter(bin =>
    bin.binNo.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSelect = (bin: Bin) => {
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
          {filteredBins.length === 0 ? (
            <div className="modal-empty-state">
              <div className="modal-empty-icon">📦</div>
              <p className="modal-empty-text">
                {searchTerm ? 'No bins found' : 'Start typing to search bins'}
              </p>
              <p className="modal-empty-hint">
                {searchTerm ? 'Try a different search term' : 'Enter bin number to search'}
              </p>
            </div>
          ) : (
            <div className="modal-results-list">
              {filteredBins.map((bin) => (
                <button
                  key={bin.binNo}
                  type="button"
                  className="modal-batch-item"
                  onClick={() => handleSelect(bin)}
                >
                  <div>
                    <div className="modal-batch-label">{bin.binNo}</div>
                    <div style={{ marginTop: '4px', fontSize: '0.875rem', color: '#5B4A3F' }}>
                      Location: {bin.location} • {bin.user1} • {bin.user4}
                    </div>
                  </div>
                  <div className="modal-batch-arrow">→</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {filteredBins.length > 0 && (
          <div className="modal-footer">
            <div className="modal-footer-left">
              <p className="modal-footer-info">
                Showing {filteredBins.length} of {mockBins.length} bins
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
