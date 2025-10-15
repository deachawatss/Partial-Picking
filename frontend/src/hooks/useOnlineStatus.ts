import { useState, useEffect } from 'react'

/**
 * Offline Detection Hook
 *
 * Tracks network connectivity status using browser's navigator.onLine API
 * and window online/offline events.
 *
 * Constitutional Requirements:
 * - Real-time network status detection
 * - Weight operations disabled when offline
 * - Offline banner visible when offline
 *
 * @returns {boolean} isOnline - Current network connectivity status
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const isOnline = useOnlineStatus();
 *
 *   return (
 *     <div>
 *       {!isOnline && <OfflineBanner />}
 *       <button disabled={!isOnline}>Save Pick</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useOnlineStatus(): boolean {
  // Initialize with current online status
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    // Check if window is defined (SSR safety)
    if (typeof window === 'undefined') {
      return true // Assume online in SSR
    }
    return navigator.onLine
  })

  useEffect(() => {
    // Skip if window is not defined (SSR)
    if (typeof window === 'undefined') {
      return
    }

    /**
     * Handle online event
     * Fired when browser gains network connection
     */
    const handleOnline = () => {
      setIsOnline(true)
    }

    /**
     * Handle offline event
     * Fired when browser loses network connection
     */
    const handleOffline = () => {
      setIsOnline(false)
    }

    // Register event listeners
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Cleanup: Remove event listeners on unmount
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}

/**
 * Type-safe export
 */
export default useOnlineStatus
