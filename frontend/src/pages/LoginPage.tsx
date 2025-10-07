import { useState, useEffect, useTransition, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginPage() {
  const navigate = useNavigate()
  const { isAuthenticated, isLoading: authLoading, login } = useAuth()

  // React 19: useTransition for non-blocking state updates
  const [isPending, startTransition] = useTransition()

  // Form state
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [connectionStatus, setConnectionStatus] = useState<
    'unknown' | 'connected' | 'disconnected'
  >('unknown')
  const [touched, setTouched] = useState({ username: false, password: false })

  // Validation
  const isUsernameValid = username.trim().length >= 2
  const isPasswordValid = password.trim().length >= 1
  const canSubmit = isUsernameValid && isPasswordValid && !authLoading && !isPending

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/picking')
    }
  }, [isAuthenticated, navigate])

  // Test backend connection on mount
  useEffect(() => {
    testConnection()

    // Auto-retry connection every 10 seconds if disconnected
    const connectionRetryInterval = setInterval(() => {
      if (connectionStatus === 'disconnected') {
        testConnection()
      }
    }, 10000)

    // Auto-focus username field
    const usernameField = document.getElementById('username')
    if (usernameField) {
      usernameField.focus()
    }

    return () => clearInterval(connectionRetryInterval)
  }, [connectionStatus])

  const testConnection = async () => {
    setConnectionStatus('unknown')

    try {
      // Import config for API base URL
      const { config } = await import('@/config')

      // Test backend health endpoint
      const response = await fetch(`${config.api.baseUrl}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })

      if (response.ok) {
        startTransition(() => {
          setConnectionStatus('connected')
          setLoginError('')
        })
      } else {
        throw new Error('Backend health check failed')
      }
    } catch (error) {
      startTransition(() => {
        setConnectionStatus('disconnected')
        setLoginError(
          'Backend server is not reachable. Start all services with `npm run dev` or verify the Rust backend on port 7075.'
        )
      })
    }
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!canSubmit) {
      setTouched({ username: true, password: true })
      return
    }

    // Clear previous errors
    setLoginError('')

    try {
      // Call AuthContext login (now integrated with backend API)
      await login(username.trim(), password)

      // Navigation will happen via useEffect when isAuthenticated changes
      console.log('[LoginPage] Login successful, redirecting to /picking')
    } catch (error) {
      // Extract error message (already user-friendly from AuthContext)
      const errorMessage =
        error instanceof Error ? error.message : 'Login failed. Please try again.'

      // React 19: Non-blocking error state update
      startTransition(() => {
        setLoginError(errorMessage)
      })

      // Re-test connection on error to update status indicator
      setTimeout(() => testConnection(), 1000)
    }
  }

  const handleFieldKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canSubmit) {
      const form = e.currentTarget.closest('form')
      if (form) {
        form.requestSubmit()
      }
    }
  }

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Backend Connected'
      case 'disconnected':
        return 'Backend Disconnected'
      default:
        return 'Checking Connection...'
    }
  }

  const getConnectionStatusClass = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'border-green-500 bg-green-50 text-green-700'
      case 'disconnected':
        return 'border-red-500 bg-red-50 text-red-700'
      default:
        return 'border-yellow-500 bg-yellow-50 text-yellow-700'
    }
  }

  const getConnectionStatusIconClass = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'bg-green-500'
      case 'disconnected':
        return 'bg-red-500'
      default:
        return 'bg-yellow-500 animate-pulse'
    }
  }

  return (
    <main
      className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden"
      role="main"
    >
      {/* Base gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#8B4513] via-[#8B4513]/80 to-[#8B4513]/90"></div>

      {/* Mobile Warning (hidden on desktop) */}
      <div className="md:hidden fixed top-4 left-4 right-4 z-30 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm font-medium text-yellow-800">
          ⚠️ This system is optimized for warehouse tablets and desktop computers. Some features may
          not work properly on mobile devices.
        </p>
      </div>

      {/* Login form content */}
      <div
        className="bg-white w-full max-w-md p-8 space-y-6 relative z-20 rounded-lg shadow-2xl"
        role="region"
        aria-labelledby="login-heading"
      >
        {/* Header with Logo and Title */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <img
              src="/NWFLogo-256w.webp"
              alt="Newly Weds Foods Thailand Logo"
              width="256"
              height="128"
              loading="eager"
              className="w-80 h-auto max-w-full rounded-lg shadow-lg"
            />
          </div>
          <div>
            <h1 id="login-heading" className="text-xl font-bold text-gray-900 whitespace-nowrap">
              Partial Picking System
            </h1>
          </div>
        </div>

        {/* Login Form */}
        <form
          onSubmit={handleSubmit}
          className="space-y-6"
          role="form"
          aria-labelledby="login-heading"
          noValidate
        >
          {/* Username Field */}
          <div className="space-y-2">
            <Label htmlFor="username" className="block text-sm font-bold text-gray-900">
              Username{' '}
              <span className="text-red-500" aria-label="required">
                *
              </span>
            </Label>
            <Input
              id="username"
              type="text"
              placeholder="Enter your username"
              autoComplete="username"
              spellCheck={false}
              aria-describedby="username-help username-error"
              aria-invalid={touched.username && !isUsernameValid}
              value={username}
              onChange={e => setUsername(e.target.value)}
              onBlur={() => setTouched({ ...touched, username: true })}
              onKeyPress={handleFieldKeyPress}
              className="w-full min-h-[44px] px-4 py-3 text-base"
            />
            <div id="username-help" className="sr-only">
              Enter your warehouse system username
            </div>
            {touched.username && !isUsernameValid && (
              <div
                id="username-error"
                role="alert"
                aria-live="polite"
                className="text-sm text-red-600 mt-1"
              >
                Username must be at least 2 characters
              </div>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <Label htmlFor="password" className="block text-sm font-bold text-gray-900">
              Password{' '}
              <span className="text-red-500" aria-label="required">
                *
              </span>
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              autoComplete="current-password"
              aria-describedby="password-help password-error"
              aria-invalid={touched.password && !isPasswordValid}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onBlur={() => setTouched({ ...touched, password: true })}
              onKeyPress={handleFieldKeyPress}
              className="w-full min-h-[44px] px-4 py-3 text-base"
            />
            <div id="password-help" className="sr-only">
              Enter your warehouse system password
            </div>
            {touched.password && !isPasswordValid && (
              <div
                id="password-error"
                role="alert"
                aria-live="polite"
                className="text-sm text-red-600 mt-1"
              >
                Password is required
              </div>
            )}
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={!canSubmit}
            className="w-full min-h-[44px] px-6 py-3 flex items-center justify-center gap-2 bg-[#8B4513] hover:bg-[#A0522D]"
            aria-describedby={authLoading || isPending ? 'loading-status' : undefined}
          >
            {(authLoading || isPending) && (
              <div
                className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
                aria-hidden="true"
              />
            )}
            <span>{authLoading || isPending ? 'Signing In...' : 'Sign In'}</span>
            {(authLoading || isPending) && (
              <div id="loading-status" className="sr-only" aria-live="polite">
                Authentication in progress
              </div>
            )}
          </Button>

          {/* Error Message */}
          {loginError && (
            <div
              role="alert"
              aria-live="polite"
              className="text-sm text-red-600 text-center bg-red-50 p-3 rounded-lg border border-red-200"
            >
              {loginError}
            </div>
          )}

          {/* Connection Status Alert */}
          <div className="flex justify-center">
            <div
              className={`relative flex items-center gap-3 px-4 py-2 rounded-lg border-2 font-medium text-sm transition-all duration-300 ${getConnectionStatusClass()}`}
              role="status"
              aria-label={`System ${connectionStatus}`}
            >
              {/* Animated Status Indicator */}
              <div className="relative flex items-center">
                <div
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${getConnectionStatusIconClass()}`}
                />
              </div>
              {/* Status Text */}
              <span className="font-semibold">{getConnectionStatusText()}</span>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="text-center text-xs text-gray-500 mt-6 border-t pt-4">
          <p>Partial Picking v1.0</p>
          <p className="mt-1">&copy; 2025 Newly Weds Foods Thailand</p>
        </div>
      </div>

      {/* Skip link for keyboard navigation */}
      <a
        href="#login-heading"
        className="sr-only absolute left-0 top-0 z-50 bg-white text-gray-900 p-4 rounded focus:not-sr-only"
      >
        Skip to main content
      </a>

      {/* Keyboard Shortcuts Help (Screen Reader Only) */}
      <div className="sr-only" aria-live="polite">
        <p>
          Use Tab to navigate between form fields. Press Enter to submit the login form when all
          fields are filled.
        </p>
      </div>
    </main>
  )
}
