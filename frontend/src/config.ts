/**
 * Frontend Configuration
 *
 * Loads environment variables from .env file (prefixed with VITE_)
 * Provides type-safe access to configuration values
 */

function normalizeBaseUrl(url: string): string {
  if (!url) {
    return url
  }
  return url.replace(/\/+$/, '')
}

function joinUrl(base: string, path: string): string {
  const normalizedBase = normalizeBaseUrl(base)
  const normalizedPath = path.replace(/^\/+/, '')
  return `${normalizedBase}/${normalizedPath}`
}

function detectIsWsl2Host(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const hostname = window?.location?.hostname
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') {
    return false
  }

  // Detect WSL2 IP range (172.16.0.0/12)
  return /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
}

function resolveBridgeBaseUrl(): string {
  const explicitUrl = import.meta.env.VITE_BRIDGE_WS_URL?.trim()
  if (explicitUrl) {
    return normalizeBaseUrl(explicitUrl)
  }

  const protocol = import.meta.env.VITE_BRIDGE_PROTOCOL || 'ws'
  const port = (import.meta.env.VITE_BRIDGE_PORT || '5000').toString().trim()

  const isWsl2 = detectIsWsl2Host()
  const defaultHost = isWsl2 ? '10.255.255.254' : 'localhost'
  const hostOverride = isWsl2
    ? import.meta.env.VITE_BRIDGE_WSL_HOST?.trim()
    : import.meta.env.VITE_BRIDGE_HOST?.trim()

  const host = hostOverride && hostOverride.length > 0 ? hostOverride : defaultHost
  const portSegment = port.length > 0 ? `:${port.replace(/^:/, '')}` : ''

  return `${protocol}://${host}${portSegment}`
}

const bridgeBaseUrl = resolveBridgeBaseUrl()

let resolvedBridgeProtocol = 'ws'
let resolvedBridgeHost = 'localhost'
let resolvedBridgePort = 5000

try {
  const bridgeUrl = new URL(bridgeBaseUrl.startsWith('ws') ? bridgeBaseUrl : `ws://${bridgeBaseUrl}`)
  resolvedBridgeProtocol = bridgeUrl.protocol.replace(':', '') || 'ws'
  resolvedBridgeHost = bridgeUrl.hostname || 'localhost'
  const portValue = bridgeUrl.port
  if (portValue) {
    const parsedPort = Number.parseInt(portValue, 10)
    if (!Number.isNaN(parsedPort)) {
      resolvedBridgePort = parsedPort
    }
  } else {
    resolvedBridgePort = resolvedBridgeProtocol === 'wss' ? 443 : 80
  }
} catch (error) {
  console.warn('[config] Failed to parse bridge URL, using defaults:', error)
}

export const config = {
  // Environment
  env: import.meta.env.VITE_APP_ENV || 'development',
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,

  // API Configuration
  api: {
    baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:7075/api',
    protocol: import.meta.env.VITE_BACKEND_PROTOCOL || 'http',
    host: import.meta.env.VITE_BACKEND_HOST || 'localhost',
    port: parseInt(import.meta.env.VITE_BACKEND_PORT || '7075'),
    timeout: parseInt(import.meta.env.VITE_API_TIMEOUT_MS || '10000'),
  },

  // Bridge Service (WebSocket for Weight Scales)
  bridge: {
    protocol: resolvedBridgeProtocol,
    host: resolvedBridgeHost,
    port: resolvedBridgePort,
    wsUrl: bridgeBaseUrl,

    // WebSocket endpoints
    getScaleUrl: (scaleType: 'small' | 'big') => joinUrl(bridgeBaseUrl, `/ws/scale/${scaleType}`),
  },

  // Authentication
  auth: {
    tokenKey: import.meta.env.VITE_AUTH_TOKEN_KEY || 'pk_auth_token',
    userDataKey: import.meta.env.VITE_USER_DATA_KEY || 'pk_auth_user',
    sessionTimeoutHours: parseInt(import.meta.env.VITE_SESSION_TIMEOUT_HOURS || '168'),
  },

  // Application Info
  app: {
    name: import.meta.env.VITE_APP_NAME || 'Partial Picking System',
    version: import.meta.env.VITE_APP_VERSION || '1.0.0',
    company: import.meta.env.VITE_COMPANY_NAME || 'Newly Weds Foods Thailand',
  },

  // WebSocket Configuration
  // NOTE: Weight polling speed is controlled by Bridge Service (default 100ms)
  scale: {
    websocketReconnectIntervalMs: parseInt(
      import.meta.env.VITE_WEBSOCKET_RECONNECT_INTERVAL_MS || '3000'
    ),
    websocketMaxReconnectAttempts: parseInt(
      import.meta.env.VITE_WEBSOCKET_MAX_RECONNECT_ATTEMPTS || '10'
    ),
  },

  // Development Tools
  dev: {
    enableDevTools: import.meta.env.VITE_ENABLE_DEV_TOOLS === 'true',
  },
} as const

// Type-safe config access
export type Config = typeof config

export default config
