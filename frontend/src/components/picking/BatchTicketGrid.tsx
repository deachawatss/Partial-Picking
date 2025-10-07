import { Card } from '@/components/ui/card'

interface BatchTicketItem {
  lineId: number
  itemKey: string
  batchNo: number
  targetQty: number
  pickedQty: number
  balance: number
  allergens?: string
  status: 'unpicked' | 'picked' | 'error'
}

interface BatchTicketGridProps {
  items: BatchTicketItem[]
  onItemClick?: (item: BatchTicketItem) => void
}

export function BatchTicketGrid({ items, onItemClick }: BatchTicketGridProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'picked':
        return 'bg-green-50'
      case 'error':
        return 'bg-red-50'
      default:
        return 'bg-white'
    }
  }

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="bg-gray-100 border-b p-3">
        <h3 className="font-bold text-sm">Batch Ticket Items</h3>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b text-xs">
              <th className="text-left p-2 font-semibold">Item</th>
              <th className="text-center p-2 font-semibold">Batch</th>
              <th className="text-right p-2 font-semibold">Target (kg)</th>
              <th className="text-right p-2 font-semibold">Weighted (kg)</th>
              <th className="text-right p-2 font-semibold">Balance (kg)</th>
              <th className="text-left p-2 font-semibold">Allergens</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-500">
                  No items in batch
                </td>
              </tr>
            ) : (
              items.map(item => (
                <tr
                  key={item.lineId}
                  className={`border-b hover:bg-gray-50 cursor-pointer transition-colors ${getStatusColor(item.status)}`}
                  onClick={() => onItemClick?.(item)}
                >
                  <td className="p-2">
                    <div className="font-medium">{item.itemKey}</div>
                  </td>
                  <td className="text-center p-2">{item.batchNo}</td>
                  <td className="text-right p-2 font-mono">{item.targetQty.toFixed(2)}</td>
                  <td className="text-right p-2 font-mono">
                    {item.pickedQty > 0 ? (
                      <span className="text-green-700 font-medium">
                        {item.pickedQty.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="text-right p-2 font-mono">
                    {item.pickedQty > 0 ? (
                      <span className={item.balance > 0.1 ? 'text-red-600' : 'text-green-600'}>
                        {item.balance.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="p-2">
                    {item.allergens ? (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                        {item.allergens}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">None</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Footer */}
      {items.length > 0 && (
        <div className="bg-gray-50 border-t p-3 grid grid-cols-3 gap-4 text-xs">
          <div>
            <div className="text-gray-600">Total Items</div>
            <div className="font-bold text-lg">{items.length}</div>
          </div>
          <div>
            <div className="text-gray-600">Picked</div>
            <div className="font-bold text-lg text-green-600">
              {items.filter(i => i.status === 'picked').length}
            </div>
          </div>
          <div>
            <div className="text-gray-600">Pending</div>
            <div className="font-bold text-lg text-gray-600">
              {items.filter(i => i.status === 'unpicked').length}
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
