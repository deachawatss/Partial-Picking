/**
 * Frontend Configuration
 *
 * Loads environment variables from .env file (prefixed with VITE_)
 * Provides type-safe access to configuration values
 */

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
    protocol: import.meta.env.VITE_BRIDGE_PROTOCOL || 'ws',
    host: import.meta.env.VITE_BRIDGE_HOST || 'localhost',
    port: parseInt(import.meta.env.VITE_BRIDGE_PORT || '5000'),
    wsUrl: import.meta.env.VITE_BRIDGE_WS_URL || 'ws://localhost:5000',

    // WebSocket endpoints
    getScaleUrl: (scaleType: 'small' | 'big') =>
      `${import.meta.env.VITE_BRIDGE_WS_URL || 'ws://localhost:5000'}/ws/scale/${scaleType}`,
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

  // Weight Scale Configuration
  scale: {
    weightUpdateDebounceMs: parseInt(import.meta.env.VITE_WEIGHT_UPDATE_DEBOUNCE_MS || '50'),
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
