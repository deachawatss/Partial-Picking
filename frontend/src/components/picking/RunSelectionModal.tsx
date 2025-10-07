import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface Run {
  runNo: number
  fgItemKey: string
  fgDescription: string
  productionDate: string
  status: string
}

interface RunSelectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (run: Run) => void
}

export function RunSelectionModal({ open, onOpenChange, onSelect }: RunSelectionModalProps) {
  const [searchTerm, setSearchTerm] = useState('')

  // Mock data - will be replaced with API call in Phase 3.4 (T065)
  const mockRuns: Run[] = [
    {
      runNo: 100001,
      fgItemKey: 'FG-001',
      fgDescription: 'Finished Good Item 1',
      productionDate: '2025-10-01',
      status: 'In Progress',
    },
    {
      runNo: 100002,
      fgItemKey: 'FG-002',
      fgDescription: 'Finished Good Item 2',
      productionDate: '2025-10-02',
      status: 'Pending',
    },
  ]

  // Filter runs by search term (debounced in real implementation)
  const filteredRuns = mockRuns.filter(
    run =>
      run.runNo.toString().includes(searchTerm) ||
      run.fgItemKey.toLowerCase().includes(searchTerm.toLowerCase()) ||
      run.fgDescription.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSelect = (run: Run) => {
    onSelect(run)
    onOpenChange(false)
    setSearchTerm('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select Production Run</DialogTitle>
        </DialogHeader>

        {/* Search Input */}
        <div className="mb-4">
          <Input
            type="text"
            placeholder="Search by Run No, Item Key, or Description..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full"
            autoFocus
          />
        </div>

        {/* Runs Grid */}
        <div className="space-y-2">
          {filteredRuns.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No runs found</p>
          ) : (
            filteredRuns.map(run => (
              <Button
                key={run.runNo}
                type="button"
                variant="outline"
                className="w-full h-auto p-4 text-left justify-start"
                onClick={() => handleSelect(run)}
              >
                <div className="grid grid-cols-4 gap-4 w-full">
                  <div>
                    <div className="text-xs text-gray-500">Run No</div>
                    <div className="font-bold">{run.runNo}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">FG Item</div>
                    <div className="font-medium">{run.fgItemKey}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Description</div>
                    <div className="font-medium truncate">{run.fgDescription}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Production Date</div>
                    <div className="font-medium">{run.productionDate}</div>
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
