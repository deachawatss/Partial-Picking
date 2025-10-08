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
  offline: 'bg-gradient-to-r from-[#715038] via-[#5a3c26] to-[#402716]',
  idle: 'bg-gradient-to-r from-[#efe4d4] via-[#e3c8a1] to-[#d5a772]',
  under: 'bg-gradient-to-r from-[#ff9d6c] via-[#ff7f66] to-[#e44c4c]',
  approaching: 'bg-gradient-to-r from-[#ffd083] via-[#f0b429] to-[#dc9630]',
  good: 'bg-gradient-to-r from-[#7ad48d] via-[#49b072] to-[#2f7a52]',
  over: 'bg-gradient-to-r from-[#ff9d6c] via-[#ff6f61] to-[#d84343]',
}

const statusBadgeByState: Record<string, string> = {
  offline: 'bg-white/10 text-cream/60 border border-white/10',
  idle: 'bg-cream/10 text-cream',
  under: 'bg-[#ff6f61]/20 text-[#ff6f61]',
  approaching: 'bg-[#f0b429]/20 text-[#f0b429]',
  good: 'bg-[#2f7a52]/25 text-[#c8f1d6]',
  over: 'bg-[#ff6f61]/25 text-[#ffd9d4]',
}

const containerAccentByState: Record<string, string> = {
  offline: 'border-[#7b4c31]/40 shadow-[0_10px_24px_rgba(52,33,20,0.25)]',
  idle: 'border-[#b8865f]/40 shadow-[0_12px_28px_rgba(102,69,42,0.18)]',
  under: 'border-[#ff6f61]/50 shadow-[0_14px_30px_rgba(255,111,97,0.25)]',
  approaching: 'border-[#f0b429]/50 shadow-[0_14px_30px_rgba(240,180,41,0.25)]',
  good: 'border-[#2f7a52]/60 shadow-[0_16px_32px_rgba(47,122,82,0.32)]',
  over: 'border-[#ff6f61]/60 shadow-[0_16px_32px_rgba(255,111,97,0.32)]',
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
  const maxForScale = Math.max(toleranceHigh * 1.25, safeTarget + safeTolerance * 2, 5)

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
      'inline-flex h-14 min-w-[150px] items-center justify-center rounded-full border-2 px-8 text-base font-bold uppercase transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#4a2d1a]'

    if (!scaleStatus.online) {
      return (
        <Button
          key={scale}
          type="button"
          disabled
          className={`${baseClasses} border-white/10 bg-white/10 text-white/40 cursor-not-allowed`}
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
          className={`${baseClasses} border-[#c8f1d6]/70 bg-[#2f7a52] text-white shadow-[0_12px_24px_rgba(47,122,82,0.35)] hover:bg-[#296847]`}
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
        className={`${baseClasses} border-white/25 bg-white/10 text-white/80 hover:bg-white/20 hover:text-white`}
      >
        {label}
      </Button>
    )
  }

  return (
    <section
      className={`rounded-[32px] border bg-gradient-to-br from-[#3a200f] via-[#4a2d1a] to-[#221006] px-6 py-5 text-white transition-all ${containerClass}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex min-w-[220px] flex-col gap-3">
          <span className="inline-flex items-center gap-3 font-sans text-base font-semibold uppercase tracking-[0.16em] text-white">
            <span className={`h-3 w-3 rounded-full ${online ? 'bg-[#9cf3b4]' : 'bg-[#ff8e7a]'}`} />
            {statusMessage.toUpperCase()}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-4xl font-extrabold leading-none tabular-nums">
              {safeWeight.toFixed(4)}
            </span>
            <span className="font-sans text-base font-semibold uppercase tracking-[0.18em] text-white/70">
              KG
            </span>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3">
          <div className="relative h-16 overflow-hidden rounded-full border-2 border-white/20 bg-white/10">
            <div
              className={`absolute inset-y-1 left-0 rounded-full ${fillClass} transition-all duration-150`}
              style={{ width: `${percentage}%` }}
            />
            <span
              className="pointer-events-none absolute top-1/2 h-14 w-1 -translate-y-1/2 bg-white/70"
              style={{ left: '50%' }}
            />
            <div
              className="pointer-events-none absolute top-1/2 h-14 -translate-y-1/2 rounded border-l-[6px] border-r-[6px]"
              style={{
                left: `${toleranceStart}%`,
                width: `${toleranceSpanClamped}%`,
                borderColor: toleranceBorderColor,
                backgroundColor: toleranceBackgroundColor,
                boxShadow: toleranceGlowEffect,
              }}
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
