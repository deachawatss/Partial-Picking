import { useState } from 'react'
import { usePickedLots, usePendingItems } from '@/hooks/usePickedLotsQuery'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { printLabels, type LabelData } from '@/utils/printLabel'
import { revertRunStatus } from '@/services/api/runs'

interface ViewLotsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  runNo: number | null
  runStatus?: string | null  // Current run status (NEW|PRINT)
  onDelete?: (lotTranNo: number, rowNum: number, lineId: number) => void
  onDeleteAll?: () => void
  onRefreshRun?: () => Promise<void>  // Callback to refetch run details after status change
}

export function ViewLotsModal({
  open,
  onOpenChange,
  runNo,
  runStatus,
  onDelete,
  onDeleteAll,
  onRefreshRun,
}: ViewLotsModalProps) {
  const [activeTab, setActiveTab] = useState<'picked' | 'pending'>('picked')
  const [selectedLots, setSelectedLots] = useState<Set<number>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const [isReverting, setIsReverting] = useState(false)
  const queryClient = useQueryClient()
  const { user } = useAuth()

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

  const handleRowClick = (lotTranNo: number, event: React.MouseEvent) => {
    setSelectedLots((prev) => {
      const newSet = new Set(prev)

      // Shift+Click: Toggle selection (multi-select mode)
      if (event.shiftKey) {
        if (newSet.has(lotTranNo)) {
          newSet.delete(lotTranNo)
        } else {
          newSet.add(lotTranNo)
        }
      } else {
        // Normal Click: Select ONLY this row (deselect all others)
        newSet.clear()
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
        await onDelete(lot.lotTranNo, lot.rowNum, lot.lineId)
      }

      // Invalidate queries to refresh data immediately
      await queryClient.invalidateQueries({ queryKey: ['picks', 'run', runNo, 'lots'] })
      await queryClient.invalidateQueries({ queryKey: ['run-details', runNo] })
      await queryClient.invalidateQueries({ queryKey: ['picks', 'run', runNo, 'pending'] })
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

  const handleDeleteAll = async () => {
    if (onDeleteAll) {
      await onDeleteAll()

      // Invalidate queries to refresh data immediately
      await queryClient.invalidateQueries({ queryKey: ['picks', 'run', runNo, 'lots'] })
      await queryClient.invalidateQueries({ queryKey: ['run-details', runNo] })
      await queryClient.invalidateQueries({ queryKey: ['picks', 'run', runNo, 'pending'] })
      await refetch()

      setSelectedLots(new Set())
    }
  }

  const handleRePrint = () => {
    if (!data || selectedLots.size === 0) return

    // Filter picked lots to only selected ones
    const selectedPickedLots = data.pickedLots.filter((lot) => selectedLots.has(lot.lotTranNo))

    // Map to LabelData format for printing
    const now = new Date()
    const labelData: LabelData[] = selectedPickedLots.map((lot) => ({
      itemKey: lot.itemKey,
      qtyReceived: lot.qtyReceived,
      batchNo: lot.batchNo,
      lotNo: lot.lotNo,
      picker: user?.username || 'UNKNOWN', // Use current logged-in user
      date: now.toLocaleDateString('en-GB'), // DD/MM/YYYY
      time: now.toLocaleTimeString('en-US'), // HH:MM:SSAM/PM
    }))

    // Print individual labels for selected lots
    printLabels(labelData)
  }

  const handleRevertStatus = async () => {
    if (!runNo) return

    const confirmed = window.confirm(
      `Are you sure you want to revert Run ${runNo} status from PRINT back to NEW?\n\n` +
      `This will allow you to delete lots and make changes.\n\n` +
      `Click OK to proceed, or Cancel to abort.`
    )

    if (!confirmed) return

    setIsReverting(true)
    try {
      await revertRunStatus(runNo)

      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ['run-details', runNo] })
      await queryClient.invalidateQueries({ queryKey: ['picks', 'run', runNo, 'lots'] })

      // Refetch run details in PickingContext to update currentRun state
      if (onRefreshRun) {
        await onRefreshRun()
      }

      alert(`✅ Run ${runNo} status successfully reverted from PRINT to NEW!\n\nYou can now delete lots if needed.`)

      // Close modal after successful revert
      handleClose()
    } catch (error) {
      console.error('[ViewLotsModal] Revert status failed:', error)
      alert('Failed to revert run status. Please try again.')
    } finally {
      setIsReverting(false)
    }
  }

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header - Brown Gradient with integrated tabs */}
        <div className="modal-header-brown modal-header-with-tabs">
          {/* Title Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
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

          {/* Tab Navigation - Integrated in header */}
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
                            <th style={{ textAlign: 'right' }}>Qty Picked</th>
                            <th>Bin No</th>
                            <th style={{ textAlign: 'right' }}>Pack Size</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.pickedLots.map((lot) => (
                            <tr
                              key={lot.lotTranNo}
                              onClick={(e) => handleRowClick(lot.lotTranNo, e)}
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
          {/* LEFT: Revert To NEW + Delete All Lots Buttons */}
          <div className="modal-footer-left">
            {runStatus === 'PRINT' && !isReverting && (
              <button
                type="button"
                onClick={handleRevertStatus}
                className="modal-btn-warning"
                title="Revert run status from PRINT back to NEW to enable deletion"
              >
                ⚠️ Revert To NEW
              </button>
            )}
            {isReverting && (
              <button
                type="button"
                disabled
                className="modal-btn-warning"
              >
                ⏳ Reverting...
              </button>
            )}
            {data && data.pickedLots.length > 0 && runStatus !== 'PRINT' && (
              <button
                type="button"
                onClick={handleDeleteAll}
                className="modal-btn-danger"
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
              disabled={selectedLots.size === 0}
              className="modal-btn-secondary"
            >
              🖨️ Re-Print
            </button>
          </div>

          {/* RIGHT: Delete (selected) + Ok Buttons */}
          <div className="modal-footer-right">
            <button
              type="button"
              onClick={handleDelete}
              disabled={selectedLots.size === 0 || isDeleting || runStatus === 'PRINT'}
              className="modal-btn-danger"
              title={runStatus === 'PRINT' ? 'Cannot delete when status is PRINT. Revert to NEW first.' : undefined}
            >
              {isDeleting ? '⏳ Deleting...' : '🗑️ Delete'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="modal-btn-primary"
            >
              Ok
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
