import { useState } from 'react'
import { useRunDetails } from '@/hooks/useRunsQuery'
import type { RunDetailsResponse } from '@/types/api'

interface RunSelectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (run: RunDetailsResponse) => void
}

export function RunSelectionModal({ open, onOpenChange, onSelect }: RunSelectionModalProps) {
  const [runNoInput, setRunNoInput] = useState('')
  const [searchedRunNo, setSearchedRunNo] = useState<number | null>(null)

  const { data: runDetails, isLoading, error } = useRunDetails(searchedRunNo)

  const handleSearch = () => {
    const runNo = parseInt(runNoInput, 10)
    if (!isNaN(runNo) && runNo > 0) {
      setSearchedRunNo(runNo)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handleSelect = () => {
    if (runDetails) {
      onSelect(runDetails)
      onOpenChange(false)
      setRunNoInput('')
      setSearchedRunNo(null)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    setRunNoInput('')
    setSearchedRunNo(null)
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
              type="number"
              value={runNoInput}
              onChange={(e) => setRunNoInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter Run Number (e.g., 6000037)..."
              className="modal-search-input"
              autoFocus
            />
            <button
              onClick={handleSearch}
              disabled={isLoading}
              className="modal-search-btn"
              aria-label="Search run"
            >
              {isLoading ? '⏳' : '🔍'}
            </button>
          </div>
        </div>

        {/* Results Section */}
        <div className="modal-content">
          {/* Error State */}
          {error && (
            <div className="modal-empty-state">
              <div className="modal-empty-icon">⚠️</div>
              <p className="modal-empty-text">Run not found</p>
              <p className="modal-empty-hint">
                Run number {searchedRunNo} does not exist. Please check and try again.
              </p>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="modal-empty-state">
              <div className="modal-empty-icon">⏳</div>
              <p className="modal-empty-text">Loading run details...</p>
            </div>
          )}

          {/* Empty State */}
          {!runDetails && !isLoading && !error && (
            <div className="modal-empty-state">
              <div className="modal-empty-icon">📋</div>
              <p className="modal-empty-text">Enter a run number to search</p>
              <p className="modal-empty-hint">
                Type the production run number and press Enter or click Search
              </p>
            </div>
          )}

          {/* Run Details */}
          {runDetails && !isLoading && !error && (
            <div className="modal-table-container">
              <table className="modal-table">
                <thead>
                  <tr>
                    <th>Run No</th>
                    <th>FG Item Key</th>
                    <th>FG Description</th>
                    <th className="text-center">Status</th>
                    <th>Production Date</th>
                    <th className="text-center">Batches</th>
                  </tr>
                </thead>
                <tbody>
                  <tr onClick={handleSelect} className="cursor-pointer hover:bg-gray-50">
                    <td>
                      <strong>{runDetails.runNo}</strong>
                    </td>
                    <td>{runDetails.fgItemKey}</td>
                    <td title={runDetails.fgDescription}>{runDetails.fgDescription}</td>
                    <td className="text-center">
                      <span className={`modal-status-badge ${getStatusClass(runDetails.status)}`}>
                        {runDetails.status}
                      </span>
                    </td>
                    <td>{runDetails.productionDate}</td>
                    <td className="text-center">{runDetails.noOfBatches}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {runDetails && (
          <div className="modal-footer">
            <div className="modal-footer-left">
              <p className="modal-footer-info">Click the row to select this run</p>
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
