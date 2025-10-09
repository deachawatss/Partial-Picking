import { useMemo } from 'react'
import { useAvailableLots } from '@/hooks/useLotsQuery'
import type { LotAvailabilityDTO } from '@/types/api'

interface Lot {
  lotNo: string
  dateExpiry: string
  qtyOnHand: number
  qtyCommitSales: number
  availableQty: number
  binNo: string
  packSize: number
  bagsAvailable: number
}

interface LotSelectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (lot: Lot) => void
  itemKey: string | null
  runNo: number | null
  rowNum: number | null
  targetQty?: number
}

export function LotSelectionModal({
  open,
  onOpenChange,
  onSelect,
  itemKey,
  runNo,
  rowNum,
  targetQty,
}: LotSelectionModalProps) {
  const { data: lotData, isLoading, error } = useAvailableLots(
    itemKey,
    runNo,
    rowNum,
    targetQty,
    {
      enabled: open && !!itemKey && !!runNo && !!rowNum
    }
  )

  // Map LotAvailabilityDTO to Lot (API returns FEFO sorted already)
  const lots = useMemo<Lot[]>(() => {
    if (!lotData) return []

    return lotData.map((lot) => ({
      lotNo: lot.lotNo,
      dateExpiry: lot.expiryDate,
      qtyOnHand: lot.qtyOnHand,
      qtyCommitSales: lot.qtyCommitSales,
      availableQty: lot.availableQty,
      binNo: lot.binNo,
      packSize: lot.packSize,
      bagsAvailable: lot.packSize > 0 ? lot.availableQty / lot.packSize : 0,
    }))
  }, [lotData])

  const handleSelect = (lot: Lot) => {
    onSelect(lot)
    onOpenChange(false)
  }

  const handleClose = () => {
    onOpenChange(false)
  }

  const isFefoLot = (index: number) => index === 0 // First lot is FEFO (earliest expiry)

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header - Brown Gradient */}
        <div className="modal-header-brown">
          <h3 className="modal-title">
            <span>🎯</span>
            <span>Select Lot (FEFO)</span>
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


        {/* Results Section */}
        <div className="modal-content">
          {/* Error State */}
          {error && (
            <div className="modal-empty-state">
              <div className="modal-empty-icon">⚠️</div>
              <p className="modal-empty-text">Error loading lots</p>
              <p className="modal-empty-hint">
                Could not load lots for item {itemKey}. Please try again.
              </p>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="modal-empty-state">
              <div className="modal-empty-icon">⏳</div>
              <p className="modal-empty-text">Loading FEFO lots...</p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && lots.length === 0 && (
            <div className="modal-empty-state">
              <div className="modal-empty-icon">📦</div>
              <p className="modal-empty-text">No lots available</p>
              <p className="modal-empty-hint">
                {itemKey
                  ? `No lots found for ${itemKey}${targetQty ? ` with ${targetQty.toFixed(3)} kg available` : ''}`
                  : 'Please select an item first'}
              </p>
            </div>
          )}

          {/* Lots Table (FEFO sorted by API) */}
          {!isLoading && !error && lots.length > 0 && (
            <div className="modal-table-container">
              <table className="modal-table">
                <thead>
                  <tr>
                    <th>Lot No</th>
                    <th className="text-center">Bin No</th>
                    <th>Date Exp</th>
                    <th className="text-right">On Hand</th>
                    <th className="text-right">Committed</th>
                    <th className="text-right">Available</th>
                  </tr>
                </thead>
                <tbody>
                  {lots.map((lot, index) => (
                    <tr
                      key={lot.lotNo}
                      onClick={() => handleSelect(lot)}
                      style={{
                        background: isFefoLot(index) ? '#E3F2FD' : undefined,
                      }}
                    >
                      <td>
                        <div className="flex items-center gap-2">
                          {isFefoLot(index) && <span title="FEFO Lot (Earliest Expiry)">⭐</span>}
                          <strong>{lot.lotNo}</strong>
                        </div>
                      </td>
                      <td className="text-center">{lot.binNo}</td>
                      <td>{lot.dateExpiry}</td>
                      <td className="text-right">{lot.qtyOnHand.toFixed(2)}</td>
                      <td className="text-right">{lot.qtyCommitSales.toFixed(2)}</td>
                      <td
                        className="text-right"
                        style={{
                          color: '#2E7D32',
                          fontWeight: 'bold',
                        }}
                      >
                        {lot.availableQty.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {!isLoading && !error && lots.length > 0 && (
          <div className="modal-footer">
            <div className="modal-footer-left">
              <p className="modal-footer-info">
                Showing {lots.length} lot{lots.length !== 1 ? 's' : ''} • ⭐ = FEFO
                Recommended
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
