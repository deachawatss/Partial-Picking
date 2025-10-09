interface PickItem {
  lineId: number
  itemKey: string
  description: string
  targetQty: number
  pickedQty: number
  balance: number
  status: 'unpicked' | 'picked' | 'error'
}

interface ItemSelectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (item: PickItem) => void
  runNo?: number
  batchNo?: number
}

export function ItemSelectionModal({
  open,
  onOpenChange,
  onSelect,
  runNo,
  batchNo,
}: ItemSelectionModalProps) {
  // Mock data - will be replaced with API call in Phase 3.4 (T065)
  const mockItems: PickItem[] = [
    {
      lineId: 1,
      itemKey: 'ITEM-001',
      description: 'Ingredient A - Premium Grade',
      targetQty: 25.5,
      pickedQty: 0,
      balance: 25.5,
      status: 'unpicked',
    },
    {
      lineId: 2,
      itemKey: 'ITEM-002',
      description: 'Ingredient B - Standard',
      targetQty: 15.0,
      pickedQty: 15.2,
      balance: -0.2,
      status: 'picked',
    },
    {
      lineId: 3,
      itemKey: 'ITEM-003',
      description: 'Ingredient C - Organic',
      targetQty: 30.0,
      pickedQty: 0,
      balance: 30.0,
      status: 'unpicked',
    },
  ]

  const handleSelect = (item: PickItem) => {
    onSelect(item)
    onOpenChange(false)
  }

  const handleClose = () => {
    onOpenChange(false)
  }

  const getStatusClass = (status: string) => {
    if (status === 'picked') return 'modal-status-completed'
    if (status === 'error') return 'modal-status-default'
    return 'modal-status-new'
  }

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header - Brown Gradient */}
        <div className="modal-header-brown">
          <h3 className="modal-title">
            <span>📝</span>
            <span>
              Select Item {runNo && batchNo && `(Run: ${runNo}, Batch: ${batchNo})`}
            </span>
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
          {mockItems.length === 0 ? (
            <div className="modal-empty-state">
              <div className="modal-empty-icon">📋</div>
              <p className="modal-empty-text">No items found</p>
              <p className="modal-empty-hint">There are no items for this batch</p>
            </div>
          ) : (
            <div className="modal-table-container">
              <table className="modal-table">
                <thead>
                  <tr>
                    <th>Item Key</th>
                    <th>Description</th>
                    <th className="text-center">Target (kg)</th>
                    <th className="text-center">Picked (kg)</th>
                    <th className="text-center">Balance (kg)</th>
                    <th className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {mockItems.map((item) => (
                    <tr key={item.lineId} onClick={() => handleSelect(item)}>
                      <td>
                        <strong>{item.itemKey}</strong>
                      </td>
                      <td title={item.description}>{item.description}</td>
                      <td className="text-center">{item.targetQty.toFixed(2)}</td>
                      <td className="text-center">{item.pickedQty.toFixed(2)}</td>
                      <td
                        className="text-center"
                        style={{
                          color: item.balance > 0 ? '#2B1C14' : '#2E7D32',
                          fontWeight: item.balance === 0 ? 'bold' : 'normal',
                        }}
                      >
                        {item.balance.toFixed(2)}
                      </td>
                      <td className="text-center">
                        <span className={`modal-status-badge ${getStatusClass(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {mockItems.length > 0 && (
          <div className="modal-footer">
            <div className="modal-footer-left">
              <p className="modal-footer-info">
                Showing {mockItems.length} item{mockItems.length !== 1 ? 's' : ''}
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
