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
    'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-coffee'

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-[28px] border border-sand bg-gradient-to-br from-[#fdf7ef] via-[#f9f1e6] to-[#f5e9db] shadow-panel">
      <div className="flex-1 overflow-hidden">
        <table className="w-full border-separate border-spacing-0 text-base text-mocha">
          <thead>
            <tr className="bg-coffee text-cream">
              <th colSpan={6} className="px-6 py-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/65">
                      Batch overview
                    </span>
                    <p className="text-lg font-bold tracking-[0.08em]">Batch Ticket Items</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {filterOptions.map(option => {
                      if (!onFilterChange) {
                        return (
                          <span
                            key={option.key}
                            className={`${baseFilterClasses} cursor-default border-white/20 bg-white/15 text-white/60`}
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
                            className={`${baseFilterClasses} border-[#f5e1c6] bg-[#f5e1c6] text-coffee shadow-[0_12px_24px_rgba(245,195,110,0.35)]`}
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
                          className={`${baseFilterClasses} border-white/25 bg-white/10 text-white/75 hover:border-white/35 hover:bg-white/15 hover:text-white`}
                        >
                          {option.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </th>
            </tr>
            <tr className="bg-[#f4e5d6] text-[11px] font-semibold uppercase tracking-[0.22em] text-mocha/75">
              <th className="px-4 py-3 text-left">Item</th>
              <th className="px-4 py-3 text-center">Batch no.</th>
              <th className="px-4 py-3 text-right">Partial (kg)</th>
              <th className="px-4 py-3 text-right">Weighted (kg)</th>
              <th className="px-4 py-3 text-right">Balance (kg)</th>
              <th className="px-4 py-3 text-left">Allergens</th>
            </tr>
          </thead>

          <tbody className="bg-white">
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-mocha/40">
                  No batch items to display
                </td>
              </tr>
            ) : (
              items.map(item => {
                const isPicked = item.status === 'picked'
                const rowHighlight = isPicked ? 'bg-[#f1fff4] text-mocha' : 'bg-white text-mocha'
                const clickable = onItemClick ? 'cursor-pointer hover:bg-[#fcecd2]' : ''

                return (
                  <tr
                    key={`${item.lineId}-${item.itemKey}`}
                    onClick={() => onItemClick?.(item)}
                    className={`border-b border-sand/60 transition-colors ${rowHighlight} ${clickable}`}
                  >
                    <td className="px-5 py-5">
                      <div className="text-base font-semibold tracking-wide text-coffee">
                        {item.itemKey}
                      </div>
                      <div className="text-[11px] uppercase tracking-[0.24em] text-mocha/55">
                        {item.description || '—'}
                      </div>
                    </td>
                    <td className="px-5 py-5 text-center font-semibold tracking-wide text-coffee">
                      {item.batchNo}
                    </td>
                    <td className="px-5 py-5 text-right font-mono text-base font-semibold">
                      {formatQty(item.targetQty)}
                    </td>
                    <td className="px-5 py-5 text-right font-mono text-base font-semibold">
                      {item.pickedQty > 0 ? (
                        <span className="text-[#2f7a52]">{formatQty(item.pickedQty)}</span>
                      ) : (
                        <span className="text-mocha/40">—</span>
                      )}
                    </td>
                    <td className="px-5 py-5 text-right font-mono text-base font-semibold">
                      {item.pickedQty > 0 ? (
                        <span className={item.balance > 0.1 ? 'text-[#d04b3b]' : 'text-[#2f7a52]'}>
                          {formatQty(item.balance)}
                        </span>
                      ) : (
                        <span className="text-mocha/40">—</span>
                      )}
                    </td>
                    <td className="px-5 py-5">
                      {item.allergens ? (
                        <span className="inline-flex rounded-full bg-[#f7d9b8] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-coffee">
                          {item.allergens}
                        </span>
                      ) : (
                        <span className="text-[11px] uppercase tracking-[0.2em] text-mocha/40">
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
              <tr className="bg-[#efe1d1] text-[11px] font-semibold uppercase tracking-[0.22em] text-mocha/70">
                <td colSpan={2} className="px-6 py-5">
                  <div className="flex flex-wrap items-center gap-4">
                    <span>Total items {items.length}</span>
                    <span>Picked {derivedPickedCount}</span>
                    <span>Pending {derivedPendingCount}</span>
                  </div>
                </td>
                <td colSpan={4} className="px-6 py-5 text-right">
                  <div className="flex flex-wrap items-center justify-end gap-6 text-mocha/80">
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
