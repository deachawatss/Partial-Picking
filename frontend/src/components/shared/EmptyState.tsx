import { LucideIcon, PackageOpen, FileQuestion, AlertCircle } from 'lucide-react'
import { ReactNode } from 'react'

interface EmptyStateProps {
  /** Icon component (Lucide icon) */
  icon?: LucideIcon
  /** Icon variant (predefined icons) */
  variant?: 'empty' | 'not-found' | 'error'
  /** Title text */
  title: string
  /** Description text (optional) */
  description?: string
  /** Action button (optional) */
  action?: ReactNode
  /** Custom icon color */
  iconColor?: string
}

/**
 * EmptyState Component
 *
 * Displays an empty state with icon, title, description, and optional action.
 * Includes fade-in animation for smooth appearance.
 *
 * @example
 * ```tsx
 * // Using variant
 * <EmptyState
 *   variant="empty"
 *   title="No batches selected"
 *   description="Search for a production run to view batches"
 * />
 *
 * // Using custom icon
 * <EmptyState
 *   icon={PackageX}
 *   title="No items found"
 *   action={<button>Refresh</button>}
 * />
 * ```
 */
export function EmptyState({
  icon,
  variant = 'empty',
  title,
  description,
  action,
  iconColor
}: EmptyStateProps) {
  // Map variants to default icons
  const variantIcons: Record<string, LucideIcon> = {
    empty: PackageOpen,
    'not-found': FileQuestion,
    error: AlertCircle
  }

  const Icon = icon || variantIcons[variant]

  // Map variants to colors
  const variantColors: Record<string, string> = {
    empty: '#5B4A3F',
    'not-found': '#E0AA2F',
    error: '#C62828'
  }

  const color = iconColor || variantColors[variant]

  return (
    <div
      className="flex flex-col items-center justify-center py-16 px-6 text-center empty-state-fade-in"
      role="status"
      aria-live="polite"
    >
      {/* Icon */}
      <div className="mb-6 opacity-30 gpu-accelerated">
        <Icon
          className="w-20 h-20"
          strokeWidth={1.5}
          style={{ color }}
          aria-hidden="true"
        />
      </div>

      {/* Title */}
      <h3 className="text-xl font-bold text-[#2B1C14] mb-2">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-sm text-[#5B4A3F] max-w-md mb-6">
          {description}
        </p>
      )}

      {/* Action */}
      {action && (
        <div className="mt-2">
          {action}
        </div>
      )}
    </div>
  )
}
