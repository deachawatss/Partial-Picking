/**
 * API Client with Authentication
 *
 * Axios instance configured with:
 * - Base URL from config (BACKEND_PORT=7075)
 * - Request interceptor: Add Authorization header from localStorage
 * - Response interceptor: Handle 401 errors → Refresh token or redirect
 * - Response interceptor: Handle network errors → Error toast
 *
 * Constitutional Requirement: Contract-first development
 * Validates against specs/001-i-have-an/contracts/openapi.yaml
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios'
import { config } from '@/config'
import { ErrorResponse } from '@/types/api'

/**
 * API Client Instance
 * Configured with base URL and timeout from environment
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: config.api.baseUrl,
  timeout: config.api.timeout,
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * Request Interceptor
 * Adds JWT token to Authorization header if available
 */
apiClient.interceptors.request.use(
  (requestConfig: InternalAxiosRequestConfig) => {
    // Get token from localStorage (stored by AuthContext)
    const token = localStorage.getItem(config.auth.tokenKey)

    // Add Authorization header if token exists
    if (token && requestConfig.headers) {
      requestConfig.headers.Authorization = `Bearer ${token}`
    }

    // Log request in development
    if (config.isDevelopment) {
      console.log(`[API] ${requestConfig.method?.toUpperCase()} ${requestConfig.url}`, {
        params: requestConfig.params,
        data: requestConfig.data,
      })
    }

    return requestConfig
  },
  (error: AxiosError) => {
    console.error('[API] Request error:', error)
    return Promise.reject(error)
  }
)

/**
 * Response Interceptor
 * Handles authentication errors and network failures
 */
apiClient.interceptors.response.use(
  response => {
    // Log successful response in development
    if (config.isDevelopment) {
      console.log(`[API] Response ${response.status}:`, response.data)
    }
    return response
  },
  async (error: AxiosError<ErrorResponse>) => {
    const originalRequest = error.config

    // Handle 401 Unauthorized errors
    if (error.response?.status === 401) {
      console.warn('[API] 401 Unauthorized - Token expired or invalid')

      // Clear authentication data
      localStorage.removeItem(config.auth.tokenKey)
      localStorage.removeItem(config.auth.userDataKey)

      // Redirect to login page (only if not already on login page)
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }

      return Promise.reject(error)
    }

    // Handle network errors
    if (!error.response) {
      console.error('[API] Network error - Backend server unreachable:', error.message)

      // Create user-friendly error message
      const networkError: ErrorResponse = {
        error: {
          code: 'NETWORK_ERROR',
          message:
            'Backend server is not reachable. Please check your connection or contact support.',
          correlationId: crypto.randomUUID(),
          details: {
            originalError: error.message,
            url: originalRequest?.url,
          },
        },
      }

      return Promise.reject(networkError)
    }

    // Handle 500+ server errors
    if (error.response?.status >= 500) {
      console.error('[API] Server error:', error.response.status, error.response.data)
    }

    // Handle 400-499 client errors (except 401 handled above)
    if (error.response?.status >= 400 && error.response?.status < 500) {
      console.warn('[API] Client error:', error.response.status, error.response.data)
    }

    // Return API error response (already in ErrorResponse format from backend)
    return Promise.reject(error.response?.data || error)
  }
)

/**
 * Type-safe API error checker
 */
export function isApiError(error: unknown): error is ErrorResponse {
  return (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    typeof (error as ErrorResponse).error === 'object' &&
    'code' in (error as ErrorResponse).error &&
    'message' in (error as ErrorResponse).error
  )
}

/**
 * Extract error message from API error
 */
export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'An unexpected error occurred. Please try again.'
}

export default apiClient
