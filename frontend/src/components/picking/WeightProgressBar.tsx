import { memo } from 'react'
import { Button } from '@/components/ui/button'

type ScaleKey = 'small' | 'big'

interface ScaleStatus {
  online: boolean
  stable: boolean
}

interface WeightProgressBarProps {
  /** Current live weight from the selected scale */
  weight: number
  /** Minimum acceptable weight (pre-calculated by backend) */
  weightRangeLow: number
  /** Maximum acceptable weight (pre-calculated by backend) */
  weightRangeHigh: number
  /** Currently selected scale */
  selectedScale: ScaleKey
  /** Handler to switch between scales */
  onScaleChange: (scale: ScaleKey) => void
  /** Connection status for each scale */
  scaleStatuses: Record<ScaleKey, ScaleStatus>
  /** Active workstation label */
  workstationLabel?: string
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const progressFillByState: Record<string, string> = {
  offline: 'bg-gradient-to-r from-gray-500 via-gray-600 to-gray-700',
  idle: 'bg-gradient-to-r from-border-main via-border-main/80 to-border-main/60',
  under: 'bg-gradient-to-r from-orange-500 via-orange-600 to-orange-700',
  approaching: 'bg-gradient-to-r from-accent-gold via-accent-gold/90 to-accent-gold/70',
  good: 'bg-gradient-to-r from-accent-green/80 via-accent-green to-accent-green/60',
  over: 'bg-gradient-to-r from-danger/90 via-danger to-danger/80',
}

const statusBadgeByState: Record<string, string> = {
  offline: 'bg-text-primary/10 text-text-primary/60 border border-text-primary/10',
  idle: 'bg-text-primary/5 text-text-primary',
  under: 'bg-orange-600/15 text-orange-700',
  approaching: 'bg-accent-gold/15 text-accent-gold',
  good: 'bg-accent-green/15 text-accent-green',
  over: 'bg-danger/15 text-danger',
}

const containerAccentByState: Record<string, string> = {
  offline: 'border-border-main shadow-soft',
  idle: 'border-border-main shadow-soft',
  under: 'border-orange-600/40 shadow-[0_8px_20px_rgba(255,111,0,0.20)]',
  approaching: 'border-accent-gold/40 shadow-[0_8px_20px_rgba(224,170,47,0.22)]',
  good: 'border-accent-green/40 shadow-[0_8px_20px_rgba(63,125,62,0.25)]',
  over: 'border-danger/40 shadow-[0_8px_20px_rgba(198,40,40,0.25)]',
}

/**
 * Memoized WeightProgressBar - Performance Optimization Phase 2
 *
 * Prevents unnecessary re-renders during:
 * - Parent component state updates
 * - Other component re-renders
 *
 * Only re-renders when weight, ranges, or scale status actually changes
 * Expected gain: Reduced CPU usage during real-time weight updates
 */
export const WeightProgressBar = memo(function WeightProgressBar({
  weight,
  weightRangeLow,
  weightRangeHigh,
  selectedScale,
  onScaleChange,
  scaleStatuses,
  workstationLabel: _workstationLabel,
}: WeightProgressBarProps) {
  const safeWeight = Number.isFinite(weight) ? weight : 0
  const safeWeightLow = weightRangeLow > 0 ? weightRangeLow : 0
  const safeWeightHigh = weightRangeHigh > 0 ? weightRangeHigh : 0

  // Use backend-calculated tolerance range directly (no recalculation)
  const toleranceLow = safeWeightLow
  const toleranceHigh = safeWeightHigh

  // Fixed tolerance marker positions - ALWAYS at same visual location regardless of item weight
  const TOLERANCE_MIN_PERCENT = 60 // Left marker always at 60%
  const TOLERANCE_MAX_PERCENT = 70 // Right marker always at 70%

  // Calculate weight bar percentage relative to fixed tolerance markers
  const calculateWeightPercentage = (
    weight: number,
    toleranceLow: number,
    toleranceHigh: number
  ): number => {
    if (weight <= 0) return 0

    if (weight <= toleranceLow) {
      // Below tolerance: map [0, toleranceLow] → [0%, 60%]
      return (weight / toleranceLow) * TOLERANCE_MIN_PERCENT
    } else if (weight <= toleranceHigh) {
      // Within tolerance: map [toleranceLow, toleranceHigh] → [60%, 70%]
      const rangeProgress = (weight - toleranceLow) / (toleranceHigh - toleranceLow)
      return TOLERANCE_MIN_PERCENT + rangeProgress * (TOLERANCE_MAX_PERCENT - TOLERANCE_MIN_PERCENT)
    } else {
      // Above tolerance: map [toleranceHigh, maxWeight] → [70%, 100%]
      const maxWeight = toleranceHigh * 1.5 // 150% of high tolerance as max scale
      const excessWeight = weight - toleranceHigh
      const excessRange = maxWeight - toleranceHigh
      const excessProgress = Math.min(excessWeight / excessRange, 1)
      return TOLERANCE_MAX_PERCENT + excessProgress * (100 - TOLERANCE_MAX_PERCENT)
    }
  }

  // Calculate bar fill percentage based on weight relative to tolerance
  const percentage = toleranceHigh > 0
    ? clamp(calculateWeightPercentage(safeWeight, toleranceLow, toleranceHigh), 0, 100)
    : clamp((safeWeight / 50) * 100, 0, 100) // Default scale to 50 KG when no range set

  // Tolerance markers are FIXED at 60% and 70% (not dependent on weight values)
  const toleranceMinPosition = TOLERANCE_MIN_PERCENT
  const toleranceMaxPosition = TOLERANCE_MAX_PERCENT

  const activeScaleStatus = scaleStatuses[selectedScale] ?? { online: false, stable: false }
  const { online, stable } = activeScaleStatus

  let weightState: keyof typeof progressFillByState = 'idle'
  if (!online) {
    weightState = 'offline'
  } else if (safeWeight === 0) {
    weightState = 'idle'
  } else if (safeWeight < toleranceLow) {
    weightState = safeWeight < toleranceLow * 0.95 ? 'under' : 'approaching'
  } else if (safeWeight > toleranceHigh) {
    weightState = 'over'
  } else {
    weightState = 'good'
  }

  const isInRange = weightState === 'good'

  const statusMessage = (() => {
    if (!online) return 'Scale Offline'
    if (safeWeight === 0) return 'Place item on scale'
    if (safeWeight < toleranceLow) return 'Add more material'
    if (safeWeight > toleranceHigh) return 'Remove excess material'
    return stable ? 'Weight captured' : 'Within range · stabilizing'
  })()

  const containerClass = containerAccentByState[weightState] ?? containerAccentByState.idle
  const fillClass = progressFillByState[weightState] ?? progressFillByState.idle

  // Tolerance zone colors based on state
  const getToleranceColors = () => {
    // Gray/neutral when offline or no weight
    if (!online || safeWeight === 0) {
      return {
        border: '#9ca3af', // gray-400
        background: 'rgba(156, 163, 175, 0.15)', // gray-400 with low opacity
        glow: '0 0 8px rgba(156, 163, 175, 0.3), inset 0 0 6px rgba(156, 163, 175, 0.1)',
      }
    }
    // Green when in range
    if (isInRange) {
      return {
        border: '#4ade80', // green-400
        background: 'rgba(74, 222, 128, 0.25)',
        glow: '0 0 20px rgba(74, 222, 128, 0.6), inset 0 0 15px rgba(74, 222, 128, 0.3)',
      }
    }
    // Amber/red when out of range
    return {
      border: '#fbbf24', // amber-400
      background: 'rgba(251, 191, 36, 0.25)',
      glow: '0 0 20px rgba(251, 191, 36, 0.6), inset 0 0 15px rgba(251, 191, 36, 0.3)',
    }
  }

  const toleranceColors = getToleranceColors()

  const renderScaleButton = (scale: ScaleKey, label: string) => {
    const isActive = selectedScale === scale
    const scaleStatus = scaleStatuses[scale] ?? { online: false, stable: false }
    const baseClasses =
      'inline-flex h-20 w-40 items-center justify-center rounded-lg border-2 text-2xl font-bold uppercase tracking-wide transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 btn-scale-hover'

    if (!scaleStatus.online) {
      return (
        <Button
          key={scale}
          type="button"
          disabled
          className={`${baseClasses} border-border-main bg-border-main/50 text-text-primary/40 cursor-not-allowed`}
        >
          {label}
        </Button>
      )
    }

    if (isActive) {
      return (
        <Button
          key={scale}
          type="button"
          onClick={() => onScaleChange(scale)}
          className={`${baseClasses} border-accent-green bg-accent-green text-white shadow-button-green hover:bg-accent-green/80 hover:shadow-button-green-hover focus-visible:ring-accent-green`}
        >
          {label}
        </Button>
      )
    }

    return (
      <Button
        key={scale}
        type="button"
        onClick={() => onScaleChange(scale)}
        className={`${baseClasses} border-border-main bg-surface text-text-primary hover:bg-white hover:border-brand-primary/30 focus-visible:ring-brand-primary`}
      >
        {label}
      </Button>
    )
  }

  return (
    <section
      className={`scale-display-glow rounded-lg border-2 bg-gradient-to-br from-brand-primary/95 via-brand-primary to-brand-primary/90 px-6 py-5 text-white transition-all ${containerClass}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex min-w-[220px] flex-col gap-3">
          <span className="inline-flex items-center gap-3 font-heading text-base font-semibold uppercase tracking-wide text-white">
            <span className={`h-3 w-3 rounded-full ${online ? 'bg-accent-green' : 'bg-danger'}`} />
            {statusMessage.toUpperCase()}
          </span>
          <div className="flex items-baseline gap-2">
            <span
              className="font-body text-5xl font-bold leading-none tabular-nums text-cyan-50 drop-shadow-[0_2px_8px_rgba(6,182,212,0.4)]"
              style={{ fontFeatureSettings: '"tnum", "lnum"', letterSpacing: '-0.02em' }}
            >
              {safeWeight.toFixed(3)}
            </span>
            <span className="font-heading text-lg font-semibold uppercase tracking-wider text-white/80">
              KG
            </span>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3">
          <div className="relative h-16 overflow-hidden rounded-lg border-2 border-white/30 bg-white/15 shadow-inner">
            {/* Weight fill bar */}
            <div
              className={`absolute inset-y-1 left-0 rounded-lg ${fillClass} transition-all duration-200`}
              style={{ width: `${percentage}%` }}
            />

            {/* Min tolerance marker (left boundary) */}
            {toleranceHigh > 0 && (
              <div
                className="pointer-events-none absolute top-0 bottom-0 w-1 bg-gradient-to-b from-accent-gold via-accent-gold to-accent-gold/50 shadow-lg"
                style={{ left: `${toleranceMinPosition}%`, zIndex: 10 }}
              >
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-accent-gold/90 rounded text-[10px] font-bold text-white whitespace-nowrap shadow-md">
                  {toleranceLow.toFixed(3)}
                </div>
              </div>
            )}

            {/* Max tolerance marker (right boundary) */}
            {toleranceHigh > 0 && (
              <div
                className="pointer-events-none absolute top-0 bottom-0 w-1 bg-gradient-to-b from-accent-gold via-accent-gold to-accent-gold/50 shadow-lg"
                style={{ left: `${toleranceMaxPosition}%`, zIndex: 10 }}
              >
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-accent-gold/90 rounded text-[10px] font-bold text-white whitespace-nowrap shadow-md">
                  {toleranceHigh.toFixed(3)}
                </div>
              </div>
            )}

          </div>
        </div>

        <div className="flex items-center gap-2">
          {renderScaleButton('small', 'Small')}
          {renderScaleButton('big', 'Big')}
        </div>
      </div>
    </section>
  )
})
