import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

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

  const isFefoLot = (index: number) => index === 0 // First lot is FEFO (earliest expiry)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select Lot (FEFO) {itemKey && `for ${itemKey}`}</DialogTitle>
          <p className="text-sm text-gray-600 mt-2">
            Lots are sorted by expiry date (FEFO - First Expired First Out). Top lot recommended.
          </p>
        </DialogHeader>

        {/* Lots Grid */}
        <div className="space-y-2">
          {mockLots.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No lots available with sufficient quantity (
              {targetQty ? targetQty.toFixed(2) : '0.00'} kg required)
            </p>
          ) : (
            mockLots.map((lot, index) => (
              <Button
                key={lot.lotNo}
                type="button"
                variant="outline"
                className={`w-full h-auto p-4 text-left justify-start ${
                  isFefoLot(index)
                    ? 'bg-blue-100 text-blue-900 border-blue-300 border-2 ring-2 ring-blue-400'
                    : 'bg-white text-gray-900'
                }`}
                onClick={() => handleSelect(lot)}
              >
                <div className="w-full">
                  {isFefoLot(index) && (
                    <div className="text-xs font-bold text-blue-700 mb-2 flex items-center gap-2">
                      ⭐ FEFO LOT (Earliest Expiry - Recommended)
                    </div>
                  )}
                  <div className="grid grid-cols-5 gap-4">
                    <div>
                      <div className="text-xs opacity-75">Lot No</div>
                      <div className="font-bold">{lot.lotNo}</div>
                    </div>
                    <div>
                      <div className="text-xs opacity-75">Expiry Date</div>
                      <div className="font-medium">{lot.dateExpiry}</div>
                    </div>
                    <div>
                      <div className="text-xs opacity-75">On Hand (kg)</div>
                      <div className="font-medium">{lot.qtyOnHand.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs opacity-75">Committed (kg)</div>
                      <div className="font-medium">{lot.qtyCommitSales.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs opacity-75">Available (kg)</div>
                      <div className="font-medium text-green-600">
                        {lot.availableQty.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  {lot.binNo && <div className="mt-2 text-xs text-gray-600">Bin: {lot.binNo}</div>}
                </div>
              </Button>
            ))
          )}
        </div>

        {/* Close Button */}
        <div className="flex justify-end mt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
