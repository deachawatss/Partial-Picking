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
}

interface LotSelectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (lot: Lot) => void
  itemKey: string | null
  targetQty?: number
}

export function LotSelectionModal({
  open,
  onOpenChange,
  onSelect,
  itemKey,
  targetQty,
}: LotSelectionModalProps) {
  const { data: lotData, isLoading, error } = useAvailableLots(itemKey, targetQty, {
    enabled: open && !!itemKey
  })

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

        {/* Item Context Bar */}
        {itemKey && targetQty && (
          <div className="modal-item-context">
            <span className="modal-context-label">Item:</span>
            <span className="modal-context-value">{itemKey}</span>
            <span className="modal-context-label">• Target:</span>
            <span className="modal-context-value">{targetQty.toFixed(2)} kg</span>
            <span className="modal-context-label">• FEFO: First Expired First Out</span>
          </div>
        )}

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
                    <th>Expiry Date</th>
                    <th className="text-center">On Hand (kg)</th>
                    <th className="text-center">Committed (kg)</th>
                    <th className="text-center">Available (kg)</th>
                    <th className="text-center">Bin</th>
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
                      <td>{lot.dateExpiry}</td>
                      <td className="text-center">{lot.qtyOnHand.toFixed(3)}</td>
                      <td className="text-center">{lot.qtyCommitSales.toFixed(3)}</td>
                      <td
                        className="text-center"
                        style={{
                          color: '#2E7D32',
                          fontWeight: 'bold',
                        }}
                      >
                        {lot.availableQty.toFixed(3)}
                      </td>
                      <td className="text-center">{lot.binNo}</td>
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
