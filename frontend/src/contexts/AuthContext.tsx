import { createContext, useState, useEffect, useCallback, ReactNode, useTransition } from 'react'
import { UserDTO } from '@/types/api'
import { config } from '@/config'
import { authApi } from '@/services/api/auth'
import { getErrorMessage } from '@/services/api/client'

export interface AuthContextType {
  user: UserDTO | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  refreshToken: () => Promise<void>
}

// React Context must be exported for hook consumption (see hooks/use-auth.ts)
// Fast Refresh architectural limitation: Context + Provider in same file is standard React pattern
// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Use config values instead of hardcoded constants
const TOKEN_KEY = config.auth.tokenKey
const USER_KEY = config.auth.userDataKey

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<UserDTO | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // React 19: useTransition for non-blocking state updates
  const [, startTransition] = useTransition()

  /**
   * Helper: Clear authentication storage
   */
  const clearAuthStorage = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }, [])

  /**
   * Logout - Clear authentication state and redirect to login
   */
  const logout = useCallback(() => {
    // Clear state (React 19 concurrent update)
    startTransition(() => {
      setToken(null)
      setUser(null)
    })

    // Clear localStorage
    clearAuthStorage()

    // Redirect to login page
    window.location.href = '/login'
  }, [user, startTransition, clearAuthStorage])

  /**
   * Helper: Perform token refresh API call
   */
  const performTokenRefresh = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    try {
      // Call backend refresh API (uses old token in Authorization header)
      const response = await authApi.refreshToken()

      // Update token in localStorage
      localStorage.setItem(TOKEN_KEY, response.token)

      // Update state (React 19 concurrent update)
      startTransition(() => {
        setToken(response.token)
      })
    } catch (error) {
      console.error('[Auth] Token refresh failed:', error)

      // On refresh failure, logout user
      logout()

      throw new Error('Session expired. Please login again.')
    } finally {
      setIsLoading(false)
    }
  }, [startTransition, logout])

  /**
   * Initialize authentication state on mount
   * Checks for existing valid token and auto-refreshes if needed
   */
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY)
      const storedUser = localStorage.getItem(USER_KEY)

      if (storedToken && storedUser) {
        try {
          // Decode JWT to check expiration (JWT format: header.payload.signature)
          const payload = JSON.parse(atob(storedToken.split('.')[1]))
          const expiryTime = payload.exp * 1000 // Convert to milliseconds
          const now = Date.now()

          if (now < expiryTime) {
            // Token is still valid
            startTransition(() => {
              setToken(storedToken)
              setUser(JSON.parse(storedUser))
            })

            // Auto-refresh if token expires within 24 hours
            const timeUntilExpiry = expiryTime - now
            const twentyFourHours = 24 * 60 * 60 * 1000

            if (timeUntilExpiry < twentyFourHours) {
              try {
                await performTokenRefresh()
              } catch (error) {
                console.error('[Auth] Auto-refresh failed:', error)
                // Don't logout on auto-refresh failure, token is still valid
              }
            }
          } else {
            // Token expired, clear storage
            clearAuthStorage()
          }
        } catch (error) {
          console.error('[Auth] Error parsing stored token:', error)
          clearAuthStorage()
        }
      }

      setIsLoading(false)
    }

    initializeAuth()
  }, [performTokenRefresh, clearAuthStorage])

  /**
   * Login with username and password
   * Calls backend API and stores token + user data
   */
  const login = async (username: string, password: string): Promise<void> => {
    setIsLoading(true)
    try {
      // Call backend login API
      const response = await authApi.login(username, password)

      // Store token and user in localStorage
      localStorage.setItem(TOKEN_KEY, response.token)
      localStorage.setItem(USER_KEY, JSON.stringify(response.user))

      // Update state (React 19 concurrent update)
      startTransition(() => {
        setToken(response.token)
        setUser(response.user)
      })
    } catch (error) {
      console.error('[Auth] Login failed:', error)

      // Clear any existing auth data on failure
      clearAuthStorage()

      // Re-throw with user-friendly message
      const errorMessage = getErrorMessage(error)
      throw new Error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Refresh JWT token before expiration
   */
  const refreshToken = async (): Promise<void> => {
    const currentToken = localStorage.getItem(TOKEN_KEY)
    if (!currentToken) {
      throw new Error('No token to refresh')
    }

    await performTokenRefresh()
  }

  const isAuthenticated = !!token && !!user

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isLoading,
        login,
        logout,
        refreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
