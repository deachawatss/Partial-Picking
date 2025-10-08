interface BatchTicketItem {
  lineId: number
  itemKey: string
  description?: string
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
  filter?: 'pending' | 'picked'
  onFilterChange?: (filter: 'pending' | 'picked') => void
  pendingCount?: number
  pickedCount?: number
}

const formatQty = (value: number) => value.toFixed(2)

export function BatchTicketGrid({
  items,
  onItemClick,
  filter,
  onFilterChange,
  pendingCount,
  pickedCount,
}: BatchTicketGridProps) {
  const derivedPendingCount = pendingCount ?? items.filter(item => item.status !== 'picked').length
  const derivedPickedCount = pickedCount ?? items.filter(item => item.status === 'picked').length

  const totalWeighted = items.reduce((sum, item) => sum + item.pickedQty, 0)
  const totalBalance = items.reduce((sum, item) => sum + item.balance, 0)

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
    <section className="flex h-full flex-col overflow-hidden rounded-lg border-2 border-border-main bg-surface shadow-soft">
      <div className="flex-1 overflow-hidden">
        <table className="w-full border-separate border-spacing-0 text-base text-text-primary">
          <thead>
            <tr className="bg-brand-primary text-white">
              <th colSpan={6} className="px-6 py-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-lg font-bold tracking-[0.08em]">Batch Ticket Items</p>
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
            <tr className="bg-bg-main text-xs font-bold uppercase tracking-wider text-text-primary">
              <th className="px-5 py-3.5 text-left">Item</th>
              <th className="px-5 py-3.5 text-center">Batch no.</th>
              <th className="px-5 py-3.5 text-right">Partial (kg)</th>
              <th className="px-5 py-3.5 text-right">Weighted (kg)</th>
              <th className="px-5 py-3.5 text-right">Balance (kg)</th>
              <th className="px-5 py-3.5 text-left">Allergens</th>
            </tr>
          </thead>

          <tbody className="bg-surface">
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-text-primary/40">
                  No batch items to display
                </td>
              </tr>
            ) : (
              items.map(item => {
                const isPicked = item.status === 'picked'
                const rowHighlight = isPicked ? 'bg-accent-green/5 text-text-primary' : 'bg-white text-text-primary'
                const clickable = onItemClick
                  ? 'cursor-pointer hover:bg-bg-main hover:shadow-soft transition-all duration-200 btn-scale-hover'
                  : ''

                return (
                  <tr
                    key={`${item.lineId}-${item.itemKey}`}
                    onClick={() => onItemClick?.(item)}
                    className={`border-b border-border-main ${rowHighlight} ${clickable}`}
                  >
                    <td className="px-5 py-4">
                      <div className="text-base font-bold tracking-wide text-text-primary">
                        {item.itemKey}
                      </div>
                      <div className="text-xs uppercase tracking-wider text-text-primary/60">
                        {item.description || '—'}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center text-base font-bold tracking-wide text-text-primary">
                      {item.batchNo}
                    </td>
                    <td className="px-5 py-4 text-right font-body text-base font-medium tabular-nums">
                      {formatQty(item.targetQty)}
                    </td>
                    <td className="px-5 py-4 text-right font-body text-base font-semibold tabular-nums">
                      {item.pickedQty > 0 ? (
                        <span className="text-accent-green">{formatQty(item.pickedQty)}</span>
                      ) : (
                        <span className="text-text-primary/30">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right font-body text-base font-semibold tabular-nums">
                      {item.pickedQty > 0 ? (
                        <span className={item.balance > 0.1 ? 'text-danger' : 'text-accent-green'}>
                          {formatQty(item.balance)}
                        </span>
                      ) : (
                        <span className="text-text-primary/30">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {item.allergens ? (
                        <span className="inline-flex rounded-lg border-2 border-highlight/30 bg-gradient-to-b from-[#fff8e1] to-[#ffeaa7] px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-text-primary shadow-soft">
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
              })
            )}
          </tbody>

          {items.length > 0 && (
            <tfoot>
              <tr className="bg-bg-main text-xs font-semibold uppercase tracking-wider text-text-primary/70">
                <td colSpan={2} className="px-6 py-5">
                  <div className="flex flex-wrap items-center gap-4">
                    <span>Total items {items.length}</span>
                    <span>Picked {derivedPickedCount}</span>
                    <span>Pending {derivedPendingCount}</span>
                  </div>
                </td>
                <td colSpan={4} className="px-6 py-5 text-right">
                  <div className="flex flex-wrap items-center justify-end gap-6 text-text-primary/80">
                    <span>Total weighted {formatQty(totalWeighted)} kg</span>
                    <span>Balance {formatQty(totalBalance)} kg</span>
                  </div>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  )
}
