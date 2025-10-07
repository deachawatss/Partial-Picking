import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'picked':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Select Item {runNo && batchNo && `(Run: ${runNo}, Batch: ${batchNo})`}
          </DialogTitle>
        </DialogHeader>

        {/* Items Grid */}
        <div className="space-y-2">
          {mockItems.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No items found</p>
          ) : (
            mockItems.map(item => (
              <Button
                key={item.lineId}
                type="button"
                variant="outline"
                className={`w-full h-auto p-4 text-left justify-start ${getStatusColor(item.status)}`}
                onClick={() => handleSelect(item)}
              >
                <div className="grid grid-cols-5 gap-4 w-full">
                  <div className="col-span-2">
                    <div className="text-xs opacity-75">Item Key</div>
                    <div className="font-bold">{item.itemKey}</div>
                    <div className="text-sm mt-1 truncate">{item.description}</div>
                  </div>
                  <div>
                    <div className="text-xs opacity-75">Target (kg)</div>
                    <div className="font-medium">{item.targetQty.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs opacity-75">Picked (kg)</div>
                    <div className="font-medium">{item.pickedQty.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs opacity-75">Balance (kg)</div>
                    <div
                      className={`font-medium ${item.balance > 0 ? 'text-gray-900' : 'text-green-600'}`}
                    >
                      {item.balance.toFixed(2)}
                    </div>
                  </div>
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
