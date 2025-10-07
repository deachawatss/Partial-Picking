import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useState } from 'react'

interface Bin {
  binNo: string
  location: string
  user1?: string
  user4?: string
}

interface BinSelectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (bin: Bin) => void
  lotNo?: string
}

export function BinSelectionModal({ open, onOpenChange, onSelect, lotNo }: BinSelectionModalProps) {
  const [searchTerm, setSearchTerm] = useState('')

  // Mock data - will be replaced with API call in Phase 3.4
  // Filter: Only TFC1 PARTIAL bins (Location='TFC1', User1='WHTFC1', User4='PARTIAL')
  const mockBins: Bin[] = [
    { binNo: 'TFC1-PARTIAL-001', location: 'TFC1', user1: 'WHTFC1', user4: 'PARTIAL' },
    { binNo: 'TFC1-PARTIAL-002', location: 'TFC1', user1: 'WHTFC1', user4: 'PARTIAL' },
    { binNo: 'TFC1-PARTIAL-003', location: 'TFC1', user1: 'WHTFC1', user4: 'PARTIAL' },
    { binNo: 'TFC1-PARTIAL-004', location: 'TFC1', user1: 'WHTFC1', user4: 'PARTIAL' },
    { binNo: 'TFC1-PARTIAL-005', location: 'TFC1', user1: 'WHTFC1', user4: 'PARTIAL' },
  ]

  const filteredBins = mockBins.filter(bin =>
    bin.binNo.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSelect = (bin: Bin) => {
    onSelect(bin)
    onOpenChange(false)
    setSearchTerm('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select Bin {lotNo && `for ${lotNo}`}</DialogTitle>
          <p className="text-sm text-gray-600 mt-2">
            Showing TFC1 PARTIAL bins only ({filteredBins.length} available)
          </p>
        </DialogHeader>

        {/* Search Input */}
        <div className="mb-4">
          <Input
            type="text"
            placeholder="Search bin number..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full"
            autoFocus
          />
        </div>

        {/* Bins Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-96 overflow-y-auto">
          {filteredBins.length === 0 ? (
            <p className="col-span-full text-center text-gray-500 py-8">No bins found</p>
          ) : (
            filteredBins.map(bin => (
              <Button
                key={bin.binNo}
                type="button"
                variant="outline"
                className="h-auto p-4 text-left justify-start hover:bg-blue-50 hover:border-blue-300"
                onClick={() => handleSelect(bin)}
              >
                <div className="w-full">
                  <div className="font-bold text-lg">{bin.binNo}</div>
                  <div className="text-xs text-gray-600 mt-1">{bin.location}</div>
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
