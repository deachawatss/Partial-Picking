import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import './styles/components.css'
import App from './App.tsx'
import { AuthProvider } from '@/contexts/AuthContext'
import { PickingProvider } from '@/contexts/PickingContext'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { registerSW } from 'virtual:pwa-register'

/**
 * Service Worker Registration
 *
 * Constitutional Requirements:
 * - Prompt user for updates (registerType: 'prompt')
 * - Handle offline mode gracefully
 * - Cache last 5 runs (FIFO)
 * - Network-first for API calls
 */

// Register service worker with update prompt
const updateSW = registerSW({
  onNeedRefresh() {
    // New version available - prompt user to update
    if (confirm('New version available! Reload to update?')) {
      updateSW(true) // Force reload and update
    }
  },
  onOfflineReady() {
    // App is ready for offline use
    console.log('[PWA] App ready for offline use')

    // Show user-friendly notification
    const offlineReady = document.createElement('div')
    offlineReady.className =
      'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
    offlineReady.textContent = '✓ App ready for offline use'
    document.body.appendChild(offlineReady)

    // Auto-remove after 3 seconds
    setTimeout(() => {
      offlineReady.remove()
    }, 3000)
  },
  onRegistered(registration) {
    // Service worker registered successfully
    console.log('[PWA] Service worker registered:', registration)
  },
  onRegisterError(error) {
    // Service worker registration failed
    console.error('[PWA] Service worker registration error:', error)
  },
})

// Log PWA status in development
if (import.meta.env.DEV) {
  console.log('[PWA] Development mode - Service worker enabled')
  console.log('[PWA] Update handler registered')
}

// Create QueryClient for TanStack Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PickingProvider>
            <App />
          </PickingProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
)
