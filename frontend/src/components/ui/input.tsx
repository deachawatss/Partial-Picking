import * as React from 'react'

import { cn } from '@/lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-12 w-full rounded-lg border-2 border-border-main bg-surface px-4 text-base text-text-primary shadow-soft transition-all placeholder:text-text-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:border-accent-gold disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
