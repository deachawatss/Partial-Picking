import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * PWA Install Prompt Component
 *
 * Captures the browser's `beforeinstallprompt` event and displays
 * a custom "Install App" button when the app is installable.
 *
 * Features:
 * - Listens for beforeinstallprompt event
 * - Shows floating install button in bottom-right corner
 * - Handles install confirmation
 * - Hides button after successful install
 * - Dismissible by user
 *
 * Browser Support:
 * - Chrome/Edge: Full support
 * - Safari iOS: Uses Add to Home Screen (no beforeinstallprompt)
 * - Firefox: Limited PWA support
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the default browser prompt
      e.preventDefault()

      // Store the event for later use
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowPrompt(true)

      console.log('[PWA] Install prompt available')
    }

    // Listen for app installed event
    const handleAppInstalled = () => {
      console.log('[PWA] App installed successfully')
      setShowPrompt(false)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    // Cleanup listeners on unmount
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      console.warn('[PWA] No install prompt available')
      return
    }

    try {
      // Show the browser's install prompt
      await deferredPrompt.prompt()

      // Wait for the user's response
      const { outcome } = await deferredPrompt.userChoice

      if (outcome === 'accepted') {
        console.log('[PWA] User accepted install prompt')
      } else {
        console.log('[PWA] User dismissed install prompt')
      }

      // Clear the deferred prompt (can only be used once)
      setDeferredPrompt(null)
      setShowPrompt(false)
    } catch (error) {
      console.error('[PWA] Error showing install prompt:', error)
    }
  }

  const handleDismiss = () => {
    setShowPrompt(false)
  }

  // Don't render if prompt shouldn't be shown
  if (!showPrompt || !deferredPrompt) {
    return null
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-50 bg-white rounded-lg shadow-2xl border border-gray-200 p-4 max-w-sm animate-slide-up"
      role="dialog"
      aria-labelledby="pwa-install-title"
      aria-describedby="pwa-install-description"
    >
      {/* Close button */}
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Dismiss install prompt"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Content */}
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 w-12 h-12 bg-[#3A2920] rounded-lg flex items-center justify-center">
          <Download className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <h3 id="pwa-install-title" className="font-bold text-gray-900 mb-1">
            Install Partial Picking
          </h3>
          <p id="pwa-install-description" className="text-sm text-gray-600">
            Install the app for faster access and offline support
          </p>
        </div>
      </div>

      {/* Install button */}
      <Button
        onClick={handleInstallClick}
        className="w-full bg-[#3A2920] hover:bg-[#2B1C14] text-white font-semibold"
      >
        <Download className="w-4 h-4 mr-2" />
        Install App
      </Button>
    </div>
  )
}
