/**
 * WeightProgressBar Component
 *
 * T074: Integrated with useWeightScale hook for real-time weight updates
 *
 * Features:
 * - Real-time weight display from WebSocket bridge service
 * - Color-coded status (red/yellow/green) based on tolerance and stability
 * - Stability indicator (⚖️ Stable / ⏳ Unstable)
 * - Online/offline indicator (🟢 Online / 🔴 Offline)
 * - Tare and reconnect controls
 */

import { Progress } from '@/components/ui/progress'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useWeightScale } from '@/hooks/useWeightScale'

interface WeightProgressBarProps {
  /** Scale type to connect to */
  scaleType: 'small' | 'big'
  /** Target weight in KG */
  targetWeight: number
  /** Tolerance in KG */
  tolerance: number
  /** Optional tare callback (resets weight to 0) */
  onTare?: () => void
  /** Optional weight use callback (when weight is stable and valid) */
  onUseWeight?: (weight: number) => void
}

export function WeightProgressBar({
  scaleType,
  targetWeight,
  tolerance,
  onTare,
  onUseWeight,
}: WeightProgressBarProps) {
  // T074: Connect to WebSocket bridge service for real-time weight updates
  const { weight, stable, online, isPending, error, reconnect, clearError } =
    useWeightScale(scaleType)

  // Calculate weight ranges
  const weightRangeLow = targetWeight - tolerance
  const weightRangeHigh = targetWeight + tolerance

  // Determine if weight is in range
  const isInRange = weight >= weightRangeLow && weight <= weightRangeHigh

  // Calculate progress percentage (0-100%)
  const progressPercentage = targetWeight > 0 ? Math.min((weight / targetWeight) * 100, 100) : 0

  // Can use weight (stable, in range, and online)
  const canUseWeight = online && stable && isInRange

  // Determine color coding based on tolerance and stability
  const getStatusColor = (): string => {
    if (!online) return 'bg-gray-400'
    if (!stable) return 'bg-yellow-500'
    if (isInRange && stable) return 'bg-green-500'
    return 'bg-red-500'
  }

  const getStatusText = (): string => {
    if (!online) return '🔴 Offline'
    if (!stable) return '⏳ Unstable'
    if (isInRange && stable) return '⚖️ Stable & Ready'
    if (weight < weightRangeLow) return '⚠️ Under Weight'
    if (weight > weightRangeHigh) return '⚠️ Over Weight'
    return '⚠️ Out of Tolerance'
  }

  const getBackgroundClass = (): string => {
    if (!online) return 'bg-gradient-to-r from-gray-500 to-gray-600'
    if (!stable) return 'bg-gradient-to-r from-yellow-500 to-yellow-600'
    if (isInRange && stable) return 'bg-gradient-to-r from-green-500 to-green-600'
    return 'bg-gradient-to-r from-red-500 to-red-600'
  }

  /**
   * Handle tare button click
   */
  const handleTare = () => {
    if (onTare) {
      onTare()
    }
    // Note: Actual tare would be sent to bridge service
    // For now, just call the callback
  }

  /**
   * Handle use weight button click
   */
  const handleUseWeight = () => {
    if (canUseWeight && onUseWeight) {
      onUseWeight(weight)
    }
  }

  return (
    <Card className={`p-6 text-white ${getBackgroundClass()} transition-all duration-300`}>
      {/* Status and Actions Row */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-4 h-4 rounded-full ${getStatusColor()} ${!stable && online ? 'animate-pulse' : ''}`}
            aria-label={stable ? 'Stable' : 'Not stable'}
            title={online ? (stable ? 'Weight stable' : 'Weight unstable') : 'Scale offline'}
          />
          <span className="text-sm font-medium">{getStatusText()}</span>
          {isPending && (
            <span className="text-xs opacity-75" title="Weight update in progress">
              (updating...)
            </span>
          )}
        </div>

        <div className="flex gap-2">
          {onTare && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTare}
              className="text-white border-white/50 hover:bg-white/20"
              disabled={!online}
              title="Reset scale to zero"
            >
              Tare
            </Button>
          )}
          {onUseWeight && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleUseWeight}
              className="text-white border-white/50 hover:bg-white/20"
              disabled={!canUseWeight}
              title={canUseWeight ? 'Use this weight' : 'Weight must be stable and in range'}
            >
              Use Weight
            </Button>
          )}
          {!online && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={reconnect}
              className="text-white border-white/50 hover:bg-white/20"
              title="Reconnect to scale"
            >
              Reconnect
            </Button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-2 bg-white/20 rounded text-xs flex justify-between items-center">
          <span>{error}</span>
          <button
            onClick={clearError}
            className="ml-2 font-bold hover:opacity-75"
            aria-label="Clear error"
          >
            ×
          </button>
        </div>
      )}

      {/* Weight Display */}
      <div className="text-center mb-4">
        <div className="text-4xl font-bold mb-2">
          {weight.toFixed(3)} kg / {targetWeight.toFixed(2)} kg
        </div>
        <div className="text-sm opacity-90">
          Tolerance: ±{tolerance.toFixed(2)} kg (Range: {weightRangeLow.toFixed(2)} -{' '}
          {weightRangeHigh.toFixed(2)} kg)
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative">
        <Progress value={progressPercentage} className="h-6 bg-white/30" />
        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
          {progressPercentage.toFixed(1)}%
        </div>
      </div>

      {/* Range Indicators */}
      <div className="flex justify-between text-xs mt-2 opacity-75">
        <span>Min: {weightRangeLow.toFixed(2)} kg</span>
        <span>Target: {targetWeight.toFixed(2)} kg</span>
        <span>Max: {weightRangeHigh.toFixed(2)} kg</span>
      </div>

      {/* Scale Type Indicator */}
      <div className="text-center text-xs mt-2 opacity-75">
        Scale: {scaleType.toUpperCase()} {online ? '🟢' : '🔴'}
      </div>
    </Card>
  )
}
