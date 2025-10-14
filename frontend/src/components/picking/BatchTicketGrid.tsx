import { memo } from 'react'
import { EmptyState } from '@/components/shared/EmptyState'

interface BatchTicketItem {
  lineId: number
  itemKey: string
  description?: string
  batchNo: string
  targetQty: number
  pickedQty: number
  balance: number
  allergens?: string
  status: 'unpicked' | 'picked' | 'error'
}

interface BatchTicketGridProps {
  items: BatchTicketItem[]
  onItemClick?: (item: BatchTicketItem) => void
  filter?: 'pending' | 'picked'
  onFilterChange?: (filter: 'pending' | 'picked') => void
  pendingCount?: number
  pickedCount?: number
  selectedRowKey?: string | null  // Format: "itemKey-batchNo"
}

interface BatchItemRowProps {
  item: BatchTicketItem
  onItemClick?: (item: BatchTicketItem) => void
  selectedRowKey?: string | null
  filter?: 'pending' | 'picked'
}

const formatQty = (value: number) => value.toFixed(3)

/**
 * Memoized BatchItemRow - Performance Optimization Phase 2
 *
 * Prevents unnecessary re-renders during:
 * - Weight updates in other rows
 * - Parent component state changes
 * - Filter toggle operations
 *
 * Only re-renders when item data or selection state changes
 * Expected gain: 20-30% reduction in render time
 */
const BatchItemRow = memo(({ item, onItemClick, selectedRowKey, filter }: BatchItemRowProps) => {
  const isPicked = item.status === 'picked'
  const rowKey = `${item.itemKey}-${item.batchNo}`
  const isSelected = selectedRowKey === rowKey
  const isPickedTab = filter === 'picked'

  const rowHighlight = isSelected
    ? 'bg-accent-gold/15 border-l-4 border-l-accent-gold text-text-primary'
    : isPicked
      ? 'bg-accent-green/5 text-text-primary'
      : 'bg-white text-text-primary'

  // Only allow clicking in Pending tab (not in Picked tab)
  const clickable = onItemClick && !isPickedTab
    ? 'cursor-pointer hover:bg-bg-main hover:shadow-soft transition-all duration-200 btn-scale-hover'
    : isPickedTab
      ? 'cursor-not-allowed opacity-80'
      : ''

  const handleClick = () => {
    // Prevent clicking rows in PICKED tab
    if (isPickedTab) return
    onItemClick?.(item)
  }

  return (
    <tr
      key={`${item.lineId}-${item.itemKey}`}
      onClick={handleClick}
      className={`border-b border-border-main ${rowHighlight} ${clickable}`}
    >
      <td className="w-[15%] border-r border-border-main px-4 py-3 text-center">
        <div className="whitespace-nowrap text-sm font-bold tracking-wide text-text-primary">
          {item.itemKey}
        </div>
      </td>
      <td className="w-[12%] border-r border-border-main px-4 py-3 text-center text-sm font-bold tracking-wide text-text-primary">
        {item.batchNo}
      </td>
      <td className="w-[13%] border-r border-border-main px-4 py-3 text-right font-body text-sm font-medium tabular-nums">
        {formatQty(item.targetQty)}
      </td>
      <td className="w-[13%] border-r border-border-main px-4 py-3 text-right font-body text-sm font-semibold tabular-nums">
        {item.pickedQty > 0 ? (
          <span className="text-accent-green">{formatQty(item.pickedQty)}</span>
        ) : (
          <span className="text-text-primary/50">0.000</span>
        )}
      </td>
      {/* Balance column hidden per user request */}
      <td className="w-[10%] px-4 py-3">
        {item.allergens ? (
          <span className="inline-flex rounded-lg border-2 border-highlight/30 bg-gradient-to-b from-[#fff8e1] to-[#ffeaa7] px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide text-text-primary shadow-soft">
            {item.allergens}
          </span>
        ) : (
          <span className="text-xs uppercase tracking-wider text-text-primary/30">
            None
          </span>
        )}
      </td>
    </tr>
  )
}, (prevProps, nextProps) => {
  // Custom comparison function - return true to skip re-render
  // Only re-render if item data, selection state, or filter actually changed
  return (
    prevProps.item.lineId === nextProps.item.lineId &&
    prevProps.item.itemKey === nextProps.item.itemKey &&
    prevProps.item.batchNo === nextProps.item.batchNo &&
    prevProps.item.targetQty === nextProps.item.targetQty &&
    prevProps.item.pickedQty === nextProps.item.pickedQty &&
    prevProps.item.balance === nextProps.item.balance &&
    prevProps.item.status === nextProps.item.status &&
    prevProps.item.allergens === nextProps.item.allergens &&
    prevProps.selectedRowKey === nextProps.selectedRowKey &&
    prevProps.filter === nextProps.filter
  )
})

