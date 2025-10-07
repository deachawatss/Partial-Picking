import { useOnlineStatus } from '@/hooks/useOnlineStatus'

/**
 * Connection Status Component
 *
 * Displays real-time status of:
 * - Network connectivity (online/offline)
 * - Backend API connectivity
 * - WebSocket connection
 *
 * Constitutional Requirements:
 * - Offline banner visible when offline
 * - Weight operations disabled when offline
 * - Real-time status updates
 *
 * @param backendOnline - Backend API connectivity status
 * @param websocketOnline - WebSocket connection status
 * @param offlineMode - Legacy offline mode flag (deprecated - use network status instead)
 */
interface ConnectionStatusProps {
  backendOnline: boolean
  websocketOnline: boolean
  offlineMode?: boolean // Optional - network status takes precedence
}

export function ConnectionStatus({
  backendOnline,
  websocketOnline,
  offlineMode = false,
}: ConnectionStatusProps) {
  // Real-time network connectivity detection
  const isOnline = useOnlineStatus()

  const getStatusColor = (online: boolean) => (online ? 'bg-green-500' : 'bg-red-500')

  // Determine overall offline status (network OR backend)
  const isSystemOffline = !isOnline || offlineMode

  return (
    <>
      {/* Offline Banner (Fixed top, red background) */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white px-4 py-3 shadow-lg">
          <div className="flex items-center justify-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1 text-center">
              <p className="font-bold text-lg">You are offline</p>
              <p className="text-sm opacity-90">
                Weight operations disabled. Cached data available.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Connection Status Panel */}
      <div
        className={`fixed ${!isOnline ? 'top-20' : 'top-4'} right-4 z-40 bg-white rounded-lg shadow-lg border p-3 min-w-[200px] transition-all duration-300`}
      >
        <h3 className="text-xs font-bold text-gray-700 mb-2">System Status</h3>

        <div className="space-y-2 text-xs">
          {/* Network Status */}
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Network</span>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${getStatusColor(isOnline)}`} />
              <span className={isOnline ? 'text-green-700' : 'text-red-700'}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>

          {/* Backend API Status */}
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Backend API</span>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${getStatusColor(backendOnline && isOnline)}`}
              />
              <span className={backendOnline && isOnline ? 'text-green-700' : 'text-red-700'}>
                {!isOnline ? 'Offline (Network)' : backendOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>

          {/* WebSocket Status */}
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Weight Scale</span>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${getStatusColor(websocketOnline && isOnline)}`}
              />
              <span className={websocketOnline && isOnline ? 'text-green-700' : 'text-red-700'}>
                {!isOnline ? 'Offline (Network)' : websocketOnline ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>

          {/* Offline Mode Warning */}
          {isSystemOffline && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <div className="flex items-center gap-2 text-red-700 bg-red-50 p-2 rounded">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="font-medium">Offline Mode Active</span>
              </div>
              <div className="mt-2 text-xs text-gray-600">
                <ul className="list-disc list-inside space-y-1">
                  <li>Weight operations disabled</li>
                  <li>Last 5 runs cached</li>
                  <li>No new picks allowed</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
