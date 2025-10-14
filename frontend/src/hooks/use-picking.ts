import { useContext } from 'react'
import { PickingContext, type PickingContextType } from '@/contexts/PickingContext'

/**
 * usePicking Hook
 *
 * Access picking workflow context and state.
 * Must be used within a PickingProvider.
 *
 * Extracted to separate file for Fast Refresh compatibility.
 *
 * @returns Picking context with run, batch, item selections and operations
 * @throws Error if used outside PickingProvider
 */
export function usePicking(): PickingContextType {
  const context = useContext(PickingContext)
  if (context === undefined) {
    throw new Error('usePicking must be used within a PickingProvider')
  }
  return context
}
