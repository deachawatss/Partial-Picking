import { useMemo } from 'react'
import { useBinsForLot } from '@/hooks/useBinsQuery'
import type { BinLotInventoryDTO } from '@/types/api'

interface Bin {
  binNo: string
  expiryDate: string
  qtyOnHand: number
  qtyCommitSales: number
  availableQty: number
  packSize: number
  bagsAvailable: number
}

interface BinSelectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (bin: Bin) => void
  lotNo: string | null
  itemKey: string | null
}

export function BinSelectionModal({
  open,
  onOpenChange,
  onSelect,
  lotNo,
  itemKey,
}: BinSelectionModalProps) {
  const { data: binData, isLoading, error } = useBinsForLot(lotNo, itemKey, {
    enabled: open && !!lotNo && !!itemKey
  })

  // Map BinLotInventoryDTO to Bin with BagsAvailable calculation
  const bins = useMemo<Bin[]>(() => {
    if (!binData) return []

    return binData.map((bin) => ({
      binNo: bin.binNo,
      expiryDate: bin.expiryDate,
      qtyOnHand: bin.qtyOnHand,
      qtyCommitSales: bin.qtyCommitSales,
      availableQty: bin.availableQty,
      packSize: bin.packSize,
      bagsAvailable: bin.packSize > 0 ? bin.availableQty / bin.packSize : 0,
    }))
  }, [binData])

  const handleSelect = (bin: Bin) => {
    onSelect(bin)
    onOpenChange(false)
  }

  const handleClose = () => {
    onOpenChange(false)
  }

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header - Brown Gradient */}
        <div className="modal-header-brown">
          <h3 className="modal-title">
            <span>📍</span>
            <span>Select Bin for Lot</span>
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
              <p className="modal-empty-text">Error loading bins</p>
              <p className="modal-empty-hint">
                Could not load bins for lot {lotNo}. Please try again.
              </p>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="modal-empty-state">
              <div className="modal-empty-icon">⏳</div>
              <p className="modal-empty-text">Loading bins for lot...</p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && bins.length === 0 && (
            <div className="modal-empty-state">
              <div className="modal-empty-icon">📦</div>
              <p className="modal-empty-text">No bins available</p>
              <p className="modal-empty-hint">
                {lotNo && itemKey
                  ? `No bins found for lot ${lotNo} and item ${itemKey}`
                  : 'Please select a lot and item first'}
              </p>
            </div>
          )}

          {/* Bins Table */}
          {!isLoading && !error && bins.length > 0 && (
            <div className="modal-table-container">
              <table className="modal-table">
                <thead>
                  <tr>
                    <th className="text-center">Bin No</th>
                    <th>Date Exp</th>
                    <th className="text-center">Qty On Hand</th>
                    <th className="text-center">Committed Qty</th>
                    <th className="text-center">Qty Available</th>
                  </tr>
                </thead>
                <tbody>
                  {bins.map((bin) => (
                    <tr
                      key={bin.binNo}
                      onClick={() => handleSelect(bin)}
                    >
                      <td className="text-center">
                        <strong>{bin.binNo}</strong>
                      </td>
                      <td>{bin.expiryDate}</td>
                      <td className="text-center">{bin.qtyOnHand.toFixed(2)}</td>
                      <td className="text-center">{bin.qtyCommitSales.toFixed(2)}</td>
                      <td
                        className="text-center"
                        style={{
                          color: '#2E7D32',
                          fontWeight: 'bold',
                        }}
                      >
                        {bin.availableQty.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {!isLoading && !error && bins.length > 0 && (
          <div className="modal-footer">
            <div className="modal-footer-left">
              <p className="modal-footer-info">
                Showing {bins.length} bin{bins.length !== 1 ? 's' : ''}
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
