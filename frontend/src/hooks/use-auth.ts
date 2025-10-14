import { useContext } from 'react'
import { AuthContext, type AuthContextType } from '@/contexts/AuthContext'

/**
 * useAuth Hook
 *
 * Access authentication context and state.
 * Must be used within an AuthProvider.
 *
 * Extracted to separate file for Fast Refresh compatibility.
 *
 * @returns Authentication context with user, token, and auth methods
 * @throws Error if used outside AuthProvider
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
