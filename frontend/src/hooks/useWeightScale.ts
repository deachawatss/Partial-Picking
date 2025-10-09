/**
 * useWeightScale Hook
 *
 * T073: WebSocket integration with existing bridge service for real-time weight updates
 *
 * Constitutional Requirements:
 * - <200ms latency using React 19 useTransition for concurrent rendering
 * - Dual scale support (small/big) with independent state
 * - Auto-reconnection with exponential backoff (1s, 2s, 4s, max 10s)
 * - Graceful offline handling
 *
 * Bridge Service Protocol (from websocket.md):
 * - Endpoint: ws://localhost:5000/ws/scale/{scaleType}
 * - Message types: weightUpdate, scaleOffline, scaleOnline, error
 * - Continuous mode: Auto-started on connection (100ms polling)
 *
 * @example
 * const { weight, stable, online, isPending } = useWeightScale('small');
 */

import { useState, useEffect, useTransition, useCallback, useRef } from 'react'
import { config as appConfig } from '@/config'

/**
 * WebSocket message types from bridge service
 */
type WebSocketMessageType = 'weight' | 'status' | 'error'

interface BaseMessage {
  type: WebSocketMessageType
  data?: unknown
}

interface WeightMessage extends BaseMessage {
  type: 'weight'
  data: {
    scaleId: string
    weight: number
    unit: string
    stable: boolean
    timestamp: number
  }
}

interface StatusMessage extends BaseMessage {
  type: 'status'
  data: {
    scaleId: string
    connected: boolean
    port?: string
    error?: string | null
  }
}

interface ErrorMessage extends BaseMessage {
  type: 'error'
  data?: {
    code?: string
    message?: string
    scaleId?: string
    details?: Record<string, unknown>
  }
}

type WebSocketMessage = WeightMessage | StatusMessage | ErrorMessage | BaseMessage

/**
 * Hook configuration
 */
interface UseWeightScaleConfig {
  /** Enable automatic reconnection (default: true) */
  autoReconnect?: boolean
  /** Maximum reconnection attempts (default: 10) */
  maxReconnectAttempts?: number
  /** Enable debug logging (default: false) */
  debug?: boolean
}

/**
 * Hook return value
 */
interface UseWeightScaleReturn {
  /** Current weight reading in KG */
  weight: number
  /** Weight is stable (ready to save) */
  stable: boolean
  /** Bridge service and scale hardware are online */
  online: boolean
  /** React 19 transition pending state (weight update in progress) */
  isPending: boolean
  /** Last error message */
  error: string | null
  /** Manually reconnect to bridge service */
  reconnect: () => void
  /** Clear error message */
  clearError: () => void
}

/**
 * React 19 WebSocket hook for real-time weight scale integration
 *
 * Uses useTransition for non-blocking concurrent rendering to achieve <200ms latency
 * Auto-reconnects with exponential backoff when connection lost
 *
 * @param scaleType - Scale type: 'small' or 'big'
 * @param config - Optional hook configuration
 * @returns Weight scale state and controls
 */
