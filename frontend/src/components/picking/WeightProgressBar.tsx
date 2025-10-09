import { Button } from '@/components/ui/button'

type ScaleKey = 'small' | 'big'

interface ScaleStatus {
  online: boolean
  stable: boolean
}

interface WeightProgressBarProps {
  /** Current live weight from the selected scale */
  weight: number
  /** Target weight in KG */
  targetWeight: number
  /** Allowed ± tolerance in KG */
  tolerance: number
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

export function WeightProgressBar({
  weight,
  targetWeight,
  tolerance,
  selectedScale,
  onScaleChange,
  scaleStatuses,
  workstationLabel: _workstationLabel,
}: WeightProgressBarProps) {
  const safeWeight = Number.isFinite(weight) ? weight : 0
  const safeTarget = targetWeight > 0 ? targetWeight : 0
  const safeTolerance = tolerance > 0 ? tolerance : 0

  const toleranceLow = Math.max(safeTarget - safeTolerance, 0)
  const toleranceHigh = safeTarget + safeTolerance

  // Position the acceptable tolerance range at 60-70% of the bar width
  // This ensures consistent visual positioning regardless of actual weight values
  const TOLERANCE_POSITION = 0.65 // Position center of tolerance at 65% of bar
  const maxForScale = safeTarget > 0
    ? Math.max(toleranceHigh / TOLERANCE_POSITION, 50) // Scale so high tolerance is at ~65%
    : 50 // Default 50 KG when no target selected

  const percentage = clamp((safeWeight / maxForScale) * 100, 0, 100)
  const toleranceStart = clamp((toleranceLow / maxForScale) * 100, 0, 100)
  const toleranceEnd = clamp((toleranceHigh / maxForScale) * 100, 0, 100)
  const toleranceSpanPercent = clamp(toleranceEnd - toleranceStart, 0, 100)
  const toleranceSpanClamped = clamp(toleranceSpanPercent, 1, 100 - toleranceStart)

  // Tolerance marker positions (vertical lines at min/max boundaries)
  const toleranceMinPosition = toleranceStart
  const toleranceMaxPosition = toleranceEnd

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
  const toleranceBorderColor = isInRange ? '#4ade80' : '#fbbf24'
  const toleranceBackgroundColor = isInRange
    ? 'rgba(74, 222, 128, 0.25)'
    : 'rgba(251, 191, 36, 0.25)'
  const toleranceGlowEffect = isInRange
    ? '0 0 16px rgba(74, 222, 128, 0.5), inset 0 0 12px rgba(74, 222, 128, 0.2)'
    : '0 0 16px rgba(251, 191, 36, 0.5), inset 0 0 12px rgba(251, 191, 36, 0.2)'

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

            {/* Tolerance zone (acceptable range) */}
            <div
              className="pointer-events-none absolute top-1/2 h-14 -translate-y-1/2 rounded-md"
              style={{
                left: `${toleranceStart}%`,
                width: `${toleranceSpanClamped}%`,
                border: `3px solid ${isInRange ? '#4ade80' : '#fbbf24'}`,
                backgroundColor: isInRange ? 'rgba(74, 222, 128, 0.25)' : 'rgba(251, 191, 36, 0.25)',
                boxShadow: isInRange
                  ? '0 0 20px rgba(74, 222, 128, 0.6), inset 0 0 15px rgba(74, 222, 128, 0.3)'
                  : '0 0 20px rgba(251, 191, 36, 0.6), inset 0 0 15px rgba(251, 191, 36, 0.3)',
                zIndex: 5,
              }}
            />

            {/* Min tolerance marker (left boundary) */}
            {safeTarget > 0 && (
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
            {safeTarget > 0 && (
              <div
                className="pointer-events-none absolute top-0 bottom-0 w-1 bg-gradient-to-b from-accent-gold via-accent-gold to-accent-gold/50 shadow-lg"
                style={{ left: `${toleranceMaxPosition}%`, zIndex: 10 }}
              >
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-accent-gold/90 rounded text-[10px] font-bold text-white whitespace-nowrap shadow-md">
                  {toleranceHigh.toFixed(3)}
                </div>
              </div>
            )}

            {/* Target weight indicator (center line) */}
            {safeTarget > 0 && (
              <div
                className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-white shadow-lg"
                style={{ left: `${(safeTarget / maxForScale) * 100}%`, zIndex: 20 }}
              >
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-white/95 rounded text-[10px] font-bold text-brand-primary whitespace-nowrap shadow-md border border-brand-primary/20">
                  Target: {safeTarget.toFixed(3)}
                </div>
              </div>
            )}

            {/* 50% reference line (midpoint) */}
            <span
              className="pointer-events-none absolute top-1/2 h-14 w-0.5 -translate-y-1/2 bg-white/40"
              style={{ left: '50%', zIndex: 1 }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {renderScaleButton('small', 'Small')}
          {renderScaleButton('big', 'Big')}
        </div>
      </div>
    </section>
  )
}
