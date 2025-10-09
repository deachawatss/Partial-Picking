import { useState } from 'react'

interface Run {
  runNo: number
  fgItemKey: string
  fgDescription: string
  productionDate: string
  status: string
}

interface RunSelectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (run: Run) => void
}

export function RunSelectionModal({ open, onOpenChange, onSelect }: RunSelectionModalProps) {
  const [searchTerm, setSearchTerm] = useState('')

  // Mock data - will be replaced with API call in Phase 3.4 (T065)
  const mockRuns: Run[] = [
    {
      runNo: 100001,
      fgItemKey: 'FG-001',
      fgDescription: 'Finished Good Item 1',
      productionDate: '2025-10-01',
      status: 'NEW',
    },
    {
      runNo: 100002,
      fgItemKey: 'FG-002',
      fgDescription: 'Finished Good Item 2',
      productionDate: '2025-10-02',
      status: 'PRINT',
    },
    {
      runNo: 100003,
      fgItemKey: 'FG-003',
      fgDescription: 'Finished Good Item 3',
      productionDate: '2025-10-03',
      status: 'NEW',
    },
  ]

  // Filter runs by search term
  const filteredRuns = mockRuns.filter(
    run =>
      run.runNo.toString().includes(searchTerm) ||
      run.fgItemKey.toLowerCase().includes(searchTerm.toLowerCase()) ||
      run.fgDescription.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSelect = (run: Run) => {
    onSelect(run)
    onOpenChange(false)
    setSearchTerm('')
  }

  const handleClose = () => {
    onOpenChange(false)
    setSearchTerm('')
  }

  const getStatusClass = (status: string) => {
    if (status === 'NEW') return 'modal-status-new'
    if (status === 'PRINT') return 'modal-status-in-progress'
    return 'modal-status-default'
  }

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header - Brown Gradient */}
        <div className="modal-header-brown">
          <h3 className="modal-title">
            <span>🔍</span>
            <span>Select Production Run</span>
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

        {/* Search Section */}
        <div className="modal-search">
          <div className="modal-search-input-wrapper">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Run No, Item Key, or Description..."
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
          {/* Empty State */}
          {filteredRuns.length === 0 ? (
            <div className="modal-empty-state">
              <div className="modal-empty-icon">📋</div>
              <p className="modal-empty-text">
                {searchTerm ? 'No runs found' : 'Start typing to search runs'}
              </p>
              <p className="modal-empty-hint">
                {searchTerm
                  ? 'Try a different search term'
                  : 'Enter run number, item key, or description'}
              </p>
            </div>
          ) : (
            /* Results Table */
            <div className="modal-table-container">
              <table className="modal-table">
                <thead>
                  <tr>
                    <th>Run No</th>
                    <th>FG Item Key</th>
                    <th>FG Description</th>
                    <th className="text-center">Status</th>
                    <th>Production Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRuns.map((run) => (
                    <tr key={run.runNo} onClick={() => handleSelect(run)}>
                      <td>
                        <strong>{run.runNo}</strong>
                      </td>
                      <td>{run.fgItemKey}</td>
                      <td title={run.fgDescription}>{run.fgDescription}</td>
                      <td className="text-center">
                        <span className={`modal-status-badge ${getStatusClass(run.status)}`}>
                          {run.status}
                        </span>
                      </td>
                      <td>{run.productionDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {filteredRuns.length > 0 && (
          <div className="modal-footer">
            <div className="modal-footer-left">
              <p className="modal-footer-info">
                Showing {filteredRuns.length} of {mockRuns.length} results
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