export function useWeightScale(
  scaleType: 'small' | 'big',
  hookConfig: UseWeightScaleConfig = {}
): UseWeightScaleReturn {
  const { autoReconnect = true, maxReconnectAttempts = 10, debug = false } = hookConfig

  // State
  const [weight, setWeight] = useState<number>(0)
  const [stable, setStable] = useState<boolean>(false)
  const [online, setOnline] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // React 19: Concurrent rendering for non-blocking weight updates
  const [isPending, startTransition] = useTransition()

  // Refs for WebSocket and reconnection state
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef<number>(0)
  const mountedRef = useRef<boolean>(true)

  /**
   * Log debug messages
   */
  const log = useCallback(
    (...args: unknown[]) => {
      if (debug) {
        console.log(`[useWeightScale:${scaleType}]`, ...args)
      }
    },
    [debug, scaleType]
  )

  /**
   * Clear error message
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  /**
   * Calculate exponential backoff delay
   */
  const getReconnectDelay = useCallback((): number => {
    const baseDelay = 1000 // 1 second
    const maxDelay = 10000 // 10 seconds
    const delay = Math.min(baseDelay * Math.pow(2, reconnectAttemptsRef.current), maxDelay)
    return delay
  }, [])

  /**
   * Connect to bridge service WebSocket
   */
  const connect = useCallback(() => {
    if (!mountedRef.current) {
      return
    }

    // Clear any pending reconnection timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    // Get bridge URL from environment

    const fallbackBaseUrl =
      import.meta.env.VITE_BRIDGE_WS_URL || `${appConfig.bridge.protocol}://${appConfig.bridge.host}:${appConfig.bridge.port}`

    const wsUrl =
      appConfig.bridge && typeof appConfig.bridge.getScaleUrl === 'function'
        ? appConfig.bridge.getScaleUrl(scaleType)
        : `${fallbackBaseUrl.replace(/\/+$/, '')}/ws/scale/${scaleType}`

    log('Connecting to bridge service:', wsUrl)

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      /**
       * Connection opened
       */
      ws.onopen = () => {
        // Guard 1: Don't execute if component unmounted during connection
        if (!mountedRef.current) {
          log('Component unmounted during connection, closing WebSocket')
          ws.close()
          return
        }

        // Guard 2: Verify WebSocket is actually open (prevent StrictMode race condition)
        if (ws.readyState !== WebSocket.OPEN) {
          log('WebSocket not in OPEN state during onopen callback, skipping initialization')
          return
        }

        log('Connected to bridge service')
        setOnline(true)
        setError(null)
        reconnectAttemptsRef.current = 0

        // Continuous mode auto-starts on bridge service
        // No need to send startContinuous message
      }

      /**
       * Message received from bridge service
       */
      ws.onmessage = (event: MessageEvent) => {
        if (!mountedRef.current) {
          return
        }

        try {
          const message: WebSocketMessage = JSON.parse(event.data)

          // Handle message types
          switch (message.type) {
            case 'weight': {
              const weightMsg = message as WeightMessage

              // Calculate latency for performance monitoring
              const receiveTime = Date.now()
              const latency = receiveTime - weightMsg.data.timestamp

              // Only warn about high latency for recent messages (< 5 seconds old)
              // Initial cached messages may have old timestamps
              if (latency > 200 && latency < 5000) {
                console.warn(
                  `[useWeightScale:${scaleType}] High latency detected: ${latency}ms (threshold: 200ms)`
                )
              }

              // React 19: Use startTransition for concurrent, non-blocking update
              // This ensures <200ms latency even with 10+ updates/second
              startTransition(() => {
                setWeight(weightMsg.data.weight)
                setStable(weightMsg.data.stable)
              })

              // Only log unstable weights to reduce console spam
              if (!weightMsg.data.stable) {
                log(
                  'Weight update (unstable):',
                  weightMsg.data.weight,
                  weightMsg.data.unit,
                  'latency:',
                  latency,
                  'ms'
                )
              }
              break
            }

            case 'status': {
              const statusMsg = message as StatusMessage

              if (statusMsg.data.connected) {
                log('Scale online:', statusMsg.data.port)
                setOnline(true)
                setError(null)
              } else {
                const reason = statusMsg.data.error || 'Unknown reason'
                log('Scale offline:', reason)
                setOnline(false)
                setError(`Scale offline: ${reason}`)
              }
              break
            }

            case 'error': {
              const errorMsg = message as ErrorMessage
              const errorCode = errorMsg.data?.code || 'ERROR'
              const errorMessage = errorMsg.data?.message || 'Unknown error'
              log('Bridge error:', errorCode, errorMessage)
              setError(`${errorCode}: ${errorMessage}`)
              break
            }

            default:
              log('Unknown message type:', (message as BaseMessage).type)
          }
        } catch (err) {
          console.error(`[useWeightScale:${scaleType}] Failed to parse message:`, err)
        }
      }

      /**
       * Connection error
       */
      ws.onerror = (event: Event) => {
        if (!mountedRef.current) {
          return
        }

        log('WebSocket error:', event)
        setOnline(false)
        setError('WebSocket connection error')
      }

      /**
       * Connection closed
       */
      ws.onclose = (event: CloseEvent) => {
        if (!mountedRef.current) {
          return
        }

        log('WebSocket closed:', event.code, event.reason)
        setOnline(false)

        // Auto-reconnect with exponential backoff
        if (autoReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = getReconnectDelay()
          reconnectAttemptsRef.current++

          log(
            `Reconnecting in ${delay}ms... (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
          )

          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              connect()
            }
          }, delay)
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          setError('Max reconnection attempts reached. Please refresh the page.')
          log('Max reconnection attempts reached')
        }
      }
    } catch (err) {
      console.error(`[useWeightScale:${scaleType}] Connection failed:`, err)
      setError('Failed to connect to bridge service')
      setOnline(false)
    }
  }, [scaleType, autoReconnect, maxReconnectAttempts, getReconnectDelay, log])

  /**
   * Manual reconnect (resets attempt counter)
   */
  const reconnect = useCallback(() => {
    log('Manual reconnect requested')

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    // Clear reconnection timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    // Reset attempt counter
    reconnectAttemptsRef.current = 0
    setError(null)

    // Reconnect
    connect()
  }, [connect, log])

  /**
   * Connect on mount
   */
  useEffect(() => {
    mountedRef.current = true
    connect()

    /**
     * Cleanup on unmount
     */
    return () => {
      // Set unmounted flag FIRST to prevent callbacks from executing
      mountedRef.current = false

      // Close WebSocket only if OPEN (not CONNECTING)
      // This prevents "WebSocket is closed before connection is established" error
      // that occurs during React StrictMode double-invocation in development
      if (wsRef.current) {
        const readyState = wsRef.current.readyState

        // Only close if OPEN (1) - let CONNECTING finish or fail naturally
        // CLOSING (2) or CLOSED (3) - already closing/closed, skip
        if (readyState === WebSocket.OPEN) {
          log('Closing WebSocket (readyState: OPEN)')
          wsRef.current.close()
        } else {
          log('Skipping WebSocket close (readyState:', readyState, '- will handle naturally)')
        }

        wsRef.current = null
      }

      // Clear reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }

      log('Cleanup complete')
    }
  }, [connect, log])

  return {
    weight,
    stable,
    online,
    isPending,
    error,
    reconnect,
    clearError,
  }
}
