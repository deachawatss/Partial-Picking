import { useState } from 'react'
import { useRunsList, useRunDetails } from '@/hooks/useRunsQuery'
import type { RunDetailsResponse, RunListItemDTO } from '@/types/api'

interface RunSelectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (run: RunDetailsResponse) => void
}

export function RunSelectionModal({ open, onOpenChange, onSelect }: RunSelectionModalProps) {
  const [currentPage, setCurrentPage] = useState(0)
  const limit = 10

  // Search box state
  const [runNoInput, setRunNoInput] = useState('')
  const [searchedRunNo, setSearchedRunNo] = useState<number | null>(null)

  // Paginated list query
  const { data: runsList, isLoading, error } = useRunsList(limit, currentPage * limit, { enabled: open })

  // Fetch run details when a run is selected (either from search or from list)
  const [selectedRunNo, setSelectedRunNo] = useState<number | null>(null)
  const { data: runDetails, isLoading: isLoadingDetails, error: searchError } = useRunDetails(selectedRunNo || searchedRunNo)

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

  const handleSelectRun = async (run: RunListItemDTO) => {
    // Fetch full run details from browsing list
    setSelectedRunNo(run.runNo)
  }

  // When run details are loaded, call onSelect
  if (runDetails && (selectedRunNo || searchedRunNo)) {
    onSelect(runDetails)
    onOpenChange(false)
    setSelectedRunNo(null)
    setSearchedRunNo(null)
    setRunNoInput('')
    setCurrentPage(0)
  }

  const handleClose = () => {
    onOpenChange(false)
    setSelectedRunNo(null)
    setSearchedRunNo(null)
    setRunNoInput('')
    setCurrentPage(0)
  }

  const handlePreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (runsList?.pagination.hasMore) {
      setCurrentPage(currentPage + 1)
    }
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
              disabled={isLoadingDetails}
              className="modal-search-btn"
              aria-label="Search run"
            >
              {isLoadingDetails ? '⏳' : '🔍'}
            </button>
          </div>
        </div>

        {/* Results Section */}
        <div className="modal-content">
          {/* Search Error State */}
          {searchError && searchedRunNo && (
            <div className="modal-empty-state">
              <div className="modal-empty-icon">⚠️</div>
              <p className="modal-empty-text">Run not found</p>
              <p className="modal-empty-hint">
                Run number {searchedRunNo} does not exist. Please check and try again.
              </p>
            </div>
          )}

          {/* Search Loading State */}
          {isLoadingDetails && searchedRunNo && (
            <div className="modal-empty-state">
              <div className="modal-empty-icon">⏳</div>
              <p className="modal-empty-text">Loading run details...</p>
            </div>
          )}

          {/* List Error State */}
          {error && !searchedRunNo && (
            <div className="modal-empty-state">
              <div className="modal-empty-icon">⚠️</div>
              <p className="modal-empty-text">Failed to load runs</p>
              <p className="modal-empty-hint">
                Unable to retrieve production runs. Please check your connection and try again.
              </p>
            </div>
          )}

          {/* List Loading State */}
          {isLoading && !searchedRunNo && (
            <div className="modal-empty-state">
              <div className="modal-empty-icon">⏳</div>
              <p className="modal-empty-text">Loading production runs...</p>
            </div>
          )}

          {/* Search Result - Show single run when searched */}
          {runDetails && searchedRunNo && !searchError && !isLoadingDetails && (
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
                  <tr
                    onClick={() => {
                      onSelect(runDetails)
                      onOpenChange(false)
                      setSearchedRunNo(null)
                      setRunNoInput('')
                    }}
                    className="cursor-pointer hover:bg-gray-50"
                  >
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

          {/* Runs Table - Show paginated list when NOT searching */}
          {runsList && !isLoading && !error && !searchedRunNo && (
            <div className="modal-table-container">
              <table className="modal-table">
                <thead>
                  <tr>
                    <th>Run No</th>
                    <th>Formula ID</th>
                    <th>Formula Desc</th>
                    <th className="text-center">Status</th>
                    <th className="text-center">Batch Count</th>
                  </tr>
                </thead>
                <tbody>
                  {runsList.runs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8">
                        <div className="modal-empty-icon">📋</div>
                        <p className="modal-empty-text">No production runs found</p>
                      </td>
                    </tr>
                  ) : (
                    runsList.runs.map((run) => (
                      <tr
                        key={run.runNo}
                        onClick={() => handleSelectRun(run)}
                        className="cursor-pointer hover:bg-gray-50"
                      >
                        <td>
                          <strong>{run.runNo}</strong>
                        </td>
                        <td>{run.formulaId}</td>
                        <td title={run.formulaDesc}>{run.formulaDesc}</td>
                        <td className="text-center">
                          <span className={`modal-status-badge ${getStatusClass(run.status)}`}>
                            {run.status}
                          </span>
                        </td>
                        <td className="text-center">{run.batchCount}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer with Pagination - Only show when browsing list */}
        {runsList && !searchedRunNo && (
          <div className="modal-footer">
            <div className="modal-footer-left">
              <p className="modal-footer-info">
                Showing {currentPage * limit + 1} - {Math.min((currentPage + 1) * limit, runsList.pagination.total)} of {runsList.pagination.total} runs
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePreviousPage}
                disabled={currentPage === 0}
                className="modal-pagination-button"
              >
                ← Previous
              </button>
              <button
                type="button"
                onClick={handleNextPage}
                disabled={!runsList.pagination.hasMore}
                className="modal-pagination-button"
              >
                Next →
              </button>
              <button type="button" onClick={handleClose} className="modal-cancel-btn">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Modal Footer - Simple Cancel when searching */}
        {searchedRunNo && runDetails && (
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
