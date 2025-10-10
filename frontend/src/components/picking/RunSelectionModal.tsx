import { useState, useEffect, useMemo, useDeferredValue } from 'react'
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

  // Search state with React 19 useDeferredValue for non-blocking updates
  const [searchInput, setSearchInput] = useState('')
  // Deferred value allows input to update immediately while filtering is lower priority
  const deferredSearch = useDeferredValue(searchInput)

  // Reset to page 0 when search changes
  useEffect(() => {
    if (searchInput !== deferredSearch && searchInput.trim() !== deferredSearch.trim()) {
      setCurrentPage(0)
    }
  }, [searchInput, deferredSearch])

  // Use deferred search for filtering (non-blocking, lower priority)
  const searchParam = deferredSearch.trim() !== '' ? deferredSearch : undefined

  // Paginated list query with optional search
  const { data: runsList, isLoading, error } = useRunsList(
    limit,
    currentPage * limit,
    searchParam,
    { enabled: open }
  )

  // Fetch run details when a run is selected from list
  const [selectedRunNo, setSelectedRunNo] = useState<number | null>(null)
  const { data: runDetails, isLoading: isLoadingDetails } = useRunDetails(selectedRunNo)

  const handleSelectRun = async (run: RunListItemDTO) => {
    // Fetch full run details from browsing list
    setSelectedRunNo(run.runNo)
  }

  // When run details are loaded, call onSelect (useEffect to avoid setState during render)
  useEffect(() => {
    if (runDetails && selectedRunNo) {
      onSelect(runDetails)
      onOpenChange(false)
      setSelectedRunNo(null)
      setSearchInput('')
      setCurrentPage(0)
    }
  }, [runDetails, selectedRunNo, onSelect, onOpenChange])

  const handleClose = () => {
    onOpenChange(false)
    setSelectedRunNo(null)
    setSearchInput('')
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
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by Run No, Formula ID, or Description (e.g., 600)..."
              className="modal-search-input"
              autoFocus
            />
            {searchInput && searchInput !== deferredSearch && (
              <span className="modal-search-btn" style={{ pointerEvents: 'none' }}>
                ⏳
              </span>
            )}
            {searchInput && searchInput === deferredSearch && (
              <button
                onClick={() => setSearchInput('')}
                className="modal-search-btn"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Results Section */}
        <div className="modal-content">
          {/* List Error State */}
          {error && (
            <div className="modal-empty-state">
              <div className="modal-empty-icon">⚠️</div>
              <p className="modal-empty-text">Failed to load runs</p>
              <p className="modal-empty-hint">
                Unable to retrieve production runs. Please check your connection and try again.
              </p>
            </div>
          )}

          {/* List Loading State */}
          {isLoading && (
            <div className="modal-empty-state">
              <div className="modal-empty-icon">⏳</div>
              <p className="modal-empty-text">Loading production runs...</p>
            </div>
          )}

          {/* Runs Table - Show paginated list */}
          {runsList && !isLoading && !error && (
            <div className="modal-table-container">
              {searchParam && (
                <div style={{
                  padding: '8px 12px',
                  background: '#f0f9ff',
                  border: '1px solid #0ea5e9',
                  borderRadius: '6px',
                  marginBottom: '12px',
                  fontSize: '13px',
                  color: '#0369a1'
                }}>
                  🔍 Filtering by: <strong>{deferredSearch}</strong> ({runsList.pagination.total} results)
                </div>
              )}
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
                        <p className="modal-empty-text">
                          {searchParam
                            ? `No runs found matching "${deferredSearch}"`
                            : 'No production runs found'}
                        </p>
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

        {/* Modal Footer with Pagination */}
        {runsList && (
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
      </div>
    </div>
  )
}
