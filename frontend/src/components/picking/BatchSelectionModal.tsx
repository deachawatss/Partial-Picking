import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface Batch {
  batchNo: number
  rowNum: number
  itemCount: number
  pickedCount: number
  status: string
}

interface BatchSelectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (batch: Batch) => void
  runNo?: number
}

export function BatchSelectionModal({
  open,
  onOpenChange,
  onSelect,
  runNo,
}: BatchSelectionModalProps) {
  // Mock data - will be replaced with API call in Phase 3.4 (T065)
  const mockBatches: Batch[] = [
    {
      batchNo: 1,
      rowNum: 1,
      itemCount: 10,
      pickedCount: 5,
      status: 'In Progress',
    },
    {
      batchNo: 2,
      rowNum: 2,
      itemCount: 8,
      pickedCount: 0,
      status: 'Pending',
    },
    {
      batchNo: 3,
      rowNum: 3,
      itemCount: 12,
      pickedCount: 12,
      status: 'Completed',
    },
  ]

  const handleSelect = (batch: Batch) => {
    onSelect(batch)
    onOpenChange(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'In Progress':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select Batch {runNo && `(Run: ${runNo})`}</DialogTitle>
        </DialogHeader>

        {/* Batches Grid */}
        <div className="space-y-2">
          {mockBatches.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No batches found</p>
          ) : (
            mockBatches.map(batch => (
              <Button
                key={batch.batchNo}
                type="button"
                variant="outline"
                className={`w-full h-auto p-4 text-left justify-start ${getStatusColor(batch.status)}`}
                onClick={() => handleSelect(batch)}
              >
                <div className="grid grid-cols-4 gap-4 w-full">
                  <div>
                    <div className="text-xs opacity-75">Batch No</div>
                    <div className="font-bold text-lg">{batch.batchNo}</div>
                  </div>
                  <div>
                    <div className="text-xs opacity-75">Items</div>
                    <div className="font-medium">{batch.itemCount} items</div>
                  </div>
                  <div>
                    <div className="text-xs opacity-75">Picked</div>
                    <div className="font-medium">
                      {batch.pickedCount}/{batch.itemCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs opacity-75">Status</div>
                    <div className="font-medium">{batch.status}</div>
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
