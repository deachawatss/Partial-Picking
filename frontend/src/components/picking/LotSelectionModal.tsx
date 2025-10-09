interface Lot {
  lotNo: string
  dateExpiry: string
  qtyOnHand: number
  qtyCommitSales: number
  availableQty: number
  binNo?: string
}

interface LotSelectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (lot: Lot) => void
  itemKey?: string
  targetQty?: number
}

export function LotSelectionModal({
  open,
  onOpenChange,
  onSelect,
  itemKey,
  targetQty,
}: LotSelectionModalProps) {
  // Mock data - will be replaced with API call in Phase 3.4 (T067)
  // Sorted by DateExpiry ASC (FEFO - First Expired First Out)
  const mockLots: Lot[] = [
    {
      lotNo: 'LOT-2025-01-15',
      dateExpiry: '2025-01-15',
      qtyOnHand: 50.0,
      qtyCommitSales: 10.0,
      availableQty: 40.0,
      binNo: 'BIN-001',
    },
    {
      lotNo: 'LOT-2025-02-20',
      dateExpiry: '2025-02-20',
      qtyOnHand: 75.0,
      qtyCommitSales: 5.0,
      availableQty: 70.0,
      binNo: 'BIN-002',
    },
    {
      lotNo: 'LOT-2025-03-10',
      dateExpiry: '2025-03-10',
      qtyOnHand: 100.0,
      qtyCommitSales: 0.0,
      availableQty: 100.0,
      binNo: 'BIN-003',
    },
  ]

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
          {mockLots.length === 0 ? (
            <div className="modal-empty-state">
              <div className="modal-empty-icon">📦</div>
              <p className="modal-empty-text">No lots available</p>
              <p className="modal-empty-hint">
                No lots found with sufficient quantity (
                {targetQty ? targetQty.toFixed(2) : '0.00'} kg required)
              </p>
            </div>
          ) : (
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
                  {mockLots.map((lot, index) => (
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
                      <td className="text-center">{lot.qtyOnHand.toFixed(2)}</td>
                      <td className="text-center">{lot.qtyCommitSales.toFixed(2)}</td>
                      <td
                        className="text-center"
                        style={{
                          color: '#2E7D32',
                          fontWeight: 'bold',
                        }}
                      >
                        {lot.availableQty.toFixed(2)}
                      </td>
                      <td className="text-center">{lot.binNo || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {mockLots.length > 0 && (
          <div className="modal-footer">
            <div className="modal-footer-left">
              <p className="modal-footer-info">
                Showing {mockLots.length} lot{mockLots.length !== 1 ? 's' : ''} • ⭐ = FEFO
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
