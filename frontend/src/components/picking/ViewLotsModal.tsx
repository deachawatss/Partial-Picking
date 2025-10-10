import { useState } from 'react'
import { usePickedLots, usePendingItems } from '@/hooks/usePickedLotsQuery'
import { useQueryClient } from '@tanstack/react-query'
import type { PickedLotDTO } from '@/types/api'

interface ViewLotsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  runNo: number | null
  onDelete?: (lotTranNo: number, rowNum: number, lineId: number) => void
  onDeleteAll?: () => void
  onRePrint?: () => void
}

export function ViewLotsModal({
  open,
  onOpenChange,
  runNo,
  onDelete,
  onDeleteAll,
  onRePrint,
}: ViewLotsModalProps) {
  const [activeTab, setActiveTab] = useState<'picked' | 'pending'>('picked')
  const [selectedLots, setSelectedLots] = useState<Set<number>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading, error, refetch } = usePickedLots(runNo, {
    enabled: open && !!runNo,
  })

  const {
    data: pendingData,
    isLoading: pendingLoading,
    error: pendingError,
  } = usePendingItems(runNo, {
    enabled: open && !!runNo,
  })

  const handleClose = () => {
    setSelectedLots(new Set())
    setActiveTab('picked')
    onOpenChange(false)
  }

  const handleRowClick = (lotTranNo: number) => {
    setSelectedLots((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(lotTranNo)) {
        newSet.delete(lotTranNo)
      } else {
        newSet.add(lotTranNo)
      }
      return newSet
    })
  }

  const handleDelete = async () => {
    if (selectedLots.size === 0 || !data || !onDelete) return

    // Show confirmation dialog
    const confirmed = window.confirm(
      `Delete ${selectedLots.size} picked item(s)? This will restore inventory and remove the picked records.`
    )

    if (!confirmed) return

    setIsDeleting(true)
    try {
      // Get all selected lot details
      const lotsToDelete = data.pickedLots.filter((lot) => selectedLots.has(lot.lotTranNo))

      // Delete each lot sequentially
      for (const lot of lotsToDelete) {
        await new Promise<void>((resolve, reject) => {
          try {
            onDelete(lot.lotTranNo, lot.rowNum, lot.lineId)
            resolve()
          } catch (error) {
            reject(error)
          }
        })
      }

      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ['picked-lots', runNo] })
      await queryClient.invalidateQueries({ queryKey: ['run-details', runNo] })
      await refetch()

      // Clear selection
      setSelectedLots(new Set())
    } catch (error) {
      console.error('Error deleting lots:', error)
      alert('Failed to delete some items. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteAll = () => {
    if (onDeleteAll) {
      onDeleteAll()
      setSelectedLots(new Set())
    }
  }

  const handleRePrint = () => {
    if (onRePrint) {
      onRePrint()
    }
  }

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header - Brown Gradient */}
        <div className="modal-header-brown">
          <h3 className="modal-title">
            <span>👁️</span>
            <span>View Picked Lots - Run #{runNo}</span>
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

        {/* Tab Navigation */}
        <div className="modal-tabs-container">
          <nav className="modal-tabs-nav" role="tablist">
            <button
              onClick={() => setActiveTab('picked')}
              className={`modal-tab-button ${activeTab === 'picked' ? 'modal-tab-active' : ''}`}
              type="button"
            >
              Picked Lot Details
              {data?.pickedLots?.length ? (
                <span className="modal-tab-badge">{data.pickedLots.length}</span>
              ) : null}
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`modal-tab-button ${activeTab === 'pending' ? 'modal-tab-active' : ''}`}
              type="button"
            >
              Pending To Picked
              {pendingData?.pendingItems?.length ? (
                <span className="modal-tab-badge">{pendingData.pendingItems.length}</span>
              ) : null}
            </button>
          </nav>
        </div>

        {/* Scrollable Content Area */}
        <div className="modal-content">
          {/* Loading State */}
          {isLoading && (
            <div className="modal-empty-state">
              <div className="modal-empty-icon">⏳</div>
              <p className="modal-empty-text">Loading picked lots...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="modal-empty-state">
              <div className="modal-empty-icon">⚠️</div>
              <p className="modal-empty-text">Error loading picked lots</p>
              <p className="modal-empty-hint">Could not load data for run #{runNo}. Please try again.</p>
            </div>
          )}

          {/* Tab Content */}
          {!isLoading && !error && data && (
            <div className="tw-p-4">
              {/* Picked Lots Tab */}
              {activeTab === 'picked' && (
                <div>
                  {data.pickedLots.length === 0 ? (
                    <div className="modal-empty-state">
                      <div className="modal-empty-icon">📦</div>
                      <p className="modal-empty-text">No picked lots found</p>
                      <p className="modal-empty-hint">No lots have been picked for this run yet.</p>
                    </div>
                  ) : (
                    <div className="modal-table-container">
                      <table className="modal-table">
                        <thead>
                          <tr>
                            <th>Batch No</th>
                            <th>Lot No.</th>
                            <th>Item Key</th>
                            <th>Location Key</th>
                            <th>Expiry Date</th>
                            <th style={{ textAlign: 'right' }}>Qty Received</th>
                            <th>Bin No</th>
                            <th style={{ textAlign: 'right' }}>Pack Size</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.pickedLots.map((lot) => (
                            <tr
                              key={lot.lotTranNo}
                              onClick={() => handleRowClick(lot.lotTranNo)}
                              className={selectedLots.has(lot.lotTranNo) ? 'selected' : ''}
                            >
                              <td>{lot.batchNo}</td>
                              <td><strong>{lot.lotNo}</strong></td>
                              <td>{lot.itemKey}</td>
                              <td>{lot.locationKey}</td>
                              <td>{lot.dateExp || 'N/A'}</td>
                              <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#059669' }}>
                                {lot.qtyReceived.toFixed(3)} KG
                              </td>
                              <td>{lot.binNo}</td>
                              <td style={{ textAlign: 'right' }}>{lot.packSize.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Pending to Picked Tab */}
              {activeTab === 'pending' && (
                <div>
                  {/* Loading State */}
                  {pendingLoading && (
                    <div className="modal-empty-state">
                      <div className="modal-empty-icon">⏳</div>
                      <p className="modal-empty-text">Loading pending items...</p>
                    </div>
                  )}

                  {/* Error State */}
                  {pendingError && (
                    <div className="modal-empty-state">
                      <div className="modal-empty-icon">⚠️</div>
                      <p className="modal-empty-text">Error loading pending items</p>
                      <p className="modal-empty-hint">Could not load data for run #{runNo}. Please try again.</p>
                    </div>
                  )}

                  {/* Content */}
                  {!pendingLoading && !pendingError && pendingData && (
                    <>
                      {pendingData.pendingItems.length === 0 ? (
                        <div className="modal-empty-state">
                          <div className="modal-empty-icon">✅</div>
                          <p className="modal-empty-text">All items have been picked</p>
                          <p className="modal-empty-hint">No pending items remain for this run.</p>
                        </div>
                      ) : (
                        <div className="modal-table-container">
                          <table className="modal-table">
                            <thead>
                              <tr>
                                <th>Batch No</th>
                                <th>Item Key</th>
                                <th style={{ textAlign: 'right' }}>To Picked Qty</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pendingData.pendingItems.map((item, index) => (
                                <tr key={`${item.rowNum}-${item.lineId}-${index}`}>
                                  <td>{item.batchNo}</td>
                                  <td><strong>{item.itemKey}</strong></td>
                                  <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#dc2626' }}>
                                    {item.toPickedQty.toFixed(3)} KG
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer - 3 Section Layout */}
        <div className="modal-footer">
          {/* LEFT: Delete All Lots Button */}
          <div className="modal-footer-left">
            {data && data.pickedLots.length > 0 && (
              <button
                type="button"
                onClick={handleDeleteAll}
                className="tw-px-4 tw-py-2 tw-bg-red-600 hover:tw-bg-red-700 tw-text-white tw-font-semibold tw-rounded-lg tw-transition-colors tw-text-sm"
              >
                🗑️ Delete All Lots
              </button>
            )}
          </div>

          {/* CENTER: Re-Print Button */}
          <div className="modal-footer-center">
            <button
              type="button"
              onClick={handleRePrint}
              className="tw-px-4 tw-py-2 tw-bg-gray-200 hover:tw-bg-gray-300 tw-text-gray-700 tw-font-semibold tw-rounded-lg tw-transition-colors tw-text-sm"
            >
              🖨️ Re-Print
            </button>
          </div>

          {/* RIGHT: Delete (selected) + Ok Buttons */}
          <div className="modal-footer-right">
            <button
              type="button"
              onClick={handleDelete}
              disabled={selectedLots.size === 0 || isDeleting}
              className="tw-px-4 tw-py-2 tw-bg-red-600 hover:tw-bg-red-700 tw-text-white tw-font-semibold tw-rounded-lg tw-transition-colors disabled:tw-opacity-50 disabled:tw-cursor-not-allowed tw-text-sm"
            >
              {isDeleting ? '⏳ Deleting...' : '🗑️ Delete'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="tw-px-4 tw-py-2 tw-bg-gray-200 hover:tw-bg-gray-300 tw-text-gray-700 tw-font-semibold tw-rounded-lg tw-transition-colors tw-text-sm"
            >
              Ok
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
