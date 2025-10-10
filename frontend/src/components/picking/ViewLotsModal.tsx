import { useState } from 'react'
import { usePickedLots } from '@/hooks/usePickedLotsQuery'
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
        <div className="tw-border-b tw-border-gray-200 tw-px-4 tw-pt-2">
          <nav className="tw-flex tw-space-x-1" role="tablist">
            <button
              onClick={() => setActiveTab('picked')}
              className={`tw-px-4 tw-py-2 tw-text-sm tw-font-medium tw-border-b-2 tw-transition-colors tw-cursor-pointer ${
                activeTab === 'picked'
                  ? 'tw-bg-amber-100 tw-text-amber-700 tw-border-amber-500'
                  : 'tw-text-gray-500 hover:tw-text-gray-700 hover:tw-bg-gray-50 tw-border-transparent'
              }`}
              type="button"
            >
              Picked Lot Details
              {data?.pickedLots?.length ? (
                <span className="tw-ml-2 tw-bg-amber-500 tw-text-white tw-text-xs tw-px-2 tw-py-0.5 tw-rounded-full">
                  {data.pickedLots.length}
                </span>
              ) : null}
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`tw-px-4 tw-py-2 tw-text-sm tw-font-medium tw-border-b-2 tw-transition-colors tw-cursor-pointer ${
                activeTab === 'pending'
                  ? 'tw-bg-amber-100 tw-text-amber-700 tw-border-amber-500'
                  : 'tw-text-gray-500 hover:tw-text-gray-700 hover:tw-bg-gray-50 tw-border-transparent'
              }`}
              type="button"
            >
              Pending To Picked
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
                            <th className="tw-px-3 tw-py-2">Batch No</th>
                            <th className="tw-px-3 tw-py-2">Lot No.</th>
                            <th className="tw-px-3 tw-py-2">ItemKey</th>
                            <th className="tw-px-3 tw-py-2">Location Key</th>
                            <th className="tw-px-3 tw-py-2">Expiry Date</th>
                            <th className="tw-px-3 tw-py-2 tw-text-right">Qty Received</th>
                            <th className="tw-px-3 tw-py-2">BinNo</th>
                            <th className="tw-px-3 tw-py-2 tw-text-right">Pack Size</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.pickedLots.map((lot) => (
                            <tr
                              key={lot.lotTranNo}
                              onClick={() => handleRowClick(lot.lotTranNo)}
                              className={`hover:tw-bg-gray-50 tw-cursor-pointer ${
                                selectedLots.has(lot.lotTranNo) ? 'tw-bg-blue-50' : ''
                              }`}
                            >
                              <td className="tw-px-3 tw-py-2 tw-whitespace-nowrap tw-text-sm tw-text-gray-900">
                                {lot.batchNo}
                              </td>
                              <td className="tw-px-3 tw-py-2 tw-whitespace-nowrap tw-text-sm">
                                <strong>{lot.lotNo}</strong>
                              </td>
                              <td className="tw-px-3 tw-py-2 tw-whitespace-nowrap tw-text-sm tw-text-gray-900">
                                {lot.itemKey}
                              </td>
                              <td className="tw-px-3 tw-py-2 tw-whitespace-nowrap tw-text-sm tw-text-gray-900">
                                {lot.locationKey}
                              </td>
                              <td className="tw-px-3 tw-py-2 tw-whitespace-nowrap tw-text-sm tw-text-gray-900">
                                {lot.dateExp || 'N/A'}
                              </td>
                              <td className="tw-px-3 tw-py-2 tw-whitespace-nowrap tw-text-sm tw-text-gray-900 tw-text-right tw-font-bold tw-text-green-700">
                                {lot.qtyReceived.toFixed(3)} KG
                              </td>
                              <td className="tw-px-3 tw-py-2 tw-whitespace-nowrap tw-text-sm tw-text-gray-900">
                                {lot.binNo}
                              </td>
                              <td className="tw-px-3 tw-py-2 tw-whitespace-nowrap tw-text-sm tw-text-gray-900 tw-text-right">
                                {lot.packSize.toFixed(2)}
                              </td>
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
                <div className="modal-empty-state">
                  <div className="modal-empty-icon">🚧</div>
                  <p className="modal-empty-text">Pending Tab</p>
                  <p className="modal-empty-hint">This feature is under development.</p>
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