BatchItemRow.displayName = 'BatchItemRow'

export function BatchTicketGrid({
  items,
  onItemClick,
  filter,
  onFilterChange,
  pendingCount,
  pickedCount,
  selectedRowKey,
}: BatchTicketGridProps) {
  const derivedPendingCount = pendingCount ?? items.filter(item => item.status !== 'picked').length
  const derivedPickedCount = pickedCount ?? items.filter(item => item.status === 'picked').length

  const handleFilterClick = (nextFilter: 'pending' | 'picked') => {
    if (!onFilterChange) return
    onFilterChange(nextFilter)
  }

  const filterOptions: Array<{ key: 'pending' | 'picked'; label: string }> = [
    { key: 'pending', label: `Pending to Picked (${derivedPendingCount})` },
    { key: 'picked', label: `Picked (${derivedPickedCount})` },
  ]

  const baseFilterClasses =
    'inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 btn-scale-hover'

  return (
    <section className="flex h-full flex-col rounded-lg border-2 border-border-main bg-surface shadow-soft">
      <div className="flex-1 overflow-y-auto">
        <table className="w-full border-separate border-spacing-0 text-sm text-text-primary">
          <thead className="sticky top-0 z-10">
            <tr className="bg-brand-primary text-white">
              <th colSpan={5} className="px-6 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xl font-bold tracking-[0.08em]">Batch Partial</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {filterOptions.map(option => {
                      if (!onFilterChange) {
                        return (
                          <span
                            key={option.key}
                            className={`${baseFilterClasses} cursor-default border-white/30 bg-white/20 text-white/60`}
                          >
                            {option.label}
                          </span>
                        )
                      }

                      const isActive = filter === option.key

                      if (isActive) {
                        return (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => handleFilterClick(option.key)}
                            className={`${baseFilterClasses} border-accent-green bg-accent-green text-white shadow-button-green focus-visible:ring-accent-green`}
                          >
                            {option.label}
                          </button>
                        )
                      }

                      return (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => handleFilterClick(option.key)}
                          className={`${baseFilterClasses} border-white/40 bg-white/15 text-white hover:border-white/60 hover:bg-white/25 focus-visible:ring-white`}
                        >
                          {option.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </th>
            </tr>
            <tr className="bg-bg-main text-sm font-bold uppercase tracking-wider text-text-primary">
              <th className="w-[15%] border-r border-border-main px-4 py-1.5 text-center">Item</th>
              <th className="w-[12%] border-r border-border-main px-4 py-1.5 text-center">Batch no.</th>
              <th className="w-[13%] border-r border-border-main px-4 py-1.5 text-right">Partial</th>
              <th className="w-[13%] border-r border-border-main px-4 py-1.5 text-right">Weighted</th>
              {/* Balance column hidden per user request */}
              <th className="w-[10%] px-4 py-1.5 text-left">Allergens</th>
            </tr>
          </thead>

          <tbody className="bg-surface">
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-0">
                  <EmptyState
                    variant="empty"
                    title={filter === 'picked' ? 'No picked items yet' : 'No pending items'}
                    description={
                      filter === 'picked'
                        ? 'Items will appear here once they are picked and weighed'
                        : 'Select a batch to view items to pick'
                    }
                  />
                </td>
              </tr>
            ) : (
              items.map(item => (
                <BatchItemRow
                  key={`${item.lineId}-${item.itemKey}`}
                  item={item}
                  onItemClick={onItemClick}
                  selectedRowKey={selectedRowKey}
                  filter={filter}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
