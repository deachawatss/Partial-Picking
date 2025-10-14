import { useEffect } from 'react'
import { CheckCircle2 } from 'lucide-react'

interface SuccessFlashProps {
  /** Display the flash */
  show: boolean
  /** Message to display (optional) */
  message?: string
  /** Duration in milliseconds */
  duration?: number
  /** Callback when flash completes */
  onComplete?: () => void
}

/**
 * SuccessFlash Component
 *
 * Displays a brief animated success message with checkmark icon.
 * Uses GPU-accelerated animations for smooth performance.
 *
 * @example
 * ```tsx
 * const [showSuccess, setShowSuccess] = useState(false)
 *
 * // After successful save
 * setShowSuccess(true)
 *
 * <SuccessFlash
 *   show={showSuccess}
 *   message="Pick saved successfully!"
 *   onComplete={() => setShowSuccess(false)}
 * />
 * ```
 */
export function SuccessFlash({
  show,
  message = 'Success!',
  duration = 2000,
  onComplete
}: SuccessFlashProps) {
  // Auto-dismiss timer - parent controls visibility via show prop
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onComplete?.()
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [show, duration, onComplete])

  if (!show) return null

  return (
    <div
      className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300"
      role="alert"
      aria-live="polite"
    >
      <div className="toast-success rounded-lg px-6 py-4 shadow-elevated-3 flex items-center gap-3 min-w-[280px]">
        <CheckCircle2
          className="w-6 h-6 flex-shrink-0 gpu-accelerated"
          strokeWidth={2.5}
          aria-hidden="true"
        />
        <p className="font-semibold text-base">{message}</p>
      </div>
    </div>
  )
}
